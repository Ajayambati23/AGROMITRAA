const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const Crop = require('../models/Crop');
const { getTranslation } = require('../utils/translations');
const { getLocationData, getOptimalSoilType } = require('../utils/locationData');
const { getMarketPrice, mockMarketPrices } = require('../services/marketPriceService');
const OpenAI = require('openai');

const router = express.Router();
const ENAM_LIVE_PRICE_PAGE_URL = 'https://enam.gov.in/web/dashboard/live_price';
const ENAM_TRADE_DATA_URL = 'https://enam.gov.in/web/Liveprice_ctrl/trade_data_list';
const ENAM_TIMEOUT_MS = Number(process.env.ENAM_TIMEOUT_MS || 12000);
const ENAM_CACHE_TTL_MS = Number(process.env.ENAM_CACHE_TTL_MS || 5 * 60 * 1000);
const ENAM_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const enamStateCache = new Map();
const TELANGANA_ENAM_EXTRA_MARKETS = {
  Hyderabad: ['Hyderabad'],
  Jagtial: ['Metpally'],
  Jangaon: ['Jangaon'],
  Karimnagar: ['Choppadandi'],
  Mahabubabad: ['Kesamudram'],
  Mahabubnagar: ['Narayanpet'],
  Nagarkurnool: ['Achampet'],
  Nizamabad: ['Nizamabad'],
  Sangareddy: ['Zaheerabad'],
  Suryapet: ['Suryapeta'],
  'Warangal (Urban)': ['Warangal']
};
const TELANGANA_FALLBACK_MARKETS = {
  Adilabad: ['Adilabad'],
  'Bhadradri Kothagudem': ['Kothagudem', 'Bhadrachalam'],
  Hyderabad: ['Bowenpally', 'Gudimalkapur'],
  Jagtial: ['Jagtial', 'Metpally'],
  Jangaon: ['Jangaon'],
  'Jogulamba Gadwal': ['Gadwal'],
  Kamareddy: ['Kamareddy', 'Banswada'],
  Karimnagar: ['Karimnagar', 'Huzurabad'],
  Khammam: ['Khammam', 'Madhira'],
  Mahabubabad: ['Mahabubabad'],
  Mahabubnagar: ['Mahabubnagar', 'Narayanpet'],
  Mancherial: ['Mancherial'],
  Medak: ['Medak', 'Narsapur'],
  Medchal: ['Medchal', 'Malkajgiri'],
  Nagarkurnool: ['Nagarkurnool'],
  Nalgonda: ['Nalgonda', 'Miryalaguda'],
  Nirmal: ['Nirmal', 'Bhainsa'],
  Nizamabad: ['Nizamabad', 'Bodhan', 'Armoor'],
  Peddapalli: ['Peddapalli'],
  'Rajanna Sircilla': ['Sircilla'],
  Rangareddy: ['Shadnagar', 'Ibrahimpatnam', 'Chevella'],
  Sangareddy: ['Sangareddy', 'Zaheerabad'],
  Siddipet: ['Siddipet', 'Gajwel'],
  Suryapet: ['Suryapet', 'Kodad'],
  Vikarabad: ['Vikarabad', 'Tandur'],
  Wanaparthy: ['Wanaparthy'],
  'Warangal (Rural)': ['Narsampet', 'Parkal'],
  'Warangal (Urban)': ['Warangal', 'Kazipet'],
  'Yadadri Bhuvanagiri': ['Bhongir', 'Choutuppal']
};

