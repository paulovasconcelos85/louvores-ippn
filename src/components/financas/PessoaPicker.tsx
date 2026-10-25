'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { finApi, inputClass } from './api';

/** Busca uma pessoa da igreja pelo nome. */
export default function PessoaPicker({
  igrejaId,
  valor,
  onChange,
  placeholder = 'Buscar pelo nome…',
}: {
  igrejaId: string;
  valor: { id: string; nome: string } | null;
  onChange: (pessoa: { id: string; nome: string } | null) => void;
  placeholder?: string;
}) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Array<{ id: string; nome: string }>>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const timer = setTimeout(async () => {
      try {
        const data = await finApi<{ pessoas: Array<{ id: string; nome: string }> }>(
          `pessoas?igreja_id=${encodeURIComponent(igrejaId)}&q=${encodeURIComponent(busca)}`
        );
        if (ativo) setResultados(data.pessoas);
      } catch {
        if (ativo) setResultados([]);
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [busca, aberto, igrejaId]);

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm">
        <span className="truncate font-medium text-slate-900">{valor.nome}</span>
        <button type="button" onClick={() => onChange(null)} className="rounded-full p-1 text-slate-500 hover:bg-white" title="Trocar">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
      />
      {aberto && resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {resultados.map((pessoa) => (
            <li key={pessoa.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(pessoa);
                  setBusca('');
                  setAberto(false);
                }}
                className="block w-full px-3.5 py-2 text-left text-sm text-slate-800 hover:bg-emerald-50"
              >
                {pessoa.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
