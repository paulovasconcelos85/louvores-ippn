import type { Locale } from '@/i18n/config';
import type { LocalizedTextMapForm } from '@/lib/church-i18n';

export const TIPOS_LITURGICOS_PADRAO = [
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

export const TIPOS_SECOES_BOLETIM = [
  { tipo: 'avisos', titulo: 'Avisos', icone: 'megaphone', emoji: '📢' },
  { tipo: 'oracao', titulo: 'Pedidos de Oração', icone: 'hands.sparkles', emoji: '🙏' },
  { tipo: 'agenda', titulo: 'Agenda', icone: 'calendar', emoji: '📅' },
  { tipo: 'informativo', titulo: 'Informativo', icone: 'info.circle', emoji: 'ℹ️' },
  { tipo: 'outro', titulo: 'Outros', icone: 'list.bullet', emoji: '📝' },
] as const;

export const HABILITAR_BOLETIM_SECOES_NEXT = true;
export const BOLETIM_FALLBACK_TIPO_PREFIX = '__boletim__:';
export const LITURGIA_META_TIPO = '__liturgia__:nome';
// --- TIPOS ---
export interface Cantico {
  id: string | number;
  nome: string;
  tipo?: string;
  numero?: string | null;
  letra?: string | null;
  igreja_id?: string | null;
  ultima_vez?: string | null;
}

export interface CanticoNoItem {
  cantico_id: string | null;
  tom: string | null;
}

export interface LouvorItem {
  id?: string;
  tipo: string;
  ordem: number;
  conteudo_publico: string | null;
  conteudo_publico_i18n: LocalizedTextMapForm;
  descricao: string | null;
  horario: string | null;
  canticos_lista: CanticoNoItem[];
}

export interface BoletimItemRascunho {
  id: string;
  conteudo: string;
  conteudo_i18n: LocalizedTextMapForm;
  destaque: boolean;
  imagem_url?: string | null;
}

export interface AgendaItemRascunho {
  id: string;
  data: string;
  hora: string;
  descricao: string;
  temHora: boolean;
  conteudo_i18n: LocalizedTextMapForm;
}

export interface AvisoItemRascunho {
  id: string;
  titulo: string;
  corpo: string;
  destaque: boolean;
  imagem_url: string;
  conteudo_i18n: LocalizedTextMapForm;
}

export interface InformativoItemRascunho {
  id: string;
  titulo: string;
  corpo: string;
  destaque: boolean;
  imagem_url: string;
  conteudo_i18n: LocalizedTextMapForm;
}

export interface BoletimSecaoRascunho {
  id: string;
  tipo: string;
  titulo: string;
  titulo_i18n: LocalizedTextMapForm;
  icone: string | null;
  visivel: boolean;
  ordem: number;
  itens: BoletimItemRascunho[];
}

export interface NoticiaMensal {
  id: string;
  igreja_id: string;
  titulo: string;
  corpo: string;
  imagem_url: string | null;
  mes_referencia: number;
  ano_referencia: number;
  ordem: number;
  ativo: boolean;
}

export interface ModeloLiturgiaConfig {
  bloco: string;
  ordem: number;
  tipo: string;
  conteudo_publico_padrao: string;
  conteudo_publico_padrao_i18n: LocalizedTextMapForm;
  descricao_interna_padrao: string;
  descricao_interna_padrao_i18n: LocalizedTextMapForm;
  descricao_padrao: string;
  tem_cantico: boolean;
}

export interface LiturgiaChurchConfig {
  tiposLiturgicos: string[];
  modelosLiturgia: ModeloLiturgiaConfig[];
  pastorPadrao: string | null;
  modoRepertorio: string | null;
  permiteCadastroCanticos: boolean;
}

export interface Culto {
  'Culto nr.': number;
  Dia: string;
  imagem_url?: string | null;
  palavra_pastoral?: string | null;
  palavra_pastoral_i18n?: unknown;
  palavra_pastoral_autor?: string | null;
  nome_liturgia?: string | null;
}

export interface LouvorItemRow {
  id: string;
  culto_id: number;
  ordem: number | null;
  tipo: string | null;
  tom: string | null;
  cantico_id: string | null;
  conteudo_publico: string | null;
  conteudo_publico_i18n?: unknown;
  descricao: string | null;
  horario: string | null;
}

export interface LouvorItemRowComCantico extends LouvorItemRow {
  canticos: { nome: string | null } | null;
}

export interface CultoLookupRow {
  'Culto nr.': number;
  Dia: string;
}

export interface BoletimFallbackMeta {
  secaoTitulo: string;
  secaoTituloI18n?: Partial<Record<Locale, string>> | null;
  secaoIcone: string | null;
  secaoVisivel: boolean;
  secaoOrdem: number;
  itemDestaque: boolean;
  itemOrdem: number;
  itemImagemUrl?: string | null;
}

export interface StructuredBoletimSecaoRow {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  titulo_i18n?: unknown;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
}

export interface StructuredBoletimItemRow {
  id: string;
  secao_id: string | null;
  conteudo: string;
  conteudo_i18n?: unknown;
  destaque: boolean | null;
  ordem: number | null;
  imagem_url?: string | null;
}

export type ItemAgrupado = {
  tipo: string;
  horario: string | null;
  conteudo_publico: string | null;
  descricao: string | null;
  canticos: { nome: string; tom: string | null }[];
};

export const MESES_HISTORICO_CANTICOS = 12;
