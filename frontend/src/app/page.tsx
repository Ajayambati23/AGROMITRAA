'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { weatherAPI } from '@/lib/api';
import Header from '@/components/Header';
import AppSidebar from '@/components/AppSidebar';
import ChatInterface from '@/components/ChatInterface';
import CropRecommendations from '@/components/CropRecommendations';
import MarketPrices from '@/components/MarketPrices';
import Calendar from '@/components/Calendar';
import SellCrops from '@/components/SellCrops';
import UserProfileDashboard from '@/components/UserProfileDashboard';
import ErrorMessage from '@/components/ErrorMessage';
import { Leaf, Sun, TrendingUp, MessageSquare, DollarSign, CalendarDays } from 'lucide-react';

export default function Home() {
  const { state, dispatch } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [weather, setWeather] = useState<{
    location: string;
    tempC: number;
    windKph: number;
    humidity: number;
    condition: string;
    alerts: string[];
    updatedAt: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    const loadWeather = async () => {
      const village = state.user?.location?.village?.trim();
      const district = state.user?.location?.district?.trim();
      const stateName = state.user?.location?.state?.trim();
      const locationCandidates = [
        [village, district, stateName].filter(Boolean).join(', '),
        [district, stateName].filter(Boolean).join(', '),
        stateName || '',
      ].filter(Boolean);
      if (locationCandidates.length === 0) {
        setWeather(null);
        return;
      }

      try {
        setWeatherLoading(true);
        let loaded = false;
        for (const location of locationCandidates) {
          try {
            const data = await weatherAPI.getCurrent({ location });
            setWeather(data);
            loaded = true;
            break;
          } catch {
            // Try next candidate location
          }
        }
        if (!loaded) {
          setWeather(null);
        }
      } catch (error) {
        console.warn('Weather load failed:', error);
        setWeather(null);
      } finally {
        setWeatherLoading(false);
      }
    };

    if (!state.authChecked || !state.isAuthenticated || activeTab !== 'dashboard') {
      return;
    }

    loadWeather();
  }, [state.authChecked, state.isAuthenticated, state.user?.location?.state, activeTab]);

  // Wait for auth check from localStorage so refresh keeps user on same page
  if (!state.authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page only after we know user is not authenticated
  if (!state.isAuthenticated) {
    const features = [
      {
        icon: '🤖',
        title: 'AI-Powered Chat',
        description: 'Get instant farming advice from our intelligent assistant',
      },
      {
        icon: '🌾',
        title: 'Crop Recommendations',
        description: 'Smart suggestions based on your location and soil type',
      },
      {
        icon: '💰',
        title: 'Market Prices',
        description: 'Real-time market data to maximize your profits',
      },
      {
        icon: '📅',
        title: 'Farming Calendar',
        description: 'Plan your farming activities with seasonal guidance',
      },
      {
        icon: '🗣️',
        title: 'Multi-Language Support',
        description: 'Available in Hindi, Telugu, Tamil, Kannada & more',
      },
      {
        icon: '🎤',
        title: 'Voice Support',
        description: 'Ask questions using voice in your preferred language',
      },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-lime-50 via-emerald-50 to-amber-50">
        <Header />
        
        <main>
          {/* Hero Section */}
          <section className="container mx-auto px-4 py-20 text-center">
            <div className="max-w-4xl mx-auto animate-fade-up">
              {/* Logo/Brand */}
              <div className="flex items-center justify-center space-x-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg animate-float-soft">
                  <Leaf className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-6xl font-bold bg-gradient-to-r from-emerald-700 to-lime-600 bg-clip-text text-transparent">
                  AgroMitra
                </h1>
              </div>
              
              {/* Tagline */}
              <p className="text-4xl font-bold text-gray-800 mb-4">
                Smart Farming, Better Harvest
              </p>
              
              <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
                Your AI-powered companion for modern agriculture. Get expert advice, market insights, and farming guidance all in one place.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                <button
                  onClick={() => router.push('/login')}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-green-700 text-white font-bold text-lg rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105 animate-fade-up stagger-2"
                >
                  Sign In
                </button>
                
                <button
                  onClick={() => router.push('/register')}
                  className="px-8 py-4 bg-white text-emerald-700 font-bold text-lg rounded-xl border-2 border-emerald-600 hover:bg-emerald-50 transition-all duration-300 transform hover:scale-105 animate-fade-up stagger-3"
                >
                  Create Account
                </button>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="bg-white py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-4xl font-bold text-center text-gray-800 mb-16">
                Powerful Features for Modern Farmers
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`bg-gradient-to-br from-white to-lime-50/60 p-8 rounded-2xl border border-lime-100 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-fade-up hover-lift stagger-${(index % 6) + 1}`}
                  >
                    <div className="text-5xl mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-gradient-to-r from-emerald-600 to-green-700 py-16">
            <div className="container mx-auto px-4 text-center text-white">
              <h2 className="text-4xl font-bold mb-6">
                Ready to Transform Your Farming?
              </h2>
              <p className="text-xl mb-8 max-w-2xl mx-auto">
                Join thousands of farmers already using AgroMitra to increase yields and maximize profits.
              </p>
              <button
                onClick={() => router.push('/register')}
                className="px-10 py-4 bg-white text-emerald-700 font-bold text-lg rounded-xl hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
              >
                Get Started Free
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="bg-gray-800 text-white py-8">
            <div className="container mx-auto px-4 text-center">
              <p>&copy; 2026 AgroMitra. Empowering Farmers with Technology.</p>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex">
      <AppSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 lg:pl-64 min-h-screen flex flex-col">
        {/* Top bar: language only (spec: dropdown top right) */}
        <div className="sticky top-0 z-20 flex justify-end items-center px-4 py-3 glass-panel border-b border-[#d9e4d9]">
          <Header />
        </div>

        <div className="flex-1 p-4 sm:p-6">
          {state.error && (
            <ErrorMessage
              message={state.error}
              onClose={() => dispatch({ type: 'CLEAR_ERROR' })}
            />
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <h1 className="text-xl font-bold text-gray-800">{t('aiChat')} &amp; Tools</h1>
              {/* Weather card - Tech Blue gradient, visual anchor */}
              <div className="bg-gradient-to-r from-[#2f6f8f] to-[#2a5f70] rounded-2xl shadow-md p-6 text-white animate-fade-up">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-caps text-white/80">WEATHER</p>
                    <p className="text-2xl font-bold mt-1">
                      {weatherLoading
                        ? 'Loading...'
                        : `${weather?.condition || 'Unavailable'} · ${weather?.tempC ?? '--'}°C`}
                    </p>
                    <p className="text-sm text-white/90 mt-1">
                      Wind: {weather?.windKph ?? '--'} km/h · Humidity {weather?.humidity ?? '--'}%
                    </p>
                    {weather?.location && (
                      <p className="text-xs text-white/80 mt-1">{weather.location}</p>
                    )}
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Sun className="w-8 h-8" />
                  </div>
                </div>
                {weather?.alerts?.length ? (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <p className="text-xs font-semibold text-white/90 mb-1">Advisory</p>
                    <p className="text-xs text-white/90">{weather.alerts[0]}</p>
                  </div>
                ) : null}
              </div>
              {/* Market trend card - high contrast */}
              <div className="card p-5 animate-fade-up stagger-2 hover-lift">
                <p className="label-caps mb-2">MARKET TREND</p>
                <p className="text-lg font-bold text-gray-800">Rice</p>
                <p className="price-cell text-xl mt-1">₹2,200 / quintal</p>
                <p className="text-green-600 text-sm font-medium flex items-center gap-1 mt-1">
                  <TrendingUp className="w-4 h-4" /> 2.5% up
                </p>
                <p className="text-gray-500 text-xs mt-2">Updated recently</p>
              </div>
              {/* Quick action grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: 'crops', label: t('cropRecommendations'), icon: Leaf, bg: 'bg-green-100', color: 'text-green-600' },
                  { id: 'market', label: t('marketPrices'), icon: DollarSign, bg: 'bg-orange-100', color: 'text-orange-600' },
                  { id: 'calendar', label: t('farmingCalendar'), icon: CalendarDays, bg: 'bg-blue-100', color: 'text-blue-600' },
                ].map(({ id, label, icon: Icon, bg, color }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className="card flex flex-col items-center gap-3 text-center hover:shadow-md transition-all duration-300 min-h-[120px] animate-fade-up hover-lift"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bg} ${color}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="card w-full flex items-center gap-4 bg-amber-50 border-amber-200 hover:shadow-md animate-fade-up stagger-3 hover-lift"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">AI Chat</p>
                  <p className="text-sm text-gray-500">Ask farming questions in your language</p>
                </div>
              </button>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto">
              <div className="card min-h-[28rem]">
                <ChatInterface />
              </div>
            </div>
          )}
          {activeTab === 'crops' && <CropRecommendations />}
          {activeTab === 'sell' && <SellCrops />}
          {activeTab === 'market' && <MarketPrices />}
          {activeTab === 'calendar' && <Calendar />}
          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto">
              <h1 className="text-xl font-bold text-gray-800 mb-4">My Profile</h1>
              <UserProfileDashboard />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
