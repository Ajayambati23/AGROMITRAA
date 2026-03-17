const axios = require('axios');
const MarketPrice = require('../models/MarketPrice');
const Crop = require('../models/Crop');
const OpenAI = require('openai');

const ENAM_LIVE_PRICE_PAGE_URL = 'https://enam.gov.in/web/dashboard/live_price';
const ENAM_TRADE_DATA_URL = 'https://enam.gov.in/web/Liveprice_ctrl/trade_data_list';
const ENAM_TIMEOUT_MS = Number(process.env.ENAM_TIMEOUT_MS || 12000);
const ENAM_CACHE_TTL_MS = Number(process.env.ENAM_CACHE_TTL_MS || 5 * 60 * 1000);
const ENAM_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const OPENAI_PRICE_MODEL = process.env.OPENAI_MARKET_MODEL || 'gpt-4o-mini';
const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const enamStateCache = new Map();

const normalizeMarketKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
const normalizeMarketCompactKey = (value) => normalizeMarketKey(value).replace(/\s+/g, '');

// Location hints used for fallback naming and cache refresh
const locationToMandiCode = {
  'Maharashtra': 'Bombay',
  'Karnataka': 'Bangalore',
  'Tamil Nadu': 'Chennai',
  'Telangana': 'Hyderabad',
  'Andhra Pradesh': 'Hyderabad',
  'West Bengal': 'Kolkata',
  'Uttar Pradesh': 'Delhi',
  'Punjab': 'Chandigarh',
  'Haryana': 'Delhi',
  'Madhya Pradesh': 'Indore',
  'Rajasthan': 'Jaipur',
  'Bihar': 'Patna',
  'Gujarat': 'Ahmedabad'
};

/**
 * Alternative provider fallback when live mandi data fails
 * This simulates a real-time provider by using cached All-India values or mock data
 * @param {string} cropName - crop name (used for cache lookup; cache is keyed by cropName)
 * @param {string} commodity - commodity name for API/mock (e.g. Rice, Brinjal)
 */
const fetchFromAlternativeProvider = async (cropName, commodity, mandiName, location) => {
  try {
    // Try to use most recent cached record for this crop (cache is keyed by cropName)
    const cached = await MarketPrice.findOne({ cropName: (cropName || commodity || '').toLowerCase() }).sort({ lastUpdated: -1 });
    if (cached && (cached.currentPrice || cached.minPrice || cached.maxPrice)) {
      const base = cached.currentPrice || Math.round(((cached.minPrice || 0) + (cached.maxPrice || 0)) / 2) || null;
      if (base) {
        const locMultiplier = getLocationMultiplier(commodity || cropName, location);
        const current = Math.round(base * locMultiplier);
        return {
          currentPrice: current,
          minPrice: cached.minPrice || Math.round(current * 0.95),
          maxPrice: cached.maxPrice || Math.round(current * 1.05),
          unit: cached.unit || 'per quintal',
          currency: cached.currency || 'INR',
          arrivalDate: cached.arrivalDate || new Date().toISOString(),
          source: 'Alternate (Simulated)'
        };
      }
    }

    // Fallback to mockMarketPrices (try both commodity and cropName for common variants)
    const key = (commodity || cropName || '').toLowerCase();
    const baseMock = mockMarketPrices[key] || mockMarketPrices[cropName ? cropName.toLowerCase() : ''] || { min: 3000, max: 5000, unit: 'per quintal', currency: 'INR' };
    const locMultiplier2 = getLocationMultiplier(key, location);
    const midpoint = Math.round((baseMock.min + baseMock.max) / 2);
    const current2 = Math.round(midpoint * locMultiplier2);
    return {
      currentPrice: current2,
      minPrice: Math.round(baseMock.min * locMultiplier2),
      maxPrice: Math.round(baseMock.max * locMultiplier2),
      unit: baseMock.unit,
      currency: baseMock.currency,
      arrivalDate: new Date().toISOString(),
      source: 'Alternate (Simulated)'
    };
  } catch (e) {
    console.error('Alternative provider error:', e.message || e);
    return null;
  }
};

// Crop name to commodity mapping for API
const cropToCommodity = {
  'rice': 'Rice',
  'wheat': 'Wheat',
  'maize': 'Maize',
  'cotton': 'Cotton',
  'sugarcane': 'Sugarcane',
  'tomato': 'Tomato',
  'potato': 'Potato',
  'onion': 'Onion',
  'chili': 'Chilli',
  'chilli': 'Chilli',
  'groundnut': 'Groundnut',
  'soybean': 'Soybean',
  'mustard': 'Mustard',
  'jute': 'Jute',
  'coffee': 'Coffee'
};

