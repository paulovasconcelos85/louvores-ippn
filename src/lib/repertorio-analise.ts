// Análise de conteúdo das letras do repertório. Funções puras: rodam no servidor
// (rota /api/dashboard/repertorio) e os rótulos também são usados no cliente.

export type TemaId =
  | 'adoracao'
  | 'confissao'
  | 'cruz'
  | 'graca'
  | 'confianca'
  | 'espirito'
  | 'entrega'
  | 'missao'
  | 'esperanca'
  | 'gratidao'
  | 'igreja'
  | 'palavra';

type Rotulo = { pt: string; es: string; en: string };

type TemaDefinicao = {
  id: TemaId;
  rotulo: Rotulo;
  // Expressões aplicadas ao texto já sem acentos e em minúsculas.
  padroes: RegExp[];
  // Assuntos do Hinário Novo Cântico que pertencem ao tema.
  assuntos: string[];
};

export const TEMAS: TemaDefinicao[] = [
  {
    id: 'adoracao',
    rotulo: { pt: 'Adoração e majestade', es: 'Adoración y majestad', en: 'Worship and majesty' },
    padroes: [/\bglori/g, /\blouv/g, /\bexalt/g, /\badora/g, /\bmajestad/g, /\breina/g, /\btrono/g, /\baleluia/g, /\bhosana/g, /\bdigno\b/g, /\bmagnific/g, /\bsanto,? santo/g, /\brei dos reis/g, /\bsoberan/g, /\bonipotent/g],
    assuntos: ['Intróitos', 'Deus Santo', 'Deus Senhor', 'Deus Soberano', 'Deus Trino', 'Deus Criador', 'Deus Vencedor', 'Dia do Senhor'],
  },
  {
    id: 'confissao',
    rotulo: { pt: 'Confissão e arrependimento', es: 'Confesión y arrepentimiento', en: 'Confession and repentance' },
    padroes: [/\bpecad/g, /\bpecador/g, /\barrepend/g, /\bculpa/g, /\bconfess/g, /\bcontri/g, /\bpurific/g, /\blava-me/g, /\bsonda/g, /\bperdoa/g, /\bperdao/g, /\biniquidad/g, /\btransgress/g],
    assuntos: ['Contrição e Arrependimento', 'Perdão'],
  },
  {
    id: 'cruz',
    rotulo: { pt: 'Cruz e ressurreição', es: 'Cruz y resurrección', en: 'Cross and resurrection' },
    padroes: [/\bcruz\b/g, /\bsangue/g, /\bcordeiro/g, /\bcalvario/g, /\bmorreu/g, /\bressurre/g, /\bressuscit/g, /\btumulo/g, /\bsepulcro/g, /\bredim/g, /\bredenc/g, /\bresgat/g, /\bcrucific/g],
    assuntos: ['Paixão e Morte', 'Ressurreição', 'Ceia do Senhor', 'Entrada Triunfal'],
  },
  {
    id: 'graca',
    rotulo: { pt: 'Graça e salvação', es: 'Gracia y salvación', en: 'Grace and salvation' },
    padroes: [/\bgraca\b/g, /\bsalv/g, /\bmisericord/g, /\bjustific/g, /\bamor de deus/g, /\bteu amor/g, /\bseu amor/g, /\bimerecid/g, /\bnovo nascimento/g, /\bescolhid/g],
    assuntos: ['Deus Salvador', 'Salvação', 'Amor de Deus', 'Convertidos'],
  },
  {
    id: 'confianca',
    rotulo: { pt: 'Confiança e refúgio', es: 'Confianza y refugio', en: 'Trust and refuge' },
    padroes: [/\brefugio/g, /\brocha/g, /\bfortaleza/g, /\bescudo/g, /\babrigo/g, /\bconfi/g, /\btemerei/g, /\bmedo\b/g, /\bfiel\b/g, /\bfidelidade/g, /\bsocorr/g, /\bdescans/g, /\bguarda/g, /\bcuida/g, /\bpastor\b/g, /\bfirme/g],
    assuntos: ['Confiança', 'Proteção', 'Deus Fiel', 'Deus Providente', 'Companhia do Senhor', 'Fé'],
  },
  {
    id: 'espirito',
    rotulo: { pt: 'Espírito e santificação', es: 'Espíritu y santificación', en: 'Spirit and sanctification' },
    padroes: [/\bespirito/g, /\bsantific/g, /\bconsolador/g, /\buncao/g, /\btransforma/g, /\bsantidade/g, /\bpureza/g, /\bcoracao puro/g],
    assuntos: ['Espírito Consolador', 'Espírito Instruidor', 'Espírito Vivificador', 'Santificação', 'Aspiração'],
  },
  {
    id: 'entrega',
    rotulo: { pt: 'Consagração e entrega', es: 'Consagración y entrega', en: 'Consecration and surrender' },
    padroes: [/\bentreg/g, /\brend/g, /\bconsagr/g, /\baltar/g, /\bseguir/g, /\bservir/g, /\bobedec/g, /\bminha vida/g, /\bdedic/g, /\bsubmet/g],
    assuntos: ['Dedicação', 'Decisão', 'Submissão', 'Discipulado e Serviço', 'Profissão de Fé', 'Fidelidade', 'Ministério', 'Trabalho Cristão'],
  },
  {
    id: 'missao',
    rotulo: { pt: 'Missão e evangelização', es: 'Misión y evangelización', en: 'Mission and evangelism' },
    padroes: [/\bnacoes/g, /\bpovos/g, /\banunci/g, /\bproclam/g, /\bevangelho/g, /\bmissao/g, /\bide\b/g, /\btestemunh/g, /\bperdidos/g, /\bcolheita/g, /\bseara/g, /\btoda a terra/g],
    assuntos: ['A Grande Comissão', 'Evangelização', 'Convite', 'Testemunho'],
  },
  {
    id: 'esperanca',
    rotulo: { pt: 'Esperança e eternidade', es: 'Esperanza y eternidad', en: 'Hope and eternity' },
    padroes: [/\bvoltar/g, /\bvinda\b/g, /\bceu\b/g, /\bceus\b/g, /\beterni/g, /\bpara sempre/g, /\bcoroa/g, /\bjerusalem/g, /\besperanc/g, /\bnao havera mais/g, /\bface a face/g],
    assuntos: ['Esperança', 'Segunda Vinda', 'Lar Celestial', 'Advento'],
  },
  {
    id: 'gratidao',
    rotulo: { pt: 'Gratidão', es: 'Gratitud', en: 'Gratitude' },
    padroes: [/\bgratid/g, /\bgrat[oa]s?\b/g, /\bagradec/g, /\bgracas\b/g, /\bobrigad/g],
    assuntos: ['Gratidão', 'Ano Novo'],
  },
  {
    id: 'igreja',
    rotulo: { pt: 'Igreja e comunhão', es: 'Iglesia y comunión', en: 'Church and fellowship' },
    padroes: [/\bigreja/g, /\birmaos/g, /\bcomunh/g, /\bunidade/g, /\bunidos/g, /\bpovo de deus/g, /\bteu povo/g, /\bfamilia/g, /\bjuntos/g],
    assuntos: ['Fraternidade', 'Igreja Militante', 'Lar Cristão'],
  },
  {
    id: 'palavra',
    rotulo: { pt: 'Palavra de Deus', es: 'Palabra de Dios', en: 'Word of God' },
    padroes: [/\bpalavra/g, /\bescritura/g, /\bbiblia/g, /\bverdade/g, /\bteus preceitos/g, /\btua lei/g, /\bpromessa/g],
    assuntos: ['Bíblia', 'Escola Dominical'],
  },
];