const normalizeField = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeField(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ');

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

const ENAM_SUPPORTED_MARKET_STATES = ['Telangana'];

const getTelanganaFallbackDistricts = () => Object.keys(TELANGANA_FALLBACK_MARKETS).sort((a, b) => a.localeCompare(b));

const getTelanganaFallbackMarkets = (district) => {
  const districtKey = normalizeKey(district);
  const match = Object.entries(TELANGANA_FALLBACK_MARKETS).find(([name]) => normalizeKey(name) === districtKey);
  return match ? [...match[1]].sort((a, b) => a.localeCompare(b)) : [];
};

const getTelanganaEnamExtraMarkets = (district) => {
  const districtKey = normalizeKey(district);
  const match = Object.entries(TELANGANA_ENAM_EXTRA_MARKETS).find(([name]) => normalizeKey(name) === districtKey);
  return match ? [...match[1]].sort((a, b) => a.localeCompare(b)) : [];
};

const getTelanganaKnownMarkets = (district) => uniqueSortedMarkets([
  ...getTelanganaFallbackMarkets(district),
  ...getTelanganaEnamExtraMarkets(district)
]);

const toTitleCase = (value) => normalizeField(value)
  .toLowerCase()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const normalizeCompactKey = (value) => normalizeKey(value).replace(/\s+/g, '');

const MARKET_CANONICAL_NAMES = {
  achampet: 'Achampet',
  armoor: 'Armoor',
  bhongir: 'Bhongir',
  bodhan: 'Bodhan',
  bowenpally: 'Bowenpally',
  choppadandi: 'Choppadandi',
  gadwal: 'Gadwal',
  gudimalkapur: 'Gudimalkapur',
  gudumalkapur: 'Gudimalkapur',
  hyderabad: 'Hyderabad',
  jagtial: 'Jagtial',
  jangaon: 'Jangaon',
  kazipet: 'Kazipet',
  kesamudram: 'Kesamudram',
  metpalli: 'Metpally',
  metpally: 'Metpally',
  narayanpet: 'Narayanpet',
  nizamabad: 'Nizamabad',
  siddipet: 'Siddipet',
  sircilla: 'Sircilla',
  suryapet: 'Suryapet',
  suryapeta: 'Suryapet',
  warangal: 'Warangal',
  zaheerabad: 'Zaheerabad'
};

const canonicalizeMarketName = (value) => {
  const raw = normalizeField(value);
  const key = normalizeCompactKey(raw);
  if (!key) return '';
  return MARKET_CANONICAL_NAMES[key] || toTitleCase(raw);
};

const uniqueSortedMarkets = (markets) => {
  const deduped = new Map();

  for (const market of markets || []) {
    const canonical = canonicalizeMarketName(market);
    const key = normalizeCompactKey(canonical);
    if (!key || deduped.has(key)) continue;
    deduped.set(key, canonical);
  }

  return [...deduped.values()].sort((a, b) => a.localeCompare(b));
};

const buildEmptyMarketPriceResponse = ({
  state,
  district,
  market,
  message,
  source = 'fallback',
  count = 0,
  prices = []
}) => ({
  state,
  district,
  market,
  count,
  prices,
  source,
  message
});

const getFallbackPricesForSelectedMarket = async ({ state, district, market, limit }) => {
  let crops = await Crop.find({ isActive: true })
    .select('name marketPrice')
    .limit(limit)
    .sort({ name: 1 });

  if (crops.length === 0) {
    crops = Object.entries(mockMarketPrices)
      .slice(0, limit)
      .map(([name, marketPrice]) => ({
        name: toTitleCase(name),
        marketPrice: {
          current: Math.round((Number(marketPrice.min || 0) + Number(marketPrice.max || 0)) / 2),
          unit: marketPrice.unit || 'per quintal',
          currency: marketPrice.currency || 'INR'
        }
      }));
  }

  const prices = await Promise.all(crops.map(async (crop) => {
    try {
      const fallback = await getMarketPrice(crop.name, state, false);
      const numericPrice = typeof fallback?.current === 'number' && !Number.isNaN(fallback.current)
        ? fallback.current
        : (crop.marketPrice && typeof crop.marketPrice.current === 'number' ? crop.marketPrice.current : null);

      return {
        cropName: crop.name,
        variety: null,
        price: numericPrice,
        min: typeof fallback?.min === 'number' ? fallback.min : null,
        max: typeof fallback?.max === 'number' ? fallback.max : null,
        unit: fallback?.unit || crop.marketPrice?.unit || 'per quintal',
        currency: fallback?.currency || crop.marketPrice?.currency || 'INR',
        arrivalDate: fallback?.arrivalDate || fallback?.lastUpdated || fallback?.timestamp || null,
        marketName: market,
        district,
        state,
        source: fallback?.source || 'Fallback'
      };
    } catch (error) {
      const fallbackPrice = crop.marketPrice && typeof crop.marketPrice.current === 'number'
        ? crop.marketPrice.current
        : null;

      return {
        cropName: crop.name,
        variety: null,
        price: fallbackPrice,
        min: null,
        max: null,
        unit: crop.marketPrice?.unit || 'per quintal',
        currency: crop.marketPrice?.currency || 'INR',
        arrivalDate: null,
        marketName: market,
        district,
        state,
        source: fallbackPrice != null ? 'Stored Crop Price' : 'Fallback'
      };
    }
  }));

  return prices.filter((entry) => entry.price != null);
};

const resolveUnitFromEnam = (value) => {
  const unit = normalizeField(value).toLowerCase();
  if (unit === 'qui') return 'per quintal';
  return unit ? `per ${unit}` : 'per quintal';
};

const getEnamMarketAliasKeys = ({ district, market }) => {
  const aliases = new Set();
  const addAlias = (value) => {
    const normalized = normalizeCompactKey(value);
    if (normalized) aliases.add(normalized);
  };

  addAlias(market);
  addAlias(district);
  getTelanganaKnownMarkets(district).forEach(addAlias);

  const marketKey = normalizeCompactKey(market);
  const districtKey = normalizeCompactKey(district);
  const manualAliases = {
    bowenpally: ['hyderabad'],
    gudimalkapur: ['hyderabad'],
    hyderabad: ['hyderabad'],
    warangalurban: ['warangal'],
    warangalrural: ['warangal'],
    suryapet: ['suryapeta'],
    kodad: ['suryapeta'],
    jogulambagadwal: ['gadwal'],
    rajannasircilla: ['sircilla'],
    yadadribhuvanagiri: ['bhongir']
  };

  [marketKey, districtKey].forEach((key) => {
    (manualAliases[key] || []).forEach(addAlias);
  });

  return [...aliases];
};

const getEnamMarketsForDistrict = async ({ state, district }) => {
  if (normalizeKey(state) !== 'telangana') return [];

  const records = await fetchEnamLiveRecordsForState(state);
  if (records.length === 0) return [];

  const aliasKeys = getEnamMarketAliasKeys({ district, market: '' });
  const matchedRecords = records.filter((record) => aliasKeys.some((alias) => isEnamMarketMatch(record.apmc, alias)));

  return uniqueSortedMarkets(matchedRecords.map((record) => record.apmc));
};

const getMergedMarketsForDistrict = async ({ state, district, baseMarkets = [] }) => {
  if (normalizeKey(state) !== 'telangana') {
    return uniqueSortedMarkets(baseMarkets);
  }

  let enamMarkets = [];
  try {
    enamMarkets = await getEnamMarketsForDistrict({ state, district });
  } catch (error) {
    console.warn('eNAM market list unavailable:', error.message || error);
  }

  return uniqueSortedMarkets([
    ...baseMarkets,
    ...getTelanganaKnownMarkets(district),
    ...enamMarkets
  ]);
};

const isEnamMarketMatch = (apmc, alias) => {
  const apmcKey = normalizeCompactKey(apmc);
  if (!apmcKey || !alias) return false;
  return apmcKey === alias || apmcKey.startsWith(alias) || alias.startsWith(apmcKey) || apmcKey.includes(alias) || alias.includes(apmcKey);
};

const fetchEnamLiveRecordsForState = async (state) => {
  const normalizedState = normalizeField(state).toUpperCase();
  if (!normalizedState) return [];

  const cached = enamStateCache.get(normalizedState);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.records;
  }

  const pageResponse = await axios.get(ENAM_LIVE_PRICE_PAGE_URL, {
    timeout: ENAM_TIMEOUT_MS,
    headers: {
      'User-Agent': ENAM_USER_AGENT
    }
  });

  const cookies = Array.isArray(pageResponse.headers['set-cookie'])
    ? pageResponse.headers['set-cookie'].map((cookie) => cookie.split(';')[0]).join('; ')
    : '';
  const html = String(pageResponse.data || '');
  const dateMatch = html.match(/id="current_date"\s+value="(\d{4}-\d{2}-\d{2})"/) || html.match(/id="previous_date"\s+value="(\d{4}-\d{2}-\d{2})"/);
  if (!dateMatch?.[1]) {
    throw new Error('Could not determine eNAM live price date');
  }

  const body = new URLSearchParams({
    language: 'en',
    stateName: normalizedState,
    fromDate: dateMatch[1],
    toDate: dateMatch[1]
  }).toString();

  const tradeResponse = await axios.post(ENAM_TRADE_DATA_URL, body, {
    timeout: ENAM_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: ENAM_LIVE_PRICE_PAGE_URL,
      Cookie: cookies,
      'User-Agent': ENAM_USER_AGENT
    }
  });

  const records = Array.isArray(tradeResponse?.data?.data) ? tradeResponse.data.data : [];
  enamStateCache.set(normalizedState, {
    records,
    expiresAt: Date.now() + ENAM_CACHE_TTL_MS
  });

  return records;
};

