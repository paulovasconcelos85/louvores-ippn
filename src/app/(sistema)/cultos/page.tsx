'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { jsPDF } from 'jspdf';
import { getStoredChurchId } from '@/lib/church-utils';

const TIPOS_LITURGICOS_PADRAO = [
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

const TIPOS_SECOES_BOLETIM = [
  { tipo: 'avisos', titulo: 'Avisos', icone: 'megaphone', emoji: '📢' },
  { tipo: 'oracao', titulo: 'Pedidos de Oração', icone: 'hands.sparkles', emoji: '🙏' },
  { tipo: 'agenda', titulo: 'Agenda', icone: 'calendar', emoji: '📅' },
  { tipo: 'informativo', titulo: 'Informativo', icone: 'info.circle', emoji: 'ℹ️' },
  { tipo: 'outro', titulo: 'Informações', icone: 'list.bullet', emoji: '📝' },
] as const;

const TIPOS_SECOES_SISTEMA = new Set(['imagem_tema', 'palavra_pastoral', 'liturgia']);
const HABILITAR_BOLETIM_SECOES_NEXT = false;

// --- TIPOS ---
interface Cantico {
  id: string | number;
  nome: string;
  tipo?: string;
  numero?: string | null;
  ultima_vez?: string | null;
}

interface CanticoNoItem {
  cantico_id: string | null;
  tom: string | null;
}

interface LouvorItem {
  id?: string;
  tipo: string;
  ordem: number;
  conteudo_publico: string | null;
  descricao: string | null;
  horario: string | null;
  canticos_lista: CanticoNoItem[];
}

interface BoletimSecaoRow {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
}

interface BoletimItemRow {
  id: string;
  secao_id: string | null;
  conteudo: string;
  destaque: boolean | null;
  ordem: number | null;
  criado_em: string | null;
}

interface BoletimItemRascunho {
  id: string;
  conteudo: string;
  destaque: boolean;
}

interface AgendaItemRascunho {
  id: string;
  data: string;
  hora: string;
  descricao: string;
  temHora: boolean;
}

interface BoletimSecaoRascunho {
  id: string;
  tipo: string;
  titulo: string;
  icone: string | null;
  visivel: boolean;
  ordem: number;
  itens: BoletimItemRascunho[];
}

interface ModeloLiturgiaConfig {
  bloco: string;
  ordem: number;
  tipo: string;
  conteudo_publico_padrao: string;
  descricao_interna_padrao: string;
  descricao_padrao: string;
  tem_cantico: boolean;
}

interface LiturgiaChurchConfig {
  tiposLiturgicos: string[];
  modelosLiturgia: ModeloLiturgiaConfig[];
  pastorPadrao: string | null;
}

interface Culto {
  'Culto nr.': number;
  Dia: string;
  imagem_url?: string | null;
  palavra_pastoral?: string | null;
  palavra_pastoral_autor?: string | null;
}

interface LouvorItemRow {
  id: string;
  culto_id: number;
  ordem: number | null;
  tipo: string | null;
  tom: string | null;
  cantico_id: string | null;
  conteudo_publico: string | null;
  descricao: string | null;
  horario: string | null;
}

interface LouvorItemRowComCantico extends LouvorItemRow {
  canticos: { nome: string | null } | null;
}

type ItemAgrupado = {
  tipo: string;
  horario: string | null;
  conteudo_publico: string | null;
  descricao: string | null;
  canticos: { nome: string; tom: string | null }[];
};

// --- HELPERS ---
function isPrimeirosDomingo(data: Date): boolean {
  const d = new Date(data);
  return d.getDay() === 0 && d.getDate() <= 7;
}

function extractTiposLiturgicos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const row = item as Record<string, unknown>;
      const candidate = row.nome || row.label || row.tipo || row.titulo;
      return typeof candidate === 'string' ? candidate.trim() : '';
    })
    .filter(Boolean);
}

function extractModeloLiturgicoPadrao(value: unknown): ModeloLiturgiaConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const bloco = typeof row.bloco === 'string' ? row.bloco.trim() : '';
      const tipo = typeof row.tipo === 'string' ? row.tipo.trim() : '';
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
    .filter(Boolean) as ModeloLiturgiaConfig[];
}

function mergeModelosLiturgia(
  modelosTabela: ModeloLiturgiaConfig[],
  modelosFallback: ModeloLiturgiaConfig[]
): ModeloLiturgiaConfig[] {
  const merged = new Map<string, ModeloLiturgiaConfig>();

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

function resolveTiposLiturgicos(config?: LiturgiaChurchConfig | null) {
  return config?.tiposLiturgicos?.length ? config.tiposLiturgicos : TIPOS_LITURGICOS_PADRAO;
}

function modeloPadraoDaConfiguracao(config?: LiturgiaChurchConfig | null): LouvorItem[] {
  const modelos = [...(config?.modelosLiturgia || [])].sort((a, b) => a.ordem - b.ordem);

  return modelos.map((item, index) => {
    const tipo = item.tipo || item.bloco || `Item ${index + 1}`;

    return {
      tipo,
      ordem: index + 1,
      conteudo_publico: item.conteudo_publico_padrao || null,
      descricao: item.descricao_interna_padrao || item.descricao_padrao || null,
      horario: null,
      canticos_lista: item.tem_cantico ? [{ cantico_id: null, tom: null }] : [],
    };
  });
}

function modeloPadrao(dia: string, config?: LiturgiaChurchConfig | null): LouvorItem[] {
  const modeloConfigurado = modeloPadraoDaConfiguracao(config);
  if (modeloConfigurado.length > 0) return modeloConfigurado;

  const data = new Date(dia + 'T00:00:00');
  const primeiroDomingo = isPrimeirosDomingo(data);

  const itens: LouvorItem[] = [
    { tipo: 'Prelúdio', ordem: 1, conteudo_publico: null, descricao: null, horario: '9h-9h05', canticos_lista: [] },
    { tipo: 'Saudação e Acolhida à Igreja', ordem: 2, conteudo_publico: null, descricao: 'Salmo 138.1-2\nIgreja da Família de Deus\nLeitura Responsiva: Salmo ____ (_______)\nOração de Invocação e Entrega do Culto ao Senhor (_______)', horario: '9h05-9h10', canticos_lista: [] },
    { tipo: 'Cânticos Congregacionais', ordem: 3, conteudo_publico: null, descricao: null, horario: '9h10-9h25', canticos_lista: [{ cantico_id: null, tom: null }, { cantico_id: null, tom: null }, { cantico_id: null, tom: null }] },
    { tipo: 'Confissão de Pecados', ordem: 4, conteudo_publico: null, descricao: 'Leitura Não Responsiva e Oração: Salmo 40.1-3 (_______)\nDar minutos para os irmãos.\nOração pelos enfermos.', horario: '9h25-9h30', canticos_lista: [] },
    { tipo: 'Dízimos e Ofertas', ordem: 5, conteudo_publico: null, descricao: 'Passagem de Dízimos e Ofertas. 1 Tm 6.17-19\nLembrar aos presentes colocar o código 0,09 no PIX;\nEnvelopes de Dízimo.', horario: '9h30-9h35', canticos_lista: [] },
    { tipo: 'Cântico para as Ofertas e Dízimos', ordem: 6, conteudo_publico: null, descricao: 'Oração pelas ofertas e dízimo.', horario: '9h35-9h40', canticos_lista: [{ cantico_id: null, tom: null }] },
    { tipo: 'Oração pelas Crianças', ordem: 7, conteudo_publico: null, descricao: 'Chamar irmão (_______)', horario: '9h40-9h45', canticos_lista: [] },
    { tipo: 'Pregação da Palavra', ordem: 8, conteudo_publico: null, descricao: null, horario: '9h45-10h25', canticos_lista: [] },
  ];

  if (primeiroDomingo) {
    itens.push({ tipo: 'Santa Ceia', ordem: 9, conteudo_publico: null, descricao: null, horario: '10h25', canticos_lista: [] });
  }

  itens.push(
    { tipo: 'Cântico Final', ordem: itens.length + 1, conteudo_publico: null, descricao: 'Poslúdio', horario: '10h25', canticos_lista: [{ cantico_id: null, tom: null }] },
    { tipo: 'Oração Final e Bênção Apostólica', ordem: itens.length + 2, conteudo_publico: null, descricao: 'Amém tríplice', horario: '10h30', canticos_lista: [] },
    { tipo: 'Lembretes', ordem: itens.length + 3, conteudo_publico: null, descricao: 'Apresentação dos convidados\nAniversariantes / Casamento', horario: '10h35', canticos_lista: [] },
  );

  return itens.map((it, i) => ({ ...it, ordem: i + 1 }));
}

function getStatusMusica(dataStr: string | null | undefined) {
  if (!dataStr) return { label: 'PRIMEIRA VEZ', cor: 'text-blue-600', bg: 'bg-blue-50', dias: -1, dataFormatada: 'Nunca tocada' };
  const data = new Date(dataStr + 'T00:00:00');
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000);
  const fmt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (dias < 30) return { label: 'RECENTE', cor: 'text-emerald-600', bg: 'bg-emerald-50', dias, dataFormatada: fmt };
  if (dias < 90) return { label: 'MODERADO', cor: 'text-amber-600', bg: 'bg-amber-50', dias, dataFormatada: fmt };
  if (dias < 180) return { label: 'HÁ TEMPO', cor: 'text-orange-600', bg: 'bg-orange-50', dias, dataFormatada: fmt };
  return { label: 'HÁ MUITO', cor: 'text-red-600', bg: 'bg-red-50', dias, dataFormatada: fmt };
}

