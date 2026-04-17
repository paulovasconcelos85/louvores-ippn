'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Award,
  BarChart3,
  Calendar,
  Globe,
  Music,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useLocale, useTranslations } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/config';
import { supabase } from '@/lib/supabase';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY } from '@/lib/church-utils';

interface RankingItem {
  cantico: string;
  total: number;
}

interface EvolucaoMensal {
  mes: string;
  total: number;
}

interface CanticoRecente {
  cantico: string;
  ultimaData: string;
  diasAtras: number;
}

interface TomItem {
  tom: string;
  total: number;
}

interface CultoResumo {
  'Culto nr.': number;
  Dia: string;
}

interface LouvorItemResumo {
  culto_id: number;
  cantico_id: string | number | null;
  tom: string | null;
}

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | null | undefined>
) => string;

const COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAnoFromDate(date: string) {
  return Number(date.slice(0, 4));
}

function getMesFromDate(date: string) {
  return Number(date.slice(5, 7));
}

function filtrarCultosPorPeriodo(cultos: CultoResumo[], ano: number | null, mes: number | null) {
  return cultos.filter((culto) => {
    const anoCulto = getAnoFromDate(culto.Dia);
    const mesCulto = getMesFromDate(culto.Dia);

    if (ano !== null && anoCulto !== ano) return false;
    if (mes !== null && mesCulto !== mes) return false;

    return true;
  });
}

function formatarDiasAtras(diasAtras: number, t: TranslateFn) {
  if (diasAtras <= 0) return t('dashboard.today');
  if (diasAtras === 1) return t('dashboard.yesterday');
  return t('dashboard.daysAgo', { count: diasAtras });
}

