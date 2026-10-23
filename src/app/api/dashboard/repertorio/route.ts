import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import {
  getAuthenticatedUserFromServerCookies,
  resolveAuthorizedCurrentIgrejaId,
} from '@/lib/server-church';
import {
  TEMAS,
  analisarLetra,
  chaveDeNome,
  extrairMusicasDoTexto,
  type AnaliseLetra,
  type TemaId,
} from '@/lib/repertorio-analise';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const LIMITE_PAGINA = 1000;
const TAMANHO_LOTE = 100;
const DIAS_PARA_ESQUECIDA = 180;
const PERCENTUAL_TEMA_POUCO_CANTADO = 0.12;
// A leitura de cada culto compara o perfil dos 12 meses que terminam nele.
const DIAS_JANELA_LEITURA = 365;
const CULTOS_NA_EVOLUCAO = 12;
const TEMAS_NA_EVOLUCAO = 4;
const MUDANCA_MINIMA_TEMA = 0.01;

type CultoRow = { 'Culto nr.': number; Dia: string };
type ItemRow = {
  culto_id: number;
  cantico_id: string | number | null;
  tipo: string | null;
  conteudo_publico: string | null;
};
type CanticoRow = { id: string; nome: string | null; letra: string | null };
type HinoRow = {
  id: number;
  numero: string | null;
  titulo: string | null;
  letra: string | null;
  assunto: string | null;
};

type Musica = {
  nome: string;
  tipo: 'hino' | 'cantico';
  analise: AnaliseLetra | null;
  temLetra: boolean;
};

type Execucao = { chave: string; data: string; culto: number };

// PostgREST corta respostas em 1000 linhas; lê página a página até acabar.
async function buscarPaginado<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: unknown; error: unknown }>
) {
  const linhas: T[] = [];
  for (let de = 0; ; de += LIMITE_PAGINA) {
    const { data, error } = await montar(de, de + LIMITE_PAGINA - 1);
    if (error) throw error;
    const pagina = (data || []) as T[];
    linhas.push(...pagina);
    if (pagina.length < LIMITE_PAGINA) return linhas;
  }
}

function emLotes<T>(itens: T[]) {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += TAMANHO_LOTE) {
    lotes.push(itens.slice(inicio, inicio + TAMANHO_LOTE));
  }
  return lotes;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function dataIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolverPeriodo(periodo: string | null, hoje: Date) {
  const ano = periodo?.match(/^ano-(\d{4})$/)?.[1];
  if (ano) {
    return { id: periodo!, inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  }

  if (periodo === 'tudo') {
    return { id: 'tudo', inicio: '0000-01-01', fim: '9999-12-31' };
  }

  const dias = periodo === '90d' ? 90 : periodo === '180d' ? 180 : 365;
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - dias);
  return { id: `${dias}d`, inicio: dataIso(inicio), fim: dataIso(hoje) };
}

// "Hino 042 O Grande amor de Deus" ou "Hino - Trindade Santíssima (11)".
function numeroDoHino(nome: string) {
  const numero = nome.match(/^hino\s*(\d{1,3})\b/i)?.[1] || nome.match(/^hino\b.*\((\d{1,3})\)\s*$/i)?.[1];
  return numero ? Number(numero) : null;
}

// Intercala os assuntos (Confiança, Proteção, ...) para a sugestão não repetir um só.
function variarAssuntos(candidatos: HinoRow[]) {
  const porAssunto = new Map<string, HinoRow[]>();
  candidatos.forEach((hino) => {
    const assunto = hino.assunto?.trim() || '';
    porAssunto.set(assunto, [...(porAssunto.get(assunto) || []), hino]);
  });

  const filas = [...porAssunto.values()];
  const resultado: HinoRow[] = [];
  for (let indice = 0; resultado.length < candidatos.length; indice += 1) {
    filas.forEach((fila) => {
      if (fila[indice]) resultado.push(fila[indice]);
    });
  }
  return resultado;
}

function percentual(parte: number, total: number) {
  return total > 0 ? parte / total : 0;
}

