const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const Crop = require('../models/Crop');
const { getTranslation } = require('../utils/translations');
const { getLocationData, getOptimalSoilType } = require('../utils/locationData');
const { getMarketPrice } = require('../services/marketPriceService');
const OpenAI = require('openai');

const router = express.Router();
const AGMARKNET_API_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const AGMARKNET_API_KEY = String(process.env.AGMARKNET_API_KEY || '').trim();
const AGMARKNET_TIMEOUT_MS = Number(process.env.AGMARKNET_TIMEOUT_MS || 12000);

const normalizeField = (value) => String(value || '').trim();

const parsePrice = (value) => {
  if (value == null) return null;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(num) ? num : null;
};

const parseDateMs = (value) => {
  if (!value) return 0;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  const match = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const dt = new Date(year, month, day);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
};

const assertAgmarknetConfigured = (res) => {
  if (AGMARKNET_API_KEY) return true;
  res.status(500).json({ message: 'AGMARKNET_API_KEY is missing on server' });
  return false;
};

const fetchAgmarknetRecords = async ({ filters = {}, maxRecords = 1000 }) => {
  const pageSize = 100;
  const records = [];
  let offset = 0;

  while (records.length < maxRecords) {
    const params = {
      'api-key': AGMARKNET_API_KEY,
      format: 'json',
      limit: Math.min(pageSize, maxRecords - records.length),
      offset
    };

    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && String(value).trim()) {
        params[`filters[${key}]`] = String(value).trim();
      }
    });

    const response = await axios.get(AGMARKNET_API_URL, {
      params,
      timeout: AGMARKNET_TIMEOUT_MS
    });

    const batch = Array.isArray(response?.data?.records) ? response.data.records : [];
    if (batch.length === 0) break;
    records.push(...batch);
    offset += batch.length;

    const total = Number(response?.data?.total);
    if (Number.isFinite(total) && offset >= total) break;
    if (batch.length < pageSize) break;
  }

  return records;
};

// Check internet connectivity
const checkInternetConnection = async () => {
  try {
    // Try to connect to a public DNS server
    const https = require('https');
    return new Promise((resolve) => {
      https.get('https://www.google.com', { timeout: 2000 }, () => {
        resolve(true);
      }).on('error', () => {
        resolve(false);
      });
    });
  } catch (error) {
    return false;
  }
};

