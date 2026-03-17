'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { buyerMarketplaceAPI, buyerOrdersAPI, getErrorMessage, Listing } from '@/lib/api';
import { Package, MapPin, Search, Leaf, ShoppingCart, LogOut, RefreshCw } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka', 'Madhya Pradesh',
  'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal',
];

export default function BuyerPortalPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState('');
  const [cropSearch, setCropSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [quantityByListing, setQuantityByListing] = useState<Record<string, number>>({});
  const [proceedingId, setProceedingId] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await buyerMarketplaceAPI.browse({
        state: stateFilter || undefined,
        cropName: cropSearch || undefined,
        limit: 50,
        page: 1,
      });
      setListings(res.listings || []);
      setTotal(res.total ?? 0);
    } catch (err) {
      setListings([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [stateFilter]);

  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [stateFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('buyerToken');
      const buyer = localStorage.getItem('buyer');
      setIsLoggedIn(!!token);
      if (buyer) {
        try {
          const parsedBuyer = JSON.parse(buyer) as { name?: string };
          setBuyerName(parsedBuyer.name || '');
        } catch {
          setBuyerName('');
        }
      }
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('buyerToken');
      localStorage.removeItem('buyer');
      setIsLoggedIn(false);
      setBuyerName('');
    }
    router.replace('/buyer');
  };

  const handleProceed = async (listing: Listing) => {
    const listingId = listing._id || '';
    const q = quantityByListing[listingId];
    const num = typeof q === 'number' ? q : 0;
    if (!listingId || num <= 0 || num > listing.quantity) {
      setError(`Enter quantity between 1 and ${listing.quantity}`);
      return;
    }
    setError(null);
    setOrderSuccess(null);
    setProceedingId(listingId);
    try {
      const { order } = await buyerOrdersAPI.create(listingId, num);
      const orderId = order?._id ? `Order #${String(order._id).slice(-8).toUpperCase()}` : 'Order';
      setOrderSuccess(`${orderId} placed for ${num} ${listing.unit} of ${listing.cropName}.`);
      setQuantityByListing((prev) => ({ ...prev, [listingId]: 0 }));
      setTimeout(() => setOrderSuccess(null), 8000);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setProceedingId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const locationStr = (l: Listing) => {
    const loc = l.location || l.sellerId?.location;
    if (!loc) return null;
    const parts = [loc.village, loc.district, loc.state].filter(Boolean);
    return parts.length ? parts.join(', ') : loc.state || null;
  };

  const sellerName = (l: Listing) => l.sellerId?.name || t('seller');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-4">
          <Link href="/buyer" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('buyerPortalTitle')}</h1>
              <p className="text-slate-400 text-sm">{t('buyDirectlyFromFarmers')}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <span className="text-slate-300 text-sm hidden sm:inline">{buyerName}</span>
                <Link href="/buyer/orders" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium">
                  <ShoppingCart className="w-4 h-4" /> {t('myOrdersTitle')}
                </Link>
                <button type="button" onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium">
                  <LogOut className="w-4 h-4" /> {t('logout')}
                </button>
              </>
            ) : (
              <>
                <Link href="/buyer/login" className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium">{t('login')}</Link>
                <Link href="/buyer/register" className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium">{t('register')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-8">
          <input type="text" value={cropSearch} onChange={(e) => setCropSearch(e.target.value)} placeholder={t('searchByCropName')} className="flex-1 min-w-[200px] px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none" />
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-green-500">
            <option value="">{t('allStates')}</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 flex items-center gap-2">
            <Search className="w-4 h-4" />
            {t('search')}
          </button>
          <button type="button" onClick={() => load()} disabled={loading} className="px-6 py-3 bg-slate-600 text-white font-medium rounded-xl hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </form>

        {orderSuccess && <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl">{orderSuccess}</div>}
        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">{error}</div>}

        {loading ? (
          <div className="text-center py-16 text-gray-500">{t('loadingListings')}</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">{t('noListingsFound')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('tryChangingFilters')}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{total} {t('listingsFound')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <div key={listing._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-800">{listing.cropName}</h3>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">{t('activeStatus')}</span>
                  </div>
                  <p className="text-xl font-bold text-green-700 mb-2">Rs {listing.pricePerUnit} / {listing.unit}</p>
                  <p className="text-sm text-gray-600 mb-2">Quantity: {listing.quantity} {listing.unit}</p>
                  {listing.description && <p className="text-sm text-gray-500 line-clamp-2 mb-4">{listing.description}</p>}
                  {locationStr(listing) && <p className="text-xs text-gray-500 flex items-center gap-1 mb-3"><MapPin className="w-3 h-3" /> {locationStr(listing)}</p>}
                  <div className="mt-auto pt-4 border-t border-gray-100 space-y-3">
                    {isLoggedIn ? (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">{t('quantity')}:</label>
                          <input type="number" min={0.1} max={listing.quantity} step={0.1} value={quantityByListing[listing._id || ''] ?? ''} onChange={(e) => setQuantityByListing((prev) => ({ ...prev, [listing._id || '']: parseFloat(e.target.value) || 0 }))} className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                          <span className="text-xs text-gray-500">{listing.unit}</span>
                        </div>
                        <button type="button" onClick={() => handleProceed(listing)} disabled={proceedingId === listing._id} className="w-full py-2 px-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm">
                          {proceedingId === listing._id ? t('loading') : t('proceedToBuy')}
                        </button>
                      </>
                    ) : (
                      <Link href="/buyer/login" className="block w-full py-2 px-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 text-center text-sm">{t('signInToBuy')}</Link>
                    )}
                    <p className="text-xs font-medium text-gray-500">{t('seller')}: {sellerName(listing)}</p>
                    {listing.sellerRating && <p className="text-xs text-amber-700">{t('rating')}: {listing.sellerRating.avgRating ?? 'New'} {listing.sellerRating.avgRating ? '/ 5' : ''}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
