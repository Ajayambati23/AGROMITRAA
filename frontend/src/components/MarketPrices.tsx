'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { cropsAPI } from '@/lib/api';
import { TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function MarketPrices() {
  const { state } = useApp();
  const [prices, setPrices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');

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

  const loadPrices = async (location?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await cropsAPI.getMarketPrices(state.selectedLanguage, 20, location);
      setPrices(response?.prices ?? []);
    } catch (err: any) {
      console.error('Failed to load market prices:', err);
      setPrices([]);
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      const isNetworkError = !err?.response && (message?.includes('Network') || message?.includes('fetch'));
      setError(
        isNetworkError
          ? 'Could not reach the server. Start the backend with: npm run dev (from project root) or node server.js'
          : message
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrices(selectedState);
  }, [state.selectedLanguage]);

  useEffect(() => {
    // Reload prices when selected state changes
    loadPrices(selectedState);
  }, [selectedState]);

  const formatPrice = (price: number | null | undefined, unit: string) => {
    const num = price != null && typeof price === 'number' && !Number.isNaN(price) ? price : null;
    if (num === null) return 'Price not available';
    if (unit === 'per kg') return `Rs ${num}/kg`;
    if (unit === 'per quintal') return `Rs ${num}/quintal`;
    if (unit === 'per ton') return `Rs ${num}/ton`;
    return `Rs ${num}/${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-800">Market Prices</h2>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="input-field mr-2"
            >
              <option value="">All States</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
              onClick={() => loadPrices(selectedState)}
              disabled={isLoading}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <p className="text-gray-600 mt-2">
          Current market prices for agricultural commodities
        </p>
      </div>

      {/* Prices Grid */}
      {isLoading ? (
        <div className="card text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading market prices...</p>
        </div>
      ) : prices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prices.map((price, index) => (
            <div key={price.id} className="card hover:shadow-md transition-shadow flex flex-col">
              {/* Header: commodity name + rank */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">{price.name}</h3>
                    <p className="text-xs text-gray-500">#{index + 1} in market</p>
                  </div>
                </div>
              </div>

              {/* Main: price – prominent */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
                <p className="label-caps text-gray-500 mb-1">Current Price</p>
                <p className={`text-2xl font-bold ${price.price != null && typeof price.price === 'number' ? 'text-green-700' : 'text-amber-600'}`}>
                  {formatPrice(price.price, price.unit)}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {price.source?.includes('Agmarknet') && (
                    <span className="badge-success">Live</span>
                  )}
                  {price.source?.includes('Cached') && (
                    <span className="badge-pending">Cached</span>
                  )}
                  {price.source && !price.source.includes('Agmarknet') && !price.source.includes('Cached') && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Estimated</span>
                  )}
                  {price.location && (
                    <span className="text-xs text-blue-600 font-medium">{price.location}</span>
                  )}
                </div>
              </div>

              {/* Footer: last updated */}
              <div className="mt-auto pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">Last updated: Today</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {error ? 'Could not load market prices' : 'No market data available'}
          </h3>
          <p className="text-gray-500">
            {error || 'Unable to load current market prices. Please try again later.'}
          </p>
          {error && (
            <button
              onClick={() => loadPrices(selectedState)}
              className="btn-secondary mt-4"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Market Info */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Market Information</h3>
            <p className="text-sm text-blue-700">
              Prices are updated regularly from APMC (Agricultural Produce Market Committee)
              and other reliable sources. These prices may vary based on location, quality,
              and market conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
