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
  conteudo_publico_padrao: string;
  descricao_interna_padrao: string;
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
  apresentacao_titulo: string;
  apresentacao_texto: string;
  apresentacao_imagem_url: string;
  apresentacao_youtube_url: string;
  apresentacao_galeria: string;
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

const PAISES_DISPONIVEIS = [
  { value: 'BR', label: 'Brasil' },
  { value: 'PT', label: 'Portugal' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'CA', label: 'Canadá' },
];

const MODOS_REPERTORIO = [
  { value: 'livre', label: 'Contemporâneo' },
  { value: 'hinario', label: 'Hinário' },
  { value: 'misto', label: 'Misto' },
];

const TIMEZONES_DISPONIVEIS = [
  { value: 'America/Manaus', label: 'America/Manaus' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'America/Vancouver', label: 'America/Vancouver' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
];

const DIAS_PUBLICACAO = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
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
    pais: 'BR',
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
    apresentacao_titulo: '',
    apresentacao_texto: '',
    apresentacao_imagem_url: '',
    apresentacao_youtube_url: '',
    apresentacao_galeria: '',
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

function normalizePais(value: unknown) {
  if (typeof value !== 'string') return 'BR';

  const normalized = value.trim().toUpperCase();
  if (normalized === 'BR' || normalized === 'BRASIL') return 'BR';
  if (normalized === 'PT' || normalized === 'PORTUGAL') return 'PT';
  if (normalized === 'US' || normalized === 'USA' || normalized === 'ESTADOS UNIDOS') return 'US';
  if (normalized === 'CA' || normalized === 'CANADA' || normalized === 'CANADÁ') return 'CA';

  return 'BR';
}

function getPaisLabel(pais: string) {
  return PAISES_DISPONIVEIS.find((item) => item.value === pais)?.label || 'Brasil';
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
      const conteudo_publico_padrao =
        typeof row.conteudo_publico_padrao === 'string'
          ? row.conteudo_publico_padrao
          : typeof row.conteudo_publico === 'string'
            ? row.conteudo_publico
            : '';
      const descricao_interna_padrao =
        typeof row.descricao_interna_padrao === 'string'
          ? row.descricao_interna_padrao
          : descricao_padrao;

      if (!bloco && !tipo && !descricao_padrao && !conteudo_publico_padrao) return null;

      return {
        bloco,
        ordem: typeof row.ordem === 'number' ? row.ordem : index + 1,
        tipo,
        conteudo_publico_padrao,
        descricao_interna_padrao,
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
      conteudo_publico_padrao: '',
      descricao_interna_padrao: '',
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

function mergeModelosLiturgia(modelosTabela: ModeloLiturgia[], modelosFallback: ModeloLiturgia[]) {
  const merged = new Map<string, ModeloLiturgia>();

  modelosFallback.forEach((item, index) => {
    const key = `${item.ordem || index + 1}-${item.tipo}-${item.bloco}`;
    merged.set(key, {
      ...item,
      ordem: item.ordem || index + 1,
    });
  });

  modelosTabela.forEach((item, index) => {
    const key = `${item.ordem || index + 1}-${item.tipo}-${item.bloco}`;
    const fallback = merged.get(key);

    merged.set(key, {
      ...fallback,
      ...item,
      ordem: item.ordem || fallback?.ordem || index + 1,
      conteudo_publico_padrao:
        item.conteudo_publico_padrao || fallback?.conteudo_publico_padrao || '',
      descricao_interna_padrao:
        item.descricao_interna_padrao || fallback?.descricao_interna_padrao || item.descricao_padrao || '',
      descricao_padrao:
        item.descricao_padrao || fallback?.descricao_padrao || item.descricao_interna_padrao || '',
      tem_cantico: item.tem_cantico ?? fallback?.tem_cantico ?? false,
    });
  });

  return [...merged.values()].sort((a, b) => a.ordem - b.ordem);
}

function mapDetailToForm(payload: any): IgrejaForm {
  const igreja = payload?.igreja || {};
  const modelosTabela = (payload?.modelosLiturgia || []).map((item: any, index: number) => ({
    bloco: item.bloco || '',
    ordem: item.ordem ?? index + 1,
    tipo: item.tipo || '',
    conteudo_publico_padrao: item.conteudo_publico_padrao || item.conteudo_publico || '',
    descricao_interna_padrao: item.descricao_interna_padrao || item.descricao_padrao || '',
    descricao_padrao: item.descricao_padrao || item.descricao_interna_padrao || '',
    tem_cantico: item.tem_cantico ?? false,
  }));
  const modelosFallback = extractModeloLiturgicoPadrao(igreja.modelo_liturgico_padrao);

  const modelosMesclados = mergeModelosLiturgia(modelosTabela, modelosFallback);

  return {
    nome: igreja.nome || '',
    slug: igreja.slug || '',
    nome_abreviado: igreja.nome_abreviado || '',
    nome_completo: igreja.nome_completo || '',
    ativo: igreja.ativo ?? true,
    visivel_publico: igreja.visivel_publico ?? true,
    pais: normalizePais(igreja.pais),
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
    apresentacao_titulo: igreja.apresentacao_titulo || '',
    apresentacao_texto: igreja.apresentacao_texto || '',
    apresentacao_imagem_url: igreja.apresentacao_imagem_url || '',
    apresentacao_youtube_url: igreja.apresentacao_youtube_url || '',
    apresentacao_galeria: Array.isArray(igreja.apresentacao_galeria)
      ? igreja.apresentacao_galeria.filter((item: unknown) => typeof item === 'string').join('\n')
      : '',
    permite_cadastro_canticos: igreja.permite_cadastro_canticos ?? true,
    modo_repertorio: igreja.modo_repertorio || '',
    horario_publicacao_boletim: normalizeHorarioToHHMM(igreja.horario_publicacao_boletim || ''),
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
    modelosLiturgia: modelosMesclados,
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

function parseListaUrls(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSubdivisionLabel(pais: string) {
  switch (pais) {
    case 'BR':
      return 'UF';
    case 'US':
      return 'Estado';
    case 'CA':
      return 'Província';
    case 'PT':
      return 'Distrito';
    default:
      return 'Região';
  }
}

function getSubdivisionPlaceholder(pais: string) {
  switch (pais) {
    case 'BR':
      return 'Ex.: AM, SP, RJ';
    case 'US':
      return 'Ex.: Florida, Texas, California';
    case 'CA':
      return 'Ex.: Ontario, Quebec, Alberta';
    case 'PT':
      return 'Ex.: Lisboa, Porto, Braga';
    default:
      return 'Informe a região';
  }
}

function buildEnderecoCompletoIgreja(form: IgrejaForm) {
  return [
    form.logradouro.trim(),
    form.complemento.trim(),
    form.bairro.trim(),
    form.cidade.trim(),
    form.uf.trim(),
    form.pais.trim() && form.pais.trim() !== 'BR' ? getPaisLabel(form.pais.trim()) : '',
    form.cep.trim(),
  ]
    .filter(Boolean)
    .join(', ');
}

function safeTrim(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHorarioToHHMM(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return '';
  return `${match[1]}:${match[2]}`;
}

function getHorarioParts(value: string) {
  const normalized = normalizeHorarioToHHMM(value);
  if (!normalized) return { hora: '', minuto: '' };

  const [hora, minuto] = normalized.split(':');
  return { hora, minuto };
}

function buildHorarioPublicacao(hora: string, minuto: string) {
  if (!hora || !minuto) return '';
  return `${hora}:${minuto}`;
}

function formatHorarioPublicacaoLabel(hora: string, minuto: string) {
  if (!hora || !minuto) return 'Selecione hora e minuto';
  return minuto === '00' ? `${Number(hora)}h` : `${Number(hora)}h${minuto}`;
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

  const subdivisionLabel = useMemo(() => getSubdivisionLabel(form.pais), [form.pais]);
  const subdivisionPlaceholder = useMemo(() => getSubdivisionPlaceholder(form.pais), [form.pais]);
  const enderecoCompletoPreview = useMemo(() => buildEnderecoCompletoIgreja(form), [form]);
  const horarioParts = useMemo(
    () => getHorarioParts(form.horario_publicacao_boletim),
    [form.horario_publicacao_boletim]
  );

  function updateForm<K extends keyof IgrejaForm>(field: K, value: IgrejaForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateModelosLiturgia(nextModelos: ModeloLiturgia[]) {
    updateForm('modelosLiturgia', normalizeModelosLiturgia(nextModelos));
  }

  function addTipoLiturgico(tipoInicial: string) {
    const tipo = tipoInicial.trim();
    if (!tipo) return;

    const jaExiste = form.tiposLiturgicos.some((item) => item.toLowerCase() === tipo.toLowerCase());
    if (jaExiste) return;

    updateForm('tiposLiturgicos', [...form.tiposLiturgicos, tipo]);
    addModeloLiturgia(tipo);
  }

  function removeTipoLiturgico(tipoRemovido: string) {
    updateForm(
      'tiposLiturgicos',
      form.tiposLiturgicos.filter((item) => item !== tipoRemovido)
    );
    updateModelosLiturgia(
      form.modelosLiturgia.filter((modelo) => modelo.tipo !== tipoRemovido)
    );
  }

  function addModeloLiturgia(tipoInicial = '') {
    updateModelosLiturgia([
      ...form.modelosLiturgia,
      {
        bloco: tipoInicial,
        ordem: form.modelosLiturgia.length + 1,
        tipo: tipoInicial,
        conteudo_publico_padrao: '',
        descricao_interna_padrao: '',
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
        bloco: safeTrim(item.bloco),
        tipo: safeTrim(item.tipo),
        conteudo_publico_padrao: safeTrim(item.conteudo_publico_padrao),
        descricao_interna_padrao: safeTrim(item.descricao_interna_padrao),
        descricao_padrao: safeTrim(item.descricao_interna_padrao),
        ordem: item.ordem || index + 1,
      }))
      .filter((item) => item.bloco || item.tipo || item.conteudo_publico_padrao || item.descricao_interna_padrao)
      .sort((a, b) => a.ordem - b.ordem);

    return {
      nome: form.nome,
      slug: form.slug,
      nome_abreviado: form.nome_abreviado,
      nome_completo: form.nome_completo,
      ativo: form.ativo,
      visivel_publico: form.visivel_publico,
      pais: normalizePais(form.pais),
      regiao: form.regiao,
      cidade: form.cidade,
      uf: form.uf,
      logradouro: form.logradouro,
      complemento: form.complemento,
      bairro: form.bairro,
      cep: form.cep,
      endereco_completo: buildEnderecoCompletoIgreja(form),
      telefone: form.telefone,
      whatsapp: form.whatsapp,
      email: form.email,
      site: form.site,
      instagram: form.instagram,
      youtube: form.youtube,
      apresentacao_titulo: form.apresentacao_titulo,
      apresentacao_texto: form.apresentacao_texto,
      apresentacao_imagem_url: form.apresentacao_imagem_url,
      apresentacao_youtube_url: form.apresentacao_youtube_url,
      apresentacao_galeria: parseListaUrls(form.apresentacao_galeria),
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
      <main className="w-full px-6 py-8 xl:px-8 2xl:px-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
              <Church className="h-8 w-8 text-emerald-700" />
              Gestão de Igrejas
            </h1>
            <p className="mt-1 text-slate-600">
              Cadastre e edite dados da igreja, agenda de cultos, redes sociais e modelo de liturgia.
            </p>
          </div>

          <div className="flex shrink-0 gap-3">
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

        <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="sticky top-6 self-start rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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

          <section className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm 2xl:p-10">
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

              <div className="space-y-10">
                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Identidade</h3>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    <p className="font-semibold">Como preencher os nomes da igreja</p>
                    <p className="mt-1">
                      Use o <strong>nome de exibição</strong> como nome principal no sistema. O <strong>slug</strong> é o identificador da URL.
                      O <strong>nome curto</strong> aparece em listas, seletores e espaços pequenos. O <strong>nome jurídico/oficial</strong>
                      só é necessário quando houver um nome formal maior para documentos ou apresentação institucional.
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
                    <Input
                      label="Nome de exibição"
                      value={form.nome}
                      onChange={(value) => updateForm('nome', value)}
                      placeholder="Nome principal que o sistema vai mostrar"
                    />
                    <Input
                      label="Identificador da URL"
                      value={form.slug}
                      onChange={(value) => updateForm('slug', slugify(value))}
                      placeholder="Ex.: ip-manaus-centro"
                    />
                    <Input
                      label="Nome curto"
                      value={form.nome_abreviado}
                      onChange={(value) => updateForm('nome_abreviado', value)}
                      placeholder="Versão resumida para listas, menus e cabeçalhos"
                    />
                    <Input
                      label="Nome jurídico ou oficial"
                      value={form.nome_completo}
                      onChange={(value) => updateForm('nome_completo', value)}
                      placeholder="Use só se existir um nome formal maior que o de exibição"
                    />
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
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

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <MapPinned className="h-4 w-4 text-blue-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Localização</h3>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-3">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">País</span>
                      <select
                        value={form.pais}
                        onChange={(event) => updateForm('pais', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {PAISES_DISPONIVEIS.map((pais) => (
                          <option key={pais.value} value={pais.value}>
                            {pais.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input label="Cidade" value={form.cidade} onChange={(value) => updateForm('cidade', value)} />
                    <Input
                      label={subdivisionLabel}
                      value={form.uf}
                      onChange={(value) => updateForm('uf', value)}
                      placeholder={subdivisionPlaceholder}
                    />
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <Input label="Logradouro" value={form.logradouro} onChange={(value) => updateForm('logradouro', value)} />
                    <Input label="Complemento" value={form.complemento} onChange={(value) => updateForm('complemento', value)} />
                    <Input label="Bairro" value={form.bairro} onChange={(value) => updateForm('bairro', value)} />
                    <Input label="CEP" value={form.cep} onChange={(value) => updateForm('cep', value)} />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-medium text-slate-700">Endereço completo gerado automaticamente</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Montado a partir de logradouro, complemento, bairro, cidade, {subdivisionLabel.toLowerCase()} e país.
                    </p>
                    <div className="mt-3 min-h-16 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {enderecoCompletoPreview || 'Preencha os campos acima para gerar o endereço completo.'}
                    </div>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-violet-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Contato e presença digital</h3>
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-900">
                    <p className="font-semibold">Redes sociais não ficam limitadas aqui.</p>
                    <p className="mt-1">
                      Neste bloco ficam os contatos principais da igreja. Para cadastrar uma ou várias redes sociais,
                      use a seção <strong>Redes sociais</strong> logo abaixo.
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-3 2xl:grid-cols-4">
                    <Input label="Telefone" value={form.telefone} onChange={(value) => updateForm('telefone', value)} />
                    <Input label="WhatsApp" value={form.whatsapp} onChange={(value) => updateForm('whatsapp', value)} />
                    <Input label="E-mail" value={form.email} onChange={(value) => updateForm('email', value)} type="email" />
                    <Input label="Site" value={form.site} onChange={(value) => updateForm('site', value)} />
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-rose-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Apresentação pública</h3>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
                    <p className="font-semibold">Esse bloco aparece na homepage como “Sobre a Igreja”.</p>
                    <p className="mt-1">
                      O link só aparece no público quando houver <strong>título</strong> ou <strong>texto</strong>. As mídias
                      são opcionais e entram como apoio visual da apresentação.
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <Input
                      label="Título da apresentação"
                      value={form.apresentacao_titulo}
                      onChange={(value) => updateForm('apresentacao_titulo', value)}
                      placeholder="Ex.: Uma comunidade para adorar, servir e acolher"
                    />
                    <Input
                      label="Imagem principal"
                      value={form.apresentacao_imagem_url}
                      onChange={(value) => updateForm('apresentacao_imagem_url', value)}
                      placeholder="https://..."
                    />
                  </div>
                  <Textarea
                    label="Texto institucional"
                    value={form.apresentacao_texto}
                    onChange={(value) => updateForm('apresentacao_texto', value)}
                    rows={6}
                  />
                  <div className="grid gap-5 xl:grid-cols-2">
                    <Input
                      label="Vídeo do YouTube"
                      value={form.apresentacao_youtube_url}
                      onChange={(value) => updateForm('apresentacao_youtube_url', value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <Textarea
                      label="Galeria de fotos"
                      value={form.apresentacao_galeria}
                      onChange={(value) => updateForm('apresentacao_galeria', value)}
                      rows={4}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Na galeria, use uma URL por linha. Se o texto institucional estiver vazio, o link “Sobre a igreja” não será exibido.
                  </p>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-amber-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Configurações da igreja</h3>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">Modo de repertório</span>
                      <select
                        value={form.modo_repertorio}
                        onChange={(event) => updateForm('modo_repertorio', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Selecione</option>
                        {MODOS_REPERTORIO.map((modo) => (
                          <option key={modo.value} value={modo.value}>
                            {modo.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">Timezone do boletim</span>
                      <select
                        value={form.timezone_boletim}
                        onChange={(event) => updateForm('timezone_boletim', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Selecione</option>
                        {TIMEZONES_DISPONIVEIS.map((timezone) => (
                          <option key={timezone.value} value={timezone.value}>
                            {timezone.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">Dia de publicação do boletim</span>
                      <select
                        value={form.dia_publicacao_boletim}
                        onChange={(event) => updateForm('dia_publicacao_boletim', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Selecione</option>
                        {DIAS_PUBLICACAO.map((dia) => (
                          <option key={dia.value} value={dia.value}>
                            {dia.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[220px_220px_minmax(0,1fr)]">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">Hora de publicação</span>
                      <select
                        value={horarioParts.hora}
                        onChange={(event) =>
                          updateForm(
                            'horario_publicacao_boletim',
                            buildHorarioPublicacao(event.target.value, horarioParts.minuto)
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Hora</option>
                        {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')).map((hora) => (
                          <option key={hora} value={hora}>
                            {hora}h
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">Minutos</span>
                      <select
                        value={horarioParts.minuto}
                        onChange={(event) =>
                          updateForm(
                            'horario_publicacao_boletim',
                            buildHorarioPublicacao(horarioParts.hora, event.target.value)
                          )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Min</option>
                        {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map((minuto) => (
                          <option key={minuto} value={minuto}>
                            {minuto}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">Formato exibido</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatHorarioPublicacaoLabel(horarioParts.hora, horarioParts.minuto)}
                      </p>
                    </div>
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

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-rose-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Agenda de cultos</h3>
                  </div>
                  <div className="space-y-3">
                    {form.cultos.map((culto, index) => (
                      <div key={`culto-${index}`} className="rounded-2xl border border-slate-200 p-5">
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
                        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
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
                        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
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

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-cyan-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Redes sociais</h3>
                  </div>
                  <div className="space-y-3">
                    {form.redesSociais.map((rede, index) => (
                      <div key={`rede-${index}`} className="grid gap-5 rounded-2xl border border-slate-200 p-5 xl:grid-cols-[220px_minmax(0,1fr)_130px_180px]">
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

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Church className="h-4 w-4 text-indigo-700" />
                    <h3 className="text-lg font-semibold text-slate-900">Liturgia da igreja</h3>
                  </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 xl:p-6">
                    <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
                      <p className="text-sm font-semibold text-indigo-950">Fluxo simples para configurar a liturgia</p>
                      <p className="mt-1 text-sm text-indigo-900">
                        1. Adicione os tipos que a igreja usa. 2. Cada tipo entra automaticamente na ordem do culto.
                        3. Depois, só reorganize e ajuste os textos padrão.
                      </p>
                    </div>

                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)] 2xl:grid-cols-[minmax(420px,0.95fr)_minmax(0,1.45fr)]">
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
                      <p className="mb-2 text-sm font-semibold text-slate-900">1. Tipos disponíveis</p>
                      <p className="mb-4 text-sm text-slate-500">
                        Adicione aqui as partes que a igreja usa na liturgia. Ao adicionar um tipo, ele já entra
                        automaticamente na ordem padrão do culto.
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
                              onClick={() => removeTipoLiturgico(tipo)}
                              className="text-emerald-700 hover:text-emerald-900"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <input
                          value={novoTipoLiturgico}
                          onChange={(event) => setNovoTipoLiturgico(event.target.value)}
                          placeholder="Ex.: Leitura responsiva"
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            addTipoLiturgico(novoTipoLiturgico);
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
                                onClick={() => addTipoLiturgico(tipo)}
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

                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">2. Ordem padrão do culto</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Aqui você só organiza a sequência e define o texto padrão de cada parte do culto.
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
                            Adicionar item extra
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
                            Adicione os tipos litúrgicos na coluna à esquerda para começar.
                          </div>
                        )}

                        {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length > 0 && (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            Você já tem tipos cadastrados. Clique em <strong>Gerar ordem inicial</strong> para montar
                            a sequência automaticamente.
                          </div>
                        )}

                        {form.modelosLiturgia.map((modelo, index) => (
                          <div key={`modelo-${index}`} className="min-w-0 rounded-2xl border border-slate-200 p-5">
                            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-3">
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-100 px-2 text-sm font-bold text-emerald-900">
                                  {index + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900">Item da ordem</p>
                                  <p className="text-xs text-slate-500">
                                    Use as setas ou escolha a nova posição para reorganizar a sequência.
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
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

                            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px]">
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
                                label="Título exibido no culto"
                                value={modelo.bloco}
                                onChange={(value) => patchModeloLiturgia(index, { bloco: value })}
                                placeholder="Opcional. Se não mudar, pode repetir o tipo"
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

                            <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                              <div className="grid min-w-0 gap-4">
                                <Textarea
                                  label="Texto público"
                                  value={modelo.conteudo_publico_padrao}
                                  onChange={(value) => patchModeloLiturgia(index, { conteudo_publico_padrao: value })}
                                  rows={2}
                                />
                                <Textarea
                                  label="Texto interno"
                                  value={modelo.descricao_interna_padrao}
                                  onChange={(value) =>
                                    patchModeloLiturgia(index, {
                                      descricao_interna_padrao: value,
                                      descricao_padrao: value,
                                    })
                                  }
                                  rows={2}
                                />
                              </div>
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
