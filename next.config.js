import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Metadados sempre no <head>: Chrome e iPhone só encontram o manifest e o ícone
  // do app (PWA do boletim) ali. Sem isso o Next 15.5 os envia no meio do <body>.
  htmlLimitedBots: /.*/,
};

// Source maps só sobem para o Sentry quando SENTRY_AUTH_TOKEN, SENTRY_ORG e
// SENTRY_PROJECT estão definidos (na Vercel); sem eles o build segue normal.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  telemetry: false,
});
