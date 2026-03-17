'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { buyerAuthAPI, getErrorMessage } from '@/lib/api';
import { Leaf, Mail, Lock } from 'lucide-react';

export default function BuyerLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, buyer } = await buyerAuthAPI.login(email, password);
      if (typeof window !== 'undefined') {
        localStorage.setItem('buyerToken', token);
        localStorage.setItem('buyer', JSON.stringify(buyer));
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
      }
      router.replace('/buyer');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Link href="/buyer" className="flex items-center gap-2 text-green-600 font-semibold mb-8">
        <Leaf className="w-5 h-5" />
        {t('buyerPortalTitle')}
      </Link>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('signIn')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('signInToPlaceOrders')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('emailAddress')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" placeholder={t('emailAddress')} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" placeholder={t('password')} required />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50">
            {loading ? t('loading') : t('signIn')}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('newHere')} <Link href="/buyer/register" className="text-green-600 font-medium hover:underline">{t('register')}</Link>
        </p>
      </div>
    </div>
  );
}
