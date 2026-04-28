'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Church,
  Clock3,
  Edit3,
  ExternalLink,
  GraduationCap,
  Library,
  PlayCircle,
  Plus,
  Save,
  Search,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import type { Locale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { getStoredChurchId } from '@/lib/church-utils';

type RecursoCategoria = 'culto' | 'ebd' | 'estudo' | 'especial';

type RecursoMultimidia = {
  id: string;
  titulo: string;
  categoria: RecursoCategoria;
  data: string;
  descricao: string;
  responsavel?: string | null;
  youtubeUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  plataforma?: string | null;
  duracao?: string | null;
  ativo?: boolean;
  ordem?: number;
};

type FormState = {
  id: string | null;
  titulo: string;
  categoria: RecursoCategoria;
  data: string;
  descricao: string;
  responsavel: string;
  videoUrl: string;
  thumbnailUrl: string;
  plataforma: string;
  duracao: string;
  ativo: boolean;
};

const FORM_INICIAL: FormState = {
  id: null,
  titulo: '',
  categoria: 'culto',
  data: new Date().toISOString().split('T')[0],
  descricao: '',
  responsavel: '',
  videoUrl: '',
  thumbnailUrl: '',
  plataforma: 'youtube',
  duracao: '',
  ativo: true,
};

const categorias: Array<{
  id: RecursoCategoria | 'todos';
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'todos', icon: Library },
  { id: 'culto', icon: Church },
  { id: 'ebd', icon: GraduationCap },
  { id: 'estudo', icon: PlayCircle },
  { id: 'especial', icon: Video },
];

