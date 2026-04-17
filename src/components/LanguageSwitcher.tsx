'use client';

import { Languages } from 'lucide-react';
import { SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <Languages className="h-4 w-4 text-slate-500" />
      <label htmlFor="language-switcher" className="sr-only">
        {t('language.label')}
      </label>
      <select
        id="language-switcher"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="bg-transparent pr-6 text-sm font-medium text-slate-700 outline-none"
        aria-label={t('language.helper')}
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {t(`language.names.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
