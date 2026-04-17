import type { Locale } from './config';
import en from './messages/en.json';
import es from './messages/es.json';
import pt from './messages/pt.json';

export type Messages = typeof pt;

const MESSAGES: Record<Locale, Messages> = {
  pt,
  es,
  en,
};

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] || MESSAGES.pt;
}