function formatCultoDateLabel(dateValue: string) {
  const formatted = new Date(dateValue + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getBoletimTipoConfig(tipo: string) {
  return TIPOS_SECOES_BOLETIM.find((item) => item.tipo === tipo) || TIPOS_SECOES_BOLETIM[TIPOS_SECOES_BOLETIM.length - 1];
}

function createEmptyBoletimItem(): BoletimItemRascunho {
  return {
    id: createDraftId('boletim-item'),
    conteudo: '',
    destaque: false,
  };
}

function createEmptyAgendaItem(): AgendaItemRascunho {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return {
    id: createDraftId('agenda-item'),
    data: `${yyyy}-${mm}-${dd}`,
    hora: '09:00',
    descricao: '',
    temHora: true,
  };
}

function normalizarSecoesBoletim(secoes: BoletimSecaoRascunho[]) {
  return secoes.map((secao, index) => ({
    ...secao,
    ordem: index,
  }));
}

function parseAgendaConteudo(conteudo: string): AgendaItemRascunho {
  const partes = conteudo.split('|');
  const [dataRaw, horaRaw, ...descricaoPartes] = partes;
  const descricao = descricaoPartes.join('|').trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw || '') ? (dataRaw as string) : createEmptyAgendaItem().data;
  const hora = /^\d{2}:\d{2}$/.test(horaRaw || '') ? (horaRaw as string) : '09:00';

  return {
    id: createDraftId('agenda-item'),
    data,
    hora,
    descricao: descricao || conteudo.trim(),
    temHora: horaRaw !== '00:00',
  };
}

function serializeAgendaConteudo(item: AgendaItemRascunho) {
  return `${item.data}|${item.temHora ? item.hora : '00:00'}|${item.descricao.trim()}`;
}

function montarConteudoLiturgiaParaBoletim(item: LouvorItem, index: number, canticos: Cantico[]) {
  const linhas = [item.tipo || `Item ${index + 1}`];
  const conteudoPublico = item.conteudo_publico?.trim();
  const descricao = item.descricao?.trim();

  if (conteudoPublico) {
    linhas.push(conteudoPublico);
  }

  if (descricao) {
    linhas.push(descricao);
  }

  item.canticos_lista.forEach((canticoNoItem) => {
    if (!canticoNoItem.cantico_id) return;

    const cantico = canticos.find((entry) => String(entry.id) === String(canticoNoItem.cantico_id));
    const nome = cantico?.nome?.trim();

    if (!nome) return;

    linhas.push(`Cantico: ${nome}${canticoNoItem.tom ? ` (${canticoNoItem.tom})` : ''}`);
  });

  return linhas.join('\n');
}

async function buscarPastorPadrao(igrejaId: string): Promise<string | null> {
  try {
    const { data: vinculosPastor, error: vinculoError } = await supabase
      .from('pessoas_igrejas')
      .select('pessoa_id')
      .eq('igreja_id', igrejaId)
      .eq('cargo', 'pastor')
      .eq('ativo', true)
      .limit(10);

    if (!vinculoError) {
      const pessoaIds = (vinculosPastor || [])
        .map((item) => item.pessoa_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      if (pessoaIds.length > 0) {
        const { data: pessoasData, error: pessoasError } = await supabase
          .from('pessoas')
          .select('id, nome')
          .in('id', pessoaIds)
          .order('nome', { ascending: true })
          .limit(1);

        if (!pessoasError) {
          const nomeVinculado =
            typeof pessoasData?.[0]?.nome === 'string' ? pessoasData[0].nome.trim() : '';

          if (nomeVinculado) {
            return nomeVinculado;
          }
        } else {
          console.warn('Falha ao buscar nomes dos pastores vinculados:', pessoasError);
        }
      }
    } else {
      console.warn('Falha ao buscar pastor por vínculo da igreja:', vinculoError);
    }

    return null;
  } catch (error) {
    console.warn('Falha inesperada ao buscar pastor padrão da igreja:', error);
    return null;
  }
}

async function carregarLouvorItensComCanticos(
  cultoId: number,
  canticosFallback: Cantico[] = []
): Promise<LouvorItemRowComCantico[]> {
  const { data: itens, error: itensError } = await supabase
    .from('louvor_itens')
    .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, descricao, horario')
    .eq('culto_id', cultoId)
    .order('ordem');

  if (itensError) throw itensError;

  const itemRows = (itens || []) as LouvorItemRow[];
  const canticoIds = Array.from(
    new Set(
      itemRows
        .map((item) => item.cantico_id)
        .filter(Boolean)
        .map((value) => String(value))
    )
  );
  const canticoIdsUuid = canticoIds.filter(isUuid);

  const [canticosLegadosResult, canticosUnificadosResult] =
    canticoIdsUuid.length > 0
      ? await Promise.all([
          supabase.from('canticos').select('id, nome').in('id', canticoIdsUuid),
          supabase.from('canticos_unificados').select('id, nome').in('id', canticoIdsUuid),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (canticosLegadosResult.error) throw canticosLegadosResult.error;
  if (canticosUnificadosResult.error) throw canticosUnificadosResult.error;

  const canticosPorId = new Map<string, string | null>();

  canticosFallback.forEach((cantico) => {
    canticosPorId.set(String(cantico.id), cantico.nome);
  });

  ((canticosLegadosResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId) || !canticosPorId.get(canticoId)) {
      canticosPorId.set(canticoId, cantico.nome);
    }
  });

  ((canticosUnificadosResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId) || !canticosPorId.get(canticoId)) {
      canticosPorId.set(canticoId, cantico.nome);
    }
  });

  return itemRows.map((item) => ({
    ...item,
    canticos: item.cantico_id
      ? { nome: canticosPorId.get(String(item.cantico_id)) || null }
      : null,
  }));
}

function agruparItensLiturgia(data: LouvorItemRowComCantico[]): ItemAgrupado[] {
  const agrupados: ItemAgrupado[] = [];

  for (const it of data) {
    const ultimo = agrupados[agrupados.length - 1];

    if (
      ultimo &&
      ultimo.tipo === (it.tipo || '') &&
      ultimo.horario === it.horario &&
      ultimo.conteudo_publico === it.conteudo_publico &&
      ultimo.descricao === it.descricao
    ) {
      if (it.canticos?.nome) {
        ultimo.canticos.push({ nome: it.canticos.nome, tom: it.tom });
      }
      continue;
    }

    agrupados.push({
      tipo: it.tipo || '',
      horario: it.horario,
      conteudo_publico: it.conteudo_publico,
      descricao: it.descricao,
      canticos: it.canticos?.nome ? [{ nome: it.canticos.nome, tom: it.tom }] : [],
    });
  }

  return agrupados;
}

