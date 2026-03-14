'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { adminAPI } from '@/lib/api';
import { Mail, Lock, ArrowLeft, Sprout } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

// const languages = [
//   { code: 'english', name: 'English' },
//   { code: 'hindi', name: 'हिन्दी' },
//   { code: 'telugu', name: 'తెలుగు' },
//   { code: 'kannada', name: 'ಕನ್ನಡ' },
//   { code: 'tamil', name: 'தமிழ்' },
//   { code: 'malayalam', name: 'മലയാളം' },
// ];

export default function LoginPage() {
  const { login, state, setLanguage } = useApp();
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      try {
        const adminResp = await adminAPI.login(formData.email.trim(), formData.password);
        localStorage.setItem('adminToken', adminResp.token);
        localStorage.setItem('adminUser', JSON.stringify(adminResp.admin));
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        router.replace('/admin');
        return;
      } catch (adminError: any) {
        const status = adminError?.response?.status;
        // If request reached server and creds are not admin, continue with farmer login.
        if (status && ![400, 401, 403].includes(status)) {
          throw adminError;
        }
      }

      await login(formData.email, formData.password);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      router.replace('/');
    } catch (error: any) {
      const validation = error?.response?.data?.errors;
      const message = Array.isArray(validation) && validation.length > 0
        ? validation.map((v: { msg?: string }) => v.msg).filter(Boolean).join('. ')
        : error?.response?.data?.message || error.message || 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* Left: Branding + Language */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1f3425] via-[#22442b] to-[#2f4f34] flex-col justify-between p-12">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Sprout className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">AgroMitra</h1>
              <p className="text-slate-400 text-sm">Your AI farming companion</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg max-w-sm">
            Sign in to access weather, market prices, crop recommendations, and AI chat in your language.
          </p>
        </div>
        <div>
          <p className="label-caps text-slate-500 mb-3"></p>
          <div className="grid grid-cols-2 gap-2 max-w-xs">
            {/* {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`py-3 px-4 rounded-2xl text-sm font-medium transition-all duration-300 ${
                  state.selectedLanguage === lang.code
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white/10 text-slate-300 border border-slate-600 hover:bg-slate-800'
                }`}
              >
                {lang.name}
              </button>
            ))} */}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="card card-padded glass-panel animate-fade-up hover-lift">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                <Sprout className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
              <p className="text-gray-500 text-sm mt-1">Sign in to your AgroMitra account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-field pl-11"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pl-11"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={state.isLoading || submitting}
                className="w-full btn-primary flex items-center justify-center"
              >
                {state.isLoading || submitting ? <LoadingSpinner size="sm" /> : 'Sign In'}
              </button>

              <div className="text-center">
                <p className="text-gray-500 text-sm">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/register')}
                    className="text-green-600 hover:text-green-700 font-medium"
                  >
                    Create one here
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
