// Reconhece referências bíblicas escritas livremente na liturgia
// ("Salmo 119.89-112", "2 Coríntios 9:6-8", "Sl. 109.21", "I João 1:9",
// "AP. 5.1-5", "Salmos 46 e 47") e as converte em ids de passagem USFM
// ("PSA.119.89-112") aceitos pela API do YouVersion.

interface LivroBiblico {
  codigo: string;
  capitulos: number;
  // Nomes e abreviações sem número, acento, ponto ou espaço.
  nomes: string[];
  // Livros numerados (1 Samuel, 2 Coríntios...): o número vem antes do nome.
  numero?: number;
}

const LIVROS: LivroBiblico[] = [
  { codigo: 'GEN', capitulos: 50, nomes: ['genesis', 'gn', 'gen'] },
  { codigo: 'EXO', capitulos: 40, nomes: ['exodo', 'ex', 'exo'] },
  { codigo: 'LEV', capitulos: 27, nomes: ['levitico', 'lv', 'lev'] },
  { codigo: 'NUM', capitulos: 36, nomes: ['numeros', 'nm', 'num'] },
  { codigo: 'DEU', capitulos: 34, nomes: ['deuteronomio', 'dt', 'deut'] },
  { codigo: 'JOS', capitulos: 24, nomes: ['josue', 'js', 'jos'] },
  { codigo: 'JDG', capitulos: 21, nomes: ['juizes', 'jz', 'jui'] },
  { codigo: 'RUT', capitulos: 4, nomes: ['rute', 'rt'] },
  { codigo: '1SA', capitulos: 31, numero: 1, nomes: ['samuel', 'sm', 'sam'] },
  { codigo: '2SA', capitulos: 24, numero: 2, nomes: ['samuel', 'sm', 'sam'] },
  { codigo: '1KI', capitulos: 22, numero: 1, nomes: ['reis', 'rs'] },
  { codigo: '2KI', capitulos: 25, numero: 2, nomes: ['reis', 'rs'] },
  { codigo: '1CH', capitulos: 29, numero: 1, nomes: ['cronicas', 'cr', 'cro', 'cron'] },
  { codigo: '2CH', capitulos: 36, numero: 2, nomes: ['cronicas', 'cr', 'cro', 'cron'] },
  { codigo: 'EZR', capitulos: 10, nomes: ['esdras', 'ed', 'esd'] },
  { codigo: 'NEH', capitulos: 13, nomes: ['neemias', 'ne', 'nee', 'neem'] },
  { codigo: 'EST', capitulos: 10, nomes: ['ester', 'et', 'est'] },
  // "Jó" (com acento) é tratado à parte: sem acento colide com "Jo" (João).
  { codigo: 'JOB', capitulos: 42, nomes: ['job'] },
  { codigo: 'PSA', capitulos: 150, nomes: ['salmos', 'salmo', 'sl', 'sal'] },
  { codigo: 'PRO', capitulos: 31, nomes: ['proverbios', 'pv', 'prov'] },
  { codigo: 'ECC', capitulos: 12, nomes: ['eclesiastes', 'ec', 'ecl', 'ecles'] },
  { codigo: 'SNG', capitulos: 8, nomes: ['canticodoscanticos', 'cantares', 'ct', 'cant'] },
  { codigo: 'ISA', capitulos: 66, nomes: ['isaias', 'is', 'isa'] },
  { codigo: 'JER', capitulos: 52, nomes: ['jeremias', 'jr', 'jer'] },
  { codigo: 'LAM', capitulos: 5, nomes: ['lamentacoes', 'lm', 'lam', 'lament'] },
  { codigo: 'EZK', capitulos: 48, nomes: ['ezequiel', 'ez', 'eze', 'ezeq'] },
  { codigo: 'DAN', capitulos: 12, nomes: ['daniel', 'dn', 'dan'] },
  { codigo: 'HOS', capitulos: 14, nomes: ['oseias', 'os', 'ose'] },
  { codigo: 'JOL', capitulos: 3, nomes: ['joel', 'jl'] },
  { codigo: 'AMO', capitulos: 9, nomes: ['amos', 'am'] },
  { codigo: 'OBA', capitulos: 1, nomes: ['obadias', 'ob', 'obd', 'obad'] },
  { codigo: 'JON', capitulos: 4, nomes: ['jonas', 'jn', 'jon'] },
  { codigo: 'MIC', capitulos: 7, nomes: ['miqueias', 'mq', 'miq', 'mic'] },
  { codigo: 'NAM', capitulos: 3, nomes: ['naum', 'na'] },
  { codigo: 'HAB', capitulos: 3, nomes: ['habacuque', 'hc', 'hab'] },
  { codigo: 'ZEP', capitulos: 3, nomes: ['sofonias', 'sf', 'sof'] },
  { codigo: 'HAG', capitulos: 2, nomes: ['ageu', 'ag'] },
  { codigo: 'ZEC', capitulos: 14, nomes: ['zacarias', 'zc', 'zac'] },
  { codigo: 'MAL', capitulos: 4, nomes: ['malaquias', 'ml', 'mal'] },
  { codigo: 'MAT', capitulos: 28, nomes: ['mateus', 'mt', 'mat'] },
  { codigo: 'MRK', capitulos: 16, nomes: ['marcos', 'mc', 'mar'] },
  { codigo: 'LUK', capitulos: 24, nomes: ['lucas', 'lc', 'luc'] },
  { codigo: 'JHN', capitulos: 21, nomes: ['joao', 'jo'] },
  { codigo: 'ACT', capitulos: 28, nomes: ['atos', 'actos', 'at'] },
  { codigo: 'ROM', capitulos: 16, nomes: ['romanos', 'rm', 'rom'] },
  { codigo: '1CO', capitulos: 16, numero: 1, nomes: ['corintios', 'co', 'cor'] },
  { codigo: '2CO', capitulos: 13, numero: 2, nomes: ['corintios', 'co', 'cor'] },
  { codigo: 'GAL', capitulos: 6, nomes: ['galatas', 'gl', 'gal'] },
  { codigo: 'EPH', capitulos: 6, nomes: ['efesios', 'ef', 'efe', 'efes'] },
  { codigo: 'PHP', capitulos: 4, nomes: ['filipenses', 'fp', 'fl', 'fil', 'filip'] },
  { codigo: 'COL', capitulos: 4, nomes: ['colossenses', 'cl', 'col'] },
  { codigo: '1TH', capitulos: 5, numero: 1, nomes: ['tessalonicenses', 'ts', 'tes', 'tess'] },
  { codigo: '2TH', capitulos: 3, numero: 2, nomes: ['tessalonicenses', 'ts', 'tes', 'tess'] },
  { codigo: '1TI', capitulos: 6, numero: 1, nomes: ['timoteo', 'tm', 'tim'] },
  { codigo: '2TI', capitulos: 4, numero: 2, nomes: ['timoteo', 'tm', 'tim'] },
  { codigo: 'TIT', capitulos: 3, nomes: ['tito', 'tt', 'tit'] },
  { codigo: 'PHM', capitulos: 1, nomes: ['filemom', 'filemon', 'fm', 'flm', 'filem'] },
  { codigo: 'HEB', capitulos: 13, nomes: ['hebreus', 'hb', 'heb'] },
  { codigo: 'JAS', capitulos: 5, nomes: ['tiago', 'tg', 'tiag'] },
  { codigo: '1PE', capitulos: 5, numero: 1, nomes: ['pedro', 'pe', 'ped'] },
  { codigo: '2PE', capitulos: 3, numero: 2, nomes: ['pedro', 'pe', 'ped'] },
  { codigo: '1JN', capitulos: 5, numero: 1, nomes: ['joao', 'jo'] },
  { codigo: '2JN', capitulos: 1, numero: 2, nomes: ['joao', 'jo'] },
  { codigo: '3JN', capitulos: 1, numero: 3, nomes: ['joao', 'jo'] },
  { codigo: 'JUD', capitulos: 1, nomes: ['judas', 'jd'] },
  { codigo: 'REV', capitulos: 22, nomes: ['apocalipse', 'ap', 'apoc'] },
];

