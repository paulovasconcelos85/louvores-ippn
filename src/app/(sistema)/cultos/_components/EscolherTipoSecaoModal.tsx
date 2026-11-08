'use client';

import { TIPOS_SECOES_BOLETIM } from '../_lib/tipos';

export function EscolherTipoSecaoModal({
  aberto,
  onFechar,
  onEscolher,
}: {
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (tipo: string) => void;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Boletim</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Nova seção</h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3 px-6 py-6">
          {TIPOS_SECOES_BOLETIM.map((tipo) => (
            <button
              key={tipo.tipo}
              type="button"
              onClick={() => onEscolher(tipo.tipo)}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                {tipo.emoji}
              </span>
              <div className="flex-1">
                <p className="font-bold text-slate-900">{tipo.titulo}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Adicionar seção do tipo {tipo.titulo.toLowerCase()} ao boletim.
                </p>
              </div>
              <span className="text-lg text-slate-300">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
