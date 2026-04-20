'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type { Locale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import {
  compactLocalizedTextMap,
  createEmptyLocalizedTextMap,
  normalizeLocalizedTextMap,
  type LocalizedTextMapForm,
} from '@/lib/church-i18n';
import { resolveApiErrorMessage, resolveApiSuccessMessage } from '@/lib/api-feedback';

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
  conteudo_publico_padrao_i18n: LocalizedTextMapForm;
  descricao_interna_padrao: string;
  descricao_interna_padrao_i18n: LocalizedTextMapForm;
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
  apresentacao_titulo_i18n: LocalizedTextMapForm;
  apresentacao_texto_i18n: LocalizedTextMapForm;
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

const PRESENTATION_LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
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
    apresentacao_titulo_i18n: createEmptyLocalizedTextMap(),
    apresentacao_texto_i18n: createEmptyLocalizedTextMap(),
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
      const conteudo_publico_padrao_i18n = normalizeLocalizedTextMap(
        row.conteudo_publico_padrao_i18n,
        conteudo_publico_padrao
      );
      const descricao_interna_padrao =
        typeof row.descricao_interna_padrao === 'string'
          ? row.descricao_interna_padrao
          : descricao_padrao;
      const descricao_interna_padrao_i18n = normalizeLocalizedTextMap(
        row.descricao_interna_padrao_i18n,
        descricao_interna_padrao
      );

      if (!bloco && !tipo && !descricao_padrao && !conteudo_publico_padrao) return null;

      return {
        bloco,
        ordem: typeof row.ordem === 'number' ? row.ordem : index + 1,
        tipo,
        conteudo_publico_padrao: conteudo_publico_padrao_i18n.pt || conteudo_publico_padrao,
        conteudo_publico_padrao_i18n,
        descricao_interna_padrao: descricao_interna_padrao_i18n.pt || descricao_interna_padrao,
        descricao_interna_padrao_i18n,
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
      conteudo_publico_padrao_i18n: createEmptyLocalizedTextMap(),
      descricao_interna_padrao: '',
      descricao_interna_padrao_i18n: createEmptyLocalizedTextMap(),
      descricao_padrao: '',
      tem_cantico: /cantico|cântico|adora|louvor/i.test(tipo),
    }))
    .filter((item) => item.tipo.trim());
}

