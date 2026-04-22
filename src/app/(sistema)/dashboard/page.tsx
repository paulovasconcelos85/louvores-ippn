'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Church,
  HeartHandshake,
  Home,
  Music,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { useLocale, useTranslations } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/config';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY } from '@/lib/church-utils';
import { resolveApiErrorMessage } from '@/lib/api-feedback';

type DashboardResponse = {
  igreja: IgrejaSelecionavel | null;
  availableYears: number[];
  selectedYear: number | null;
  overview: {
    totalRegistered: number;
    totalPeople: number;
    inactiveRecords: number;
    activeMembers: number;
    congregants: number;
    visitors: number;
    families: number;
    peopleInFamilies: number;
    withAccess: number;
    servingPeople: number;
    averageAge: number | null;
  };
  breakdowns: {
    status: Array<{ status: string; total: number }>;
    age: Array<{ faixa: string; total: number }>;
    roles: Array<{ cargo: string; total: number }>;
  };
  activity: {
    servicesInYear: number;
    latestServiceDate: string | null;
    monthlyServices: Array<{ month: number; total: number }>;
    recentServiceDays: Array<{ date: string; total: number }>;
  };
  music: {
    totalExecutions: number;
    uniqueSongs: number;
    topKey: string | null;
    averageSongsPerService: number;
    mostPlayedSong: string | null;
    topSongs: Array<{ song: string; total: number }>;
    monthlyExecutions: Array<{ month: number; total: number }>;
    topKeys: Array<{ key: string; total: number }>;
    recentSongs: Array<{ song: string; lastDate: string; daysAgo: number }>;
  };
};

