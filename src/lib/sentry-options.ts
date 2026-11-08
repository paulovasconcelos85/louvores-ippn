// Opções comuns do Sentry para navegador, servidor e edge.
// Sem NEXT_PUBLIC_SENTRY_DSN o Sentry fica desligado (útil em desenvolvimento).
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  // Dados de membros (saúde, endereço, notas pastorais) não podem sair do app:
  // nada de IP, cookies ou corpo de requisição nos eventos.
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
};
