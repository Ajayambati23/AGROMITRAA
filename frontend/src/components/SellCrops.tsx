'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { marketplaceAPI, ordersAPI, Listing, ListingForm, FarmerOrder } from '@/lib/api';
import { Package, Plus, Trash2, Edit2, MapPin, ShoppingCart, Phone, Mail, User, RefreshCw } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'quintal', label: 'Quintal' },
  { value: 'ton', label: 'Ton' },
  { value: 'bag', label: 'Bag' },
  { value: 'unit', label: 'Unit' },
];

export default function SellCrops() {
  const { state } = useApp();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<FarmerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [form, setForm] = useState<ListingForm>({
    cropName: '',
    quantity: 0,
    unit: 'kg',
    pricePerUnit: 0,
    description: '',
    location: state.user?.location ? { ...state.user.location } : undefined,
  });

  const loadListings = async () => {
    setLoading(true);
    setError(null);
    try {
      const { listings: data } = await marketplaceAPI.getMyListings();
      setListings(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setListings([]);
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const loadOrders = async (showLoading = true) => {
    if (showLoading) setOrdersLoading(true);
    try {
      const { orders: data } = await ordersAPI.getForSeller();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      if (showLoading) setOrdersLoading(false);
    }
  };

  // Initial load and auto-refresh orders every 15s (silent refresh to avoid loading flash)
  useEffect(() => {
    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 15000);
    return () => clearInterval(interval);
  }, [listings.length]);

  const resetForm = () => {
    setForm({
      cropName: '',
      quantity: 0,
      unit: 'kg',
      pricePerUnit: 0,
      description: '',
      location: state.user?.location ? { ...state.user.location } : undefined,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cropName.trim() || form.quantity <= 0 || form.pricePerUnit <= 0) {
      setError('Please fill crop name, quantity and price.');
      return;
    }
    setError(null);
    try {
      if (editingId) {
        await marketplaceAPI.update(editingId, form);
      } else {
        await marketplaceAPI.create(form);
      }
      resetForm();
      loadListings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save listing');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this listing?')) return;
    try {
      await marketplaceAPI.remove(id);
      loadListings();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleEdit = (listing: Listing) => {
    const id = listing._id || listing.id;
    if (!id) return;
    setForm({
      cropName: listing.cropName,
      quantity: listing.quantity,
      unit: listing.unit as ListingForm['unit'],
      pricePerUnit: listing.pricePerUnit,
      description: listing.description || '',
      location: listing.location ? { ...listing.location } : undefined,
    });
    setEditingId(id);
    setShowForm(true);
  };

  const lid = (l: Listing) => l._id || l.id || '';

  const handleOrderStatusChange = async (orderId: string, status: 'accepted' | 'delivered' | 'rejected') => {
    setUpdatingOrderId(orderId);
    setError(null);
    try {
      await ordersAPI.updateStatus(orderId, status);
      loadOrders(false);
    } catch (err: unknown) {
      let msg = 'Failed to update order status. Check you are logged in and the order is yours.';
      if (err && typeof err === 'object' && 'response' in err) {
        const res = (err as { response?: { data?: { message?: string; errors?: Array<{ msg?: string }> } } }).response;
        if (res?.data?.message) msg = res.data.message;
        else if (Array.isArray(res?.data?.errors) && res.data.errors[0]?.msg) msg = res.data.errors[0].msg;
      }
      setError(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-padded">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Sell Crops</h2>
              <p className="text-sm text-gray-500">List your produce for buyers to find</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Listing
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-4">
            <h3 className="font-semibold text-gray-800">{editingId ? 'Edit listing' : 'New listing'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Crop name</label>
                <input
                  type="text"
                  value={form.cropName}
                  onChange={(e) => setForm({ ...form, cropName: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Rice, Wheat"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Quantity</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={form.quantity || ''}
                  onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Unit</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as ListingForm['unit'] })}
                  className="input-field"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-2">Price per unit (Rs)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.pricePerUnit || ''}
                  onChange={(e) => setForm({ ...form, pricePerUnit: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">Description (optional)</label>
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field min-h-[80px]"
                placeholder="Quality, variety, etc."
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary">
                {editingId ? 'Update' : 'Create'} listing
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-gray-50 border border-gray-200">
            <Package className="w-14 h-14 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No listings yet</p>
            <p className="text-sm text-gray-500 mt-1">Add a listing so buyers can find your produce.</p>
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary mt-4">
              Add your first listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <div
                key={lid(listing)}
                className={`card-padded border-l-4 ${
                  listing.status === 'active' ? 'border-l-green-500' : listing.status === 'sold' ? 'border-l-blue-500' : 'border-l-gray-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-800">{listing.cropName}</h3>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    listing.status === 'active' ? 'bg-green-100 text-green-700' :
                    listing.status === 'sold' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {listing.status}
                  </span>
                </div>
                <p className="price-cell text-xl mb-2">
                  Rs {listing.pricePerUnit}/{listing.unit}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Quantity: {listing.quantity} {listing.unit}
                </p>
                {listing.location?.state && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                    <MapPin className="w-3 h-3" />
                    {[listing.location.village, listing.location.district, listing.location.state].filter(Boolean).join(', ') || listing.location.state}
                  </p>
                )}
                {listing.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{listing.description}</p>
                )}
                {listing.status === 'active' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(listing)}
                      className="btn-secondary flex items-center gap-1 text-sm py-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(lid(listing))}
                      className="btn-secondary flex items-center gap-1 text-sm py-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Orders from buyers */}
      <div className="card-padded">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Orders from buyers</h2>
              <p className="text-sm text-gray-500">Buy requests with buyer contact and address</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadOrders(true)}
            disabled={ordersLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-100 text-orange-700 font-medium hover:bg-orange-200 disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No orders yet. Buyers will appear here when they proceed to buy from your listings.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const buyer = order.buyerId || {};
              const addr = buyer.address || {};
              const addressStr = [addr.fullAddress, addr.village, addr.district, addr.state].filter(Boolean).join(', ') || '—';
              const listing = order.listingId || {};
              return (
                <div key={order._id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap justify-between gap-2 mb-3">
                    <span className="font-semibold text-gray-800">{listing.cropName || 'Crop'}</span>
                    <span className="text-sm text-gray-600">{order.quantity} {listing.unit || ''}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg capitalize ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'rejected' ? 'bg-red-100 text-red-700' : 'badge-pending'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{buyer.name || '—'}</span>
                    </div>
                    {buyer.phone && (
                      <a href={`tel:${buyer.phone}`} className="flex items-center gap-2 text-green-600 hover:underline">
                        <Phone className="w-4 h-4" /> {buyer.phone}
                      </a>
                    )}
                    {buyer.email && (
                      <a href={`mailto:${buyer.email}`} className="flex items-center gap-2 text-green-600 hover:underline">
                        <Mail className="w-4 h-4" /> {buyer.email}
                      </a>
                    )}
                    <div className="sm:col-span-2 flex items-start gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>Address: {addressStr}</span>
                    </div>
                  </div>
                  {(order.status === 'pending' || order.status === 'accepted' || order.status === 'confirmed') && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Update status:</span>
                      {order.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOrderStatusChange(order._id, 'accepted')}
                            disabled={updatingOrderId === order._id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 disabled:opacity-50"
                          >
                            {updatingOrderId === order._id ? 'Updating...' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOrderStatusChange(order._id, 'rejected')}
                            disabled={updatingOrderId === order._id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-medium hover:bg-red-200 disabled:opacity-50"
                          >
                            {updatingOrderId === order._id ? 'Updating...' : 'Reject'}
                          </button>
                        </>
                      )}
                      {(['pending', 'accepted', 'confirmed'].includes(order.status)) && (
                        <button
                          type="button"
                          onClick={() => handleOrderStatusChange(order._id, 'delivered')}
                          disabled={updatingOrderId === order._id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-medium hover:bg-green-200 disabled:opacity-50"
                        >
                          {updatingOrderId === order._id ? 'Updating...' : 'Mark Delivered'}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Ordered on {new Date(order.createdAt).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card bg-blue-50 border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Buyer portal:</strong> Buyers browse and contact you from the AgroMitra Buyer Portal (port 8000).
          Keep your phone and location updated in your profile.
        </p>
      </div>
    </div>
  );
}
