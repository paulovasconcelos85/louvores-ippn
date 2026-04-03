'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Building2,
  CalendarClock,
  Church,
  Globe,
  Link2,
  MapPinned,
  Plus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';

type IgrejaResumo = {
  id: string;
  nome: string;
  slug: string;
  nome_abreviado?: string | null;
  cidade?: string | null;
  uf?: string | null;
  regiao?: string | null;
  pais?: string | null;
  ativo?: boolean;
  visivel_publico?: boolean;
};

type Culto = {
  nome: string;
  dia_semana: string;
  horario: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
};

type RedeSocial = {
  tipo: string;
  url: string;
  ativo: boolean;
  ordem: number;
};

type ModeloLiturgia = {
  bloco: string;
  ordem: number;
  tipo: string;
  descricao_padrao: string;
  tem_cantico: boolean;
};

type IgrejaForm = {
  nome: string;
  slug: string;
  nome_abreviado: string;
  nome_completo: string;
  ativo: boolean;
  visivel_publico: boolean;
  pais: string;
  regiao: string;
  cidade: string;
  uf: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cep: string;
  endereco_completo: string;
  telefone: string;
  whatsapp: string;
  email: string;
  site: string;
  instagram: string;
  youtube: string;
  permite_cadastro_canticos: boolean;
  modo_repertorio: string;
  horario_publicacao_boletim: string;
  dia_publicacao_boletim: string;
  timezone_boletim: string;
  tiposLiturgicos: string[];
  cultos: Culto[];
  redesSociais: RedeSocial[];
  modelosLiturgia: ModeloLiturgia[];
};

const DIAS_SEMANA = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

const TIPOS_REDE = ['instagram', 'youtube', 'facebook', 'spotify', 'site', 'outro'];

const TIPOS_LITURGICOS_SUGERIDOS = [
  'Prelúdio',
  'Saudação e Acolhida à Igreja',
  'Cânticos Congregacionais',
  'Confissão de Pecados',
  'Dízimos e Ofertas',
  'Cântico para as Ofertas e Dízimos',
  'Oração pelas Crianças',
  'Pregação da Palavra',
  'Santa Ceia',
  'Cântico Final',
  'Oração Final e Bênção Apostólica',
  'Lembretes',
];

function criarFormularioVazio(): IgrejaForm {
  return {
    nome: '',
    slug: '',
    nome_abreviado: '',
    nome_completo: '',
    ativo: true,
    visivel_publico: true,
    pais: 'Brasil',
    regiao: '',
    cidade: '',
    uf: '',
    logradouro: '',
    complemento: '',
    bairro: '',
    cep: '',
    endereco_completo: '',
    telefone: '',
    whatsapp: '',
    email: '',
    site: '',
    instagram: '',
    youtube: '',
    permite_cadastro_canticos: true,
    modo_repertorio: '',
    horario_publicacao_boletim: '',
    dia_publicacao_boletim: '',
    timezone_boletim: '',
    tiposLiturgicos: [],
    cultos: [],
    redesSociais: [],
    modelosLiturgia: [],
  };
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractTiposLiturgicos(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const candidate = row.nome || row.label || row.tipo || row.titulo;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

function extractModeloLiturgicoPadrao(value: unknown): ModeloLiturgia[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const bloco = typeof row.bloco === 'string' ? row.bloco : '';
      const tipo = typeof row.tipo === 'string' ? row.tipo : '';
      const descricao_padrao =
        typeof row.descricao_padrao === 'string'
          ? row.descricao_padrao
          : typeof row.descricao === 'string'
            ? row.descricao
            : '';

      if (!bloco && !tipo && !descricao_padrao) return null;

      return {
        bloco,
        ordem: typeof row.ordem === 'number' ? row.ordem : index + 1,
        tipo,
        descricao_padrao,
        tem_cantico: row.tem_cantico === true,
      };
    })
    .filter(Boolean) as ModeloLiturgia[];
}

function buildModelosFromTipos(tipos: string[]): ModeloLiturgia[] {
  return tipos
    .map((tipo, index) => ({
      bloco: tipo,
      ordem: index + 1,
      tipo,
      descricao_padrao: '',
      tem_cantico: /cantico|cântico|adora|louvor/i.test(tipo),
    }))
    .filter((item) => item.tipo.trim());
}

