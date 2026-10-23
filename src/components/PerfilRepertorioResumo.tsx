'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Music, TriangleAlert } from 'lucide-react';
import { useLocale } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/config';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import {
  criarContextoTexto,
  montarResumoCurto,
  traduzir,
  type AnaliseRepertorio,
} from '@/lib/repertorio-perfil';

// O resumo do perfil da igreja pelo repertório dos últimos 12 meses, para a tela admin.
// Sem dados suficientes (ou em caso de erro) o cartão simplesmente não aparece.
export default function PerfilRepertorioResumo({ igrejaId }: { igrejaId: string }) {
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const tr = (pt: string, es: string, en: string) => traduzir(locale, pt, es, en);
  const [analise, setAnalise] = useState<AnaliseRepertorio | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();

    const carregar = async () => {
      try {
        setCarregando(true);
        const params = new URLSearchParams({ igreja_id: igrejaId, periodo: '365d' });
        const response = await fetch(`/api/dashboard/repertorio?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as AnaliseRepertorio;
        if (ativo) setAnalise(payload);
      } catch (error) {
        if (controller.signal.aborted || !ativo) return;
        console.error('Erro ao carregar resumo do repertório:', error);
        setAnalise(null);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
      controller.abort();
    };
  }, [igrejaId]);

  if (carregando) {
    return (
      <div className="mb-8 animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-3 w-48 rounded bg-slate-100" />
        <div className="mt-4 h-5 w-full max-w-2xl rounded bg-slate-100" />
        <div className="mt-2 h-5 w-2/3 max-w-xl rounded bg-slate-100" />
      </div>
    );
  }

  if (!analise) return null;
  const ctx = criarContextoTexto(locale, intlLocale);
  const resumo = montarResumoCurto(analise, ctx);
  if (!resumo) return null;

  const leitura = analise.leitura;

  return (
    <section className="mb-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Music className="h-4 w-4" />
          {tr('Perfil da igreja pelo que ela canta', 'Perfil de la iglesia por lo que canta', 'Church profile from what it sings')}
        </p>
        <Link
          href={`/dashboard?aba=repertorio&igreja_id=${igrejaId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          {tr('Ver análise completa', 'Ver análisis completo', 'See full analysis')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="mt-3 max-w-3xl text-lg font-medium leading-8 text-slate-900">{resumo.perfil}</p>

      {resumo.atencao ? (
        <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-amber-800">
          <TriangleAlert className="mt-1 h-4 w-4 shrink-0" />
          {resumo.atencao}
        </p>
      ) : null}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        {tr('Últimos 12 meses', 'Últimos 12 meses', 'Last 12 months')}
        {' · '}
        {tr(
          `${analise.resumo.execucoes} músicas cantadas em ${analise.resumo.cultos} cultos`,
          `${analise.resumo.execucoes} canciones cantadas en ${analise.resumo.cultos} cultos`,
          `${analise.resumo.execucoes} songs sung in ${analise.resumo.cultos} services`
        )}
        {leitura
          ? ` · ${tr('atualizado com o culto de', 'actualizado con el culto del', 'updated with the service on')} ${ctx.formatarDataCurta(leitura.culto.data)}`
          : ''}
        {resumo.amostraPequena ? ` · ${tr('amostra ainda pequena', 'muestra aún pequeña', 'sample still small')}` : ''}
      </p>
    </section>
  );
}
