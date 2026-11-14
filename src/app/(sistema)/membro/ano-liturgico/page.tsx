'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale, useTranslations } from '@/i18n/provider';
import { formatDateByLocale } from '@/i18n/format';
import {
  CORES_TEMPORADAS,
  obterTemporadaAtual,
  obterTodasAsTemporadas,
  type TemporadaId,
} from '@/lib/ano-liturgico';

export default function MembroAnoLiturgicoPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && !permissoes.ehMembroComum) {
      router.push(permissoes.podeAcessarAdmin ? '/admin' : '/');
    }
  }, [user, loading, permissoes.ehMembroComum, permissoes.podeAcessarAdmin, router]);

  const temporadaAtual = useMemo(() => obterTemporadaAtual(), []);
  const todasTemporadas = useMemo(() => obterTodasAsTemporadas(), []);

  if (loading || !permissoes.ehMembroComum) return null;

  const nomeTemporada = (id: TemporadaId) => t(`memberArea.liturgicalSeasons.${id}.nome`);
  const descricaoTemporada = (id: TemporadaId) => t(`memberArea.liturgicalSeasons.${id}.descricao`);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.push('/membro')}
            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('memberArea.back')}
          </button>
          <h1 className="ml-2 text-lg font-bold text-slate-900">{t('memberArea.liturgicalYear')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <section className="flex items-center gap-4 rounded-xl border bg-white p-6 shadow-sm">
          <span
            className="h-12 w-12 flex-shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: CORES_TEMPORADAS[temporadaAtual.id] }}
            aria-hidden
          />
          <div>
            <p className="text-xl font-bold text-slate-900">{nomeTemporada(temporadaAtual.id)}</p>
            <p className="text-sm text-slate-500">
              {formatDateByLocale(temporadaAtual.inicio, locale)} —{' '}
              {formatDateByLocale(new Date(temporadaAtual.fim.getTime() - 86400000), locale)}
            </p>
            <p className="mt-2 text-slate-700">{descricaoTemporada(temporadaAtual.id)}</p>
          </div>
        </section>

        <ul className="divide-y rounded-xl border bg-white shadow-sm">
          {todasTemporadas.map((temporada) => (
            <li
              key={`${temporada.id}-${temporada.inicio.toISOString()}`}
              className={`flex items-start gap-3 px-4 py-3 ${
                temporada.id === temporadaAtual.id ? 'bg-emerald-50' : ''
              }`}
            >
              <span
                className="mt-1 h-3 w-3 flex-shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: CORES_TEMPORADAS[temporada.id] }}
                aria-hidden
              />
              <span>
                <span className="block font-medium text-slate-900">{nomeTemporada(temporada.id)}</span>
                <span className="block text-sm text-slate-500">{descricaoTemporada(temporada.id)}</span>
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
