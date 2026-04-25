'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCcw,
  Send,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage, resolveApiSuccessMessage } from '@/lib/api-feedback';
import { getIntlLocale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';

type LeadStatus = 'novo' | 'em_contato' | 'demo_agendada' | 'convertido' | 'perdido';
type StatusFiltro = 'todos' | LeadStatus;

type OikosLead = {
  id: string;
  nome: string;
  contato: string;
  mensagem: string | null;
  igreja: string | null;
  funcao: string | null;
  locale: string | null;
  origem: string;
  status: LeadStatus;
  criado_em: string;
  atualizado_em: string;
};

type Contadores = Record<LeadStatus, number> & { total: number };

const STATUS_BADGES: Record<LeadStatus, string> = {
  novo: 'bg-amber-100 text-amber-900 border border-amber-200',
  em_contato: 'bg-blue-100 text-blue-900 border border-blue-200',
  demo_agendada: 'bg-purple-100 text-purple-900 border border-purple-200',
  convertido: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  perdido: 'bg-slate-100 text-slate-700 border border-slate-200',
};

const STATUS_SELECT_CLASSES: Record<LeadStatus, string> = {
  novo: 'border-amber-200 bg-amber-50 text-amber-900',
  em_contato: 'border-blue-200 bg-blue-50 text-blue-900',
  demo_agendada: 'border-purple-200 bg-purple-50 text-purple-900',
  convertido: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  perdido: 'border-slate-200 bg-slate-50 text-slate-800',
};

function resolveContactHref(contato: string) {
  const trimmed = contato.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return `mailto:${trimmed}`;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) {
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${normalized}`;
  }

  return null;
}

export default function AdminOikosLeadsPage() {
  const router = useRouter();
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, isSuperAdmin } = usePermissions();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );

  const [leads, setLeads] = useState<OikosLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('novo');
  const [leadAtualizandoId, setLeadAtualizandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [contadores, setContadores] = useState<Contadores>({
    total: 0,
    novo: 0,
    em_contato: 0,
    demo_agendada: 0,
    convertido: 0,
    perdido: 0,
  });

  const loading = authLoading || permLoading;
  const statusLabels: Record<StatusFiltro, string> = useMemo(
    () => ({
      todos: tr('Todos', 'Todos', 'All'),
      novo: tr('Novos', 'Nuevos', 'New'),
      em_contato: tr('Em contato', 'En contacto', 'Contacting'),
      demo_agendada: tr('Demo agendada', 'Demo agendada', 'Demo scheduled'),
      convertido: tr('Convertidos', 'Convertidos', 'Converted'),
      perdido: tr('Perdidos', 'Perdidos', 'Lost'),
    }),
    [tr]
  );

  const formatarData = useCallback(
    (value: string) =>
      new Date(value).toLocaleString(intlLocale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [intlLocale]
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!isSuperAdmin) {
      router.push('/admin');
    }
  }, [loading, user, isSuperAdmin, router]);

  const carregarLeads = useCallback(async () => {
    if (!user || !isSuperAdmin) return;

    try {
      setLoadingLeads(true);
      setErro(null);

      const params = new URLSearchParams();
      if (statusFiltro !== 'todos') {
        params.set('status', statusFiltro);
      }

      const response = await fetch(`/api/admin/oikos-leads?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(
            locale,
            data,
            tr(
              'Erro ao carregar leads.',
              'Error al cargar leads.',
              'Error loading leads.'
            )
          )
        );
      }

      setLeads(data.leads || []);
      setContadores(
        data.contadores || {
          total: 0,
          novo: 0,
          em_contato: 0,
          demo_agendada: 0,
          convertido: 0,
          perdido: 0,
        }
      );
    } catch (error: any) {
      setErro(
        error.message ||
          tr(
            'Erro ao carregar leads.',
            'Error al cargar leads.',
            'Error loading leads.'
          )
      );
    } finally {
      setLoadingLeads(false);
    }
  }, [user, isSuperAdmin, statusFiltro, tr, locale]);

  useEffect(() => {
    if (!loading && user && isSuperAdmin) {
      carregarLeads();
    }
  }, [loading, user, isSuperAdmin, carregarLeads]);

  async function atualizarStatus(leadId: string, novoStatus: LeadStatus) {
    try {
      setLeadAtualizandoId(leadId);
      setMensagem(null);
      setErro(null);

      const response = await fetch('/api/admin/oikos-leads', {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: leadId,
          status: novoStatus,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(
            locale,
            data,
            tr(
              'Erro ao atualizar lead.',
              'Error al actualizar el lead.',
              'Error updating lead.'
            )
          )
        );
      }

      setMensagem(
        resolveApiSuccessMessage(
          locale,
          data,
          tr(
            'Status do lead atualizado.',
            'Estado del lead actualizado.',
            'Lead status updated.'
          )
        )
      );

      setLeads((atuais) =>
        statusFiltro === 'todos'
          ? atuais.map((lead) => (lead.id === leadId ? { ...lead, status: novoStatus } : lead))
          : atuais.filter((lead) => lead.id !== leadId)
      );
      carregarLeads();
    } catch (error: any) {
      setErro(
        error.message ||
          tr(
            'Erro ao atualizar lead.',
            'Error al actualizar el lead.',
            'Error updating lead.'
          )
      );
    } finally {
      setLeadAtualizandoId(null);
    }
  }

  if (loading || (!user && !loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-700" />
          <p className="mt-4 text-slate-600">{tr('Carregando...', 'Cargando...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  const cards: Array<{ status: StatusFiltro; value: number; icon: typeof Clock3 }> = [
    { status: 'novo', value: contadores.novo, icon: Clock3 },
    { status: 'em_contato', value: contadores.em_contato, icon: Phone },
    { status: 'demo_agendada', value: contadores.demo_agendada, icon: Send },
    { status: 'convertido', value: contadores.convertido, icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr('Voltar ao admin', 'Volver al admin', 'Back to admin')}
        </button>

        <section className="rounded-2xl bg-gradient-to-br from-slate-950 to-emerald-950 p-5 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-100">
                <MessageSquareText className="h-4 w-4" />
                OIKOS Hub
              </p>
              <h1 className="text-3xl font-black sm:text-4xl">
                {tr('Leads comerciais', 'Leads comerciales', 'Sales leads')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                {tr(
                  'Acompanhe quem pediu demonstração pela landing e mova cada contato pelo funil.',
                  'Acompaña quién pidió demostración por la landing y mueve cada contacto por el embudo.',
                  'Track demo requests from the landing page and move each contact through the funnel.'
                )}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-100">
                {tr('Total no funil', 'Total en el embudo', 'Total in funnel')}
              </p>
              <p className="mt-1 text-3xl font-black">{contadores.total}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const active = statusFiltro === card.status;
            return (
              <button
                key={card.status}
                type="button"
                onClick={() => setStatusFiltro(card.status)}
                className={`rounded-xl border p-4 text-left shadow-sm transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <Icon className="mb-3 h-5 w-5 text-emerald-700" />
                <p className="text-sm font-bold text-slate-600">{statusLabels[card.status]}</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{card.value}</p>
              </button>
            );
          })}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['novo', 'em_contato', 'demo_agendada', 'convertido', 'perdido', 'todos'] as StatusFiltro[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFiltro(status)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      statusFiltro === status
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {statusLabels[status]}
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={carregarLeads}
              disabled={loadingLeads}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${loadingLeads ? 'animate-spin' : ''}`} />
              {tr('Atualizar', 'Actualizar', 'Refresh')}
            </button>
          </div>

          {erro ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {erro}
            </div>
          ) : null}
          {mensagem ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {mensagem}
            </div>
          ) : null}

          <div className="mt-5">
            {loadingLeads ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-700" />
                  <p className="mt-3 text-sm text-slate-500">
                    {tr('Carregando leads...', 'Cargando leads...', 'Loading leads...')}
                  </p>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <MessageSquareText className="mx-auto h-10 w-10 text-slate-400" />
                <h2 className="mt-3 text-lg font-black text-slate-900">
                  {tr('Nenhum lead neste status', 'Ningún lead en este estado', 'No leads in this status')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {tr(
                    'Quando alguém preencher a landing, o contato aparece aqui.',
                    'Cuando alguien complete la landing, el contacto aparecerá aquí.',
                    'When someone fills out the landing page, the contact appears here.'
                  )}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {leads.map((lead) => {
                  const contactHref = resolveContactHref(lead.contato);

                  return (
                    <article key={lead.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-slate-950">{lead.nome}</h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGES[lead.status]}`}>
                              {statusLabels[lead.status]}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                            <p className="flex min-w-0 items-center gap-2">
                              <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">{lead.funcao || tr('Função não informada', 'Función no informada', 'Role not provided')}</span>
                            </p>
                            <p className="flex min-w-0 items-center gap-2">
                              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="truncate">{lead.igreja || tr('Igreja não informada', 'Iglesia no informada', 'Church not provided')}</span>
                            </p>
                            <p className="flex min-w-0 items-center gap-2">
                              {lead.contato.includes('@') ? (
                                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                              ) : (
                                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                              )}
                              {contactHref ? (
                                <a
                                  href={contactHref}
                                  target={contactHref.startsWith('http') ? '_blank' : undefined}
                                  rel={contactHref.startsWith('http') ? 'noreferrer' : undefined}
                                  className="truncate font-bold text-emerald-700 hover:text-emerald-900"
                                >
                                  {lead.contato}
                                </a>
                              ) : (
                                <span className="truncate">{lead.contato}</span>
                              )}
                            </p>
                            <p className="flex min-w-0 items-center gap-2">
                              <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                              <span>{formatarData(lead.criado_em)}</span>
                            </p>
                          </div>
                          {lead.mensagem ? (
                            <p className="mt-4 rounded-lg bg-white p-3 text-sm leading-6 text-slate-700">
                              {lead.mensagem}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:min-w-56">
                          <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            {tr('Status', 'Estado', 'Status')}
                          </label>
                          <select
                            value={lead.status}
                            disabled={leadAtualizandoId === lead.id}
                            onChange={(event) => atualizarStatus(lead.id, event.target.value as LeadStatus)}
                            className={`rounded-lg border px-3 py-2 text-sm font-bold outline-none ${STATUS_SELECT_CLASSES[lead.status]}`}
                          >
                            {(['novo', 'em_contato', 'demo_agendada', 'convertido', 'perdido'] as LeadStatus[]).map(
                              (status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status]}
                                </option>
                              )
                            )}
                          </select>
                          {contactHref ? (
                            <a
                              href={contactHref}
                              target={contactHref.startsWith('http') ? '_blank' : undefined}
                              rel={contactHref.startsWith('http') ? 'noreferrer' : undefined}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                            >
                              {tr('Abrir contato', 'Abrir contacto', 'Open contact')}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
