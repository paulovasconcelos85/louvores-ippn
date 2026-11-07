import type { Locale } from '@/i18n/config';

// Cliente da API do YouVersion Platform (https://developers.youversion.com).
// Só para o servidor: a App Key (YOUVERSION_APP_KEY) não tem prefixo
// NEXT_PUBLIC_ e nunca vai para o navegador.

const API_BASE = 'https://api.youversion.com/v1';

// Versão padrão por idioma do boletim (licença Biblica aceita no portal):
// NVI 2023 (pt), NVI 2025 (es), NIV 2011 (en).
export const BIBLIA_POR_LOCALE: Record<Locale, number> = {
  pt: 129,
  es: 128,
  en: 111,
};

// O texto bíblico muda raramente; o cache do Next evita repetir chamadas.
const CACHE_SEGUNDOS = 60 * 60 * 24 * 7;

export interface SegmentoBiblico {
  versiculo: number | null;
  texto: string;
}

export interface BlocoBiblico {
  // Estilo USFM do parágrafo: p (prosa), q1/q2 (poesia), d (título de salmo)...
  estilo: string;
  segmentos: SegmentoBiblico[];
}

export interface PassagemBiblica {
  id: string;
  referencia: string;
  blocos: BlocoBiblico[];
}

export interface VersaoBiblica {
  id: number;
  abreviacao: string;
  titulo: string;
  copyright: string | null;
}

export class YouVersionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function chamarApi<T>(caminho: string): Promise<T> {
  const appKey = process.env.YOUVERSION_APP_KEY;
  if (!appKey) throw new YouVersionError(500, 'YOUVERSION_APP_KEY não configurada.');

  const response = await fetch(`${API_BASE}${caminho}`, {
    headers: { 'X-YVP-App-Key': appKey },
    next: { revalidate: CACHE_SEGUNDOS },
  });

  if (!response.ok) {
    throw new YouVersionError(response.status, `YouVersion ${response.status} em ${caminho}`);
  }

  return response.json() as Promise<T>;
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodificarEntidades(valor: string) {
  return valor.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (original, entidade: string) => {
    const nome = entidade.toLowerCase();
    if (nome[0] === '#') {
      const hex = nome[1] === 'x';
      const codigo = Number.parseInt(nome.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : original;
    }
    return ENTIDADES[nome] ?? original;
  });
}

// Converte o HTML da API em blocos de texto puro. O boletim desenha o texto no
// próprio estilo, sem injetar HTML de terceiros na página.
function converterHtml(html: string): BlocoBiblico[] {
  const blocos: BlocoBiblico[] = [];
  const MARCA = '\u0000';

  for (const [, estilo, interno] of html.matchAll(/<div class="([\w-]+)">([\s\S]*?)<\/div>/g)) {
    const marcado = interno
      .replace(/<span class="yv-vlbl">[\s\S]*?<\/span>/g, '')
      .replace(/<span class="yv-v" v="(\d+)"><\/span>/g, `${MARCA}$1${MARCA}`)
      .replace(/<[^>]+>/g, '');

    const partes = decodificarEntidades(marcado).split(MARCA);
    const segmentos: SegmentoBiblico[] = [];

    // partes alterna: [texto antes, número, texto, número, texto...]
    if (partes[0].trim()) segmentos.push({ versiculo: null, texto: partes[0] });
    for (let i = 1; i < partes.length; i += 2) {
      segmentos.push({ versiculo: Number(partes[i]), texto: partes[i + 1] ?? '' });
    }

    if (segmentos.length > 0) blocos.push({ estilo, segmentos });
  }

  return blocos;
}

export async function buscarPassagem(bibliaId: number, passagemId: string): Promise<PassagemBiblica> {
  const dados = await chamarApi<{ id: string; content: string; reference: string }>(
    `/bibles/${bibliaId}/passages/${encodeURIComponent(passagemId)}?format=html`
  );

  return { id: dados.id, referencia: dados.reference, blocos: converterHtml(dados.content) };
}

// Dia do ano (1–366) -> passagem do versículo do dia ("PHP.4.8").
export async function buscarVersiculoDoDia(dia: number): Promise<string> {
  const dados = await chamarApi<{ day: number; passage_id: string }>(`/verse_of_the_days/${dia}`);
  return dados.passage_id;
}

export async function buscarVersao(bibliaId: number): Promise<VersaoBiblica> {
  const dados = await chamarApi<{
    id: number;
    abbreviation: string;
    localized_abbreviation?: string | null;
    localized_title?: string | null;
    title: string;
    copyright: string | null;
  }>(`/bibles/${bibliaId}`);

  return {
    id: dados.id,
    abreviacao: dados.localized_abbreviation || dados.abbreviation,
    titulo: dados.localized_title || dados.title,
    copyright: dados.copyright,
  };
}
