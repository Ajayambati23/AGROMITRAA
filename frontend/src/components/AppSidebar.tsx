'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  LayoutDashboard,
  MessageSquare,
  Leaf,
  DollarSign,
  Calendar,
  Sprout,
  User,
  LogOut,
  Menu,
  X,
  Package,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'chat', icon: MessageSquare },
  { id: 'crops', icon: Leaf },
  { id: 'sell', icon: Package },
  { id: 'market', icon: DollarSign },
  { id: 'calendar', icon: Calendar },
];

export default function AppSidebar({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const { state, logout } = useApp();
  const { t } = useTranslation();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    chat: t('aiChat'),
    crops: t('cropRecommendations'),
    sell: 'Sell Crops',
    market: t('marketPrices'),
    calendar: t('farmingCalendar'),
    profile: 'My Profile',
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-xl bg-[#24412d] text-white shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30 transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      {/* Sidebar: Deep Slate bg-slate-900 (#0f172a) */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-gradient-to-b from-[#1f3425] via-[#24412d] to-[#2f4f34] text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-700 lg:border-none">
          <div
            onClick={() => { router.push('/'); setSidebarOpen(false); }}
            className="flex items-center gap-3 cursor-pointer hover:opacity-90"
          >
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white">AgroMitra</span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 min-h-[44px] ${
                activeTab === id
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{labels[id] || id}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-left ${
              activeTab === 'profile'
                ? 'bg-green-600 text-white shadow-lg'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{state.user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate">
                {state.user?.location?.state && state.user?.location?.district
                  ? `${state.user.location.district}, ${state.user.location.state}`
                  : 'AgroMitra'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { logout(); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-all duration-300 mt-2 min-h-[44px]"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
