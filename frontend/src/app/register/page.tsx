'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  Sprout,
} from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  statesAndDistricts,
  getDistrictsByState,
} from '@/data/states-districts';
import { SOIL_TYPES } from '@/data/soilTypes';

/* ---------------- Languages ---------------- */

const languages = [
  { code: 'english', name: 'English' },
  { code: 'hindi', name: 'हिन्दी' },
  { code: 'telugu', name: 'తెలుగు' },
  { code: 'kannada', name: 'ಕನ್ನಡ' },
  { code: 'tamil', name: 'தமிழ்' },
  { code: 'malayalam', name: 'മലയാളം' },
];

/* ---------------- Input Style ---------------- */

const inputClass = 'input-field pl-12';

/* ---------------- Component ---------------- */

export default function RegisterPage() {
  const { register, state, setLanguage } = useApp();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    preferredLanguage: 'english',
    location: { state: '', district: '', village: '' },
    soilType: 'black',
    farmSize: 1,
    experience: 'beginner',
  });

  const [error, setError] = useState('');

  /* ---------------- Submit ---------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const { confirmPassword, ...userData } = formData;
      await register(userData);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  /* ---------------- District Filter ---------------- */

  const districtsForState = useMemo(
    () => getDistrictsByState(formData.location.state),
    [formData.location.state]
  );

  /* ---------------- Change Handler ---------------- */

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name.startsWith('location.')) {
      const field = name.split('.')[1] as
        | 'state'
        | 'district'
        | 'village';

      const updates: any = { [field]: value };

      if (field === 'state') updates.district = '';

      setFormData({
        ...formData,
        location: { ...formData.location, ...updates },
      });
    } else {
      setFormData({
        ...formData,
        [name]:
          name === 'farmSize' ? Number(value) : value,
      });
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-transparent flex">
      {/* ========== LEFT PANEL ========== */}

      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1f3425] via-[#22442b] to-[#2f4f34] flex-col justify-center items-start px-16 py-12">

        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-12"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        {/* Branding */}
        <div className="max-w-md">

          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Sprout className="w-8 h-8 text-white" />
            </div>

            <div>
              <h1 className="text-3xl font-bold text-white">
                AgroMitra
              </h1>
              <p className="text-slate-400 text-sm">
                Your AI farming companion
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-lg leading-relaxed">
            Create your account to get weather, market
            prices, crop recommendations, and AI chat
            in your language.
          </p>

          {/* Language */}
          <div className="mt-10">
            <p className="text-slate-400 mb-3 text-sm">
              Language
            </p>

            <div className="grid grid-cols-2 gap-3">

              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setLanguage(lang.code);
                    setFormData({
                      ...formData,
                      preferredLanguage: lang.code,
                    });
                  }}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition ${
                    state.selectedLanguage ===
                    lang.code
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {lang.name}
                </button>
              ))}

            </div>
          </div>
        </div>
      </div>

      {/* ========== RIGHT FORM ========== */}

      <div className="w-full lg:w-1/2 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-6 lg:px-12">

          <div className="card card-padded glass-panel animate-fade-up hover-lift">

            {/* Title */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
                <Sprout className="w-8 h-8 text-green-600" />
              </div>

              <h1 className="text-2xl font-bold">
                Join AgroMitra
              </h1>

              <p className="text-gray-500 text-sm">
                Create your account to get started
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm mb-6">
                {error}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
            >

              {/* Name + Email */}
              <div className="grid md:grid-cols-2 gap-6">

                {/* Name */}
                <div className="relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 flex justify-center text-gray-400">
                    <User className="w-5 h-5" />
                  </div>

                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Full Name"
                    required
                  />
                </div>

                {/* Email */}
                <div className="relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 flex justify-center text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Email Address"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 flex justify-center text-gray-400">
                  <Phone className="w-5 h-5" />
                </div>

                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Phone Number"
                  required
                />
              </div>

              {/* Location */}
              <div className="grid md:grid-cols-3 gap-6">

                <select
                  name="location.state"
                  value={formData.location.state}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option value="">Select State</option>
                  {statesAndDistricts.map((s) => (
                    <option
                      key={s.state}
                      value={s.state}
                    >
                      {s.state}
                    </option>
                  ))}
                </select>

                <select
                  name="location.district"
                  value={formData.location.district}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option value="">
                    Select District
                  </option>
                  {districtsForState.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  name="location.village"
                  value={formData.location.village}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Village"
                  required
                />
              </div>

              {/* Soil Type */}
              <div className="relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 flex justify-center text-gray-400 z-10 pointer-events-none">
                  <Sprout className="w-5 h-5" />
                </div>
                <select
                  name="soilType"
                  value={formData.soilType}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  {SOIL_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div className="grid md:grid-cols-2 gap-6">

                <div className="relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 flex justify-center text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>

                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Password"
                    required
                  />
                </div>

                <div className="relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 flex justify-center text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>

                  <input
                    type="password"
                    name="confirmPassword"
                    value={
                      formData.confirmPassword
                    }
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Confirm Password"
                    required
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={state.isLoading}
                className="w-full btn-primary flex justify-center"
              >
                {state.isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
