'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Edit3,
  MapPin,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import type { Locale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { getStoredChurchId } from '@/lib/church-utils';

type Evento = {
  id: string;
  titulo: string;
  data: string;
  hora?: string | null;
  local?: string | null;
  descricao: string;
  imagemUrl?: string | null;
  responsavel?: string | null;
  ativo?: boolean;
  ordem?: number;
};

type FormState = {
  id: string | null;
  titulo: string;
  data: string;
  hora: string;
  local: string;
  descricao: string;
  imagemUrl: string;
  responsavel: string;
  ativo: boolean;
};

const FORM_INICIAL: FormState = {
  id: null,
  titulo: '',
  data: new Date().toISOString().split('T')[0],
  hora: '',
  local: '',
  descricao: '',
  imagemUrl: '',
  responsavel: '',
  ativo: true,
};

const TEXTOS = {
  pt: {
    heroEyebrow: 'Eventos da igreja',
    title: 'O que vem a seguir',
    backHome: 'Voltar para a página inicial',
    subtitle: 'Conferências, encontros e datas especiais num só lugar.',
    items: 'eventos',
    newEvent: 'Novo evento',
    loadErrorFallback: 'Erro ao carregar eventos.',
    saveErrorFallback: 'Erro ao salvar evento.',
    editEvent: 'Editar evento',
    closeForm: 'Fechar formulário',
    titleField: 'Título',
    dateField: 'Data',
    timeField: 'Horário',
    locationField: 'Local',
    responsibleField: 'Responsável',
    imageField: 'Imagem (link)',
    imagePlaceholder: 'Opcional',
    descriptionField: 'Descrição',
    published: 'Publicado',
    saving: 'Salvando...',
    saveEvent: 'Salvar evento',
    searchPlaceholder: 'Buscar por título ou local',
    loadingEvents: 'Carregando eventos...',
    draft: 'Rascunho',
    edit: 'Editar',
    emptyTitle: 'Nenhum evento encontrado',
    emptyDescription: 'Tente outra busca, ou cadastre o primeiro evento.',
  },
  es: {
    heroEyebrow: 'Eventos de la iglesia',
    title: 'Lo que viene',
    backHome: 'Volver a la página inicial',
    subtitle: 'Conferencias, encuentros y fechas especiales en un solo lugar.',
    items: 'eventos',
    newEvent: 'Nuevo evento',
    loadErrorFallback: 'Error al cargar eventos.',
    saveErrorFallback: 'Error al guardar evento.',
    editEvent: 'Editar evento',
    closeForm: 'Cerrar formulario',
    titleField: 'Título',
    dateField: 'Fecha',
    timeField: 'Horario',
    locationField: 'Lugar',
    responsibleField: 'Responsable',
    imageField: 'Imagen (enlace)',
    imagePlaceholder: 'Opcional',
    descriptionField: 'Descripción',
    published: 'Publicado',
    saving: 'Guardando...',
    saveEvent: 'Guardar evento',
    searchPlaceholder: 'Buscar por título o lugar',
    loadingEvents: 'Cargando eventos...',
    draft: 'Borrador',
    edit: 'Editar',
    emptyTitle: 'No se encontraron eventos',
    emptyDescription: 'Intenta otra búsqueda, o registra el primer evento.',
  },
  en: {
    heroEyebrow: 'Church events',
    title: "What's coming up",
    backHome: 'Back to home page',
    subtitle: 'Conferences, gatherings and special dates in one place.',
    items: 'events',
    newEvent: 'New event',
    loadErrorFallback: 'Error loading events.',
    saveErrorFallback: 'Error saving event.',
    editEvent: 'Edit event',
    closeForm: 'Close form',
    titleField: 'Title',
    dateField: 'Date',
    timeField: 'Time',
    locationField: 'Location',
    responsibleField: 'Responsible',
    imageField: 'Image (link)',
    imagePlaceholder: 'Optional',
    descriptionField: 'Description',
    published: 'Published',
    saving: 'Saving...',
    saveEvent: 'Save event',
    searchPlaceholder: 'Search by title or location',
    loadingEvents: 'Loading events...',
    draft: 'Draft',
    edit: 'Edit',
    emptyTitle: 'No events found',
    emptyDescription: 'Try another search, or register the first event.',
  },
} satisfies Record<Locale, Record<string, unknown>>;

function getTextos(locale: Locale) {
  return TEXTOS[locale] || TEXTOS.pt;
}

function formatarData(data: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${data}T00:00:00`));
}

function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function EventosPage() {
  const locale = useLocale();
  const textos = getTextos(locale);
  const { user } = useAuth();
  const { permissoes } = usePermissions();
  const podeEditar = Boolean(user && permissoes.podeGerenciarEventos);

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const carregarEventos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams();
      const igrejaId = getStoredChurchId();
      if (igrejaId) params.set('igreja_id', igrejaId);
      if (podeEditar) {
        params.set('incluir_inativos', 'true');
        params.set('incluir_passados', 'true');
      }

      const response = await fetch(`/api/eventos?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || textos.loadErrorFallback);
      }

      setEventos((data.eventos || []) as Evento[]);
    } catch (error: any) {
      console.error('Erro ao carregar eventos:', error);
      setErro(error.message || textos.loadErrorFallback);
    } finally {
      setCarregando(false);
    }
  }, [podeEditar, textos]);

  useEffect(() => {
    void carregarEventos();
  }, [carregarEventos]);

  const eventosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());
    if (!termo) return eventos;

    return eventos.filter((evento) => {
      const conteudo = normalizarTexto([evento.titulo, evento.local || '', evento.descricao].join(' '));
      return conteudo.includes(termo);
    });
  }, [busca, eventos]);

  const abrirNovo = () => {
    setForm(FORM_INICIAL);
    setFormAberto(true);
  };

  const abrirEdicao = (evento: Evento) => {
    setForm({
      id: evento.id,
      titulo: evento.titulo,
      data: evento.data,
      hora: evento.hora || '',
      local: evento.local || '',
      descricao: evento.descricao,
      imagemUrl: evento.imagemUrl || '',
      responsavel: evento.responsavel || '',
      ativo: evento.ativo ?? true,
    });
    setFormAberto(true);
  };

  const salvarEvento = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const igrejaId = getStoredChurchId();
      const response = await fetch('/api/eventos', {
        method: form.id ? 'PATCH' : 'POST',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: form.id,
          igreja_id: igrejaId,
          titulo: form.titulo,
          data_evento: form.data,
          hora: form.hora || null,
          local: form.local,
          descricao: form.descricao,
          imagem_url: form.imagemUrl,
          responsavel: form.responsavel,
          ativo: form.ativo,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || textos.saveErrorFallback);
      }

      const eventoSalvo = data.evento as Evento;
      setEventos((atuais) => {
        if (form.id) {
          return atuais.map((item) => (item.id === eventoSalvo.id ? eventoSalvo : item));
        }
        return [eventoSalvo, ...atuais];
      });
      setFormAberto(false);
      setForm(FORM_INICIAL);
    } catch (error: any) {
      console.error('Erro ao salvar evento:', error);
      setErro(error.message || textos.saveErrorFallback);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            {textos.backHome}
          </Link>
        </div>

        <section className="mb-8 rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-sm font-medium text-emerald-50 ring-1 ring-white/15">
                <CalendarDays className="h-4 w-4" />
                {textos.heroEyebrow}
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{textos.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">{textos.subtitle}</p>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-80">
              <div className="rounded-xl bg-white/10 p-3 text-center ring-1 ring-white/15">
                <p className="text-2xl font-semibold">{eventos.length}</p>
                <p className="mt-1 text-xs text-emerald-50">{textos.items}</p>
              </div>

              {podeEditar ? (
                <button
                  type="button"
                  onClick={abrirNovo}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                >
                  <Plus className="h-4 w-4" />
                  {textos.newEvent}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {erro ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {erro}
          </div>
        ) : null}

        {formAberto && podeEditar ? (
          <section className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-950">
                {form.id ? textos.editEvent : textos.newEvent}
              </h2>
              <button
                type="button"
                onClick={() => setFormAberto(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={textos.closeForm}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={salvarEvento} className="grid gap-4 lg:grid-cols-2">
              <label className="block lg:col-span-2">
                <span className="text-sm font-semibold text-slate-700">{textos.titleField}</span>
                <input
                  required
                  value={form.titulo}
                  onChange={(event) => setForm({ ...form, titulo: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.dateField}</span>
                <input
                  required
                  type="date"
                  value={form.data}
                  onChange={(event) => setForm({ ...form, data: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.timeField}</span>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(event) => setForm({ ...form, hora: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.locationField}</span>
                <input
                  value={form.local}
                  onChange={(event) => setForm({ ...form, local: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.responsibleField}</span>
                <input
                  value={form.responsavel}
                  onChange={(event) => setForm({ ...form, responsavel: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block lg:col-span-2">
                <span className="text-sm font-semibold text-slate-700">{textos.imageField}</span>
                <input
                  value={form.imagemUrl}
                  onChange={(event) => setForm({ ...form, imagemUrl: event.target.value })}
                  placeholder={textos.imagePlaceholder}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block lg:col-span-2">
                <span className="text-sm font-semibold text-slate-700">{textos.descriptionField}</span>
                <textarea
                  rows={3}
                  value={form.descricao}
                  onChange={(event) => setForm({ ...form, descricao: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <div className="flex flex-col gap-3 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                  />
                  {textos.published}
                </label>

                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {salvando ? textos.saving : textos.saveEvent}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder={textos.searchPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </section>

        {carregando ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-700" />
            <p className="mt-4 text-sm text-slate-600">{textos.loadingEvents}</p>
          </section>
        ) : eventosFiltrados.length > 0 ? (
          <section className="grid gap-5 lg:grid-cols-2">
            {eventosFiltrados.map((evento) => (
              <article
                key={evento.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {evento.imagemUrl ? (
                  <div
                    className="aspect-video bg-slate-900"
                    style={{
                      backgroundImage: `url("${evento.imagemUrl}")`,
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                    }}
                  />
                ) : null}

                <div className="p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatarData(evento.data, locale)}
                    </span>
                    {evento.hora ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        <Clock3 className="h-3.5 w-3.5" />
                        {evento.hora.slice(0, 5)}
                      </span>
                    ) : null}
                    {evento.local ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        <MapPin className="h-3.5 w-3.5" />
                        {evento.local}
                      </span>
                    ) : null}
                    {podeEditar && evento.ativo === false ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        {textos.draft}
                      </span>
                    ) : null}
                  </div>

                  <h2 className="text-xl font-bold text-slate-950">{evento.titulo}</h2>
                  {evento.descricao ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">{evento.descricao}</p>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-slate-500">{evento.responsavel || ''}</p>
                    {podeEditar ? (
                      <button
                        type="button"
                        onClick={() => abrirEdicao(evento)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Edit3 className="h-4 w-4" />
                        {textos.edit}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{textos.emptyTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">{textos.emptyDescription}</p>
          </section>
        )}
      </main>
    </div>
  );
}
