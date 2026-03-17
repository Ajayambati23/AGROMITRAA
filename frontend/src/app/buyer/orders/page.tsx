'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { buyerMarketplaceAPI, buyerOrdersAPI, BuyerOrder, getErrorMessage } from '@/lib/api';
import { Leaf, Package, ArrowLeft, Phone, Mail, User, RefreshCw } from 'lucide-react';

export default function MyOrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewByOrder, setReviewByOrder] = useState<Record<string, { rating: number; comment: string; saving?: boolean; done?: boolean }>>({});

  const loadOrders = useCallback((showLoading = true) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('buyerToken') : null;
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    buyerOrdersAPI.myOrders()
      .then((res) => setOrders(res.orders || []))
      .catch((err) => { if (showLoading) setError(err?.message || 'Failed to load orders'); })
      .finally(() => { if (showLoading) setLoading(false); });
  }, []);

  useEffect(() => {
    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const listing = (o: BuyerOrder) => o.listingId || {};
  const listingName = (o: BuyerOrder) => listing(o).cropName || t('cropName');
  const listingUnit = (o: BuyerOrder) => listing(o).unit || '';
  const seller = (o: BuyerOrder) => listing(o).sellerId || {};
  const orderIdShort = (id: string) => id ? `#${String(id).slice(-8).toUpperCase()}` : '';
  const listingId = (o: BuyerOrder) => o.listingId?._id || '';

  const submitReview = async (o: BuyerOrder) => {
    const oid = o._id;
    const state = reviewByOrder[oid] || { rating: 5, comment: '' };
    const lid = listingId(o);
    if (!lid) return;

    setReviewByOrder((p) => ({ ...p, [oid]: { ...state, saving: true } }));
    try {
      await buyerMarketplaceAPI.createReview(lid, state.rating, state.comment);
      setReviewByOrder((p) => ({ ...p, [oid]: { ...state, saving: false, done: true } }));
    } catch (err) {
      setError(getErrorMessage(err));
      setReviewByOrder((p) => ({ ...p, [oid]: { ...state, saving: false } }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white shadow">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/buyer" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('buyerPortalTitle')}</h1>
              <p className="text-slate-400 text-sm">{t('myOrdersTitle')}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => loadOrders()} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
            <Link href="/buyer" className="flex items-center gap-2 text-slate-300 hover:text-white text-sm">
              <ArrowLeft className="w-4 h-4" /> {t('browseListings')}
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {loading ? (
          <p className="text-gray-500">{t('loadingOrders')}</p>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">{error}</div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">{t('noOrdersYet')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('placeOrderFromListings')}</p>
            <Link href="/buyer" className="inline-block mt-4 px-6 py-2 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700">
              {t('browseListings')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">{t('yourOrders')}</h2>
            {orders.map((o) => {
              const farmer = seller(o);
              return (
                <div key={o._id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{listingName(o)}</p>
                      <p className="text-sm text-gray-600">{o.quantity} {listingUnit(o)}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('orderId')}: <span className="font-mono font-medium">{orderIdShort(o._id)}</span></p>
                      <p className="text-xs text-gray-500 mt-1">{t('status')}: <span className="font-medium capitalize">{o.status}</span></p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-lg bg-green-50 text-green-700 capitalize">{o.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t('orderedOn')} {new Date(o.createdAt).toLocaleDateString()}</p>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">{t('farmerSellerContact')}</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <User className="w-4 h-4 text-gray-500" />
                        {farmer.name || '-'}
                      </span>
                      {farmer.phone && <a href={`tel:${farmer.phone}`} className="flex items-center gap-1.5 text-green-600 hover:text-green-700 font-medium"><Phone className="w-4 h-4" /> {farmer.phone}</a>}
                      {farmer.email && <a href={`mailto:${farmer.email}`} className="flex items-center gap-1.5 text-green-600 hover:text-green-700 font-medium"><Mail className="w-4 h-4" /> {farmer.email}</a>}
                      {!farmer.phone && !farmer.email && <span className="text-gray-400">{t('noContactShared')}</span>}
                    </div>
                  </div>
                  {o.status === 'delivered' && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-600 mb-2">{t('rateThisFarmer')}</p>
                      {reviewByOrder[o._id]?.done ? (
                        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{t('reviewSubmitted')}</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={reviewByOrder[o._id]?.rating ?? 5} onChange={(e) => setReviewByOrder((p) => ({ ...p, [o._id]: { ...(p[o._id] || { comment: '' }), rating: Number(e.target.value) } }))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                            <option value={5}>5 - Excellent</option>
                            <option value={4}>4 - Good</option>
                            <option value={3}>3 - Average</option>
                            <option value={2}>2 - Poor</option>
                            <option value={1}>1 - Bad</option>
                          </select>
                          <input type="text" placeholder={t('commentOptional')} value={reviewByOrder[o._id]?.comment ?? ''} onChange={(e) => setReviewByOrder((p) => ({ ...p, [o._id]: { ...(p[o._id] || { rating: 5 }), comment: e.target.value } }))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm min-w-[220px] flex-1" />
                          <button type="button" onClick={() => submitReview(o)} disabled={reviewByOrder[o._id]?.saving} className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                            {reviewByOrder[o._id]?.saving ? t('saving') : t('submit')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