const LIVRO_JO = LIVROS.find((livro) => livro.codigo === 'JOB')!;

// Chave: `${numero ?? ''}${nome}`.
const LIVROS_POR_CHAVE = new Map<string, LivroBiblico>();
for (const livro of LIVROS) {
  for (const nome of livro.nomes) {
    LIVROS_POR_CHAVE.set(`${livro.numero ?? ''}${nome}`, livro);
  }
}

// Abreviações que também são palavras comuns ("os 3 cânticos", "na 2ª"):
// só valem com versículo ou ponto ("Os 6.6", "Na. 1").
const ABREVIACOES_AMBIGUAS = new Set(['os', 'na']);

function normalizarNome(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s.]/g, '');
}

function numeroDoPrefixo(prefixo: string | undefined) {
  if (!prefixo) return null;
  const valor = prefixo.trim().toUpperCase();
  if (valor === '1' || valor === 'I') return 1;
  if (valor === '2' || valor === 'II') return 2;
  if (valor === '3' || valor === 'III') return 3;
  return null;
}

export interface ReferenciaBiblica {
  // Posição do trecho no texto original.
  inicio: number;
  fim: number;
  // Trecho como foi escrito ("Sl. 109.21").
  rotulo: string;
  // Ids USFM, um por passagem ("PSA.46", "PSA.47").
  passagens: string[];
}

