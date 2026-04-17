import type { Messages } from './messages';

export type TranslationValues = Record<string, string | number | null | undefined>;

function getNestedMessage(messages: Messages, key: string) {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, messages);
}

export function translate(messages: Messages, key: string, values?: TranslationValues) {
  const raw = getNestedMessage(messages, key);
  if (typeof raw !== 'string') return key;

  if (!values) return raw;

  return raw.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === null || value === undefined ? '' : String(value);
  });
}

export function createTranslator(messages: Messages) {
  return (key: string, values?: TranslationValues) => translate(messages, key, values);
}
