'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { GRUPOS_DESPESA, GRUPOS_IPB, GRUPOS_RECEITA, intervaloDoPeriodo, nomeDoPeriodo } from '@/lib/financas';
import type { ResumoFinanceiro } from '@/lib/financas-resumo';
import type { RelatorioAnual } from '@/lib/financas-pdf';
import PessoaPicker from './PessoaPicker';
import { botaoPrimario, botaoSecundario, finApi, inputClass, labelClass, type ContextoFinancas } from './api';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function RelatoriosTab({
  igrejaId,
  contexto,
  moeda,
}: {
  igrejaId: string;
  contexto: ContextoFinancas;
  moeda: (centavos: number) => string;
}) {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [anual, setAnual] = useState<RelatorioAnual | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const igrejaNome = contexto.igreja?.nome || 'Igreja';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await finApi<Omit<RelatorioAnual, 'ano'>>(`relatorios?igreja_id=${encodeURIComponent(igrejaId)}&tipo=anual&ano=${ano}`);
      setAnual({ ...data, ano });
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [igrejaId, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const baixarBalancete = async (periodo: number) => {
    try {
      const { inicio, fim } = intervaloDoPeriodo(ano, periodo);
      const data = await finApi<{ resumo: ResumoFinanceiro }>(
        `relatorios?igreja_id=${encodeURIComponent(igrejaId)}&tipo=periodo&inicio=${inicio}&fim=${fim}`
      );
      const { gerarBalancetePdf } = await import('@/lib/financas-pdf');
      gerarBalancetePdf(data.resumo, `${nomeDoPeriodo(periodo)} de ${ano}`, { igrejaNome, moeda }).save(
        `balancete-${ano}-${periodo === 0 ? 'exercicio' : `t${periodo}`}.pdf`
      );
    } catch (error: any) {
      alert(error.message);
    }
  };

  const baixarRelatorioIpb = async () => {
    if (!anual) return;
    const { gerarRelatorioIpbPdf } = await import('@/lib/financas-pdf');
    gerarRelatorioIpbPdf(anual, { igrejaNome, moeda }).save(`relatorio-financeiro-ipb-${ano}.pdf`);
  };

  const resumo = anual?.resumo;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={labelClass}>Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className={inputClass}>
            {Array.from({ length: 6 }, (_, i) => anoAtual - i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">Balancetes</h3>
        <p className="mt-1 text-sm text-slate-600">
          O tesoureiro entrega à Comissão de Exame de Contas um balancete a cada três meses e outro no fim do exercício (modelo de estatuto
          da IPB, art. 11).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 0].map((periodo) => (
            <button key={periodo} type="button" onClick={() => baixarBalancete(periodo)} className={botaoSecundario}>
              <Download className="h-4 w-4" />
              {nomeDoPeriodo(periodo)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Relatório estatístico da IPB — informações financeiras</h3>
            <p className="mt-1 text-sm text-slate-600">
              A seção IV do relatório que o Conselho envia ao Presbitério, já somada pelos grupos que a IPB pede.
            </p>
          </div>
          <button type="button" onClick={baixarRelatorioIpb} disabled={!anual} className={botaoPrimario}>
            <FileText className="h-4 w-4" />
            Baixar PDF
          </button>
        </div>

        {erro && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

        {carregando || !resumo ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-1 text-sm">
              <Linha rotulo="Saldo anterior" valor={moeda(resumo.saldoAnterior)} forte />
              <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Receitas</p>
              {GRUPOS_RECEITA.map((g) => (
                <Linha key={g} rotulo={GRUPOS_IPB[g].nome} valor={moeda(resumo.grupos[g])} dica={GRUPOS_IPB[g].explicacao} />
              ))}
              <Linha rotulo="Total da receita anual" valor={moeda(resumo.totalReceitas)} forte />
              <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Despesas</p>
              {GRUPOS_DESPESA.map((g) => (
                <Linha key={g} rotulo={GRUPOS_IPB[g].nome} valor={moeda(resumo.grupos[g])} dica={GRUPOS_IPB[g].explicacao} />
              ))}
              <Linha rotulo="Total da despesa anual" valor={moeda(resumo.totalDespesas)} forte />
              <Linha rotulo="Saldo para o ano seguinte" valor={moeda(resumo.saldoFinal)} forte />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dízimo ao Supremo Concílio</p>
              <p className="mt-1 text-xs text-slate-500">10% dos dízimos e ofertas; ofertas específicas não entram.</p>
              <table className="mt-3 w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 font-medium">Mês</th>
                    <th className="py-1 text-right font-medium">Devido</th>
                    <th className="py-1 text-right font-medium">Repassado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {anual!.meses.map((m) => {
                    const falta = m.dizimoScDevido - m.dizimoScPago;
                    return (
                      <tr key={m.mes}>
                        <td className="py-1.5 text-slate-700">{MESES[m.mes - 1]}</td>
                        <td className="py-1.5 text-right text-slate-700">{moeda(m.dizimoScDevido)}</td>
                        <td className={`py-1.5 text-right ${falta > 0 && m.dizimoScDevido > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                          {moeda(m.dizimoScPago)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="font-semibold">
                    <td className="py-2">Ano</td>
                    <td className="py-2 text-right">{moeda(resumo.dizimoScDevido)}</td>
                    <td className="py-2 text-right">{moeda(resumo.dizimoScPago)}</td>
                  </tr>
                </tbody>
              </table>
              {resumo.dizimoScDevido > resumo.dizimoScPago && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Falta repassar {moeda(resumo.dizimoScDevido - resumo.dizimoScPago)} ao Supremo Concílio. O repasse é lançado como saída na
                  categoria “Dízimo ao Supremo Concílio”.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {contexto.permissoes.podeVerNomes && <DeclaracaoContribuicoes igrejaId={igrejaId} ano={ano} igrejaNome={igrejaNome} moeda={moeda} />}
    </div>
  );
}

function Linha({ rotulo, valor, forte, dica }: { rotulo: string; valor: string; forte?: boolean; dica?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 ${forte ? 'font-semibold text-slate-900' : 'text-slate-700'}`} title={dica}>
      <span>{rotulo}</span>
      <span className="shrink-0 tabular-nums">{valor}</span>
    </div>
  );
}

function DeclaracaoContribuicoes({
  igrejaId,
  ano,
  igrejaNome,
  moeda,
}: {
  igrejaId: string;
  ano: number;
  igrejaNome: string;
  moeda: (centavos: number) => string;
}) {
  const [pessoa, setPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [gerando, setGerando] = useState(false);

  const gerar = async () => {
    if (!pessoa) return;
    setGerando(true);
    try {
      const data = await finApi<{ pessoa: string; itens: Array<{ data: string; valor: number; categoria: string }>; total: number }>(
        `relatorios?igreja_id=${encodeURIComponent(igrejaId)}&tipo=contribuinte&ano=${ano}&pessoa_id=${encodeURIComponent(pessoa.id)}`
      );
      if (data.itens.length === 0) {
        alert(`Nenhuma contribuição nominal de ${data.pessoa} em ${ano}.`);
        return;
      }
      const { gerarDeclaracaoContribuicoesPdf } = await import('@/lib/financas-pdf');
      gerarDeclaracaoContribuicoesPdf({ ...data, ano }, { igrejaNome, moeda }).save(`contribuicoes-${ano}.pdf`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setGerando(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">Declaração de contribuições</h3>
      <p className="mt-1 text-sm text-slate-600">
        Para o membro que pede comprovante do que contribuiu no ano (por exemplo, para o Imposto de Renda). Só a tesouraria e o pastor
        geram.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <PessoaPicker igrejaId={igrejaId} valor={pessoa} onChange={setPessoa} />
        </div>
        <button type="button" onClick={gerar} disabled={!pessoa || gerando} className={botaoPrimario}>
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Gerar declaração de {ano}
        </button>
      </div>
    </section>
  );
}
