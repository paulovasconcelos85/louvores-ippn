'use client';

import { startTransition, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getHtmlLang,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  type Locale,
} from './config';
import type { Messages } from './messages';
import { createTranslator, type TranslationValues } from './translator';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: TranslationValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
  messages,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
  messages: Messages;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = getHtmlLang(locale);
  }, [locale]);

  const t = useMemo(() => createTranslator(messages), [messages]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale(nextLocale) {
        if (nextLocale === locale) return;

        document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
        setLocaleState(nextLocale);

        startTransition(() => {
          router.refresh();
        });
      },
      t,
    }),
    [locale, router, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used within LocaleProvider.');
  }

  return value;
}

export function useI18n() {
  return useI18nContext();
}

export function useLocale() {
  return useI18nContext().locale;
}

export function useTranslations() {
  return useI18nContext().t;
}
