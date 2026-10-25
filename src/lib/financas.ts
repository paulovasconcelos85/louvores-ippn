// Tipos e regras do módulo Finanças, usados no navegador e no servidor.
// Valores trafegam em reais (número com 2 casas), mas toda soma é feita em
// centavos inteiros para não acumular erro de ponto flutuante.

export type TipoLancamento = 'receita' | 'despesa' | 'transferencia';
export type TipoCategoria = 'receita' | 'despesa';
export type PapelEquipe = 'tesoureiro' | 'auxiliar' | 'comissao';

export type GrupoIpb =
  | 'dizimos_ofertas'
  | 'especificas_outras'
  | 'patrimonio'
  | 'causas_locais'
  | 'evangelismo'
  | 'missoes'
  | 'sustento_pastoral'
  | 'verba_presbiterial'
  | 'dizimo_sc';

// Seção IV do relatório estatístico da IPB (manual da Comissão de Sistemas e Métodos).
export const GRUPOS_IPB: Record<GrupoIpb, { tipo: TipoCategoria; nome: string; explicacao: string }> = {
  dizimos_ofertas: {
    tipo: 'receita',
    nome: 'Dízimos e ofertas',
    explicacao: 'Dízimos de salários e renda contínua e ofertas avulsas, sem destinação específica. É a base do dízimo ao Supremo Concílio.',
  },
  especificas_outras: {
    tipo: 'receita',
    nome: 'Ofertas específicas e outras receitas',
    explicacao: 'Ofertas com destino definido (construção, missões, ação social, campanhas) e outras receitas, como rendimentos e reembolsos. Não entram no dízimo ao SC.',
  },
  patrimonio: {
    tipo: 'despesa',
    nome: 'Patrimônio',
    explicacao: 'Construção, aquisição de imóveis, instrumentos musicais, equipamentos de som e informática e outros bens.',
  },
  causas_locais: {
    tipo: 'despesa',
    nome: 'Causas locais',
    explicacao: 'Funcionários, manutenção, água, luz, aluguel, expediente, impostos, previdência, seguros, sociedades internas e eventos.',
  },
  evangelismo: {
    tipo: 'despesa',
    nome: 'Evangelismo local',
    explicacao: 'Divulgação, folhetos, pregadores, transporte e mídia com fins evangelísticos na igreja local.',
  },
  missoes: {
    tipo: 'despesa',
    nome: 'Missões',
    explicacao: 'Ofertas, materiais, viagens e apoio a missionários e agências, nacionais ou transculturais.',
  },
  sustento_pastoral: {
    tipo: 'despesa',
    nome: 'Sustento pastoral',
    explicacao: 'Côngruas e FAP (Fundo de Amparo Pastoral, 8% sobre a côngrua).',
  },
  verba_presbiterial: {
    tipo: 'despesa',
    nome: 'Verba presbiterial',
    explicacao: 'Repasse ao Presbitério, conforme a determinação de cada concílio.',
  },
  dizimo_sc: {
    tipo: 'despesa',
    nome: 'Dízimo ao Supremo Concílio',
    explicacao: '10% dos dízimos e ofertas, sem contar as ofertas específicas.',
  },
};

export const GRUPOS_RECEITA: GrupoIpb[] = ['dizimos_ofertas', 'especificas_outras'];
export const GRUPOS_DESPESA: GrupoIpb[] = [
  'patrimonio',
  'causas_locais',
  'evangelismo',
  'missoes',
  'sustento_pastoral',
  'verba_presbiterial',
  'dizimo_sc',
];

