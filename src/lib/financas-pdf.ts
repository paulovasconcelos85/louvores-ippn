import { jsPDF } from 'jspdf';
import { GRUPOS_DESPESA, GRUPOS_IPB, GRUPOS_RECEITA } from '@/lib/financas';
import type { ResumoFinanceiro } from '@/lib/financas-resumo';

// PDFs da tesouraria. Valores chegam em centavos; `moeda` formata.

const COR_TITULO: [number, number, number] = [16, 60, 48];
const COR_TEXTO: [number, number, number] = [30, 41, 59];
const COR_SUAVE: [number, number, number] = [100, 116, 139];
const COR_LINHA: [number, number, number] = [226, 232, 240];
const MARGEM = 16;

interface OpcoesPdf {
  igrejaNome: string;
  moeda: (centavos: number) => string;
}

function criarDocumento(titulo: string, subtitulo: string, opts: OpcoesPdf) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = MARGEM;

  const fonte = (tamanho: number, estilo: 'normal' | 'bold' = 'normal', cor = COR_TEXTO) => {
    doc.setFont('helvetica', estilo);
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
  };

  const espaco = (altura: number) => {
    if (y + altura > ph - MARGEM - 10) {
      doc.addPage();
      y = MARGEM;
    }
  };

  const secao = (texto: string) => {
    espaco(14);
    y += 3;
    fonte(11.5, 'bold', COR_TITULO);
    doc.text(texto, MARGEM, y);
    y += 2;
    doc.setDrawColor(...COR_LINHA);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, y, pw - MARGEM, y);
    y += 5;
  };

  /** Linha "rótulo ........ valor"; `destaque` deixa em negrito. */
  const linha = (rotulo: string, valor: string, destaque = false, recuo = 0) => {
    espaco(6);
    fonte(9.5, destaque ? 'bold' : 'normal');
    const linhas = doc.splitTextToSize(rotulo, pw - MARGEM * 2 - recuo - 42) as string[];
    doc.text(linhas, MARGEM + recuo, y);
    doc.text(valor, pw - MARGEM, y, { align: 'right' });
    y += 5 * linhas.length;
  };

  const paragrafo = (texto: string, tamanho = 9, cor = COR_SUAVE) => {
    fonte(tamanho, 'normal', cor);
    const linhas = doc.splitTextToSize(texto, pw - MARGEM * 2) as string[];
    espaco(linhas.length * 4.5);
    doc.text(linhas, MARGEM, y);
    y += linhas.length * 4.5 + 1;
  };

  const assinaturas = (nomes: string[]) => {
    espaco(30);
    y += 18;
    const largura = (pw - MARGEM * 2) / nomes.length;
    nomes.forEach((nome, i) => {
      const x = MARGEM + largura * i;
      doc.setDrawColor(...COR_SUAVE);
      doc.line(x + 6, y, x + largura - 6, y);
      fonte(8.5, 'normal', COR_SUAVE);
      doc.text(nome, x + largura / 2, y + 4.5, { align: 'center' });
    });
    y += 10;
  };

  // Cabeçalho
  fonte(15, 'bold', COR_TITULO);
  doc.text(opts.igrejaNome, MARGEM, y + 2);
  y += 9;
  fonte(12, 'bold');
  doc.text(titulo, MARGEM, y);
  y += 5.5;
  fonte(9.5, 'normal', COR_SUAVE);
  doc.text(subtitulo, MARGEM, y);
  y += 7;

  const rodape = () => {
    const total = doc.getNumberOfPages();
    const emitido = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    for (let i = 1; i <= total; i += 1) {
      doc.setPage(i);
      fonte(7.5, 'normal', COR_SUAVE);
      doc.text(`Emitido pelo OIKOS Hub em ${emitido}`, MARGEM, ph - 8);
      doc.text(`${i}/${total}`, pw - MARGEM, ph - 8, { align: 'right' });
    }
  };

  return { doc, secao, linha, paragrafo, assinaturas, rodape };
}

function dataBr(iso: string) {
  return iso.split('-').reverse().join('/');
}

/** Balancete do período: o documento que vai à Comissão de Exame de Contas. */
export function gerarBalancetePdf(resumo: ResumoFinanceiro, periodoNome: string, opts: OpcoesPdf) {
  const { moeda } = opts;
  const pdf = criarDocumento('Balancete da Tesouraria', `${periodoNome} — ${dataBr(resumo.inicio)} a ${dataBr(resumo.fim)}`, opts);

  pdf.secao('Saldo anterior');
  resumo.contas.forEach((conta) => pdf.linha(conta.nome, moeda(conta.saldoAnterior), false, 4));
  pdf.linha('Total', moeda(resumo.saldoAnterior), true);

  pdf.secao('Receitas');
  for (const grupo of GRUPOS_RECEITA) {
    const itens = resumo.categorias.filter((c) => c.grupo === grupo && c.total > 0);
    if (itens.length === 0) continue;
    pdf.linha(GRUPOS_IPB[grupo].nome, moeda(resumo.grupos[grupo]), true);
    itens.forEach((c) => pdf.linha(c.nome, moeda(c.total), false, 4));
  }
  pdf.linha('Total das receitas', moeda(resumo.totalReceitas), true);

  pdf.secao('Despesas');
  for (const grupo of GRUPOS_DESPESA) {
    const itens = resumo.categorias.filter((c) => c.grupo === grupo && c.total > 0);
    if (itens.length === 0) continue;
    pdf.linha(GRUPOS_IPB[grupo].nome, moeda(resumo.grupos[grupo]), true);
    itens.forEach((c) => pdf.linha(c.nome, moeda(c.total), false, 4));
  }
  pdf.linha('Total das despesas', moeda(resumo.totalDespesas), true);

  pdf.secao('Saldo para o período seguinte');
  resumo.contas.forEach((conta) => pdf.linha(conta.nome, moeda(conta.saldoFinal), false, 4));
  pdf.linha('Total', moeda(resumo.saldoFinal), true);
  pdf.paragrafo(
    `Conferência: saldo anterior ${moeda(resumo.saldoAnterior)} + receitas ${moeda(resumo.totalReceitas)} - despesas ${moeda(resumo.totalDespesas)} = ${moeda(resumo.saldoFinal)}.`
  );

  pdf.secao('Dízimo ao Supremo Concílio no período');
  pdf.linha('Devido (10% dos dízimos e ofertas)', moeda(resumo.dizimoScDevido));
  pdf.linha('Repassado', moeda(resumo.dizimoScPago));
  pdf.linha('Diferença', moeda(resumo.dizimoScDevido - resumo.dizimoScPago), true);

  pdf.assinaturas(['Tesoureiro', 'Comissão de Exame de Contas', 'Presidente do Conselho']);
  pdf.rodape();
  return pdf.doc;
}