function perfilDosTemas(execucoes: Execucao[], musicas: Map<string, Musica>) {
  const analises = execucoes
    .map((execucao) => musicas.get(execucao.chave)?.analise)
    .filter((analise): analise is AnaliseLetra => Boolean(analise));

  return Object.fromEntries(
    TEMAS.map((tema) => [
      tema.id,
      percentual(analises.filter((analise) => analise.temas.includes(tema.id)).length, analises.length),
    ])
  ) as Record<TemaId, number>;
}

// Leitura do culto mais recente com músicas (inclusive um culto já montado para
// os próximos dias), comparada com o culto anterior. Recalculada a partir do
// histórico, então cada culto novo gera a sua leitura sem precisar gravar nada.
function lerUltimoCulto(cultos: CultoRow[], historico: Execucao[], musicas: Map<string, Musica>) {
  const cultosComMusica = new Set(historico.map((execucao) => execucao.culto));
  const ordem = cultos
    .filter((culto) => cultosComMusica.has(culto['Culto nr.']) && culto.Dia >= '1900')
    .sort((a, b) => a.Dia.localeCompare(b.Dia) || a['Culto nr.'] - b['Culto nr.']);

  if (ordem.length === 0) return null;

  const posicao = new Map(ordem.map((culto, indice) => [culto['Culto nr.'], indice]));
  const conhecidas = historico.filter((execucao) => posicao.has(execucao.culto) && musicas.has(execucao.chave));

  const janelaAte = (indice: number) => {
    const inicio = new Date(`${ordem[indice].Dia}T00:00:00Z`);
    inicio.setUTCDate(inicio.getUTCDate() - DIAS_JANELA_LEITURA);
    const limite = dataIso(inicio);
    return conhecidas.filter(
      (execucao) => posicao.get(execucao.culto)! <= indice && execucao.data > limite
    );
  };

  const indiceAtual = ordem.length - 1;
  const ultimo = ordem[indiceAtual];
  const anterior = ordem[indiceAtual - 1] || null;
  const perfilAtual = perfilDosTemas(janelaAte(indiceAtual), musicas);
  const perfilAnterior = anterior ? perfilDosTemas(janelaAte(indiceAtual - 1), musicas) : null;

  const musicasDoCulto = conhecidas
    .filter((execucao) => execucao.culto === ultimo['Culto nr.'])
    .map((execucao) => {
      const musica = musicas.get(execucao.chave)!;
      const antes = conhecidas.filter(
        (outra) => outra.chave === execucao.chave && posicao.get(outra.culto)! < indiceAtual
      );
      const ultimaAntes = antes.at(-1)?.data;
      const diasSemCantar = ultimaAntes
        ? Math.round(
            (new Date(`${ultimo.Dia}T00:00:00Z`).getTime() - new Date(`${ultimaAntes}T00:00:00Z`).getTime()) /
              86_400_000
          )
        : null;

      return {
        nome: musica.nome,
        tipo: musica.tipo,
        temas: musica.analise?.temas || [],
        semLetra: !musica.analise,
        estreia: antes.length === 0,
        voltouApos: diasSemCantar !== null && diasSemCantar > DIAS_PARA_ESQUECIDA ? diasSemCantar : null,
      };
    });

  const mudancas = perfilAnterior
    ? TEMAS.map((tema) => ({
        tema: tema.id,
        antes: perfilAnterior[tema.id],
        depois: perfilAtual[tema.id],
      }))
        .filter((mudanca) => Math.abs(mudanca.depois - mudanca.antes) >= MUDANCA_MINIMA_TEMA)
        .sort((a, b) => Math.abs(b.depois - b.antes) - Math.abs(a.depois - a.antes))
        .slice(0, 4)
    : [];

  const temasDoCulto = new Set(musicasDoCulto.flatMap((musica) => musica.temas));
  const lacunasAtendidas = perfilAnterior
    ? TEMAS.filter(
        (tema) => temasDoCulto.has(tema.id) && perfilAnterior[tema.id] < PERCENTUAL_TEMA_POUCO_CANTADO
      ).map((tema) => tema.id)
    : [];

  const inicioEvolucao = Math.max(0, ordem.length - CULTOS_NA_EVOLUCAO);
  const perfis = ordem.slice(inicioEvolucao).map((culto, deslocamento) => ({
    data: culto.Dia,
    temas: perfilDosTemas(janelaAte(inicioEvolucao + deslocamento), musicas),
  }));
  // Mostra os temas que mais oscilaram nos últimos cultos.
  const temasEvolucao = TEMAS.map((tema) => {
    const valores = perfis.map((perfil) => perfil.temas[tema.id]);
    return { id: tema.id, variacao: Math.max(...valores) - Math.min(...valores) };
  })
    .sort((a, b) => b.variacao - a.variacao)
    .slice(0, TEMAS_NA_EVOLUCAO)
    .map((tema) => tema.id);

  return {
    culto: { numero: ultimo['Culto nr.'], data: ultimo.Dia },
    anterior: anterior ? { numero: anterior['Culto nr.'], data: anterior.Dia } : null,
    // Cultos já criados depois do último lido, mas ainda sem nenhuma música.
    cultosSemMusica: cultos
      .filter((culto) => culto.Dia > ultimo.Dia && !cultosComMusica.has(culto['Culto nr.']))
      .map((culto) => culto.Dia)
      .sort(),
    musicas: musicasDoCulto,
    mudancas,
    lacunasAtendidas,
    temasEvolucao,
    evolucao: perfis.map((perfil) => ({
      data: perfil.data,
      ...Object.fromEntries(temasEvolucao.map((tema) => [tema, perfil.temas[tema]])),
    })),
  };
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUserFromServerCookies(request);

    if (!user?.id) {
      return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');
    }

    const url = new URL(request.url);
    const igrejaId = await resolveAuthorizedCurrentIgrejaId(url.searchParams.get('igreja_id'), request);

    if (!igrejaId) {
      return apiError('CHURCH_REQUIRED', 400, 'Nenhuma igreja selecionada.');
    }

    const hoje = new Date();
    const periodo = resolverPeriodo(url.searchParams.get('periodo'), hoje);

    const [cultos, hinos, canticosDaIgreja] = await Promise.all([
      buscarPaginado<CultoRow>((de, ate) =>
        supabaseAdmin
          .from('Louvores IPPN')
          .select('"Culto nr.", Dia')
          .eq('igreja_id', igrejaId)
          .order('Dia', { ascending: true })
          .range(de, ate)
      ),
      buscarPaginado<HinoRow>((de, ate) =>
        supabaseAdmin
          .from('hinario_novo_cantico')
          .select('id, numero, titulo, letra, assunto')
          .order('numero', { ascending: true })
          .range(de, ate)
      ),
      buscarPaginado<CanticoRow>((de, ate) =>
        supabaseAdmin
          .from('canticos')
          .select('id, nome, letra')
          .eq('igreja_id', igrejaId)
          .order('id', { ascending: true })
          .range(de, ate)
      ),
    ]);

    const idHinoPorNumero = new Map<number, string>();
    hinos.forEach((hino) => {
      const numero = hino.numero?.trim();
      if (numero && /^\d+$/.test(numero)) idHinoPorNumero.set(Number(numero), String(hino.id));
    });

    // "Amigo fiel (Diante do Trono)" também é encontrado como "Amigo fiel".
    const idCanticoPorNome = new Map<string, string>();
    canticosDaIgreja.forEach((cantico) => {
      const nome = cantico.nome?.trim();
      if (!nome) return;
      idCanticoPorNome.set(chaveDeNome(nome), cantico.id);
      const semParenteses = chaveDeNome(nome.replace(/\([^)]*\)/g, ''));
      if (!idCanticoPorNome.has(semParenteses)) idCanticoPorNome.set(semParenteses, cantico.id);
    });

    const dataPorCulto = new Map(cultos.map((culto) => [culto['Culto nr.'], culto.Dia]));
    // Datas digitadas errado (ex.: ano 206) não viram opção de período.
    const anosDisponiveis = [...new Set(cultos.map((culto) => Number(culto.Dia.slice(0, 4))))]
      .filter((ano) => ano >= 1900 && ano <= hoje.getFullYear() + 1)
      .sort((a, b) => b - a);

    const itensPorLote = await Promise.all(
      emLotes([...dataPorCulto.keys()]).map((lote) =>
        buscarPaginado<ItemRow>((de, ate) =>
          supabaseAdmin
            .from('louvor_itens')
            .select('culto_id, cantico_id, tipo, conteudo_publico')
            .in('culto_id', lote)
            .or('cantico_id.not.is.null,conteudo_publico.not.is.null')
            .range(de, ate)
        )
      )
    );

    // Histórico completo da igreja: o período filtra depois, mas "esquecidas" e
    // "novas" precisam enxergar antes dele.
    const historico: Execucao[] = itensPorLote
      .flat()
      .flatMap((item) => {
        const data = dataPorCulto.get(item.culto_id) || '';
        if (item.cantico_id) return [{ chave: String(item.cantico_id), data, culto: item.culto_id }];
        // Itens do boletim (avisos, pedidos) também têm texto, mas não são liturgia.
        if (!item.conteudo_publico || item.tipo?.startsWith('__')) return [];

        const doTexto = extrairMusicasDoTexto(item.conteudo_publico);
        return [
          ...doTexto.hinos.map((numero) => idHinoPorNumero.get(numero)),
          ...doTexto.canticos.map((nome) => idCanticoPorNome.get(chaveDeNome(nome))),
        ]
          .filter((chave): chave is string => Boolean(chave))
          .map((chave) => ({ chave, data, culto: item.culto_id }));
      })
      .filter((execucao) => execucao.chave && execucao.data)
      .sort((a, b) => a.data.localeCompare(b.data));

    const idsDaIgreja = new Set(canticosDaIgreja.map((cantico) => cantico.id));
    const idsCanticos = [
      ...new Set(historico.map((execucao) => execucao.chave).filter((chave) => isUuid(chave) && !idsDaIgreja.has(chave))),
    ];
    const canticos = [
      ...canticosDaIgreja,
      ...(await Promise.all(
        emLotes(idsCanticos).map(async (lote) => {
          const { data, error } = await supabaseAdmin
            .from('canticos')
            .select('id, nome, letra')
            .in('id', lote);
          if (error) throw error;
          return (data || []) as CanticoRow[];
        })
      )).flat(),
    ];

    const musicas = new Map<string, Musica>();
    const hinoPorNumero = new Map<number, Musica>();

    hinos.forEach((hino) => {
      const numero = hino.numero?.trim();
      const titulo = hino.titulo?.trim() || 'Sem título';
      const musica: Musica = {
        nome: numero ? `Hino ${numero} - ${titulo}` : `Hino - ${titulo}`,
        tipo: 'hino',
        analise: analisarLetra(hino.letra, hino.assunto),
        temLetra: Boolean(hino.letra?.trim()),
      };
      musicas.set(String(hino.id), musica);
      if (numero && /^\d+$/.test(numero)) hinoPorNumero.set(Number(numero), musica);
    });

    canticos.forEach((cantico) => {
      const nome = cantico.nome?.trim() || 'Cântico sem nome';
      // Igrejas que cadastraram hinos como cânticos ("Hino 042 ...") herdam a letra
      // e o assunto do Novo Cântico quando o cadastro não tem letra própria.
      const numeroHino = numeroDoHino(nome);
      const hino = numeroHino ? hinoPorNumero.get(numeroHino) : undefined;
      const letraPropria = Boolean(cantico.letra?.trim());

      musicas.set(cantico.id, {
        nome,
        tipo: numeroHino ? 'hino' : 'cantico',
        analise: !letraPropria && hino ? hino.analise : analisarLetra(cantico.letra, null),
        temLetra: letraPropria || Boolean(hino?.temLetra),
      });
    });

    const execucoes = historico.filter(
      (execucao) =>
        execucao.data >= periodo.inicio && execucao.data <= periodo.fim && musicas.has(execucao.chave)
    );
    const cultosNoPeriodo = cultos.filter(
      (culto) => culto.Dia >= periodo.inicio && culto.Dia <= periodo.fim
    ).length;

    const vezesPorMusica = new Map<string, number>();
    execucoes.forEach((execucao) => {
      vezesPorMusica.set(execucao.chave, (vezesPorMusica.get(execucao.chave) || 0) + 1);
    });
    const ranking = [...vezesPorMusica.entries()].sort((a, b) => b[1] - a[1]);

    const primeiraVez = new Map<string, string>();
    const ultimaVez = new Map<string, string>();
    const vezesNoHistorico = new Map<string, number>();
    historico.forEach((execucao) => {
      if (!primeiraVez.has(execucao.chave)) primeiraVez.set(execucao.chave, execucao.data);
      ultimaVez.set(execucao.chave, execucao.data);
      vezesNoHistorico.set(execucao.chave, (vezesNoHistorico.get(execucao.chave) || 0) + 1);
    });

    // Cada execução pesa igual: o que a igreja canta mais conta mais no perfil.
    const analisadas = execucoes
      .map((execucao) => ({ ...execucao, analise: musicas.get(execucao.chave)!.analise }))
      .filter((execucao): execucao is Execucao & { analise: AnaliseLetra } => Boolean(execucao.analise));
    const totalAnalisadas = analisadas.length;

    const temas = TEMAS.map((tema) => {
      const doTema = analisadas.filter((execucao) => execucao.analise.temas.includes(tema.id));
      const porMusica = new Map<string, number>();
      doTema.forEach((execucao) => {
        porMusica.set(execucao.chave, (porMusica.get(execucao.chave) || 0) + 1);
      });

      return {
        id: tema.id,
        execucoes: doTema.length,
        percentual: percentual(doTema.length, totalAnalisadas),
        exemplos: [...porMusica.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([chave]) => musicas.get(chave)!.nome),
      };
    }).sort((a, b) => b.percentual - a.percentual);

    const contarCampo = <K extends 'voz' | 'direcao'>(campo: K) => {
      const totais = new Map<string, number>();
      let total = 0;
      analisadas.forEach((execucao) => {
        const valor = execucao.analise[campo];
        if (!valor) return;
        total += 1;
        totais.set(valor, (totais.get(valor) || 0) + 1);
      });
      return { total, totais };
    };

    const voz = contarCampo('voz');
    const direcao = contarCampo('direcao');

    const pesoPalavra = new Map<string, number>();
    analisadas.forEach((execucao) => {
      execucao.analise.palavras.forEach((palavra) => {
        pesoPalavra.set(palavra, (pesoPalavra.get(palavra) || 0) + 1);
      });
    });

    const totalExecucoes = execucoes.length;
    const execucoesHinos = execucoes.filter((execucao) => musicas.get(execucao.chave)!.tipo === 'hino').length;
    const comLetra = execucoes.filter((execucao) => musicas.get(execucao.chave)!.temLetra).length;

    let acumulado = 0;
    let nucleo = 0;
    for (const [, vezes] of ranking) {
      if (acumulado >= totalExecucoes / 2) break;
      acumulado += vezes;
      nucleo += 1;
    }

    const limiteEsquecida = new Date(hoje);
    limiteEsquecida.setDate(limiteEsquecida.getDate() - DIAS_PARA_ESQUECIDA);
    const esquecidas = [...vezesNoHistorico.entries()]
      .filter(([chave, vezes]) => vezes >= 3 && musicas.has(chave) && ultimaVez.get(chave)! < dataIso(limiteEsquecida))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([chave, vezes]) => ({ nome: musicas.get(chave)!.nome, vezes, ultimaData: ultimaVez.get(chave)! }));

    const novas = ranking
      .filter(([chave]) => primeiraVez.get(chave)! >= periodo.inicio)
      .map(([chave, vezes]) => ({ nome: musicas.get(chave)!.nome, vezes, primeiraData: primeiraVez.get(chave)! }))
      .sort((a, b) => b.primeiraData.localeCompare(a.primeiraData));

    const semLetra = ranking
      .filter(([chave]) => !musicas.get(chave)!.temLetra)
      .slice(0, 10)
      .map(([chave, vezes]) => ({ nome: musicas.get(chave)!.nome, vezes }));

    const mensal = new Map<string, { hinos: number; canticos: number }>();
    execucoes.forEach((execucao) => {
      const mes = execucao.data.slice(0, 7);
      const atual = mensal.get(mes) || { hinos: 0, canticos: 0 };
      if (musicas.get(execucao.chave)!.tipo === 'hino') atual.hinos += 1;
      else atual.canticos += 1;
      mensal.set(mes, atual);
    });

    // Para os temas menos cantados, hinos do Novo Cântico que a igreja nunca cantou.
    const jaCantados = new Set(vezesNoHistorico.keys());
    const numerosJaCantados = new Set(
      [...vezesNoHistorico.keys()]
        .map((chave) => numeroDoHino(musicas.get(chave)?.nome || ''))
        .filter(Boolean)
    );
    const sugestoes = totalAnalisadas === 0
      ? []
      : temas
          .filter((tema) => tema.percentual < PERCENTUAL_TEMA_POUCO_CANTADO)
          .slice(-3)
          .reverse()
          .map((tema) => {
            const assuntos = TEMAS.find((definicao) => definicao.id === tema.id)!.assuntos;
            return {
              tema: tema.id as TemaId,
              percentual: tema.percentual,
              hinos: variarAssuntos(
                hinos.filter(
                  (hino) =>
                    hino.assunto &&
                    assuntos.includes(hino.assunto.trim()) &&
                    !jaCantados.has(String(hino.id)) &&
                    !numerosJaCantados.has(Number(hino.numero))
                )
              )
                .slice(0, 3)
                .map((hino) => ({
                  nome: musicas.get(String(hino.id))!.nome,
                  assunto: hino.assunto,
                })),
            };
          })
          .filter((sugestao) => sugestao.hinos.length > 0);

    return apiSuccess({
      periodo,
      anosDisponiveis,
      leitura: lerUltimoCulto(cultos, historico, musicas),
      resumo: {
        cultos: cultosNoPeriodo,
        execucoes: totalExecucoes,
        musicasDistintas: vezesPorMusica.size,
        percentualHinos: percentual(execucoesHinos, totalExecucoes),
        coberturaLetras: percentual(comLetra, totalExecucoes),
        execucoesAnalisadas: totalAnalisadas,
      },
      temas,
      trindade: {
        pai: percentual(analisadas.filter((execucao) => execucao.analise.trindade.pai).length, totalAnalisadas),
        filho: percentual(analisadas.filter((execucao) => execucao.analise.trindade.filho).length, totalAnalisadas),
        espirito: percentual(
          analisadas.filter((execucao) => execucao.analise.trindade.espirito).length,
          totalAnalisadas
        ),
      },
      voz: {
        individual: percentual(voz.totais.get('individual') || 0, voz.total),
        comunitaria: percentual(voz.totais.get('comunitaria') || 0, voz.total),
        equilibrada: percentual(voz.totais.get('equilibrada') || 0, voz.total),
      },
      direcao: {
        aDeus: percentual(direcao.totais.get('a_deus') || 0, direcao.total),
        sobreDeus: percentual(direcao.totais.get('sobre_deus') || 0, direcao.total),
        misto: percentual(direcao.totais.get('misto') || 0, direcao.total),
      },
      vocabulario: [...pesoPalavra.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([palavra, peso]) => ({ palavra, peso })),
      rodizio: {
        top10: percentual(
          ranking.slice(0, 10).reduce((total, [, vezes]) => total + vezes, 0),
          totalExecucoes
        ),
        nucleo,
        cantadasUmaVez: ranking.filter(([, vezes]) => vezes === 1).length,
        maisCantadas: ranking.slice(0, 10).map(([chave, vezes]) => ({ nome: musicas.get(chave)!.nome, vezes })),
      },
      novas: novas.slice(0, 8),
      totalNovas: novas.length,
      esquecidas,
      semLetra,
      mensal: [...mensal.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, totais]) => ({ mes, ...totais })),
      sugestoes,
    });
  } catch (error: any) {
    console.error('Erro ao analisar repertório:', error);
    return apiError(
      'LOAD_REPERTOIRE_ANALYSIS_FAILED',
      500,
      error.message || 'Erro ao analisar o repertório.'
    );
  }
}