export const ROTULO_TEMA = Object.fromEntries(TEMAS.map((tema) => [tema.id, tema.rotulo])) as Record<
  TemaId,
  Rotulo
>;

const TEMA_POR_ASSUNTO = new Map<string, TemaId>(
  TEMAS.flatMap((tema) => tema.assuntos.map((assunto) => [assunto, tema.id] as const))
);

// Mais de uma ocorrência evita que uma palavra solta classifique a música inteira.
const MINIMO_OCORRENCIAS_TEMA = 2;

const PESSOAS_TRINDADE = {
  pai: [/\bpai\b/g, /\bcriador/g, /\baba\b/g, /\bdeus pai/g],
  filho: [/\bjesus/g, /\bcristo/g, /\bcordeiro/g, /\bfilho\b/g, /\bsalvador/g, /\bmessias/g, /\bemanuel/g, /\bnazareno/g],
  espirito: [/\bespirito/g, /\bconsolador/g],
} as const;

export type PessoaTrindade = keyof typeof PESSOAS_TRINDADE;

const PRIMEIRA_SINGULAR = new Set(['eu', 'me', 'mim', 'meu', 'minha', 'meus', 'minhas', 'comigo']);
const PRIMEIRA_PLURAL = new Set(['nos', 'nosso', 'nossa', 'nossos', 'nossas', 'conosco']);
const SEGUNDA_PESSOA = new Set(['tu', 'te', 'ti', 'teu', 'tua', 'teus', 'tuas', 'contigo', 'vos']);
const TERCEIRA_PESSOA = new Set(['ele', 'dele', 'nele', 'seu', 'seus']);

