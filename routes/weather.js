const express = require('express');
const axios = require('axios');

const router = express.Router();

// -------------------- CACHE SETUP --------------------
const weatherCache = new Map();
const geoCache = new Map();

const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

function getCacheKey({ location, latitude, longitude }) {
  return `${(location || '').toLowerCase().trim()}_${latitude || ''}_${longitude || ''}`;
}

// -------------------- LOCATION FALLBACK --------------------
const INDIA_LOCATION_FALLBACKS = {
  'andhra pradesh': { lat: 15.9129, lon: 79.74, label: 'Andhra Pradesh, India' },
  'arunachal pradesh': { lat: 28.218, lon: 94.7278, label: 'Arunachal Pradesh, India' },
  assam: { lat: 26.2006, lon: 92.9376, label: 'Assam, India' },
  bihar: { lat: 25.0961, lon: 85.3131, label: 'Bihar, India' },
  chhattisgarh: { lat: 21.2787, lon: 81.8661, label: 'Chhattisgarh, India' },
  goa: { lat: 15.2993, lon: 74.124, label: 'Goa, India' },
  gujarat: { lat: 22.2587, lon: 71.1924, label: 'Gujarat, India' },
  haryana: { lat: 29.0588, lon: 76.0856, label: 'Haryana, India' },
  'himachal pradesh': { lat: 31.1048, lon: 77.1734, label: 'Himachal Pradesh, India' },
  jharkhand: { lat: 23.61, lon: 85.2799, label: 'Jharkhand, India' },
  karnataka: { lat: 15.3173, lon: 75.7139, label: 'Karnataka, India' },
  kerala: { lat: 10.8505, lon: 76.2711, label: 'Kerala, India' },
  'madhya pradesh': { lat: 22.9734, lon: 78.6569, label: 'Madhya Pradesh, India' },
  maharashtra: { lat: 19.7515, lon: 75.7139, label: 'Maharashtra, India' },
  telangana: { lat: 18.1124, lon: 79.0193, label: 'Telangana, India' },
  'tamil nadu': { lat: 11.1271, lon: 78.6569, label: 'Tamil Nadu, India' },
  delhi: { lat: 28.7041, lon: 77.1025, label: 'Delhi, India' }
};

// -------------------- HELPERS --------------------
function normalizeLocationKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/,?\s*india\s*$/i, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getFallbackCoordinates(location) {
  const normalized = normalizeLocationKey(location);
  return INDIA_LOCATION_FALLBACKS[normalized] || null;
}

function weatherCodeToText(code) {
  const map = {
    0: 'Clear',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    61: 'Rain',
    80: 'Rain showers',
    95: 'Thunderstorm'
  };
  return map[code] || 'Unknown';
}

function buildFarmingAlerts({ tempC, windKph, rainProb, humidity }) {
  const alerts = [];
  if (tempC >= 38) alerts.push('High heat expected. Irrigate early morning or evening.');
  if (tempC <= 10) alerts.push('Low temperature risk. Protect sensitive crops.');
  if (rainProb >= 70) alerts.push('High chance of rain. Delay fertilizer or pesticide spray.');
  if (windKph >= 25) alerts.push('Strong winds. Avoid spray operations today.');
  if (humidity >= 85) alerts.push('High humidity. Monitor pest/disease risk.');
  return alerts;
}

// -------------------- ROUTE --------------------
router.get('/current', async (req, res) => {
  const { location, latitude, longitude } = req.query;

  const cacheKey = getCacheKey({ location, latitude, longitude });
  const now = Date.now();

  // ✅ WEATHER CACHE
  if (weatherCache.has(cacheKey)) {
    const { data, timestamp } = weatherCache.get(cacheKey);
    if (now - timestamp < CACHE_TIME) {
      return res.json(data);
    }
  }

  try {
    let lat = latitude ? Number(latitude) : null;
    let lon = longitude ? Number(longitude) : null;
    let resolvedLocation = location || null;

    // ---------------- GEO-CODING (WITH CACHE) ----------------
    if ((lat == null || lon == null) && location) {
      let geoData;

      if (geoCache.has(location)) {
        geoData = geoCache.get(location);
      } else {
        const geoResp = await axios.get(
          'https://geocoding-api.open-meteo.com/v1/search',
          {
            params: { name: location, count: 1 },
            timeout: 5000
          }
        );

        geoData = geoResp.data;
        geoCache.set(location, geoData);
      }

      const hit = geoData?.results?.[0];

      if (!hit) {
        const fallback = getFallbackCoordinates(location);
        if (!fallback) {
          return res.status(400).json({ message: `Invalid location: ${location}` });
        }
        lat = fallback.lat;
        lon = fallback.lon;
        resolvedLocation = fallback.label;
      } else {
        lat = hit.latitude;
        lon = hit.longitude;
        resolvedLocation = `${hit.name}, ${hit.country}`;
      }
    }

    if (lat == null || lon == null) {
      return res.status(400).json({ message: 'Provide location or coordinates' });
    }

    // ---------------- WEATHER API ----------------
    const weatherResp = await axios.get(
      'https://api.open-meteo.com/v1/forecast',
      {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m',
          daily: 'precipitation_probability_max',
          forecast_days: 1
        },
        timeout: 5000
      }
    );

    const current = weatherResp.data?.current || {};
    const daily = weatherResp.data?.daily || {};

    const tempC = current.temperature_2m ?? 0;
    const windKph = current.wind_speed_10m ?? 0;
    const humidity = current.relative_humidity_2m ?? 0;
    const rainProb = daily.precipitation_probability_max?.[0] ?? 0;

    const responseData = {
      location: resolvedLocation || `${lat}, ${lon}`,
      latitude: lat,
      longitude: lon,
      tempC,
      windKph,
      humidity,
      rainProbability: rainProb,
      condition: weatherCodeToText(current.weather_code),
      alerts: buildFarmingAlerts({ tempC, windKph, rainProb, humidity }),
      updatedAt: new Date().toISOString(),
      source: 'Open-Meteo'
    };

    // ✅ SAVE CACHE
    weatherCache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    res.json(responseData);

  } catch (error) {
    console.error('Weather API error:', error.message);

    // ✅ HANDLE RATE LIMIT
    if (error.response?.status === 429) {
      return res.status(429).json({
        message: 'Weather API limit reached. Please try later.'
      });
    }

    // ✅ SAFE FALLBACK (no crash)
    res.json({
      location: location || 'Unknown',
      tempC: null,
      condition: 'Unavailable',
      alerts: ['Weather service temporarily unavailable'],
      updatedAt: new Date().toISOString()
    });
  }
});

module.exports = router;
