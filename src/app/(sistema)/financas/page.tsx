'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ClipboardCheck, HelpCircle, Loader2, PiggyBank, Receipt, Settings, Wallet } from 'lucide-react';
import { getStoredChurchId } from '@/lib/church-utils';
import { PAPEIS_EQUIPE, criarFormatadorMoeda } from '@/lib/financas';
import { finApi, type ContextoFinancas } from '@/components/financas/api';
import LancamentosTab from '@/components/financas/LancamentosTab';
import RelatoriosTab from '@/components/financas/RelatoriosTab';
import OrcamentoTab from '@/components/financas/OrcamentoTab';
import ExamesTab from '@/components/financas/ExamesTab';
import ConfiguracoesTab from '@/components/financas/ConfiguracoesTab';

type Aba = 'lancamentos' | 'relatorios' | 'orcamento' | 'exames' | 'configuracoes';

const ABAS: Array<{ id: Aba; nome: string; icone: typeof Receipt }> = [
  { id: 'lancamentos', nome: 'Lançamentos', icone: Receipt },
  { id: 'relatorios', nome: 'Relatórios', icone: BarChart3 },
  { id: 'orcamento', nome: 'Orçamento', icone: PiggyBank },
  { id: 'exames', nome: 'Exame de contas', icone: ClipboardCheck },
  { id: 'configuracoes', nome: 'Configurações', icone: Settings },
];

export default function FinancasPage() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [contexto, setContexto] = useState<ContextoFinancas | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('lancamentos');

  const carregar = useCallback(async (id: string) => {
    try {
      setErro('');
      setContexto(await finApi<ContextoFinancas>(`contexto?igreja_id=${encodeURIComponent(id)}`));
    } catch (error: any) {
      setErro(error.message);
    }
  }, []);

  useEffect(() => {
    const id = getStoredChurchId();
    setIgrejaId(id);
    if (id) carregar(id);
    else setErro('Selecione uma igreja no topo do painel.');
  }, [carregar]);

  const moeda = useMemo(() => criarFormatadorMoeda(contexto?.igreja?.pais), [contexto?.igreja?.pais]);

  // Primeira vez de uma igreja: sem contas, a tesouraria começa pelas configurações (só ao abrir).
  const abaInicialDefinida = useRef(false);
  useEffect(() => {
    if (!contexto || abaInicialDefinida.current) return;
    abaInicialDefinida.current = true;
    if (contexto.contas.length === 0 && contexto.permissoes.podeConfigurar) setAba('configuracoes');
  }, [contexto]);

  if (erro) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <Wallet className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-900">{erro}</p>
          <p className="mt-2 text-sm text-slate-600">
            As finanças ficam com a equipe da tesouraria e o Conselho. Se você é o tesoureiro, peça ao pastor para designar você em
            Finanças → Configurações → Equipe.
          </p>
          <Link href="/ajuda#financas" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 underline">
            <HelpCircle className="h-4 w-4" />
            Como funciona a tesouraria
          </Link>
        </div>
      </div>
    );
  }

  if (!contexto || !igrejaId) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const papeis = contexto.permissoes.papeis.map((p) => PAPEIS_EQUIPE[p].nome);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900 sm:text-3xl">
              <Wallet className="h-7 w-7 text-emerald-700" />
              Tesouraria
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {contexto.igreja?.nome}
              {papeis.length > 0 ? ` · você é ${papeis.join(' e ')}` : ''}
              {!contexto.permissoes.podeVerNomes && ' · nomes de quem dizima ficam ocultos para você'}
            </p>
          </div>
          <Link href="/ajuda#financas" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-white">
            <HelpCircle className="h-4 w-4" />
            Ajuda
          </Link>
        </div>

        <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
          {ABAS.map(({ id, nome, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                aba === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icone className="h-4 w-4" />
              {nome}
            </button>
          ))}
        </nav>

        {aba === 'lancamentos' && <LancamentosTab igrejaId={igrejaId} contexto={contexto} moeda={moeda} />}
        {aba === 'relatorios' && <RelatoriosTab igrejaId={igrejaId} contexto={contexto} moeda={moeda} />}
        {aba === 'orcamento' && <OrcamentoTab igrejaId={igrejaId} contexto={contexto} moeda={moeda} />}
        {aba === 'exames' && <ExamesTab igrejaId={igrejaId} contexto={contexto} moeda={moeda} />}
        {aba === 'configuracoes' && (
          <ConfiguracoesTab igrejaId={igrejaId} contexto={contexto} moeda={moeda} onAlterado={() => carregar(igrejaId)} />
        )}
      </div>
    </div>
  );
}