async function resolveNomesMusicais(igrejaId: string, canticoIds: string[], t: TranslateFn) {
  const idsUuid = canticoIds.filter(isUuid);
  const idsHinario = canticoIds
    .filter((value) => !isUuid(value) && /^\d+$/.test(value))
    .map((value) => Number(value));

  const [canticosResult, hinarioResult] = await Promise.all([
    idsUuid.length > 0
      ? supabase.from('canticos').select('id, nome').eq('igreja_id', igrejaId).in('id', idsUuid)
      : Promise.resolve({ data: [], error: null }),
    idsHinario.length > 0
      ? supabase.from('hinario_novo_cantico').select('id, numero, titulo').in('id', idsHinario)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (canticosResult.error) throw canticosResult.error;
  if (hinarioResult.error) throw hinarioResult.error;

  const nomesPorId = new Map<string, string>();

  ((canticosResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    nomesPorId.set(String(cantico.id), cantico.nome?.trim() || t('dashboard.songWithoutName'));
  });

  (
    (hinarioResult.data || []) as Array<{
      id: string | number;
      numero: string | null;
      titulo: string | null;
    }>
  ).forEach((hino) => {
    const numero = hino.numero?.trim();
    const titulo = hino.titulo?.trim() || t('dashboard.untitled');
    const nome = numero
      ? t('dashboard.hymnWithNumber', { number: numero, title: titulo })
      : t('dashboard.hymnWithoutNumber', { title: titulo });
    nomesPorId.set(String(hino.id), nome);
  });

  return nomesPorId;
}

function EmptyChartState({ message }: { message: string }) {
  return <div className="flex h-[300px] items-center justify-center text-center text-slate-400">{message}</div>;
}

export default function DashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const intlLocale = getIntlLocale(locale);
  const { user, loading: authLoading } = useAuth();

  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string | null>(null);
  const [todosCultosIgreja, setTodosCultosIgreja] = useState<CultoResumo[]>([]);
  const [anos, setAnos] = useState<number[]>([]);
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [evolucaoMensal, setEvolucaoMensal] = useState<EvolucaoMensal[]>([]);
  const [canticosRecentes, setCanticosRecentes] = useState<CanticoRecente[]>([]);
  const [rankingTons, setRankingTons] = useState<TomItem[]>([]);
  const [totalExecucoes, setTotalExecucoes] = useState(0);
  const [totalCanticos, setTotalCanticos] = useState(0);
  const [totalCultos, setTotalCultos] = useState(0);
  const [mediaPorCulto, setMediaPorCulto] = useState(0);
  const [maisCantado, setMaisCantado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const monthLongFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'long' }),
    [intlLocale]
  );
  const monthShortFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'short' }),
    [intlLocale]
  );
  const decimalFormatter = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [intlLocale]
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        v: index + 1,
        n: monthLongFormatter.format(new Date(2024, index, 1)),
      })),
    [monthLongFormatter]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user?.id) {
      setIgrejas([]);
      setIgrejaAtualId(null);
      setTodosCultosIgreja([]);
      return;
    }

    let ativo = true;

    const carregarIgrejas = async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || t('header.loadChurchesError'));
        }

        if (!ativo) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const igrejaPreferida =
          typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null;
        const prioridade = [igrejaUrl, igrejaPreferida, data.igrejaAtualId, lista[0]?.id || null].filter(
          Boolean
        ) as string[];
        const igrejaResolvida =
          prioridade.find((id) => lista.some((igreja) => igreja.id === id)) || null;

        setIgrejas(lista);
        setIgrejaAtualId(igrejaResolvida);
      } catch (error) {
        console.error('Erro ao carregar igrejas do dashboard:', error);
        if (!ativo) return;
        setIgrejas([]);
        setIgrejaAtualId(null);
        setTodosCultosIgreja([]);
      }
    };

    void carregarIgrejas();

    return () => {
      ativo = false;
    };
  }, [t, user?.id]);

  useEffect(() => {
    if (!igrejaAtualId) {
      setTodosCultosIgreja([]);
      setAnos([]);
      return;
    }

    let ativo = true;

    async function fetchCultosDaIgreja() {
      const { data, error } = await supabase
        .from('Louvores IPPN')
        .select('"Culto nr.", Dia')
        .eq('igreja_id', igrejaAtualId)
        .order('Dia', { ascending: false });

      if (error) {
        console.error('Erro ao buscar cultos da igreja:', error);
        if (ativo) {
          setTodosCultosIgreja([]);
          setAnos([]);
        }
        return;
      }

      if (!ativo) return;

      const cultos = (data || []) as CultoResumo[];
      setTodosCultosIgreja(cultos);

      const anosUnicos = Array.from(new Set(cultos.map((culto) => getAnoFromDate(culto.Dia)))).sort((a, b) => b - a);
      setAnos(anosUnicos);
    }

    void fetchCultosDaIgreja();

    return () => {
      ativo = false;
    };
  }, [igrejaAtualId]);

  useEffect(() => {
    let ativo = true;

    async function fetchDados() {
      setLoading(true);

      if (!igrejaAtualId) {
        setRanking([]);
        setEvolucaoMensal([]);
        setRankingTons([]);
        setTotalExecucoes(0);
        setTotalCanticos(0);
        setTotalCultos(0);
        setMaisCantado(null);
        setMediaPorCulto(0);
        setLoading(false);
        return;
      }

      const cultosFiltrados = filtrarCultosPorPeriodo(todosCultosIgreja, ano, mes);

      if (cultosFiltrados.length === 0) {
        setRanking([]);
        setEvolucaoMensal([]);
        setRankingTons([]);
        setTotalExecucoes(0);
        setTotalCanticos(0);
        setTotalCultos(0);
        setMaisCantado(null);
        setMediaPorCulto(0);
        setLoading(false);
        return;
      }

      try {
        const cultoIds = cultosFiltrados.map((culto) => culto['Culto nr.']);
        const cultosPorId = new Map(cultosFiltrados.map((culto) => [culto['Culto nr.'], culto.Dia]));
        const { data: itensMusicais, error } = await supabase
          .from('louvor_itens')
          .select('culto_id, cantico_id, tom')
          .in('culto_id', cultoIds)
          .not('cantico_id', 'is', null);

        if (error) {
          throw error;
        }

        const itensValidos = ((itensMusicais || []) as LouvorItemResumo[])
          .map((item) => ({
            culto_id: item.culto_id,
            cantico_id: item.cantico_id ? String(item.cantico_id) : null,
            tom: item.tom,
          }))
          .filter((item) => item.cantico_id && cultosPorId.has(item.culto_id));

        if (itensValidos.length === 0) {
          if (!ativo) return;
          setRanking([]);
          setEvolucaoMensal([]);
          setRankingTons([]);
          setTotalExecucoes(0);
          setTotalCanticos(0);
          setTotalCultos(0);
          setMaisCantado(null);
          setMediaPorCulto(0);
          return;
        }

        const nomesPorId = await resolveNomesMusicais(
          igrejaAtualId,
          Array.from(new Set(itensValidos.map((item) => item.cantico_id!).filter(Boolean))),
          t
        );

        const execucoes = itensValidos.map((item) => {
          const dataCulto = cultosPorId.get(item.culto_id)!;

          return {
            cantico: nomesPorId.get(item.cantico_id!) || t('dashboard.songFallback', { id: item.cantico_id }),
            ano: getAnoFromDate(dataCulto),
            mes: getMesFromDate(dataCulto),
            data: dataCulto,
            culto_nr: item.culto_id,
            tom: item.tom,
          };
        });

        const contagemCanticos = execucoes.reduce<Record<string, number>>((acc, curr) => {
          acc[curr.cantico] = (acc[curr.cantico] || 0) + 1;
          return acc;
        }, {});

        const rankingArray = Object.entries(contagemCanticos)
          .map(([cantico, total]) => ({
            cantico,
            total,
          }))
          .sort((a, b) => b.total - a.total);

        const cultosUnicos = new Set(cultoIds);
        const evolucaoComData = execucoes.reduce<
          Record<string, { mes: string; total: number; anoNum: number; mesNum: number }>
        >((acc, curr) => {
          const mesNome = monthShortFormatter
            .format(new Date(curr.ano, curr.mes - 1, 1))
            .replace(/\.$/, '');
          const anoStr = curr.ano.toString().slice(-2);
          const key = ano ? mesNome : `${mesNome}/${anoStr}`;

          if (!acc[key]) {
            acc[key] = {
              mes: key,
              total: 0,
              anoNum: curr.ano,
              mesNum: curr.mes,
            };
          }

          acc[key].total++;
          return acc;
        }, {});

        const evolucaoArray = Object.values(evolucaoComData)
          .sort((a, b) => {
            if (a.anoNum !== b.anoNum) {
              return a.anoNum - b.anoNum;
            }
            return a.mesNum - b.mesNum;
          })
          .map(({ mes: label, total }) => ({ mes: label, total }));

        const contagemTons = execucoes
          .filter((execucao) => execucao.tom !== null)
          .reduce<Record<string, number>>((acc, curr) => {
            const tom = curr.tom!;
            acc[tom] = (acc[tom] || 0) + 1;
            return acc;
          }, {});

        const rankingTonsArray = Object.entries(contagemTons)
          .map(([tom, total]) => ({
            tom,
            total,
          }))
          .sort((a, b) => b.total - a.total);

        if (!ativo) return;

        setRanking(rankingArray);
        setTotalExecucoes(execucoes.length);
        setTotalCanticos(rankingArray.length);
        setMaisCantado(rankingArray[0]?.cantico || null);
        setTotalCultos(cultosUnicos.size);
        setEvolucaoMensal(evolucaoArray);
        setMediaPorCulto(cultosUnicos.size > 0 ? execucoes.length / cultosUnicos.size : 0);
        setRankingTons(rankingTonsArray);
      } catch (error) {
        console.error('Erro ao buscar dados do dashboard:', error);
        if (!ativo) return;
        setRanking([]);
        setEvolucaoMensal([]);
        setRankingTons([]);
        setTotalExecucoes(0);
        setTotalCanticos(0);
        setTotalCultos(0);
        setMaisCantado(null);
        setMediaPorCulto(0);
      } finally {
        if (ativo) setLoading(false);
      }
    }

    void fetchDados();

    return () => {
      ativo = false;
    };
  }, [ano, mes, igrejaAtualId, todosCultosIgreja, monthShortFormatter, t]);

  useEffect(() => {
    let ativo = true;

    async function fetchCanticosRecentes() {
      if (!igrejaAtualId) {
        setCanticosRecentes([]);
        return;
      }

      try {
        const quatroSemanasAtras = new Date();
        quatroSemanasAtras.setDate(quatroSemanasAtras.getDate() - 28);
        const limite = quatroSemanasAtras.toISOString().split('T')[0];
        const cultoIdsRecentes = todosCultosIgreja
          .filter((culto) => culto.Dia >= limite)
          .map((culto) => culto['Culto nr.']);

        if (cultoIdsRecentes.length === 0) {
          if (ativo) setCanticosRecentes([]);
          return;
        }

        const { data: execucoes, error } = await supabase
          .from('louvor_itens')
          .select('culto_id, cantico_id')
          .in('culto_id', cultoIdsRecentes)
          .not('cantico_id', 'is', null);

        if (error) {
          throw error;
        }

        if (!execucoes || execucoes.length === 0) {
          if (ativo) setCanticosRecentes([]);
          return;
        }

        const nomesPorId = await resolveNomesMusicais(
          igrejaAtualId,
          Array.from(
            new Set(
              execucoes
                .map((item: { cantico_id: string | number | null }) => item.cantico_id)
                .filter(Boolean)
                .map((item) => String(item))
            )
          ),
          t
        );

        const hoje = new Date();
        const canticosUnicos = execucoes.reduce<Record<string, CanticoRecente>>((acc, curr: any) => {
          const canticoId = curr.cantico_id ? String(curr.cantico_id) : null;
          const dataCulto = curr.culto_id
            ? todosCultosIgreja.find((culto) => culto['Culto nr.'] === curr.culto_id)?.Dia || null
            : null;

          if (!canticoId || !dataCulto) return acc;

          const nomeCantico = nomesPorId.get(canticoId) || t('dashboard.songFallback', { id: canticoId });

          if (!acc[nomeCantico]) {
            const dataExecucao = new Date(dataCulto);
            const diasAtras = Math.floor((hoje.getTime() - dataExecucao.getTime()) / (1000 * 60 * 60 * 24));

            acc[nomeCantico] = {
              cantico: nomeCantico,
              ultimaData: dataCulto,
              diasAtras,
            };
          }

          return acc;
        }, {});

        const canticosArray = Object.values(canticosUnicos);
        canticosArray.sort((a, b) => a.cantico.localeCompare(b.cantico, intlLocale));

        if (ativo) setCanticosRecentes(canticosArray);
      } catch (error) {
        console.error('Erro ao buscar músicas recentes:', error);
        if (ativo) setCanticosRecentes([]);
      }
    }

    void fetchCanticosRecentes();

    return () => {
      ativo = false;
    };
  }, [igrejaAtualId, intlLocale, t, todosCultosIgreja]);

  if (authLoading || !user) return null;

  const igrejaAtual = igrejas.find((igreja) => igreja.id === igrejaAtualId) || null;
  const top5 = ranking.slice(0, 5);
  const percentualTop5 = top5.map((item) => ({
    name: item.cantico,
    value: item.total,
    percent: totalExecucoes > 0 ? ((item.total / totalExecucoes) * 100).toFixed(1) : '0.0',
  }));
  const formatDecimal = (value: number) => decimalFormatter.format(value);
  const formatPercent = (value: number | string) => `${decimalFormatter.format(Number(value))}%`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mb-6">
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-slate-800">
          <BarChart3 className="h-8 w-8 text-emerald-600" />
          {t('dashboard.title')}
        </h1>
        <p className="text-slate-600">
          {igrejaAtual
            ? t('dashboard.subtitleWithChurch', { church: igrejaAtual.sigla || igrejaAtual.nome })
            : t('dashboard.subtitleGeneric')}
        </p>
      </div>

      <div className="mb-6 rounded-xl bg-white p-4 shadow-md">
        <h3 className="mb-3 font-semibold text-slate-700">{t('dashboard.filters')}</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 flex items-center gap-2 text-sm text-slate-600">
              <Globe className="h-4 w-4" />
              {t('dashboard.year')}
            </label>
            <select
              value={ano || ''}
              onChange={(e) => setAno(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-slate-300 p-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('dashboard.allYears')}</option>
              {anos.map((anoItem) => (
                <option key={anoItem} value={anoItem}>
                  {anoItem}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="mb-1 flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              {t('dashboard.month')}
            </label>
            <select
              value={mes || ''}
              onChange={(e) => setMes(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-slate-300 p-2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('dashboard.allMonths')}</option>
              {monthOptions.map((monthOption) => (
                <option key={monthOption.v} value={monthOption.v}>
                  {monthOption.n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
          <p className="mb-1 flex items-center gap-2 text-sm text-emerald-100">
            <Activity className="h-4 w-4" />
            {t('dashboard.stats.totalExecutions')}
          </p>
          <p className="text-3xl font-bold">{totalExecucoes}</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
          <p className="mb-1 flex items-center gap-2 text-sm text-blue-100">
            <Music className="h-4 w-4" />
            {t('dashboard.stats.uniqueSongs')}
          </p>
          <p className="text-3xl font-bold">{totalCanticos}</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 text-white shadow-lg">
          <p className="mb-1 flex items-center gap-2 text-sm text-indigo-100">
            <Calendar className="h-4 w-4" />
            {t('dashboard.stats.totalServices')}
          </p>
          <p className="text-3xl font-bold">{totalCultos}</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg">
          <p className="mb-1 flex items-center gap-2 text-sm text-purple-100">
            <Target className="h-4 w-4" />
            {t('dashboard.stats.averagePerService')}
          </p>
          <p className="text-3xl font-bold">{formatDecimal(mediaPorCulto)}</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg">
          <p className="mb-1 flex items-center gap-2 text-sm text-orange-100">
            <Award className="h-4 w-4" />
            {t('dashboard.stats.mostPlayed')}
          </p>
          <p className="truncate text-sm font-semibold">{maisCantado || '-'}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Music className="h-6 w-6 text-emerald-600" />
            {t('dashboard.recentSongsTitle')}
          </h2>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
            {t('dashboard.recentSongsCount', { count: canticosRecentes.length })}
          </span>
        </div>

        {canticosRecentes.length === 0 ? (
          <p className="py-8 text-center text-slate-500">{t('dashboard.recentSongsEmpty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {canticosRecentes.map((item, idx) => (
              <div
                key={`${item.cantico}-${item.ultimaData}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-emerald-300 hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-700">{item.cantico}</p>
                  <p className="text-xs text-slate-500">{formatarDiasAtras(item.diasAtras, t)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-sm text-slate-500">{t('dashboard.loading')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {t('dashboard.charts.topSongs')}
            </h2>
            {ranking.length === 0 ? (
              <EmptyChartState message={t('dashboard.noChartData')} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ranking.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="cantico"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
              <Target className="h-5 w-5 text-blue-500" />
              {t('dashboard.charts.topDistribution')}
            </h2>
            {percentualTop5.length === 0 ? (
              <EmptyChartState message={t('dashboard.noChartData')} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={percentualTop5}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ payload }: { payload?: { percent?: string | number } }) =>
                      formatPercent(payload?.percent || 0)
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {percentualTop5.map((entry, index) => (
                      <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value, entry: { payload?: { name?: string } }) =>
                      entry.payload?.name || String(value)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
              <TrendingUp className="h-5 w-5 text-green-500" />
              {t('dashboard.charts.monthlyTrend')}
            </h2>
            {evolucaoMensal.length === 0 ? (
              <EmptyChartState message={t('dashboard.noChartData')} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
              <Music className="h-5 w-5 text-purple-500" />
              {t('dashboard.charts.topKeys')}
            </h2>
            {rankingTons.length === 0 ? (
              <EmptyChartState message={t('dashboard.noKeyRecorded')} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankingTons.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tom" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-lg lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
              <BarChart3 className="h-5 w-5 text-slate-600" />
              {t('dashboard.charts.fullRanking')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">{t('dashboard.table.position')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">{t('dashboard.table.song')}</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">{t('dashboard.table.executions')}</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">{t('dashboard.table.percentTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                        {t('dashboard.rankingEmpty')}
                      </td>
                    </tr>
                  ) : (
                    ranking.map((item, idx) => (
                      <tr key={`${item.cantico}-${idx}`} className="border-b border-slate-100 transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          {idx < 3 ? (
                            <Trophy
                              className={`h-5 w-5 ${
                                idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-amber-600'
                              }`}
                            />
                          ) : (
                            <span className="text-slate-500">{idx + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{item.cantico}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{item.total}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatPercent((item.total / totalExecucoes) * 100)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
