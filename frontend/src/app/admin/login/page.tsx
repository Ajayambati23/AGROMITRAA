'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      router.replace('/admin');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await adminAPI.login(email.trim(), password);
      localStorage.setItem('adminToken', resp.token);
      localStorage.setItem('adminUser', JSON.stringify(resp.admin));
      router.push('/admin');
    } catch (err: any) {
      const validation = err?.response?.data?.errors;
      const message = Array.isArray(validation) && validation.length
        ? validation.map((v: { msg?: string }) => v.msg).filter(Boolean).join('. ')
        : err?.response?.data?.message || err?.message || 'Admin login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="w-full max-w-md card card-padded glass-panel animate-fade-up hover-lift">
        <h1 className="text-2xl font-bold text-gray-900">Admin Login</h1>
        <p className="text-sm text-gray-500 mt-1">Use admin credentials to access users and model training.</p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full btn-primary"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In as Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
