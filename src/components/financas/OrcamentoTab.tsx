'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { lerValorDigitado } from '@/lib/financas';
import type { ResumoFinanceiro } from '@/lib/financas-resumo';
import { botaoPrimario, finApi, inputClass, labelClass, type ContextoFinancas } from './api';

// Orçamento anual por categoria: previsto (votado pelo Conselho) x realizado.
export default function OrcamentoTab({
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
  const [realizado, setRealizado] = useState<Map<string, number>>(new Map());
  const [previsto, setPrevisto] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const podeEditar = contexto.permissoes.podeConfigurar;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setMensagem('');
    try {
      const data = await finApi<{ resumo: ResumoFinanceiro; orcamento: Record<string, number> }>(
        `relatorios?igreja_id=${encodeURIComponent(igrejaId)}&tipo=anual&ano=${ano}`
      );
      setRealizado(new Map(data.resumo.categorias.map((c) => [c.id, c.total])));
      setPrevisto(
        Object.fromEntries(Object.entries(data.orcamento).map(([id, v]) => [id, (v / 100).toFixed(2).replace('.', ',')]))
      );
    } catch (error: any) {
      setMensagem(error.message);
    } finally {
      setCarregando(false);
    }
  }, [igrejaId, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async () => {
    setSalvando(true);
    setMensagem('');
    try {
      const valores = Object.fromEntries(contexto.categorias.map((c) => [c.id, lerValorDigitado(previsto[c.id] || '') / 100]));
      await finApi('orcamento', { method: 'PUT', json: { igreja_id: igrejaId, ano, valores } });
      setMensagem('Orçamento salvo.');
    } catch (error: any) {
      setMensagem(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const grupos = useMemo(
    () => [
      { titulo: 'Receitas', itens: contexto.categorias.filter((c) => c.tipo === 'receita') },
      { titulo: 'Despesas', itens: contexto.categorias.filter((c) => c.tipo === 'despesa') },
    ],
    [contexto.categorias]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={labelClass}>Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className={inputClass}>
            {[anoAtual + 1, anoAtual, anoAtual - 1, anoAtual - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {podeEditar && (
          <button type="button" onClick={salvar} disabled={salvando || carregando} className={`${botaoPrimario} ml-auto`}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar orçamento
          </button>
        )}
      </div>

      <p className="text-sm text-slate-600">
        O orçamento é votado pelo Conselho e apresentado à assembleia, que toma conhecimento dele (CI/IPB, art. 9º). Uma boa base é o
        realizado do ano anterior com os reajustes que o Conselho decidir.
      </p>

      {mensagem && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">{mensagem}</p>}

      {carregando ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        grupos.map((grupo) => {
          const totalPrevisto = grupo.itens.reduce((s, c) => s + lerValorDigitado(previsto[c.id] || ''), 0);
          const totalRealizado = grupo.itens.reduce((s, c) => s + (realizado.get(c.id) || 0), 0);
          return (
            <section key={grupo.titulo} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{grupo.titulo}</th>
                    <th className="w-40 px-4 py-2.5 text-right font-semibold">Previsto</th>
                    <th className="w-36 px-4 py-2.5 text-right font-semibold">Realizado</th>
                    <th className="hidden w-20 px-4 py-2.5 text-right font-semibold sm:table-cell">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {grupo.itens.map((c) => {
                    const prev = lerValorDigitado(previsto[c.id] || '');
                    const real = realizado.get(c.id) || 0;
                    const pct = prev > 0 ? Math.round((real / prev) * 100) : null;
                    return (
                      <tr key={c.id} className={c.ativo ? '' : 'text-slate-400'}>
                        <td className="px-4 py-2">{c.nome}</td>
                        <td className="px-4 py-1.5 text-right">
                          {podeEditar ? (
                            <input
                              inputMode="decimal"
                              value={previsto[c.id] || ''}
                              onChange={(e) => setPrevisto((atual) => ({ ...atual, [c.id]: e.target.value }))}
                              placeholder="0,00"
                              className={`${inputClass} py-1.5 text-right`}
                            />
                          ) : (
                            moeda(prev)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">{moeda(real)}</td>
                        <td
                          className={`hidden px-4 py-2 text-right sm:table-cell ${
                            pct !== null && c.tipo === 'despesa' && pct > 100 ? 'font-semibold text-rose-700' : 'text-slate-500'
                          }`}
                        >
                          {pct === null ? '—' : `${pct}%`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right">{moeda(totalPrevisto)}</td>
                    <td className="px-4 py-2.5 text-right">{moeda(totalRealizado)}</td>
                    <td className="hidden px-4 py-2.5 sm:table-cell" />
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </div>
  );
}