// Mock market price data with realistic Indian prices (fallback)
const mockMarketPrices = {
  'rice': { min: 2200, max: 3500, unit: 'per quintal', currency: 'INR' },
  'wheat': { min: 2400, max: 3200, unit: 'per quintal', currency: 'INR' },
  'maize': { min: 1800, max: 2800, unit: 'per quintal', currency: 'INR' },
  'cotton': { min: 5500, max: 8000, unit: 'per quintal', currency: 'INR' },
  'sugarcane': { min: 3800, max: 5200, unit: 'per quintal', currency: 'INR' },
  'tomato': { min: 800, max: 2500, unit: 'per quintal', currency: 'INR' },
  'potato': { min: 1200, max: 2800, unit: 'per quintal', currency: 'INR' },
  'onion': { min: 1500, max: 3500, unit: 'per quintal', currency: 'INR' },
  'chili': { min: 6000, max: 14000, unit: 'per quintal', currency: 'INR' },
  'groundnut': { min: 4500, max: 7500, unit: 'per quintal', currency: 'INR' },
  'soybean': { min: 4000, max: 6500, unit: 'per quintal', currency: 'INR' },
  'mustard': { min: 4800, max: 7200, unit: 'per quintal', currency: 'INR' },
  'jute': { min: 3500, max: 6000, unit: 'per quintal', currency: 'INR' },
  'coffee': { min: 12000, max: 18000, unit: 'per quintal', currency: 'INR' }
};

// Location-based price variation (some crops have regional price differences)
const locationPriceVariation = {
  'onion': {
    'Maharashtra': 1.1,
    'Haryana': 0.95,
    'Karnataka': 1.05
  },
  'tomato': {
    'Tamil Nadu': 1.15,
    'Karnataka': 1.1,
    'Telangana': 0.95
  },
  'potato': {
    'Punjab': 0.9,
    'Uttar Pradesh': 0.95,
    'Bihar': 1.05
  },
  'cotton': {
    'Maharashtra': 1.05,
    'Gujarat': 1.0,
    'Telangana': 0.98
  }
};

/**
 * Parse numeric values from live mandi sources
 */
const parseNumeric = (value) => {
  if (value == null) return null;
  const numeric = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
};

const parseArrivalDate = (value) => {
  if (!value) return 0;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  const m = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return 0;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  const dt = new Date(year, month, day);
  return Number.isNaN(dt.getTime()) ? 0 : dt.getTime();
};

