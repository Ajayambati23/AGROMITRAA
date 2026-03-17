'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { cropsAPI } from '@/lib/api';
import { SOIL_TYPES } from '@/data/soilTypes';
import { Search, Filter, Leaf, MapPin, TrendingUp } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface RecommendationMarketPrice {
  current?: number | null;
  min?: number | null;
  max?: number | null;
  unit?: string;
  source?: string;
  location?: string;
}

interface RecommendationCrop {
  id: string;
  name: string;
  scientificName?: string;
  description?: string;
  source?: string;
  locationMatch?: boolean;
  suitability?: number;
  region?: string;
  seasons?: string[];
  marketPrice?: RecommendationMarketPrice;
}

interface RecommendationErrorDetail {
  field?: string;
  value?: string;
  message?: string;
}

interface RecommendationApiError {
  response?: {
    data?: {
      message?: string;
      details?: RecommendationErrorDetail[];
    };
  };
  message?: string;
}

interface RecommendationResponse {
  crops?: RecommendationCrop[];
}

// Indian states for location dropdown
const INDIAN_STATES = [
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Telangana',
  'Andhra Pradesh',
  'West Bengal',
  'Uttar Pradesh',
  'Punjab',
  'Haryana',
  'Madhya Pradesh',
  'Rajasthan',
  'Bihar',
  'Gujarat'
];

export default function CropRecommendations() {
  const { state, dispatch } = useApp();
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<RecommendationCrop[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    season: 'kharif',
    soilType: 'black',
    location: INDIAN_STATES[0],
  });
  const [stateMarketPrices, setStateMarketPrices] = useState<Record<string, RecommendationMarketPrice> | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  const handleGetRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        ...filters,
        language: state.selectedLanguage,
      };
      console.log('Sending payload:', payload);
      const response = await cropsAPI.recommend(payload) as RecommendationResponse;
      setRecommendations(response.crops || []);
    } catch (error: unknown) {
      const typedError = error as RecommendationApiError;
      console.error('Failed to get recommendations:', typedError);
      const errorDetails = typedError.response?.data?.details;
      const errorMessage = typedError.response?.data?.message || typedError.message || t('getRecommendations');
      
      let fullError = errorMessage;
      if (errorDetails) {
        fullError += '\n' + errorDetails.map((e) => `${e.field}: ${e.value} - ${e.message}`).join('\n');
      }
      
      setError(fullError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field === 'location' && value) {
      handleGetStateMarketPrices(value);
    }
  };

  // Load prices for current location on mount and when location changes
  useEffect(() => {
    if (filters.location) {
      handleGetStateMarketPrices(filters.location);
    }
  }, []);

  const handleGetStateMarketPrices = async (selectedState: string) => {
    if (!selectedState) return;
    
    setPricesLoading(true);
    try {
      // Fetch crop recommendations for that state to get prices
      const payload = {
        season: 'year-round',
        soilType: 'black',
        location: selectedState,
        language: state.selectedLanguage,
      };
      const response = await cropsAPI.recommend(payload) as RecommendationResponse;
      
      // Extract prices by crop name
      const priceMap: Record<string, RecommendationMarketPrice> = {};
      if (response.crops) {
        response.crops.forEach((crop) => {
          if (crop.marketPrice) {
            priceMap[crop.name] = crop.marketPrice;
          }
        });
      }
      
      setStateMarketPrices(priceMap);
    } catch (error) {
      console.error('Failed to fetch state prices:', error);
      setStateMarketPrices(null);
    } finally {
      setPricesLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="card">
        <div className="flex items-center space-x-3 mb-4">
          <Filter className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-800">{t('cropRecommendations')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('season')}
            </label>
            <select
              value={filters.season}
              onChange={(e) => handleFilterChange('season', e.target.value)}
              className="input-field"
            >
              <option value="kharif">{t('kharifMonsoon')}</option>
              <option value="rabi">{t('rabiWinter')}</option>
              <option value="zaid">{t('zaidSummer')}</option>
              <option value="year-round">{t('yearRound')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('soilType')}
            </label>
            <select
              value={filters.soilType}
              onChange={(e) => handleFilterChange('soilType', e.target.value)}
              className="input-field"
            >
              {SOIL_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('location')}
            </label>
            <select
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="input-field"
            >
              {INDIAN_STATES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {pricesLoading && filters.location && (
              <p className="text-xs text-gray-500 mt-1">{t('loadingPrices')}</p>
            )}
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGetRecommendations}
              disabled={isLoading}
              className="w-full btn-primary flex items-center justify-center"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  {t('getRecommendations')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <div className="flex-1">
            <p className="font-medium">{t('error')}</p>
            <p className="text-sm whitespace-pre-wrap">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 ml-4 flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((crop) => {
            const dp = stateMarketPrices?.[crop.name] ?? crop.marketPrice;
            const priceSource = dp?.source?.toString();
            const seasons = crop.seasons ?? [];
            return (
              <div
                key={crop.id}
                className="card hover:shadow-md transition-shadow border-l-4 flex flex-col"
                style={{
                  borderLeftColor: crop.source === 'AI' ? '#3b82f6' : crop.locationMatch ? '#16a34a' : '#e2e8f0',
                }}
              >
                {/* 1. Header: name + badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 truncate">{crop.name}</h3>
                      {crop.scientificName && (
                        <p className="text-xs text-gray-500 truncate">{crop.scientificName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
                    {crop.source === 'AI' && (
                      <span className="badge-ai">AI</span>
                    )}
                    {crop.locationMatch && (
                      <span className="badge-success" title={t('location')}>{t('localMatch')}</span>
                    )}
                  </div>
                </div>

                {/* 2. Description */}
                {crop.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{crop.description}</p>
                )}

                {/* 3. Market price – main metric, clear block */}
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 mb-4">
                  <p className="label-caps text-gray-500 mb-1">{t('marketPrices')}</p>
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="price-cell text-xl">
                      ₹{dp?.current ?? '—'} {dp?.unit ? `/${dp.unit}` : ''}
                    </span>
                    {priceSource?.includes('eNAM') && (
                      <span className="text-xs font-medium text-green-600">{t('live')}</span>
                    )}
                    {priceSource?.includes('Cached') && (
                      <span className="text-xs font-medium text-orange-600">{t('cached')}</span>
                    )}
                    {priceSource?.includes('Mock') && (
                      <span className="text-xs font-medium text-gray-500">{t('estimated')}</span>
                    )}
                  </div>
                  {dp?.min != null && dp?.max != null && (
                    <p className="text-xs text-gray-500 mt-1">Range: ₹{dp.min} – ₹{dp.max}</p>
                  )}
                  {dp?.location && dp.location !== 'All-India Average' && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {dp.location}
                    </p>
                  )}
                </div>

                {/* 4. Suitability bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{t('suitability')}</span>
                    <span className="font-semibold text-gray-800">{crop.suitability ?? 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-green-600 transition-all"
                      style={{ width: `${crop.suitability ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* 5. Region + seasons */}
                <div className="mt-auto space-y-2">
                  {crop.region && (
                    <p className="text-xs text-gray-500">
                      {t('region')}: <span className="font-medium text-gray-700 capitalize">{crop.region}</span>
                    </p>
                  )}
                  {seasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {seasons.map((season: string) => (
                        <span
                          key={season}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg font-medium"
                        >
                          {season}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No recommendations message */}
      {recommendations.length === 0 && !isLoading && (
        <div className="card text-center py-12">
          <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {t('noRecommendationsYet')}
          </h3>
          <p className="text-gray-500">
            {t('recommendationsHint')}
          </p>
        </div>
      )}
    </div>
  );
}