const getEnamPricesForSelectedMarket = async ({ state, district, market, limit }) => {
  const records = await fetchEnamLiveRecordsForState(state);
  if (records.length === 0) return [];

  const aliasKeys = getEnamMarketAliasKeys({ district, market });
  let matchedRecords = records.filter((record) => aliasKeys.some((alias) => isEnamMarketMatch(record.apmc, alias)));

  if (matchedRecords.length === 0 && district) {
    const districtKey = normalizeCompactKey(district);
    matchedRecords = records.filter((record) => isEnamMarketMatch(record.apmc, districtKey));
  }

  if (matchedRecords.length === 0 && market) {
    const marketKey = normalizeCompactKey(market);
    matchedRecords = records.filter((record) => isEnamMarketMatch(record.apmc, marketKey));
  }

  const byCommodity = new Map();
  for (const record of matchedRecords) {
    const commodity = normalizeField(record.commodity);
    if (!commodity) continue;

    const arrivalMs = parseDateMs(record.created_at || record.curr_date);
    const modal = parsePrice(record.modal_price);
    const min = parsePrice(record.min_price);
    const max = parsePrice(record.max_price);
    const price = modal ?? max ?? min;
    if (price == null) continue;

    const tradedVolume = parsePrice(record.commodity_traded) || 0;
    const normalized = {
      cropName: commodity,
      variety: null,
      price,
      min,
      max,
      unit: resolveUnitFromEnam(record.Commodity_Uom),
      currency: 'INR',
      arrivalDate: record.created_at || record.curr_date || null,
      marketName: normalizeField(record.apmc) || market,
      district,
      state,
      source: 'eNAM Live'
    };

    const existing = byCommodity.get(commodity);
    if (!existing || arrivalMs > existing.arrivalMs || tradedVolume > existing.tradedVolume) {
      byCommodity.set(commodity, { arrivalMs, tradedVolume, payload: normalized });
    }
  }

  return Array.from(byCommodity.values())
    .sort((a, b) => {
      if (b.arrivalMs !== a.arrivalMs) return b.arrivalMs - a.arrivalMs;
      return b.tradedVolume - a.tradedVolume;
    })
    .slice(0, limit)
    .map((entry) => entry.payload);
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

    // For each crop fetch best available price (eNAM -> cache -> mock); never omit a crop
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

// Get supported states for eNAM market browser
router.get('/market-locations/states', async (req, res) => {
  try {
    res.json({ states: ENAM_SUPPORTED_MARKET_STATES, source: 'enam-live' });
  } catch (error) {
    console.error('Market states error:', error.message || error);
    res.status(500).json({ message: 'Error fetching eNAM supported states' });
  }
});

// Get available districts for a selected state
router.get('/market-locations/districts', async (req, res) => {
  const state = normalizeField(req.query.state);
  try {
    if (!state) {
      return res.status(400).json({ message: 'state is required' });
    }

    if (normalizeKey(state) !== 'telangana') {
      return res.json({
        state,
        districts: [],
        source: 'enam-live',
        message: 'eNAM market locations are currently configured for Telangana only'
      });
    }

    res.json({ state, districts: getTelanganaFallbackDistricts(), source: 'enam-live' });
  } catch (error) {
    console.warn('Market districts fallback:', error.message || error);
    if (normalizeKey(state) === 'telangana') {
      return res.json({ state, districts: getTelanganaFallbackDistricts(), source: 'fallback' });
    }
    res.status(500).json({ message: 'Error fetching eNAM districts' });
  }
});

// Get available markets for selected state and district
router.get('/market-locations/markets', async (req, res) => {
  const state = normalizeField(req.query.state);
  const district = normalizeField(req.query.district);
  try {
    if (!state || !district) {
      return res.status(400).json({ message: 'state and district are required' });
    }

    if (normalizeKey(state) !== 'telangana') {
      return res.json({
        state,
        district,
        markets: [],
        source: 'enam-live',
        message: 'eNAM market lists are currently configured for Telangana only'
      });
    }

    const mergedMarkets = await getMergedMarketsForDistrict({ state, district });
    res.json({
      state,
      district,
      markets: mergedMarkets,
      source: 'enam-live'
    });
  } catch (error) {
    console.warn('Market list fallback:', error.message || error);
    if (normalizeKey(state) === 'telangana') {
      const mergedMarkets = await getMergedMarketsForDistrict({ state, district });
      return res.json({ state, district, markets: mergedMarkets, source: 'fallback+enam' });
    }
    res.status(500).json({ message: 'Error fetching eNAM markets' });
  }
});

// Get crop prices for a selected market
router.get('/market-prices/by-market', async (req, res) => {
  const state = normalizeField(req.query.state);
  const district = normalizeField(req.query.district);
  const market = normalizeField(req.query.market);
  try {
    if (!state || !district || !market) {
      return res.status(400).json({ message: 'state, district and market are required' });
    }

    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    const enamPrices = await getEnamPricesForSelectedMarket({ state, district, market, limit });
    if (enamPrices.length > 0) {
      return res.json(buildEmptyMarketPriceResponse({
        state,
        district,
        market,
        count: enamPrices.length,
        prices: enamPrices,
        source: 'enam-live',
        message: `Showing official eNAM live prices for ${canonicalizeMarketName(market) || market}`
      }));
    }

    const fallbackPrices = await getFallbackPricesForSelectedMarket({ state, district, market, limit });
    return res.json(buildEmptyMarketPriceResponse({
      state,
      district,
      market,
      count: fallbackPrices.length,
      prices: fallbackPrices,
      source: 'fallback-market-service',
      message: 'Live eNAM prices are not available for this market right now'
    }));
  } catch (error) {
    console.warn('Market by-market fallback:', error.message || error);
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100)));
    try {
      const enamPrices = await getEnamPricesForSelectedMarket({ state, district, market, limit });
      if (enamPrices.length > 0) {
        return res.json(buildEmptyMarketPriceResponse({
          state,
          district,
          market,
          count: enamPrices.length,
          prices: enamPrices,
          source: 'enam-live',
          message: `Showing official eNAM live prices for ${canonicalizeMarketName(market) || market}`
        }));
      }
    } catch (enamError) {
      console.warn('eNAM live price fallback unavailable:', enamError.message || enamError);
    }

    const fallbackPrices = await getFallbackPricesForSelectedMarket({ state, district, market, limit });
    return res.json(buildEmptyMarketPriceResponse({
      state,
      district,
      market,
      count: fallbackPrices.length,
      prices: fallbackPrices,
      source: 'fallback-market-service',
      message: 'Live eNAM prices are not available for this market right now'
    }));
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

// Refresh market prices
router.post('/market-prices/refresh', async (req, res) => {
  try {
    res.json({
      message: 'Live eNAM prices are fetched on demand; manual refresh is not required',
      recordsUpdated: 0,
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
