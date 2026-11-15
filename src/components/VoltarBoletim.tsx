'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '@/i18n/provider';
import { porIdioma } from '@/i18n/por-idioma';

// A biblioteca /confissoes é comum a todas as igrejas: o boletim guarda qual
// igreja estava aberta para a biblioteca oferecer o caminho de volta.
const CHAVE = 'oikos:ultimo-boletim';

interface BoletimVisitado {
  slug: string;
  nome: string;
}

export function lembrarBoletim(slug: string, nome: string) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify({ slug, nome } satisfies BoletimVisitado));
  } catch {
    // Navegação privada sem localStorage: a biblioteca só não mostra o link.
  }
}

export default function VoltarBoletim() {
  const locale = useLocale();
  const [boletim, setBoletim] = useState<BoletimVisitado | null>(null);

  useEffect(() => {
    try {
      const salvo = JSON.parse(window.localStorage.getItem(CHAVE) || 'null') as BoletimVisitado | null;
      if (salvo?.slug && /^[a-z0-9-]+$/.test(salvo.slug)) setBoletim(salvo);
    } catch {
      setBoletim(null);
    }
  }, []);

  if (!boletim) return null;

  return (
    <Link
      href={`/${boletim.slug}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#1e1208]/20 px-3 py-1.5 text-[16px] italic text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#8b2a1d]"
    >
      ← <span className="hidden sm:inline">{porIdioma(locale, 'Voltar ao boletim', 'Volver al boletín', 'Back to bulletin')}</span>
      <span className="sm:hidden">{porIdioma(locale, 'Boletim', 'Boletín', 'Bulletin')}</span>
      {boletim.nome ? <span className="hidden font-semibold not-italic md:inline">· {boletim.nome}</span> : null}
    </Link>
  );
}
