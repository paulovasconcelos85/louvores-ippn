import { jsPDF } from 'jspdf';
import type { Locale } from '@/i18n/config';
import {
  TEMA_POUCO_CANTADO,
  criarContextoTexto,
  montarFrasesLeitura,
  montarPerfil,
  nomeTema,
  rotuloPeriodo,
  traduzir,
  type AnaliseRepertorio,
  type Frase,
} from '@/lib/repertorio-perfil';

export interface GerarRelatorioRepertorioOpts {
  locale: Locale;
  intlLocale: string;
  igrejaNome: string;
  igrejaSigla?: string | null;
}

const COR_HEADER: [number, number, number] = [16, 60, 48];
const COR_TITULO: [number, number, number] = [16, 60, 48];
const COR_TEXTO: [number, number, number] = [30, 41, 59];
const COR_SUAVE: [number, number, number] = [100, 116, 139];
const COR_LINHA: [number, number, number] = [226, 232, 240];
const COR_BARRA: [number, number, number] = [16, 185, 129];
const COR_BARRA_FRACA: [number, number, number] = [251, 191, 36];
const COR_ALERTA: [number, number, number] = [180, 83, 9];

const MARGEM = 16;
const RODAPE = 14;

// Relatório do repertório para enviar ao pastor: o mesmo conteúdo da aba
// Repertório das estatísticas, em formato de leitura.
export function gerarRelatorioRepertorioPdf(analise: AnaliseRepertorio, opts: GerarRelatorioRepertorioOpts) {
  const { locale, intlLocale } = opts;
  const tr = (pt: string, es: string, en: string) => traduzir(locale, pt, es, en);
  const ctx = criarContextoTexto(locale, intlLocale);
  const { pct } = ctx;
  const dataLonga = new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'long', year: 'numeric' });
  const formatarData = (data: string) => dataLonga.format(new Date(`${data}T00:00:00`));

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const larguraUtil = pw - MARGEM * 2;
  let y = 0;

  const garantirEspaco = (altura: number) => {
    if (y + altura > ph - MARGEM - RODAPE) {
      doc.addPage();
      y = MARGEM;
    }
  };

  const fonte = (tamanho: number, estilo: 'normal' | 'bold' = 'normal', cor = COR_TEXTO) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  };

  const titulo = (texto: string) => {
    garantirEspaco(16);
    y += 4;
    fonte(12.5, 'bold', COR_TITULO);
    doc.text(texto, MARGEM, y);
    y += 2.2;
    doc.setDrawColor(...COR_LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, y, pw - MARGEM, y);
    y += 5.5;
  };

  const subtitulo = (texto: string) => {
    garantirEspaco(9);
    fonte(10, 'bold');
    doc.text(texto, MARGEM, y);
    y += 5;
  };

  const paragrafo = (texto: string, cor = COR_TEXTO, recuo = 0, tamanho = 10) => {
    fonte(tamanho, 'normal', cor);
    const linhas = doc.splitTextToSize(texto, larguraUtil - recuo) as string[];
    const alturaLinha = tamanho * 0.48;
    garantirEspaco(linhas.length * alturaLinha + 1);
    doc.text(linhas, MARGEM + recuo, y);
    y += linhas.length * alturaLinha + 1.5;
  };

  const marcador = (frase: Frase) => {
    const cor = frase.alerta ? COR_ALERTA : COR_TEXTO;
    fonte(10, 'normal', cor);
    const linhas = doc.splitTextToSize(frase.texto, larguraUtil - 5) as string[];
    garantirEspaco(linhas.length * 4.8 + 1.5);
    doc.setFillColor(...(frase.alerta ? COR_ALERTA : COR_BARRA));
    doc.circle(MARGEM + 1.2, y - 1.2, 0.8, 'F');
    doc.text(linhas, MARGEM + 5, y);
    y += linhas.length * 4.8 + 1.8;
  };

  const lista = (itens: Array<{ texto: string; detalhe?: string }>, numerada = false) => {
    itens.forEach((item, indice) => {
      garantirEspaco(5.5);
      fonte(9.5);
      const prefixo = numerada ? `${indice + 1}.` : '-';
      doc.text(prefixo, MARGEM + 1, y);
      const larguraDetalhe = item.detalhe ? doc.getTextWidth(item.detalhe) + 4 : 0;
      const texto = doc.splitTextToSize(item.texto, larguraUtil - 8 - larguraDetalhe)[0] as string;
      doc.text(texto, MARGEM + 7, y);
      if (item.detalhe) {
        fonte(9, 'normal', COR_SUAVE);
        doc.text(item.detalhe, pw - MARGEM, y, { align: 'right' });
      }
      y += 5;
    });
    y += 1.5;
  };

  // ── Cabeçalho ──────────────────────────────────────────────────────────
  const alturaCabecalho = 30;
  doc.setFillColor(...COR_HEADER);
  doc.rect(0, 0, pw, alturaCabecalho, 'F');
  fonte(17, 'bold', [255, 255, 255]);
  doc.text(tr('Relatório do repertório', 'Informe del repertorio', 'Repertoire report'), MARGEM, 13);
  fonte(10.5, 'normal', [209, 250, 229]);
  doc.text(opts.igrejaNome, MARGEM, 20.5);
  fonte(9, 'normal', [209, 250, 229]);
  doc.text(rotuloPeriodo(analise.periodo.id, locale), pw - MARGEM, 13, { align: 'right' });
  doc.text(
    `${tr('Gerado em', 'Generado el', 'Generated on')} ${dataLonga.format(new Date())}`,
    pw - MARGEM,
    20.5,
    { align: 'right' }
  );
  y = alturaCabecalho + 10;

  // ── Números ────────────────────────────────────────────────────────────
  const numeros = [
    { valor: String(analise.resumo.cultos), rotulo: tr('cultos', 'cultos', 'services') },
    { valor: String(analise.resumo.execucoes), rotulo: tr('músicas cantadas', 'canciones cantadas', 'songs sung') },
    { valor: String(analise.resumo.musicasDistintas), rotulo: tr('músicas diferentes', 'canciones distintas', 'distinct songs') },
    { valor: pct.format(analise.resumo.percentualHinos), rotulo: tr('hinos tradicionais', 'himnos tradicionales', 'traditional hymns') },
    { valor: pct.format(analise.resumo.coberturaLetras), rotulo: tr('com letra analisada', 'con letra analizada', 'lyrics analyzed') },
  ];
  const larguraCaixa = larguraUtil / numeros.length;
  numeros.forEach((numero, indice) => {
    const x = MARGEM + indice * larguraCaixa;
    fonte(16, 'bold');
    doc.text(numero.valor, x, y);
    fonte(8, 'normal', COR_SUAVE);
    doc.text(numero.rotulo, x, y + 4.5);
  });
  y += 10;

  // ── Em resumo ──────────────────────────────────────────────────────────
  titulo(tr('Em resumo', 'En resumen', 'In short'));
  const perfil = montarPerfil(analise, ctx);
  if (perfil.length === 0) {
    paragrafo(
      tr(
        'Nenhuma música com letra foi cantada neste período.',
        'Ninguna canción con letra se cantó en este período.',
        'No songs with lyrics were sung in this period.'
      ),
      COR_SUAVE
    );
  }
  perfil.forEach(marcador);
  if (analise.resumo.coberturaLetras < 0.7 && analise.resumo.execucoes > 0) {
    paragrafo(
      tr(
        `Base: ${analise.resumo.execucoesAnalisadas} de ${analise.resumo.execucoes} músicas cantadas têm letra ou assunto cadastrado. Quanto mais letras, mais fiel o retrato.`,
        `Base: ${analise.resumo.execucoesAnalisadas} de ${analise.resumo.execucoes} canciones tienen letra o tema registrado. Cuantas más letras, más fiel el retrato.`,
        `Based on ${analise.resumo.execucoesAnalisadas} of ${analise.resumo.execucoes} songs with lyrics or a subject. More lyrics, truer picture.`
      ),
      COR_SUAVE,
      0,
      8.5
    );
  }

  // ── Último culto ───────────────────────────────────────────────────────
  const leitura = analise.leitura;
  if (leitura) {
    titulo(
      tr(
        `Último culto com músicas: ${formatarData(leitura.culto.data)}`,
        `Último culto con canciones: ${formatarData(leitura.culto.data)}`,
        `Latest service with songs: ${formatarData(leitura.culto.data)}`
      )
    );
    montarFrasesLeitura(leitura, ctx).forEach(marcador);
    y += 1;
    lista(
      leitura.musicas.map((musica) => {
        const marcas = [
          musica.estreia ? tr('estreia', 'estreno', 'debut') : null,
          musica.voltouApos
            ? tr(
                `voltou após ${Math.round(musica.voltouApos / 30)} meses`,
                `volvió tras ${Math.round(musica.voltouApos / 30)} meses`,
                `back after ${Math.round(musica.voltouApos / 30)} months`
              )
            : null,
          musica.semLetra ? tr('sem letra', 'sin letra', 'no lyrics') : null,
        ].filter(Boolean);
        return {
          texto: musica.nome,
          detalhe: [musica.temas.map((tema) => nomeTema(tema, locale)).slice(0, 2).join(', '), ...marcas]
            .filter(Boolean)
            .join(' · '),
        };
      })
    );
    if (leitura.mudancas.length > 0) {
      subtitulo(tr('O que mudou no perfil', 'Qué cambió en el perfil', 'What changed in the profile'));
      lista(
        leitura.mudancas.map((mudanca) => ({
          texto: nomeTema(mudanca.tema, locale),
          detalhe: tr(
            `de ${pct.format(mudanca.antes)} para ${pct.format(mudanca.depois)}`,
            `de ${pct.format(mudanca.antes)} a ${pct.format(mudanca.depois)}`,
            `from ${pct.format(mudanca.antes)} to ${pct.format(mudanca.depois)}`
          ),
        }))
      );
    }
  }

  if (analise.resumo.execucoesAnalisadas > 0) {
    // ── Temas ────────────────────────────────────────────────────────────
    titulo(tr('Temas do repertório', 'Temas del repertorio', 'Repertoire themes'));
    paragrafo(
      tr(
        'Parte das músicas cantadas que toca cada tema. Uma música pode tocar vários. Em amarelo, os temas com pouco espaço.',
        'Parte de las canciones cantadas que toca cada tema. Una canción puede tocar varios. En amarillo, los temas con poco espacio.',
        'Share of songs sung that touch each theme. A song can touch several. In yellow, themes with little room.'
      ),
      COR_SUAVE,
      0,
      8.5
    );
    const larguraRotulo = 58;
    const larguraBarra = larguraUtil - larguraRotulo - 14;
    analise.temas.forEach((tema) => {
      garantirEspaco(6.5);
      fonte(9.5);
      doc.text(nomeTema(tema.id, locale), MARGEM, y);
      const xBarra = MARGEM + larguraRotulo;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(xBarra, y - 2.8, larguraBarra, 3.2, 1.2, 1.2, 'F');
      doc.setFillColor(...(tema.percentual < TEMA_POUCO_CANTADO ? COR_BARRA_FRACA : COR_BARRA));
      doc.roundedRect(xBarra, y - 2.8, Math.max(larguraBarra * tema.percentual, 1), 3.2, 1.2, 1.2, 'F');
      fonte(9.5, 'bold');
      doc.text(pct.format(tema.percentual), pw - MARGEM, y, { align: 'right' });
      y += 6.2;
    });

    // ── Como a igreja canta ──────────────────────────────────────────────
    titulo(tr('Como a igreja canta', 'Cómo canta la iglesia', 'How the church sings'));
    const linhasComo = [
      {
        rotulo: tr('Trindade nas letras', 'Trinidad en las letras', 'Trinity in the lyrics'),
        valor: tr(
          `Pai ${pct.format(analise.trindade.pai)} · Filho ${pct.format(analise.trindade.filho)} · Espírito ${pct.format(analise.trindade.espirito)}`,
          `Padre ${pct.format(analise.trindade.pai)} · Hijo ${pct.format(analise.trindade.filho)} · Espíritu ${pct.format(analise.trindade.espirito)}`,
          `Father ${pct.format(analise.trindade.pai)} · Son ${pct.format(analise.trindade.filho)} · Spirit ${pct.format(analise.trindade.espirito)}`
        ),
      },
      {
        rotulo: tr('Quem canta', 'Quién canta', 'Who sings'),
        valor: tr(
          `"eu" ${pct.format(analise.voz.individual)} · "nós" ${pct.format(analise.voz.comunitaria)} · equilibrado ${pct.format(analise.voz.equilibrada)}`,
          `"yo" ${pct.format(analise.voz.individual)} · "nosotros" ${pct.format(analise.voz.comunitaria)} · equilibrado ${pct.format(analise.voz.equilibrada)}`,
          `"I" ${pct.format(analise.voz.individual)} · "we" ${pct.format(analise.voz.comunitaria)} · balanced ${pct.format(analise.voz.equilibrada)}`
        ),
      },
      {
        rotulo: tr('Como fala de Deus', 'Cómo habla de Dios', 'How it speaks of God'),
        valor: tr(
          `a Deus ${pct.format(analise.direcao.aDeus)} · sobre Deus ${pct.format(analise.direcao.sobreDeus)} · misto ${pct.format(analise.direcao.misto)}`,
          `a Dios ${pct.format(analise.direcao.aDeus)} · sobre Dios ${pct.format(analise.direcao.sobreDeus)} · mixto ${pct.format(analise.direcao.misto)}`,
          `to God ${pct.format(analise.direcao.aDeus)} · about God ${pct.format(analise.direcao.sobreDeus)} · mixed ${pct.format(analise.direcao.misto)}`
        ),
      },
    ];
    linhasComo.forEach((linha) => {
      garantirEspaco(6);
      fonte(9.5, 'bold');
      doc.text(linha.rotulo, MARGEM, y);
      fonte(9.5);
      doc.text(linha.valor, MARGEM + 46, y);
      y += 6;
    });
  }

  // ── Rodízio ────────────────────────────────────────────────────────────
  if (analise.rodizio.maisCantadas.length > 0) {
    titulo(tr('Rodízio', 'Rotación', 'Rotation'));
    paragrafo(
      tr(
        `As 10 mais cantadas somam ${pct.format(analise.rodizio.top10)} do total; ${analise.rodizio.cantadasUmaVez} músicas foram cantadas uma única vez.`,
        `Las 10 más cantadas suman ${pct.format(analise.rodizio.top10)} del total; ${analise.rodizio.cantadasUmaVez} canciones se cantaron una sola vez.`,
        `The top 10 make up ${pct.format(analise.rodizio.top10)} of the total; ${analise.rodizio.cantadasUmaVez} songs were sung only once.`
      ),
      COR_SUAVE,
      0,
      9
    );
    subtitulo(tr('Mais cantadas', 'Más cantadas', 'Most sung'));
    lista(analise.rodizio.maisCantadas.map((musica) => ({ texto: musica.nome, detalhe: `${musica.vezes}x` })), true);

    if (analise.periodo.id !== 'tudo' && analise.novas.length > 0) {
      subtitulo(
        tr(
          `Novas no repertório (${analise.totalNovas})`,
          `Nuevas en el repertorio (${analise.totalNovas})`,
          `New to the repertoire (${analise.totalNovas})`
        )
      );
      lista(analise.novas.map((musica) => ({ texto: musica.nome, detalhe: ctx.formatarDataCurta(musica.primeiraData) })));
    }

    if (analise.esquecidas.length > 0) {
      subtitulo(
        tr(
          'Esquecidas (cantadas 3+ vezes, mas não nos últimos 6 meses)',
          'Olvidadas (cantadas 3+ veces, pero no en los últimos 6 meses)',
          'Forgotten (sung 3+ times, but not in the last 6 months)'
        )
      );
      lista(
        analise.esquecidas.map((musica) => ({
          texto: musica.nome,
          detalhe: `${tr('última', 'última', 'last')} ${ctx.formatarDataCurta(musica.ultimaData)}`,
        }))
      );
    }
  }

  // ── Próximos passos ────────────────────────────────────────────────────
  if (analise.sugestoes.length > 0 || analise.semLetra.length > 0) {
    titulo(tr('Próximos passos', 'Próximos pasos', 'Next steps'));
    if (analise.sugestoes.length > 0) {
      subtitulo(
        tr(
          'Hinos do Novo Cântico ainda não cantados, nos temas com pouco espaço',
          'Himnos del Novo Cântico aún no cantados, en los temas con poco espacio',
          'Novo Cântico hymns not yet sung, for themes with little room'
        )
      );
      analise.sugestoes.forEach((sugestao) => {
        // O tema e os seus hinos ficam juntos na mesma página.
        garantirEspaco(6 + sugestao.hinos.length * 5);
        fonte(9.5, 'bold', COR_ALERTA);
        doc.text(`${nomeTema(sugestao.tema, locale)} (${pct.format(sugestao.percentual)})`, MARGEM + 1, y);
        y += 5;
        lista(sugestao.hinos.map((hino) => ({ texto: hino.nome, detalhe: hino.assunto || undefined })));
      });
    }
    if (analise.semLetra.length > 0) {
      subtitulo(
        tr(
          'Cadastrar a letra destas músicas (as mais cantadas sem letra)',
          'Registrar la letra de estas canciones (las más cantadas sin letra)',
          'Add lyrics for these songs (most sung without lyrics)'
        )
      );
      lista(analise.semLetra.map((musica) => ({ texto: musica.nome, detalhe: `${musica.vezes}x` })));
    }
  }

  // ── Rodapé em todas as páginas ─────────────────────────────────────────
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    fonte(8, 'normal', COR_SUAVE);
    doc.text(
      `OIKOS Hub · ${tr('Relatório do repertório', 'Informe del repertorio', 'Repertoire report')} · ${opts.igrejaNome}`,
      MARGEM,
      ph - 8
    );
    doc.text(`${pagina} / ${totalPaginas}`, pw - MARGEM, ph - 8, { align: 'right' });
  }

  const sufixo = (opts.igrejaSigla || 'igreja').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`repertorio-${sufixo}-${analise.periodo.id}.pdf`);
}
