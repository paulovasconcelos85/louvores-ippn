'use client';

import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import type { FinCategoria, FinConta, FinPermissoes, PapelEquipe } from '@/lib/financas';

export interface ContextoFinancas {
  permissoes: FinPermissoes;
  igreja: { nome: string; nome_abreviado: string | null; pais: string | null } | null;
  contas: FinConta[];
  categorias: FinCategoria[];
  equipe: Array<{ id: string; papel: PapelEquipe; ano: number; pessoa_id: string; nome: string }>;
}

/** fetch autenticado das rotas /api/financas; lança Error com a mensagem da API. */
export async function finApi<T = any>(caminho: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...resto } = init || {};
  const headers = await buildAuthenticatedHeaders(json !== undefined ? { 'Content-Type': 'application/json' } : undefined);
  const response = await fetch(`/api/financas/${caminho}`, {
    ...resto,
    headers,
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data as T;
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
export const botaoPrimario =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50';
export const botaoSecundario =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50';
