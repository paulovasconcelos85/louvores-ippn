'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpenText,
  Brain,
  CalendarClock,
  Compass,
  History,
  Lightbulb,
  ListMusic,
  MessageCircleHeart,
  Music2,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/config';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage } from '@/lib/api-feedback';
import { ROTULO_TEMA, type TemaId } from '@/lib/repertorio-analise';

type MusicaVezes = { nome: string; vezes: number };

type LeituraCulto = {
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
  temasEvolucao: TemaId[];
  evolucao: Array<{ data: string } & Partial<Record<TemaId, number>>>;
};

type AnaliseRepertorio = {
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
  vocabulario: Array<{ palavra: string; peso: number }>;
  rodizio: { top10: number; nucleo: number; cantadasUmaVez: number; maisCantadas: MusicaVezes[] };
  novas: Array<MusicaVezes & { primeiraData: string }>;
  totalNovas: number;
  esquecidas: Array<MusicaVezes & { ultimaData: string }>;
  semLetra: MusicaVezes[];
  mensal: Array<{ mes: string; hinos: number; canticos: number }>;
  sugestoes: Array<{ tema: TemaId; percentual: number; hinos: Array<{ nome: string; assunto: string | null }> }>;
};

const TEMA_POUCO_CANTADO = 0.12;
const CORES_EVOLUCAO = ['#0f766e', '#8b5cf6', '#f59e0b', '#2563eb'];
const AMOSTRA_MINIMA = 20;

