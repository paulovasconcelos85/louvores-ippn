'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Clock3, MapPin } from 'lucide-react';
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

function formatarDataExtenso(valor: string) {
  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return valor;

  const [, ano, mes, dia] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(data);
}

async function lerJsonSeguro(response: Response) {
  const texto = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('Resposta inválida do servidor.');
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('Não foi possível ler a resposta do servidor.');
  }
}

export default function BoletinsAnterioresPage() {
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

  useEffect(() => {
    let active = true;

    const carregarIgrejas = async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar igrejas.');
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
        setErro('Não foi possível carregar as igrejas.');
      }
    };

    carregarIgrejas();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!igrejaAtualId) return;

    let active = true;

    const carregarBoletins = async () => {
      try {
        setLoading(true);
        setErro(null);
        const params = new URLSearchParams({ igreja_id: igrejaAtualId });
        const response = await fetch(`/api/boletins-anteriores?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar boletins anteriores.');
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
        setErro('Não foi possível carregar os boletins anteriores agora.');
      } finally {
        if (active) setLoading(false);
      }
    };

    carregarBoletins();

    return () => {
      active = false;
    };
  }, [igrejaAtualId]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbf9_0%,#f4f4f1_45%,#fbfbf9_100%)]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="space-y-6">
          <Link
            href={igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/'}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-emerald-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao boletim atual
          </Link>

          <header className="rounded-[28px] border border-white/70 bg-white/90 px-5 py-6 shadow-[0_20px_60px_rgba(23,53,43,0.08)] sm:px-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
              Historico
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Boletins anteriores
            </h1>
            {igrejaSelecionada && (
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">
                  <MapPin className="w-3.5 h-3.5" />
                  {formatIgrejaLocalizacao(igrejaSelecionada) || igrejaSelecionada.nome}
                </span>
              </div>
            )}
          </header>

          {loading ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Carregando histórico...</p>
            </div>
          ) : erro ? (
            <div className="rounded-[28px] border border-rose-200 bg-white/85 px-6 py-12 text-center text-rose-700">
              {erro}
            </div>
          ) : boletins.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white/85 px-6 py-12 text-center text-slate-500">
              Nenhum boletim anterior disponível para esta igreja.
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
              <aside className="rounded-[28px] border border-slate-200/80 bg-white/85 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Edições
                  </h2>
                  <Link
                    href={igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/'}
                    className="text-sm font-medium text-emerald-800 hover:text-emerald-900"
                  >
                    Atual
                  </Link>
                </div>

                <div className="mt-3 space-y-2">
                  {boletins.map((boletim) => {
                    const ativo = boletimSelecionado?.id === boletim.id;

                    return (
                      <button
                        key={boletim.id}
                        type="button"
                        onClick={() => setBoletimSelecionadoId(boletim.id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          ativo
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{formatarDataExtenso(boletim.data)}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Boletim anterior
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </aside>

              {boletimSelecionado && (
                <article className="rounded-[28px] border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                      <Clock3 className="w-3.5 h-3.5" />
                      {formatarDataExtenso(boletimSelecionado.data)}
                    </span>
                    <Link
                      href={igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/'}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-800"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar ao atual
                    </Link>
                  </div>

                  {boletimSelecionado.imagemUrl && (
                    <img
                      src={boletimSelecionado.imagemUrl}
                      alt={`Boletim de ${formatarDataExtenso(boletimSelecionado.data)}`}
                      className="mt-4 w-full max-h-[24rem] rounded-2xl object-contain bg-slate-50"
                    />
                  )}

                  <div className="mt-5 space-y-0">
                    {boletimSelecionado.itens.map((item, index) => {
                      const [titulo, ...restante] = item.conteudo.split('\n');
                      const corpo = restante.join('\n').trim();

                      return (
                        <div
                          key={item.id}
                          className={`py-4 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                        >
                          <p className="text-[15px] font-semibold text-slate-900 leading-6">{titulo}</p>
                          {corpo ? (
                            <p className="mt-1.5 whitespace-pre-line text-[15px] leading-7 text-slate-600">
                              {corpo}
                            </p>
                          ) : null}
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
