'use client';

import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { User, Mail, Phone, MapPin, Sprout, Award } from 'lucide-react';

export default function UserProfileDashboard() {
  const { state } = useApp();
  const { t } = useTranslation();
  const user = state.user;
  if (!user) return null;

  const locationParts = [
    user.location?.village,
    user.location?.district,
    user.location?.state,
  ].filter(Boolean);
  const locationStr = locationParts.length ? locationParts.join(', ') : t('notSet');

  const fields = [
    { label: t('fullName'), value: user.name, icon: User },
    { label: t('emailAddress'), value: user.email, icon: Mail },
    { label: t('phoneNumber'), value: user.phone, icon: Phone },
    { label: t('location'), value: locationStr, icon: MapPin },
    { label: t('preferredLanguage'), value: (user.preferredLanguage || 'english').replace(/^./, (c) => c.toUpperCase()), icon: null },
    { label: 'Soil type', value: user.soilType ? String(user.soilType).replace(/^./, (c) => c.toUpperCase()) : '—', icon: Sprout },
    { label: 'Farm size', value: user.farmSize != null ? `${user.farmSize} acres` : '—', icon: null },
    { label: 'Experience', value: user.experience ? String(user.experience).replace(/^./, (c) => c.toUpperCase()) : '—', icon: Award },
  ];

  return (
    <div className="space-y-6">
      <div className="card-padded">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center">
            <User className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
            <p className="text-gray-500">{t('agroMitraFarmerAccount')}</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('accountDetails')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100"
            >
              {Icon && (
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-gray-800 font-medium mt-0.5 break-words">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-green-50 border border-green-200 p-4">
        <p className="text-sm text-green-800">
          {t('updateProfileHint')}
        </p>
      </div>
    </div>
  );
}
