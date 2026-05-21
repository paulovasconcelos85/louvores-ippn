'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, ChevronRight, Clock3, MapPin, FileText } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { formatDateByLocale } from '@/i18n/format';
import { useLocale, useTranslations } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY, formatIgrejaLocalizacao } from '@/lib/church-utils';

interface BoletimAnteriorItem {
  id: string;
  conteudo: string;
  ordem: number | null;
}

interface BoletimAnterior {
  id: string;
  cultoId: number;
  data: string;
  imagemUrl: string | null;
  itens: BoletimAnteriorItem[];
}

function formatarDataExtenso(valor: string, locale: Locale) {
  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return valor;

  const [, ano, mes, dia] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return formatDateByLocale(data, locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function lerJsonSeguro(response: Response, t: (key: string) => string) {
  const texto = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(t('history.invalidResponse'));
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(t('history.invalidJson'));
  }
}

function extrairPartesLiturgicas(conteudo: string) {
  const [titulo, ...restante] = conteudo.split('\n');

  return {
    titulo: titulo.trim(),
    corpo: restante.join('\n').trim(),
  };
}

const TIPOS_BOLETIM: Record<string, string> = {
  avisos: 'Avisos',
  oracao: 'Pedidos de Oração',
  agenda: 'Agenda',
  informativo: 'Informativo',
  outro: 'Outros',
};

type TipoSecao = 'liturgia' | 'avisos' | 'oracao' | 'agenda' | 'informativo' | 'outro' | 'default';

function classificarSecao(titulo: string): TipoSecao {
  if (titulo === '__liturgia__:nome') return 'liturgia';
  if (titulo.startsWith('__boletim__:')) {
    const subtipo = titulo.slice('__boletim__:'.length);
    if (subtipo in TIPOS_BOLETIM) return subtipo as TipoSecao;
  }
  return 'default';
}

function formatarTituloSecao(titulo: string): string {
  if (titulo === '__liturgia__:nome') return 'Liturgia';
  if (titulo.startsWith('__boletim__:')) {
    const subtipo = titulo.slice('__boletim__:'.length);
    return TIPOS_BOLETIM[subtipo] ?? subtipo;
  }
  return titulo;
}

const CORES_SECAO: Record<TipoSecao, { badge: string; dot: string; border: string }> = {
  liturgia:    { badge: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500',  border: 'border-l-violet-400' },
  avisos:      { badge: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500',   border: 'border-l-amber-400' },
  oracao:      { badge: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500',    border: 'border-l-blue-400' },
  agenda:      { badge: 'bg-teal-100 text-teal-700',      dot: 'bg-teal-500',    border: 'border-l-teal-400' },
  informativo: { badge: 'bg-indigo-100 text-indigo-700',  dot: 'bg-indigo-500',  border: 'border-l-indigo-400' },
  outro:       { badge: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400',   border: 'border-l-slate-300' },
  default:     { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-600', border: 'border-l-emerald-400' },
};

export default function BoletinsAnterioresPage() {
  const locale = useLocale();
  const t = useTranslations();
  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string | null>(null);
  const [boletins, setBoletins] = useState<BoletimAnterior[]>([]);
  const [loading, setLoading] = useState(true);
  const [boletimSelecionadoId, setBoletimSelecionadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const igrejaSelecionada = useMemo(
    () => igrejas.find((igreja) => igreja.id === igrejaAtualId) || null,
    [igrejas, igrejaAtualId]
  );

  const boletimSelecionado = useMemo(
    () => boletins.find((boletim) => boletim.id === boletimSelecionadoId) || boletins[0] || null,
    [boletins, boletimSelecionadoId]
  );

  const itensAgrupadosBoletimSelecionado = useMemo(() => {
    if (!boletimSelecionado) return [];

    const grupos: Array<{
      id: string;
      titulo: string;
      corpos: string[];
    }> = [];

    for (const item of boletimSelecionado.itens) {
      const partes = extrairPartesLiturgicas(item.conteudo);
      const ultimoGrupo = grupos[grupos.length - 1];

      if (ultimoGrupo && ultimoGrupo.titulo === partes.titulo) {
        ultimoGrupo.corpos.push(partes.corpo);
        continue;
      }

      grupos.push({
        id: item.id,
        titulo: partes.titulo,
        corpos: [partes.corpo],
      });
    }

    return grupos;
  }, [boletimSelecionado]);

  useEffect(() => {
    let active = true;

    const carregarIgrejas = async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await lerJsonSeguro(response, t);

        if (!response.ok) {
          throw new Error(data.error || t('history.loadChurchesError'));
        }

        if (!active) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        setIgrejas(lista);

        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const preferida =
          igrejaUrl ||
          (typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null) ||
          data.igrejaAtualId ||
          lista[0]?.id ||
          null;

        setIgrejaAtualId(preferida);
      } catch (error) {
        console.error('Erro ao carregar igrejas:', error);
        if (!active) return;
        setErro(t('history.loadChurchesError'));
      }
    };

    carregarIgrejas();

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!igrejaAtualId) return;

    let active = true;

    const carregarBoletins = async () => {
      try {
        setLoading(true);
        setErro(null);
        const params = new URLSearchParams({ igreja_id: igrejaAtualId, locale });
        const response = await fetch(`/api/boletins-anteriores?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await lerJsonSeguro(response, t);

        if (!response.ok) {
          throw new Error(data.error || t('history.loadHistoryError'));
        }

        if (!active) return;
        const lista = (data.boletins || []) as BoletimAnterior[];
        setBoletins(lista);
        setBoletimSelecionadoId(lista[0]?.id || null);
      } catch (error) {
        console.error('Erro ao carregar boletins anteriores:', error);
        if (!active) return;
        setBoletins([]);
        setBoletimSelecionadoId(null);
        setErro(t('history.loadHistoryError'));
      } finally {
        if (active) setLoading(false);
      }
    };

    carregarBoletins();

    return () => {
      active = false;
    };
  }, [igrejaAtualId, t, locale]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="space-y-8">
          <Link
            href={igrejaSelecionada?.slug ? `/${igrejaSelecionada.slug}` : (igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-900"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('history.backToCurrent')}
          </Link>

          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5" />
              {t('history.eyebrow')}
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight">
              {t('history.title')}
            </h1>
            {igrejaSelecionada && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-emerald-200 shadow-sm">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-sm font-semibold text-slate-700">
                  {formatIgrejaLocalizacao(igrejaSelecionada) || igrejaSelecionada.nome}
                </span>
              </div>
            )}
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-10 h-10 border-3 border-emerald-200 border-t-emerald-700 rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">{t('history.loading')}</p>
            </div>
          ) : erro ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-8 py-12 text-center">
              <p className="text-red-800 font-semibold">{erro}</p>
            </div>
          ) : boletins.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur px-8 py-16 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-semibold">{t('history.empty')}</p>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
              <aside className="rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm p-5 shadow-sm h-fit sticky top-24">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t('history.editions')}
                  </h2>
                  <Link
                    href={igrejaSelecionada?.slug ? `/${igrejaSelecionada.slug}` : (igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
                  >
                    {t('history.current')}
                  </Link>
                </div>

                <div className="space-y-2">
                  {boletins.map((boletim) => {
                    const ativo = boletimSelecionado?.id === boletim.id;

                    return (
                      <button
                        key={boletim.id}
                        type="button"
                        onClick={() => setBoletimSelecionadoId(boletim.id)}
                        className={`w-full rounded-lg px-4 py-3 text-left transition-all duration-200 border ${
                          ativo
                            ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-50/50 text-emerald-950 shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900">{formatarDataExtenso(boletim.data, locale)}</p>
                            <p className="text-xs uppercase tracking-[0.1em] text-slate-400 mt-0.5">
                              {t('history.pastBulletin')}
                            </p>
                          </div>
                          {ativo && <ChevronRight className="h-4 w-4 text-emerald-700 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {boletimSelecionado && (
                <article className="rounded-xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
                  <div className="px-6 sm:px-8 py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
                        <Calendar className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Boletim</p>
                        <p className="text-lg font-bold text-slate-900">{formatarDataExtenso(boletimSelecionado.data, locale)}</p>
                      </div>
                    </div>
                    <Link
                      href={igrejaSelecionada?.slug ? `/${igrejaSelecionada.slug}` : (igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t('history.backToCurrentShort')}
                    </Link>
                  </div>

                  {boletimSelecionado.imagemUrl && (
                    <div className="px-6 sm:px-8 py-6 border-b border-slate-100">
                      <div className="relative rounded-xl overflow-hidden bg-slate-100 shadow-sm">
                        <img
                          src={boletimSelecionado.imagemUrl}
                          alt={t('history.imageAlt', {
                            date: formatarDataExtenso(boletimSelecionado.data, locale),
                          })}
                          className="w-full max-h-96 object-contain"
                        />
                      </div>
                    </div>
                  )}

                  <div className="px-6 sm:px-8 py-8 space-y-0">
                    {itensAgrupadosBoletimSelecionado.map((item, index) => {
                      const tipo = classificarSecao(item.titulo);
                      const cores = CORES_SECAO[tipo];
                      const tituloFormatado = formatarTituloSecao(item.titulo);

                      return (
                        <div
                          key={item.id}
                          className={`py-6 pl-4 border-l-4 ${cores.border} ${index > 0 ? 'mt-6 border-t border-slate-100 pt-6' : ''}`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${cores.badge}`}>
                              {tituloFormatado}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {item.corpos.map((corpo, corpoIndex) =>
                              corpo ? (
                                <p
                                  key={`${item.id}-${corpoIndex}`}
                                  className="whitespace-pre-line text-sm leading-7 text-slate-600"
                                >
                                  {corpo}
                                </p>
                              ) : null
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