const fetchEnamLiveRecordsForState = async (stateName) => {
  const normalizedState = normalizeLocation(stateName)?.toUpperCase();
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

const fetchFromEnam = async (commodity, stateName = null) => {
  const normalizedState = normalizeLocation(stateName);
  if (!normalizedState) return null;

  try {
    const records = await fetchEnamLiveRecordsForState(normalizedState);
    const commodityKey = normalizeMarketCompactKey(commodity);
    if (!commodityKey || records.length === 0) return null;

    const matches = records
      .filter((record) => {
        const recordKey = normalizeMarketCompactKey(record.commodity);
        return recordKey === commodityKey || recordKey.includes(commodityKey) || commodityKey.includes(recordKey);
      })
      .map((record) => {
        const modal = parseNumeric(record.modal_price);
        const min = parseNumeric(record.min_price);
        const max = parseNumeric(record.max_price);
        const current = modal ?? max ?? min;
        if (current == null) return null;

        return {
          currentPrice: current,
          minPrice: min,
          maxPrice: max,
          modalPrice: modal,
          unit: String(record.Commodity_Uom || '').toLowerCase() === 'qui' ? 'per quintal' : 'per quintal',
          currency: 'INR',
          arrivalDate: record.created_at || record.curr_date || null,
          mandiName: record.apmc || null,
          stateName: normalizedState,
          tradedVolume: parseNumeric(record.commodity_traded) || 0
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const byDate = parseArrivalDate(b.arrivalDate) - parseArrivalDate(a.arrivalDate);
        if (byDate !== 0) return byDate;
        if (b.tradedVolume !== a.tradedVolume) return b.tradedVolume - a.tradedVolume;
        return (b.modalPrice ?? b.currentPrice) - (a.modalPrice ?? a.currentPrice);
      });

    if (matches.length === 0) return null;

    return {
      ...matches[0],
      source: 'eNAM Live'
    };
  } catch (error) {
    console.warn('eNAM live price fetch failed:', error.message || error);
    return null;
  }
};

/**
 * OpenAI fallback for mandi/crop price estimates when eNAM is unavailable.
 * Returns normalized numeric price structure or null.
 */
const fetchFromOpenAIProvider = async (cropName, commodity, location) => {
  try {
    if (!openaiClient) return null;

    const prompt = `Estimate current Indian mandi rates for this crop.
Crop: ${commodity || cropName}
State/Location: ${location || 'All-India'}

Return only JSON with numeric fields:
{"currentPrice": number, "minPrice": number, "maxPrice": number, "unit": "per quintal", "currency": "INR", "confidence": "low|medium|high", "note": "short reason"}

Constraints:
- Prices must be realistic Indian mandi prices in INR per quintal.
- Ensure minPrice <= currentPrice <= maxPrice.
- No markdown, no extra text.`;

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_PRICE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an agriculture market analyst. Return strict JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 180
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const currentPrice = Number(parsed.currentPrice);
    const minPrice = Number(parsed.minPrice);
    const maxPrice = Number(parsed.maxPrice);

    if (![currentPrice, minPrice, maxPrice].every((v) => Number.isFinite(v))) return null;
    if (!(minPrice <= currentPrice && currentPrice <= maxPrice)) return null;

    return {
      currentPrice: Math.round(currentPrice),
      minPrice: Math.round(minPrice),
      maxPrice: Math.round(maxPrice),
      unit: parsed.unit || 'per quintal',
      currency: parsed.currency || 'INR',
      arrivalDate: new Date().toISOString(),
      source: 'OpenAI (Estimated)',
      confidence: parsed.confidence || 'medium',
      note: parsed.note || 'Estimated from model due to live source failure'
    };
  } catch (error) {
    console.error('OpenAI mandi price fallback error:', error.message || error);
    return null;
  }
};

// Default state multipliers so all crops can vary by state
const defaultStateMultipliers = {
  'Maharashtra': 1.06,
  'Karnataka': 1.03,
  'Tamil Nadu': 1.04,
  'Telangana': 1.02,
  'Andhra Pradesh': 1.01,
  'West Bengal': 1.05,
  'Uttar Pradesh': 0.98,
  'Punjab': 0.97,
  'Haryana': 0.96,
  'Madhya Pradesh': 1.00,
  'Rajasthan': 0.99,
  'Bihar': 1.02,
  'Gujarat': 1.01
};

// Normalize user-provided location strings so state matching is reliable.
const stateAliases = {
  'maharashtra': 'Maharashtra',
  'mh': 'Maharashtra',
  'karnataka': 'Karnataka',
  'ka': 'Karnataka',
  'tamil nadu': 'Tamil Nadu',
  'tn': 'Tamil Nadu',
  'telangana': 'Telangana',
  'tg': 'Telangana',
  'andhra pradesh': 'Andhra Pradesh',
  'ap': 'Andhra Pradesh',
  'west bengal': 'West Bengal',
  'wb': 'West Bengal',
  'uttar pradesh': 'Uttar Pradesh',
  'up': 'Uttar Pradesh',
  'punjab': 'Punjab',
  'pb': 'Punjab',
  'haryana': 'Haryana',
  'hr': 'Haryana',
  'madhya pradesh': 'Madhya Pradesh',
  'mp': 'Madhya Pradesh',
  'rajasthan': 'Rajasthan',
  'rj': 'Rajasthan',
  'bihar': 'Bihar',
  'br': 'Bihar',
  'gujarat': 'Gujarat',
  'gj': 'Gujarat'
};

const normalizeLocation = (location) => {
  if (!location || typeof location !== 'string') return null;
  const cleaned = location.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;
  const key = cleaned.toLowerCase();
  return stateAliases[key] || cleaned;
};

const getLocationMultiplier = (cropKey, location) => {
  const normalizedLocation = normalizeLocation(location);
  if (!normalizedLocation) return 1;
  const key = String(cropKey || '').toLowerCase();
  const cropSpecific = locationPriceVariation[key]?.[normalizedLocation];
  if (cropSpecific) return cropSpecific;
  if (defaultStateMultipliers[normalizedLocation]) return defaultStateMultipliers[normalizedLocation];

  // Stable fallback for unknown state strings
  const hash = Array.from(String(normalizedLocation)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 0.95 + (hash % 11) / 100; // 0.95 .. 1.05
};

/**
 * Keep Crop.marketPrice in sync so all users can read latest DB-backed value.
 * This supports offline users who rely on stored crop documents.
 */
const syncPriceToCropProfile = async (cropName, priceData) => {
  try {
    const current = Number(priceData?.currentPrice);
    if (!Number.isFinite(current) || current <= 0) return;

    await Crop.findOneAndUpdate(
      { name: new RegExp(`^${cropName}$`, 'i'), isActive: true },
      {
        $set: {
          marketPrice: {
            current: Math.round(current),
            unit: priceData?.unit || 'per quintal',
            currency: priceData?.currency || 'INR'
          }
        }
      }
    );
  } catch (error) {
    console.error('Crop marketPrice sync error:', error.message || error);
  }
};

/**
 * Save or update price in MongoDB cache
 */
const saveToCacheDB = async (cropName, priceData, location) => {
  try {
    const normalizedLocation = normalizeLocation(location) || 'All-India';
    const filter = {
      cropName: cropName.toLowerCase(),
      location: normalizedLocation
    };

    const updateData = {
      ...priceData,
      cropName: cropName.toLowerCase(),
      location: normalizedLocation,
      lastUpdated: new Date(),
      ttl: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    await MarketPrice.findOneAndUpdate(filter, updateData, { upsert: true });
    await syncPriceToCropProfile(cropName, updateData);
    console.log(`Cached price for ${cropName} at ${location}`);
  } catch (error) {
    console.error('Cache DB save error:', error.message);
  }
};

/**
 * Fetch price from MongoDB cache
 */
const fetchFromCacheDB = async (cropName, location) => {
  try {
    const normalizedCrop = cropName.toLowerCase();
    const normalizedLocation = normalizeLocation(location) || 'All-India';

    // 1) Exact crop + location
    let record = await MarketPrice.findOne({
      cropName: normalizedCrop,
      location: normalizedLocation
    }).sort({ lastUpdated: -1 });

    // 2) If location-specific cache is missing, use All-India cache
    if (!record && location) {
      record = await MarketPrice.findOne({
        cropName: normalizedCrop,
        location: 'All-India'
      }).sort({ lastUpdated: -1 });
    }

    // 3) Last fallback: latest cached value for the crop from any location
    if (!record) {
      record = await MarketPrice.findOne({
        cropName: normalizedCrop
      }).sort({ lastUpdated: -1 });
    }

    if (record) {
      console.log(`Found cached price for ${cropName} at ${record.location}`);
      return {
        currentPrice: record.currentPrice,
        minPrice: record.minPrice,
        maxPrice: record.maxPrice,
        modalPrice: record.modalPrice,
        unit: record.unit,
        currency: record.currency,
        location: record.location,
        source: 'Cached (Offline)',
        lastUpdated: record.lastUpdated
      };
    }
    return null;
  } catch (error) {
    console.error('Cache DB fetch error:', error.message);
    return null;
  }
};

const adjustPriceByLocation = (cropKey, requestedLocation, baseLocation, priceData) => {
  const req = normalizeLocation(requestedLocation);
  const base = normalizeLocation(baseLocation);
  if (!req || !base || req === base) return priceData;

  const requestedMultiplier = getLocationMultiplier(cropKey, req);
  const baseMultiplier = getLocationMultiplier(cropKey, base);
  if (!Number.isFinite(requestedMultiplier) || !Number.isFinite(baseMultiplier) || baseMultiplier === 0) {
    return priceData;
  }

  const ratio = requestedMultiplier / baseMultiplier;
  const adjust = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * ratio) : value;
  };

  return {
    ...priceData,
    currentPrice: adjust(priceData.currentPrice),
    minPrice: adjust(priceData.minPrice),
    maxPrice: adjust(priceData.maxPrice),
    location: req
  };
};

/**
 * Fetch stable crop price from Crop collection as fallback baseline
 */
const fetchFromCropProfilePrice = async (cropName) => {
  try {
    const record = await Crop.findOne({ name: new RegExp(`^${cropName}$`, 'i'), isActive: true })
      .select('marketPrice')
      .lean();
    const current = Number(record?.marketPrice?.current);
    if (!Number.isFinite(current) || current <= 0) return null;

    return {
      currentPrice: Math.round(current),
      minPrice: null,
      maxPrice: null,
      unit: record?.marketPrice?.unit || 'per quintal',
      currency: record?.marketPrice?.currency || 'INR',
      source: 'Crop Profile'
    };
  } catch (error) {
    console.error('Crop profile fallback fetch error:', error.message || error);
    return null;
  }
};

/**
 * Fetch real-time market price for a crop
 * Try API first, cache in DB, fallback to DB when offline
 */
const getMarketPrice = async (cropName, location = null, hasInternet = true) => {
  try {
    const cropLower = cropName.toLowerCase();
    const commodity = cropToCommodity[cropLower] || cropName;
    const normalizedLocation = normalizeLocation(location);
    const mandi = normalizedLocation ? (locationToMandiCode[normalizedLocation] || null) : null;

    // Try API when internet is available
    if (hasInternet) {
      const enamPrice = await fetchFromEnam(commodity, normalizedLocation);
      if (enamPrice) {
        console.log(`Market price (eNAM) for ${cropName} @ ${location}:`, enamPrice.currentPrice);
        await saveToCacheDB(cropName, enamPrice, normalizedLocation);
        return {
          cropName: cropName,
          current: enamPrice.currentPrice,
          min: enamPrice.minPrice,
          max: enamPrice.maxPrice,
          unit: enamPrice.unit,
          currency: enamPrice.currency,
          location: normalizedLocation || 'All-India Average',
          timestamp: new Date().toISOString(),
          source: enamPrice.source,
          arrivalDate: enamPrice.arrivalDate,
          mandiName: enamPrice.mandiName || mandi || null
        };
      }

      // If eNAM fails, try OpenAI-based mandi estimate
      const openaiPrice = await fetchFromOpenAIProvider(cropName, commodity, normalizedLocation);
      if (openaiPrice) {
        console.log(`Market price (OpenAI) for ${cropName} @ ${location}:`, openaiPrice.currentPrice);
        await saveToCacheDB(cropName, openaiPrice, normalizedLocation);
        return {
          cropName: cropName,
          current: openaiPrice.currentPrice,
          min: openaiPrice.minPrice,
          max: openaiPrice.maxPrice,
          unit: openaiPrice.unit,
          currency: openaiPrice.currency,
          location: normalizedLocation || 'All-India Average',
          timestamp: new Date().toISOString(),
          source: openaiPrice.source,
          arrivalDate: openaiPrice.arrivalDate,
          confidence: openaiPrice.confidence,
          note: openaiPrice.note
        };
      }

      // Try alternative provider (simulated or other) when eNAM is unavailable
      const alt = await fetchFromAlternativeProvider(cropName, commodity, mandi, normalizedLocation);
      if (alt) {
        console.log(`Market price (Alternative) for ${cropName} @ ${location}:`, alt.currentPrice);
        await saveToCacheDB(cropName, alt, normalizedLocation);
        return {
          cropName: cropName,
          current: alt.currentPrice,
          min: alt.minPrice,
          max: alt.maxPrice,
          unit: alt.unit,
          currency: alt.currency,
          location: normalizedLocation || 'All-India Average',
          timestamp: new Date().toISOString(),
          source: alt.source || 'Alternate',
          arrivalDate: alt.arrivalDate
        };
      }
    }

    // Try cache
    const cachedPrice = await fetchFromCacheDB(cropName, normalizedLocation);
    if (cachedPrice) {
      const adjustedCached = adjustPriceByLocation(cropLower, normalizedLocation, cachedPrice.location, cachedPrice);
      console.log(`Market price (cache) for ${cropName} @ ${location}:`, adjustedCached.currentPrice);
      return {
        cropName: cropName,
        current: adjustedCached.currentPrice,
        min: adjustedCached.minPrice,
        max: adjustedCached.maxPrice,
        unit: adjustedCached.unit,
        currency: adjustedCached.currency,
        location: adjustedCached.location || normalizedLocation || 'All-India Average',
        timestamp: new Date().toISOString(),
        source: adjustedCached.source,
        lastUpdated: adjustedCached.lastUpdated
      };
    }

    // Try stable value from Crop collection before synthetic estimate
    const cropProfilePrice = await fetchFromCropProfilePrice(cropName);
    if (cropProfilePrice) {
      const locationMultiplier = getLocationMultiplier(cropLower, normalizedLocation);
      const adjustedCurrent = Math.round(cropProfilePrice.currentPrice * locationMultiplier);
      const result = {
        cropName: cropName,
        current: adjustedCurrent,
        min: cropProfilePrice.minPrice,
        max: cropProfilePrice.maxPrice,
        unit: cropProfilePrice.unit,
        currency: cropProfilePrice.currency,
        location: normalizedLocation || 'All-India Average',
        timestamp: new Date().toISOString(),
        source: 'Stored Crop Price',
        note: hasInternet ? 'Live source unavailable, using stored crop price' : 'Offline mode using stored crop price'
      };
      await saveToCacheDB(cropName, {
        currentPrice: adjustedCurrent,
        minPrice: cropProfilePrice.minPrice,
        maxPrice: cropProfilePrice.maxPrice,
        unit: cropProfilePrice.unit,
        currency: cropProfilePrice.currency,
        arrivalDate: new Date().toISOString(),
        source: 'Local'
      }, normalizedLocation);
      return result;
    }

    // Fallback mock/estimated price when offline/no data
    let base = mockMarketPrices[cropLower];
    if (!base) {
      base = { min: 3000, max: 5000, unit: 'per quintal', currency: 'INR' };
    }

    const locationMultiplier = getLocationMultiplier(cropLower, normalizedLocation);
    const midpoint = Math.round((base.min + base.max) / 2);
    const currentPrice = Math.round(midpoint * locationMultiplier);

    const result = {
      cropName: cropName,
      current: currentPrice,
      min: Math.round(base.min * locationMultiplier),
      max: Math.round(base.max * locationMultiplier),
      unit: base.unit,
      currency: base.currency,
      location: normalizedLocation || 'All-India Average',
      timestamp: new Date().toISOString(),
      source: 'Mock Data',
      note: hasInternet ? 'API unavailable, using mock' : 'Offline mode with mock data'
    };

    console.log(`Market price (estimated) for ${cropName} @ ${location}:`, result.current, 'multiplier:', locationMultiplier);
    return result;
  } catch (error) {
    console.error('Market price fetch error:', error);
    // Always return a numeric fallback so UI can display a price; use generic estimate if crop unknown
    const cropLower = (cropName || '').toLowerCase();
    const base = mockMarketPrices[cropLower] || { min: 3000, max: 5000, unit: 'per quintal', currency: 'INR' };
    const est = Math.round((base.min + base.max) / 2);
    return {
      cropName: cropName,
      current: est,
      min: base.min,
      max: base.max,
      unit: base.unit,
      currency: base.currency,
      location: normalizeLocation(location) || 'All-India Average',
      timestamp: new Date().toISOString(),
      source: 'Estimated (source temporarily unavailable)',
      error: 'Could not fetch live price'
    };
  }
};

/**
 * Fetch market prices for multiple crops
 */
const getMarketPricesForCrops = async (cropNames, location = null, hasInternet = true) => {
  try {
    const prices = {};
    
    for (const cropName of cropNames) {
      prices[cropName] = await getMarketPrice(cropName, location, hasInternet);
    }
    
    return prices;
  } catch (error) {
    console.error('Batch market price fetch error:', error);
    return {};
  }
};

/**
 * Get comprehensive market data for a crop
 */
const getCropMarketData = async (cropName, location = null, hasInternet = true) => {
  try {
    const price = await getMarketPrice(cropName, location, hasInternet);
    
    return {
      cropName: cropName,
      marketPrice: price,
      marketTrend: 'stable',
      demandLevel: 'high',
      location: location || 'All-India',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Market data fetch error:', error);
    return null;
  }
};

/**
 * Refresh all market prices from API (can be called periodically)
 */
const refreshAllPrices = async () => {
  try {
    console.log('Refreshing market prices from eNAM...');
    let updated = 0;

    for (const [cropName, commodity] of Object.entries(cropToCommodity)) {
      for (const location of Object.keys(locationToMandiCode)) {
        try {
          const priceData = await fetchFromEnam(commodity, location);
          if (priceData) {
            await saveToCacheDB(cropName, priceData, location);
            updated++;
          }
        } catch (e) {
          // Continue with next
        }
      }
    }

    console.log(`Updated ${updated} market price records`);
    return updated;
  } catch (error) {
    console.error('Price refresh error:', error);
    return 0;
  }
};

module.exports = {
  getMarketPrice,
  getMarketPricesForCrops,
  getCropMarketData,
  saveToCacheDB,
  fetchFromCacheDB,
  refreshAllPrices,
  locationToMandiCode,
  cropToCommodity,
  mockMarketPrices
};

