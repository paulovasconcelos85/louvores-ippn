// Leitura em frases da análise do repertório (/api/dashboard/repertorio).
// Usada na aba Repertório das estatísticas, no relatório em PDF e no resumo da tela admin.

import type { Locale } from '@/i18n/config';
import { ROTULO_CURTO_TEMA, ROTULO_TEMA, type TemaId } from '@/lib/repertorio-analise';

type MusicaVezes = { nome: string; vezes: number };

export type LeituraCulto = {
  culto: { numero: number; data: string };
  anterior: { numero: number; data: string } | null;
  cultosSemMusica: string[];
  musicas: Array<{
    nome: string;
    tipo: 'hino' | 'cantico';
    temas: TemaId[];
    semLetra: boolean;
    estreia: boolean;
    voltouApos: number | null;
  }>;
  mudancas: Array<{ tema: TemaId; antes: number; depois: number }>;
  lacunasAtendidas: TemaId[];
};

export type AnaliseRepertorio = {
  periodo: { id: string; inicio: string; fim: string };
  anosDisponiveis: number[];
  leitura: LeituraCulto | null;
  resumo: {
    cultos: number;
    execucoes: number;
    musicasDistintas: number;
    percentualHinos: number;
    coberturaLetras: number;
    execucoesAnalisadas: number;
  };
  temas: Array<{ id: TemaId; execucoes: number; percentual: number; exemplos: string[] }>;
  trindade: { pai: number; filho: number; espirito: number };
  voz: { individual: number; comunitaria: number; equilibrada: number };
  direcao: { aDeus: number; sobreDeus: number; misto: number };
  rodizio: { top10: number; nucleo: number; cantadasUmaVez: number; maisCantadas: MusicaVezes[] };
  novas: Array<MusicaVezes & { primeiraData: string }>;
  totalNovas: number;
  esquecidas: Array<MusicaVezes & { ultimaData: string }>;
  semLetra: MusicaVezes[];
  sugestoes: Array<{ tema: TemaId; percentual: number; hinos: Array<{ nome: string; assunto: string | null }> }>;
};

export const TEMA_POUCO_CANTADO = 0.12;
export const AMOSTRA_MINIMA = 20;
const PROPORCAO_PREDOMINANTE = 1.5;

export type ContextoTexto = {
  locale: Locale;
  pct: Intl.NumberFormat;
  formatarDataCurta: (data: string) => string;
};

export type Frase = { texto: string; alerta?: boolean };

export function criarContextoTexto(locale: Locale, intlLocale: string): ContextoTexto {
  const formatadorData = new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short' });
  return {
    locale,
    pct: new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }),
    formatarDataCurta: (data) => formatadorData.format(new Date(`${data}T00:00:00`)).replace('.', ''),
  };
}

