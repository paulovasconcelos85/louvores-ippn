'use client';

import { useEffect, useState } from 'react';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';

/** Se o usuário vê a Tesouraria da igreja (equipe da tesouraria ou Conselho). */
export function useAcessoFinancas(igrejaId?: string | null) {
  const [podeVer, setPodeVer] = useState(false);

  useEffect(() => {
    if (!igrejaId) {
      setPodeVer(false);
      return;
    }

    let ativo = true;
    (async () => {
      try {
        const response = await fetch(`/api/financas/acesso?igreja_id=${encodeURIComponent(igrejaId)}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await response.json();
        if (ativo) setPodeVer(Boolean(data.podeVer));
      } catch {
        if (ativo) setPodeVer(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  return podeVer;
}
