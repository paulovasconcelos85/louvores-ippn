import type { Locale } from './config';

// Escolhe o texto do idioma atual entre as três versões escritas no próprio
// componente, para textos que não estão em messages/*.json.
export function porIdioma(locale: Locale, pt: string, es: string, en: string) {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}