const STATUS_COLORS: Record<string, string> = {
  ativo: '#0f766e',
  congregado: '#2563eb',
  visitante: '#d97706',
  afastado: '#7c3aed',
  falecido: '#64748b',
  sem_status: '#94a3b8',
};

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/70 backdrop-blur">
      <div className={`mb-3 inline-flex rounded-2xl p-2 ${accent}`}>{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-200/70 backdrop-blur md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">{icon}</div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ServiceRoleCard({
  label,
  total,
  note,
  accentClass,
}: {
  label: string;
  total: number;
  note: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className={`mb-3 h-1.5 w-14 rounded-full ${accentClass}`} />
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{total}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const intlLocale = getIntlLocale(locale);
  const { user, loading: authLoading } = useAuth();

  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { month: 'short' }),
    [intlLocale]
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' }),
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
  const percentFormatter = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [intlLocale]
  );

  const humanizeKey = (value: string) =>
    value
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ativo: t('dashboard.status.ativo'),
      congregado: t('dashboard.status.congregado'),
      visitante: t('dashboard.status.visitante'),
      afastado: t('dashboard.status.afastado'),
      falecido: t('dashboard.status.falecido'),
      sem_status: t('dashboard.status.sem_status'),
    };

    return labels[status] || humanizeKey(status);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      membro: t('dashboard.roles.membro'),
      musico: t('dashboard.roles.musico'),
      staff: t('dashboard.roles.staff'),
      seminarista: t('dashboard.roles.seminarista'),
      diacono: t('dashboard.roles.diacono'),
      presbitero: t('dashboard.roles.presbitero'),
      pastor: t('dashboard.roles.pastor'),
      admin: t('dashboard.roles.admin'),
      superadmin: t('dashboard.roles.superadmin'),
    };

    return labels[role] || humanizeKey(role);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user?.id) {
      setIgrejas([]);
      setIgrejaAtualId(null);
      return;
    }

    let active = true;

    const loadChurches = async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            resolveApiErrorMessage(locale, payload, t('header.loadChurchesError'))
          );
        }

        if (!active) return;

        const list = (payload.igrejas || []) as IgrejaSelecionavel[];
        const churchFromUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const preferredChurch =
          typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null;
        const resolvedChurchId =
          [churchFromUrl, preferredChurch, payload.igrejaAtualId, list[0]?.id || null]
            .filter(Boolean)
            .find((id) => list.some((church) => church.id === id)) || null;

        setIgrejas(list);
        setIgrejaAtualId(resolvedChurchId);
      } catch (loadError) {
        console.error('Erro ao carregar igrejas do dashboard:', loadError);
        if (!active) return;
        setIgrejas([]);
        setIgrejaAtualId(null);
      }
    };

    void loadChurches();

    return () => {
      active = false;
    };
  }, [locale, t, user?.id]);

  useEffect(() => {
    if (!igrejaAtualId || typeof window === 'undefined') return;
    window.localStorage.setItem(CHURCH_STORAGE_KEY, igrejaAtualId);
  }, [igrejaAtualId]);

  useEffect(() => {
    if (!user?.id) {
      setSummary(null);
      setLoading(false);
      return;
    }

    if (!igrejaAtualId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ igreja_id: igrejaAtualId });
        if (selectedYear) {
          params.set('year', String(selectedYear));
        }

        const response = await fetch(`/api/dashboard?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            resolveApiErrorMessage(locale, payload, t('dashboard.errors.load'))
          );
        }

        if (!active) return;

        const nextSummary = payload as DashboardResponse;
        setSummary(nextSummary);

        if (nextSummary.selectedYear !== selectedYear) {
          setSelectedYear(nextSummary.selectedYear);
        }
      } catch (loadError) {
        if (controller.signal.aborted || !active) return;
        console.error('Erro ao carregar resumo do dashboard:', loadError);
        setSummary(null);
        setError(
          loadError instanceof Error ? loadError.message : t('dashboard.errors.load')
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      active = false;
      controller.abort();
    };
  }, [igrejaAtualId, locale, selectedYear, t, user?.id]);

  const igrejaAtual =
    igrejas.find((igreja) => igreja.id === igrejaAtualId) || summary?.igreja || null;
  const yearOptions = summary?.availableYears || [];
  const activeRecords = summary?.overview.totalPeople || 0;
  const selectedYearLabel = summary?.selectedYear || selectedYear;

  const statusData = (summary?.breakdowns.status || []).map((item) => ({
    ...item,
    name: getStatusLabel(item.status),
    fill: STATUS_COLORS[item.status] || STATUS_COLORS.sem_status,
  }));

  const ageData = summary?.breakdowns.age || [];

  const serviceRoleTotals = new Map(
    (summary?.breakdowns.roles || []).map((item) => [item.cargo, item.total])
  );

  const serviceRoleCards = [
    {
      cargo: 'musico',
      label: getRoleLabel('musico'),
      total: serviceRoleTotals.get('musico') || 0,
      note: t('dashboard.roleNotes.musico'),
      accentClass: 'bg-emerald-500',
    },
    {
      cargo: 'staff',
      label: getRoleLabel('staff'),
      total: serviceRoleTotals.get('staff') || 0,
      note: t('dashboard.roleNotes.staff'),
      accentClass: 'bg-sky-500',
    },
    {
      cargo: 'seminarista',
      label: getRoleLabel('seminarista'),
      total: serviceRoleTotals.get('seminarista') || 0,
      note: t('dashboard.roleNotes.seminarista'),
      accentClass: 'bg-amber-500',
    },
    {
      cargo: 'diacono',
      label: getRoleLabel('diacono'),
      total: serviceRoleTotals.get('diacono') || 0,
      note: t('dashboard.roleNotes.diacono'),
      accentClass: 'bg-violet-500',
    },
    {
      cargo: 'presbitero',
      label: getRoleLabel('presbitero'),
      total: serviceRoleTotals.get('presbitero') || 0,
      note: t('dashboard.roleNotes.presbitero'),
      accentClass: 'bg-rose-500',
    },
    {
      cargo: 'pastor',
      label: getRoleLabel('pastor'),
      total: serviceRoleTotals.get('pastor') || 0,
      note: t('dashboard.roleNotes.pastor'),
      accentClass: 'bg-slate-700',
    },
    {
      cargo: 'admin',
      label: t('dashboard.roles.adminAndSuperadmin'),
      total: (serviceRoleTotals.get('admin') || 0) + (serviceRoleTotals.get('superadmin') || 0),
      note: t('dashboard.roleNotes.admin'),
      accentClass: 'bg-indigo-500',
    },
  ];

  const monthlyServicesData = useMemo(
    () =>
      (summary?.activity.monthlyServices || []).map((item) => ({
        ...item,
        label: monthFormatter.format(new Date(2024, item.month - 1, 1)).replace(/\.$/, ''),
      })),
    [monthFormatter, summary?.activity.monthlyServices]
  );

  const recentServiceDays = summary?.activity.recentServiceDays || [];
  const topSongs = summary?.music.topSongs || [];
  const topKeys = summary?.music.topKeys || [];
  const recentSongs = summary?.music.recentSongs || [];

  const monthlyExecutionsData = useMemo(
    () =>
      (summary?.music.monthlyExecutions || []).map((item) => ({
        ...item,
        label: monthFormatter.format(new Date(2024, item.month - 1, 1)).replace(/\.$/, ''),
      })),
    [monthFormatter, summary?.music.monthlyExecutions]
  );

  const accessCoverage =
    activeRecords > 0
      ? percentFormatter.format((summary?.overview.withAccess || 0) / activeRecords)
      : percentFormatter.format(0);
  const servingCoverage =
    activeRecords > 0
      ? percentFormatter.format((summary?.overview.servingPeople || 0) / activeRecords)
      : percentFormatter.format(0);
  const familyCoverage =
    activeRecords > 0
      ? percentFormatter.format((summary?.overview.peopleInFamilies || 0) / activeRecords)
      : percentFormatter.format(0);

  const formatDate = (date: string | null) =>
    date ? dateFormatter.format(new Date(`${date}T00:00:00`)) : t('dashboard.hero.noService');
  const formatDaysAgo = (days: number) => {
    if (days <= 0) return t('dashboard.music.today');
    if (days === 1) return t('dashboard.music.yesterday');
    return t('dashboard.music.daysAgo', { count: days });
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <section className="overflow-hidden rounded-[28px] border border-white/80 bg-slate-950 text-white shadow-xl shadow-slate-900/10">
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)] md:p-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-100">
                <Sparkles className="h-4 w-4 text-emerald-300" />
                {t('dashboard.kicker')}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {t('dashboard.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                {igrejaAtual
                  ? t('dashboard.subtitleWithChurch', {
                      church: igrejaAtual.sigla || igrejaAtual.nome,
                    })
                  : t('dashboard.subtitleGeneric')}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {t('dashboard.description')}
              </p>
              {summary?.overview.inactiveRecords ? (
                <p className="mt-4 text-sm text-amber-200">
                  {t('dashboard.notes.inactiveRecords', {
                    count: summary.overview.inactiveRecords,
                  })}
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur md:p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <Church className="h-4 w-4" />
                    {t('dashboard.filters.church')}
                  </label>
                  <select
                    value={igrejaAtualId || ''}
                    onChange={(event) => {
                      setIgrejaAtualId(event.target.value || null);
                      setSelectedYear(null);
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-0 transition focus:border-emerald-400"
                  >
                    <option value="">{t('dashboard.filters.selectChurch')}</option>
                    {igrejas.map((igreja) => (
                      <option key={igreja.id} value={igreja.id}>
                        {igreja.sigla || igreja.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                    <CalendarDays className="h-4 w-4" />
                    {t('dashboard.filters.year')}
                  </label>
                  <select
                    value={selectedYearLabel || ''}
                    onChange={(event) =>
                      setSelectedYear(event.target.value ? Number(event.target.value) : null)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-0 transition focus:border-emerald-400"
                  >
                    <option value="">{t('dashboard.filters.allYears')}</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-300">
                    {t('dashboard.hero.servicesInYear', { year: selectedYearLabel || '-' })}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {summary?.activity.servicesInYear ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-300">
                    {t('dashboard.hero.lastService')}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {formatDate(summary?.activity.latestServiceDate || null)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-300">
                    {t('dashboard.hero.accessCoverage')}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{accessCoverage}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="flex min-h-[320px] flex-col items-center justify-center rounded-[28px] border border-white/80 bg-white/90 text-center shadow-sm shadow-slate-200/70">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
            <p className="mt-4 text-sm text-slate-500">{t('dashboard.loading')}</p>
          </section>
        ) : !igrejaAtualId || !summary ? (
          <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 text-center shadow-sm shadow-slate-200/70">
            <h2 className="text-xl font-semibold text-slate-900">
              {error ? t('dashboard.errorTitle') : t('dashboard.empty.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              {error || t('dashboard.empty.description')}
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={<Users className="h-5 w-5 text-slate-700" />}
                label={t('dashboard.cards.totalRegistered')}
                value={summary.overview.totalRegistered}
                accent="bg-slate-100"
              />
              <MetricCard
                icon={<Users className="h-5 w-5 text-cyan-700" />}
                label={t('dashboard.cards.activeRecords')}
                value={summary.overview.totalPeople}
                accent="bg-cyan-100"
              />
              <MetricCard
                icon={<Church className="h-5 w-5 text-emerald-700" />}
                label={t('dashboard.cards.activeMembers')}
                value={summary.overview.activeMembers}
                accent="bg-emerald-100"
              />
              <MetricCard
                icon={<Home className="h-5 w-5 text-sky-700" />}
                label={t('dashboard.cards.families')}
                value={summary.overview.families}
                accent="bg-sky-100"
              />
              <MetricCard
                icon={<UserRoundCheck className="h-5 w-5 text-amber-700" />}
                label={t('dashboard.cards.congregants')}
                value={summary.overview.congregants}
                accent="bg-amber-100"
              />
              <MetricCard
                icon={<Activity className="h-5 w-5 text-orange-700" />}
                label={t('dashboard.cards.visitors')}
                value={summary.overview.visitors}
                accent="bg-orange-100"
              />
              <MetricCard
                icon={<HeartHandshake className="h-5 w-5 text-violet-700" />}
                label={t('dashboard.cards.servingPeople')}
                value={summary.overview.servingPeople}
                accent="bg-violet-100"
              />
              <MetricCard
                icon={<ShieldCheck className="h-5 w-5 text-indigo-700" />}
                label={t('dashboard.cards.withAccess')}
                value={summary.overview.withAccess}
                accent="bg-indigo-100"
              />
              <MetricCard
                icon={<CalendarDays className="h-5 w-5 text-blue-700" />}
                label={t('dashboard.cards.servicesInYear', { year: selectedYearLabel || '-' })}
                value={summary.activity.servicesInYear}
                accent="bg-blue-100"
              />
              <MetricCard
                icon={<TrendingUp className="h-5 w-5 text-rose-700" />}
                label={t('dashboard.cards.averageAge')}
                value={
                  summary.overview.averageAge === null
                    ? t('dashboard.cards.noAverageAge')
                    : `${decimalFormatter.format(summary.overview.averageAge)} ${t('dashboard.units.years')}`
                }
                accent="bg-rose-100"
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={<Music className="h-5 w-5 text-emerald-700" />}
                label={t('dashboard.music.cards.totalExecutions')}
                value={summary.music.totalExecutions}
                accent="bg-emerald-100"
              />
              <MetricCard
                icon={<Music className="h-5 w-5 text-sky-700" />}
                label={t('dashboard.music.cards.uniqueSongs')}
                value={summary.music.uniqueSongs}
                accent="bg-sky-100"
              />
              <MetricCard
                icon={<TrendingUp className="h-5 w-5 text-violet-700" />}
                label={t('dashboard.music.cards.averagePerService')}
                value={decimalFormatter.format(summary.music.averageSongsPerService)}
                accent="bg-violet-100"
              />
              <MetricCard
                icon={<BarChart3 className="h-5 w-5 text-amber-700" />}
                label={t('dashboard.music.cards.topKey')}
                value={summary.music.topKey || t('dashboard.music.emptyDash')}
                accent="bg-amber-100"
              />
              <MetricCard
                icon={<Sparkles className="h-5 w-5 text-rose-700" />}
                label={t('dashboard.music.cards.mostPlayed')}
                value={summary.music.mostPlayedSong || t('dashboard.music.emptyDash')}
                accent="bg-rose-100"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <SectionCard title={t('dashboard.sections.status')} icon={<Users className="h-5 w-5" />}>
                {statusData.length === 0 ? (
                  <EmptyChartState message={t('dashboard.charts.noPeopleData')} />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={statusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                        {statusData.map((entry) => (
                          <Cell key={entry.status} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              <SectionCard title={t('dashboard.sections.age')} icon={<BarChart3 className="h-5 w-5" />}>
                {ageData.every((item) => item.total === 0) ? (
                  <EmptyChartState message={t('dashboard.charts.noPeopleData')} />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={ageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Bar dataKey="total" fill="#0f766e" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              <SectionCard
                title={t('dashboard.sections.servicesTrend')}
                icon={<CalendarDays className="h-5 w-5" />}
              >
                {monthlyServicesData.every((item) => item.total === 0) ? (
                  <EmptyChartState message={t('dashboard.charts.noActivityData')} />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlyServicesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#2563eb' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              <SectionCard
                title={t('dashboard.sections.roles')}
                icon={<HeartHandshake className="h-5 w-5" />}
              >
                {serviceRoleCards.every((item) => item.total === 0) ? (
                  <EmptyChartState message={t('dashboard.charts.noRolesData')} />
                ) : (
                  <div>
                    <p className="mb-4 text-sm leading-6 text-slate-500">
                      {t('dashboard.sections.rolesDescription', {
                        serving: summary.overview.servingPeople,
                        access: summary.overview.withAccess,
                      })}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {serviceRoleCards.map((item) => (
                        <ServiceRoleCard
                          key={item.cargo}
                          label={item.label}
                          total={item.total}
                          note={item.note}
                          accentClass={item.accentClass}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title={t('dashboard.music.sections.topSongs')}
                icon={<Music className="h-5 w-5" />}
              >
                {topSongs.length === 0 ? (
                  <EmptyChartState message={t('dashboard.music.noData')} />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topSongs}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="song" tick={{ fontSize: 11 }} angle={-18} textAnchor="end" height={70} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Bar dataKey="total" fill="#10b981" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              <SectionCard
                title={t('dashboard.music.sections.executionsTrend')}
                icon={<TrendingUp className="h-5 w-5" />}
              >
                {monthlyExecutionsData.every((item) => item.total === 0) ? (
                  <EmptyChartState message={t('dashboard.music.noData')} />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={monthlyExecutionsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#8b5cf6' }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              <SectionCard
                title={t('dashboard.music.sections.topKeys')}
                icon={<BarChart3 className="h-5 w-5" />}
              >
                {topKeys.length === 0 ? (
                  <EmptyChartState message={t('dashboard.music.noKeys')} />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topKeys}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Bar dataKey="total" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>

              <SectionCard
                title={t('dashboard.music.sections.recentSongs')}
                icon={<Sparkles className="h-5 w-5" />}
              >
                {recentSongs.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('dashboard.music.noRecentSongs')}</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {recentSongs.map((item) => (
                      <div
                        key={`${item.song}-${item.lastDate}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">{item.song}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDate(item.lastDate)}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                          {formatDaysAgo(item.daysAgo)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <SectionCard
                title={t('dashboard.sections.recentServices')}
                icon={<CalendarDays className="h-5 w-5" />}
              >
                {recentServiceDays.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('dashboard.list.noRecentServices')}</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {recentServiceDays.map((item) => (
                      <div
                        key={item.date}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {formatDate(item.date)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {t('dashboard.list.servicesOnDate', { count: item.total })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title={t('dashboard.sections.insights')} icon={<Sparkles className="h-5 w-5" />}>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('dashboard.insights.registryTitle')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {t('dashboard.insights.registryText', {
                        count: summary.overview.totalRegistered,
                        active: summary.overview.totalPeople,
                      })}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('dashboard.insights.accessTitle')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {t('dashboard.insights.accessText', {
                        percent: accessCoverage,
                        serving: servingCoverage,
                      })}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {t('dashboard.insights.familyTitle')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {t('dashboard.insights.familyText', {
                        percent: familyCoverage,
                        families: summary.overview.families,
                      })}
                    </p>
                  </div>
                </div>
              </SectionCard>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
