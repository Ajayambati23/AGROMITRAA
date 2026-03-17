'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { cropsAPI, MarketCommodityPrice } from '@/lib/api';
import { TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const TELANGANA_STATE = 'Telangana';

export default function MarketPrices() {
  const { state } = useApp();
  const { t } = useTranslation();
  const [prices, setPrices] = useState<MarketCommodityPrice[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [marketsLoadedForDistrict, setMarketsLoadedForDistrict] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDistricts = async () => {
    setIsLoadingDistricts(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await cropsAPI.getMarketDistricts(TELANGANA_STATE);
      const nextDistricts = response?.districts ?? [];
      setDistricts(nextDistricts);
      setSelectedDistrict((current) => (current && nextDistricts.includes(current) ? current : nextDistricts[0] || ''));
    } catch (err: any) {
      console.error('Failed to load Telangana districts:', err);
      setDistricts([]);
      setSelectedDistrict('');
      setError(err?.response?.data?.message || err?.message || t('couldNotLoadMarketPrices'));
    } finally {
      setIsLoadingDistricts(false);
    }
  };

  const loadMarkets = async (district: string) => {
    if (!district) {
      setMarkets([]);
      setMarketsLoadedForDistrict('');
      setSelectedMarket('');
      setPrices([]);
      setStatusMessage(null);
      return;
    }

    setIsLoadingMarkets(true);
    setError(null);
    setMarkets([]);
    setMarketsLoadedForDistrict('');
    setSelectedMarket('');
    setPrices([]);
    setStatusMessage(null);

    try {
      const response = await cropsAPI.getMarketMandis(TELANGANA_STATE, district);
      const nextMarkets = response?.markets ?? [];
      setMarkets(nextMarkets);
      setMarketsLoadedForDistrict(district);
      setSelectedMarket((current) => (current && nextMarkets.includes(current) ? current : nextMarkets[0] || ''));
    } catch (err: any) {
      console.error('Failed to load Telangana markets:', err);
      setMarkets([]);
      setMarketsLoadedForDistrict(district);
      setSelectedMarket('');
      setError(err?.response?.data?.message || err?.message || t('couldNotLoadMarketPrices'));
    } finally {
      setIsLoadingMarkets(false);
    }
  };

  const loadPrices = async (district: string, market: string) => {
    if (!district || !market) {
      setPrices([]);
      setStatusMessage(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await cropsAPI.getPricesByMandi({
        state: TELANGANA_STATE,
        district,
        market,
        limit: 50,
      });
      setPrices(response?.prices ?? []);
      setStatusMessage(response?.message || null);
    } catch (err: any) {
      console.error('Failed to load Telangana market prices:', err);
      setPrices([]);
      setStatusMessage(null);
      const message = err?.response?.data?.message || err?.message || 'Request failed';
      const isNetworkError = !err?.response && (message?.includes('Network') || message?.includes('fetch'));
      setError(
        isNetworkError
          ? t('serverReachabilityHint')
          : message
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDistricts();
  }, [state.selectedLanguage]);

  useEffect(() => {
    loadMarkets(selectedDistrict);
  }, [selectedDistrict]);

  useEffect(() => {
    if (!selectedDistrict || marketsLoadedForDistrict !== selectedDistrict) {
      return;
    }
    loadPrices(selectedDistrict, selectedMarket);
  }, [selectedDistrict, selectedMarket, marketsLoadedForDistrict]);

  const formatPrice = (price: number | null | undefined, unit: string) => {
    const num = price != null && typeof price === 'number' && !Number.isNaN(price) ? price : null;
    if (num === null) return t('priceNotAvailable');
    if (unit === 'per kg') return `Rs ${num}/kg`;
    if (unit === 'per quintal') return `Rs ${num}/quintal`;
    if (unit === 'per ton') return `Rs ${num}/ton`;
    return `Rs ${num}/${unit}`;
  };

  const hasEnamLivePrices = prices.some((price) => price.source?.includes('eNAM'));
  const bannerTone = hasEnamLivePrices || !statusMessage ? 'blue' : 'amber';

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{t('telanganaMarketPrices')}</h2>
              <p className="text-gray-600 mt-1">
                {t('marketPricesSubtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select value={TELANGANA_STATE} disabled className="input-field bg-gray-100 text-gray-500">
              <option value={TELANGANA_STATE}>{TELANGANA_STATE}</option>
            </select>

            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={isLoadingDistricts || districts.length === 0}
              className="input-field"
            >
              <option value="">{isLoadingDistricts ? t('loadingDistricts') : t('selectDistrict')}</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>

            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              disabled={isLoadingMarkets || markets.length === 0 || !selectedDistrict}
              className="input-field"
            >
              <option value="">{isLoadingMarkets ? t('loadingMarkets') : t('selectMarket')}</option>
              {markets.map((market) => (
                <option key={market} value={market}>
                  {market}
                </option>
              ))}
            </select>

            <button
              onClick={() => loadPrices(selectedDistrict, selectedMarket)}
              disabled={isLoading || !selectedDistrict || !selectedMarket}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('refresh')}</span>
            </button>
          </div>
        </div>

        {selectedDistrict && selectedMarket && (
          <div className={`mt-4 rounded-xl border p-4 ${
            bannerTone === 'blue'
              ? 'bg-blue-50 border-blue-200'
              : bannerTone === 'amber'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-100'
          }`}>
            <p className={`text-sm ${
              bannerTone === 'blue'
                ? 'text-blue-800'
                : bannerTone === 'amber'
                  ? 'text-amber-800'
                  : 'text-green-800'
            }`}>
              {statusMessage
                ? statusMessage
                : <>{t('showingLivePricesFor')} <span className="font-semibold">{selectedMarket}</span>, {selectedDistrict}, {TELANGANA_STATE}</>}
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">{t('loadingTelanganaMarketPrices')}</p>
        </div>
      ) : prices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prices.map((price, index) => (
            <div key={`${price.cropName}-${price.variety || 'default'}`} className="card hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 truncate">{price.cropName}</h3>
                    <p className="text-xs text-gray-500">#{index + 1} {t('inSelectedMarket')}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
                <p className="label-caps text-gray-500 mb-1">{t('currentPrice')}</p>
                <p className={`text-2xl font-bold ${price.price != null && typeof price.price === 'number' ? 'text-green-700' : 'text-amber-600'}`}>
                  {formatPrice(price.price, price.unit)}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-3 text-sm text-gray-600">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{t('minLabel')}</p>
                    <p>{formatPrice(price.min, price.unit)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">{t('maxLabel')}</p>
                    <p>{formatPrice(price.max, price.unit)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-100 space-y-2">
                {price.variety && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-700">{t('variety')}:</span> {price.variety}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">{t('market')}:</span> {price.marketName || selectedMarket}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">{t('district')}:</span> {price.district || selectedDistrict}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {price.source?.includes('eNAM') && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
                      eNAM
                    </span>
                  )}
                  {price.source && !price.source.includes('eNAM') && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {price.source}
                    </span>
                  )}
                  {price.arrivalDate && <span className="text-xs text-gray-500">{t('arrivalLabel')}: {price.arrivalDate}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {error ? t('couldNotLoadMarketPrices') : t('noMarketDataAvailable')}
          </h3>
          <p className="text-gray-500">
            {error || statusMessage || t('marketPricesUnavailableHint')}
          </p>
          {error && (
            <button onClick={() => loadPrices(selectedDistrict, selectedMarket)} className="btn-secondary mt-4">
              {t('retry')}
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
            <h3 className="font-semibold text-blue-800 mb-2">{t('marketInformation')}</h3>
            <p className="text-sm text-blue-700">
              {t('marketInformationEnamOnly')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
