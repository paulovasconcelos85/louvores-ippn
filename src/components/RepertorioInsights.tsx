'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, FileDown, Loader2 } from 'lucide-react';
import { useLocale } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/config';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage } from '@/lib/api-feedback';
import type { TemaId } from '@/lib/repertorio-analise';
import {
  TEMA_POUCO_CANTADO,
  criarContextoTexto,
  montarFrasesLeitura,
  montarPerfil,
  nomeTema as nomeTemaLocalizado,
  rotuloPeriodo,
  type AnaliseRepertorio,
  type Frase,
  type LeituraCulto,
} from '@/lib/repertorio-perfil';

function Cartao({
  titulo,
  descricao,
  children,
  className = '',
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:p-6 ${className}`}>
      <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
      {descricao ? <p className="mt-1 text-sm leading-6 text-slate-500">{descricao}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ListaFrases({ frases, tamanho = 'text-sm' }: { frases: Frase[]; tamanho?: string }) {
  return (
    <ul className="space-y-2.5">
      {frases.map((frase) => (
        <li key={frase.texto} className={`flex gap-3 leading-7 ${tamanho} ${frase.alerta ? 'text-amber-900' : 'text-slate-700'}`}>
          <span
            className={`mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full ${frase.alerta ? 'bg-amber-500' : 'bg-emerald-500'}`}
            aria-hidden
          />
          {frase.texto}
        </li>
      ))}
    </ul>
  );
}

function BarraDividida({ partes }: { partes: Array<{ rotulo: string; valor: number; cor: string }> }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {partes.map((parte) => (
          <div key={parte.rotulo} className={parte.cor} style={{ width: `${parte.valor * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {partes.map((parte) => (
          <span key={parte.rotulo} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <span className={`h-2 w-2 rounded-full ${parte.cor}`} />
            {parte.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

function ListaMusicas({
  itens,
  vazio,
  numerada = false,
}: {
  itens: Array<{ nome: string; detalhe: string }>;
  vazio: string;
  numerada?: boolean;
}) {
  if (itens.length === 0) return <p className="text-sm text-slate-400">{vazio}</p>;
  return (
    <ol className="space-y-2">
      {itens.map((item, indice) => (
        <li key={`${item.nome}-${indice}`} className="flex items-baseline gap-3 text-sm">
          {numerada ? <span className="w-4 shrink-0 text-right tabular-nums text-slate-400">{indice + 1}</span> : null}
          <span className="min-w-0 flex-1 truncate text-slate-800">{item.nome}</span>
          <span className="shrink-0 tabular-nums text-slate-500">{item.detalhe}</span>
        </li>
      ))}
    </ol>
  );
}

export default function RepertorioInsights({
  igrejaId,
  igrejaNome,
  igrejaSigla,
}: {
  igrejaId: string;
  igrejaNome: string;
  igrejaSigla?: string | null;
}) {
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
  const [gerandoPdf, setGerandoPdf] = useState(false);
  // Muda quando a aba volta ao foco: quem lançou as músicas do culto em outra aba
  // encontra a leitura já refeita ao voltar.
  const [versao, setVersao] = useState(0);
  const recargaSilenciosa = useRef(false);

  const ctx = useMemo(() => criarContextoTexto(locale, intlLocale), [intlLocale, locale]);
  const { pct } = ctx;
  const nomeTema = useCallback((id: TemaId) => nomeTemaLocalizado(id, locale), [locale]);
  const formatarData = useMemo(() => {
    const formatador = new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'long', year: 'numeric' });
    return (data: string) => formatador.format(new Date(`${data}T00:00:00`));
  }, [intlLocale]);

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

  const baixarPdf = async () => {
    if (!analise) return;
    setGerandoPdf(true);
    try {
      // Carregado só no clique: o jspdf é pesado e a maioria das visitas não gera PDF.
      const { gerarRelatorioRepertorioPdf } = await import('@/lib/repertorio-pdf');
      gerarRelatorioRepertorioPdf(analise, { locale, intlLocale, igrejaNome, igrejaSigla });
    } finally {
      setGerandoPdf(false);
    }
  };

  const opcoesPeriodo = ['90d', '180d', '365d', ...anos.map((ano) => `ano-${ano}`), 'tudo'];
  const perfil = analise ? montarPerfil(analise, ctx) : [];
  const temDados = Boolean(analise && analise.resumo.execucoesAnalisadas > 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {tr('O que a igreja canta', 'Lo que la iglesia canta', 'What the church sings')}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {tr(
              'Análise das letras das músicas dos cultos, refeita a cada culto com músicas.',
              'Análisis de las letras de las canciones de los cultos, rehecho con cada culto con canciones.',
              'Analysis of the lyrics sung in services, redone with every service that has songs.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodo}
            onChange={(event) => setPeriodo(event.target.value)}
            aria-label={tr('Período', 'Período', 'Period')}
            className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-emerald-500"
          >
            {opcoesPeriodo.map((opcao) => (
              <option key={opcao} value={opcao}>
                {rotuloPeriodo(opcao, locale)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void baixarPdf()}
            disabled={!analise || carregando || gerandoPdf}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {tr('Baixar PDF', 'Descargar PDF', 'Download PDF')}
          </button>
        </div>
      </section>

      {carregando ? (
        <section className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white text-center shadow-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
          <p className="mt-4 text-sm text-slate-500">{tr('Lendo as letras…', 'Leyendo las letras…', 'Reading the lyrics…')}</p>
        </section>
      ) : erro || !analise ? (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          {erro || tr('Sem dados para analisar.', 'Sin datos para analizar.', 'No data to analyze.')}
        </section>
      ) : (
        <>
          <Cartao titulo={tr('Em resumo', 'En resumen', 'In short')}>
            {temDados ? (
              <ListaFrases frases={perfil} tamanho="text-base" />
            ) : (
              <p className="text-sm text-slate-500">
                {tr(
                  'Nenhuma música com letra foi cantada neste período. Escolha um período maior.',
                  'Ninguna canción con letra se cantó en este período. Elige un período mayor.',
                  'No songs with lyrics were sung in this period. Pick a longer period.'
                )}
              </p>
            )}
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-5">
              {[
                { rotulo: tr('Cultos', 'Cultos', 'Services'), valor: analise.resumo.cultos },
                { rotulo: tr('Músicas cantadas', 'Canciones cantadas', 'Songs sung'), valor: analise.resumo.execucoes },
                { rotulo: tr('Músicas diferentes', 'Canciones distintas', 'Distinct songs'), valor: analise.resumo.musicasDistintas },
                { rotulo: tr('Hinos tradicionais', 'Himnos tradicionales', 'Traditional hymns'), valor: pct.format(analise.resumo.percentualHinos) },
                { rotulo: tr('Com letra analisada', 'Con letra analizada', 'Lyrics analyzed'), valor: pct.format(analise.resumo.coberturaLetras) },
              ].map((item) => (
                <div key={item.rotulo}>
                  <dt className="text-xs text-slate-500">{item.rotulo}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{item.valor}</dd>
                </div>
              ))}
            </dl>
            {temDados && analise.resumo.coberturaLetras < 0.7 ? (
              <p className="mt-4 text-xs leading-5 text-slate-400">
                {tr(
                  `Base: ${analise.resumo.execucoesAnalisadas} de ${analise.resumo.execucoes} músicas cantadas têm letra ou assunto cadastrado. Quanto mais letras, mais fiel o retrato.`,
                  `Base: ${analise.resumo.execucoesAnalisadas} de ${analise.resumo.execucoes} canciones tienen letra o tema registrado. Cuantas más letras, más fiel el retrato.`,
                  `Based on ${analise.resumo.execucoesAnalisadas} of ${analise.resumo.execucoes} songs with lyrics or a subject. More lyrics, truer picture.`
                )}
              </p>
            ) : null}
          </Cartao>

          <div className="grid gap-6 xl:grid-cols-2">
            {analise.leitura ? (
              <UltimoCulto leitura={analise.leitura} tr={tr} ctx={ctx} nomeTema={nomeTema} formatarData={formatarData} />
            ) : null}

            {temDados ? (
              <Cartao
                titulo={tr('Temas', 'Temas', 'Themes')}
                descricao={tr(
                  'Parte das músicas cantadas que toca cada tema.',
                  'Parte de las canciones cantadas que toca cada tema.',
                  'Share of songs sung that touch each theme.'
                )}
              >
                <ul className="space-y-3">
                  {analise.temas.map((tema) => {
                    const pouco = tema.percentual < TEMA_POUCO_CANTADO;
                    return (
                      <li key={tema.id} title={tema.exemplos.join(' · ')}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className={pouco ? 'text-amber-800' : 'text-slate-700'}>{nomeTema(tema.id)}</span>
                          <span className="font-semibold tabular-nums text-slate-900">{pct.format(tema.percentual)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${pouco ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(tema.percentual * 100, 1)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Cartao>
            ) : null}
          </div>

          {temDados ? (
            <>
              <Cartao titulo={tr('Como a igreja canta', 'Cómo canta la iglesia', 'How the church sings')}>
                <div className="grid gap-6 md:grid-cols-3">
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">
                      {tr('Quem aparece nas letras', 'Quién aparece en las letras', 'Who appears in the lyrics')}
                    </p>
                    <dl className="grid grid-cols-3 gap-2">
                      {[
                        { rotulo: tr('Pai', 'Padre', 'Father'), valor: analise.trindade.pai },
                        { rotulo: tr('Filho', 'Hijo', 'Son'), valor: analise.trindade.filho },
                        { rotulo: tr('Espírito', 'Espíritu', 'Spirit'), valor: analise.trindade.espirito },
                      ].map((pessoa) => (
                        <div key={pessoa.rotulo} className="rounded-2xl bg-slate-50 p-3 text-center">
                          <dd className="text-xl font-semibold tabular-nums text-slate-900">{pct.format(pessoa.valor)}</dd>
                          <dt className="mt-0.5 text-xs text-slate-500">{pessoa.rotulo}</dt>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">{tr('Quem canta', 'Quién canta', 'Who sings')}</p>
                    <BarraDividida
                      partes={[
                        { rotulo: `"${tr('eu', 'yo', 'I')}" ${pct.format(analise.voz.individual)}`, valor: analise.voz.individual, cor: 'bg-violet-500' },
                        { rotulo: `${tr('misto', 'mixto', 'mixed')} ${pct.format(analise.voz.equilibrada)}`, valor: analise.voz.equilibrada, cor: 'bg-slate-300' },
                        { rotulo: `"${tr('nós', 'nosotros', 'we')}" ${pct.format(analise.voz.comunitaria)}`, valor: analise.voz.comunitaria, cor: 'bg-sky-500' },
                      ]}
                    />
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">{tr('Como fala de Deus', 'Cómo habla de Dios', 'How it speaks of God')}</p>
                    <BarraDividida
                      partes={[
                        { rotulo: `${tr('a Deus', 'a Dios', 'to God')} ${pct.format(analise.direcao.aDeus)}`, valor: analise.direcao.aDeus, cor: 'bg-emerald-500' },
                        { rotulo: `${tr('misto', 'mixto', 'mixed')} ${pct.format(analise.direcao.misto)}`, valor: analise.direcao.misto, cor: 'bg-slate-300' },
                        { rotulo: `${tr('sobre Deus', 'sobre Dios', 'about God')} ${pct.format(analise.direcao.sobreDeus)}`, valor: analise.direcao.sobreDeus, cor: 'bg-amber-500' },
                      ]}
                    />
                  </div>
                </div>
              </Cartao>

              <Cartao
                titulo={tr('Rodízio', 'Rotación', 'Rotation')}
                descricao={tr(
                  `As 10 mais cantadas somam ${pct.format(analise.rodizio.top10)} do total; ${analise.rodizio.cantadasUmaVez} músicas foram cantadas uma única vez.`,
                  `Las 10 más cantadas suman ${pct.format(analise.rodizio.top10)} del total; ${analise.rodizio.cantadasUmaVez} canciones se cantaron una sola vez.`,
                  `The top 10 make up ${pct.format(analise.rodizio.top10)} of the total; ${analise.rodizio.cantadasUmaVez} songs were sung only once.`
                )}
              >
                <div className={`grid gap-8 ${periodo === 'tudo' ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">{tr('Mais cantadas', 'Más cantadas', 'Most sung')}</p>
                    <ListaMusicas
                      numerada
                      itens={analise.rodizio.maisCantadas.map((musica) => ({ nome: musica.nome, detalhe: `${musica.vezes}×` }))}
                      vazio={tr('Nenhuma música.', 'Ninguna canción.', 'No songs.')}
                    />
                  </div>
                  {periodo === 'tudo' ? null : (
                    <div>
                      <p className="mb-3 text-sm font-medium text-slate-700">
                        {tr(`Novas (${analise.totalNovas})`, `Nuevas (${analise.totalNovas})`, `New (${analise.totalNovas})`)}
                      </p>
                      <ListaMusicas
                        itens={analise.novas.map((musica) => ({ nome: musica.nome, detalhe: ctx.formatarDataCurta(musica.primeiraData) }))}
                        vazio={tr('Nenhuma música nova.', 'Ninguna canción nueva.', 'No new songs.')}
                      />
                    </div>
                  )}
                  <div>
                    <p className="mb-3 text-sm font-medium text-slate-700">{tr('Esquecidas', 'Olvidadas', 'Forgotten')}</p>
                    <ListaMusicas
                      itens={analise.esquecidas.map((musica) => ({ nome: musica.nome, detalhe: ctx.formatarDataCurta(musica.ultimaData) }))}
                      vazio={tr('Nenhuma música esquecida.', 'Ninguna canción olvidada.', 'No forgotten songs.')}
                    />
                    <p className="mt-3 text-xs leading-5 text-slate-400">
                      {tr(
                        'Cantadas 3 vezes ou mais, mas não nos últimos 6 meses.',
                        'Cantadas 3 veces o más, pero no en los últimos 6 meses.',
                        'Sung 3+ times, but not in the last 6 months.'
                      )}
                    </p>
                  </div>
                </div>
              </Cartao>

              {analise.sugestoes.length > 0 || analise.semLetra.length > 0 ? (
                <Cartao titulo={tr('Próximos passos', 'Próximos pasos', 'Next steps')}>
                  <div className="grid gap-8 md:grid-cols-2">
                    {analise.sugestoes.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {tr('Hinos para equilibrar', 'Himnos para equilibrar', 'Hymns to rebalance')}
                        </p>
                        <p className="mb-3 mt-0.5 text-xs leading-5 text-slate-400">
                          {tr(
                            'Do Novo Cântico, ainda não cantados, nos temas com pouco espaço.',
                            'Del Novo Cântico, aún no cantados, en los temas con poco espacio.',
                            'From Novo Cântico, not yet sung, for themes with little room.'
                          )}
                        </p>
                        <div className="space-y-4">
                          {analise.sugestoes.map((sugestao) => (
                            <div key={sugestao.tema}>
                              <p className="mb-1.5 text-sm text-amber-800">
                                {nomeTema(sugestao.tema)} · {pct.format(sugestao.percentual)}
                              </p>
                              <ListaMusicas
                                itens={sugestao.hinos.map((hino) => ({ nome: hino.nome, detalhe: hino.assunto || '' }))}
                                vazio=""
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {analise.semLetra.length > 0 ? (
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {tr('Cadastrar estas letras', 'Registrar estas letras', 'Add these lyrics')}
                        </p>
                        <p className="mb-3 mt-0.5 text-xs leading-5 text-slate-400">
                          {tr(
                            'As mais cantadas do período ainda sem letra. Com a letra, entram na análise.',
                            'Las más cantadas del período aún sin letra. Con la letra, entran en el análisis.',
                            'Most sung songs of the period without lyrics. Once added, they join the analysis.'
                          )}
                        </p>
                        <ListaMusicas
                          itens={analise.semLetra.map((musica) => ({ nome: musica.nome, detalhe: `${musica.vezes}×` }))}
                          vazio=""
                        />
                      </div>
                    ) : null}
                  </div>
                </Cartao>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function UltimoCulto({
  leitura,
  tr,
  ctx,
  nomeTema,
  formatarData,
}: {
  leitura: LeituraCulto;
  tr: (pt: string, es: string, en: string) => string;
  ctx: ReturnType<typeof criarContextoTexto>;
  nomeTema: (id: TemaId) => string;
  formatarData: (data: string) => string;
}) {
  const { pct } = ctx;
  const futuro = leitura.culto.data > new Date().toISOString().slice(0, 10);

  return (
    <Cartao
      titulo={tr(
        `Último culto: ${formatarData(leitura.culto.data)}`,
        `Último culto: ${formatarData(leitura.culto.data)}`,
        `Latest service: ${formatarData(leitura.culto.data)}`
      )}
      descricao={
        futuro
          ? tr('Culto já montado, ainda vai acontecer.', 'Culto ya preparado, aún por realizarse.', 'Service already set up, still upcoming.')
          : leitura.anterior
            ? tr(
                `Comparado com o culto de ${ctx.formatarDataCurta(leitura.anterior.data)}.`,
                `Comparado con el culto del ${ctx.formatarDataCurta(leitura.anterior.data)}.`,
                `Compared with the ${ctx.formatarDataCurta(leitura.anterior.data)} service.`
              )
            : undefined
      }
    >
      <ListaFrases frases={montarFrasesLeitura(leitura, ctx)} />

      <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {leitura.musicas.map((musica, indice) => (
          <li key={`${musica.nome}-${indice}`} className="py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm text-slate-800">{musica.nome}</span>
              {musica.estreia ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {tr('estreia', 'estreno', 'debut')}
                </span>
              ) : null}
              {musica.voltouApos ? (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                  {tr(
                    `voltou após ${Math.round(musica.voltouApos / 30)} meses`,
                    `volvió tras ${Math.round(musica.voltouApos / 30)} meses`,
                    `back after ${Math.round(musica.voltouApos / 30)} months`
                  )}
                </span>
              ) : null}
              {musica.semLetra ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {tr('sem letra', 'sin letra', 'no lyrics')}
                </span>
              ) : null}
            </div>
            {musica.temas.length > 0 ? (
              <p className="mt-0.5 text-xs text-slate-400">{musica.temas.map(nomeTema).join(' · ')}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {leitura.mudancas.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-700">{tr('O que mudou no perfil', 'Qué cambió en el perfil', 'What changed in the profile')}</p>
          <ul className="space-y-1.5">
            {leitura.mudancas.map((mudanca) => (
              <li key={mudanca.tema} className="flex items-center gap-2 text-sm">
                {mudanca.depois > mudanca.antes ? (
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span className="min-w-0 flex-1 truncate text-slate-700">{nomeTema(mudanca.tema)}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {pct.format(mudanca.antes)} → <span className="font-semibold text-slate-900">{pct.format(mudanca.depois)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Cartao>
  );
}
