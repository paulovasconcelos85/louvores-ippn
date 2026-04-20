import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/i18n/config';

export type LocalizedTextMap = Partial<Record<Locale, string>>;
export type LocalizedTextMapForm = Record<Locale, string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createEmptyLocalizedTextMap(): LocalizedTextMapForm {
  return {
    pt: '',
    es: '',
    en: '',
  };
}

export function normalizeLocalizedTextMap(
  value: unknown,
  fallback?: string | null
): LocalizedTextMapForm {
  const normalized = createEmptyLocalizedTextMap();

  if (isPlainObject(value)) {
    for (const locale of SUPPORTED_LOCALES) {
      const candidate = value[locale];
      if (typeof candidate === 'string') {
        normalized[locale] = candidate.trim();
      }
    }
  }

  if (!normalized.pt && typeof fallback === 'string' && fallback.trim()) {
    normalized.pt = fallback.trim();
  }

  return normalized;
}

export function compactLocalizedTextMap(
  value: LocalizedTextMapForm | LocalizedTextMap | null | undefined
): LocalizedTextMap | null {
  if (!value) return null;

  const compacted: LocalizedTextMap = {};

  for (const locale of SUPPORTED_LOCALES) {
    const candidate = value[locale];
    if (typeof candidate === 'string' && candidate.trim()) {
      compacted[locale] = candidate.trim();
    }
  }

  return Object.keys(compacted).length > 0 ? compacted : null;
}

export function resolveLocalizedText(
  value: unknown,
  locale: Locale,
  fallback?: string | null
) {
  const normalized = normalizeLocalizedTextMap(value, fallback);

  return (
    normalized[locale] ||
    normalized[DEFAULT_LOCALE] ||
    normalized.pt ||
    normalized.es ||
    normalized.en ||
    fallback?.trim() ||
    ''
  );
}