export interface RelatorioAnual {
  ano: number;
  resumo: ResumoFinanceiro;
  meses: Array<{ mes: number; dizimosOfertas: number; dizimoScDevido: number; dizimoScPago: number }>;
  orcamento: Record<string, number>;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Seção IV do relatório estatístico da IPB, com o dízimo ao SC e o orçamento. */
export function gerarRelatorioIpbPdf(dados: RelatorioAnual, opts: OpcoesPdf) {
  const { moeda } = opts;
  const { resumo } = dados;
  const pdf = criarDocumento(
    `Movimento financeiro de ${dados.ano}`,
    'Relatório estatístico da IPB — IV. Informações financeiras',
    opts
  );

  pdf.linha('Saldo anterior', moeda(resumo.saldoAnterior), true);

  pdf.secao('Receitas');
  GRUPOS_RECEITA.forEach((grupo) => pdf.linha(GRUPOS_IPB[grupo].nome, moeda(resumo.grupos[grupo])));
  pdf.linha('Total da receita anual', moeda(resumo.totalReceitas), true);
  pdf.linha('Grande total (receita + saldo anterior)', moeda(resumo.totalReceitas + resumo.saldoAnterior), true);

  pdf.secao('Despesas');
  GRUPOS_DESPESA.forEach((grupo) => pdf.linha(GRUPOS_IPB[grupo].nome, moeda(resumo.grupos[grupo])));
  pdf.linha('Total da despesa anual', moeda(resumo.totalDespesas), true);
  pdf.linha('Saldo para o ano seguinte', moeda(resumo.saldoFinal), true);
  pdf.linha('Grande total (despesa + saldo)', moeda(resumo.totalDespesas + resumo.saldoFinal), true);

  pdf.secao('Dízimo ao Supremo Concílio, mês a mês');
  pdf.paragrafo('10% dos dízimos e ofertas, sem contar as ofertas específicas.');
  dados.meses.forEach((mes) => {
    pdf.linha(
      `${MESES[mes.mes - 1]} — base ${moeda(mes.dizimosOfertas)} · devido ${moeda(mes.dizimoScDevido)}`,
      `repassado ${moeda(mes.dizimoScPago)}`,
      false,
      4
    );
  });
  pdf.linha('Total devido no ano', moeda(resumo.dizimoScDevido), true);
  pdf.linha('Total repassado no ano', moeda(resumo.dizimoScPago), true);

  const temOrcamento = Object.values(dados.orcamento).some((v) => v > 0);
  if (temOrcamento) {
    pdf.secao('Orçamento: previsto x realizado');
    for (const categoria of resumo.categorias) {
      const previsto = dados.orcamento[categoria.id] || 0;
      if (!previsto && !categoria.total) continue;
      pdf.linha(`${categoria.nome} (${categoria.tipo === 'receita' ? 'receita' : 'despesa'})`, `${moeda(previsto)} / ${moeda(categoria.total)}`, false, 4);
    }
  }

  pdf.assinaturas(['Tesoureiro', 'Secretário do Conselho']);
  pdf.rodape();
  return pdf.doc;
}

/** Declaração anual de contribuições de uma pessoa (útil para o IR). */
export function gerarDeclaracaoContribuicoesPdf(
  dados: { pessoa: string; ano: number; itens: Array<{ data: string; valor: number; categoria: string }>; total: number },
  opts: OpcoesPdf
) {
  const { moeda } = opts;
  const pdf = criarDocumento(`Declaração de contribuições — ${dados.ano}`, dados.pessoa, opts);

  pdf.paragrafo(
    `Declaramos, para os devidos fins, que ${dados.pessoa} contribuiu com esta igreja, no ano de ${dados.ano}, com o total de ${moeda(dados.total)}, conforme os lançamentos abaixo registrados na tesouraria.`,
    10,
    COR_TEXTO
  );
  pdf.secao('Lançamentos');
  dados.itens.forEach((item) => pdf.linha(`${dataBr(item.data)} — ${item.categoria}`, moeda(item.valor), false, 4));
  pdf.linha('Total', moeda(dados.total), true);

  pdf.assinaturas(['Tesoureiro', 'Pastor']);
  pdf.rodape();
  return pdf.doc;
}