function normalizeModelosLiturgia(modelos: ModeloLiturgia[]) {
  return modelos.map((item, index) => ({
    ...item,
    ordem: index + 1,
    bloco: item.bloco || item.tipo,
  }));
}

function mapDetailToForm(payload: any): IgrejaForm {
  const igreja = payload?.igreja || {};
  const modelosTabela = (payload?.modelosLiturgia || []).map((item: any, index: number) => ({
    bloco: item.bloco || '',
    ordem: item.ordem ?? index + 1,
    tipo: item.tipo || '',
    descricao_padrao: item.descricao_padrao || '',
    tem_cantico: item.tem_cantico ?? false,
  }));
  const modelosFallback = extractModeloLiturgicoPadrao(igreja.modelo_liturgico_padrao);

  return {
    nome: igreja.nome || '',
    slug: igreja.slug || '',
    nome_abreviado: igreja.nome_abreviado || '',
    nome_completo: igreja.nome_completo || '',
    ativo: igreja.ativo ?? true,
    visivel_publico: igreja.visivel_publico ?? true,
    pais: igreja.pais || 'Brasil',
    regiao: igreja.regiao || '',
    cidade: igreja.cidade || '',
    uf: igreja.uf || '',
    logradouro: igreja.logradouro || '',
    complemento: igreja.complemento || '',
    bairro: igreja.bairro || '',
    cep: igreja.cep || '',
    endereco_completo: igreja.endereco_completo || '',
    telefone: igreja.telefone || '',
    whatsapp: igreja.whatsapp || '',
    email: igreja.email || '',
    site: igreja.site || '',
    instagram: igreja.instagram || '',
    youtube: igreja.youtube || '',
    permite_cadastro_canticos: igreja.permite_cadastro_canticos ?? true,
    modo_repertorio: igreja.modo_repertorio || '',
    horario_publicacao_boletim: igreja.horario_publicacao_boletim || '',
    dia_publicacao_boletim:
      igreja.dia_publicacao_boletim === null || igreja.dia_publicacao_boletim === undefined
        ? ''
        : String(igreja.dia_publicacao_boletim),
    timezone_boletim: igreja.timezone_boletim || '',
    tiposLiturgicos: extractTiposLiturgicos(igreja.tipos_liturgicos),
    cultos: (payload?.cultos || []).map((item: any, index: number) => ({
      nome: item.nome || '',
      dia_semana: item.dia_semana || 'domingo',
      horario: item.horario || '19:00',
      descricao: item.descricao || '',
      ativo: item.ativo ?? true,
      ordem: item.ordem ?? index + 1,
    })),
    redesSociais: (payload?.redesSociais || []).map((item: any, index: number) => ({
      tipo: item.tipo || 'instagram',
      url: item.url || '',
      ativo: item.ativo ?? true,
      ordem: item.ordem ?? index + 1,
    })),
    modelosLiturgia: modelosTabela.length > 0 ? modelosTabela : modelosFallback,
  };
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

export default function AdminIgrejasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, isSuperAdmin } = usePermissions();

  const [igrejas, setIgrejas] = useState<IgrejaResumo[]>([]);
  const [igrejaSelecionadaId, setIgrejaSelecionadaId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<IgrejaForm>(criarFormularioVazio());
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoTipoLiturgico, setNovoTipoLiturgico] = useState('');

  const loading = authLoading || permLoading;

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push('/admin');
    }
  }, [loading, user, isSuperAdmin, router]);

  async function carregarIgrejas() {
    try {
      setLoadingList(true);
      const response = await fetch('/api/admin/igrejas', {
        headers: await buildAuthenticatedHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao carregar igrejas.');
      }

      setIgrejas(payload.igrejas || []);
      setIgrejaSelecionadaId((current) => current || payload.igrejas?.[0]?.id || 'new');
    } catch (error: any) {
      setErro(error.message || 'Erro ao carregar igrejas.');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (!loading && user && isSuperAdmin) {
      carregarIgrejas();
    }
  }, [loading, user, isSuperAdmin]);

  useEffect(() => {
    if (!igrejaSelecionadaId || igrejaSelecionadaId === 'new') {
      setForm(criarFormularioVazio());
      setNovoTipoLiturgico('');
      return;
    }

    let ativo = true;

    const carregarDetalhes = async () => {
      try {
        setLoadingDetail(true);
        setErro(null);

        const response = await fetch(`/api/admin/igrejas/${igrejaSelecionadaId}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Erro ao carregar detalhes da igreja.');
        }

        if (!ativo) return;
        setForm(mapDetailToForm(payload));
        setNovoTipoLiturgico('');
      } catch (error: any) {
        if (ativo) {
          setErro(error.message || 'Erro ao carregar detalhes da igreja.');
        }
      } finally {
        if (ativo) setLoadingDetail(false);
      }
    };

    carregarDetalhes();

    return () => {
      ativo = false;
    };
  }, [igrejaSelecionadaId]);

  const igrejaSelecionada = useMemo(
    () => igrejas.find((igreja) => igreja.id === igrejaSelecionadaId) || null,
    [igrejas, igrejaSelecionadaId]
  );

  const tiposLiturgicosDisponiveis = useMemo(
    () => [...form.tiposLiturgicos].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [form.tiposLiturgicos]
  );

  function updateForm<K extends keyof IgrejaForm>(field: K, value: IgrejaForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateModelosLiturgia(nextModelos: ModeloLiturgia[]) {
    updateForm('modelosLiturgia', normalizeModelosLiturgia(nextModelos));
  }

  function addModeloLiturgia(tipoInicial = '') {
    updateModelosLiturgia([
      ...form.modelosLiturgia,
      {
        bloco: tipoInicial,
        ordem: form.modelosLiturgia.length + 1,
        tipo: tipoInicial,
        descricao_padrao: '',
        tem_cantico: /cantico|cântico|adora|louvor/i.test(tipoInicial),
      },
    ]);
  }

  function removeModeloLiturgia(index: number) {
    updateModelosLiturgia(form.modelosLiturgia.filter((_, itemIndex) => itemIndex !== index));
  }

  function patchModeloLiturgia(index: number, patch: Partial<ModeloLiturgia>) {
    updateModelosLiturgia(
      form.modelosLiturgia.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const tipo = patch.tipo ?? item.tipo;
        const bloco = patch.bloco ?? (item.bloco || tipo);
        return {
          ...item,
          ...patch,
          tipo,
          bloco,
        };
      })
    );
  }

  function moveModeloLiturgia(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.modelosLiturgia.length) return;

    const next = [...form.modelosLiturgia];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    updateModelosLiturgia(next);
  }

  function moveModeloLiturgiaTo(index: number, targetOrder: number) {
    const boundedOrder = Math.max(1, Math.min(targetOrder, form.modelosLiturgia.length));
    const targetIndex = boundedOrder - 1;
    if (targetIndex === index) return;

    const next = [...form.modelosLiturgia];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    updateModelosLiturgia(next);
  }

  function payloadFromForm() {
    const baseModelos = form.modelosLiturgia.length > 0
      ? [...form.modelosLiturgia]
      : buildModelosFromTipos(form.tiposLiturgicos);

    const modelosOrdenados = baseModelos
      .map((item, index) => ({
        ...item,
        bloco: item.bloco.trim(),
        tipo: item.tipo.trim(),
        descricao_padrao: item.descricao_padrao.trim(),
        ordem: item.ordem || index + 1,
      }))
      .filter((item) => item.bloco || item.tipo || item.descricao_padrao)
      .sort((a, b) => a.ordem - b.ordem);

    return {
      nome: form.nome,
      slug: form.slug,
      nome_abreviado: form.nome_abreviado,
      nome_completo: form.nome_completo,
      ativo: form.ativo,
      visivel_publico: form.visivel_publico,
      pais: form.pais,
      regiao: form.regiao,
      cidade: form.cidade,
      uf: form.uf,
      logradouro: form.logradouro,
      complemento: form.complemento,
      bairro: form.bairro,
      cep: form.cep,
      endereco_completo: form.endereco_completo,
      telefone: form.telefone,
      whatsapp: form.whatsapp,
      email: form.email,
      site: form.site,
      instagram: form.instagram,
      youtube: form.youtube,
      permite_cadastro_canticos: form.permite_cadastro_canticos,
      modo_repertorio: form.modo_repertorio,
      horario_publicacao_boletim: form.horario_publicacao_boletim,
      dia_publicacao_boletim: form.dia_publicacao_boletim ? Number(form.dia_publicacao_boletim) : null,
      timezone_boletim: form.timezone_boletim,
      tipos_liturgicos: form.tiposLiturgicos.map((item) => item.trim()).filter(Boolean),
      modelo_liturgico_padrao: modelosOrdenados,
      cultos: form.cultos,
      redesSociais: form.redesSociais,
      modelosLiturgia: modelosOrdenados,
    };
  }

  async function salvar() {
    try {
      setSaving(true);
      setMensagem(null);
      setErro(null);

      const payload = payloadFromForm();
      const isNew = igrejaSelecionadaId === 'new';

      const response = await fetch(
        isNew ? '/api/admin/igrejas' : `/api/admin/igrejas/${igrejaSelecionadaId}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar igreja.');
      }

      await carregarIgrejas();

      const novaIgrejaId = data.igreja?.id || igrejaSelecionadaId;
      if (novaIgrejaId && novaIgrejaId !== 'new') {
        setIgrejaSelecionadaId(novaIgrejaId);
      }

      setMensagem(isNew ? 'Igreja criada com sucesso.' : 'Igreja atualizada com sucesso.');
    } catch (error: any) {
      setErro(error.message || 'Erro ao salvar igreja.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
              <Church className="h-8 w-8 text-emerald-700" />
              Gestão de Igrejas
            </h1>
            <p className="mt-1 text-slate-600">
              Cadastre e edite dados da igreja, agenda de cultos, redes sociais e modelo de liturgia.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setErro(null);
                setMensagem(null);
                setIgrejaSelecionadaId('new');
                setForm(criarFormularioVazio());
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" />
              Nova Igreja
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>
        </div>

        {(mensagem || erro) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              erro
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {erro || mensagem}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Igrejas</h2>
              {loadingList && <span className="text-xs text-slate-400">Carregando...</span>}
            </div>

            <div className="space-y-2">
              {igrejas.map((igreja) => {
                const active = igreja.id === igrejaSelecionadaId;
                return (
                  <button
                    key={igreja.id}
                    onClick={() => {
                      setMensagem(null);
                      setErro(null);
                      setIgrejaSelecionadaId(igreja.id);
                    }}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{igreja.nome}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {igreja.nome_abreviado || igreja.slug}
                          {igreja.cidade ? ` • ${igreja.cidade}` : ''}
                          {igreja.uf ? `/${igreja.uf}` : ''}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                          igreja.ativo
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {igreja.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {igrejaSelecionadaId === 'new' ? 'Nova igreja' : igrejaSelecionada?.nome || 'Detalhes da igreja'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {loadingDetail
                      ? 'Carregando detalhes...'
                      : 'Edite aqui os dados centrais da igreja e as estruturas ligadas a ela.'}
                  </p>
                </div>
                <button
                  onClick={salvar}
                  disabled={saving || loadingDetail}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Identidade</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Nome" value={form.nome} onChange={(value) => updateForm('nome', value)} />
                    <Input
                      label="Slug"
                      value={form.slug}
                      onChange={(value) => updateForm('slug', slugify(value))}
                      placeholder="ip-manaus-centro"
                    />
                    <Input
                      label="Nome abreviado"
                      value={form.nome_abreviado}
                      onChange={(value) => updateForm('nome_abreviado', value)}
                    />
                    <Input
                      label="Nome completo"
                      value={form.nome_completo}
                      onChange={(value) => updateForm('nome_completo', value)}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">Igreja ativa</span>
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={(event) => updateForm('ativo', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">Visível no público</span>
                      <input
                        type="checkbox"
                        checked={form.visivel_publico}
                        onChange={(event) => updateForm('visivel_publico', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-blue-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Localização</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Input label="País" value={form.pais} onChange={(value) => updateForm('pais', value)} />
                    <Input label="Região" value={form.regiao} onChange={(value) => updateForm('regiao', value)} />
                    <Input label="Cidade" value={form.cidade} onChange={(value) => updateForm('cidade', value)} />
                    <Input label="UF" value={form.uf} onChange={(value) => updateForm('uf', value)} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Logradouro" value={form.logradouro} onChange={(value) => updateForm('logradouro', value)} />
                    <Input label="Complemento" value={form.complemento} onChange={(value) => updateForm('complemento', value)} />
                    <Input label="Bairro" value={form.bairro} onChange={(value) => updateForm('bairro', value)} />
                    <Input label="CEP" value={form.cep} onChange={(value) => updateForm('cep', value)} />
                  </div>
                  <Textarea
                    label="Endereço completo"
                    value={form.endereco_completo}
                    onChange={(value) => updateForm('endereco_completo', value)}
                    rows={3}
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-violet-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Contato e presença digital</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Telefone" value={form.telefone} onChange={(value) => updateForm('telefone', value)} />
                    <Input label="WhatsApp" value={form.whatsapp} onChange={(value) => updateForm('whatsapp', value)} />
                    <Input label="E-mail" value={form.email} onChange={(value) => updateForm('email', value)} type="email" />
                    <Input label="Site" value={form.site} onChange={(value) => updateForm('site', value)} />
                    <Input
                      label="Instagram"
                      value={form.instagram}
                      onChange={(value) => updateForm('instagram', value)}
                    />
                    <Input label="YouTube" value={form.youtube} onChange={(value) => updateForm('youtube', value)} />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-amber-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Configurações da igreja</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Modo de repertório"
                      value={form.modo_repertorio}
                      onChange={(value) => updateForm('modo_repertorio', value)}
                    />
                    <Input
                      label="Timezone do boletim"
                      value={form.timezone_boletim}
                      onChange={(value) => updateForm('timezone_boletim', value)}
                      placeholder="America/Manaus"
                    />
                    <Input
                      label="Horário de publicação do boletim"
                      value={form.horario_publicacao_boletim}
                      onChange={(value) => updateForm('horario_publicacao_boletim', value)}
                      placeholder="08:00"
                    />
                    <Input
                      label="Dia de publicação do boletim"
                      value={form.dia_publicacao_boletim}
                      onChange={(value) => updateForm('dia_publicacao_boletim', value)}
                      placeholder="0-6"
                      type="number"
                    />
                  </div>
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">Permite cadastro de cânticos</span>
                    <input
                      type="checkbox"
                      checked={form.permite_cadastro_canticos}
                      onChange={(event) => updateForm('permite_cadastro_canticos', event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                    />
                  </label>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-rose-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Agenda de cultos</h3>
                  </div>
                  <div className="space-y-3">
                    {form.cultos.map((culto, index) => (
                      <div key={`culto-${index}`} className="rounded-2xl border border-slate-200 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Culto {index + 1}</p>
                          <button
                            type="button"
                            onClick={() =>
                              updateForm(
                                'cultos',
                                form.cultos.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                            className="inline-flex items-center gap-1 text-sm font-medium text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Input
                            label="Nome"
                            value={culto.nome}
                            onChange={(value) =>
                              updateForm(
                                'cultos',
                                form.cultos.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, nome: value } : item
                                )
                              )
                            }
                          />
                          <label className="block space-y-1">
                            <span className="text-sm font-medium text-slate-700">Dia da semana</span>
                            <select
                              value={culto.dia_semana}
                              onChange={(event) =>
                                updateForm(
                                  'cultos',
                                  form.cultos.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, dia_semana: event.target.value }
                                      : item
                                  )
                                )
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            >
                              {DIAS_SEMANA.map((dia) => (
                                <option key={dia} value={dia}>
                                  {dia}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Input
                            label="Horário"
                            value={culto.horario}
                            onChange={(value) =>
                              updateForm(
                                'cultos',
                                form.cultos.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, horario: value } : item
                                )
                              )
                            }
                            type="time"
                          />
                          <Input
                            label="Ordem"
                            value={String(culto.ordem)}
                            onChange={(value) =>
                              updateForm(
                                'cultos',
                                form.cultos.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, ordem: Number(value) || 1 } : item
                                )
                              )
                            }
                            type="number"
                          />
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                          <Textarea
                            label="Descrição"
                            value={culto.descricao}
                            onChange={(value) =>
                              updateForm(
                                'cultos',
                                form.cultos.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, descricao: value } : item
                                )
                              )
                            }
                            rows={2}
                          />
                          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                            <span className="text-sm font-medium text-slate-700">Ativo</span>
                            <input
                              type="checkbox"
                              checked={culto.ativo}
                              onChange={(event) =>
                                updateForm(
                                  'cultos',
                                  form.cultos.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, ativo: event.target.checked }
                                      : item
                                  )
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateForm('cultos', [
                        ...form.cultos,
                        {
                          nome: '',
                          dia_semana: 'domingo',
                          horario: '19:00',
                          descricao: '',
                          ativo: true,
                          ordem: form.cultos.length + 1,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar culto
                  </button>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-cyan-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Redes sociais</h3>
                  </div>
                  <div className="space-y-3">
                    {form.redesSociais.map((rede, index) => (
                      <div key={`rede-${index}`} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[180px_1fr_110px_auto]">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">Tipo</span>
                          <select
                            value={rede.tipo}
                            onChange={(event) =>
                              updateForm(
                                'redesSociais',
                                form.redesSociais.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, tipo: event.target.value } : item
                                )
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          >
                            {TIPOS_REDE.map((tipo) => (
                              <option key={tipo} value={tipo}>
                                {tipo}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Input
                          label="URL"
                          value={rede.url}
                          onChange={(value) =>
                            updateForm(
                              'redesSociais',
                              form.redesSociais.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, url: value } : item
                              )
                            )
                          }
                        />
                        <Input
                          label="Ordem"
                          value={String(rede.ordem)}
                          onChange={(value) =>
                            updateForm(
                              'redesSociais',
                              form.redesSociais.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, ordem: Number(value) || 1 } : item
                              )
                            )
                          }
                          type="number"
                        />
                        <div className="flex items-end gap-3">
                          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={rede.ativo}
                              onChange={(event) =>
                                updateForm(
                                  'redesSociais',
                                  form.redesSociais.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, ativo: event.target.checked }
                                      : item
                                  )
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                            />
                            Ativa
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateForm(
                                'redesSociais',
                                form.redesSociais.filter((_, itemIndex) => itemIndex !== index)
                              )
                            }
                            className="pb-2 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateForm('redesSociais', [
                        ...form.redesSociais,
                        { tipo: 'instagram', url: '', ativo: true, ordem: form.redesSociais.length + 1 },
                      ])
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar rede
                  </button>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Church className="h-4 w-4 text-indigo-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Liturgia da igreja</h3>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="mb-2 text-sm font-semibold text-slate-900">1. Tipos disponíveis</p>
                      <p className="mb-4 text-sm text-slate-500">
                        Cadastre aqui as peças que a igreja usa na liturgia. Depois, na coluna ao lado, você monta a
                        ordem padrão do culto usando esses tipos.
                      </p>

                      <div className="mb-4 flex flex-wrap gap-2">
                        {form.tiposLiturgicos.length === 0 && (
                          <span className="text-sm text-slate-400">Nenhum tipo cadastrado.</span>
                        )}
                        {form.tiposLiturgicos.map((tipo) => (
                          <span
                            key={tipo}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-900"
                          >
                            {tipo}
                            <button
                              type="button"
                              onClick={() => {
                                updateForm(
                                  'tiposLiturgicos',
                                  form.tiposLiturgicos.filter((item) => item !== tipo)
                                );
                                updateModelosLiturgia(
                                  form.modelosLiturgia.filter((modelo) => modelo.tipo !== tipo)
                                );
                              }}
                              className="text-emerald-700 hover:text-emerald-900"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          value={novoTipoLiturgico}
                          onChange={(event) => setNovoTipoLiturgico(event.target.value)}
                          placeholder="Ex.: Leitura responsiva"
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const tipo = novoTipoLiturgico.trim();
                            if (!tipo) return;
                            if (form.tiposLiturgicos.some((item) => item.toLowerCase() === tipo.toLowerCase())) {
                              setNovoTipoLiturgico('');
                              return;
                            }
                            updateForm('tiposLiturgicos', [...form.tiposLiturgicos, tipo]);
                            setNovoTipoLiturgico('');
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar tipo
                        </button>
                      </div>

                      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Sugestões rápidas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {TIPOS_LITURGICOS_SUGERIDOS.map((tipo) => {
                            const ativo = form.tiposLiturgicos.some(
                              (item) => item.toLowerCase() === tipo.toLowerCase()
                            );

                            return (
                              <button
                                key={tipo}
                                type="button"
                                disabled={ativo}
                                onClick={() => updateForm('tiposLiturgicos', [...form.tiposLiturgicos, tipo])}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  ativo
                                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {tipo}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">2. Ordem padrão do culto</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Aqui você define a sequência em que os tipos aparecem no culto. Cada linha abaixo é um
                            item da ordem.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => updateModelosLiturgia(buildModelosFromTipos(form.tiposLiturgicos))}
                              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              <Plus className="h-4 w-4" />
                              Gerar ordem inicial
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addModeloLiturgia(form.tiposLiturgicos[0] || '')}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Plus className="h-4 w-4" />
                            Adicionar item manualmente
                          </button>
                        </div>
                      </div>

                      {tiposLiturgicosDisponiveis.length > 0 && (
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Adicionar tipo na ordem
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {tiposLiturgicosDisponiveis.map((tipo) => (
                              <button
                                key={`add-modelo-${tipo}`}
                                type="button"
                                onClick={() => addModeloLiturgia(tipo)}
                                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {tipo}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
                            Cadastre alguns tipos litúrgicos e depois monte a ordem do culto aqui.
                          </div>
                        )}

                        {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length > 0 && (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            Você já tem tipos cadastrados. Clique em <strong>Gerar ordem inicial</strong> para montar
                            uma primeira sequência automática, ou use os botões acima para montar a ordem do seu jeito.
                          </div>
                        )}

                        {form.modelosLiturgia.map((modelo, index) => (
                          <div key={`modelo-${index}`} className="rounded-2xl border border-slate-200 p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-100 px-2 text-sm font-bold text-emerald-900">
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Item da ordem</p>
                                  <p className="text-xs text-slate-500">
                                    Use as setas ou escolha a nova posição para reorganizar a sequência.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => moveModeloLiturgia(index, -1)}
                                  disabled={index === 0}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveModeloLiturgia(index, 1)}
                                  disabled={index === form.modelosLiturgia.length - 1}
                                  className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeModeloLiturgia(index)}
                                  className="inline-flex items-center gap-1 text-sm font-medium text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remover
                                </button>
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <label className="block space-y-1">
                                <span className="text-sm font-medium text-slate-700">Tipo litúrgico</span>
                                <select
                                  value={modelo.tipo}
                                  onChange={(event) => {
                                    const tipo = event.target.value;
                                    patchModeloLiturgia(index, {
                                      tipo,
                                      bloco: modelo.bloco === modelo.tipo || !modelo.bloco ? tipo : modelo.bloco,
                                      tem_cantico: /cantico|cântico|adora|louvor/i.test(tipo),
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                >
                                  <option value="">Selecione um tipo</option>
                                  {form.tiposLiturgicos.map((tipo) => (
                                    <option key={tipo} value={tipo}>
                                      {tipo}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <Input
                                label="Título exibido"
                                value={modelo.bloco}
                                onChange={(value) => patchModeloLiturgia(index, { bloco: value })}
                                placeholder="Se vazio, usa o nome do tipo"
                              />

                              <label className="block space-y-1">
                                <span className="text-sm font-medium text-slate-700">Posição na ordem</span>
                                <select
                                  value={String(index + 1)}
                                  onChange={(event) =>
                                    moveModeloLiturgiaTo(index, Number(event.target.value) || index + 1)
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                >
                                  {form.modelosLiturgia.map((_, orderIndex) => (
                                    <option key={`ordem-${orderIndex + 1}`} value={String(orderIndex + 1)}>
                                      {orderIndex + 1}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                              <Textarea
                                label="Descrição padrão"
                                value={modelo.descricao_padrao}
                                onChange={(value) => patchModeloLiturgia(index, { descricao_padrao: value })}
                                rows={2}
                              />
                              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                                <span className="text-sm font-medium text-slate-700">Tem cântico</span>
                                <input
                                  type="checkbox"
                                  checked={modelo.tem_cantico}
                                  onChange={(event) =>
                                    patchModeloLiturgia(index, { tem_cantico: event.target.checked })
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
