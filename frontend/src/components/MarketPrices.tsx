'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { cropsAPI, MarketCommodityPrice } from '@/lib/api';
import { TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function MarketPrices() {
  const { state } = useApp();
  const [prices, setPrices] = useState<MarketCommodityPrice[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedMarket, setSelectedMarket] = useState<string>('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStates = async () => {
    setIsLoadingOptions(true);
    setError(null);
    try {
      const response = await cropsAPI.getMarketStates();
      setStates(response?.states ?? []);
    } catch (err: any) {
      console.error('Failed to load market states:', err);
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      setError(message);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const loadDistricts = async (stateName: string) => {
    setIsLoadingOptions(true);
    setError(null);
    try {
      const response = await cropsAPI.getMarketDistricts(stateName);
      setDistricts(response?.districts ?? []);
    } catch (err: any) {
      console.error('Failed to load districts:', err);
      setDistricts([]);
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      setError(message);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const loadMarkets = async (stateName: string, districtName: string) => {
    setIsLoadingOptions(true);
    setError(null);
    try {
      const response = await cropsAPI.getMarketMandis(stateName, districtName);
      setMarkets(response?.markets ?? []);
    } catch (err: any) {
      console.error('Failed to load markets:', err);
      setMarkets([]);
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      setError(message);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const loadPricesByMarket = async (stateName: string, districtName: string, marketName: string) => {
    setIsLoadingPrices(true);
    setError(null);
    try {
      const response = await cropsAPI.getPricesByMandi({
        state: stateName,
        district: districtName,
        market: marketName,
        limit: 100
      });
      setPrices(response?.prices ?? []);
    } catch (err: any) {
      console.error('Failed to load selected market prices:', err);
      setPrices([]);
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      const isNetworkError = !err?.response && (message?.includes('Network') || message?.includes('fetch'));
      setError(
        isNetworkError
          ? 'Could not reach the server. Start backend with: npm run dev or node server.js'
          : message
      );
    } finally {
      setIsLoadingPrices(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, [state.selectedLanguage]);

  const formatPrice = (price: number | null | undefined, unit?: string) => {
    const num = price != null && typeof price === 'number' && !Number.isNaN(price) ? price : null;
    if (num === null) return 'Price not available';
    const normalizedUnit = unit || 'per quintal';
    if (normalizedUnit === 'per kg') return `Rs ${num}/kg`;
    if (normalizedUnit === 'per quintal') return `Rs ${num}/quintal`;
    if (normalizedUnit === 'per ton') return `Rs ${num}/ton`;
    return `Rs ${num}/${normalizedUnit}`;
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-800">Market Prices</h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedState}
              onChange={(e) => {
                const nextState = e.target.value;
                setSelectedState(nextState);
                setSelectedDistrict('');
                setSelectedMarket('');
                setDistricts([]);
                setMarkets([]);
                setPrices([]);
                if (nextState) loadDistricts(nextState);
              }}
              className="input-field min-w-[180px]"
              disabled={isLoadingOptions}
            >
              <option value="">Select State</option>
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={selectedDistrict}
              onChange={(e) => {
                const nextDistrict = e.target.value;
                setSelectedDistrict(nextDistrict);
                setSelectedMarket('');
                setMarkets([]);
                setPrices([]);
                if (selectedState && nextDistrict) loadMarkets(selectedState, nextDistrict);
              }}
              className="input-field min-w-[180px]"
              disabled={!selectedState || isLoadingOptions}
            >
              <option value="">Select District</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={selectedMarket}
              onChange={(e) => {
                const nextMarket = e.target.value;
                setSelectedMarket(nextMarket);
                setPrices([]);
                if (selectedState && selectedDistrict && nextMarket) {
                  loadPricesByMarket(selectedState, selectedDistrict, nextMarket);
                }
              }}
              className="input-field min-w-[180px]"
              disabled={!selectedDistrict || isLoadingOptions}
            >
              <option value="">Select Market</option>
              {markets.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <button
              onClick={() => {
                if (selectedState && selectedDistrict && selectedMarket) {
                  loadPricesByMarket(selectedState, selectedDistrict, selectedMarket);
                }
              }}
              disabled={isLoadingPrices || !selectedState || !selectedDistrict || !selectedMarket}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPrices ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <p className="text-gray-600 mt-2">
          Select state, district, and market to view current crop prices in that mandi.
        </p>
      </div>

      {isLoadingPrices ? (
        <div className="card text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading market prices...</p>
        </div>
      ) : prices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prices.map((price, index) => (
            <div
              key={`${price.cropName}-${price.variety || 'na'}-${price.arrivalDate || index}`}
              className="card hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">{price.cropName}</h3>
                    {price.variety && (
                      <p className="text-xs text-gray-500 truncate">{price.variety}</p>
                    )}
                    <p className="text-xs text-gray-500">#{index + 1} in market</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
                <p className="label-caps text-gray-500 mb-1">Current Price</p>
                <p className={`text-2xl font-bold ${price.price != null && typeof price.price === 'number' ? 'text-green-700' : 'text-amber-600'}`}>
                  {formatPrice(price.price, price.unit)}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {price.source?.includes('Agmarknet') && (
                    <span className="badge-success">Live</span>
                  )}
                  {price.marketName && (
                    <span className="text-xs text-blue-600 font-medium">{price.marketName}</span>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Last updated: {price.arrivalDate || 'N/A'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {error ? 'Could not load market prices' : 'Select a market to view prices'}
          </h3>
          <p className="text-gray-500">
            {error || 'Choose State, District, and Market to list all available crop prices.'}
          </p>
          {error && (
            <button
              onClick={() => {
                if (selectedState && selectedDistrict && selectedMarket) {
                  loadPricesByMarket(selectedState, selectedDistrict, selectedMarket);
                } else {
                  loadStates();
                }
              }}
              className="btn-secondary mt-4"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Market Information</h3>
            <p className="text-sm text-blue-700">
              Prices are fetched from Agmarknet (data.gov.in) for the selected market.
              Values can vary by grade, variety, and daily arrivals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