const TEXTOS = {
  pt: {
    modelos: {
      cultoTitulo: 'Culto Dominical',
      cultoDescricao: 'Gravação do culto para os irmãos acompanharem depois.',
      ebdTitulo: 'Escola Bíblica Dominical',
      ebdDescricao: 'Aula da EBD organizada por data e tema.',
      estudoTitulo: 'Estudo Bíblico',
      estudoDescricao: 'Estudo da semana para consulta dos membros.',
      igreja: 'Igreja',
    },
    categorias: {
      todos: 'Todos',
      culto: 'Cultos',
      ebd: 'EBD',
      estudo: 'Estudos',
      especial: 'Especiais',
    },
    categoriaSingular: {
      culto: 'Culto',
      ebd: 'EBD',
      estudo: 'Estudo',
      especial: 'Especial',
    },
    heroEyebrow: 'Recursos da igreja',
    title: 'Mídias para os irmãos',
    backHome: 'Voltar para a página inicial',
    subtitle:
      'Cultos, EBD, estudos e gravações reunidos em um só lugar para visitantes e membros acompanharem a vida da igreja.',
    items: 'itens',
    videos: 'vídeos',
    areas: 'áreas',
    newResource: 'Novo recurso',
    loadError:
      'Ainda não foi possível carregar os recursos do banco. Mostrando modelos iniciais.',
    loadErrorFallback: 'Erro ao carregar recursos.',
    saveErrorFallback: 'Erro ao salvar recurso.',
    editResource: 'Editar recurso',
    closeForm: 'Fechar formulário',
    titleField: 'Título',
    categoryField: 'Categoria',
    dateField: 'Data',
    responsibleField: 'Responsável',
    videoLinkField: 'Link do vídeo',
    videoLinkPlaceholder: 'YouTube, Facebook ou outro link',
    platformField: 'Plataforma',
    otherPlatform: 'Outro',
    thumbnailField: 'Thumbnail manual',
    thumbnailPlaceholder: 'Opcional para vídeos fora do YouTube',
    descriptionField: 'Descrição',
    published: 'Publicado',
    saving: 'Salvando...',
    saveResource: 'Salvar recurso',
    searchPlaceholder: 'Buscar por título, tema ou responsável',
    loadingResources: 'Carregando recursos...',
    videoPreparing: 'Vídeo em preparação',
    videoPreparingDescription: 'Em breve este recurso terá uma gravação.',
    play: 'Reproduzir',
    open: 'Abrir',
    draft: 'Rascunho',
    resourceFromChurch: 'Recurso da igreja',
    responsiblePrefix: 'Responsável',
    edit: 'Editar',
    openVideo: 'Abrir vídeo',
    emptyTitle: 'Nenhum recurso encontrado',
    emptyDescription: 'Tente outra busca ou categoria.',
  },
  es: {
    modelos: {
      cultoTitulo: 'Culto Dominical',
      cultoDescricao: 'Grabación del culto para que los hermanos puedan verla después.',
      ebdTitulo: 'Escuela Bíblica Dominical',
      ebdDescricao: 'Clase de la EBD organizada por fecha y tema.',
      estudoTitulo: 'Estudio Bíblico',
      estudoDescricao: 'Estudio de la semana para consulta de los miembros.',
      igreja: 'Iglesia',
    },
    categorias: {
      todos: 'Todos',
      culto: 'Cultos',
      ebd: 'EBD',
      estudo: 'Estudios',
      especial: 'Especiales',
    },
    categoriaSingular: {
      culto: 'Culto',
      ebd: 'EBD',
      estudo: 'Estudio',
      especial: 'Especial',
    },
    heroEyebrow: 'Recursos de la iglesia',
    title: 'Medios para los hermanos',
    backHome: 'Volver a la página inicial',
    subtitle:
      'Cultos, EBD, estudios y grabaciones reunidos en un solo lugar para que visitantes y miembros acompañen la vida de la iglesia.',
    items: 'ítems',
    videos: 'videos',
    areas: 'áreas',
    newResource: 'Nuevo recurso',
    loadError:
      'Todavía no fue posible cargar los recursos de la base. Mostrando modelos iniciales.',
    loadErrorFallback: 'Error al cargar recursos.',
    saveErrorFallback: 'Error al guardar recurso.',
    editResource: 'Editar recurso',
    closeForm: 'Cerrar formulario',
    titleField: 'Título',
    categoryField: 'Categoría',
    dateField: 'Fecha',
    responsibleField: 'Responsable',
    videoLinkField: 'Enlace del video',
    videoLinkPlaceholder: 'YouTube, Facebook u otro enlace',
    platformField: 'Plataforma',
    otherPlatform: 'Otra',
    thumbnailField: 'Thumbnail manual',
    thumbnailPlaceholder: 'Opcional para videos fuera de YouTube',
    descriptionField: 'Descripción',
    published: 'Publicado',
    saving: 'Guardando...',
    saveResource: 'Guardar recurso',
    searchPlaceholder: 'Buscar por título, tema o responsable',
    loadingResources: 'Cargando recursos...',
    videoPreparing: 'Video en preparación',
    videoPreparingDescription: 'Pronto este recurso tendrá una grabación.',
    play: 'Reproducir',
    open: 'Abrir',
    draft: 'Borrador',
    resourceFromChurch: 'Recurso de la iglesia',
    responsiblePrefix: 'Responsable',
    edit: 'Editar',
    openVideo: 'Abrir video',
    emptyTitle: 'No se encontraron recursos',
    emptyDescription: 'Intenta otra búsqueda o categoría.',
  },
  en: {
    modelos: {
      cultoTitulo: 'Sunday Service',
      cultoDescricao: 'Service recording for the church family to watch later.',
      ebdTitulo: 'Sunday School',
      ebdDescricao: 'Sunday school class organized by date and topic.',
      estudoTitulo: 'Bible Study',
      estudoDescricao: 'Weekly study available for members.',
      igreja: 'Church',
    },
    categorias: {
      todos: 'All',
      culto: 'Services',
      ebd: 'Sunday School',
      estudo: 'Studies',
      especial: 'Specials',
    },
    categoriaSingular: {
      culto: 'Service',
      ebd: 'Sunday School',
      estudo: 'Study',
      especial: 'Special',
    },
    heroEyebrow: 'Church resources',
    title: 'Media for the church family',
    backHome: 'Back to home page',
    subtitle:
      'Services, Sunday school, studies, and recordings gathered in one place for visitors and members to follow church life.',
    items: 'items',
    videos: 'videos',
    areas: 'areas',
    newResource: 'New resource',
    loadError:
      'Resources could not be loaded from the database yet. Showing starter examples.',
    loadErrorFallback: 'Error loading resources.',
    saveErrorFallback: 'Error saving resource.',
    editResource: 'Edit resource',
    closeForm: 'Close form',
    titleField: 'Title',
    categoryField: 'Category',
    dateField: 'Date',
    responsibleField: 'Responsible',
    videoLinkField: 'Video link',
    videoLinkPlaceholder: 'YouTube, Facebook, or another link',
    platformField: 'Platform',
    otherPlatform: 'Other',
    thumbnailField: 'Manual thumbnail',
    thumbnailPlaceholder: 'Optional for non-YouTube videos',
    descriptionField: 'Description',
    published: 'Published',
    saving: 'Saving...',
    saveResource: 'Save resource',
    searchPlaceholder: 'Search by title, topic, or responsible person',
    loadingResources: 'Loading resources...',
    videoPreparing: 'Video in preparation',
    videoPreparingDescription: 'This resource will have a recording soon.',
    play: 'Play',
    open: 'Open',
    draft: 'Draft',
    resourceFromChurch: 'Church resource',
    responsiblePrefix: 'Responsible',
    edit: 'Edit',
    openVideo: 'Open video',
    emptyTitle: 'No resources found',
    emptyDescription: 'Try another search or category.',
  },
} satisfies Record<Locale, Record<string, unknown>>;

