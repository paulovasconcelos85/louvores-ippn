'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
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
  { tipo: 'outro', titulo: 'Outros', icone: 'list.bullet', emoji: '📝' },
] as const;

const HABILITAR_BOLETIM_SECOES_NEXT = true;
const BOLETIM_FALLBACK_TIPO_PREFIX = '__boletim__:';
const LITURGIA_META_TIPO = '__liturgia__:nome';

// --- TIPOS ---
interface Cantico {
  id: string | number;
  nome: string;
  tipo?: string;
  numero?: string | null;
  letra?: string | null;
  igreja_id?: string | null;
  ultima_vez?: string | null;
}

function mapHinarioNovoCanticoToCantico(
  item: {
    id: string | number;
    numero: string | null;
    titulo: string | null;
    letra: string | null;
  }
): Cantico {
  return {
    id: String(item.id),
    numero: item.numero || null,
    nome: item.titulo?.trim() || 'Hino sem título',
    tipo: 'hinario',
    letra: item.letra,
  };
}

function normalizeCanticoSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getCanticoDisplayLabel(cantico: Cantico | null | undefined) {
  if (!cantico) return '';
  return cantico.tipo === 'hinario' && cantico.numero
    ? `Hino ${cantico.numero} · ${cantico.nome}`
    : cantico.nome;
}

function getCanticoInlineReference(cantico: Cantico) {
  if (cantico.tipo === 'hinario' && cantico.numero) {
    return `Hino ${cantico.nome} (${cantico.numero})`;
  }

  return `Cântico: ${cantico.nome}`;
}

function getRepertorioTextos(canticos: Cantico[]) {
  const temHinos = canticos.some((cantico) => cantico.tipo === 'hinario');
  const temCanticos = canticos.some((cantico) => cantico.tipo !== 'hinario');

  if (temHinos && !temCanticos) {
    return {
      rotuloPlural: 'Hinos',
      rotuloSingular: 'hino',
      placeholderBusca: 'Buscar hino...',
      tituloBuscaNome: 'Buscar hino por nome',
      ajudaPublico:
        'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome ou <strong>#</strong> para buscar por número de hino. Se não precisar mostrar nada neste item, deixe em branco.',
      placeholderPublico:
        'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ ou # para inserir um hino',
      descricaoSecaoComCadastro:
        'Adicione aqui os hinos ligados a esta etapa. Você pode buscar um já disponível no hinário e, se precisar, informar o tom.',
      descricaoSecaoSemCadastro:
        'Adicione aqui os hinos ligados a esta etapa. Você pode buscar um já disponível no hinário e, se precisar, informar o tom.',
      acaoAdicionar: 'Adicionar hino',
      aceitaBuscaPorNumero: true,
    };
  }

  if (!temHinos && temCanticos) {
    return {
      rotuloPlural: 'Cânticos',
      rotuloSingular: 'cântico',
      placeholderBusca: 'Buscar cântico...',
      tituloBuscaNome: 'Buscar cântico por nome',
      ajudaPublico:
        'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome do cântico. Se não precisar mostrar nada neste item, deixe em branco.',
      placeholderPublico:
        'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ para inserir um cântico',
      descricaoSecaoComCadastro:
        'Adicione aqui os cânticos ligados a esta etapa. Você pode buscar um já cadastrado, criar um novo e, se precisar, informar o tom.',
      descricaoSecaoSemCadastro:
        'Adicione aqui os cânticos ligados a esta etapa. Você pode buscar um já cadastrado e, se precisar, informar o tom.',
      acaoAdicionar: 'Adicionar cântico',
      aceitaBuscaPorNumero: false,
    };
  }

  return {
    rotuloPlural: 'Repertório',
    rotuloSingular: 'item do repertório',
    placeholderBusca: 'Buscar item do repertório...',
    tituloBuscaNome: 'Buscar hino ou cântico por nome',
    ajudaPublico:
      'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome ou <strong>#</strong> para buscar por número de hino. Se não precisar mostrar nada neste item, deixe em branco.',
    placeholderPublico:
      'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ ou # para inserir um hino/cântico',
    descricaoSecaoComCadastro:
      'Adicione aqui os itens musicais ligados a esta etapa. Você pode buscar um já cadastrado, criar um novo e, se precisar, informar o tom.',
    descricaoSecaoSemCadastro:
      'Adicione aqui os itens musicais ligados a esta etapa. Você pode buscar um já cadastrado e, se precisar, informar o tom.',
    acaoAdicionar: 'Adicionar item musical',
    aceitaBuscaPorNumero: true,
  };
}

