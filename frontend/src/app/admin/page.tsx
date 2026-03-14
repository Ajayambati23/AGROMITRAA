'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI, AdminUser, AdminOrder, AdminSummary } from '@/lib/api';

const CATEGORIES = [
  'crop_recommendation',
  'harvesting_guidance',
  'pest_control',
  'irrigation',
  'fertilization',
  'weather',
  'market_price',
  'general',
];

const LANGUAGES = ['english', 'hindi', 'telugu', 'kannada', 'tamil', 'malayalam'];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);

  const [text, setText] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [queriesInput, setQueriesInput] = useState('What crop is suitable for black soil?\nHow to control pests in paddy?');

  const metrics = useMemo(() => {
    const trainingSamples = stats?.stats?.totalSamples ?? stats?.totalSamples ?? 0;
    const labels = stats?.stats?.categories ?? stats?.categories ?? {};
    const accuracy = performance?.performance?.accuracy ?? performance?.accuracy;
    const model = performance?.performance?.model ?? performance?.model ?? 'N/A';
    return { trainingSamples, labels, accuracy, model };
  }, [stats, performance]);

  const loadOrders = async (status = orderStatusFilter) => {
    const resp = await adminAPI.getOrders({ limit: 20, status: status || undefined });
    setOrders(resp.orders || []);
    return resp;
  };

  const loadDashboard = async (searchTerm = '') => {
    setLoading(true);
    setError('');
    try {
      const meResp = await adminAPI.getMe();
      setAdminEmail(meResp.admin.email);
      setAuthorized(true);

      const [usersResp, summaryResp, ordersResp, statsResp, perfResp] = await Promise.allSettled([
        adminAPI.getUsers({ limit: 100, search: searchTerm || undefined }),
        adminAPI.getSummary(),
        loadOrders(orderStatusFilter),
        adminAPI.getTrainingStats(),
        adminAPI.getTrainingPerformance(),
      ]);

      if (usersResp.status === 'fulfilled') setUsers(usersResp.value.users || []);
      if (summaryResp.status === 'fulfilled') setSummary(summaryResp.value);
      if (statsResp.status === 'fulfilled') setStats(statsResp.value);
      if (perfResp.status === 'fulfilled') setPerformance(perfResp.value);

      const sectionErrors: string[] = [];
      if (usersResp.status === 'rejected') sectionErrors.push('users');
      if (summaryResp.status === 'rejected') sectionErrors.push('summary');
      if (ordersResp.status === 'rejected') sectionErrors.push('orders');
      if (statsResp.status === 'rejected') sectionErrors.push('training stats');
      if (perfResp.status === 'rejected') sectionErrors.push('model performance');

      if (sectionErrors.length > 0) {
        setError(`Some dashboard sections failed to load: ${sectionErrors.join(', ')}`);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        setAuthorized(false);
        setError('Admin session expired. Please login again.');
        router.replace('/admin/login');
      } else {
        setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: AdminUser) => {
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const nextStatus = !(user.isActive ?? true);
      const resp = await adminAPI.updateUserStatus(user._id, nextStatus);
      setNotice(resp.message || 'User status updated');
      await loadDashboard(search);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update user status');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    loadDashboard();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    loadOrders(orderStatusFilter).catch((err: any) => {
      setError(err?.response?.data?.message || err?.message || 'Failed to load recent orders');
    });
  }, [orderStatusFilter, authorized]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    router.replace('/admin/login');
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadDashboard(search.trim());
  };

  const handleAddTrainingData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await adminAPI.addTrainingData({
        text: text.trim(),
        category,
        language,
      });
      setNotice(resp?.message || 'Training sample added');
      setText('');
      await loadDashboard(search);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to add training data');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetrain = async () => {
    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await adminAPI.retrain();
      setNotice(resp?.message || 'Model retrained');
      await loadDashboard(search);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to retrain model');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestModel = async () => {
    const queries = queriesInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (queries.length === 0) return;

    setActionLoading(true);
    setError('');
    setNotice('');
    try {
      const resp = await adminAPI.testModel(queries, language);
      setTestResults(resp?.results || []);
      setNotice('Model test completed');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to test model');
    } finally {
      setActionLoading(false);
    }
  };

  if (!authorized && loading) {
    return <div className="min-h-screen bg-transparent flex items-center justify-center">Loading admin dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-transparent">
      <header className="bg-gradient-to-r from-[#1f3425] via-[#24412d] to-[#2f4f34] text-white border-b border-[#3c6443]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-sm text-slate-300">{adminEmail}</p>
          </div>
          <button type="button" onClick={handleLogout} className="px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-700 text-white text-sm font-medium">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        {notice && <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">{notice}</div>}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 animate-fade-up hover-lift">
            <p className="text-xs uppercase tracking-wide text-gray-500">Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.users?.total ?? users.length}</p>
          </div>
          <div className="card p-4 animate-fade-up stagger-1 hover-lift">
            <p className="text-xs uppercase tracking-wide text-gray-500">Training Samples</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.trainingSamples}</p>
          </div>
          <div className="card p-4 animate-fade-up stagger-2 hover-lift">
            <p className="text-xs uppercase tracking-wide text-gray-500">Model Accuracy</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {metrics.accuracy != null ? `${Number(metrics.accuracy).toFixed(2)}%` : 'N/A'}
            </p>
          </div>
          <div className="card p-4 animate-fade-up stagger-3 hover-lift">
            <p className="text-xs uppercase tracking-wide text-gray-500">Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary?.orders?.total ?? 0}</p>
          </div>
        </section>

        <section className="card card-padded animate-fade-up stagger-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Users Data</h2>
            <form onSubmit={handleSearchUsers} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field !min-h-[40px] !py-2 !px-3 text-sm"
                placeholder="Search name/email/phone"
              />
              <button type="submit" className="btn-secondary !min-h-[40px] !py-2 !px-3 text-sm">Search</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Joined</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 text-gray-800">{u.name}</td>
                    <td className="py-2 pr-3 text-gray-700">{u.email}</td>
                    <td className="py-2 pr-3 text-gray-700">{u.phone}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-1 rounded-lg ${u.isActive === false ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {u.isActive === false ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {[u.location?.village, u.location?.district, u.location?.state].filter(Boolean).join(', ') || 'N/A'}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${u.isActive === false ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                        onClick={() => handleToggleUserStatus(u)}
                        disabled={actionLoading}
                      >
                        {u.isActive === false ? 'Activate' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="text-sm text-gray-500 py-3">No users found.</p>}
          </div>
        </section>

        <section className="card card-padded animate-fade-up">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Orders Monitor</h2>
            <div className="flex gap-2">
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="input-field !min-h-[40px] !py-2 !px-3 text-sm"
              >
                <option value="">All statuses</option>
                <option value="pending">pending</option>
                <option value="accepted">accepted</option>
                <option value="confirmed">confirmed</option>
                <option value="delivered">delivered</option>
                <option value="rejected">rejected</option>
                <option value="cancelled">cancelled</option>
              </select>
              <button
                type="button"
                className="btn-secondary !min-h-[40px] !py-2 !px-3 text-sm"
                onClick={() => {
                  loadOrders(orderStatusFilter).catch((err: any) => {
                    setError(err?.response?.data?.message || err?.message || 'Failed to refresh recent orders');
                  });
                }}
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Crop</th>
                  <th className="py-2 pr-3">Buyer</th>
                  <th className="py-2 pr-3">Seller</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 text-gray-700 font-mono">{String(o._id).slice(-8).toUpperCase()}</td>
                    <td className="py-2 pr-3 text-gray-700">{o.listingId?.cropName || 'N/A'}</td>
                    <td className="py-2 pr-3 text-gray-700">{o.buyerId?.name || 'N/A'}</td>
                    <td className="py-2 pr-3 text-gray-700">{o.listingId?.sellerId?.name || 'N/A'}</td>
                    <td className="py-2 pr-3 text-gray-700">{o.quantity} {o.listingId?.unit || ''}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-700 capitalize">{o.status}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && <p className="text-sm text-gray-500 py-3">No orders found.</p>}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card card-padded animate-fade-up stagger-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Train Model</h2>
              <button
                type="button"
                onClick={handleRetrain}
                className="btn-primary !min-h-[40px] !py-2 !px-4 text-sm"
                disabled={actionLoading}
              >
                Retrain
              </button>
            </div>
            <form onSubmit={handleAddTrainingData} className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter training text"
                className="input-field min-h-[120px]"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field !min-h-[40px] !py-2 !px-2">
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input-field !min-h-[40px] !py-2 !px-2">
                  {LANGUAGES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary !min-h-[40px] !py-2 !px-4 text-sm" disabled={actionLoading}>
                Add Training Data
              </button>
            </form>
          </div>

          <div className="card card-padded animate-fade-up stagger-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Test Model</h2>
            <textarea
              value={queriesInput}
              onChange={(e) => setQueriesInput(e.target.value)}
              className="input-field min-h-[120px]"
              placeholder="One query per line"
            />
            <div className="mt-3">
              <button type="button" onClick={handleTestModel} className="btn-tech !min-h-[40px] !py-2 !px-4 text-sm" disabled={actionLoading}>
                Run Test
              </button>
            </div>
            {testResults.length > 0 && (
              <div className="mt-4 max-h-64 overflow-auto border border-gray-200 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left">
                      <th className="py-2 px-3">Query</th>
                      <th className="py-2 px-3">Prediction</th>
                      <th className="py-2 px-3">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((item, idx) => (
                      <tr key={`${item.query}-${idx}`} className="border-t border-gray-100">
                        <td className="py-2 px-3 text-gray-700">{item.query}</td>
                        <td className="py-2 px-3 text-gray-700">{item.prediction || item.error || 'N/A'}</td>
                        <td className="py-2 px-3 text-gray-700">{item.confidence != null ? Number(item.confidence).toFixed(3) : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="card card-padded animate-fade-up stagger-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Training Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(metrics.labels || {}).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">{k}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{String(v)}</p>
              </div>
            ))}
            {Object.keys(metrics.labels || {}).length === 0 && (
              <p className="text-sm text-gray-500">No category metrics available.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