function getTextos(locale: Locale) {
  return TEXTOS[locale] || TEXTOS.pt;
}

function getRecursosModelo(textos: ReturnType<typeof getTextos>): RecursoMultimidia[] {
  return [
    {
      id: 'culto-dominical-modelo',
      titulo: textos.modelos.cultoTitulo,
      categoria: 'culto',
      data: '2026-04-26',
      descricao: textos.modelos.cultoDescricao,
      responsavel: 'IPPN',
    },
    {
      id: 'ebd-modelo',
      titulo: textos.modelos.ebdTitulo,
      categoria: 'ebd',
      data: '2026-04-26',
      descricao: textos.modelos.ebdDescricao,
      responsavel: 'EBD',
    },
    {
      id: 'estudo-modelo',
      titulo: textos.modelos.estudoTitulo,
      categoria: 'estudo',
      data: '2026-04-23',
      descricao: textos.modelos.estudoDescricao,
      responsavel: textos.modelos.igreja,
    },
  ];
}

function extrairYoutubeId(url?: string | null) {
  if (!url) return null;

  const regex =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ \s]{11})/;
  return url.match(regex)?.[1] || null;
}

function getVideoUrl(recurso: RecursoMultimidia) {
  return recurso.videoUrl || recurso.youtubeUrl || null;
}

function getYoutubeThumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function getThumbnailUrl(recurso: RecursoMultimidia) {
  const videoUrl = getVideoUrl(recurso);
  const youtubeId = extrairYoutubeId(videoUrl);

  return recurso.thumbnailUrl || (youtubeId ? getYoutubeThumbnailUrl(youtubeId) : null);
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function RecursosPage() {
  const locale = useLocale();
  const textos = getTextos(locale);
  const { user } = useAuth();
  const { permissoes } = usePermissions();
  const podeEditar = Boolean(user && permissoes.podeEditarRecursosMultimidia);

  const [recursos, setRecursos] = useState<RecursoMultimidia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<RecursoCategoria | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [recursoTocandoId, setRecursoTocandoId] = useState<string | null>(null);

  const carregarRecursos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const params = new URLSearchParams();
      const igrejaId = getStoredChurchId();
      if (igrejaId) params.set('igreja_id', igrejaId);
      if (podeEditar) params.set('incluir_inativos', 'true');

      const response = await fetch(`/api/recursos?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || textos.loadErrorFallback);
      }

      setRecursos((data.recursos || []) as RecursoMultimidia[]);
    } catch (error: any) {
      console.error('Erro ao carregar recursos:', error);
      setErro(textos.loadError);
      setRecursos(getRecursosModelo(textos));
    } finally {
      setCarregando(false);
    }
  }, [podeEditar, textos]);

  useEffect(() => {
    void carregarRecursos();
  }, [carregarRecursos]);

  const recursosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca.trim());

    return recursos.filter((recurso) => {
      const passaCategoria = categoriaAtiva === 'todos' || recurso.categoria === categoriaAtiva;
      const conteudo = normalizarTexto(
        [recurso.titulo, recurso.descricao, recurso.responsavel || '', textos.categoriaSingular[recurso.categoria]]
          .join(' ')
      );

      return passaCategoria && (!termo || conteudo.includes(termo));
    });
  }, [busca, categoriaAtiva, recursos, textos]);

  const abrirNovo = () => {
    setForm(FORM_INICIAL);
    setFormAberto(true);
  };

  const abrirEdicao = (recurso: RecursoMultimidia) => {
    setForm({
      id: recurso.id,
      titulo: recurso.titulo,
      categoria: recurso.categoria,
      data: recurso.data,
      descricao: recurso.descricao,
      responsavel: recurso.responsavel || '',
      videoUrl: getVideoUrl(recurso) || '',
      thumbnailUrl: recurso.thumbnailUrl || '',
      plataforma: recurso.plataforma || 'youtube',
      duracao: recurso.duracao || '',
      ativo: recurso.ativo ?? true,
    });
    setFormAberto(true);
  };

  const salvarRecurso = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      const igrejaId = getStoredChurchId();
      const response = await fetch('/api/recursos', {
        method: form.id ? 'PATCH' : 'POST',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: form.id,
          igreja_id: igrejaId,
          titulo: form.titulo,
          categoria: form.categoria,
          data_recurso: form.data,
          descricao: form.descricao,
          responsavel: form.responsavel,
          youtube_url: form.plataforma === 'youtube' ? form.videoUrl : '',
          video_url: form.videoUrl,
          thumbnail_url: form.thumbnailUrl,
          plataforma: form.plataforma,
          duracao: form.duracao,
          ativo: form.ativo,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || data?.message || textos.saveErrorFallback);
      }

      const recursoSalvo = data.recurso as RecursoMultimidia;
      setRecursos((atuais) => {
        if (form.id) {
          return atuais.map((item) => (item.id === recursoSalvo.id ? recursoSalvo : item));
        }
        return [recursoSalvo, ...atuais];
      });
      setFormAberto(false);
      setForm(FORM_INICIAL);
    } catch (error: any) {
      console.error('Erro ao salvar recurso:', error);
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
                <Library className="h-4 w-4" />
                {textos.heroEyebrow}
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {textos.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">
                {textos.subtitle}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-80">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-2xl font-semibold">{recursos.length}</p>
                  <p className="mt-1 text-xs text-emerald-50">{textos.items}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-2xl font-semibold">
                    {recursos.filter((recurso) => Boolean(getVideoUrl(recurso))).length}
                  </p>
                  <p className="mt-1 text-xs text-emerald-50">{textos.videos}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-2xl font-semibold">{categorias.length - 1}</p>
                  <p className="mt-1 text-xs text-emerald-50">{textos.areas}</p>
                </div>
              </div>

              {podeEditar ? (
                <button
                  type="button"
                  onClick={abrirNovo}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                >
                  <Plus className="h-4 w-4" />
                  {textos.newResource}
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
                {form.id ? textos.editResource : textos.newResource}
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

            <form onSubmit={salvarRecurso} className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.titleField}</span>
                <input
                  required
                  value={form.titulo}
                  onChange={(event) => setForm({ ...form, titulo: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.categoryField}</span>
                <select
                  value={form.categoria}
                  onChange={(event) =>
                    setForm({ ...form, categoria: event.target.value as RecursoCategoria })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="culto">{textos.categoriaSingular.culto}</option>
                  <option value="ebd">{textos.categoriaSingular.ebd}</option>
                  <option value="estudo">{textos.categoriaSingular.estudo}</option>
                  <option value="especial">{textos.categoriaSingular.especial}</option>
                </select>
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
                <span className="text-sm font-semibold text-slate-700">{textos.responsibleField}</span>
                <input
                  value={form.responsavel}
                  onChange={(event) => setForm({ ...form, responsavel: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block lg:col-span-2">
                <span className="text-sm font-semibold text-slate-700">{textos.videoLinkField}</span>
                <input
                  value={form.videoUrl}
                  onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
                  placeholder={textos.videoLinkPlaceholder}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.platformField}</span>
                <select
                  value={form.plataforma}
                  onChange={(event) => setForm({ ...form, plataforma: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="outro">{textos.otherPlatform}</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{textos.thumbnailField}</span>
                <input
                  value={form.thumbnailUrl}
                  onChange={(event) => setForm({ ...form, thumbnailUrl: event.target.value })}
                  placeholder={textos.thumbnailPlaceholder}
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
                  {salvando ? textos.saving : textos.saveResource}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categorias.map((categoria) => {
                const Icone = categoria.icon;
                const ativo = categoriaAtiva === categoria.id;

                return (
                  <button
                    key={categoria.id}
                    type="button"
                    onClick={() => setCategoriaAtiva(categoria.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      ativo
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icone className="h-4 w-4" />
                    {textos.categorias[categoria.id]}
                  </button>
                );
              })}
            </div>

            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder={textos.searchPlaceholder}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
        </section>

        {carregando ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-700" />
            <p className="mt-4 text-sm text-slate-600">{textos.loadingResources}</p>
          </section>
        ) : recursosFiltrados.length > 0 ? (
          <section className="grid gap-5 lg:grid-cols-2">
            {recursosFiltrados.map((recurso) => {
              const videoUrl = getVideoUrl(recurso);
              const youtubeId = extrairYoutubeId(videoUrl);
              const thumbnailUrl = getThumbnailUrl(recurso);
              const tocandoYoutube = recursoTocandoId === recurso.id && youtubeId;

              return (
                <article
                  key={recurso.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-video bg-slate-900">
                    {tocandoYoutube ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title={recurso.titulo}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : thumbnailUrl ? (
                      <div className="relative h-full w-full overflow-hidden">
                        <div
                          className="h-full w-full object-cover"
                          style={{
                            backgroundImage: `url("${thumbnailUrl}")`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-950/35" />
                        {youtubeId ? (
                          <button
                            type="button"
                            onClick={() => setRecursoTocandoId(recurso.id)}
                            className="absolute inset-0 flex items-center justify-center text-white transition hover:bg-slate-950/10"
                            aria-label={`${textos.play} ${recurso.titulo}`}
                          >
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-emerald-800 shadow-lg">
                              <PlayCircle className="h-9 w-9" />
                            </span>
                          </button>
                        ) : videoUrl ? (
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 flex items-center justify-center text-white transition hover:bg-slate-950/10"
                            aria-label={`${textos.open} ${recurso.titulo}`}
                          >
                            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-emerald-800 shadow-lg">
                              <ExternalLink className="h-8 w-8" />
                            </span>
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center text-white">
                        <div className="rounded-full bg-white/10 p-4 ring-1 ring-white/15">
                          <Video className="h-8 w-8" />
                        </div>
                        <div>
                          <p className="font-semibold">{textos.videoPreparing}</p>
                          <p className="mt-1 text-sm text-slate-300">{textos.videoPreparingDescription}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {textos.categoriaSingular[recurso.categoria]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatarData(recurso.data, locale)}
                      </span>
                      {recurso.duracao ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          <Clock3 className="h-3.5 w-3.5" />
                          {recurso.duracao}
                        </span>
                      ) : null}
                      {podeEditar && recurso.ativo === false ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          {textos.draft}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="text-xl font-bold text-slate-950">{recurso.titulo}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{recurso.descricao}</p>

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-slate-500">
                        {recurso.responsavel
                          ? `${textos.responsiblePrefix}: ${recurso.responsavel}`
                          : textos.resourceFromChurch}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {podeEditar ? (
                          <button
                            type="button"
                            onClick={() => abrirEdicao(recurso)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" />
                            {textos.edit}
                          </button>
                        ) : null}
                        {videoUrl ? (
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            {textos.openVideo}
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Library className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{textos.emptyTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">{textos.emptyDescription}</p>
          </section>
        )}
      </main>
    </div>
  );
}
