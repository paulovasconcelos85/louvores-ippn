import {
  DEFAULT_LOCALE,
  getIntlLocale,
  normalizeLocale,
  type Locale,
} from '@/i18n/config';

type NotificationPayload = Record<string, unknown> | null | undefined;

type NotificationContentInput = {
  tipo: string;
  titulo?: string | null;
  corpo?: string | null;
  payload?: NotificationPayload;
  preferredLocale?: string | null;
};

function resolveNotificationLocale(
  payload: NotificationPayload,
  preferredLocale?: string | null
): Locale {
  const preferred = normalizeLocale(preferredLocale);
  if (preferred) {
    return preferred;
  }

  if (!payload || typeof payload !== 'object') {
    return DEFAULT_LOCALE;
  }

  const locale = typeof payload.locale === 'string' ? normalizeLocale(payload.locale) : null;
  return locale || DEFAULT_LOCALE;
}

function readString(payload: NotificationPayload, key: string) {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(payload: NotificationPayload, key: string) {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload[key];
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatNotificationDate(dateValue: string | null, locale: Locale) {
  if (!dateValue) return null;

  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateValue;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatNotificationTime(timeValue: string | null) {
  if (!timeValue) return null;
  const match = timeValue.match(/^(\d{2}):(\d{2})/);
  if (!match) return timeValue;
  return `${match[1]}:${match[2]}`;
}

function resolveEscalaAssignmentCopy(
  payload: NotificationPayload,
  locale: Locale
) {
  const dateLabel = formatNotificationDate(readString(payload, 'data'), locale);
  const timeLabel = formatNotificationTime(readString(payload, 'hora_inicio'));

  const titleByLocale: Record<Locale, string> = {
    pt: 'Você foi escalado nesta semana',
    es: 'Has sido asignado esta semana',
    en: 'You were scheduled this week',
  };

  let body: string | null = null;

  if (dateLabel && timeLabel) {
    body =
      locale === 'es'
        ? `Culto el ${dateLabel} a las ${timeLabel}`
        : locale === 'en'
          ? `Service on ${dateLabel} at ${timeLabel}`
          : `Culto em ${dateLabel} às ${timeLabel}`;
  } else if (dateLabel) {
    body =
      locale === 'es'
        ? `Culto el ${dateLabel}`
        : locale === 'en'
          ? `Service on ${dateLabel}`
          : `Culto em ${dateLabel}`;
  }

  return {
    title: titleByLocale[locale],
    body,
  };
}

function resolvePastoralSummaryCopy(
  payload: NotificationPayload,
  locale: Locale
) {
  const quantity = Math.max(1, readNumber(payload, 'quantidade') || 1);

  const titleByLocale: Record<Locale, string> = {
    pt: 'Novos pedidos pastorais',
    es: 'Nuevas solicitudes pastorales',
    en: 'New pastoral requests',
  };

  let body: string;

  if (locale === 'es') {
    body =
      quantity === 1
        ? '1 nueva solicitud está esperando atención'
        : `${quantity} nuevas solicitudes están esperando atención`;
  } else if (locale === 'en') {
    body =
      quantity === 1
        ? '1 new request is waiting for attention'
        : `${quantity} new requests are waiting for attention`;
  } else {
    body =
      quantity === 1
        ? '1 novo pedido aguardando atenção'
        : `${quantity} novos pedidos aguardando atenção`;
  }

  return {
    title: titleByLocale[locale],
    body,
  };
}

export function resolveNotificationCopy(input: NotificationContentInput) {
  const locale = resolveNotificationLocale(input.payload, input.preferredLocale);

  if (input.tipo === 'escala.usuario_alistado') {
    const resolved = resolveEscalaAssignmentCopy(input.payload, locale);
    return {
      locale,
      title: resolved.title || input.titulo || '',
      body: resolved.body || input.corpo || '',
    };
  }

  if (input.tipo === 'pastoral.resumo_10min') {
    const resolved = resolvePastoralSummaryCopy(input.payload, locale);
    return {
      locale,
      title: resolved.title || input.titulo || '',
      body: resolved.body || input.corpo || '',
    };
  }

  return {
    locale,
    title: input.titulo || '',
    body: input.corpo || '',
  };
}