function Painel({
  title,
  icon,
  description,
  children,
  className = '',
}: {
  title: string;
  icon: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-200/70 backdrop-blur md:p-6 ${className}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">{icon}</div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-0.5 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function BarraDividida({
  partes,
}: {
  partes: Array<{ rotulo: string; valor: number; cor: string; texto: string }>;
}) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {partes.map((parte) => (
          <div key={parte.rotulo} className={parte.cor} style={{ width: `${parte.valor * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {partes.map((parte) => (
          <span key={parte.rotulo} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${parte.cor}`} />
            {parte.rotulo}
            <span className="font-semibold text-slate-900">{parte.texto}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RepertorioInsights({ igrejaId }: { igrejaId: string }) {
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const tr = useCallback(
    (pt: string, es: string, en: string) => (locale === 'es' ? es : locale === 'en' ? en : pt),
    [locale]
  );

  const [periodo, setPeriodo] = useState('365d');
  const [analise, setAnalise] = useState<AnaliseRepertorio | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // Muda quando a aba volta ao foco: quem lançou as músicas do culto em outra aba
  // encontra a leitura já refeita ao voltar.
  const [versao, setVersao] = useState(0);
  const recargaSilenciosa = useRef(false);

  const pct = useMemo(
    () => new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }),
    [intlLocale]
  );
  const formatarData = useMemo(() => {
    const formatador = new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' });
    return (data: string) => formatador.format(new Date(`${data}T00:00:00`));
  }, [intlLocale]);
  const formatarDataCurta = useMemo(() => {
    const formatador = new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'short' });
    return (data: string) => formatador.format(new Date(`${data}T00:00:00`)).replace('.', '');
  }, [intlLocale]);
  const formatarMes = useMemo(() => {
    const formatador = new Intl.DateTimeFormat(intlLocale, { month: 'short', year: '2-digit' });
    return (mes: string) => formatador.format(new Date(`${mes}-01T00:00:00`)).replace('.', '');
  }, [intlLocale]);

  const nomeTema = useCallback((id: TemaId) => ROTULO_TEMA[id][locale] || ROTULO_TEMA[id].pt, [locale]);

  useEffect(() => {
    setPeriodo('365d');
  }, [igrejaId]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== 'visible') return;
      recargaSilenciosa.current = true;
      setVersao((atual) => atual + 1);
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  useEffect(() => {
    let ativo = true;
    const controller = new AbortController();

    const carregar = async () => {
      try {
        // Recargas pelo foco da aba não piscam a tela com o indicador de carregamento.
        if (!recargaSilenciosa.current) setCarregando(true);
        recargaSilenciosa.current = false;
        setErro(null);
        const params = new URLSearchParams({ igreja_id: igrejaId, periodo });
        const response = await fetch(`/api/dashboard/repertorio?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            resolveApiErrorMessage(locale, payload, tr('Erro ao analisar o repertório.', 'Error al analizar el repertorio.', 'Could not analyze the repertoire.'))
          );
        }

        if (!ativo) return;
        setAnalise(payload as AnaliseRepertorio);
        setAnos((payload as AnaliseRepertorio).anosDisponiveis);
      } catch (loadError) {
        if (controller.signal.aborted || !ativo) return;
        console.error('Erro ao carregar análise do repertório:', loadError);
        setAnalise(null);
        setErro(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
      controller.abort();
    };
  }, [igrejaId, locale, periodo, tr, versao]);

  const opcoesPeriodo = [
    { id: '90d', rotulo: tr('3 meses', '3 meses', '3 months') },
    { id: '180d', rotulo: tr('6 meses', '6 meses', '6 months') },
    { id: '365d', rotulo: tr('12 meses', '12 meses', '12 months') },
    ...anos.map((ano) => ({ id: `ano-${ano}`, rotulo: String(ano) })),
    { id: 'tudo', rotulo: tr('Tudo', 'Todo', 'All time') },
  ];

  // Leitura do perfil em frases, gerada a partir dos números do período.
  const perfil = useMemo(() => {
    if (!analise || analise.resumo.execucoesAnalisadas === 0) return [];
    const frases: Array<{ texto: string; alerta?: boolean }> = [];
    const [primeiro, segundo, terceiro] = analise.temas;

    if (analise.resumo.execucoesAnalisadas < AMOSTRA_MINIMA) {
      frases.push({
        alerta: true,
        texto: tr(
          `Amostra pequena: só ${analise.resumo.execucoesAnalisadas} músicas analisadas neste período. Leia o perfil como um primeiro indício, não como retrato.`,
          `Muestra pequeña: solo ${analise.resumo.execucoesAnalisadas} canciones analizadas en este período. Lee el perfil como un primer indicio, no como un retrato.`,
          `Small sample: only ${analise.resumo.execucoesAnalisadas} songs analyzed in this period. Read the profile as an early hint, not a portrait.`
        ),
      });
    }

    if (primeiro) {
      frases.push({
        texto: tr(
          `O repertório gira em torno de ${nomeTema(primeiro.id).toLowerCase()} (${pct.format(primeiro.percentual)} das músicas cantadas), seguido por ${nomeTema(segundo.id).toLowerCase()} e ${nomeTema(terceiro.id).toLowerCase()}.`,
          `El repertorio gira en torno a ${nomeTema(primeiro.id).toLowerCase()} (${pct.format(primeiro.percentual)} de lo cantado), seguido por ${nomeTema(segundo.id).toLowerCase()} y ${nomeTema(terceiro.id).toLowerCase()}.`,
          `The repertoire centers on ${nomeTema(primeiro.id).toLowerCase()} (${pct.format(primeiro.percentual)} of songs sung), followed by ${nomeTema(segundo.id).toLowerCase()} and ${nomeTema(terceiro.id).toLowerCase()}.`
        ),
      });
    }

    const poucos = analise.temas.filter((tema) => tema.percentual < TEMA_POUCO_CANTADO);
    if (poucos.length > 0) {
      const lista = poucos.map((tema) => nomeTema(tema.id).toLowerCase()).join(', ');
      frases.push({
        alerta: true,
        texto: tr(
          `Pouco espaço para ${lista}: cada um aparece em menos de ${pct.format(TEMA_POUCO_CANTADO)} do que foi cantado.`,
          `Poco espacio para ${lista}: cada uno aparece en menos del ${pct.format(TEMA_POUCO_CANTADO)} de lo cantado.`,
          `Little room for ${lista}: each appears in under ${pct.format(TEMA_POUCO_CANTADO)} of what was sung.`
        ),
      });
    }

    const { individual, comunitaria } = analise.voz;
    if (individual > comunitaria * 1.5) {
      frases.push({
        texto: tr(
          `A fé cantada é sobretudo pessoal: ${pct.format(individual)} das letras falam em "eu" e "meu", contra ${pct.format(comunitaria)} em "nós".`,
          `La fe cantada es sobre todo personal: ${pct.format(individual)} de las letras hablan en "yo", contra ${pct.format(comunitaria)} en "nosotros".`,
          `The faith being sung is mostly personal: ${pct.format(individual)} of lyrics speak as "I", against ${pct.format(comunitaria)} as "we".`
        ),
      });
    } else if (comunitaria > individual * 1.5) {
      frases.push({
        texto: tr(
          `A igreja canta como comunidade: ${pct.format(comunitaria)} das letras falam em "nós", contra ${pct.format(individual)} em "eu".`,
          `La iglesia canta como comunidad: ${pct.format(comunitaria)} de las letras hablan en "nosotros", contra ${pct.format(individual)} en "yo".`,
          `The church sings as a community: ${pct.format(comunitaria)} of lyrics speak as "we", against ${pct.format(individual)} as "I".`
        ),
      });
    } else {
      frases.push({
        texto: tr(
          'Há equilíbrio entre a voz pessoal ("eu") e a comunitária ("nós") nas letras.',
          'Hay equilibrio entre la voz personal ("yo") y la comunitaria ("nosotros") en las letras.',
          'Lyrics balance the personal voice ("I") and the communal one ("we").'
        ),
      });
    }

    if (analise.direcao.aDeus > analise.direcao.sobreDeus * 1.5) {
      frases.push({
        texto: tr(
          `A maior parte é oração cantada, dirigida a Deus ("Tu", "Te"): ${pct.format(analise.direcao.aDeus)}. Menos letras proclamam sobre Ele.`,
          `La mayor parte es oración cantada, dirigida a Dios ("Tú"): ${pct.format(analise.direcao.aDeus)}. Menos letras proclaman sobre Él.`,
          `Most songs are sung prayer addressed to God ("You"): ${pct.format(analise.direcao.aDeus)}. Fewer lyrics proclaim about Him.`
        ),
      });
    } else if (analise.direcao.sobreDeus > analise.direcao.aDeus * 1.5) {
      frases.push({
        texto: tr(
          `Predomina a proclamação sobre Deus ("Ele", "Seu"): ${pct.format(analise.direcao.sobreDeus)} das letras.`,
          `Predomina la proclamación sobre Dios ("Él", "Su"): ${pct.format(analise.direcao.sobreDeus)} de las letras.`,
          `Proclamation about God ("He", "His") dominates: ${pct.format(analise.direcao.sobreDeus)} of lyrics.`
        ),
      });
    }

    if (analise.trindade.espirito < 0.1) {
      frases.push({
        alerta: true,
        texto: tr(
          `O Espírito Santo é mencionado em apenas ${pct.format(analise.trindade.espirito)} das letras; Cristo aparece em ${pct.format(analise.trindade.filho)}.`,
          `El Espíritu Santo se menciona en solo ${pct.format(analise.trindade.espirito)} de las letras; Cristo aparece en ${pct.format(analise.trindade.filho)}.`,
          `The Holy Spirit is mentioned in only ${pct.format(analise.trindade.espirito)} of lyrics; Christ appears in ${pct.format(analise.trindade.filho)}.`
        ),
      });
    }

    if (analise.resumo.execucoes > 0) {
      frases.push({
        texto: tr(
          `${analise.rodizio.nucleo} músicas respondem por metade de tudo que foi cantado; hinos tradicionais são ${pct.format(analise.resumo.percentualHinos)} do repertório.`,
          `${analise.rodizio.nucleo} canciones suman la mitad de todo lo cantado; los himnos tradicionales son ${pct.format(analise.resumo.percentualHinos)} del repertorio.`,
          `${analise.rodizio.nucleo} songs account for half of everything sung; traditional hymns make up ${pct.format(analise.resumo.percentualHinos)} of the repertoire.`
        ),
      });
    }

    return frases;
  }, [analise, nomeTema, pct, tr]);

  const mensal = useMemo(
    () =>
      (analise?.mensal || []).map((item) => ({
        ...item,
        rotulo: formatarMes(item.mes),
      })),
    [analise?.mensal, formatarMes]
  );

  const maiorPesoPalavra = analise?.vocabulario[0]?.peso || 1;

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-100">
              <Brain className="h-4 w-4 text-emerald-300" />
              {tr('Inteligência do repertório', 'Inteligencia del repertorio', 'Repertoire intelligence')}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {tr('O que a igreja canta, e o que isso diz sobre ela', 'Lo que la iglesia canta y lo que dice de ella', 'What the church sings, and what it says about it')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {tr(
                'Análise das letras de cada música cantada nos cultos. Recalculada a cada culto registrado.',
                'Análisis de las letras de cada canción cantada en los cultos. Se recalcula con cada culto registrado.',
                'Analysis of the lyrics of every song sung in services. Recalculated with every service recorded.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Período', 'Período', 'Period')}>
            {opcoesPeriodo.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                onClick={() => setPeriodo(opcao.id)}
                aria-pressed={periodo === opcao.id}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  periodo === opcao.id
                    ? 'bg-emerald-400 text-slate-950'
                    : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>

        {analise && !carregando ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { rotulo: tr('Cultos', 'Cultos', 'Services'), valor: analise.resumo.cultos },
              { rotulo: tr('Músicas cantadas', 'Canciones cantadas', 'Songs sung'), valor: analise.resumo.execucoes },
              { rotulo: tr('Músicas diferentes', 'Canciones distintas', 'Distinct songs'), valor: analise.resumo.musicasDistintas },
              { rotulo: tr('Hinos tradicionais', 'Himnos tradicionales', 'Traditional hymns'), valor: pct.format(analise.resumo.percentualHinos) },
              { rotulo: tr('Com letra analisada', 'Con letra analizada', 'With lyrics analyzed'), valor: pct.format(analise.resumo.coberturaLetras) },
            ].map((item) => (
              <div key={item.rotulo} className="rounded-2xl bg-white/10 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300">{item.rotulo}</p>
                <p className="mt-2 text-2xl font-semibold">{item.valor}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {analise?.leitura && !carregando ? (
        <LeituraDoCulto
          leitura={analise.leitura}
          tr={tr}
          pct={pct}
          nomeTema={nomeTema}
          formatarData={formatarData}
          formatarDataCurta={formatarDataCurta}
        />
      ) : null}

      {carregando ? (
        <section className="flex min-h-[240px] flex-col items-center justify-center rounded-[28px] border border-white/80 bg-white/90 text-center shadow-sm shadow-slate-200/70">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
          <p className="mt-4 text-sm text-slate-500">{tr('Lendo as letras…', 'Leyendo las letras…', 'Reading the lyrics…')}</p>
        </section>
      ) : erro || !analise ? (
        <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 text-center text-sm text-slate-500 shadow-sm">
          {erro || tr('Sem dados para analisar.', 'Sin datos para analizar.', 'No data to analyze.')}
        </section>
      ) : analise.resumo.execucoesAnalisadas === 0 ? (
        <section className="rounded-[28px] border border-white/80 bg-white/90 p-8 text-center text-sm text-slate-500 shadow-sm">
          {tr(
            'Nenhuma música com letra foi cantada neste período. Escolha um período maior ou cadastre as letras dos cânticos.',
            'Ninguna canción con letra se cantó en este período. Elige un período mayor o registra las letras.',
            'No songs with lyrics were sung in this period. Pick a longer period or add the song lyrics.'
          )}
        </section>
      ) : (
        <>
          <Painel
            title={tr('Perfil da igreja pelo que ela canta', 'Perfil de la iglesia por lo que canta', 'Church profile from what it sings')}
            icon={<Sparkles className="h-5 w-5" />}
          >
            <ul className="space-y-3">
              {perfil.map((frase) => (
                <li
                  key={frase.texto}
                  className={`flex gap-3 rounded-2xl p-4 text-sm leading-6 ${
                    frase.alerta ? 'bg-amber-50 text-amber-950' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  {frase.alerta ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                  {frase.texto}
                </li>
              ))}
            </ul>
            {analise.resumo.coberturaLetras < 0.7 ? (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {tr(
                  `Base: ${analise.resumo.execucoesAnalisadas} de ${analise.resumo.execucoes} músicas cantadas têm letra ou assunto cadastrado. Quanto mais letras, mais fiel o retrato.`,
                  `Base: ${analise.resumo.execucoesAnalisadas} de ${analise.resumo.execucoes} canciones cantadas tienen letra o tema registrado. Cuantas más letras, más fiel el retrato.`,
                  `Based on ${analise.resumo.execucoesAnalisadas} of ${analise.resumo.execucoes} songs sung that have lyrics or a subject. More lyrics, truer picture.`
                )}
              </p>
            ) : null}
          </Painel>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Painel
              title={tr('Temas do repertório', 'Temas del repertorio', 'Repertoire themes')}
              description={tr(
                'Parte das músicas cantadas que toca cada tema. Uma música pode tocar vários.',
                'Parte de las canciones cantadas que toca cada tema. Una canción puede tocar varios.',
                'Share of songs sung that touch each theme. A song can touch several.'
              )}
              icon={<Compass className="h-5 w-5" />}
            >
              <ul className="space-y-3.5">
                {analise.temas.map((tema) => {
                  const pouco = tema.percentual < TEMA_POUCO_CANTADO;
                  return (
                    <li key={tema.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className={`font-medium ${pouco ? 'text-amber-800' : 'text-slate-800'}`}>{nomeTema(tema.id)}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{pct.format(tema.percentual)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${pouco ? 'bg-amber-400' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(tema.percentual * 100, 1)}%` }}
                        />
                      </div>
                      {tema.exemplos.length > 0 ? (
                        <p className="mt-1 truncate text-xs text-slate-400">{tema.exemplos.join(' · ')}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Painel>

            <div className="flex flex-col gap-6">
              <Painel
                title={tr('A quem se canta', 'A quién se canta', 'Who is sung about')}
                description={tr('Músicas que mencionam cada pessoa da Trindade.', 'Canciones que mencionan a cada persona de la Trinidad.', 'Songs mentioning each person of the Trinity.')}
                icon={<MessageCircleHeart className="h-5 w-5" />}
              >
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { rotulo: tr('Pai', 'Padre', 'Father'), valor: analise.trindade.pai },
                    { rotulo: tr('Filho', 'Hijo', 'Son'), valor: analise.trindade.filho },
                    { rotulo: tr('Espírito', 'Espíritu', 'Spirit'), valor: analise.trindade.espirito },
                  ].map((pessoa) => (
                    <div key={pessoa.rotulo} className="rounded-2xl bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-semibold tabular-nums text-slate-900">{pct.format(pessoa.valor)}</p>
                      <p className="mt-1 text-sm text-slate-500">{pessoa.rotulo}</p>
                    </div>
                  ))}
                </div>
              </Painel>

              <Painel
                title={tr('A voz das letras', 'La voz de las letras', 'The voice of the lyrics')}
                icon={<BookOpenText className="h-5 w-5" />}
              >
                <p className="mb-2 text-sm font-medium text-slate-700">{tr('Quem canta', 'Quién canta', 'Who sings')}</p>
                <BarraDividida
                  partes={[
                    { rotulo: tr('"Eu"', '"Yo"', '"I"'), valor: analise.voz.individual, cor: 'bg-violet-500', texto: pct.format(analise.voz.individual) },
                    { rotulo: tr('Equilibrado', 'Equilibrado', 'Balanced'), valor: analise.voz.equilibrada, cor: 'bg-slate-300', texto: pct.format(analise.voz.equilibrada) },
                    { rotulo: tr('"Nós"', '"Nosotros"', '"We"'), valor: analise.voz.comunitaria, cor: 'bg-sky-500', texto: pct.format(analise.voz.comunitaria) },
                  ]}
                />
                <p className="mb-2 mt-5 text-sm font-medium text-slate-700">{tr('Como fala de Deus', 'Cómo habla de Dios', 'How it speaks of God')}</p>
                <BarraDividida
                  partes={[
                    { rotulo: tr('A Deus ("Tu")', 'A Dios ("Tú")', 'To God ("You")'), valor: analise.direcao.aDeus, cor: 'bg-emerald-500', texto: pct.format(analise.direcao.aDeus) },
                    { rotulo: tr('Misto', 'Mixto', 'Mixed'), valor: analise.direcao.misto, cor: 'bg-slate-300', texto: pct.format(analise.direcao.misto) },
                    { rotulo: tr('Sobre Deus ("Ele")', 'Sobre Dios ("Él")', 'About God ("He")'), valor: analise.direcao.sobreDeus, cor: 'bg-amber-500', texto: pct.format(analise.direcao.sobreDeus) },
                  ]}
                />
              </Painel>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Painel
              title={tr('Palavras que a igreja mais canta', 'Palabras que la iglesia más canta', 'Words the church sings most')}
              icon={<ListMusic className="h-5 w-5" />}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                {analise.vocabulario.map((item) => {
                  const peso = item.peso / maiorPesoPalavra;
                  return (
                    <span
                      key={item.palavra}
                      title={tr(`${item.peso} músicas`, `${item.peso} canciones`, `${item.peso} songs`)}
                      className="font-semibold leading-tight text-emerald-900"
                      style={{ fontSize: `${0.8 + peso * 1.1}rem`, opacity: 0.45 + peso * 0.55 }}
                    >
                      {item.palavra}
                    </span>
                  );
                })}
              </div>
            </Painel>

            <Painel
              title={tr('Hinos e cânticos ao longo do tempo', 'Himnos y cánticos a lo largo del tiempo', 'Hymns and songs over time')}
              icon={<CalendarClock className="h-5 w-5" />}
            >
              {mensal.length === 0 ? (
                <p className="text-sm text-slate-500">{tr('Sem músicas no período.', 'Sin canciones en el período.', 'No songs in this period.')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={mensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="hinos" name={tr('Hinos', 'Himnos', 'Hymns')} stackId="a" fill="#0f766e" />
                    <Bar dataKey="canticos" name={tr('Cânticos', 'Cánticos', 'Songs')} stackId="a" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Painel>
          </section>

          <section className={`grid gap-6 ${periodo === 'tudo' ? 'xl:grid-cols-2' : 'xl:grid-cols-3'}`}>
            <Painel
              title={tr('Rodízio', 'Rotación', 'Rotation')}
              description={tr(
                `As 10 mais cantadas somam ${pct.format(analise.rodizio.top10)} do total; ${analise.rodizio.cantadasUmaVez} músicas foram cantadas uma única vez.`,
                `Las 10 más cantadas suman ${pct.format(analise.rodizio.top10)} del total; ${analise.rodizio.cantadasUmaVez} canciones se cantaron una sola vez.`,
                `The top 10 make up ${pct.format(analise.rodizio.top10)} of the total; ${analise.rodizio.cantadasUmaVez} songs were sung only once.`
              )}
              icon={<ListMusic className="h-5 w-5" />}
            >
              <ol className="space-y-2">
                {analise.rodizio.maisCantadas.map((musica, indice) => (
                  <li key={musica.nome} className="flex items-center gap-3 text-sm">
                    <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">{indice + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{musica.nome}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{musica.vezes}×</span>
                  </li>
                ))}
              </ol>
            </Painel>

            {periodo === 'tudo' ? null : (
            <Painel
              title={tr('Novas no repertório', 'Nuevas en el repertorio', 'New to the repertoire')}
              description={tr(
                `${analise.totalNovas} músicas cantadas pela primeira vez neste período.`,
                `${analise.totalNovas} canciones cantadas por primera vez en este período.`,
                `${analise.totalNovas} songs sung for the first time in this period.`
              )}
              icon={<Sparkles className="h-5 w-5" />}
            >
              {analise.novas.length === 0 ? (
                <p className="text-sm text-slate-500">{tr('Nenhuma música nova.', 'Ninguna canción nueva.', 'No new songs.')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {analise.novas.map((musica) => (
                    <li key={musica.nome} className="text-sm">
                      <p className="truncate font-medium text-slate-800">{musica.nome}</p>
                      <p className="text-xs text-slate-500">
                        {formatarData(musica.primeiraData)} · {musica.vezes}×
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Painel>
            )}

            <Painel
              title={tr('Esquecidas', 'Olvidadas', 'Forgotten')}
              description={tr(
                'Cantadas 3 vezes ou mais, mas não nos últimos 6 meses.',
                'Cantadas 3 veces o más, pero no en los últimos 6 meses.',
                'Sung 3 times or more, but not in the last 6 months.'
              )}
              icon={<History className="h-5 w-5" />}
            >
              {analise.esquecidas.length === 0 ? (
                <p className="text-sm text-slate-500">{tr('Nenhuma música esquecida.', 'Ninguna canción olvidada.', 'No forgotten songs.')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {analise.esquecidas.map((musica) => (
                    <li key={musica.nome} className="text-sm">
                      <p className="truncate font-medium text-slate-800">{musica.nome}</p>
                      <p className="text-xs text-slate-500">
                        {tr('Última vez', 'Última vez', 'Last sung')} {formatarData(musica.ultimaData)} · {musica.vezes}×
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Painel>
          </section>

          {analise.sugestoes.length > 0 || analise.semLetra.length > 0 ? (
            <section className="grid gap-6 xl:grid-cols-2">
              {analise.sugestoes.length > 0 ? (
                <Painel
                  title={tr('Sugestões para equilibrar', 'Sugerencias para equilibrar', 'Suggestions to rebalance')}
                  description={tr(
                    'Hinos do Novo Cântico, ainda não cantados pela igreja, nos temas menos presentes.',
                    'Himnos del Novo Cântico, aún no cantados por la iglesia, en los temas menos presentes.',
                    'Novo Cântico hymns the church has not sung yet, for the least present themes.'
                  )}
                  icon={<Lightbulb className="h-5 w-5" />}
                >
                  <div className="space-y-4">
                    {analise.sugestoes.map((sugestao) => (
                      <div key={sugestao.tema}>
                        <p className="text-sm font-semibold text-slate-900">
                          {nomeTema(sugestao.tema)}{' '}
                          <span className="font-normal text-amber-700">({pct.format(sugestao.percentual)})</span>
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {sugestao.hinos.map((hino) => (
                            <li key={hino.nome} className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="truncate text-slate-700">{hino.nome}</span>
                              {hino.assunto ? <span className="shrink-0 text-xs text-slate-400">{hino.assunto}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Painel>
              ) : null}

              {analise.semLetra.length > 0 ? (
                <Painel
                  title={tr('Cadastre estas letras', 'Registra estas letras', 'Add these lyrics')}
                  description={tr(
                    'As músicas mais cantadas do período sem letra cadastrada. Com a letra, elas passam a entrar na análise.',
                    'Las canciones más cantadas del período sin letra registrada. Con la letra, entran en el análisis.',
                    'The most sung songs of the period without lyrics. Once added, they join the analysis.'
                  )}
                  icon={<TriangleAlert className="h-5 w-5" />}
                >
                  <ul className="space-y-2">
                    {analise.semLetra.map((musica) => (
                      <li key={musica.nome} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-slate-800">{musica.nome}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">{musica.vezes}×</span>
                      </li>
                    ))}
                  </ul>
                </Painel>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function LeituraDoCulto({
  leitura,
  tr,
  pct,
  nomeTema,
  formatarData,
  formatarDataCurta,
}: {
  leitura: LeituraCulto;
  tr: (pt: string, es: string, en: string) => string;
  pct: Intl.NumberFormat;
  nomeTema: (id: TemaId) => string;
  formatarData: (data: string) => string;
  formatarDataCurta: (data: string) => string;
}) {
  const futuro = leitura.culto.data > new Date().toISOString().slice(0, 10);
  const estreias = leitura.musicas.filter((musica) => musica.estreia).length;
  const retornos = leitura.musicas.filter((musica) => musica.voltouApos).length;
  const evolucao = leitura.evolucao.map((ponto) => ({ ...ponto, rotulo: formatarDataCurta(ponto.data) }));
  const listaTemas = (ids: TemaId[]) => ids.map((id) => nomeTema(id).toLowerCase()).join(', ');

  const pendentes = leitura.cultosSemMusica;
  const avisoSemMusica =
    pendentes.length === 0
      ? null
      : pendentes.length === 1
        ? tr(
            `O culto de ${formatarDataCurta(pendentes[0])} ainda está sem músicas. A leitura será refeita assim que elas forem lançadas.`,
            `El culto del ${formatarDataCurta(pendentes[0])} aún no tiene canciones. La lectura se rehará en cuanto se registren.`,
            `The ${formatarDataCurta(pendentes[0])} service has no songs yet. The reading will be redone once they are added.`
          )
        : tr(
            `${pendentes.length} cultos depois deste (de ${formatarDataCurta(pendentes[0])} a ${formatarDataCurta(pendentes[pendentes.length - 1])}) ainda estão sem músicas. A leitura será refeita assim que elas forem lançadas.`,
            `${pendentes.length} cultos posteriores (del ${formatarDataCurta(pendentes[0])} al ${formatarDataCurta(pendentes[pendentes.length - 1])}) aún no tienen canciones. La lectura se rehará en cuanto se registren.`,
            `${pendentes.length} later services (${formatarDataCurta(pendentes[0])} to ${formatarDataCurta(pendentes[pendentes.length - 1])}) have no songs yet. The reading will be redone once they are added.`
          );

  const frases = [
    tr(
      `${leitura.musicas.length} músicas${estreias ? `, ${estreias} cantada${estreias > 1 ? 's' : ''} pela primeira vez` : ''}${retornos ? `, ${retornos} de volta depois de meses` : ''}.`,
      `${leitura.musicas.length} canciones${estreias ? `, ${estreias} cantada${estreias > 1 ? 's' : ''} por primera vez` : ''}${retornos ? `, ${retornos} de vuelta tras meses` : ''}.`,
      `${leitura.musicas.length} songs${estreias ? `, ${estreias} sung for the first time` : ''}${retornos ? `, ${retornos} back after months` : ''}.`
    ),
  ];
  if (leitura.lacunasAtendidas.length > 0) {
    const lista = listaTemas(leitura.lacunasAtendidas);
    frases.push(
      tr(
        `Trouxe temas que andavam pouco cantados: ${lista}.`,
        `Trajo temas poco cantados: ${lista}.`,
        `Brought in themes that had been rarely sung: ${lista}.`
      )
    );
  }
  if (leitura.anterior && leitura.mudancas.length === 0) {
    frases.push(
      tr(
        'O perfil dos últimos 12 meses ficou estável com este culto.',
        'El perfil de los últimos 12 meses se mantuvo estable con este culto.',
        'The 12-month profile stayed steady with this service.'
      )
    );
  }

  return (
    <Painel
      title={tr(
        `Leitura do culto de ${formatarData(leitura.culto.data)}`,
        `Lectura del culto del ${formatarData(leitura.culto.data)}`,
        `Reading of the ${formatarData(leitura.culto.data)} service`
      )}
      description={
        leitura.anterior
          ? tr(
              `O último culto com músicas, comparado com o de ${formatarData(leitura.anterior.data)}. Refeita a cada novo culto com músicas.`,
              `El último culto con canciones, comparado con el del ${formatarData(leitura.anterior.data)}. Se rehace con cada nuevo culto con canciones.`,
              `The latest service with songs, compared with ${formatarData(leitura.anterior.data)}. Redone with every new service that has songs.`
            )
          : tr('O primeiro culto com músicas.', 'El primer culto con canciones.', 'The first service with songs.')
      }
      icon={<Music2 className="h-5 w-5" />}
      className="border-emerald-100"
    >
      {futuro ? (
        <span className="mb-4 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
          {tr('Culto ainda vai acontecer', 'Culto aún por realizarse', 'Upcoming service')}
        </span>
      ) : null}

      {leitura.cultosSemMusica.length > 0 ? (
        <p className="mb-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
          {avisoSemMusica}
        </p>
      ) : null}

      <ul className="mb-5 space-y-1.5">
        {frases.map((frase) => (
          <li key={frase} className="flex gap-2 text-sm leading-6 text-slate-700">
            <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
            {frase}
          </li>
        ))}
      </ul>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className="space-y-2.5">
          {leitura.musicas.map((musica, indice) => (
            <li key={`${musica.nome}-${indice}`} className="rounded-2xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-slate-900">{musica.nome}</span>
                {musica.estreia ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {tr('Estreia', 'Estreno', 'Debut')}
                  </span>
                ) : null}
                {musica.voltouApos ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                    {tr(
                      `Voltou após ${Math.round(musica.voltouApos / 30)} meses`,
                      `Volvió tras ${Math.round(musica.voltouApos / 30)} meses`,
                      `Back after ${Math.round(musica.voltouApos / 30)} months`
                    )}
                  </span>
                ) : null}
                {musica.semLetra ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {tr('Sem letra', 'Sin letra', 'No lyrics')}
                  </span>
                ) : null}
              </div>
              {musica.temas.length > 0 ? (
                <p className="mt-1 text-xs text-slate-500">{musica.temas.map(nomeTema).join(' · ')}</p>
              ) : null}
            </li>
          ))}
        </ul>

        <div>
          {leitura.mudancas.length > 0 ? (
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium text-slate-700">
                {tr('O que mudou no perfil', 'Qué cambió en el perfil', 'What changed in the profile')}
              </p>
              <ul className="space-y-1.5">
                {leitura.mudancas.map((mudanca) => {
                  const subiu = mudanca.depois > mudanca.antes;
                  return (
                    <li key={mudanca.tema} className="flex items-center gap-2 text-sm">
                      {subiu ? (
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-500" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-slate-800">{nomeTema(mudanca.tema)}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {pct.format(mudanca.antes)} → <span className="font-semibold text-slate-900">{pct.format(mudanca.depois)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {evolucao.length > 1 ? (
            <>
              <p className="mb-2 text-sm font-medium text-slate-700">
                {tr(
                  'Temas que mais oscilaram nos últimos cultos',
                  'Temas que más oscilaron en los últimos cultos',
                  'Themes that moved most in recent services'
                )}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(valor: number) => pct.format(valor)} tick={{ fontSize: 11 }} width={44} />
                  <Tooltip
                    formatter={(valor) => pct.format(Number(valor))}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {leitura.temasEvolucao.map((tema, indice) => (
                    <Line
                      key={tema}
                      type="monotone"
                      dataKey={tema}
                      name={nomeTema(tema)}
                      stroke={CORES_EVOLUCAO[indice % CORES_EVOLUCAO.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : null}
        </div>
      </div>
    </Painel>
  );
}