export function traduzir(locale: Locale, pt: string, es: string, en: string) {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

export function nomeTema(id: TemaId, locale: Locale) {
  return ROTULO_TEMA[id][locale] || ROTULO_TEMA[id].pt;
}

// "a, b e c" / "a, b y c" / "a, b and c"
function juntar(itens: string[], locale: Locale) {
  if (itens.length <= 1) return itens.join('');
  const e = traduzir(locale, 'e', 'y', 'and');
  return `${itens.slice(0, -1).join(', ')} ${e} ${itens[itens.length - 1]}`;
}

function nomeCurtoTema(id: TemaId, locale: Locale) {
  return ROTULO_CURTO_TEMA[id][locale] || ROTULO_CURTO_TEMA[id].pt;
}

function temasEmTexto(ids: TemaId[], locale: Locale) {
  return juntar(
    ids.map((id) => nomeCurtoTema(id, locale)),
    locale
  );
}

export function temasPoucoCantados(analise: AnaliseRepertorio) {
  return analise.temas.filter((tema) => tema.percentual < TEMA_POUCO_CANTADO);
}

// O perfil completo, uma ideia por frase.
export function montarPerfil(analise: AnaliseRepertorio, ctx: ContextoTexto): Frase[] {
  const { locale, pct } = ctx;
  const tr = (pt: string, es: string, en: string) => traduzir(locale, pt, es, en);
  if (analise.resumo.execucoesAnalisadas === 0) return [];

  const frases: Frase[] = [];
  const [primeiro, segundo, terceiro] = analise.temas;

  if (analise.resumo.execucoesAnalisadas < AMOSTRA_MINIMA) {
    frases.push({
      alerta: true,
      texto: tr(
        `Amostra pequena: só ${analise.resumo.execucoesAnalisadas} músicas analisadas neste período. Leia como um primeiro indício.`,
        `Muestra pequeña: solo ${analise.resumo.execucoesAnalisadas} canciones analizadas en este período. Léelo como un primer indicio.`,
        `Small sample: only ${analise.resumo.execucoesAnalisadas} songs analyzed in this period. Read it as an early hint.`
      ),
    });
  }

  const outros = temasEmTexto([segundo.id, terceiro.id], locale);
  frases.push({
    texto: tr(
      `O repertório gira em torno de ${nomeCurtoTema(primeiro.id, locale)} (${pct.format(primeiro.percentual)} das músicas), seguido por ${outros}.`,
      `El repertorio gira en torno a ${nomeCurtoTema(primeiro.id, locale)} (${pct.format(primeiro.percentual)} de las canciones), seguido por ${outros}.`,
      `The repertoire centers on ${nomeCurtoTema(primeiro.id, locale)} (${pct.format(primeiro.percentual)} of songs), followed by ${outros}.`
    ),
  });

  const poucos = temasPoucoCantados(analise);
  if (poucos.length > 0) {
    const lista = temasEmTexto(poucos.map((tema) => tema.id), locale);
    frases.push({
      alerta: true,
      texto: tr(
        `Pouco espaço para ${lista}.`,
        `Poco espacio para ${lista}.`,
        `Little room for ${lista}.`
      ),
    });
  }

  const { individual, comunitaria } = analise.voz;
  if (individual > comunitaria * PROPORCAO_PREDOMINANTE) {
    frases.push({
      texto: tr(
        `A fé cantada é sobretudo pessoal: ${pct.format(individual)} das letras falam em "eu", ${pct.format(comunitaria)} em "nós".`,
        `La fe cantada es sobre todo personal: ${pct.format(individual)} de las letras hablan en "yo", ${pct.format(comunitaria)} en "nosotros".`,
        `The faith being sung is mostly personal: ${pct.format(individual)} of lyrics speak as "I", ${pct.format(comunitaria)} as "we".`
      ),
    });
  } else if (comunitaria > individual * PROPORCAO_PREDOMINANTE) {
    frases.push({
      texto: tr(
        `A igreja canta como comunidade: ${pct.format(comunitaria)} das letras falam em "nós", ${pct.format(individual)} em "eu".`,
        `La iglesia canta como comunidad: ${pct.format(comunitaria)} de las letras hablan en "nosotros", ${pct.format(individual)} en "yo".`,
        `The church sings as a community: ${pct.format(comunitaria)} of lyrics speak as "we", ${pct.format(individual)} as "I".`
      ),
    });
  } else {
    frases.push({
      texto: tr(
        'As letras equilibram a voz pessoal ("eu") e a comunitária ("nós").',
        'Las letras equilibran la voz personal ("yo") y la comunitaria ("nosotros").',
        'Lyrics balance the personal voice ("I") and the communal one ("we").'
      ),
    });
  }

  if (analise.direcao.aDeus > analise.direcao.sobreDeus * PROPORCAO_PREDOMINANTE) {
    frases.push({
      texto: tr(
        `A maior parte é oração cantada, dirigida a Deus (${pct.format(analise.direcao.aDeus)}); menos letras proclamam sobre Ele.`,
        `La mayor parte es oración cantada, dirigida a Dios (${pct.format(analise.direcao.aDeus)}); menos letras proclaman sobre Él.`,
        `Most songs are sung prayer addressed to God (${pct.format(analise.direcao.aDeus)}); fewer proclaim about Him.`
      ),
    });
  } else if (analise.direcao.sobreDeus > analise.direcao.aDeus * PROPORCAO_PREDOMINANTE) {
    frases.push({
      texto: tr(
        `Predomina a proclamação sobre Deus (${pct.format(analise.direcao.sobreDeus)} das letras).`,
        `Predomina la proclamación sobre Dios (${pct.format(analise.direcao.sobreDeus)} de las letras).`,
        `Proclamation about God dominates (${pct.format(analise.direcao.sobreDeus)} of lyrics).`
      ),
    });
  }

  if (analise.trindade.espirito < 0.1) {
    frases.push({
      alerta: true,
      texto: tr(
        `O Espírito Santo aparece em apenas ${pct.format(analise.trindade.espirito)} das letras; Cristo, em ${pct.format(analise.trindade.filho)}.`,
        `El Espíritu Santo aparece en solo ${pct.format(analise.trindade.espirito)} de las letras; Cristo, en ${pct.format(analise.trindade.filho)}.`,
        `The Holy Spirit appears in only ${pct.format(analise.trindade.espirito)} of lyrics; Christ, in ${pct.format(analise.trindade.filho)}.`
      ),
    });
  }

  if (analise.resumo.execucoes > 0) {
    frases.push({
      texto: tr(
        `${analise.rodizio.nucleo} músicas somam metade de tudo que foi cantado; hinos tradicionais são ${pct.format(analise.resumo.percentualHinos)} do repertório.`,
        `${analise.rodizio.nucleo} canciones suman la mitad de todo lo cantado; los himnos tradicionales son ${pct.format(analise.resumo.percentualHinos)} del repertorio.`,
        `${analise.rodizio.nucleo} songs make up half of everything sung; traditional hymns are ${pct.format(analise.resumo.percentualHinos)} of the repertoire.`
      ),
    });
  }

  return frases;
}

// O resumo do resumo, para a tela admin: uma frase de perfil e uma de atenção.
export function montarResumoCurto(analise: AnaliseRepertorio, ctx: ContextoTexto) {
  const { locale } = ctx;
  const tr = (pt: string, es: string, en: string) => traduzir(locale, pt, es, en);
  if (analise.resumo.execucoesAnalisadas === 0) return null;

  const principais = temasEmTexto(analise.temas.slice(0, 3).map((tema) => tema.id), locale);
  const { individual, comunitaria } = analise.voz;
  const voz =
    individual > comunitaria * PROPORCAO_PREDOMINANTE
      ? tr(', com fé mais pessoal do que comunitária', ', con una fe más personal que comunitaria', ', with a faith more personal than communal')
      : comunitaria > individual * PROPORCAO_PREDOMINANTE
        ? tr(', cantando como comunidade', ', cantando como comunidad', ', singing as a community')
        : tr(', equilibrando o "eu" e o "nós"', ', equilibrando el "yo" y el "nosotros"', ', balancing "I" and "we"');

  const poucos = temasPoucoCantados(analise).slice(-3).map((tema) => tema.id);

  return {
    perfil: tr(
      `Uma igreja que canta sobretudo ${principais}${voz}.`,
      `Una iglesia que canta sobre todo ${principais}${voz}.`,
      `A church that mostly sings ${principais}${voz}.`
    ),
    atencao:
      poucos.length > 0
        ? tr(
            `Pouco espaço para ${temasEmTexto(poucos, locale)}.`,
            `Poco espacio para ${temasEmTexto(poucos, locale)}.`,
            `Little room for ${temasEmTexto(poucos, locale)}.`
          )
        : null,
    amostraPequena: analise.resumo.execucoesAnalisadas < AMOSTRA_MINIMA,
  };
}

// Frases da leitura do último culto com músicas.
export function montarFrasesLeitura(leitura: LeituraCulto, ctx: ContextoTexto): Frase[] {
  const { locale, formatarDataCurta } = ctx;
  const tr = (pt: string, es: string, en: string) => traduzir(locale, pt, es, en);
  const estreias = leitura.musicas.filter((musica) => musica.estreia).length;
  const retornos = leitura.musicas.filter((musica) => musica.voltouApos).length;

  const partes = [
    tr(`${leitura.musicas.length} músicas`, `${leitura.musicas.length} canciones`, `${leitura.musicas.length} songs`),
  ];
  if (estreias) {
    partes.push(
      tr(
        `${estreias} cantada${estreias > 1 ? 's' : ''} pela primeira vez`,
        `${estreias} cantada${estreias > 1 ? 's' : ''} por primera vez`,
        `${estreias} sung for the first time`
      )
    );
  }
  if (retornos) {
    partes.push(tr(`${retornos} de volta depois de meses`, `${retornos} de vuelta tras meses`, `${retornos} back after months`));
  }
  const frases: Frase[] = [{ texto: `${juntar(partes, locale)}.` }];

  if (leitura.lacunasAtendidas.length > 0) {
    const lista = temasEmTexto(leitura.lacunasAtendidas, locale);
    frases.push({
      texto: tr(
        `Trouxe temas que andavam pouco cantados: ${lista}.`,
        `Trajo temas poco cantados: ${lista}.`,
        `Brought in rarely sung themes: ${lista}.`
      ),
    });
  }

  if (leitura.anterior && leitura.mudancas.length === 0) {
    frases.push({
      texto: tr(
        'O perfil dos últimos 12 meses se manteve estável.',
        'El perfil de los últimos 12 meses se mantuvo estable.',
        'The 12-month profile held steady.'
      ),
    });
  }

  const pendentes = leitura.cultosSemMusica;
  if (pendentes.length === 1) {
    frases.push({
      alerta: true,
      texto: tr(
        `O culto de ${formatarDataCurta(pendentes[0])} ainda está sem músicas.`,
        `El culto del ${formatarDataCurta(pendentes[0])} aún no tiene canciones.`,
        `The ${formatarDataCurta(pendentes[0])} service has no songs yet.`
      ),
    });
  } else if (pendentes.length > 1) {
    const de = formatarDataCurta(pendentes[0]);
    const ate = formatarDataCurta(pendentes[pendentes.length - 1]);
    frases.push({
      alerta: true,
      texto: tr(
        `${pendentes.length} cultos posteriores (de ${de} a ${ate}) ainda estão sem músicas.`,
        `${pendentes.length} cultos posteriores (del ${de} al ${ate}) aún no tienen canciones.`,
        `${pendentes.length} later services (${de} to ${ate}) have no songs yet.`
      ),
    });
  }

  return frases;
}

export function rotuloPeriodo(periodoId: string, locale: Locale) {
  const tr = (pt: string, es: string, en: string) => traduzir(locale, pt, es, en);
  if (periodoId === '90d') return tr('Últimos 3 meses', 'Últimos 3 meses', 'Last 3 months');
  if (periodoId === '180d') return tr('Últimos 6 meses', 'Últimos 6 meses', 'Last 6 months');
  if (periodoId === '365d') return tr('Últimos 12 meses', 'Últimos 12 meses', 'Last 12 months');
  if (periodoId === 'tudo') return tr('Todo o histórico', 'Todo el historial', 'All time');
  return periodoId.replace('ano-', '');
}