const REGEX_REFERENCIA =
  /(?<![\p{L}\p{N}])(?:([123]|I{1,3})\s*[ºª°]?\s+|([123])\s*[ºª°]?)?(C[âa]ntico\s+dos\s+C[âa]nticos|\p{L}+)(\.?)(?:[.,]|-(?=\s))?\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?(?:\s+e\s+(\d{1,3})(?![:.,]\d))?(?![\p{L}\p{N}])/gu;

// Continuação sem o nome do livro, logo após uma referência:
// "; 61.3" (outro capítulo), ", 44" (outro versículo), ", e 2: 1", " e 26:22".
const REGEX_CONTINUACAO =
  /(\s*(?:[;,]\s*(?:e\s+)?|\s+e\s+))(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?(?:\s*[-–—]\s*(\d{1,3}))?(?![\p{L}\p{N}])/uy;

interface OpcoesReferencias {
  // Listas de referências (catecismos, Confissão): entende continuações.
  continuacoes?: boolean;
}

function lerContinuacoes(
  texto: string,
  posicao: number,
  livro: LivroBiblico,
  capituloInicial: number,
  temVersiculo: boolean
): ReferenciaBiblica[] {
  const continuacoes: ReferenciaBiblica[] = [];
  let capitulo = capituloInicial;
  let comVersiculo = temVersiculo;

  REGEX_CONTINUACAO.lastIndex = posicao;
  let match: RegExpExecArray | null;
  while ((match = REGEX_CONTINUACAO.exec(texto)) !== null) {
    const [trecho, separador, aTexto, bTexto, fimTexto] = match;
    const a = Number(aTexto);
    const b = bTexto ? Number(bTexto) : null;
    const fim = fimTexto ? Number(fimTexto) : null;
    let passagem: string | null = null;

    if (b !== null) {
      // "61.3", "2: 1-4": capítulo e versículo(s).
      if (a >= 1 && a <= livro.capitulos && b >= 1) {
        capitulo = a;
        comVersiculo = true;
        passagem = fim && fim > b ? `${livro.codigo}.${a}.${b}-${fim}` : `${livro.codigo}.${a}.${b}`;
      }
    } else if (separador.includes(',') && comVersiculo) {
      // ", 44", ", 15-16": outro(s) versículo(s) do mesmo capítulo.
      if (a >= 1) passagem = fim && fim > a ? `${livro.codigo}.${capitulo}.${a}-${fim}` : `${livro.codigo}.${capitulo}.${a}`;
    } else if (a >= 1 && a <= livro.capitulos) {
      // "; 90", " e 47": outro capítulo inteiro.
      capitulo = a;
      comVersiculo = false;
      passagem = `${livro.codigo}.${a}`;
    }

    if (!passagem) break;

    const inicio = match.index + separador.length;
    const rotulo = trecho.slice(separador.length);
    continuacoes.push({ inicio, fim: inicio + rotulo.length, rotulo, passagens: [passagem] });
  }

  return continuacoes;
}

export function encontrarReferenciasBiblicas(texto: string, opcoes: OpcoesReferencias = {}): ReferenciaBiblica[] {
  const referencias: ReferenciaBiblica[] = [];

  for (const match of texto.matchAll(REGEX_REFERENCIA)) {
    const [trecho, prefixoSeparado, prefixoColado, nomeLivro, ponto, capTexto, v1Texto, v2Texto, cap2Texto] = match;
    const numero = numeroDoPrefixo(prefixoSeparado ?? prefixoColado);

    let livro: LivroBiblico | undefined;
    if (!numero && nomeLivro.toLowerCase() === 'jó') {
      livro = LIVRO_JO;
    } else {
      const nome = normalizarNome(nomeLivro);
      livro = LIVROS_POR_CHAVE.get(`${numero ?? ''}${nome}`);

      // Abreviações curtas só em maiúscula ("Sl", "Jo"), para não pegar palavras.
      if (livro && nome.length <= 2 && nomeLivro[0] === nomeLivro[0].toLowerCase()) continue;
      if (livro && ABREVIACOES_AMBIGUAS.has(nome) && !ponto && !v1Texto) continue;
    }
    if (!livro) continue;

    const capitulo = Number(capTexto);
    const v1 = v1Texto ? Number(v1Texto) : null;
    const v2 = v2Texto ? Number(v2Texto) : null;
    const capitulo2 = cap2Texto ? Number(cap2Texto) : null;
    const passagens: string[] = [];

    if (livro.capitulos === 1 && v1 === null) {
      // "Judas 3", "Filemom 4": livro de um capítulo só, o número é o versículo.
      passagens.push(`${livro.codigo}.1.${capitulo}`);
    } else {
      if (capitulo < 1 || capitulo > livro.capitulos) continue;
      if (v1 !== null && v1 < 1) continue;

      if (v1 === null) {
        passagens.push(`${livro.codigo}.${capitulo}`);
        if (capitulo2 && capitulo2 > capitulo && capitulo2 <= livro.capitulos) {
          for (let cap = capitulo + 1; cap <= Math.min(capitulo2, capitulo + 3); cap += 1) {
            passagens.push(`${livro.codigo}.${cap}`);
          }
        }
      } else if (v2 !== null && v2 > v1) {
        passagens.push(`${livro.codigo}.${capitulo}.${v1}-${v2}`);
      } else {
        passagens.push(`${livro.codigo}.${capitulo}.${v1}`);
      }
    }

    // "Salmos 46 e 47" consome o "e 47"; versículos com "e" ficam de fora do rótulo.
    const consumiuSegundoCapitulo = capitulo2 !== null && v1 === null;
    const rotulo = consumiuSegundoCapitulo ? trecho : trecho.replace(/\s+e\s+\d{1,3}$/, '');
    const inicio = match.index ?? 0;

    referencias.push({ inicio, fim: inicio + rotulo.length, rotulo, passagens });

    if (opcoes.continuacoes && !consumiuSegundoCapitulo && livro.capitulos > 1) {
      referencias.push(...lerContinuacoes(texto, inicio + rotulo.length, livro, capitulo, v1 !== null));
    }
  }

  return referencias.sort((a, b) => a.inicio - b.inicio);
}

// Validação no servidor do que chega do navegador.
export const REGEX_ID_PASSAGEM = /^[1-3A-Z]{3}\.\d{1,3}(?:\.\d{1,3}(?:-\d{1,3})?)?$/;
