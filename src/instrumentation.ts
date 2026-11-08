import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry-options';

export function register() {
  Sentry.init(sentryOptions);
}

// Erros de páginas, rotas /api e proxy no servidor.
export const onRequestError = Sentry.captureRequestError;
