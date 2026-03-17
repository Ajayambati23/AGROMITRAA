'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useTranslation';
import { buyerAuthAPI, getErrorMessage } from '@/lib/api';
import { Leaf, Mail, Lock, User, Phone, MapPin, Home } from 'lucide-react';

export default function BuyerRegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    state: '',
    district: '',
    village: '',
    fullAddress: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, buyer } = await buyerAuthAPI.register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        address: {
          state: form.state,
          district: form.district,
          village: form.village,
          fullAddress: form.fullAddress,
        },
      });
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
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('createBuyerAccount')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('registerToPlaceOrders')}</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {error && <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('fullName')}</label>
            <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('emailAddress')}</label>
            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('phoneNumber')}</label>
            <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('password')}</label>
            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" required /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('state')}</label>
            <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={form.state} onChange={(e) => update('state', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('district')}</label>
            <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={form.district} onChange={(e) => update('district', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('village')}</label>
            <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={form.village} onChange={(e) => update('village', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">{t('address')}</label>
            <div className="relative"><Home className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input value={form.fullAddress} onChange={(e) => update('fullAddress', e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" /></div>
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50">
              {loading ? t('loading') : t('createAccount')}
            </button>
          </div>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('alreadyRegistered')} <Link href="/buyer/login" className="text-green-600 font-medium hover:underline">{t('signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