function matchesCanticoQuery(cantico: Cantico, query: string) {
  const termo = normalizeCanticoSearchTerm(query);
  if (!termo) return true;

  const termoCompacto = termo.replace(/[^a-z0-9]/g, '');
  const numero = cantico.numero?.trim() || '';
  const numeroSemZeros = numero.replace(/^0+/, '') || numero;
  const candidatos = [
    cantico.nome,
    getCanticoDisplayLabel(cantico),
    numero,
    numeroSemZeros,
    numero ? `hino ${numero}` : '',
    numeroSemZeros ? `hino ${numeroSemZeros}` : '',
  ]
    .filter(Boolean)
    .map((valor) => normalizeCanticoSearchTerm(valor));

  return candidatos.some((valor) => {
    if (valor.includes(termo)) return true;
    return valor.replace(/[^a-z0-9]/g, '').includes(termoCompacto);
  });
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

interface AvisoItemRascunho {
  id: string;
  titulo: string;
  corpo: string;
  destaque: boolean;
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
  modoRepertorio: string | null;
  permiteCadastroCanticos: boolean;
}

interface Culto {
  'Culto nr.': number;
  Dia: string;
  imagem_url?: string | null;
  palavra_pastoral?: string | null;
  palavra_pastoral_autor?: string | null;
  nome_liturgia?: string | null;
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

interface BoletimFallbackMeta {
  secaoTitulo: string;
  secaoIcone: string | null;
  secaoVisivel: boolean;
  secaoOrdem: number;
  itemDestaque: boolean;
  itemOrdem: number;
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

function isBoletimFallbackTipo(tipo: string | null | undefined): tipo is string {
  return typeof tipo === 'string' && tipo.startsWith(BOLETIM_FALLBACK_TIPO_PREFIX);
}

function isLiturgiaMetaTipo(tipo: string | null | undefined) {
  return tipo === LITURGIA_META_TIPO;
}

function extrairTipoBoletimFallback(tipo: string | null | undefined) {
  if (!isBoletimFallbackTipo(tipo)) return null;
  return tipo.slice(BOLETIM_FALLBACK_TIPO_PREFIX.length) || null;
}

function getCultoNomeLiturgia(culto: Culto | null | undefined) {
  const nome = typeof culto?.nome_liturgia === 'string' ? culto.nome_liturgia.trim() : '';
  return nome || null;
}

function getCultoTituloExibicao(culto: Culto | null | undefined, fallback: string) {
  return getCultoNomeLiturgia(culto) || fallback;
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

function normalizeModoRepertorio(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function filtrarCanticosPorConfiguracao(
  canticos: Cantico[],
  configuracao: Pick<LiturgiaChurchConfig, 'modoRepertorio' | 'permiteCadastroCanticos'> | null
) {
  const modoRepertorio = normalizeModoRepertorio(configuracao?.modoRepertorio);
  let lista = [...canticos];

  if (modoRepertorio === 'hinario') {
    lista = lista.filter(
      (cantico) =>
        cantico.tipo === 'hinario' &&
        typeof cantico.letra === 'string' &&
        cantico.letra.trim().length > 0
    );
  } else if (modoRepertorio === 'livre' || modoRepertorio === 'canticos') {
    lista = lista.filter((cantico) => cantico.tipo !== 'hinario');
  }

  return lista;
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

function normalizarTiposLiturgicosDisponiveis(baseTipos: string[], itens: LouvorItem[]) {
  const vistos = new Set<string>();
  const tipos = [...baseTipos, ...itens.map((item) => item.tipo)];

  const resultado = tipos.filter((tipo) => {
    const valor = typeof tipo === 'string' ? tipo.trim() : '';
    if (!valor) return false;

    const chave = valor.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) return false;

    vistos.add(chave);
    return true;
  });

  return resultado.length > 0 ? resultado : TIPOS_LITURGICOS_PADRAO;
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

function getCultoDateKey(dateValue: string) {
  return String(dateValue).slice(0, 10);
}

function isDomingoDate(dateValue: string) {
  return new Date(`${getCultoDateKey(dateValue)}T00:00:00`).getDay() === 0;
}

function buildCultoDayGroups(cultos: Culto[]) {
  const groups = new Map<string, { dia: string; cultos: Culto[] }>();

  cultos.forEach((culto) => {
    const key = getCultoDateKey(culto.Dia);
    const current = groups.get(key);

    if (current) {
      current.cultos.push(culto);
      return;
    }

    groups.set(key, {
      dia: key,
      cultos: [culto],
    });
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      isDomingo: isDomingoDate(group.dia),
      cultos: [...group.cultos].sort((a, b) => a['Culto nr.'] - b['Culto nr.']),
    }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

function getCultoBoletimReferencia(cultos: Culto[]) {
  return (
    cultos.find((culto) => culto.palavra_pastoral?.trim() || culto.imagem_url) ||
    cultos[0] ||
    null
  );
}

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

function createEmptyAvisoItem(): AvisoItemRascunho {
  return {
    id: createDraftId('aviso-item'),
    titulo: '',
    corpo: '',
    destaque: false,
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

function parseAvisoConteudo(conteudo: string): AvisoItemRascunho {
  const texto = conteudo.trim();

  if (!texto) {
    return createEmptyAvisoItem();
  }

  const separadorDuplo = texto.indexOf('\n\n');

  if (separadorDuplo >= 0) {
    const titulo = texto.slice(0, separadorDuplo).trim();
    const corpo = texto.slice(separadorDuplo + 2).trim();

    return {
      id: createDraftId('aviso-item'),
      titulo,
      corpo,
      destaque: false,
    };
  }

  const [titulo, ...restante] = texto.split('\n');

  return {
    id: createDraftId('aviso-item'),
    titulo: titulo.trim(),
    corpo: restante.join('\n').trim(),
    destaque: false,
  };
}

function serializeAvisoConteudo(item: AvisoItemRascunho) {
  return `${item.titulo.trim()}\n\n${item.corpo.trim()}`;
}

function parseBoletimFallbackMeta(raw: string | null | undefined): BoletimFallbackMeta | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<BoletimFallbackMeta>;

    if (typeof parsed.secaoTitulo !== 'string') return null;
    if (typeof parsed.secaoOrdem !== 'number') return null;
    if (typeof parsed.itemOrdem !== 'number') return null;

    return {
      secaoTitulo: parsed.secaoTitulo,
      secaoIcone: typeof parsed.secaoIcone === 'string' ? parsed.secaoIcone : null,
      secaoVisivel: parsed.secaoVisivel !== false,
      secaoOrdem: parsed.secaoOrdem,
      itemDestaque: parsed.itemDestaque === true,
      itemOrdem: parsed.itemOrdem,
    };
  } catch {
    return null;
  }
}

function buildBoletimSecoesFromFallbackRows(rows: LouvorItemRow[]) {
  const sections = new Map<string, BoletimSecaoRascunho>();
  const itemOrders = new Map<string, number>();

  rows.forEach((row) => {
    const tipo = extrairTipoBoletimFallback(row.tipo);
    const meta = parseBoletimFallbackMeta(row.descricao);
    const conteudo = row.conteudo_publico?.trim() || '';

    if (!tipo || !meta || !conteudo) return;

    const config = getBoletimTipoConfig(tipo);
    const key = `${meta.secaoOrdem}:${tipo}:${meta.secaoTitulo}`;

    if (!sections.has(key)) {
      sections.set(key, {
        id: key,
        tipo,
        titulo: meta.secaoTitulo || config.titulo,
        icone: meta.secaoIcone || config.icone,
        visivel: meta.secaoVisivel,
        ordem: meta.secaoOrdem,
        itens: [],
      });
    }

    sections.get(key)?.itens.push({
      id: row.id,
      conteudo,
      destaque: meta.itemDestaque,
    });
    itemOrders.set(row.id, meta.itemOrdem);
  });

  return [...sections.values()]
    .map((secao) => ({
      ...secao,
      itens: [...secao.itens].sort(
        (a, b) => (itemOrders.get(a.id) || 0) - (itemOrders.get(b.id) || 0)
      ),
    }))
    .sort((a, b) => a.ordem - b.ordem);
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
  canticosFallback: Cantico[] = [],
  igrejaId?: string | null
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
  const canticoIdsHinario = canticoIds
    .filter((value) => !isUuid(value) && /^\d+$/.test(value))
    .map((value) => Number(value));

  const [canticosLegadosResult, hinarioNovoCanticoResult, canticosUnificadosResult] =
    canticoIds.length > 0
      ? await Promise.all([
          canticoIdsUuid.length > 0
            ? (() => {
                let query = supabase.from('canticos').select('id, nome').in('id', canticoIdsUuid);

                if (igrejaId) {
                  query = query.eq('igreja_id', igrejaId);
                }

                return query;
              })()
            : Promise.resolve({ data: [], error: null }),
          canticoIdsHinario.length > 0
            ? supabase.from('hinario_novo_cantico').select('id, titulo').in('id', canticoIdsHinario)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('canticos_unificados').select('id, nome').in('id', canticoIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (canticosLegadosResult.error) throw canticosLegadosResult.error;
  if (hinarioNovoCanticoResult.error) throw hinarioNovoCanticoResult.error;
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

  ((hinarioNovoCanticoResult.data || []) as Array<{ id: string | number; titulo: string | null }>).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId) || !canticosPorId.get(canticoId)) {
      canticosPorId.set(canticoId, cantico.titulo);
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

function buildBoletimFallbackRows(secoes: BoletimSecaoRascunho[], ordemInicial: number) {
  const rows: Array<{
    ordem: number;
    tipo: string;
    conteudo_publico: string | null;
    descricao: string | null;
    horario: string | null;
    cantico_id: null;
    tom: null;
  }> = [];

  let ordem = ordemInicial;

  normalizarSecoesBoletim(secoes).forEach((secao) => {
    const config = getBoletimTipoConfig(secao.tipo);

    secao.itens
      .map((item, index) => ({
        item,
        index,
      }))
      .filter(({ item }) => item.conteudo.trim().length > 0)
      .forEach(({ item, index }) => {
        const meta: BoletimFallbackMeta = {
          secaoTitulo: secao.titulo.trim() || config.titulo,
          secaoIcone: secao.icone || config.icone,
          secaoVisivel: secao.visivel,
          secaoOrdem: secao.ordem,
          itemDestaque: item.destaque,
          itemOrdem: index,
        };

        rows.push({
          ordem: ordem++,
          tipo: `${BOLETIM_FALLBACK_TIPO_PREFIX}${secao.tipo}`,
          conteudo_publico: item.conteudo.trim(),
          descricao: JSON.stringify(meta),
          horario: null,
          cantico_id: null,
          tom: null,
        });
      });
  });

  return rows;
}

function buildLiturgiaMetaRow(nomeLiturgia: string) {
  const nome = nomeLiturgia.trim();
  if (!nome) return null;

  return {
    ordem: 0,
    tipo: LITURGIA_META_TIPO,
    conteudo_publico: nome,
    descricao: null,
    horario: null,
    cantico_id: null,
    tom: null,
  };
}

async function uploadImagemTema(file: File, cultoNr: number): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const nome = `culto-${cultoNr}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('liturgias_thumbnails').upload(nome, file, { upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from('liturgias_thumbnails').getPublicUrl(nome);
  return data.publicUrl;
}

function agruparItensLiturgia(data: LouvorItemRowComCantico[]): ItemAgrupado[] {
  const agrupados: ItemAgrupado[] = [];

  for (const it of data) {
    if (isBoletimFallbackTipo(it.tipo) || isLiturgiaMetaTipo(it.tipo)) continue;

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
  onCreate?: (nome: string) => Promise<Cantico>;
  disabled?: boolean;
}) {
  const textosRepertorio = getRepertorioTextos(canticos);
  const [query, setQuery] = useState(getCanticoDisplayLabel(value));
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(getCanticoDisplayLabel(value)); }, [value]);

  const filtrados = canticos.filter((c) => matchesCanticoQuery(c, query)).slice(0, 8);

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

  const dropdown = open && !disabled ? (
    <div
      style={dropdownStyle}
      className="bg-white border border-slate-200 rounded-2xl max-h-64 overflow-auto shadow-2xl"
    >
      {filtrados.map(c => {
        const st = getStatusMusica(c.ultima_vez);
        const titulo = getCanticoDisplayLabel(c);
        return (
          <div
            key={c.id}
            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 active:bg-slate-100"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onChange(c); setQuery(getCanticoDisplayLabel(c)); setOpen(false); }}
          >
            <div className="text-base font-semibold text-slate-800">{titulo}</div>
            <div className={`text-xs font-bold mt-0.5 ${st.cor}`}>{st.label} · {st.dataFormatada}</div>
          </div>
        );
      })}
      {onCreate && query.trim() && !canticos.some(c => c.nome.toLowerCase() === query.toLowerCase()) && (
        <div
          className="px-4 py-3 text-emerald-700 font-bold text-base hover:bg-emerald-50 cursor-pointer border-t border-emerald-100 active:bg-emerald-100"
          onMouseDown={e => e.preventDefault()}
          onClick={async () => {
            if (!onCreate) return;
            const n = await onCreate(query);
            onChange(n);
            setQuery(n.nome);
            setOpen(false);
          }}
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
        placeholder={textosRepertorio.placeholderBusca}
        className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500 bg-emerald-50/50 disabled:bg-slate-50 disabled:cursor-default"
      />
      {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

function AutoResizeTextarea({
  value,
  onChange,
  className,
  style,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ajustarAltura = () => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    ajustarAltura();
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={(event) => {
        ajustarAltura();
        onChange?.(event);
      }}
      rows={1}
      style={{ ...style, overflow: 'hidden' }}
      className={className}
    />
  );
}

function PublicCanticoTextarea({
  value,
  onChange,
  canticos,
  disabled,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  canticos: Cantico[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textosRepertorio = getRepertorioTextos(canticos);
  const [triggerState, setTriggerState] = useState<{
    trigger: '@' | '#';
    query: string;
    start: number;
    end: number;
  } | null>(null);
  const [selecionadoIndex, setSelecionadoIndex] = useState(0);

  const ajustarAltura = () => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    ajustarAltura();
  }, [value]);

  const analisarTrigger = (texto: string, cursor: number) => {
    const cursorSeguro = Math.max(0, Math.min(cursor, texto.length));
    const trechoAnterior = texto.slice(0, cursorSeguro);
    const inicioLinha = trechoAnterior.lastIndexOf('\n') + 1;
    const linhaAtual = trechoAnterior.slice(inicioLinha);
    const match = linhaAtual.match(/(?:^|\s)([@#])([^\s@#]*)$/);

    if (!match) {
      setTriggerState(null);
      return;
    }

    const trigger = match[1] as '@' | '#';
    const query = match[2] || '';
    if (trigger === '#' && !textosRepertorio.aceitaBuscaPorNumero) {
      setTriggerState(null);
      return;
    }
    const token = `${trigger}${query}`;
    const tokenIndex = linhaAtual.lastIndexOf(token);

    if (tokenIndex < 0) {
      setTriggerState(null);
      return;
    }

    let end = cursorSeguro;

    while (end < texto.length && !/\s/.test(texto[end])) {
      end += 1;
    }

    setTriggerState({
      trigger,
      query,
      start: inicioLinha + tokenIndex,
      end,
    });
    setSelecionadoIndex(0);
  };

  const sugestoes = useMemo(() => {
    if (!triggerState) return [];

    if (triggerState.trigger === '#') {
      const termo = triggerState.query.trim();
      const termoCompacto = termo.replace(/\D/g, '');

      return canticos
        .filter((cantico) => cantico.tipo === 'hinario' && cantico.numero)
        .filter((cantico) => {
          if (!termoCompacto) return true;

          const numero = cantico.numero?.trim() || '';
          const numeroSemZeros = numero.replace(/^0+/, '') || numero;

          return (
            numero.includes(termoCompacto) ||
            numeroSemZeros.includes(termoCompacto)
          );
        })
        .slice(0, 8);
    }

    return canticos.filter((cantico) => matchesCanticoQuery(cantico, triggerState.query)).slice(0, 8);
  }, [canticos, triggerState]);

  const aplicarSugestao = (cantico: Cantico) => {
    if (!triggerState) return;

    const referencia = getCanticoInlineReference(cantico);
    const proximoValor = `${value.slice(0, triggerState.start)}${referencia}${value.slice(triggerState.end)}`;
    onChange(proximoValor);
    setTriggerState(null);
    setSelecionadoIndex(0);

    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      const novaPosicao = triggerState.start + referencia.length;
      element.focus();
      element.setSelectionRange(novaPosicao, novaPosicao);
      ajustarAltura();
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        style={{ overflow: 'hidden' }}
        className={className}
        onChange={(event) => {
          const proximoValor = event.target.value;
          onChange(proximoValor);
          ajustarAltura();
          analisarTrigger(proximoValor, event.target.selectionStart ?? proximoValor.length);
        }}
        onClick={(event) => {
          const element = event.currentTarget;
          analisarTrigger(element.value, element.selectionStart ?? element.value.length);
        }}
        onKeyUp={(event) => {
          const element = event.currentTarget;
          analisarTrigger(element.value, element.selectionStart ?? element.value.length);
        }}
        onBlur={() => {
          setTimeout(() => setTriggerState(null), 120);
        }}
        onKeyDown={(event) => {
          if (!triggerState || sugestoes.length === 0) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelecionadoIndex((atual) => (atual + 1) % sugestoes.length);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelecionadoIndex((atual) => (atual - 1 + sugestoes.length) % sugestoes.length);
            return;
          }

          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            aplicarSugestao(sugestoes[selecionadoIndex] || sugestoes[0]);
            return;
          }

          if (event.key === 'Escape') {
            setTriggerState(null);
          }
        }}
      />

      {triggerState && sugestoes.length > 0 && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            {triggerState.trigger === '#'
              ? 'Buscar hino por número'
              : textosRepertorio.tituloBuscaNome}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {sugestoes.map((cantico, index) => {
              const ativo = index === selecionadoIndex;
              return (
                <button
                  key={`${cantico.id}-${index}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => aplicarSugestao(cantico)}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    ativo ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {cantico.nome}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getCanticoInlineReference(cantico)}
                    </p>
                  </div>
                  {cantico.numero ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {cantico.numero}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
  const tiposDisponiveis = item.tiposLiturgicosDisponiveis || TIPOS_LITURGICOS_PADRAO;
  const tipoInputId = `tipo-liturgico-${index}`;
  const tituloItem = item.tipo?.trim() || `Item ${index + 1}`;
  const textosRepertorio = getRepertorioTextos(canticos);

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
    <div className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-[0_20px_50px_-30px_rgba(5,150,105,0.35)]">
      {/* Cabeçalho do item */}
      <div className="flex items-start gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-5 py-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700 shadow-inner">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
            Momento da liturgia
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-slate-900">{tituloItem}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Edite abaixo o nome desta etapa, o texto que vai aparecer no boletim e as observações internas.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start">
          {isLideranca && (
            <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <button onClick={() => onMove('cima')} className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200">↑</button>
              <button onClick={() => onMove('baixo')} className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200">↓</button>
              <button onClick={onRemove} className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-100">🗑</button>
            </div>
          )}

          <button onClick={() => setExpandido(!expandido)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:bg-slate-100">
          {expandido ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="space-y-5 px-5 py-5">
          <div className={`grid gap-4 ${HABILITAR_BOLETIM_SECOES_NEXT && isLideranca ? 'xl:grid-cols-[minmax(0,1fr)_240px]' : ''}`}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <label className="block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Nome da etapa
              </label>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Dê o nome deste momento do culto. Você pode digitar livremente ou aproveitar uma sugestão já usada pela igreja.
              </p>
              {isLideranca ? (
                <>
                  <input
                    list={tipoInputId}
                    value={item.tipo}
                    onChange={e => onUpdate({ ...item, tipo: e.target.value })}
                    onBlur={e => onUpdate({ ...item, tipo: e.target.value.trim() || `Item ${index + 1}` })}
                    placeholder="Ex.: Pregação da Palavra"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800 outline-none transition-colors focus:border-emerald-400"
                  />
                  <datalist id={tipoInputId}>
                    {tiposDisponiveis.map((t: string) => <option key={t} value={t} />)}
                  </datalist>
                </>
              ) : (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800">
                  {tituloItem}
                </div>
              )}
            </div>

            {HABILITAR_BOLETIM_SECOES_NEXT && isLideranca && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <label className="block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Horário interno
                </label>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Esse campo ajuda a equipe a se organizar. Você pode usar formatos como <code>09:30</code> ou <code>9h30-9h40</code>.
                </p>
                <input
                  value={item.horario || ''}
                  onChange={e => onUpdate({ ...item, horario: e.target.value })}
                  placeholder="Ex.: 9h30-9h40"
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition-colors focus:border-emerald-400"
                />
              </div>
            )}
          </div>

          {/* Campo público */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <label className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">
                <span>📢</span> Público
              </label>
              <p className="mb-3 text-sm leading-6 text-emerald-900/70">
                <span dangerouslySetInnerHTML={{ __html: textosRepertorio.ajudaPublico }} />
              </p>
            <PublicCanticoTextarea
              value={item.conteudo_publico || ''}
              onChange={(conteudo) => onUpdate({ ...item, conteudo_publico: conteudo })}
              canticos={canticos}
              disabled={!isLideranca}
              placeholder={textosRepertorio.placeholderPublico}
              className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition-colors focus:border-emerald-400 resize-none disabled:cursor-default disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:py-0 placeholder:text-slate-300"
            />
          </div>

          {/* Campo interno */}
          {isLideranca && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <span>🔒</span> Interno
              </label>
              <p className="mb-3 text-sm leading-6 text-slate-500">
                Use este espaço para instruções da equipe, lembretes, nomes de pessoas, observações de condução e tudo o que não deve ir para o público.
              </p>
              <AutoResizeTextarea
                value={item.descricao || ''}
                onChange={e => onUpdate({ ...item, descricao: e.target.value })}
                placeholder="Ex.: Quem conduz, qual salmo será lido, orientação para a equipe..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-600 outline-none transition-colors focus:border-slate-400 resize-none placeholder:text-slate-300"
              />
            </div>
          )}

          {/* Cânticos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400">
                <span>🎵</span> {textosRepertorio.rotuloPlural}
              </label>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {onCreate
                  ? textosRepertorio.descricaoSecaoComCadastro
                  : textosRepertorio.descricaoSecaoSemCadastro}
              </p>
            </div>
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
                <span>🎵</span> {textosRepertorio.acaoAdicionar}
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
  const [avisoItens, setAvisoItens] = useState<AvisoItemRascunho[]>([]);

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
      setAvisoItens([]);
      return;
    }

    if (tipo === 'avisos') {
      const avisos = itensExistentes.map((item) => {
        const aviso = parseAvisoConteudo(item.conteudo);
        return {
          ...aviso,
          id: item.id || aviso.id,
          destaque: item.destaque,
        };
      });
      setAvisoItens([...avisos, createEmptyAvisoItem()]);
      setItens([]);
      setAgendaItens([]);
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
    setAvisoItens([]);
  }, [aberto, tipo, secaoExistente]);

  if (!aberto || !tipo) return null;

  const config = getBoletimTipoConfig(tipo);
  const isAgenda = tipo === 'agenda';
  const isAvisos = tipo === 'avisos';

  const garantirCampoTextoExtra = (lista: BoletimItemRascunho[]) => {
    const preenchidos = lista.filter((item) => item.conteudo.trim().length > 0);
    return [...preenchidos, createEmptyBoletimItem()];
  };

  const garantirCampoAgendaExtra = (lista: AgendaItemRascunho[]) => {
    const preenchidos = lista.filter((item) => item.descricao.trim().length > 0);
    return [...preenchidos, createEmptyAgendaItem()];
  };

  const garantirCampoAvisoExtra = (lista: AvisoItemRascunho[]) => {
    const preenchidos = lista.filter(
      (item) => item.titulo.trim().length > 0 || item.corpo.trim().length > 0
    );
    return [...preenchidos, createEmptyAvisoItem()];
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
        : isAvisos
          ? avisoItens
              .filter((item) => item.titulo.trim().length > 0 && item.corpo.trim().length > 0)
              .map((item) => ({
                id: item.id,
                conteudo: serializeAvisoConteudo(item),
                destaque: item.destaque,
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
          ) : isAvisos ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Avisos</p>
                <p className="mt-2 text-sm text-slate-500">
                  Cada aviso precisa de um título e um corpo de texto. O boletim só publica avisos completos.
                </p>
              </div>

              <div className="space-y-4">
                {avisoItens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Título do aviso
                      <input
                        value={item.titulo}
                        onChange={(event) => {
                          const atualizados = avisoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, titulo: event.target.value } : entry
                          );
                          setAvisoItens(garantirCampoAvisoExtra(atualizados));
                        }}
                        placeholder="Ex.: Reunião de membros"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Corpo do aviso
                      <AutoResizeTextarea
                        value={item.corpo}
                        onChange={(event) => {
                          const atualizados = avisoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, corpo: event.target.value } : entry
                          );
                          setAvisoItens(garantirCampoAvisoExtra(atualizados));
                        }}
                        placeholder="Descreva aqui o aviso completo..."
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    {(item.titulo.trim() && item.corpo.trim()) ? (
                      <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.destaque}
                          onChange={(event) => {
                            const atualizados = avisoItens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, destaque: event.target.checked } : entry
                            );
                            setAvisoItens(atualizados);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        />
                        Destacar este aviso
                      </label>
                    ) : null}

                    {(item.titulo.trim() || item.corpo.trim() || avisoItens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setAvisoItens(
                              garantirCampoAvisoExtra(avisoItens.filter((entry) => entry.id !== item.id))
                            )
                          }
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover aviso
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

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <p className="max-w-md text-sm leading-6 text-slate-500">
            Aplicar seção guarda as mudanças neste editor. Para publicar no boletim e aparecer na home, ainda é preciso clicar em <strong>Salvar Liturgia</strong>.
          </p>
          <div className="flex items-center gap-3">
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
    </div>
  );
}

function EditorBoletimDoDiaModal({
  aberto,
  dia,
  cultos,
  onFechar,
  onSalvo,
  inline = false,
}: {
  aberto: boolean;
  dia: string;
  cultos: Culto[];
  onFechar: () => void;
  onSalvo: () => void;
  inline?: boolean;
}) {
  const [palavraPastoral, setPalavraPastoral] = useState('');
  const [palavraPastoralAutor, setPalavraPastoralAutor] = useState('');
  const [imagemUpload, setImagemUpload] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecaoRascunho[]>([]);
  const [loadingBoletim, setLoadingBoletim] = useState(false);
  const [showEscolherTipo, setShowEscolherTipo] = useState(false);
  const [tipoNovaSecao, setTipoNovaSecao] = useState<string | null>(null);
  const [secaoEditandoIndex, setSecaoEditandoIndex] = useState<number | null>(null);

  const referencia = useMemo(() => getCultoBoletimReferencia(cultos), [cultos]);
  const cultoIds = cultos.map((culto) => culto['Culto nr.']);
  const cultoIdsKey = useMemo(() => cultoIds.join(','), [cultoIds]);
  const secaoEditando =
    secaoEditandoIndex !== null ? boletimSecoes[secaoEditandoIndex] || null : null;

  useEffect(() => {
    if (!aberto) return;

    setPalavraPastoral(referencia?.palavra_pastoral || '');
    setPalavraPastoralAutor(referencia?.palavra_pastoral_autor || '');
    setImagemPreview(referencia?.imagem_url || null);
    setImagemUpload(null);
    setInstagramUrl('');

    const carregar = async () => {
      if (cultoIds.length === 0) {
        setBoletimSecoes([]);
        return;
      }

      setLoadingBoletim(true);
      try {
        const { data, error } = await supabase
          .from('louvor_itens')
          .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, descricao, horario')
          .in('culto_id', cultoIds)
          .order('ordem', { ascending: true });

        if (error) throw error;

        const rows = (data || []) as LouvorItemRow[];
        let secoes: BoletimSecaoRascunho[] = [];

        for (const cultoId of cultoIds) {
          const rowsDoCulto = rows.filter((row) => row.culto_id === cultoId);
          const secoesDoCulto = buildBoletimSecoesFromFallbackRows(rowsDoCulto);
          if (secoesDoCulto.length > 0) {
            secoes = secoesDoCulto;
            break;
          }
        }

        setBoletimSecoes(normalizarSecoesBoletim(secoes));
      } catch (error) {
        console.warn('Falha ao carregar boletim do dia:', error);
        setBoletimSecoes([]);
      } finally {
        setLoadingBoletim(false);
      }
    };

    carregar();
  }, [aberto, referencia, cultoIdsKey]);

  if (!aberto) return null;

  const containerClassName = inline
    ? 'rounded-[28px] border border-emerald-200 bg-white shadow-sm'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm';

  const surfaceClassName = inline
    ? 'w-full'
    : 'max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[30px] bg-white shadow-2xl';

  const headerClassName = inline
    ? 'flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5'
    : 'sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5';

  const footerClassName = inline
    ? 'flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4'
    : 'sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4';

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagemUpload(file);
    const reader = new FileReader();
    reader.onload = event => setImagemPreview(event.target?.result as string);
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
      reader.onload = event => setImagemPreview(event.target?.result as string);
      reader.readAsDataURL(file);
      setInstagramUrl('');
      alert('✅ Imagem importada!');
    } catch {
      alert('❌ Erro ao importar');
    } finally {
      setImportando(false);
    }
  };

  const salvarBoletim = async () => {
    if (cultoIds.length === 0) {
      alert('Crie pelo menos uma liturgia neste dia antes de editar o boletim.');
      return;
    }

    setSalvando(true);
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) throw new Error('Selecione uma igreja antes de salvar o boletim.');

      let imagemUrlFinal =
        imagemPreview === null && !imagemUpload
          ? null
          : referencia?.imagem_url || null;

      if (imagemUpload) {
        const url = await uploadImagemTema(imagemUpload, cultoIds[0]);
        if (url) {
          imagemUrlFinal = url;
        }
      } else if (typeof imagemPreview === 'string' && !imagemPreview.startsWith('data:')) {
        imagemUrlFinal = imagemPreview;
      }

      const { error: syncBoletimError } = await supabase
        .from('Louvores IPPN')
        .update({
          palavra_pastoral: palavraPastoral || null,
          palavra_pastoral_autor: palavraPastoralAutor || null,
          imagem_url: imagemUrlFinal,
        })
        .in('"Culto nr."', cultoIds)
        .eq('igreja_id', igrejaId);

      if (syncBoletimError) throw syncBoletimError;

      const { error: deleteFallbackError } = await supabase
        .from('louvor_itens')
        .delete()
        .in('culto_id', cultoIds)
        .like('tipo', `${BOLETIM_FALLBACK_TIPO_PREFIX}%`);

      if (deleteFallbackError) throw deleteFallbackError;

      const fallbackRows = cultoIds.flatMap((cultoId) =>
        buildBoletimFallbackRows(boletimSecoes, 1000).map((row) => ({
          culto_id: cultoId,
          ...row,
        }))
      );

      if (fallbackRows.length > 0) {
        const { error: fallbackInsertError } = await supabase.from('louvor_itens').insert(fallbackRows);
        if (fallbackInsertError) throw fallbackInsertError;
      }

      alert('✅ Boletim do dia salvo com sucesso!');
      onSalvo();
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={containerClassName}>
      <div className={surfaceClassName}>
        <div className={headerClassName}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Boletim do dia</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">{formatCultoDateLabel(dia)}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Este conteúdo é compartilhado entre todas as liturgias deste dia.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {inline ? 'Fechar editor' : 'Fechar'}
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {inline ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm leading-6 text-emerald-950/80">
              Aqui voce edita o boletim compartilhado deste domingo sem precisar entrar em uma liturgia especifica.
            </div>
          ) : null}

          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Palavra Pastoral</p>
            <p className="mt-2 text-sm leading-7 text-emerald-950/75">
              Mensagem pastoral, estudo, editorial ou reflexão do boletim deste dia.
            </p>
            <AutoResizeTextarea
              value={palavraPastoral}
              onChange={e => setPalavraPastoral(e.target.value)}
              placeholder="Escreva aqui a palavra pastoral do boletim..."
              className="mt-4 w-full rounded-[24px] border border-emerald-200 bg-white px-5 py-4 text-[17px] leading-8 text-slate-700 outline-none transition-colors focus:border-emerald-400 resize-none placeholder:text-slate-300"
            />
            <input
              value={palavraPastoralAutor}
              onChange={e => setPalavraPastoralAutor(e.target.value)}
              placeholder="Autor da palavra"
              className="mt-4 w-full max-w-xl rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base italic text-slate-600 outline-none transition-colors focus:border-emerald-400"
            />
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Imagem do tema</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Essa imagem também é compartilhada entre todas as liturgias do dia.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Importar do Instagram
                </label>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    placeholder="URL do post do Instagram..."
                    value={instagramUrl}
                    onChange={e => setInstagramUrl(e.target.value)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-purple-400"
                  />
                  <button
                    onClick={importarInstagram}
                    disabled={importando}
                    className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {importando ? 'Importando...' : 'Importar imagem'}
                  </button>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImagemChange}
                  className="mt-4 w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-300"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Pré-visualização</p>
                {imagemPreview ? (
                  <div className="relative mt-4 group">
                    <img src={imagemPreview} alt="Preview" className="h-72 w-full rounded-2xl object-cover" />
                    <button
                      onClick={() => { setImagemPreview(null); setImagemUpload(null); }}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm leading-6 text-slate-400">
                    Nenhuma imagem selecionada para este boletim.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Seções do boletim
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Avisos, pedidos de oração, agenda, informativo e outros blocos compartilhados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEscolherTipo(true)}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
              >
                + Nova seção
              </button>
            </div>

            {loadingBoletim ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Carregando seções do boletim...
              </div>
            ) : boletimSecoes.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm leading-6 text-slate-500">
                Nenhuma seção adicional cadastrada para este boletim.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {boletimSecoes.map((secao, index) => {
                  const config = getBoletimTipoConfig(secao.tipo);

                  return (
                    <div key={secao.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
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
        </div>

        <div className={footerClassName}>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvarBoletim}
            disabled={salvando}
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {salvando ? 'Salvando boletim...' : 'Salvar boletim do dia'}
          </button>
        </div>
      </div>

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
    </div>
  );
}

// --- EDITOR DE LITURGIA ---
function EditorLiturgia({
  culto,
  diaInicial,
  todosCultos,
  onAbrirCulto,
  onSalvo,
  onCancelar,
  canticos,
  setCanticos,
  podeEditarLiturgiaCompleta,
  podeEditarLouvor,
  configuracaoIgreja,
}: any) {
  const [dia, setDia] = useState<string>(culto?.Dia || diaInicial || '');
  const [nomeLiturgia, setNomeLiturgia] = useState<string>(culto?.nome_liturgia || '');
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [palavraPastoral, setPalavraPastoral] = useState(culto?.palavra_pastoral || '');
  const [palavraPastoralAutor, setPalavraPastoralAutor] = useState(
    culto?.palavra_pastoral_autor || configuracaoIgreja?.pastorPadrao || ''
  );
  const [imagemUpload, setImagemUpload] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(culto?.imagem_url || null);
  const [loading, setLoading] = useState(false);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecaoRascunho[]>([]);

  const isLideranca = podeEditarLiturgiaCompleta;
  const podVerTom = isLideranca || podeEditarLouvor;
  const canEditarMusica = isLideranca || podeEditarLouvor;
  const podeCadastrarCanticos =
    canEditarMusica && configuracaoIgreja?.permiteCadastroCanticos !== false;
  const tiposLiturgicos = normalizarTiposLiturgicosDisponiveis(
    resolveTiposLiturgicos(configuracaoIgreja),
    itens
  );
  const temModeloDaIgreja = (configuracaoIgreja?.modelosLiturgia?.length || 0) > 0;
  const dataCultoFormatada = dia ? formatCultoDateLabel(dia) : 'Escolha a data do culto';
  const totalItensComTextoPublico = itens.filter((item) => item.conteudo_publico?.trim()).length;
  const tituloLiturgiaAtual = getCultoTituloExibicao(
    culto,
    nomeLiturgia.trim() || (culto ? 'Editar Liturgia' : 'Nova Liturgia')
  );
  const cultosDoMesmoDiaAtual = useMemo(
    () =>
      (todosCultos || []).filter(
        (item: Culto) => dia && getCultoDateKey(item.Dia) === getCultoDateKey(dia)
      ),
    [todosCultos, dia]
  );
  const outrosCultosDoMesmoDia = cultosDoMesmoDiaAtual.filter(
    (item: Culto) => !culto || item['Culto nr.'] !== culto['Culto nr.']
  );

  useEffect(() => {
    setNomeLiturgia(culto?.nome_liturgia || '');
  }, [culto?.['Culto nr.'], culto?.nome_liturgia]);

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

    if (cultosDoMesmoDiaAtual.length > 0) {
      carregarSecoesBoletim(cultosDoMesmoDiaAtual.map((item: Culto) => item['Culto nr.']));
      return;
    }

    setBoletimSecoes([]);
  }, [culto, dia, todosCultos]);

  useEffect(() => {
    if (culto?.palavra_pastoral_autor) return;
    if (!configuracaoIgreja?.pastorPadrao) return;

    setPalavraPastoralAutor((current: string) => (
      current.trim() ? current : configuracaoIgreja.pastorPadrao || ''
    ));
  }, [culto?.palavra_pastoral_autor, configuracaoIgreja]);

  useEffect(() => {
    if (!dia || cultosDoMesmoDiaAtual.length === 0) return;

    const referencia = getCultoBoletimReferencia(cultosDoMesmoDiaAtual);
    if (!referencia) return;

    setPalavraPastoral(referencia.palavra_pastoral || '');
    setPalavraPastoralAutor(
      referencia.palavra_pastoral_autor || configuracaoIgreja?.pastorPadrao || ''
    );
    setImagemPreview(referencia.imagem_url || null);
    setImagemUpload(null);
  }, [dia, cultosDoMesmoDiaAtual, configuracaoIgreja?.pastorPadrao]);

  const carregarItens = async (cultoNr: number) => {
    const data = await carregarLouvorItensComCanticos(cultoNr, canticos, getStoredChurchId());
    const itensLiturgia = data.filter(
      (linha) => !isBoletimFallbackTipo(linha.tipo) && !isLiturgiaMetaTipo(linha.tipo)
    );

    if (!itensLiturgia) return;

    // Agrupar linhas do mesmo item
    const agrupados: LouvorItem[] = [];
    itensLiturgia.forEach((linha: any) => {
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

  const carregarSecoesBoletim = async (cultoIds: number[]) => {
    if (!HABILITAR_BOLETIM_SECOES_NEXT) {
      setBoletimSecoes([]);
      return;
    }

    try {
      const { data: itensRaw, error: itensError } = await supabase
        .from('louvor_itens')
        .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, descricao, horario')
        .in('culto_id', cultoIds)
        .order('ordem', { ascending: true });

      if (itensError) throw itensError;

      const rows = (itensRaw || []) as LouvorItemRow[];
      let secoesRascunho: BoletimSecaoRascunho[] = [];

      for (const cultoId of cultoIds) {
        const rowsDoCulto = rows.filter((row) => row.culto_id === cultoId);
        const secoesDoCulto = buildBoletimSecoesFromFallbackRows(rowsDoCulto);

        if (secoesDoCulto.length > 0) {
          secoesRascunho = secoesDoCulto;
          break;
        }
      }

      setBoletimSecoes(normalizarSecoesBoletim(secoesRascunho));
    } catch (error) {
      console.warn('Falha ao carregar seções extras do boletim:', error);
      setBoletimSecoes([]);
    }
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
        const url = await uploadImagemTema(imagemUpload, cId);
        if (url) {
          imagemUrl = url;
        }
      }

      const cultoIdsMesmoDia = Array.from(
        new Set([...cultosDoMesmoDiaAtual.map((item: Culto) => item['Culto nr.']), cId])
      );
      const imagemUrlFinal =
        imagemPreview === null && !imagemUpload
          ? null
          : imagemUrl ||
            (typeof imagemPreview === 'string' && !imagemPreview.startsWith('data:') ? imagemPreview : null);

      if (cultoIdsMesmoDia.length > 0) {
        const { error: syncBoletimError } = await supabase
          .from('Louvores IPPN')
          .update({
            palavra_pastoral: palavraPastoral || null,
            palavra_pastoral_autor: palavraPastoralAutor || null,
            imagem_url: imagemUrlFinal,
          })
          .in('"Culto nr."', cultoIdsMesmoDia)
          .eq('igreja_id', igrejaId);

        if (syncBoletimError) throw syncBoletimError;
      }

      await supabase.from('louvor_itens').delete().eq('culto_id', cId);

      const rows: any[] = [];
      const metaNomeLiturgia = buildLiturgiaMetaRow(nomeLiturgia);

      if (metaNomeLiturgia) {
        rows.push({
          culto_id: cId,
          ...metaNomeLiturgia,
        });
      }

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
        const { error: deleteFallbackError } = await supabase
          .from('louvor_itens')
          .delete()
          .in('culto_id', cultoIdsMesmoDia)
          .like('tipo', `${BOLETIM_FALLBACK_TIPO_PREFIX}%`);

        if (deleteFallbackError) throw deleteFallbackError;

        const fallbackRows = cultoIdsMesmoDia.flatMap((cultoIdMesmoDia) =>
          buildBoletimFallbackRows(boletimSecoes, 1000).map((row) => ({
            culto_id: cultoIdMesmoDia,
            ...row,
          }))
        );

        if (fallbackRows.length > 0) {
          const { error: fallbackInsertError } = await supabase.from('louvor_itens').insert(fallbackRows);
          if (fallbackInsertError) throw fallbackInsertError;
        }
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(180deg,#f4f7f6_0%,#eef3f1_100%)] pb-36">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <button onClick={onCancelar} className="rounded-2xl px-4 py-2.5 text-base font-bold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100">
            ← Voltar
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Editor de culto</p>
            <h2 className="truncate text-base font-black uppercase tracking-wider text-slate-800">
              {tituloLiturgiaAtual}
            </h2>
          </div>
          <div className="hidden min-w-[220px] justify-end text-right text-xs text-slate-500 lg:flex">
            Preencha com calma. Tudo foi pensado para parecer um editor simples e guiado.
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1800px] gap-6 px-4 pt-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-700">Como editar</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Uma folha simples para montar o culto</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Pense nesta tela como um editor guiado. Preencha a data, escreva a palavra pastoral se quiser, organize a imagem e depois monte a liturgia item por item.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Resumo rápido</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Data</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{dataCultoFormatada}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Itens da liturgia</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{itens.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Texto público preenchido</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{totalItensComTextoPublico}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Dicas</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>O campo <strong>Público</strong> é o que pode aparecer no boletim e nas saídas públicas.</p>
              <p>O campo <strong>Interno</strong> é só para orientar quem vai conduzir o culto.</p>
              <p>Nos títulos dos itens, você pode digitar livremente. Não precisa cadastrar antes.</p>
              <p>Se a igreja já tem um modelo, você pode usá-lo como ponto de partida e depois ajustar tudo.</p>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-[34px] border border-slate-200/90 bg-white/95 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-6 py-8 lg:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Documento do culto</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">
              {tituloLiturgiaAtual}
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Preencha cada bloco como se estivesse escrevendo um documento: primeiro as informações gerais, depois os conteúdos do boletim e por fim os momentos da liturgia.
            </p>
          </div>

          <div className="space-y-8 px-6 py-8 lg:px-10">
            {cultosDoMesmoDiaAtual.length > 0 ? (
              <div className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-700">
                  Domingo em conjunto
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-900">
                  {cultosDoMesmoDiaAtual.length === 1
                    ? 'Este domingo tem 1 liturgia cadastrada'
                    : `Este domingo tem ${cultosDoMesmoDiaAtual.length} liturgias cadastradas`}
                </h3>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                  Nesta fase, o banco continua igual, mas a interface já trata as liturgias do mesmo domingo como um conjunto. Você pode navegar entre elas sem sair da página.
                </p>

                {outrosCultosDoMesmoDia.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {outrosCultosDoMesmoDia.map((item: Culto, index: number) => (
                      <button
                        key={item['Culto nr.']}
                        type="button"
                        onClick={() => onAbrirCulto(item)}
                        className="rounded-2xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100"
                      >
                        {getCultoNomeLiturgia(item) || `Abrir liturgia ${index + 1}`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)]">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <label className="block text-xs font-black uppercase tracking-[0.24em] text-slate-400">Data do culto</label>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Escolha a data do culto. Em uma liturgia nova, o sistema pode usar essa data para sugerir o modelo inicial.
                </p>
                <input
                  type="date"
                  value={dia}
                  onChange={e => {
                    setDia(e.target.value);
                    if (!culto && e.target.value) setItens(modeloPadrao(e.target.value, configuracaoIgreja));
                  }}
                  disabled={!isLideranca}
                  className="mt-4 w-full bg-transparent py-1 text-2xl font-black text-emerald-800 outline-none"
                />
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <label className="block text-xs font-black uppercase tracking-[0.24em] text-slate-400">Nome da liturgia</label>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Dê um nome livre para identificar esta celebração, como Culto Manhã, Culto Noite ou Culto Vespertino.
                </p>
                <input
                  type="text"
                  value={nomeLiturgia}
                  onChange={(e) => setNomeLiturgia(e.target.value)}
                  disabled={!isLideranca}
                  placeholder="Ex.: Culto Manhã"
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xl font-bold text-slate-800 outline-none transition-colors focus:border-emerald-400 disabled:bg-slate-100"
                />
              </div>
            </div>

            {isLideranca ? (
              <div className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-700">
                  Boletim do dia
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-900">
                  Conteúdo compartilhado entre todas as liturgias deste dia
                </h3>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                  Palavra pastoral, imagem do tema e seções extras não são editadas aqui. Para manter a regra de negócio clara, esse conteúdo agora fica no botão <strong>Editar boletim do dia</strong> na listagem do domingo.
                </p>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Liturgia</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Monte a ordem do culto como um documento vivo. Cada cartão abaixo representa um momento da liturgia e explica exatamente o que preencher.
                  </p>
                  {isLideranca && temModeloDaIgreja && (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Se quiser acelerar, use o modelo da igreja e depois personalize cada item.
                    </p>
                  )}
                </div>
                {isLideranca && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {temModeloDaIgreja && (
                      <button
                        onClick={aplicarModeloDaIgreja}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 active:bg-emerald-200"
                      >
                        Usar modelo da igreja
                      </button>
                    )}
                    <button
                      onClick={() => adicionarItem(0)}
                      className="rounded-2xl px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
                    >
                      + item no início
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {itens.map((it, idx) => (
                  <div key={idx}>
                    <ItemLiturgia
                      item={{ ...it, tiposLiturgicosDisponiveis: tiposLiturgicos }}
                      index={idx}
                      canticos={canticos}
                      onCreate={podeCadastrarCanticos
                        ? async (nome: string) => {
                            const igrejaId = getStoredChurchId();
                            if (!igrejaId) {
                              throw new Error('Selecione uma igreja antes de cadastrar um cântico.');
                            }

                            const payload = {
                              nome: nome.trim(),
                              letra: '',
                              referencia: '',
                              tags: [],
                              youtube_url: null,
                              spotify_url: null,
                              igreja_id: igrejaId,
                            };

                            const { data, error }: any = await supabase
                              .from('canticos')
                              .insert(payload)
                              .select('id, nome, igreja_id')
                              .single();

                            if (error) {
                              throw new Error(error.message || 'Nao foi possivel criar o cântico.');
                            }

                            const novo = { ...data, ultima_vez: null };
                            setCanticos((prev: Cantico[]) => [...prev, novo]);
                            return novo;
                          }
                        : undefined}
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
                        className="mt-2 w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100"
                      >
                        + adicionar item aqui
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Botão salvar fixo */}
      {isLideranca && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
            <div className="text-sm leading-6 text-slate-500">
              Salve quando terminar. Este botão salva a liturgia atual. O boletim compartilhado do dia é editado separadamente.
            </div>
            <button
              onClick={salvar}
              disabled={loading}
              className="block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? '⏳ Salvando...' : '✅ Salvar Liturgia'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// --- CARD DE CULTO NA LISTAGEM ---
function CultoCard({
  culto,
  tituloExibicao,
  descricaoExibicao,
  onEditar,
  onWhatsApp,
  onPDF,
  onExcluir,
  podeEditar,
  podeExcluir,
  excluindo,
  esconderResumoBoletim,
}: any) {
  const dataFormatada = formatCultoDateLabel(culto.Dia);
  const titulo = getCultoTituloExibicao(culto, tituloExibicao || dataFormatada);

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {culto.imagem_url ? (
            <img src={culto.imagem_url} alt="" className="h-20 w-20 rounded-2xl object-cover shadow-sm flex-shrink-0" />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 shadow-sm">
              L
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Liturgia do dia</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
              {titulo}
            </h3>
            {descricaoExibicao ? (
              <p className="mt-2 text-sm leading-6 text-slate-500">{descricaoExibicao}</p>
            ) : null}
            {!esconderResumoBoletim && culto.palavra_pastoral ? (
              <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                Palavra pastoral disponível
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:max-w-[360px] lg:justify-end">
          {podeEditar ? (
            <button
              onClick={() => onEditar(culto)}
              className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
              title="Editar liturgia"
            >
              Editar liturgia
            </button>
          ) : null}
          <button onClick={() => onWhatsApp(culto)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 active:bg-emerald-200" title="WhatsApp">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.559 4.189 1.619 6.011L0 24l6.117-1.605a11.847 11.847 0 005.925 1.586h.005c6.635 0 12.032-5.396 12.035-12.032a11.76 11.76 0 00-3.528-8.485" />
            </svg>
          </button>
          <button onClick={() => onPDF(culto)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200" title="PDF">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          {podeExcluir && (
            <button
              onClick={() => onExcluir(culto)}
              disabled={excluindo}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-lg text-red-600 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50"
              title="Excluir"
            >
              {excluindo ? '⏳' : '🗑️'}
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
  const [novoDiaInicial, setNovoDiaInicial] = useState('');
  const [boletimDiaEditando, setBoletimDiaEditando] = useState<{ dia: string; cultos: Culto[] } | null>(null);
  const [cultoExcluindoId, setCultoExcluindoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const isLideranca = permissoes.podeEditarLiturgiaCompleta;
  const totalLoading = loading || permLoading;
  const gruposCultos = useMemo(() => buildCultoDayGroups(cultos), [cultos]);

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
    try {
      const igrejaId = getStoredChurchId();

      if (!igrejaId) {
        setCanticos([]);
        setCultos([]);
        setConfiguracaoIgreja(null);
        return;
      }

      const [
        { data: canticosBaseRaw },
        { data: hinarioNovoCanticosRaw },
        { data: cultosData },
        { data: igrejaRaw },
        { data: modelosLiturgiaRaw },
      ] = await Promise.all([
        supabase
          .from('canticos')
          .select('id, nome, letra, igreja_id')
          .eq('igreja_id', igrejaId)
          .order('nome'),
        supabase
          .from('hinario_novo_cantico')
          .select('id, numero, titulo, letra')
          .order('numero'),
        supabase
          .from('Louvores IPPN')
          .select('*')
          .eq('igreja_id', igrejaId)
          .order('Dia', { ascending: false }),
        supabase
          .from('igrejas')
          .select('tipos_liturgicos, modelo_liturgico_padrao, modo_repertorio, permite_cadastro_canticos')
          .eq('id', igrejaId)
          .maybeSingle(),
        supabase
          .from('modelos_liturgia')
          .select('bloco, ordem, tipo, descricao_padrao, tem_cantico')
          .eq('igreja_id', igrejaId)
          .order('ordem', { ascending: true }),
      ]);

      const pastorPadrao = isUuid(igrejaId) ? await buscarPastorPadrao(igrejaId) : null;
      const canticosBaseNormalizados = (
        (canticosBaseRaw || []) as Array<{ id: string; nome: string; letra: string | null; igreja_id: string | null }>
      ).map((cantico) => ({
        ...cantico,
        tipo: 'cantico' as const,
        numero: null,
      }));
      const hinarioNovoCanticos = (
        (hinarioNovoCanticosRaw || []) as Array<{
          id: string | number;
          numero: string | null;
          titulo: string | null;
          letra: string | null;
        }>
      ).map(mapHinarioNovoCanticoToCantico);
      const todosCanticos = [...canticosBaseNormalizados, ...hinarioNovoCanticos].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR')
      );

      setCanticos(todosCanticos.map(c => ({ ...c, ultima_vez: null })));
      const cultosBase = (cultosData || []) as Culto[];
      let cultosComNome = cultosBase;

      if (cultosBase.length > 0) {
        const cultoIds = cultosBase.map((culto) => culto['Culto nr.']);

        try {
          const { data: nomesLiturgiaRows, error: nomesLiturgiaError } = await supabase
            .from('louvor_itens')
            .select('culto_id, conteudo_publico, ordem')
            .in('culto_id', cultoIds)
            .eq('tipo', LITURGIA_META_TIPO)
            .order('ordem', { ascending: true });

          if (nomesLiturgiaError) {
            console.warn('Falha ao carregar nomes das liturgias:', nomesLiturgiaError);
          } else {
            const nomesPorCulto = new Map<number, string>();

            (nomesLiturgiaRows || []).forEach((row: any) => {
              const cultoId = typeof row.culto_id === 'number' ? row.culto_id : Number(row.culto_id);
              const nome = typeof row.conteudo_publico === 'string' ? row.conteudo_publico.trim() : '';

              if (Number.isFinite(cultoId) && nome && !nomesPorCulto.has(cultoId)) {
                nomesPorCulto.set(cultoId, nome);
              }
            });

            cultosComNome = cultosBase.map((culto) => ({
              ...culto,
              nome_liturgia: nomesPorCulto.get(culto['Culto nr.']) || null,
            }));
          }
        } catch (error) {
          console.warn('Falha inesperada ao carregar nomes das liturgias:', error);
        }
      }

      setCultos(cultosComNome);
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

      const configuracaoCarregada = {
        tiposLiturgicos: tiposDaIgreja.length > 0 ? tiposDaIgreja : tiposDerivadosDoModelo,
        modelosLiturgia: modelosMesclados,
        pastorPadrao,
        modoRepertorio: normalizeModoRepertorio(igrejaRaw?.modo_repertorio) || null,
        permiteCadastroCanticos: igrejaRaw?.permite_cadastro_canticos ?? true,
      };

      setConfiguracaoIgreja(configuracaoCarregada);

      const canticosFiltrados = filtrarCanticosPorConfiguracao(
        (todosCanticos || []) as Cantico[],
        configuracaoCarregada
      );
      setCanticos(canticosFiltrados.map((cantico) => ({ ...cantico, ultima_vez: null })));

      if (todosCanticos.length > 0) {
        try {
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
            setCanticos(canticosFiltrados.map(c => ({ ...c, ultima_vez: mapaUltimas.get(String(c.id)) || null })));
          }
        } catch (error) {
          console.warn('Falha ao carregar histórico dos cânticos:', error);
        }
      } else {
        setCanticos([]);
      }
    } catch (error) {
      console.error('Falha ao carregar a página de cultos:', error);
      setCanticos([]);
      setCultos([]);
      setConfiguracaoIgreja(null);
    } finally {
      setLoading(false);
    }
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

    const data = await carregarLouvorItensComCanticos(cultoNr, canticos, igrejaId);
    if (!data) return;

    const agrupados = agruparItensLiturgia(data);

    const dataFmt = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR');
    const nomeLiturgia = getCultoNomeLiturgia(culto);
    let texto = `LITURGIA DO CULTO${nomeLiturgia ? ` *${nomeLiturgia.toUpperCase()}*` : ''} DE *${dataFmt}*\n\n`;

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

    const data = await carregarLouvorItensComCanticos(cultoNr, canticos, igrejaId);
    if (!data) return;
    const agrupados = agruparItensLiturgia(data);

    const dataFmt = new Date(culto.Dia + 'T00:00:00')
      .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
    const nomeLiturgia = getCultoNomeLiturgia(culto);

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
      const availableHeight = bottomY - topY;

      const drawHeader = () => {
        doc.setFillColor(16, 60, 48);
        doc.rect(0, 0, pw, headerBottom - 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(titleSize);
        doc.text(nomeLiturgia ? `LITURGIA - ${nomeLiturgia.toUpperCase()}` : 'LITURGIA DO CULTO', pw / 2, 11, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(subtitleSize);
        doc.text(dataFmt, pw / 2, 17, { align: 'center' });
        doc.setFontSize(metaSize);
        doc.text('Pagina 1 de 1', pw / 2, 23, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(16, 60, 48);
        doc.line(marginX, headerBottom, pw - marginX, headerBottom);
      };

      const calcPastoralHeight = () => {
        let h = titleH + blockGap;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(publicSize);
        h += doc.splitTextToSize(culto.palavra_pastoral || '', contentWidth - 4).length * lineH;
        if (culto.palavra_pastoral_autor) {
          h += lineH + 2;
        }
        return h + blockGap;
      };

      const calcItemHeight = (it: ItemAgrupado, num: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemTitleSize);
        const titulo = `${num}. ${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
        let h = doc.splitTextToSize(titulo, contentWidth).length * titleH + 1.5;

        if (it.conteudo_publico) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(publicSize);
          h += doc.splitTextToSize(it.conteudo_publico, contentWidth - 4).length * lineH;
        }

        if (it.descricao) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(internalSize);
          h += doc.splitTextToSize(it.descricao, contentWidth - 4).length * lineH;
        }

        for (const cantico of it.canticos) {
          doc.setFont('helvetica', 'bold');
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

      const totalHeight = blocos.reduce((acc, bloco) => acc + bloco.altura, 0);

      if (totalHeight > availableHeight) {
        return null;
      }

      drawHeader();
      let y = topY;
      const x = marginX;

      blocos.forEach((bloco) => {
        if (bloco.kind === 'pastoral') {
          renderPastoral(x, y);
          y += bloco.altura;
          return;
        }

        renderItem(bloco.item, bloco.numero, x, y);
        y += bloco.altura;
      });

      return doc;
    };

    const minScale = 0.52;
    const maxScale = 1.18;
    let bestScale = minScale;
    let bestDoc = renderPdf(minScale);

    if (bestDoc) {
      let low = minScale;
      let high = maxScale;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const mid = (low + high) / 2;
        const candidate = renderPdf(mid);

        if (candidate) {
          bestScale = mid;
          bestDoc = candidate;
          low = mid;
        } else {
          high = mid;
        }
      }
    }

    const doc = bestDoc || renderPdf(bestScale);

    if (!doc) {
      alert('Nao foi possivel montar o PDF em uma unica pagina. Revise a quantidade de texto desta liturgia.');
      return;
    }

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  const deletarCulto = async (culto: Culto) => {
    const igrejaId = getStoredChurchId();
    const cultoId = culto['Culto nr.'];

    if (!igrejaId) {
      alert('Selecione uma igreja antes de excluir a liturgia.');
      return;
    }

    const confirmar = window.confirm(
      `Excluir a liturgia de ${formatCultoDateLabel(culto.Dia)}? Esta ação remove a liturgia e todas as seções do boletim.`
    );

    if (!confirmar) return;

    setCultoExcluindoId(cultoId);

    try {
      const { data: secoesRaw, error: secoesError } = await supabase
        .from('boletim_secoes')
        .select('id')
        .eq('culto_id', cultoId)
        .eq('igreja_id', igrejaId);

      if (secoesError) throw secoesError;

      const secaoIds = (secoesRaw || [])
        .map((item) => item.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      if (secaoIds.length > 0) {
        const { error: deleteItensError } = await supabase
          .from('boletim_itens')
          .delete()
          .in('secao_id', secaoIds);

        if (deleteItensError) throw deleteItensError;
      }

      const { error: deleteSecoesError } = await supabase
        .from('boletim_secoes')
        .delete()
        .eq('culto_id', cultoId)
        .eq('igreja_id', igrejaId);

      if (deleteSecoesError) throw deleteSecoesError;

      const { error: deleteLouvorItensError } = await supabase
        .from('louvor_itens')
        .delete()
        .eq('culto_id', cultoId);

      if (deleteLouvorItensError) throw deleteLouvorItensError;

      const { error: deleteCultoError } = await supabase
        .from('Louvores IPPN')
        .delete()
        .eq('"Culto nr."', cultoId)
        .eq('igreja_id', igrejaId);

      if (deleteCultoError) throw deleteCultoError;

      setCultos((atuais) => atuais.filter((item) => item['Culto nr.'] !== cultoId));
    } catch (error: any) {
      alert(`Erro ao excluir liturgia: ${error?.message || 'falha inesperada.'}`);
    } finally {
      setCultoExcluindoId(null);
    }
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
      key={editando === 'novo' ? `novo-${novoDiaInicial || 'sem-data'}` : `culto-${editando['Culto nr.']}`}
      culto={editando === 'novo' ? null : editando}
      diaInicial={editando === 'novo' ? novoDiaInicial : editando.Dia}
      todosCultos={cultos}
      onAbrirCulto={(culto: Culto) => setEditando(culto)}
      canticos={canticos}
      setCanticos={setCanticos}
      configuracaoIgreja={configuracaoIgreja}
      podeEditarLiturgiaCompleta={permissoes.podeEditarLiturgiaCompleta}
      podeEditarLouvor={permissoes.podeEditarLouvor}
      onSalvo={() => { setEditando(null); setNovoDiaInicial(''); carregarTudo(); }}
      onCancelar={() => { setEditando(null); setNovoDiaInicial(''); }}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Liturgias</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              A interface já organiza os cultos por domingo/data. Assim fica mais natural trabalhar um boletim do domingo com uma ou várias liturgias dentro dele.
            </p>
          </div>
          {isLideranca && (
            <button
              onClick={() => { setNovoDiaInicial(''); setEditando('novo'); }}
              className="bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold text-base hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm"
            >
              + Nova
            </button>
          )}
        </div>

        <div className="space-y-6">
          {cultos.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500">
              Nenhuma liturgia encontrada para a igreja selecionada.
            </div>
          )}
          {gruposCultos.map((grupo) => (
            <section
              key={grupo.dia}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              {(() => {
                const boletimReferencia = getCultoBoletimReferencia(grupo.cultos);

                return (
                  <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                    {grupo.isDomingo ? 'Boletim do domingo' : 'Grupo do dia'}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    {formatCultoDateLabel(grupo.dia)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {grupo.cultos.length === 1
                      ? '1 liturgia cadastrada neste dia.'
                      : `${grupo.cultos.length} liturgias cadastradas neste dia.`}
                  </p>
                </div>

                {isLideranca && (
                  <button
                    onClick={() => { setNovoDiaInicial(grupo.dia); setEditando('novo'); }}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    + Nova liturgia neste dia
                  </button>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <div className="overflow-hidden rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] shadow-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setBoletimDiaEditando((atual) =>
                        atual?.dia === grupo.dia ? null : { dia: grupo.dia, cultos: grupo.cultos }
                      )
                    }
                    className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-emerald-50/80"
                  >
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
                        Boletim compartilhado do dia
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Clique para abrir e editar a palavra pastoral, a imagem do tema, os avisos, a agenda, os pedidos de oração, os informativos e outros blocos deste domingo.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                          {boletimReferencia?.palavra_pastoral?.trim() ? 'Palavra pastoral preenchida' : 'Palavra pastoral vazia'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                          {boletimReferencia?.imagem_url ? 'Imagem definida' : 'Sem imagem do tema'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 shadow-sm">
                          {boletimDiaEditando?.dia === grupo.dia ? 'Editor aberto abaixo' : 'Editor fechado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className="hidden rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white lg:inline-flex">
                        {boletimDiaEditando?.dia === grupo.dia ? 'Fechar boletim' : 'Abrir boletim'}
                      </span>
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-emerald-700 shadow-sm transition-transform ${
                          boletimDiaEditando?.dia === grupo.dia ? 'rotate-180' : ''
                        }`}
                      >
                        ⌄
                      </span>
                    </div>
                  </button>

                  {boletimDiaEditando?.dia === grupo.dia ? (
                    <div className="border-t border-emerald-200 bg-white/90 p-4">
                      <EditorBoletimDoDiaModal
                        aberto
                        inline
                        dia={grupo.dia}
                        cultos={grupo.cultos}
                        onFechar={() => setBoletimDiaEditando(null)}
                        onSalvo={() => {
                          setBoletimDiaEditando(null);
                          carregarTudo();
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/65 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                        Liturgias do dia
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Cada card abaixo representa uma liturgia especifica dentro deste mesmo domingo.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {grupo.cultos.map((culto, index) => (
                      <CultoCard
                        key={culto['Culto nr.']}
                        culto={culto}
                        tituloExibicao={
                          grupo.cultos.length > 1 ? `Liturgia ${index + 1}` : 'Liturgia única'
                        }
                        descricaoExibicao={
                          grupo.cultos.length > 1
                            ? 'Uma das liturgias deste mesmo domingo.'
                            : 'Liturgia deste domingo.'
                        }
                        esconderResumoBoletim
                        podeEditar={permissoes.podeEditarLouvor}
                        podeExcluir={isLideranca}
                        excluindo={cultoExcluindoId === culto['Culto nr.']}
                        onEditar={(item: Culto) => setEditando(item)}
                        onWhatsApp={shareWhatsApp}
                        onPDF={sharePDF}
                        onExcluir={deletarCulto}
                      />
                    ))}
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