function mergeLocalizedModelValue(
  primaryValue: unknown,
  secondaryValue: unknown,
  primaryFallback?: string,
  secondaryFallback?: string
) {
  const primary = normalizeLocalizedTextMap(primaryValue, primaryFallback);
  const secondary = normalizeLocalizedTextMap(secondaryValue, secondaryFallback);

  return {
    pt: primary.pt || secondary.pt,
    es: primary.es || secondary.es,
    en: primary.en || secondary.en,
  };
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
      conteudo_publico_padrao_i18n: mergeLocalizedModelValue(
        item.conteudo_publico_padrao_i18n,
        fallback?.conteudo_publico_padrao_i18n,
        item.conteudo_publico_padrao,
        fallback?.conteudo_publico_padrao
      ),
      conteudo_publico_padrao:
        item.conteudo_publico_padrao ||
        fallback?.conteudo_publico_padrao ||
        mergeLocalizedModelValue(
          item.conteudo_publico_padrao_i18n,
          fallback?.conteudo_publico_padrao_i18n,
          item.conteudo_publico_padrao,
          fallback?.conteudo_publico_padrao
        ).pt ||
        '',
      descricao_interna_padrao_i18n: mergeLocalizedModelValue(
        item.descricao_interna_padrao_i18n,
        fallback?.descricao_interna_padrao_i18n,
        item.descricao_interna_padrao || item.descricao_padrao,
        fallback?.descricao_interna_padrao || fallback?.descricao_padrao
      ),
      descricao_interna_padrao:
        item.descricao_interna_padrao ||
        fallback?.descricao_interna_padrao ||
        item.descricao_padrao ||
        mergeLocalizedModelValue(
          item.descricao_interna_padrao_i18n,
          fallback?.descricao_interna_padrao_i18n,
          item.descricao_interna_padrao || item.descricao_padrao,
          fallback?.descricao_interna_padrao || fallback?.descricao_padrao
        ).pt ||
        '',
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
    conteudo_publico_padrao_i18n: normalizeLocalizedTextMap(
      item.conteudo_publico_padrao_i18n,
      item.conteudo_publico_padrao || item.conteudo_publico
    ),
    descricao_interna_padrao: item.descricao_interna_padrao || item.descricao_padrao || '',
    descricao_interna_padrao_i18n: normalizeLocalizedTextMap(
      item.descricao_interna_padrao_i18n,
      item.descricao_interna_padrao || item.descricao_padrao
    ),
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
    apresentacao_titulo_i18n: normalizeLocalizedTextMap(
      igreja.apresentacao_titulo_i18n,
      igreja.apresentacao_titulo
    ),
    apresentacao_texto_i18n: normalizeLocalizedTextMap(
      igreja.apresentacao_texto_i18n,
      igreja.apresentacao_texto
    ),
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

function formatHorarioPublicacaoLabel(
  hora: string,
  minuto: string,
  tr: (pt: string, es: string, en: string) => string
) {
  if (!hora || !minuto) {
    return tr(
      'Selecione hora e minuto',
      'Selecciona hora y minuto',
      'Select hour and minute'
    );
  }
  return minuto === '00' ? `${Number(hora)}h` : `${Number(hora)}h${minuto}`;
}

export default function AdminIgrejasPage() {
  const router = useRouter();
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
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

  const carregarIgrejas = useCallback(async () => {
    try {
      setLoadingList(true);
      const response = await fetch('/api/admin/igrejas', {
        headers: await buildAuthenticatedHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(
            locale,
            payload,
            tr('Erro ao carregar igrejas.', 'Error al cargar iglesias.', 'Error loading churches.')
          )
        );
      }

      setIgrejas(payload.igrejas || []);
      setIgrejaSelecionadaId((current) => current || payload.igrejas?.[0]?.id || 'new');
    } catch (error: any) {
      setErro(error.message || tr('Erro ao carregar igrejas.', 'Error al cargar iglesias.', 'Error loading churches.'));
    } finally {
      setLoadingList(false);
    }
  }, [tr, locale]);

  useEffect(() => {
    if (!loading && user && isSuperAdmin) {
      carregarIgrejas();
    }
  }, [carregarIgrejas, loading, user, isSuperAdmin]);

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
          throw new Error(
            resolveApiErrorMessage(
              locale,
              payload,
              tr('Erro ao carregar detalhes da igreja.', 'Error al cargar los detalles de la iglesia.', 'Error loading church details.')
            )
          );
        }

        if (!ativo) return;
        setForm(mapDetailToForm(payload));
        setNovoTipoLiturgico('');
      } catch (error: any) {
        if (ativo) {
          setErro(error.message || tr('Erro ao carregar detalhes da igreja.', 'Error al cargar los detalles de la iglesia.', 'Error loading church details.'));
        }
      } finally {
        if (ativo) setLoadingDetail(false);
      }
    };

    carregarDetalhes();

    return () => {
      ativo = false;
    };
  }, [igrejaSelecionadaId, tr, locale]);

  const igrejaSelecionada = useMemo(
    () => igrejas.find((igreja) => igreja.id === igrejaSelecionadaId) || null,
    [igrejas, igrejaSelecionadaId]
  );

  const subdivisionLabel = useMemo(() => {
    switch (form.pais) {
      case 'BR':
        return 'UF';
      case 'US':
        return tr('Estado', 'Estado', 'State');
      case 'CA':
        return tr('Província', 'Provincia', 'Province');
      case 'PT':
        return tr('Distrito', 'Distrito', 'District');
      default:
        return tr('Região', 'Región', 'Region');
    }
  }, [form.pais, tr]);
  const subdivisionPlaceholder = useMemo(() => {
    switch (form.pais) {
      case 'BR':
        return tr('Ex.: AM, SP, RJ', 'Ej.: AM, SP, RJ', 'Ex.: AM, SP, RJ');
      case 'US':
        return tr('Ex.: Florida, Texas, California', 'Ej.: Florida, Texas, California', 'Ex.: Florida, Texas, California');
      case 'CA':
        return tr('Ex.: Ontario, Quebec, Alberta', 'Ej.: Ontario, Quebec, Alberta', 'Ex.: Ontario, Quebec, Alberta');
      case 'PT':
        return tr('Ex.: Lisboa, Porto, Braga', 'Ej.: Lisboa, Porto, Braga', 'Ex.: Lisbon, Porto, Braga');
      default:
        return tr('Informe a região', 'Informa la región', 'Provide the region');
    }
  }, [form.pais, tr]);
  const enderecoCompletoPreview = useMemo(() => buildEnderecoCompletoIgreja(form), [form]);
  const countryOptions = useMemo(
    () => [
      { value: 'BR', label: tr('Brasil', 'Brasil', 'Brazil') },
      { value: 'PT', label: tr('Portugal', 'Portugal', 'Portugal') },
      { value: 'US', label: tr('Estados Unidos', 'Estados Unidos', 'United States') },
      { value: 'CA', label: tr('Canadá', 'Canadá', 'Canada') },
    ],
    [tr]
  );
  const repertoryOptions = useMemo(
    () => [
      { value: 'livre', label: tr('Contemporâneo', 'Contemporáneo', 'Contemporary') },
      { value: 'hinario', label: tr('Hinário', 'Himnario', 'Hymnal') },
      { value: 'misto', label: tr('Misto', 'Mixto', 'Mixed') },
    ],
    [tr]
  );
  const publicationDayOptions = useMemo(
    () => [
      { value: '0', label: tr('Domingo', 'Domingo', 'Sunday') },
      { value: '1', label: tr('Segunda-feira', 'Lunes', 'Monday') },
      { value: '2', label: tr('Terça-feira', 'Martes', 'Tuesday') },
      { value: '3', label: tr('Quarta-feira', 'Miércoles', 'Wednesday') },
      { value: '4', label: tr('Quinta-feira', 'Jueves', 'Thursday') },
      { value: '5', label: tr('Sexta-feira', 'Viernes', 'Friday') },
      { value: '6', label: tr('Sábado', 'Sábado', 'Saturday') },
    ],
    [tr]
  );
  const weekdayLabelMap = useMemo<Record<string, string>>(
    () => ({
      domingo: tr('Domingo', 'Domingo', 'Sunday'),
      segunda: tr('Segunda-feira', 'Lunes', 'Monday'),
      terca: tr('Terça-feira', 'Martes', 'Tuesday'),
      quarta: tr('Quarta-feira', 'Miércoles', 'Wednesday'),
      quinta: tr('Quinta-feira', 'Jueves', 'Thursday'),
      sexta: tr('Sexta-feira', 'Viernes', 'Friday'),
      sabado: tr('Sábado', 'Sábado', 'Saturday'),
    }),
    [tr]
  );
  const horarioParts = useMemo(
    () => getHorarioParts(form.horario_publicacao_boletim),
    [form.horario_publicacao_boletim]
  );
  const activeLocaleLabel = useMemo(
    () => PRESENTATION_LOCALES.find((item) => item.value === locale)?.label || 'Português',
    [locale]
  );

  function updateForm<K extends keyof IgrejaForm>(field: K, value: IgrejaForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateModelosLiturgia(nextModelos: ModeloLiturgia[]) {
    updateForm('modelosLiturgia', normalizeModelosLiturgia(nextModelos));
  }

  function updateLocalizedField(
    field: 'apresentacao_titulo_i18n' | 'apresentacao_texto_i18n',
    targetLocale: Locale,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: {
        ...current[field],
        [targetLocale]: value,
      },
    }));
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
        conteudo_publico_padrao_i18n: createEmptyLocalizedTextMap(),
        descricao_interna_padrao: '',
        descricao_interna_padrao_i18n: createEmptyLocalizedTextMap(),
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

  function patchModeloLiturgiaLocalized(
    index: number,
    field: 'conteudo_publico_padrao_i18n' | 'descricao_interna_padrao_i18n',
    targetLocale: Locale,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      modelosLiturgia: normalizeModelosLiturgia(
        current.modelosLiturgia.map((item, itemIndex) => {
          if (itemIndex !== index) return item;

          const nextLocalized = {
            ...item[field],
            [targetLocale]: value,
          };

          if (field === 'conteudo_publico_padrao_i18n') {
            return {
              ...item,
              conteudo_publico_padrao_i18n: nextLocalized,
              conteudo_publico_padrao:
                targetLocale === 'pt' ? value : nextLocalized.pt || item.conteudo_publico_padrao,
            };
          }

          return {
            ...item,
            descricao_interna_padrao_i18n: nextLocalized,
            descricao_interna_padrao:
              targetLocale === 'pt' ? value : nextLocalized.pt || item.descricao_interna_padrao,
            descricao_padrao:
              targetLocale === 'pt' ? value : nextLocalized.pt || item.descricao_padrao,
          };
        })
      ),
    }));
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
        conteudo_publico_padrao_i18n: compactLocalizedTextMap(item.conteudo_publico_padrao_i18n),
        descricao_interna_padrao_i18n: compactLocalizedTextMap(item.descricao_interna_padrao_i18n),
        conteudo_publico_padrao: safeTrim(
          item.conteudo_publico_padrao_i18n.pt || item.conteudo_publico_padrao
        ),
        descricao_interna_padrao: safeTrim(
          item.descricao_interna_padrao_i18n.pt || item.descricao_interna_padrao
        ),
        descricao_padrao: safeTrim(
          item.descricao_interna_padrao_i18n.pt ||
            item.descricao_interna_padrao ||
            item.descricao_padrao
        ),
        ordem: item.ordem || index + 1,
      }))
      .filter(
        (item) =>
          item.bloco ||
          item.tipo ||
          item.conteudo_publico_padrao ||
          item.descricao_interna_padrao ||
          item.conteudo_publico_padrao_i18n ||
          item.descricao_interna_padrao_i18n
      )
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
      apresentacao_titulo: form.apresentacao_titulo_i18n.pt,
      apresentacao_texto: form.apresentacao_texto_i18n.pt,
      apresentacao_titulo_i18n: compactLocalizedTextMap(form.apresentacao_titulo_i18n),
      apresentacao_texto_i18n: compactLocalizedTextMap(form.apresentacao_texto_i18n),
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
        throw new Error(
          resolveApiErrorMessage(
            locale,
            data,
            tr('Erro ao salvar igreja.', 'Error al guardar la iglesia.', 'Error saving church.')
          )
        );
      }

      await carregarIgrejas();

      const novaIgrejaId = data.igreja?.id || igrejaSelecionadaId;
      if (novaIgrejaId && novaIgrejaId !== 'new') {
        setIgrejaSelecionadaId(novaIgrejaId);
      }

      setMensagem(
        resolveApiSuccessMessage(
          locale,
          data,
          isNew
            ? tr('Igreja criada com sucesso.', 'Iglesia creada con éxito.', 'Church created successfully.')
            : tr('Igreja atualizada com sucesso.', 'Iglesia actualizada con éxito.', 'Church updated successfully.')
        )
      );
    } catch (error: any) {
      setErro(error.message || tr('Erro ao salvar igreja.', 'Error al guardar la iglesia.', 'Error saving church.'));
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
              {tr('Gestão de Igrejas', 'Gestión de Iglesias', 'Church Management')}
            </h1>
            <p className="mt-1 text-slate-600">
              {tr('Cadastre e edite dados da igreja, agenda de cultos, redes sociais e modelo de liturgia.', 'Registra y edita datos de la iglesia, agenda de cultos, redes sociales y modelo de liturgia.', 'Register and edit church data, worship schedule, social networks, and liturgy model.')}
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
              {tr('Nova Igreja', 'Nueva Iglesia', 'New Church')}
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              {tr('Voltar', 'Volver', 'Back')}
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
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{tr('Igrejas', 'Iglesias', 'Churches')}</h2>
              {loadingList && <span className="text-xs text-slate-400">{tr('Carregando...', 'Cargando...', 'Loading...')}</span>}
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
                        {igreja.ativo ? tr('Ativa', 'Activa', 'Active') : tr('Inativa', 'Inactiva', 'Inactive')}
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
                    {igrejaSelecionadaId === 'new'
                      ? tr('Nova igreja', 'Nueva iglesia', 'New church')
                      : igrejaSelecionada?.nome || tr('Detalhes da igreja', 'Detalles de la iglesia', 'Church details')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {loadingDetail
                      ? tr('Carregando detalhes...', 'Cargando detalles...', 'Loading details...')
                      : tr('Edite aqui os dados centrais da igreja e as estruturas ligadas a ela.', 'Edita aquí los datos centrales de la iglesia y las estructuras vinculadas.', 'Edit the church core data and the related structures here.')}
                  </p>
                </div>
                <button
                  onClick={salvar}
                  disabled={saving || loadingDetail}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? tr('Salvando...', 'Guardando...', 'Saving...') : tr('Salvar', 'Guardar', 'Save')}
                </button>
              </div>

              <div className="space-y-10">
                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Identidade', 'Identidad', 'Identity')}</h3>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                    <p className="font-semibold">{tr('Como preencher os nomes da igreja', 'Cómo completar los nombres de la iglesia', 'How to fill in the church names')}</p>
                    <p className="mt-1">
                      {tr('Use o ', 'Usa el ', 'Use the ')}<strong>{tr('nome de exibição', 'nombre visible', 'display name')}</strong>{tr(' como nome principal no sistema. O ', ' como nombre principal en el sistema. El ', ' as the main name in the system. The ')}<strong>slug</strong>{tr(' é o identificador da URL. O ', ' es el identificador de la URL. El ', ' is the URL identifier. The ')}<strong>{tr('nome curto', 'nombre corto', 'short name')}</strong>{tr(' aparece em listas, seletores e espaços pequenos. O ', ' aparece en listas, selectores y espacios pequeños. El ', ' appears in lists, selectors, and small spaces. The ')}<strong>{tr('nome jurídico/oficial', 'nombre jurídico/oficial', 'legal/official name')}</strong>{tr(' só é necessário quando houver um nome formal maior para documentos ou apresentação institucional.', ' solo es necesario cuando exista un nombre formal más largo para documentos o presentación institucional.', ' is only necessary when there is a longer formal name for documents or institutional presentation.')}
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
                    <Input
                      label={tr('Nome de exibição', 'Nombre visible', 'Display name')}
                      value={form.nome}
                      onChange={(value) => updateForm('nome', value)}
                      placeholder={tr('Nome principal que o sistema vai mostrar', 'Nombre principal que mostrará el sistema', 'Main name that the system will show')}
                    />
                    <Input
                      label={tr('Identificador da URL', 'Identificador de la URL', 'URL identifier')}
                      value={form.slug}
                      onChange={(value) => updateForm('slug', slugify(value))}
                      placeholder={tr('Ex.: ip-manaus-centro', 'Ej.: ip-manaus-centro', 'Ex.: ip-manaus-centro')}
                    />
                    <Input
                      label={tr('Nome curto', 'Nombre corto', 'Short name')}
                      value={form.nome_abreviado}
                      onChange={(value) => updateForm('nome_abreviado', value)}
                      placeholder={tr('Versão resumida para listas, menus e cabeçalhos', 'Versión resumida para listas, menús y encabezados', 'Short version for lists, menus, and headers')}
                    />
                    <Input
                      label={tr('Nome jurídico ou oficial', 'Nombre jurídico u oficial', 'Legal or official name')}
                      value={form.nome_completo}
                      onChange={(value) => updateForm('nome_completo', value)}
                      placeholder={tr('Use só se existir um nome formal maior que o de exibição', 'Úsalo solo si existe un nombre formal más largo que el visible', 'Use only if there is a formal name longer than the display name')}
                    />
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{tr('Igreja ativa', 'Iglesia activa', 'Active church')}</span>
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={(event) => updateForm('ativo', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{tr('Visível no público', 'Visible al público', 'Visible publicly')}</span>
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
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Localização', 'Ubicación', 'Location')}</h3>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-3">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{tr('País', 'País', 'Country')}</span>
                      <select
                        value={form.pais}
                        onChange={(event) => updateForm('pais', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {countryOptions.map((pais) => (
                          <option key={pais.value} value={pais.value}>
                            {pais.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input label={tr('Cidade', 'Ciudad', 'City')} value={form.cidade} onChange={(value) => updateForm('cidade', value)} />
                    <Input
                      label={subdivisionLabel}
                      value={form.uf}
                      onChange={(value) => updateForm('uf', value)}
                      placeholder={subdivisionPlaceholder}
                    />
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <Input label={tr('Logradouro', 'Dirección', 'Street')} value={form.logradouro} onChange={(value) => updateForm('logradouro', value)} />
                    <Input label={tr('Complemento', 'Complemento', 'Additional info')} value={form.complemento} onChange={(value) => updateForm('complemento', value)} />
                    <Input label={tr('Bairro', 'Barrio', 'District')} value={form.bairro} onChange={(value) => updateForm('bairro', value)} />
                    <Input label="CEP" value={form.cep} onChange={(value) => updateForm('cep', value)} />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-medium text-slate-700">{tr('Endereço completo gerado automaticamente', 'Dirección completa generada automáticamente', 'Full address generated automatically')}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {tr('Montado a partir de logradouro, complemento, bairro, cidade, ', 'Generado a partir de dirección, complemento, barrio, ciudad, ', 'Built from street, additional info, district, city, ')}{subdivisionLabel.toLowerCase()}{tr(' e país.', ' y país.', ', and country.')}
                    </p>
                    <div className="mt-3 min-h-16 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {enderecoCompletoPreview || tr('Preencha os campos acima para gerar o endereço completo.', 'Completa los campos anteriores para generar la dirección completa.', 'Fill in the fields above to generate the full address.')}
                    </div>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-violet-700" />
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Contato e presença digital', 'Contacto y presencia digital', 'Contact and digital presence')}</h3>
                  </div>
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-900">
                    <p className="font-semibold">{tr('Redes sociais não ficam limitadas aqui.', 'Las redes sociales no se limitan aquí.', 'Social networks are not limited here.')}</p>
                    <p className="mt-1">
                      {tr('Neste bloco ficam os contatos principais da igreja. Para cadastrar uma ou várias redes sociais, use a seção ', 'En este bloque van los contactos principales de la iglesia. Para registrar una o varias redes sociales, usa la sección ', 'This block contains the church main contact information. To add one or more social networks, use the ')}<strong>{tr('Redes sociais', 'Redes sociales', 'Social networks')}</strong>{tr(' logo abaixo.', ' a continuación.', ' section below.')}
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-3 2xl:grid-cols-4">
                    <Input label={tr('Telefone', 'Teléfono', 'Phone')} value={form.telefone} onChange={(value) => updateForm('telefone', value)} />
                    <Input label="WhatsApp" value={form.whatsapp} onChange={(value) => updateForm('whatsapp', value)} />
                    <Input label={tr('E-mail', 'Correo electrónico', 'Email')} value={form.email} onChange={(value) => updateForm('email', value)} type="email" />
                    <Input label="Site" value={form.site} onChange={(value) => updateForm('site', value)} />
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-rose-700" />
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Apresentação pública', 'Presentación pública', 'Public presentation')}</h3>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
                    <p className="font-semibold">{tr('Esse bloco aparece na homepage como “Sobre a Igreja”.', 'Este bloque aparece en la página principal como “Sobre la Iglesia”.', 'This block appears on the homepage as “About the Church”.')}</p>
                    <p className="mt-1">
                      {tr('O link só aparece no público quando houver ', 'El enlace solo aparece al público cuando exista ', 'The link only appears publicly when there is ')}<strong>{tr('título', 'título', 'title')}</strong>{tr(' ou ', ' o ', ' or ')}<strong>{tr('texto', 'texto', 'text')}</strong>{tr('. As mídias são opcionais e entram como apoio visual da apresentação.', '. Los medios son opcionales y sirven como apoyo visual de la presentación.', '. Media is optional and works as visual support for the presentation.')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {tr('Título e texto por idioma', 'Título y texto por idioma', 'Title and text by language')}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {tr('Português também alimenta o fallback legado atual.', 'Portugués también alimenta el fallback legado actual.', 'Portuguese also feeds the current legacy fallback.')}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-5 xl:grid-cols-3">
                      {PRESENTATION_LOCALES.map((item) => (
                        <div key={item.value} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h5 className="text-sm font-semibold text-slate-900">{item.label}</h5>
                            {item.value === 'pt' && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                                {tr('Fallback', 'Fallback', 'Fallback')}
                              </span>
                            )}
                          </div>
                          <Input
                            label={tr('Título da apresentação', 'Título de la presentación', 'Presentation title')}
                            value={form.apresentacao_titulo_i18n[item.value]}
                            onChange={(value) => updateLocalizedField('apresentacao_titulo_i18n', item.value, value)}
                            placeholder={
                              item.value === 'pt'
                                ? 'Ex.: Uma comunidade para adorar, servir e acolher'
                                : item.value === 'es'
                                  ? 'Ej.: Una comunidad para adorar, servir y acoger'
                                  : 'Ex.: A community to worship, serve, and welcome'
                            }
                          />
                          <Textarea
                            label={tr('Texto institucional', 'Texto institucional', 'Institutional text')}
                            value={form.apresentacao_texto_i18n[item.value]}
                            onChange={(value) => updateLocalizedField('apresentacao_texto_i18n', item.value, value)}
                            rows={6}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <Input
                      label={tr('Imagem principal', 'Imagen principal', 'Main image')}
                      value={form.apresentacao_imagem_url}
                      onChange={(value) => updateForm('apresentacao_imagem_url', value)}
                      placeholder="https://..."
                    />
                    <Input
                      label={tr('Vídeo do YouTube', 'Video de YouTube', 'YouTube video')}
                      value={form.apresentacao_youtube_url}
                      onChange={(value) => updateForm('apresentacao_youtube_url', value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <Textarea
                      label={tr('Galeria de fotos', 'Galería de fotos', 'Photo gallery')}
                      value={form.apresentacao_galeria}
                      onChange={(value) => updateForm('apresentacao_galeria', value)}
                      rows={4}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {tr('Na galeria, use uma URL por linha. Se o texto institucional estiver vazio, o link “Sobre a igreja” não será exibido.', 'En la galería, usa una URL por línea. Si el texto institucional está vacío, el enlace “Sobre la iglesia” no se mostrará.', 'In the gallery, use one URL per line. If the institutional text is empty, the “About the church” link will not be shown.')}
                  </p>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-amber-700" />
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Configurações da igreja', 'Configuraciones de la iglesia', 'Church settings')}</h3>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{tr('Modo de repertório', 'Modo de repertorio', 'Repertoire mode')}</span>
                      <select
                        value={form.modo_repertorio}
                        onChange={(event) => updateForm('modo_repertorio', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">{tr('Selecione', 'Selecciona', 'Select')}</option>
                        {repertoryOptions.map((modo) => (
                          <option key={modo.value} value={modo.value}>
                            {modo.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{tr('Timezone do boletim', 'Zona horaria del boletín', 'Bulletin timezone')}</span>
                      <select
                        value={form.timezone_boletim}
                        onChange={(event) => updateForm('timezone_boletim', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">{tr('Selecione', 'Selecciona', 'Select')}</option>
                        {TIMEZONES_DISPONIVEIS.map((timezone) => (
                          <option key={timezone.value} value={timezone.value}>
                            {timezone.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{tr('Dia de publicação do boletim', 'Día de publicación del boletín', 'Bulletin publication day')}</span>
                      <select
                        value={form.dia_publicacao_boletim}
                        onChange={(event) => updateForm('dia_publicacao_boletim', event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">{tr('Selecione', 'Selecciona', 'Select')}</option>
                        {publicationDayOptions.map((dia) => (
                          <option key={dia.value} value={dia.value}>
                            {dia.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[220px_220px_minmax(0,1fr)]">
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{tr('Hora de publicação', 'Hora de publicación', 'Publication time')}</span>
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
                        <option value="">{tr('Hora', 'Hora', 'Hour')}</option>
                        {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')).map((hora) => (
                          <option key={hora} value={hora}>
                            {hora}h
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium text-slate-700">{tr('Minutos', 'Minutos', 'Minutes')}</span>
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
                        <option value="">{tr('Min', 'Min', 'Min')}</option>
                        {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map((minuto) => (
                          <option key={minuto} value={minuto}>
                            {minuto}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-medium text-slate-700">{tr('Formato exibido', 'Formato mostrado', 'Displayed format')}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatHorarioPublicacaoLabel(
                          horarioParts.hora,
                          horarioParts.minuto,
                          tr
                        )}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">{tr('Permite cadastro de cânticos', 'Permite registro de cánticos', 'Allows song registration')}</span>
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
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Agenda de cultos', 'Agenda de cultos', 'Service schedule')}</h3>
                  </div>
                  <div className="space-y-3">
                    {form.cultos.map((culto, index) => (
                      <div key={`culto-${index}`} className="rounded-2xl border border-slate-200 p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{tr(`Culto ${index + 1}`, `Culto ${index + 1}`, `Service ${index + 1}`)}</p>
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
                            {tr('Remover', 'Eliminar', 'Remove')}
                          </button>
                        </div>
                        <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
                          <Input
                            label={tr('Nome', 'Nombre', 'Name')}
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
                            <span className="text-sm font-medium text-slate-700">{tr('Dia da semana', 'Día de la semana', 'Weekday')}</span>
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
                                  {weekdayLabelMap[dia] || dia}
                                </option>
                              ))}
                            </select>
                          </label>
                          <Input
                            label={tr('Horário', 'Horario', 'Time')}
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
                            label={tr('Ordem', 'Orden', 'Order')}
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
                            label={tr('Descrição', 'Descripción', 'Description')}
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
                            <span className="text-sm font-medium text-slate-700">{tr('Ativo', 'Activo', 'Active')}</span>
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
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Redes sociais', 'Redes sociales', 'Social networks')}</h3>
                  </div>
                  <div className="space-y-3">
                    {form.redesSociais.map((rede, index) => (
                      <div key={`rede-${index}`} className="grid gap-5 rounded-2xl border border-slate-200 p-5 xl:grid-cols-[220px_minmax(0,1fr)_130px_180px]">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium text-slate-700">{tr('Tipo', 'Tipo', 'Type')}</span>
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
                          label={tr('Ordem', 'Orden', 'Order')}
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
                            {tr('Ativa', 'Activa', 'Active')}
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
                    {tr('Adicionar rede', 'Agregar red', 'Add network')}
                  </button>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <Church className="h-4 w-4 text-indigo-700" />
                    <h3 className="text-lg font-semibold text-slate-900">{tr('Liturgia da igreja', 'Liturgia de la iglesia', 'Church liturgy')}</h3>
                  </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 xl:p-6">
                    <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
                      <p className="text-sm font-semibold text-indigo-950">{tr('Fluxo simples para configurar a liturgia', 'Flujo simple para configurar la liturgia', 'Simple flow to configure the liturgy')}</p>
                      <p className="mt-1 text-sm text-indigo-900">
                        {tr('1. Adicione os tipos que a igreja usa. 2. Cada tipo entra automaticamente na ordem do culto. 3. Depois, só reorganize e ajuste os textos padrão.', '1. Agrega los tipos que usa la iglesia. 2. Cada tipo entra automáticamente en el orden del culto. 3. Después, solo reorganiza y ajusta los textos estándar.', '1. Add the types the church uses. 2. Each type enters the service order automatically. 3. Then just reorder and adjust the default texts.')}
                      </p>
                    </div>

                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)] 2xl:grid-cols-[minmax(420px,0.95fr)_minmax(0,1.45fr)]">
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6">
                      <p className="mb-2 text-sm font-semibold text-slate-900">{tr('1. Tipos disponíveis', '1. Tipos disponibles', '1. Available types')}</p>
                      <p className="mb-4 text-sm text-slate-500">
                        {tr('Adicione aqui as partes que a igreja usa na liturgia. Ao adicionar um tipo, ele já entra automaticamente na ordem padrão do culto.', 'Agrega aquí las partes que la iglesia usa en la liturgia. Al agregar un tipo, ya entra automáticamente en el orden estándar del culto.', 'Add here the parts the church uses in the liturgy. When you add a type, it automatically enters the default service order.')}
                      </p>

                      <div className="mb-4 flex flex-wrap gap-2">
                        {form.tiposLiturgicos.length === 0 && (
                          <span className="text-sm text-slate-400">{tr('Nenhum tipo cadastrado.', 'Ningún tipo registrado.', 'No type registered.')}</span>
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
                          placeholder={tr('Ex.: Leitura responsiva', 'Ej.: Lectura responsiva', 'Ex.: Responsive reading')}
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
                          {tr('Adicionar tipo', 'Agregar tipo', 'Add type')}
                        </button>
                      </div>

                      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {tr('Sugestões rápidas', 'Sugerencias rápidas', 'Quick suggestions')}
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
                          <p className="text-sm font-semibold text-slate-900">{tr('2. Ordem padrão do culto', '2. Orden estándar del culto', '2. Default service order')}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {tr('Aqui você só organiza a sequência e define o texto padrão de cada parte do culto.', 'Aquí solo organizas la secuencia y defines el texto estándar de cada parte del culto.', 'Here you just organize the sequence and define the default text for each service part.')}
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
                              {tr('Gerar ordem inicial', 'Generar orden inicial', 'Generate initial order')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => addModeloLiturgia(form.tiposLiturgicos[0] || '')}
                            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Plus className="h-4 w-4" />
                            {tr('Adicionar item extra', 'Agregar ítem extra', 'Add extra item')}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">
                            {tr('Adicione os tipos litúrgicos na coluna à esquerda para começar.', 'Agrega los tipos litúrgicos en la columna izquierda para comenzar.', 'Add liturgical types in the left column to get started.')}
                          </div>
                        )}

                        {form.modelosLiturgia.length === 0 && form.tiposLiturgicos.length > 0 && (
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                            {tr('Você já tem tipos cadastrados. Clique em ', 'Ya tienes tipos registrados. Haz clic en ', 'You already have registered types. Click ')}<strong>{tr('Gerar ordem inicial', 'Generar orden inicial', 'Generate initial order')}</strong>{tr(' para montar a sequência automaticamente.', ' para montar la secuencia automáticamente.', ' to build the sequence automatically.')}
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
                                  <p className="text-sm font-semibold text-slate-900">{tr('Item da ordem', 'Ítem del orden', 'Order item')}</p>
                                  <p className="text-xs text-slate-500">
                                    {tr('Use as setas ou escolha a nova posição para reorganizar a sequência.', 'Usa las flechas o elige la nueva posición para reorganizar la secuencia.', 'Use the arrows or choose the new position to reorder the sequence.')}
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
                                  {tr('Remover', 'Eliminar', 'Remove')}
                                </button>
                              </div>
                            </div>

                            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_160px] 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_180px]">
                              <label className="block space-y-1">
                                <span className="text-sm font-medium text-slate-700">{tr('Tipo litúrgico', 'Tipo litúrgico', 'Liturgical type')}</span>
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
                                  <option value="">{tr('Selecione um tipo', 'Selecciona un tipo', 'Select a type')}</option>
                                  {form.tiposLiturgicos.map((tipo) => (
                                    <option key={tipo} value={tipo}>
                                      {tipo}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <Input
                                label={tr('Título exibido no culto', 'Título mostrado en el culto', 'Title shown in the service')}
                                value={modelo.bloco}
                                onChange={(value) => patchModeloLiturgia(index, { bloco: value })}
                                placeholder={tr('Opcional. Se não mudar, pode repetir o tipo', 'Opcional. Si no cambia, puede repetir el tipo', 'Optional. If unchanged, it can repeat the type')}
                              />

                              <label className="block space-y-1">
                                <span className="text-sm font-medium text-slate-700">{tr('Posição na ordem', 'Posición en el orden', 'Position in order')}</span>
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
                                <p className="text-xs font-medium text-slate-500">
                                  {tr(
                                    `Editando os textos padrão em ${activeLocaleLabel}. O português continua como fallback principal.`,
                                    `Editando los textos estándar en ${activeLocaleLabel}. El portugués sigue como fallback principal.`,
                                    `Editing the default texts in ${activeLocaleLabel}. Portuguese remains the main fallback.`
                                  )}
                                </p>
                                <Textarea
                                  label={tr('Texto público', 'Texto público', 'Public text')}
                                  value={modelo.conteudo_publico_padrao_i18n[locale]}
                                  onChange={(value) =>
                                    patchModeloLiturgiaLocalized(
                                      index,
                                      'conteudo_publico_padrao_i18n',
                                      locale,
                                      value
                                    )
                                  }
                                  rows={2}
                                />
                                <Textarea
                                  label={tr('Texto interno', 'Texto interno', 'Internal text')}
                                  value={modelo.descricao_interna_padrao_i18n[locale]}
                                  onChange={(value) =>
                                    patchModeloLiturgiaLocalized(
                                      index,
                                      'descricao_interna_padrao_i18n',
                                      locale,
                                      value
                                    )
                                  }
                                  rows={2}
                                />
                              </div>
                              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                                <span className="text-sm font-medium text-slate-700">{tr('Tem cântico', 'Tiene cántico', 'Has song')}</span>
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