// Plano inicial de toda igreja; o tesoureiro renomeia, desativa ou cria outras.
export const CATEGORIAS_PADRAO: Array<{ nome: string; tipo: TipoCategoria; grupo: GrupoIpb; nominal?: boolean }> = [
  { nome: 'Dízimos', tipo: 'receita', grupo: 'dizimos_ofertas', nominal: true },
  { nome: 'Ofertas dos cultos', tipo: 'receita', grupo: 'dizimos_ofertas' },
  { nome: 'Ofertas missionárias', tipo: 'receita', grupo: 'especificas_outras' },
  { nome: 'Ofertas para construção e reforma', tipo: 'receita', grupo: 'especificas_outras' },
  { nome: 'Ofertas para ação social', tipo: 'receita', grupo: 'especificas_outras' },
  { nome: 'Rendimentos de aplicação', tipo: 'receita', grupo: 'especificas_outras' },
  { nome: 'Outras receitas', tipo: 'receita', grupo: 'especificas_outras' },
  { nome: 'Côngruas', tipo: 'despesa', grupo: 'sustento_pastoral' },
  { nome: 'FAP — Fundo de Amparo Pastoral', tipo: 'despesa', grupo: 'sustento_pastoral' },
  { nome: 'Salários e encargos de funcionários', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Previdência, planos de saúde e seguros', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Água, luz e telefone/internet', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Aluguel', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Manutenção e limpeza', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Material de expediente e consumo', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Ação social', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Sociedades internas e eventos', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Impostos e taxas', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Outras despesas locais', tipo: 'despesa', grupo: 'causas_locais' },
  { nome: 'Evangelismo local', tipo: 'despesa', grupo: 'evangelismo' },
  { nome: 'Missões', tipo: 'despesa', grupo: 'missoes' },
  { nome: 'Construção e reformas', tipo: 'despesa', grupo: 'patrimonio' },
  { nome: 'Equipamentos e instrumentos', tipo: 'despesa', grupo: 'patrimonio' },
  { nome: 'Verba presbiterial', tipo: 'despesa', grupo: 'verba_presbiterial' },
  { nome: 'Dízimo ao Supremo Concílio', tipo: 'despesa', grupo: 'dizimo_sc' },
];

export const FORMAS_PAGAMENTO = [
  { valor: 'dinheiro', nome: 'Dinheiro' },
  { valor: 'pix', nome: 'PIX' },
  { valor: 'transferencia', nome: 'Transferência / TED' },
  { valor: 'cartao', nome: 'Cartão' },
  { valor: 'cheque', nome: 'Cheque' },
  { valor: 'boleto', nome: 'Boleto' },
  { valor: 'outro', nome: 'Outro' },
] as const;

export const TIPOS_DOCUMENTO = [
  { valor: 'nota_fiscal', nome: 'Nota fiscal' },
  { valor: 'recibo', nome: 'Recibo' },
  { valor: 'rpa', nome: 'RPA (autônomo)' },
  { valor: 'comprovante', nome: 'Comprovante bancário' },
  { valor: 'outro', nome: 'Outro' },
] as const;

export const PAPEIS_EQUIPE: Record<PapelEquipe, { nome: string; explicacao: string }> = {
  tesoureiro: { nome: 'Tesoureiro', explicacao: 'Eleito pelo Conselho. Lança, envia os balancetes e vê os nomes de quem dizima.' },
  auxiliar: { nome: 'Auxiliar de tesouraria', explicacao: 'Ajuda nos lançamentos, com o mesmo acesso do tesoureiro.' },
  comissao: { nome: 'Comissão de Exame de Contas', explicacao: 'Examina balancetes e comprovantes e emite parecer. Não vê nomes de quem dizima.' },
};

export interface FinConta {
  id: string;
  nome: string;
  tipo: 'caixa' | 'banco' | 'aplicacao';
  banco: string | null;
  agencia: string | null;
  numero: string | null;
  saldo_inicial: number;
  data_saldo_inicial: string;
  ativo: boolean;
  ordem: number;
}

export interface FinCategoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  grupo: GrupoIpb;
  nominal: boolean;
  ativo: boolean;
  ordem: number;
}

export interface FinLancamento {
  id: string;
  tipo: TipoLancamento;
  data: string;
  valor: number;
  conta_id: string;
  conta_destino_id: string | null;
  categoria_id: string | null;
  pessoa_id: string | null;
  pessoa_nome: string | null;
  descricao: string | null;
  forma_pagamento: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  comprovante_path: string | null;
  travado: boolean;
}

export interface FinPermissoes {
  podeVer: boolean;
  podeLancar: boolean;
  podeVerNomes: boolean;
  podeConfigurar: boolean;
  podeDesignarEquipe: boolean;
  podeExaminar: boolean;
  podeAprovar: boolean;
  papeis: PapelEquipe[];
}

export function centavos(valor: number | string | null | undefined) {
  const numero = typeof valor === 'string' ? Number(valor) : valor ?? 0;
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

export function reais(valorCentavos: number) {
  return valorCentavos / 100;
}

/** Converte o que a pessoa digita ("1.234,56", "1234.56", "R$ 50") em centavos. */
export function lerValorDigitado(texto: string) {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  if (!limpo) return 0;
  const decimalComVirgula = limpo.lastIndexOf(',') > limpo.lastIndexOf('.');
  const normalizado = decimalComVirgula ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, '');
  return centavos(Number(normalizado));
}

export function moedaDoPais(pais?: string | null) {
  switch ((pais || 'BR').toUpperCase()) {
    case 'PT':
    case 'ES':
      return { moeda: 'EUR', locale: 'pt-PT' };
    case 'US':
      return { moeda: 'USD', locale: 'en-US' };
    case 'CA':
      return { moeda: 'CAD', locale: 'en-CA' };
    case 'AO':
      return { moeda: 'AOA', locale: 'pt-AO' };
    case 'MZ':
      return { moeda: 'MZN', locale: 'pt-MZ' };
    case 'AR':
      return { moeda: 'ARS', locale: 'es-AR' };
    case 'MX':
      return { moeda: 'MXN', locale: 'es-MX' };
    default:
      return { moeda: 'BRL', locale: 'pt-BR' };
  }
}

export function criarFormatadorMoeda(pais?: string | null) {
  const { moeda, locale } = moedaDoPais(pais);
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: moeda });
  return (valorCentavos: number) => fmt.format(valorCentavos / 100);
}

/** Trimestre (1-4) de uma data ISO. */
export function trimestreDe(data: string) {
  return Math.floor((Number(data.slice(5, 7)) - 1) / 3) + 1;
}

export function intervaloDoPeriodo(ano: number, periodo: number) {
  if (periodo === 0) return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  const mesInicio = (periodo - 1) * 3 + 1;
  const mesFim = mesInicio + 2;
  const ultimoDia = new Date(Date.UTC(ano, mesFim, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { inicio: `${ano}-${pad(mesInicio)}-01`, fim: `${ano}-${pad(mesFim)}-${pad(ultimoDia)}` };
}

export function nomeDoPeriodo(periodo: number) {
  return periodo === 0 ? 'Exercício completo' : `${periodo}º trimestre`;
}
