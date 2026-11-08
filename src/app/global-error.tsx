'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Último recurso quando o próprio layout quebra: registra no Sentry e oferece recarregar.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Algo deu errado.</h1>
        <p style={{ color: '#555', marginBottom: 16 }}>O erro foi registrado. Tente de novo.</p>
        <button
          type="button"
          onClick={reset}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