const STOPWORDS = new Set(
  `a o as os um uma uns umas de da do das dos em na no nas nos por pra pro para com sem sob sobre
  e ou mas que se ja nao sim mais menos tao tal como quando onde quem qual quais cada todo toda todos
  todas tudo nada este esta isto esse essa isso aquele aquela aquilo ao aos la lo lhe lhes me te se nos
  vos eu tu ele ela eles elas meu minha meus minhas teu tua teus tuas seu sua seus suas nosso nossa nossos
  nossas dele dela mim ti si sou es e somos
  sao foi era ser estar estou esta estamos vai vou vem ha ter tem tenho tens temos pois porque entao
  ate apos entre desde ainda so sempre aqui ali la oh ah ate assim tambem muito muita bem quero
  estrofe coro refrao ponte verso final bis mesmo outro outra deste desta neste nesta num numa pelo pela
  pelos pelas seja sera serei fez faz fazer pode posso diz dize`.split(/\s+/)
);

function semAcentos(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function normalizarTexto(texto: string) {
  return semAcentos(texto.toLowerCase()).replace(
    /^\s*(estrofe|coro|refrao|ponte|verso)\s*\d*\s*:?\s*$/gm,
    ' '
  );
}

function contarOcorrencias(texto: string, padroes: readonly RegExp[]) {
  return padroes.reduce((total, padrao) => total + (texto.match(padrao)?.length || 0), 0);
}

export type Voz = 'individual' | 'comunitaria' | 'equilibrada';
export type Direcao = 'a_deus' | 'sobre_deus' | 'misto';

export type AnaliseLetra = {
  temas: TemaId[];
  trindade: Record<PessoaTrindade, boolean>;
  voz: Voz | null;
  direcao: Direcao | null;
  palavras: string[];
};

function classificar<T extends string>(a: number, b: number, rotulos: [T, T, T]) {
  if (a + b < 2) return null;
  if (a > b * 1.5) return rotulos[0];
  if (b > a * 1.5) return rotulos[1];
  return rotulos[2];
}

export function analisarLetra(letra: string | null, assunto: string | null): AnaliseLetra | null {
  const temaDoAssunto = assunto ? TEMA_POR_ASSUNTO.get(assunto.trim()) : undefined;
  const texto = letra?.trim() ? normalizarTexto(letra) : '';

  if (!texto && !temaDoAssunto) return null;

  const temas = new Set<TemaId>();
  if (temaDoAssunto) temas.add(temaDoAssunto);

  TEMAS.forEach((tema) => {
    if (contarOcorrencias(texto, tema.padroes) >= MINIMO_OCORRENCIAS_TEMA) {
      temas.add(tema.id);
    }
  });

  const palavrasOriginais = letra?.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) || [];
  const tokens = palavrasOriginais.map(semAcentos);
  let singular = 0;
  let plural = 0;
  let segunda = 0;
  let terceira = 0;

  tokens.forEach((token) => {
    if (PRIMEIRA_SINGULAR.has(token)) singular += 1;
    if (PRIMEIRA_PLURAL.has(token)) plural += 1;
    if (SEGUNDA_PESSOA.has(token)) segunda += 1;
    if (TERCEIRA_PESSOA.has(token)) terceira += 1;
  });

  return {
    temas: [...temas],
    trindade: {
      pai: contarOcorrencias(texto, PESSOAS_TRINDADE.pai) > 0,
      filho: contarOcorrencias(texto, PESSOAS_TRINDADE.filho) > 0,
      espirito: contarOcorrencias(texto, PESSOAS_TRINDADE.espirito) > 0,
    },
    voz: texto ? classificar(singular, plural, ['individual', 'comunitaria', 'equilibrada']) : null,
    direcao: texto ? classificar(segunda, terceira, ['a_deus', 'sobre_deus', 'misto']) : null,
    // Palavras distintas por música, para que um refrão repetido não domine o vocabulário.
    palavras: [
      ...new Set(
        palavrasOriginais.filter(
          (palavra, indice) => palavra.length >= 4 && !STOPWORDS.has(tokens[indice])
        )
      ),
    ],
  };
}

// Chave para comparar nomes de cânticos digitados à mão com o cadastro.
export function chaveDeNome(nome: string) {
  return semAcentos(nome.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Igrejas que escrevem a liturgia como texto ("Hino O Deus de Amor (043)",
// "HINO — 266", "Cântico: Redenção") em vez de escolher a música na lista.
export function extrairMusicasDoTexto(texto: string) {
  const hinos: number[] = [];
  const canticos: string[] = [];

  texto.split('\n').forEach((linhaBruta) => {
    const linha = linhaBruta.trim();
    const numeroHino =
      linha.match(/\bhino\b[^\n()]*\((\d{1,3})\)/i)?.[1] ||
      linha.match(/\bhino\b\s*[-–—:]?\s*(\d{1,3})\b/i)?.[1];

    if (numeroHino) {
      hinos.push(Number(numeroHino));
      return;
    }

    const cantico = linha.match(/^c[aâ]ntico\s*:\s*(.+)$/i)?.[1]?.trim();
    if (cantico) canticos.push(cantico);
  });

  return { hinos, canticos };
}