// --- AUTOCOMPLETE DE CÂNTICO ---
function CanticoAutocomplete({ value, onChange, canticos, onCreate, disabled }: {
  value: Cantico | null;
  onChange: (c: Cantico | null) => void;
  canticos: Cantico[];
  onCreate: (nome: string) => Promise<Cantico>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value?.nome || '');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(value?.nome || ''); }, [value]);

  const filtrados = canticos.filter(c =>
    c.nome.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const abrirDropdown = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(256, filtrados.length * 60 + 56);
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 300),
      zIndex: 9999,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setOpen(true);
  };

  const dropdown = open && query && !disabled ? (
    <div
      style={dropdownStyle}
      className="bg-white border border-slate-200 rounded-2xl max-h-64 overflow-auto shadow-2xl"
    >
      {filtrados.map(c => {
        const st = getStatusMusica(c.ultima_vez);
        const titulo =
          c.tipo === 'hinario' && c.numero
            ? `Hino ${c.numero} · ${c.nome}`
            : c.nome;
        return (
          <div
            key={c.id}
            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 active:bg-slate-100"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onChange(c); setQuery(c.nome); setOpen(false); }}
          >
            <div className="text-base font-semibold text-slate-800">{titulo}</div>
            <div className={`text-xs font-bold mt-0.5 ${st.cor}`}>{st.label} · {st.dataFormatada}</div>
          </div>
        );
      })}
      {!canticos.some(c => c.nome.toLowerCase() === query.toLowerCase()) && (
        <div
          className="px-4 py-3 text-emerald-700 font-bold text-base hover:bg-emerald-50 cursor-pointer border-t border-emerald-100 active:bg-emerald-100"
          onMouseDown={e => e.preventDefault()}
          onClick={async () => { const n = await onCreate(query); onChange(n); setQuery(n.nome); setOpen(false); }}
        >
          + Cadastrar &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={query}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); abrirDropdown(); if (!e.target.value) onChange(null); }}
        onFocus={abrirDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar cântico..."
        className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500 bg-emerald-50/50 disabled:bg-slate-50 disabled:cursor-default"
      />
      {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

// --- LINHA DE CÂNTICO ---
function LinhaCantico({ musica, canticos, onChange, onRemove, podVerTom, onCreate, canEditarMusica }: any) {
  const cantico =
    canticos.find((c: Cantico) => String(c.id) === String(musica.cantico_id || '')) || null;

  return (
    <div className="flex items-center gap-2 mt-3 pl-3 border-l-2 border-emerald-300">
      <span className="text-emerald-500 text-base flex-shrink-0">🎵</span>
      <CanticoAutocomplete
        value={cantico}
        onChange={c => onChange({ ...musica, cantico_id: c?.id ? String(c.id) : null })}
        canticos={canticos}
        onCreate={onCreate}
        disabled={!canEditarMusica}
      />
      {podVerTom && (
        <select
          value={musica.tom || ''}
          onChange={e => onChange({ ...musica, tom: e.target.value })}
          disabled={!canEditarMusica}
          className="border border-slate-200 rounded-xl px-2 py-3 text-base bg-white w-24 focus:outline-none focus:border-emerald-500 disabled:bg-slate-50 flex-shrink-0"
        >
          <option value="">Tom</option>
          {['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Am', 'Em', 'Dm'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      {canEditarMusica && (
        <button onClick={onRemove} className="text-slate-300 hover:text-red-400 active:text-red-500 transition-colors text-2xl leading-none w-10 h-10 flex items-center justify-center flex-shrink-0">×</button>
      )}
    </div>
  );
}

// --- ITEM DA LITURGIA (linha) ---
function ItemLiturgia({ item, index, canticos, onCreate, onUpdate, onRemove, onMove, isLideranca, podVerTom, canEditarMusica }: any) {
  const [expandido, setExpandido] = useState(true);

  const adicionarCantico = () => {
    onUpdate({ ...item, canticos_lista: [...item.canticos_lista, { cantico_id: null, tom: null }] });
  };

  const atualizarCantico = (idx: number, nova: CanticoNoItem) => {
    const lista = [...item.canticos_lista];
    lista[idx] = nova;
    onUpdate({ ...item, canticos_lista: lista });
  };

  const removerCantico = (idx: number) => {
    onUpdate({ ...item, canticos_lista: item.canticos_lista.filter((_: any, i: number) => i !== idx) });
  };

  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all">
      {/* Cabeçalho do item */}
      <div className="flex items-center gap-3 px-4 py-4 bg-slate-50/80">
        <span className="text-sm font-black text-slate-400 w-6 text-center flex-shrink-0">{index + 1}</span>

        {/* Tipo litúrgico */}
        {isLideranca ? (
          <select
            value={item.tipo}
            onChange={e => onUpdate({ ...item, tipo: e.target.value })}
            className="flex-1 font-bold text-slate-800 text-base bg-transparent border-none focus:outline-none cursor-pointer min-w-0"
          >
            {(item.tiposLiturgicosDisponiveis || TIPOS_LITURGICOS_PADRAO).map((t: string) => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <span className="flex-1 font-bold text-slate-800 text-base min-w-0">{item.tipo}</span>
        )}

        {/* Horário (interno) */}
        {HABILITAR_BOLETIM_SECOES_NEXT && isLideranca && (
          <input
            value={item.horario || ''}
            onChange={e => onUpdate({ ...item, horario: e.target.value })}
            placeholder="horário"
            className="w-24 text-sm text-slate-500 border border-slate-200 rounded-xl px-2 py-2.5 bg-white focus:outline-none focus:border-slate-400 text-center flex-shrink-0"
          />
        )}

        {/* Ações */}
        {isLideranca && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onMove('cima')} className="w-9 h-9 hover:bg-slate-200 rounded-xl text-slate-400 text-base flex items-center justify-center active:bg-slate-300">↑</button>
            <button onClick={() => onMove('baixo')} className="w-9 h-9 hover:bg-slate-200 rounded-xl text-slate-400 text-base flex items-center justify-center active:bg-slate-300">↓</button>
            <button onClick={onRemove} className="w-9 h-9 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-400 text-base flex items-center justify-center active:bg-red-100">🗑</button>
          </div>
        )}

        <button onClick={() => setExpandido(!expandido)} className="text-slate-400 hover:text-slate-600 w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 active:bg-slate-100">
          {expandido ? '▲' : '▼'}
        </button>
      </div>

      {expandido && (
        <div className="px-4 py-4 space-y-4">
          {/* Campo público */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">
              <span>📢</span> Público
            </label>
            <textarea
              value={item.conteudo_publico || ''}
              onChange={e => onUpdate({ ...item, conteudo_publico: e.target.value })}
              disabled={!isLideranca}
              placeholder="Visível para todos..."
              rows={2}
              className="w-full text-base text-slate-700 border border-emerald-100 rounded-xl px-4 py-3 bg-emerald-50/30 focus:outline-none focus:border-emerald-300 resize-none disabled:cursor-default disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:py-0 placeholder:text-slate-300"
            />
          </div>

          {/* Campo interno */}
          {isLideranca && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <span>🔒</span> Interno
              </label>
              <textarea
                value={item.descricao || ''}
                onChange={e => onUpdate({ ...item, descricao: e.target.value })}
                placeholder="Observações internas (só liderança vê)..."
                rows={2}
                className="w-full text-base text-slate-600 border border-slate-100 rounded-xl px-4 py-3 bg-slate-50/50 focus:outline-none focus:border-slate-300 resize-none placeholder:text-slate-300"
              />
            </div>
          )}

          {/* Cânticos */}
          <div>
            {item.canticos_lista.map((m: CanticoNoItem, idx: number) => (
              <LinhaCantico
                key={idx}
                musica={m}
                canticos={canticos}
                onChange={(nova: CanticoNoItem) => atualizarCantico(idx, nova)}
                onRemove={() => removerCantico(idx)}
                podVerTom={podVerTom}
                onCreate={onCreate}
                canEditarMusica={canEditarMusica}
              />
            ))}
            {canEditarMusica && (
              <button
                onClick={adicionarCantico}
                className="mt-3 ml-2 text-emerald-600 hover:text-emerald-800 text-base font-bold flex items-center gap-2 hover:bg-emerald-50 px-3 py-2.5 rounded-xl transition-colors active:bg-emerald-100"
              >
                <span>🎵</span> Adicionar cântico
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EscolherTipoSecaoModal({
  aberto,
  onFechar,
  onEscolher,
}: {
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (tipo: string) => void;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Boletim</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Nova seção</h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3 px-6 py-6">
          {TIPOS_SECOES_BOLETIM.map((tipo) => (
            <button
              key={tipo.tipo}
              type="button"
              onClick={() => onEscolher(tipo.tipo)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                {tipo.emoji}
              </span>
              <div className="flex-1">
                <p className="font-bold text-slate-900">{tipo.titulo}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Adicionar seção do tipo {tipo.titulo.toLowerCase()} ao boletim.
                </p>
              </div>
              <span className="text-lg text-slate-300">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorSecaoBoletimModal({
  aberto,
  tipo,
  secaoExistente,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  tipo: string | null;
  secaoExistente: BoletimSecaoRascunho | null;
  onFechar: () => void;
  onSalvar: (secao: BoletimSecaoRascunho) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [visivel, setVisivel] = useState(true);
  const [itens, setItens] = useState<BoletimItemRascunho[]>([]);
  const [agendaItens, setAgendaItens] = useState<AgendaItemRascunho[]>([]);

  useEffect(() => {
    if (!aberto || !tipo) return;

    const config = getBoletimTipoConfig(tipo);
    const itensExistentes = [...(secaoExistente?.itens || [])];

    setTitulo(secaoExistente?.titulo || config.titulo);
    setVisivel(secaoExistente?.visivel ?? true);

    if (tipo === 'agenda') {
      const agenda = itensExistentes.map((item) => parseAgendaConteudo(item.conteudo));
      setAgendaItens([...agenda, createEmptyAgendaItem()]);
      setItens([]);
      return;
    }

    setItens([
      ...itensExistentes.map((item) => ({
        id: item.id || createDraftId('boletim-item'),
        conteudo: item.conteudo,
        destaque: item.destaque,
      })),
      createEmptyBoletimItem(),
    ]);
    setAgendaItens([]);
  }, [aberto, tipo, secaoExistente]);

  if (!aberto || !tipo) return null;

  const config = getBoletimTipoConfig(tipo);
  const isAgenda = tipo === 'agenda';

  const garantirCampoTextoExtra = (lista: BoletimItemRascunho[]) => {
    const preenchidos = lista.filter((item) => item.conteudo.trim().length > 0);
    return [...preenchidos, createEmptyBoletimItem()];
  };

  const garantirCampoAgendaExtra = (lista: AgendaItemRascunho[]) => {
    const preenchidos = lista.filter((item) => item.descricao.trim().length > 0);
    return [...preenchidos, createEmptyAgendaItem()];
  };

  const salvarSecao = () => {
    const base: BoletimSecaoRascunho = {
      id: secaoExistente?.id || createDraftId('secao-boletim'),
      tipo,
      titulo: titulo.trim() || config.titulo,
      icone: config.icone,
      visivel,
      ordem: secaoExistente?.ordem || 0,
      itens: isAgenda
        ? agendaItens
            .filter((item) => item.descricao.trim().length > 0)
            .map((item) => ({
              id: item.id,
              conteudo: serializeAgendaConteudo(item),
              destaque: false,
            }))
        : itens
            .filter((item) => item.conteudo.trim().length > 0)
            .map((item) => ({
              id: item.id,
              conteudo: item.conteudo.trim(),
              destaque: item.destaque,
            })),
    };

    onSalvar(base);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Boletim</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {secaoExistente ? `Editar ${config.titulo}` : `Nova ${config.titulo}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-xs font-black uppercase tracking-[0.22em] text-slate-400">Título</label>
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder={config.titulo}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition-colors focus:border-emerald-400"
            />
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={visivel}
                onChange={(event) => setVisivel(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
              />
              Visível no boletim público
            </label>
          </div>

          {isAgenda ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Eventos</p>
                <p className="mt-2 text-sm text-slate-500">
                  Novos eventos aparecem automaticamente conforme você preenche.
                </p>
              </div>

              <div className="space-y-4">
                {agendaItens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                      <label className="block text-sm font-semibold text-slate-700">
                        Data
                        <input
                          type="date"
                          value={item.data}
                          onChange={(event) => {
                            const atualizados = agendaItens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, data: event.target.value } : entry
                            );
                            setAgendaItens(atualizados);
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                        />
                      </label>

                      <div className="space-y-3">
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={item.temHora}
                            onChange={(event) => {
                              const atualizados = agendaItens.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, temHora: event.target.checked } : entry
                              );
                              setAgendaItens(atualizados);
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                          />
                          Tem horário
                        </label>

                        {item.temHora ? (
                          <input
                            type="time"
                            value={item.hora}
                            onChange={(event) => {
                              const atualizados = agendaItens.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, hora: event.target.value } : entry
                              );
                              setAgendaItens(atualizados);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                          />
                        ) : null}
                      </div>
                    </div>

                    <textarea
                      value={item.descricao}
                      onChange={(event) => {
                        const atualizados = agendaItens.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, descricao: event.target.value } : entry
                        );
                        setAgendaItens(garantirCampoAgendaExtra(atualizados));
                      }}
                      rows={3}
                      placeholder="Descrição do evento..."
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                    />

                    {(item.descricao.trim() || agendaItens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setAgendaItens(garantirCampoAgendaExtra(agendaItens.filter((entry) => entry.id !== item.id)))}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover evento
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Conteúdo</p>
                <p className="mt-2 text-sm text-slate-500">
                  Novos campos aparecem automaticamente conforme você digita.
                </p>
              </div>

              <div className="space-y-4">
                {itens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <textarea
                      value={item.conteudo}
                      onChange={(event) => {
                        const atualizados = itens.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, conteudo: event.target.value } : entry
                        );
                        setItens(garantirCampoTextoExtra(atualizados));
                      }}
                      rows={3}
                      placeholder="Digite aqui..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                    />

                    {item.conteudo.trim() ? (
                      <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.destaque}
                          onChange={(event) => {
                            const atualizados = itens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, destaque: event.target.checked } : entry
                            );
                            setItens(atualizados);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        />
                        Destaque
                      </label>
                    ) : null}

                    {(item.conteudo.trim() || itens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setItens(garantirCampoTextoExtra(itens.filter((entry) => entry.id !== item.id)))}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover item
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvarSecao}
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
          >
            Aplicar seção
          </button>
        </div>
      </div>
    </div>
  );
}

// --- EDITOR DE LITURGIA ---
function EditorLiturgia({
  culto,
  onSalvo,
  onCancelar,
  canticos,
  setCanticos,
  podeEditarLiturgiaCompleta,
  podeEditarLouvor,
  configuracaoIgreja,
}: any) {
  const [dia, setDia] = useState<string>(culto?.Dia || '');
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [palavraPastoral, setPalavraPastoral] = useState(culto?.palavra_pastoral || '');
  const [palavraPastoralAutor, setPalavraPastoralAutor] = useState(
    culto?.palavra_pastoral_autor || configuracaoIgreja?.pastorPadrao || ''
  );
  const [imagemUpload, setImagemUpload] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(culto?.imagem_url || null);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [importando, setImportando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecaoRascunho[]>([]);
  const [loadingBoletim, setLoadingBoletim] = useState(false);
  const [showEscolherTipo, setShowEscolherTipo] = useState(false);
  const [tipoNovaSecao, setTipoNovaSecao] = useState<string | null>(null);
  const [secaoEditandoIndex, setSecaoEditandoIndex] = useState<number | null>(null);

  const isLideranca = podeEditarLiturgiaCompleta;
  const podVerTom = isLideranca || podeEditarLouvor;
  const canEditarMusica = isLideranca || podeEditarLouvor;
  const tiposLiturgicos = resolveTiposLiturgicos(configuracaoIgreja);
  const temModeloDaIgreja = (configuracaoIgreja?.modelosLiturgia?.length || 0) > 0;
  const secaoEditando =
    secaoEditandoIndex !== null ? boletimSecoes[secaoEditandoIndex] || null : null;

  useEffect(() => {
    if (culto) {
      carregarItens(culto['Culto nr.']);
    } else if (dia) {
      setItens(modeloPadrao(dia, configuracaoIgreja));
    }
  }, [culto, dia, configuracaoIgreja]);

  useEffect(() => {
    if (!HABILITAR_BOLETIM_SECOES_NEXT) {
      setBoletimSecoes([]);
      return;
    }

    if (culto) {
      carregarSecoesBoletim(culto['Culto nr.']);
      return;
    }

    setBoletimSecoes([]);
  }, [culto]);

  useEffect(() => {
    if (culto?.palavra_pastoral_autor) return;
    if (!configuracaoIgreja?.pastorPadrao) return;

    setPalavraPastoralAutor((current: string) => (
      current.trim() ? current : configuracaoIgreja.pastorPadrao || ''
    ));
  }, [culto?.palavra_pastoral_autor, configuracaoIgreja]);

  const carregarItens = async (cultoNr: number) => {
    const data = await carregarLouvorItensComCanticos(cultoNr, canticos);

    if (!data) return;

    // Agrupar linhas do mesmo item
    const agrupados: LouvorItem[] = [];
    data.forEach((linha: any) => {
      const ultimo = agrupados[agrupados.length - 1];
      if (
        ultimo &&
        ultimo.tipo === linha.tipo &&
        ultimo.conteudo_publico === linha.conteudo_publico &&
        ultimo.descricao === linha.descricao &&
        ultimo.horario === linha.horario
      ) {
        ultimo.canticos_lista.push({ cantico_id: linha.cantico_id, tom: linha.tom });
      } else {
        agrupados.push({
          id: linha.id,
          tipo: linha.tipo,
          ordem: linha.ordem,
          conteudo_publico: linha.conteudo_publico,
          descricao: linha.descricao,
          horario: linha.horario,
          canticos_lista: linha.cantico_id ? [{ cantico_id: linha.cantico_id, tom: linha.tom }] : [],
        });
      }
    });

    setItens(agrupados);
  };

  const carregarSecoesBoletim = async (cultoNr: number) => {
    if (!HABILITAR_BOLETIM_SECOES_NEXT) {
      setBoletimSecoes([]);
      return;
    }

    const igrejaId = getStoredChurchId();

    if (!igrejaId) {
      setBoletimSecoes([]);
      return;
    }

    setLoadingBoletim(true);

    try {
      const { data: secoesRaw, error: secoesError } = await supabase
        .from('boletim_secoes')
        .select('id, igreja_id, culto_id, tipo, titulo, icone, ordem, visivel, criado_em')
        .eq('culto_id', cultoNr)
        .eq('igreja_id', igrejaId)
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true });

      if (secoesError) throw secoesError;

      const secoes = ((secoesRaw || []) as BoletimSecaoRow[]).filter(
        (secao) => !TIPOS_SECOES_SISTEMA.has(secao.tipo)
      );

      if (secoes.length === 0) {
        setBoletimSecoes([]);
        return;
      }

      const secaoIds = secoes.map((secao) => secao.id);
      const { data: itensRaw, error: itensError } = await supabase
        .from('boletim_itens')
        .select('id, secao_id, conteudo, destaque, ordem, criado_em')
        .in('secao_id', secaoIds)
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true });

      if (itensError) throw itensError;

      const itensPorSecao = new Map<string, BoletimItemRascunho[]>();

      ((itensRaw || []) as BoletimItemRow[]).forEach((item) => {
        if (!item.secao_id) return;

        const lista = itensPorSecao.get(item.secao_id) || [];
        lista.push({
          id: item.id,
          conteudo: item.conteudo || '',
          destaque: item.destaque === true,
        });
        itensPorSecao.set(item.secao_id, lista);
      });

      const secoesRascunho = secoes.map((secao, index) => ({
        id: secao.id,
        tipo: secao.tipo,
        titulo: secao.titulo,
        icone: secao.icone,
        visivel: secao.visivel !== false,
        ordem: secao.ordem ?? index,
        itens: itensPorSecao.get(secao.id) || [],
      }));

      setBoletimSecoes(normalizarSecoesBoletim(secoesRascunho));
    } catch (error) {
      console.warn('Falha ao carregar seções extras do boletim:', error);
      setBoletimSecoes([]);
    } finally {
      setLoadingBoletim(false);
    }
  };

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagemUpload(file);
    const reader = new FileReader();
    reader.onload = e => setImagemPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const importarInstagram = async () => {
    if (!instagramUrl.trim()) return;
    setImportando(true);
    try {
      const postId = instagramUrl.match(/\/p\/([^\/]+)/)?.[1] || instagramUrl.match(/\/reel\/([^\/]+)/)?.[1];
      if (!postId) { alert('URL inválida'); return; }
      const response = await fetch('/api/instagram-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl: instagramUrl }),
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const file = new File([blob], `instagram-${postId}.jpg`, { type: 'image/jpeg' });
      setImagemUpload(file);
      const reader = new FileReader();
      reader.onload = e => setImagemPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setInstagramUrl('');
      alert('✅ Imagem importada!');
    } catch { alert('❌ Erro ao importar'); }
    finally { setImportando(false); }
  };

  const uploadImagem = async (file: File, cultoNr: number): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const nome = `culto-${cultoNr}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('liturgias_thumbnails').upload(nome, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('liturgias_thumbnails').getPublicUrl(nome);
    return data.publicUrl;
  };

  const adicionarItem = (posicao: number) => {
    const novo: LouvorItem = {
      tipo: tiposLiturgicos[0] || TIPOS_LITURGICOS_PADRAO[0],
      ordem: posicao + 1,
      conteudo_publico: null,
      descricao: null,
      horario: null,
      canticos_lista: [],
    };
    const novos = [...itens];
    novos.splice(posicao, 0, novo);
    setItens(novos.map((it, i) => ({ ...it, ordem: i + 1 })));
  };

  const aplicarModeloDaIgreja = () => {
    const baseDia = dia || new Date().toISOString().split('T')[0];
    setItens(modeloPadrao(baseDia, configuracaoIgreja));
  };

  const salvarBoletim = async (cultoId: number, igrejaId: string, imagemUrl: string | null) => {
    if (!HABILITAR_BOLETIM_SECOES_NEXT) return;

    const { data: secoesExistentesRaw, error: secoesExistentesError } = await supabase
      .from('boletim_secoes')
      .select('id')
      .eq('culto_id', cultoId)
      .eq('igreja_id', igrejaId);

    if (secoesExistentesError) throw secoesExistentesError;

    const secaoIdsExistentes = (secoesExistentesRaw || [])
      .map((item) => item.id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (secaoIdsExistentes.length > 0) {
      const { error: deleteItensError } = await supabase
        .from('boletim_itens')
        .delete()
        .in('secao_id', secaoIdsExistentes);

      if (deleteItensError) throw deleteItensError;

      const { error: deleteSecoesError } = await supabase
        .from('boletim_secoes')
        .delete()
        .in('id', secaoIdsExistentes);

      if (deleteSecoesError) throw deleteSecoesError;
    }

    const secoesParaPersistir: Array<{
      tipo: string;
      titulo: string;
      icone: string | null;
      visivel: boolean;
      itens: Array<{ conteudo: string; destaque: boolean; ordem: number }>;
    }> = [];

    if (imagemUrl) {
      secoesParaPersistir.push({
        tipo: 'imagem_tema',
        titulo: 'Imagem do Boletim',
        icone: null,
        visivel: true,
        itens: [{ conteudo: imagemUrl, destaque: false, ordem: 0 }],
      });
    }

    if (palavraPastoral.trim()) {
      secoesParaPersistir.push({
        tipo: 'palavra_pastoral',
        titulo: 'Palavra Pastoral',
        icone: null,
        visivel: true,
        itens: [
          {
            conteudo: `${palavraPastoral.trim()}${
              palavraPastoralAutor.trim() ? `\n\n${palavraPastoralAutor.trim()}` : ''
            }`,
            destaque: true,
            ordem: 0,
          },
        ],
      });
    }

    const liturgiaItens = itens.map((item, index) => ({
      conteudo: montarConteudoLiturgiaParaBoletim(item, index, canticos).trim(),
      destaque: false,
      ordem: index,
    }));

    if (liturgiaItens.length > 0) {
      secoesParaPersistir.push({
        tipo: 'liturgia',
        titulo: `Liturgia do culto de ${dia}`,
        icone: null,
        visivel: true,
        itens: liturgiaItens,
      });
    }

    normalizarSecoesBoletim(boletimSecoes).forEach((secao) => {
      const config = getBoletimTipoConfig(secao.tipo);
      const itensValidos = secao.itens
        .map((item, index) => ({
          conteudo: secao.tipo === 'agenda' ? item.conteudo : item.conteudo.trim(),
          destaque: item.destaque,
          ordem: index,
        }))
        .filter((item) => item.conteudo.length > 0);

      secoesParaPersistir.push({
        tipo: secao.tipo,
        titulo: secao.titulo.trim() || config.titulo,
        icone: secao.icone || config.icone,
        visivel: secao.visivel,
        itens: itensValidos,
      });
    });

    for (const [index, secao] of secoesParaPersistir.entries()) {
      const { data: secaoCriada, error: secaoError } = await supabase
        .from('boletim_secoes')
        .insert({
          culto_id: cultoId,
          igreja_id: igrejaId,
          tipo: secao.tipo,
          titulo: secao.titulo,
          icone: secao.icone,
          ordem: index,
          visivel: secao.visivel,
        })
        .select('id')
        .single();

      if (secaoError) throw secaoError;

      if (!secaoCriada?.id || secao.itens.length === 0) continue;

      const { error: itensError } = await supabase.from('boletim_itens').insert(
        secao.itens.map((item) => ({
          secao_id: secaoCriada.id,
          conteudo: item.conteudo,
          destaque: item.destaque,
          ordem: item.ordem,
        }))
      );

      if (itensError) throw itensError;
    }
  };

  const salvar = async () => {
    if (!dia) return alert('Selecione a data!');
    setLoading(true);
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) throw new Error('Selecione uma igreja antes de salvar a liturgia');

      let cId = culto?.['Culto nr.'];
      let imagemUrl = culto?.imagem_url || null;

      if (!cId) {
        const { data, error } = await supabase
          .from('Louvores IPPN')
          .insert({
            Dia: dia,
            igreja_id: igrejaId,
            palavra_pastoral: palavraPastoral || null,
            palavra_pastoral_autor: palavraPastoralAutor || null,
          })
          .select().single();
        if (error) throw error;
        cId = data['Culto nr.'];
      } else {
        await supabase.from('Louvores IPPN').update({
          Dia: dia,
          igreja_id: igrejaId,
          palavra_pastoral: palavraPastoral || null,
          palavra_pastoral_autor: palavraPastoralAutor || null,
        }).eq('"Culto nr."', cId).eq('igreja_id', igrejaId);
      }

      if (imagemUpload) {
        const url = await uploadImagem(imagemUpload, cId);
        if (url) {
          imagemUrl = url;
          await supabase.from('Louvores IPPN').update({ imagem_url: imagemUrl }).eq('"Culto nr."', cId).eq('igreja_id', igrejaId);
        }
      }

      await supabase.from('louvor_itens').delete().eq('culto_id', cId);

      const rows: any[] = [];
      let ord = 1;
      itens.forEach(it => {
        if (it.canticos_lista.length > 0) {
          it.canticos_lista.forEach(m => {
            rows.push({
              culto_id: cId, ordem: ord++, tipo: it.tipo,
              conteudo_publico: it.conteudo_publico || null,
              descricao: it.descricao || null,
              horario: it.horario || null,
              cantico_id: m.cantico_id || null,
              tom: m.tom || null,
            });
          });
        } else {
          rows.push({
            culto_id: cId, ordem: ord++, tipo: it.tipo,
            conteudo_publico: it.conteudo_publico || null,
            descricao: it.descricao || null,
            horario: it.horario || null,
            cantico_id: null, tom: null,
          });
        }
      });

      if (rows.length > 0) {
        const { error } = await supabase.from('louvor_itens').insert(rows);
        if (error) throw error;
      }

      if (HABILITAR_BOLETIM_SECOES_NEXT) {
        await salvarBoletim(cId, igrejaId, imagemUrl);
      }

      alert('✅ Salvo com sucesso!');
      onSalvo();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <button onClick={onCancelar} className="text-emerald-700 font-bold text-base px-4 py-2.5 hover:bg-emerald-50 rounded-xl transition-colors active:bg-emerald-100">
          ← Voltar
        </button>
        <h2 className="font-black text-slate-800 text-base uppercase tracking-wider">
          {culto ? 'Editar Liturgia' : 'Nova Liturgia'}
        </h2>
        <div className="w-24" />
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* DATA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Data do Culto</label>
          <input
            type="date"
            value={dia}
            onChange={e => {
              setDia(e.target.value);
              if (!culto && e.target.value) setItens(modeloPadrao(e.target.value, configuracaoIgreja));
            }}
            disabled={!isLideranca}
            className="text-2xl font-black text-emerald-800 border-none focus:outline-none bg-transparent w-full py-1"
          />
        </div>

        {/* PALAVRA PASTORAL */}
        {HABILITAR_BOLETIM_SECOES_NEXT && isLideranca && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="text-xs font-black text-emerald-600 uppercase tracking-widest block mb-3">
              ✝️ Palavra Pastoral
            </label>
            <textarea
              value={palavraPastoral}
              onChange={e => setPalavraPastoral(e.target.value)}
              placeholder="Escreva a palavra pastoral da semana..."
              rows={4}
              className="w-full text-base text-slate-700 border border-emerald-100 rounded-xl px-4 py-3 bg-emerald-50/30 focus:outline-none focus:border-emerald-300 resize-none placeholder:text-slate-300 mb-3"
            />
            <input
              value={palavraPastoralAutor}
              onChange={e => setPalavraPastoralAutor(e.target.value)}
              placeholder="Autor"
              className="w-full text-base text-slate-500 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-slate-300 italic"
            />
          </div>
        )}

        {/* IMAGEM */}
        {isLideranca && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">
              Imagem do Tema
            </label>

            {/* Instagram */}
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                placeholder="URL do post do Instagram..."
                value={instagramUrl}
                onChange={e => setInstagramUrl(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-purple-400"
              />
              <button
                onClick={importarInstagram}
                disabled={importando}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {importando ? '⏳' : '📥'}
              </button>
            </div>

            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400">ou</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {imagemPreview && (
              <div className="relative mb-3 group">
                <img src={imagemPreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <button
                  onClick={() => { setImagemPreview(null); setImagemUpload(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >×</button>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleImagemChange}
              className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>
        )}

        {isLideranca && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Seções extras do boletim
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Avisos, pedidos de oração, agenda e outros blocos livres que acompanham a liturgia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEscolherTipo(true)}
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
              >
                + Nova seção
              </button>
            </div>

            {loadingBoletim ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Carregando seções extras...
              </div>
            ) : boletimSecoes.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Nenhuma seção extra cadastrada neste boletim.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {boletimSecoes.map((secao, index) => {
                  const config = getBoletimTipoConfig(secao.tipo);

                  return (
                    <div
                      key={secao.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                            {config.emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{secao.titulo || config.titulo}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {secao.itens.length} item(ns)
                              {secao.visivel ? ' publicado(s)' : ' em rascunho'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {!secao.visivel ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Oculto
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setBoletimSecoes(
                                normalizarSecoesBoletim(
                                  boletimSecoes.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, visivel: !item.visivel } : item
                                  )
                                )
                              )
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            {secao.visivel ? 'Ocultar' : 'Publicar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSecaoEditandoIndex(index)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index === 0) return;
                              const atualizadas = [...boletimSecoes];
                              [atualizadas[index - 1], atualizadas[index]] = [atualizadas[index], atualizadas[index - 1]];
                              setBoletimSecoes(normalizarSecoesBoletim(atualizadas));
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index === boletimSecoes.length - 1) return;
                              const atualizadas = [...boletimSecoes];
                              [atualizadas[index], atualizadas[index + 1]] = [atualizadas[index + 1], atualizadas[index]];
                              setBoletimSecoes(normalizarSecoesBoletim(atualizadas));
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBoletimSecoes(normalizarSecoesBoletim(boletimSecoes.filter((_, itemIndex) => itemIndex !== index)))
                            }
                            className="rounded-xl border border-red-100 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ITENS DA LITURGIA */}
        <div>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Liturgia</h3>
              {isLideranca && temModeloDaIgreja && (
                <p className="mt-2 text-sm text-slate-500">
                  Use o modelo da igreja para preencher esta liturgia com a ordem configurada no ambiente da igreja.
                </p>
              )}
            </div>
            {isLideranca && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {temModeloDaIgreja && (
                  <button
                    onClick={aplicarModeloDaIgreja}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 active:bg-emerald-200"
                  >
                    Usar modelo da igreja
                  </button>
                )}
                <button
                  onClick={() => adicionarItem(0)}
                  className="text-sm font-bold text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl transition-colors active:bg-emerald-100"
                >
                  + item no início
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={idx}>
                <ItemLiturgia
                  item={{ ...it, tiposLiturgicosDisponiveis: tiposLiturgicos }}
                  index={idx}
                  canticos={canticos}
                  onCreate={async (nome: string) => {
                    const payload = {
                      nome: nome.trim(),
                      letra: '',
                      referencia: '',
                      tags: [],
                      youtube_url: null,
                      spotify_url: null,
                    };

                    const { data, error }: any = await supabase
                      .from('canticos')
                      .insert(payload)
                      .select('id, nome')
                      .single();

                    if (error) {
                      throw new Error(error.message || 'Nao foi possivel criar o cântico.');
                    }

                    const novo = { ...data, ultima_vez: null };
                    setCanticos((prev: Cantico[]) => [...prev, novo]);
                    return novo;
                  }}
                  onUpdate={(u: LouvorItem) => {
                    const novos = [...itens];
                    novos[idx] = u;
                    setItens(novos);
                  }}
                  onRemove={() => setItens(itens.filter((_, i) => i !== idx))}
                  onMove={(d: string) => {
                    const novos = [...itens];
                    const alvo = d === 'cima' ? idx - 1 : idx + 1;
                    if (alvo >= 0 && alvo < novos.length) {
                      [novos[idx], novos[alvo]] = [novos[alvo], novos[idx]];
                      setItens(novos);
                    }
                  }}
                  isLideranca={isLideranca}
                  podVerTom={podVerTom}
                  canEditarMusica={canEditarMusica}
                />

                {isLideranca && (
                  <button
                    onClick={() => adicionarItem(idx + 1)}
                    className="w-full mt-1 py-2.5 text-sm text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors font-semibold active:bg-emerald-100"
                  >
                    + adicionar item aqui
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Botão salvar fixo */}
      {isLideranca && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-40">
          <button
            onClick={salvar}
            disabled={loading}
            className="w-full max-w-2xl mx-auto block bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-2xl font-bold text-base shadow-lg disabled:opacity-60 transition-colors"
          >
            {loading ? '⏳ Salvando...' : '✅ Salvar Liturgia'}
          </button>
        </div>
      )}

      {HABILITAR_BOLETIM_SECOES_NEXT ? (
        <>
          <EscolherTipoSecaoModal
            aberto={showEscolherTipo}
            onFechar={() => setShowEscolherTipo(false)}
            onEscolher={(tipo) => {
              setShowEscolherTipo(false);
              setTipoNovaSecao(tipo);
            }}
          />

          <EditorSecaoBoletimModal
            aberto={Boolean(tipoNovaSecao || secaoEditando)}
            tipo={tipoNovaSecao || secaoEditando?.tipo || null}
            secaoExistente={tipoNovaSecao ? null : secaoEditando}
            onFechar={() => {
              setTipoNovaSecao(null);
              setSecaoEditandoIndex(null);
            }}
            onSalvar={(secao) => {
              if (secaoEditandoIndex !== null) {
                setBoletimSecoes(
                  normalizarSecoesBoletim(
                    boletimSecoes.map((item, index) => (index === secaoEditandoIndex ? { ...secao, ordem: item.ordem } : item))
                  )
                );
              } else {
                setBoletimSecoes(normalizarSecoesBoletim([...boletimSecoes, secao]));
              }

              setTipoNovaSecao(null);
              setSecaoEditandoIndex(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

// --- CARD DE CULTO NA LISTAGEM ---
function CultoCard({ culto, onEditar, onWhatsApp, onPDF, podeEditar }: any) {
  const dataFormatada = formatCultoDateLabel(culto.Dia);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all shadow-sm">
      <div className="flex items-center gap-4 p-4">
        {culto.imagem_url && (
          <img src={culto.imagem_url} alt="" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">#{culto['Culto nr.']}</p>
          <h3 className="font-bold text-slate-800 text-base truncate mt-0.5">{dataFormatada}</h3>
          {culto.palavra_pastoral && (
            <p className="text-sm text-emerald-600 truncate mt-1">✝️ Palavra pastoral disponível</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onWhatsApp(culto)} className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:bg-emerald-200 transition-colors flex items-center justify-center" title="WhatsApp">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.559 4.189 1.619 6.011L0 24l6.117-1.605a11.847 11.847 0 005.925 1.586h.005c6.635 0 12.032-5.396 12.035-12.032a11.76 11.76 0 00-3.528-8.485" />
            </svg>
          </button>
          <button onClick={() => onPDF(culto)} className="w-11 h-11 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center" title="PDF">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          {podeEditar && (
            <button onClick={() => onEditar(culto)} className="w-11 h-11 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center text-lg" title="Editar">
              ✏️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function CultosPage() {
  const router = useRouter();
  const { loading: permLoading, permissoes } = usePermissions();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [configuracaoIgreja, setConfiguracaoIgreja] = useState<LiturgiaChurchConfig | null>(null);
  const [editando, setEditando] = useState<Culto | null | 'novo'>(null);
  const [loading, setLoading] = useState(true);
  const isLideranca = permissoes.podeEditarLiturgiaCompleta;
  const totalLoading = loading || permLoading;

  useEffect(() => {
    if (!permLoading && !permissoes.podeGerenciarCultos) {
      router.push('/admin');
    }
  }, [permLoading, permissoes.podeGerenciarCultos, router]);

  useEffect(() => {
    if (!permLoading && permissoes.podeGerenciarCultos) {
      carregarTudo();
    }
  }, [permLoading, permissoes.podeGerenciarCultos]);

  const carregarTudo = async () => {
    setLoading(true);
    const igrejaId = getStoredChurchId();

    if (!igrejaId) {
      setCanticos([]);
      setCultos([]);
      setConfiguracaoIgreja(null);
      setLoading(false);
      return;
    }

    const [
      { data: todosCanticos },
      { data: cultosData },
      { data: igrejaRaw },
      { data: modelosLiturgiaRaw },
    ] = await Promise.all([
      supabase
        .from('canticos_unificados')
        .select('id, nome, tipo, numero')
        .order('nome'),
      supabase
        .from('Louvores IPPN')
        .select('*')
        .eq('igreja_id', igrejaId)
        .order('Dia', { ascending: false }),
      supabase
        .from('igrejas')
        .select('tipos_liturgicos, modelo_liturgico_padrao')
        .eq('id', igrejaId)
        .maybeSingle(),
      supabase
        .from('modelos_liturgia')
        .select('bloco, ordem, tipo, descricao_padrao, tem_cantico')
        .eq('igreja_id', igrejaId)
        .order('ordem', { ascending: true }),
    ]);

    const pastorPadrao = isUuid(igrejaId) ? await buscarPastorPadrao(igrejaId) : null;

    setCanticos((todosCanticos || []).map(c => ({ ...c, ultima_vez: null })));
    setCultos(cultosData || []);
    const modelosFallback = extractModeloLiturgicoPadrao(igrejaRaw?.modelo_liturgico_padrao);
    const fallbackPorChave = new Map(
      modelosFallback.map((item) => [`${item.ordem}-${item.tipo}-${item.bloco}`, item] as const)
    );
    const modelosTabela = (modelosLiturgiaRaw || []).map((item) => ({
      bloco: typeof item.bloco === 'string' ? item.bloco : '',
      ordem: typeof item.ordem === 'number' ? item.ordem : 0,
      tipo: typeof item.tipo === 'string' ? item.tipo : '',
      descricao_padrao: typeof item.descricao_padrao === 'string' ? item.descricao_padrao : '',
      conteudo_publico_padrao:
        fallbackPorChave.get(
          `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
        )?.conteudo_publico_padrao || '',
      descricao_interna_padrao:
        fallbackPorChave.get(
          `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
        )?.descricao_interna_padrao || (typeof item.descricao_padrao === 'string' ? item.descricao_padrao : ''),
      tem_cantico: item.tem_cantico === true,
    }));
    const tiposDaIgreja = extractTiposLiturgicos(igrejaRaw?.tipos_liturgicos);
    const tiposDerivadosDoModelo = [...new Set(
      modelosTabela
        .map((item) => item.tipo.trim())
        .filter(Boolean)
    )];

    const modelosMesclados = mergeModelosLiturgia(modelosTabela, modelosFallback);

    setConfiguracaoIgreja({
      tiposLiturgicos: tiposDaIgreja.length > 0 ? tiposDaIgreja : tiposDerivadosDoModelo,
      modelosLiturgia: modelosMesclados,
      pastorPadrao,
    });

    // Buscar últimas datas dos cânticos
    if (todosCanticos) {
      const { data: itens } = await supabase.from('louvor_itens').select('cantico_id, culto_id').not('cantico_id', 'is', null);
      const { data: todosCultos } = await supabase
        .from('Louvores IPPN')
        .select('"Culto nr.", Dia')
        .eq('igreja_id', igrejaId);
      if (itens && todosCultos) {
        const mapaCultos = new Map(todosCultos.map((c: any) => [c['Culto nr.'], c.Dia]));
        const mapaUltimas = new Map<string, string>();
        itens.forEach((it: any) => {
          const dia = mapaCultos.get(it.culto_id);
          if (!dia) return;
          if (!mapaUltimas.has(it.cantico_id) || dia > mapaUltimas.get(it.cantico_id)!) {
            mapaUltimas.set(it.cantico_id, dia as string);
          }
        });
        setCanticos(todosCanticos.map(c => ({ ...c, ultima_vez: mapaUltimas.get(c.id) || null })));
      }
    }

    setLoading(false);
  };

  const shareWhatsApp = async (culto: Culto) => {
    const igrejaId = getStoredChurchId();
    const cultoNr = culto['Culto nr.'];
    const { data: cultoValido } = await supabase
      .from('Louvores IPPN')
      .select('"Culto nr."')
      .eq('"Culto nr."', cultoNr)
      .eq('igreja_id', igrejaId)
      .maybeSingle();
    if (!cultoValido) return;

    const data = await carregarLouvorItensComCanticos(cultoNr, canticos);
    if (!data) return;

    const agrupados = agruparItensLiturgia(data);

    const dataFmt = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR');
    let texto = `LITURGIA DO CULTO DE *${dataFmt}*\n\n`;

    if (culto.palavra_pastoral) {
      texto += `✝️ *PALAVRA PASTORAL*\n${culto.palavra_pastoral}\n— ${culto.palavra_pastoral_autor || ''}\n\n`;
    }

    agrupados.forEach((it, index) => {
      texto += `*${index + 1}. ${it.tipo.toUpperCase()}*`;
      if (it.horario) texto += ` _(${it.horario})_`;
      texto += '\n';
      if (it.conteudo_publico) texto += `${it.conteudo_publico.trim()}\n`;
      it.canticos.forEach((cantico) => {
        texto += `- ${cantico.nome}${cantico.tom ? ` (${cantico.tom})` : ''}\n`;
      });
      texto += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const sharePDF = async (culto: Culto) => {
    const igrejaId = getStoredChurchId();
    const cultoNr = culto['Culto nr.'];
    const { data: cultoValido } = await supabase
      .from('Louvores IPPN')
      .select('"Culto nr."')
      .eq('"Culto nr."', cultoNr)
      .eq('igreja_id', igrejaId)
      .maybeSingle();
    if (!cultoValido) return;

    const data = await carregarLouvorItensComCanticos(cultoNr, canticos);
    if (!data) return;
    const agrupados = agruparItensLiturgia(data);

    const dataFmt = new Date(culto.Dia + 'T00:00:00')
      .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();

    const renderPdf = (scale: number) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const headerBottom = 30;
      const topY = headerBottom + 6;
      const bottomY = ph - 10;
      const titleSize = 13 * scale;
      const subtitleSize = 8.2 * scale;
      const metaSize = 7 * scale;
      const itemTitleSize = 11.8 * scale;
      const publicSize = 10.2 * scale;
      const internalSize = 8.3 * scale;
      const songSize = 10 * scale;
      const lineH = 5 * scale;
      const titleH = 6.1 * scale;
      const blockGap = 4.2 * scale;
      const innerIndent = 3;
      const contentWidth = pw - marginX * 2;

      const drawHeader = (page: number) => {
        if (page > 1) {
          doc.addPage();
        }

        doc.setFillColor(16, 60, 48);
        doc.rect(0, 0, pw, headerBottom - 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(titleSize);
        doc.text('LITURGIA DO CULTO', pw / 2, 11, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(subtitleSize);
        doc.text(dataFmt, pw / 2, 17, { align: 'center' });
        doc.setFontSize(metaSize);
        doc.text(`Pagina ${page} de 2`, pw / 2, 23, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(16, 60, 48);
        doc.line(marginX, headerBottom, pw - marginX, headerBottom);
      };

      const calcPastoralHeight = () => {
        let h = titleH + blockGap;
        doc.setFontSize(publicSize);
        h += doc.splitTextToSize(culto.palavra_pastoral || '', contentWidth - 4).length * lineH;
        if (culto.palavra_pastoral_autor) {
          h += lineH + 2;
        }
        return h + blockGap;
      };

      const calcItemHeight = (it: ItemAgrupado, num: number) => {
        doc.setFontSize(itemTitleSize);
        const titulo = `${num}. ${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
        let h = doc.splitTextToSize(titulo, contentWidth).length * titleH + 1.5;

        if (it.conteudo_publico) {
          doc.setFontSize(publicSize);
          h += doc.splitTextToSize(it.conteudo_publico, contentWidth - 4).length * lineH;
        }

        if (it.descricao) {
          doc.setFontSize(internalSize);
          h += doc.splitTextToSize(it.descricao, contentWidth - 4).length * lineH;
        }

        for (const cantico of it.canticos) {
          doc.setFontSize(songSize);
          h += doc.splitTextToSize(`${cantico.nome}${cantico.tom ? ` (${cantico.tom})` : ''}`, contentWidth - 4).length * lineH;
        }

        return h + blockGap;
      };

      const renderPastoral = (x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemTitleSize);
        doc.setTextColor(0, 0, 0);
        doc.text('PALAVRA PASTORAL', x, y);
        y += titleH;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(publicSize);
        const palavraLinhas = doc.splitTextToSize(culto.palavra_pastoral || '', contentWidth - 4);
        doc.text(palavraLinhas, x, y);
        y += palavraLinhas.length * lineH;

        if (culto.palavra_pastoral_autor) {
          y += 1.5;
          doc.setFont('helvetica', 'italic');
          doc.text(`- ${culto.palavra_pastoral_autor}`, x + contentWidth, y, { align: 'right' });
        }
      };

      const renderItem = (it: ItemAgrupado, num: number, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemTitleSize);
        doc.setTextColor(0, 0, 0);
        const titulo = `${num}. ${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
        const tituloLinhas = doc.splitTextToSize(titulo, contentWidth);
        doc.text(tituloLinhas, x, y);
        y += tituloLinhas.length * titleH;

        if (it.conteudo_publico) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(publicSize);
          doc.setTextColor(55, 55, 55);
          const linhas = doc.splitTextToSize(it.conteudo_publico, contentWidth - 4);
          doc.text(linhas, x + innerIndent, y);
          y += linhas.length * lineH;
        }

        if (it.descricao) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(internalSize);
          doc.setTextColor(120, 120, 120);
          const linhas = doc.splitTextToSize(it.descricao, contentWidth - 4);
          doc.text(linhas, x + innerIndent, y);
          y += linhas.length * lineH;
        }

        for (const cantico of it.canticos) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(songSize);
          doc.setTextColor(16, 90, 60);
          const linhas = doc.splitTextToSize(
            `${cantico.nome}${cantico.tom ? ` (${cantico.tom})` : ''}`,
            contentWidth - 4
          );
          doc.text(linhas, x + innerIndent, y);
          y += linhas.length * lineH;
        }
      };

      const blocos: Array<
        | { kind: 'pastoral'; altura: number }
        | { kind: 'item'; altura: number; item: ItemAgrupado; numero: number }
      > = [];

      if (culto.palavra_pastoral) {
        blocos.push({ kind: 'pastoral', altura: calcPastoralHeight() });
      }

      agrupados.forEach((item, index) => {
        blocos.push({
          kind: 'item',
          item,
          numero: index + 1,
          altura: calcItemHeight(item, index + 1),
        });
      });

      const placements: Array<{ page: number; y: number; blockIndex: number }> = [];
      let page = 1;
      let y = topY;

      for (let i = 0; i < blocos.length; i += 1) {
        const bloco = blocos[i];
        if (y + bloco.altura > bottomY) {
          page += 1;
          y = topY;
        }

        if (page > 2) {
          return null;
        }

        placements.push({
          page,
          y,
          blockIndex: i,
        });

        y += bloco.altura;
      }

      const totalPages = Math.max(...placements.map((item) => item.page), 1);

      for (let page = 1; page <= totalPages; page += 1) {
        drawHeader(page);
      }

      placements.forEach((placement) => {
        const bloco = blocos[placement.blockIndex];
        doc.setPage(placement.page);
        const x = marginX;

        if (bloco.kind === 'pastoral') {
          renderPastoral(x, placement.y);
          return;
        }

        renderItem(bloco.item, bloco.numero, x, placement.y);
      });

      return doc;
    };

    const doc =
      renderPdf(1.18) ||
      renderPdf(1.12) ||
      renderPdf(1.06) ||
      renderPdf(1) ||
      renderPdf(0.95) ||
      renderPdf(0.9) ||
      renderPdf(0.85) ||
      renderPdf(0.8) ||
      renderPdf(0.75) ||
      renderPdf(0.7);

    if (!doc) {
      alert('Nao foi possivel montar o PDF em ate duas paginas.');
      return;
    }

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  if (totalLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-base">Carregando...</p>
      </div>
    </div>
  );

  if (editando !== null) return (
    <EditorLiturgia
      culto={editando === 'novo' ? null : editando}
      canticos={canticos}
      setCanticos={setCanticos}
      configuracaoIgreja={configuracaoIgreja}
      podeEditarLiturgiaCompleta={permissoes.podeEditarLiturgiaCompleta}
      podeEditarLouvor={permissoes.podeEditarLouvor}
      onSalvo={() => { setEditando(null); carregarTudo(); }}
      onCancelar={() => setEditando(null)}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Liturgias</h1>
          {isLideranca && (
            <button
              onClick={() => setEditando('novo')}
              className="bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold text-base hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm"
            >
              + Nova
            </button>
          )}
        </div>

        <div className="space-y-3">
          {cultos.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500">
              Nenhuma liturgia encontrada para a igreja selecionada.
            </div>
          )}
          {cultos.map(c => (
            <CultoCard
              key={c['Culto nr.']}
              culto={c}
              podeEditar={permissoes.podeEditarLouvor}
              onEditar={(culto: Culto) => setEditando(culto)}
              onWhatsApp={shareWhatsApp}
              onPDF={sharePDF}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
