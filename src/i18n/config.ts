export const SUPPORTED_LOCALES = ['pt', 'es', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt';
export const LOCALE_COOKIE_NAME = 'oikos-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const HTML_LANG_BY_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  es: 'es',
  en: 'en',
};

const INTL_LOCALE_BY_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  es: 'es-ES',
  en: 'en-US',
};

const GOOGLE_MAPS_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  pt: 'pt-BR',
  es: 'es',
  en: 'en',
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith('pt')) return 'pt';
  if (normalized.startsWith('es')) return 'es';
  if (normalized.startsWith('en')) return 'en';

  return isSupportedLocale(normalized) ? normalized : null;
}

export function getHtmlLang(locale: Locale) {
  return HTML_LANG_BY_LOCALE[locale];
}

export function getIntlLocale(locale: Locale) {
  return INTL_LOCALE_BY_LOCALE[locale];
}

export function getGoogleMapsLanguage(locale: Locale) {
  return GOOGLE_MAPS_LANGUAGE_BY_LOCALE[locale];
}

export function getLocaleCookieValue(value: string | null | undefined) {
  return normalizeLocale(value);
}

export function getPreferredLocale({
  queryLocale,
  cookieLocale,
  acceptLanguage,
}: {
  queryLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
} = {}): Locale {
  return (
    normalizeLocale(queryLocale) ||
    normalizeLocale(cookieLocale) ||
    getPreferredLocaleFromAcceptLanguage(acceptLanguage) ||
    DEFAULT_LOCALE
  );
}

export function getPreferredLocaleFromAcceptLanguage(value: string | null | undefined): Locale | null {
  if (!value) return null;

  const parts = value
    .split(',')
    .map((item) => item.split(';')[0]?.trim())
    .filter(Boolean);

  for (const part of parts) {
    const locale = normalizeLocale(part);
    if (locale) return locale;
  }

  return null;
}
