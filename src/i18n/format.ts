import { getIntlLocale, type Locale } from './config';

export function formatDateByLocale(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date);
}

export function formatCountryByLocale(value: string | null | undefined, locale: Locale) {
  if (!value) return null;

  const rawRegion = value.trim().toUpperCase();
  const region = rawRegion === 'USA' ? 'US' : rawRegion;

  try {
    return new Intl.DisplayNames([getIntlLocale(locale)], { type: 'region' }).of(region) || value;
  } catch {
    return value;
  }
}