// Initialize OpenAI if API key exists
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Generate AI-powered crop recommendations
// hasInternet is passed so we can fetch market prices (live vs cache) for AI-suggested crops
const generateAIRecommendations = async (season, soilType, location, language = 'english', hasInternet = true) => {
  if (!openai) {
    console.log('OpenAI not configured, skipping AI recommendations');
    return [];
  }

  try {
    console.log('Generating AI recommendations for:', { season, soilType, location });
    
    const prompt = `You are an expert agricultural advisor for Indian farming. Based on the following conditions, recommend 3-5 suitable crops for a farmer.

Season: ${season} (Kharif=Monsoon, Rabi=Winter, Zaid=Summer)
Soil Type: ${soilType} (options: black, red, laterite, alluvial, mountain, saline, desert)
Location: ${location || 'Not specified (suggest for all India)'}
Language: Respond in ${language}

For each crop, provide ONLY JSON format without any markdown code blocks or extra text. Provide exactly this format for each crop, one per line:
{"name": "crop name", "scientificName": "scientific name", "description": "short description", "marketPrice": "approximate price", "suitability": 80}

Provide 3-5 crop recommendations only.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert agricultural advisor. Respond ONLY with valid JSON format, one crop per line, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') {
      console.log('AI returned no content');
      return [];
    }
    // Strip markdown code blocks if present
    const content = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    console.log('AI Response (first 500 chars):', content.slice(0, 500));

    // Extract array of crop-like objects from AI response (handles array, multi-line, or one-per-line)
    const parseCropObjects = (text) => {
      const objects = [];
      // 1) Try parsing whole response as JSON array
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.filter(p => p && (p.name || p.crop));
        if (parsed && (parsed.name || parsed.crop)) return [parsed];
      } catch (_) {}
      // 2) Find all {...} blocks by matching braces (handles pretty-printed multi-line JSON)
      let i = 0;
      while (i < text.length) {
        if (text[i] === '{') {
          let depth = 1;
          let j = i + 1;
          while (j < text.length && depth > 0) {
            if (text[j] === '{') depth++;
            else if (text[j] === '}') depth--;
            j++;
          }
          if (depth === 0) {
            try {
              const obj = JSON.parse(text.slice(i, j));
              if (obj && (obj.name || obj.crop)) objects.push(obj);
            } catch (_) {}
          }
          i = j;
        } else {
          i++;
        }
      }
      return objects.length ? objects : null;
    };

    const cropObjects = parseCropObjects(content);
    if (!cropObjects || cropObjects.length === 0) {
      console.log('No valid crop JSON found in AI response');
      return [];
    }

    const aiCrops = [];
    for (const cropData of cropObjects) {
      try {
        const name = cropData.name || cropData.crop || '';
        if (!name) continue;
        // Fetch real market price for AI crop based on location
        const marketPriceData = await getMarketPrice(name, location, hasInternet);
        aiCrops.push({
          id: `ai-${String(name).toLowerCase().replace(/\s+/g, '-')}`,
          name: name,
          scientificName: cropData.scientificName || cropData.scientific_name || '',
          description: cropData.description || '',
          seasons: [season],
          soilTypes: [soilType],
          marketPrice: {
            current: marketPriceData.current,
            min: marketPriceData.min,
            max: marketPriceData.max,
            unit: marketPriceData.unit,
            currency: marketPriceData.currency,
            location: marketPriceData.location,
            mandiName: marketPriceData.mandiName || null
          },
          images: [],
          suitability: Math.min(100, cropData.suitability || 75),
          source: 'AI'
        });
      } catch (e) {
        console.log('Could not add AI crop:', cropData.name || cropData.crop, e.message);
      }
    }

    console.log('Parsed AI crops:', aiCrops.length);
    return aiCrops;
  } catch (error) {
    console.error('AI recommendation error:', error);
    return [];
  }
};

// Get all crops
router.get('/', async (req, res) => {
  try {
    const { 
      season, 
      soilType, 
      language = 'english',
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    const query = { isActive: true };

    // Filter by season
    if (season) {
      query.seasons = season;
    }

    // Filter by soil type
    if (soilType) {
      query.soilTypes = soilType;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { scientificName: { $regex: search, $options: 'i' } },
        { 'localNames.hindi': { $regex: search, $options: 'i' } },
        { 'localNames.telugu': { $regex: search, $options: 'i' } },
        { 'localNames.kannada': { $regex: search, $options: 'i' } },
        { 'localNames.tamil': { $regex: search, $options: 'i' } },
        { 'localNames.malayalam': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const crops = await Crop.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await Crop.countDocuments(query);

    // Format response based on language
    const formattedCrops = crops.map(crop => ({
      id: crop._id,
      name: crop.localNames[language] || crop.name,
      scientificName: crop.scientificName,
      description: crop.description,
      seasons: crop.seasons,
      soilTypes: crop.soilTypes,
      climate: crop.climate,
      planting: crop.planting,
      irrigation: crop.irrigation,
      fertilization: crop.fertilization,
      pestControl: crop.pestControl,
      harvesting: crop.harvesting,
      marketPrice: crop.marketPrice,
      images: crop.images
    }));

    res.json({
      crops: formattedCrops,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: crops.length,
        totalCount: total
      }
    });
  } catch (error) {
    console.error('Get crops error:', error);
    res.status(500).json({ message: 'Error fetching crops' });
  }
});

// Get market prices for crops (supports location-based prices and caching)
router.get('/market-prices', async (req, res) => {
  try {
    const { language = 'english', limit = 20, location } = req.query;

    console.log('Market-prices request, location:', location);

    // Determine internet availability for live API vs cache
    const hasInternet = await checkInternetConnection();

    // Fetch top crops from DB to show prices for (include marketPrice for fallback)
    const crops = await Crop.find({ isActive: true })
      .select('name localNames marketPrice')
      .limit(parseInt(limit))
      .sort({ name: 1 });

    // For each crop fetch best available price (Agmarknet -> cache -> mock); never omit a crop
    const prices = await Promise.all(crops.map(async (crop) => {
      try {
        const market = await getMarketPrice(crop.name, location, hasInternet);
        const numericPrice = (market.current != null && typeof market.current === 'number' && !Number.isNaN(market.current))
          ? market.current
          : (crop.marketPrice && typeof crop.marketPrice.current === 'number')
            ? crop.marketPrice.current
            : null;
        console.log(`Price fetched for ${crop.name} @ ${location}:`, { source: market.source, current: numericPrice ?? market.current });
        return {
          id: crop._id,
          name: crop.localNames[language] || crop.name,
          price: numericPrice,
          min: market.min,
          max: market.max,
          unit: market.unit || 'per quintal',
          currency: market.currency || 'INR',
          source: market.source,
          location: market.location,
          mandiName: market.mandiName || null
        };
      } catch (e) {
        // Fallback to stored crop market price so the crop still shows a value when possible
        const fallbackPrice = (crop.marketPrice && typeof crop.marketPrice.current === 'number')
          ? crop.marketPrice.current
          : null;
        return {
          id: crop._id,
          name: crop.localNames[language] || crop.name,
          price: fallbackPrice,
          unit: 'per quintal',
          currency: 'INR',
          source: fallbackPrice ? 'Stored (offline)' : 'Error'
        };
      }
    }));

    res.json({
      message: getTranslation('marketPrice', language),
      prices: prices
    });
  } catch (error) {
    console.error('Market prices error:', error);
    res.status(500).json({ message: 'Error fetching market prices', error: error.message });
  }
});

// Get available states from Agmarknet
router.get('/market-locations/states', async (req, res) => {
  try {
    if (!assertAgmarknetConfigured(res)) return;

    const records = await fetchAgmarknetRecords({ maxRecords: 3000 });
    const states = Array.from(
      new Set(
        records
          .map((r) => normalizeField(r.state || r.state_name))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    res.json({ states });
  } catch (error) {
    console.error('Market states error:', error.message || error);
    res.status(500).json({ message: 'Error fetching states from Agmarknet' });
  }
});

// Get available districts for a selected state
router.get('/market-locations/districts', async (req, res) => {
  try {
    if (!assertAgmarknetConfigured(res)) return;
    const state = normalizeField(req.query.state);
    if (!state) {
      return res.status(400).json({ message: 'state is required' });
    }

    let records = await fetchAgmarknetRecords({
      filters: { state },
      maxRecords: 3000
    });

    if (records.length === 0) {
      records = await fetchAgmarknetRecords({
        filters: { state_name: state },
        maxRecords: 3000
      });
    }

    const districts = Array.from(
      new Set(
        records
          .map((r) => normalizeField(r.district))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    res.json({ state, districts });
  } catch (error) {
    console.error('Market districts error:', error.message || error);
    res.status(500).json({ message: 'Error fetching districts from Agmarknet' });
  }
});

// Get available markets for selected state and district
router.get('/market-locations/markets', async (req, res) => {
  try {
    if (!assertAgmarknetConfigured(res)) return;
    const state = normalizeField(req.query.state);
    const district = normalizeField(req.query.district);

    if (!state || !district) {
      return res.status(400).json({ message: 'state and district are required' });
    }

    let records = await fetchAgmarknetRecords({
      filters: { state, district },
      maxRecords: 3000
    });

    if (records.length === 0) {
      records = await fetchAgmarknetRecords({
        filters: { state_name: state, district },
        maxRecords: 3000
      });
    }

    const markets = Array.from(
      new Set(
        records
          .map((r) => normalizeField(r.market_name || r.market))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    res.json({ state, district, markets });
  } catch (error) {
    console.error('Market list error:', error.message || error);
    res.status(500).json({ message: 'Error fetching markets from Agmarknet' });
  }
});

// Get crop prices for a selected market
router.get('/market-prices/by-market', async (req, res) => {
  try {
    if (!assertAgmarknetConfigured(res)) return;
    const state = normalizeField(req.query.state);
    const district = normalizeField(req.query.district);
    const market = normalizeField(req.query.market);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));

    if (!state || !district || !market) {
      return res.status(400).json({ message: 'state, district and market are required' });
    }

    let records = await fetchAgmarknetRecords({
      filters: { state, district, market_name: market },
      maxRecords: 2000
    });

    if (records.length === 0) {
      records = await fetchAgmarknetRecords({
        filters: { state_name: state, district, market_name: market },
        maxRecords: 2000
      });
    }

    const byCommodity = new Map();
    for (const record of records) {
      const commodity = normalizeField(record.commodity || record.commodity_name);
      if (!commodity) continue;
      const arrivalMs = parseDateMs(record.arrival_date);
      const modal = parsePrice(record.modal_price);
      const min = parsePrice(record.min_price);
      const max = parsePrice(record.max_price);
      const price = modal ?? max ?? min;
      if (price == null) continue;

      const normalized = {
        cropName: commodity,
        variety: normalizeField(record.variety || record.variety_name) || null,
        price,
        min,
        max,
        unit: 'per quintal',
        currency: 'INR',
        arrivalDate: record.arrival_date || null,
        marketName: normalizeField(record.market_name || record.market) || market,
        district: normalizeField(record.district) || district,
        state: normalizeField(record.state || record.state_name) || state,
        source: 'Agmarknet'
      };

      const existing = byCommodity.get(commodity);
      if (!existing || arrivalMs > existing.arrivalMs) {
        byCommodity.set(commodity, { arrivalMs, payload: normalized });
      }
    }

    const prices = Array.from(byCommodity.values())
      .sort((a, b) => b.arrivalMs - a.arrivalMs)
      .slice(0, limit)
      .map((entry) => entry.payload);

    res.json({ state, district, market, count: prices.length, prices });
  } catch (error) {
    console.error('Market by-market prices error:', error.message || error);
    res.status(500).json({ message: 'Error fetching selected market prices' });
  }
});

// Get crop by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'english' } = req.query;

    const crop = await Crop.findById(id);
    if (!crop) {
      return res.status(404).json({ message: 'Crop not found' });
    }

    // Format response based on language
    const formattedCrop = {
      id: crop._id,
      name: crop.localNames[language] || crop.name,
      scientificName: crop.scientificName,
      description: crop.description,
      seasons: crop.seasons,
      soilTypes: crop.soilTypes,
      climate: crop.climate,
      planting: crop.planting,
      irrigation: crop.irrigation,
      fertilization: crop.fertilization,
      pestControl: crop.pestControl,
      harvesting: crop.harvesting,
      marketPrice: crop.marketPrice,
      images: crop.images
    };

    res.json({ crop: formattedCrop });
  } catch (error) {
    console.error('Get crop error:', error);
    res.status(500).json({ message: 'Error fetching crop' });
  }
});

// Get crop recommendations with location and AI support
router.post('/recommend', [
  body('season').trim().isIn(['kharif', 'rabi', 'zaid', 'year-round']).withMessage('Invalid season'),
  body('soilType').trim().isIn(['black', 'red', 'laterite', 'alluvial', 'mountain', 'saline', 'desert']).withMessage('Invalid soil type'),
  body('location').trim().notEmpty().withMessage('Location is required').isString(),
  body('language').optional().trim()
], async (req, res) => {
  try {
    console.log('Raw request body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation error',
        details: errors.array().map(e => ({ field: e.param, value: e.value, message: e.msg }))
      });
    }

    const { season, soilType, location, language = 'english' } = req.body;
    
    console.log('Processing recommendation:', { season, soilType, location, language });
    
    // Language code mapping
    const languageCodeMap = {
      'hi': 'hindi',
      'te': 'telugu', 
      'en': 'english',
      'kn': 'kannada',
      'ta': 'tamil',
      'ml': 'malayalam',
      'hindi': 'hindi',
      'telugu': 'telugu',
      'english': 'english',
      'kannada': 'kannada',
      'tamil': 'tamil',
      'malayalam': 'malayalam'
    };
    
    const mappedLanguage = languageCodeMap[language] || 'english';
    
    // Check internet connection for AI recommendations
    const hasInternet = await checkInternetConnection();
    console.log('Internet available:', hasInternet);

    // Find suitable crops - use $in for array fields
    const crops = await Crop.find({
      seasons: { $in: [season] },
      soilTypes: { $in: [soilType] },
      isActive: true
    }).limit(10);

    console.log('Found crops:', crops.length, 'for', { season, soilType });

    if (crops.length === 0) {
      console.log('No crops found, checking all available crops...');
      const allCrops = await Crop.find({ isActive: true });
      console.log('Total active crops in DB:', allCrops.length);
      
      return res.json({
        message: 'Crop Recommendations',
        crops: [],
        recommendation: 'No suitable crops found for your conditions.',
        debug: {
          searchedFor: { season, soilType },
          totalCropsInDB: allCrops.length
        }
      });
    }

    // Format response with real market prices
    let formattedCrops = await Promise.all(crops.map(async (crop) => {
      // Fetch real market price based on location with internet flag
      const marketPriceData = await getMarketPrice(crop.name, location, hasInternet);
      
      return {
        id: crop._id,
        name: crop.localNames[mappedLanguage] || crop.name,
        scientificName: crop.scientificName,
        description: crop.description,
        seasons: crop.seasons,
        soilTypes: crop.soilTypes,
        marketPrice: {
          current: marketPriceData.current,
          min: marketPriceData.min,
          max: marketPriceData.max,
          unit: marketPriceData.unit,
          currency: marketPriceData.currency,
          location: marketPriceData.location,
          mandiName: marketPriceData.mandiName || null
        },
        images: crop.images,
        suitability: calculateSuitability(crop, season, soilType, location),
        source: 'Database'
      };
    }));

    // If internet and location provided, add location-based insights
    if (hasInternet && location) {
      const locationData = getLocationData(location);
      if (locationData) {
        console.log('Found location data for:', location);
        // Boost suitability for crops marked as primary for this location
        formattedCrops = formattedCrops.map(crop => ({
          ...crop,
          locationMatch: locationData.primaryCrops.some(primary => 
            crop.name.toLowerCase().includes(primary.toLowerCase())
          ),
          region: locationData.region
        }));
      }
    }

    // Generate AI recommendations if internet is available and OpenAI is configured
    let recommendationMethod = 'Database';
    if (hasInternet && openai) {
      console.log('Attempting to generate AI recommendations...');
      const aiCrops = await generateAIRecommendations(season, soilType, location, mappedLanguage, hasInternet);
      
      if (aiCrops.length > 0) {
        console.log('Successfully generated', aiCrops.length, 'AI recommendations');
        
        // Add location match info to AI crops
        if (location) {
          const locationData = getLocationData(location);
          if (locationData) {
            for (let crop of aiCrops) {
              crop.locationMatch = locationData.primaryCrops.some(primary => 
                crop.name.toLowerCase().includes(primary.toLowerCase())
              );
              crop.region = locationData.region;
            }
          }
        }
        
        // Merge and deduplicate: AI crops at top, then database crops
        const mergedCrops = [];
        const addedNames = new Set();
        
        // Add AI crops first (higher priority)
        for (const crop of aiCrops) {
          mergedCrops.push(crop);
          addedNames.add(crop.name.toLowerCase());
        }
        
        // Add database crops that aren't duplicates
        for (const crop of formattedCrops) {
          if (!addedNames.has(crop.name.toLowerCase())) {
            mergedCrops.push(crop);
            addedNames.add(crop.name.toLowerCase());
          }
        }
        
        formattedCrops = mergedCrops.slice(0, 10); // Keep top 10
        recommendationMethod = 'AI + Database';
      }
    }

    // Sort by suitability
    formattedCrops.sort((a, b) => b.suitability - a.suitability);

    res.json({
      message: 'Crop Recommendations',
      crops: formattedCrops,
      season: season,
      soilType: soilType,
      location: location,
      method: recommendationMethod,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Crop recommendation error:', error);
    res.status(500).json({ message: 'Error generating crop recommendations', error: error.message });
  }
});

// Get harvesting guidance for a crop
router.get('/:id/harvesting', async (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'english' } = req.query;

    const crop = await Crop.findById(id);
    if (!crop) {
      return res.status(404).json({ message: 'Crop not found' });
    }

    const guidance = {
      crop: crop.localNames[language] || crop.name,
      maturityPeriod: crop.harvesting.maturityPeriod,
      indicators: crop.harvesting.indicators,
      method: crop.harvesting.method,
      yield: crop.harvesting.yield,
      steps: generateHarvestingSteps(crop, language)
    };

    res.json({
      message: getTranslation('harvestingGuidance', language),
      guidance: guidance
    });
  } catch (error) {
    console.error('Harvesting guidance error:', error);
    res.status(500).json({ message: 'Error fetching harvesting guidance' });
  }
});

// Get pest control information for a crop
router.get('/:id/pest-control', async (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'english' } = req.query;

    const crop = await Crop.findById(id);
    if (!crop) {
      return res.status(404).json({ message: 'Crop not found' });
    }

    const pestControl = {
      crop: crop.localNames[language] || crop.name,
      commonPests: crop.pestControl.commonPests,
      pesticides: crop.pestControl.pesticides,
      organicControl: crop.pestControl.organicControl
    };

    res.json({
      message: getTranslation('pestControl', language),
      pestControl: pestControl
    });
  } catch (error) {
    console.error('Pest control error:', error);
    res.status(500).json({ message: 'Error fetching pest control information' });
  }
});

// Get irrigation guidance for a crop
router.get('/:id/irrigation', async (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'english' } = req.query;

    const crop = await Crop.findById(id);
    if (!crop) {
      return res.status(404).json({ message: 'Crop not found' });
    }

    const irrigation = {
      crop: crop.localNames[language] || crop.name,
      frequency: crop.irrigation.frequency,
      waterRequirement: crop.irrigation.waterRequirement,
      methods: crop.irrigation.methods,
      schedule: generateIrrigationSchedule(crop, language)
    };

    res.json({
      message: getTranslation('irrigation', language),
      irrigation: irrigation
    });
  } catch (error) {
    console.error('Irrigation guidance error:', error);
    res.status(500).json({ message: 'Error fetching irrigation guidance' });
  }
});

// Get fertilization guidance for a crop
router.get('/:id/fertilization', async (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'english' } = req.query;

    const crop = await Crop.findById(id);
    if (!crop) {
      return res.status(404).json({ message: 'Crop not found' });
    }

    const fertilization = {
      crop: crop.localNames[language] || crop.name,
      npk: crop.fertilization.npk,
      organic: crop.fertilization.organic,
      schedule: crop.fertilization.schedule
    };

    res.json({
      message: getTranslation('fertilization', language),
      fertilization: fertilization
    });
  } catch (error) {
    console.error('Fertilization guidance error:', error);
    res.status(500).json({ message: 'Error fetching fertilization guidance' });
  }
});

// Helper functions
function calculateSuitability(crop, season, soilType, location) {
  let score = 0;
  
  // Season compatibility
  if (crop.seasons.includes(season)) {
    score += 40;
  }
  
  // Soil compatibility
  if (crop.soilTypes.includes(soilType)) {
    score += 30;
  }
  
  // Climate compatibility (simplified)
  score += 20;
  
  // Market price factor
  if (crop.marketPrice && crop.marketPrice.current > 0) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

function generateHarvestingSteps(crop, language) {
  const steps = [
    `${getTranslation('planting', language)}: ${crop.planting.plantingTime}`,
    `${getTranslation('irrigation', language)}: ${crop.irrigation.frequency}`,
    `${getTranslation('fertilization', language)}: ${crop.fertilization.schedule.map(s => s.stage).join(', ')}`,
    `${getTranslation('harvesting', language)}: ${crop.harvesting.method}`
  ];
  
  return steps;
}

function generateIrrigationSchedule(crop, language) {
  return {
    frequency: crop.irrigation.frequency,
    timing: 'Early morning or evening',
    amount: `${crop.irrigation.waterRequirement} liters per plant`,
    methods: crop.irrigation.methods
  };
}

// Refresh market prices from Agmarknet API
router.post('/market-prices/refresh', async (req, res) => {
  try {
    const { refreshAllPrices } = require('../services/marketPriceService');
    console.log('Manual market price refresh initiated');
    
    const updated = await refreshAllPrices();
    
    res.json({
      message: 'Market prices refreshed',
      recordsUpdated: updated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Market price refresh error:', error);
    res.status(500).json({ 
      message: 'Error refreshing market prices',
      error: error.message 
    });
  }
});

module.exports = router;
