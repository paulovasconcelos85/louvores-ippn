'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Cantico } from '../_lib/tipos';
import { getCanticoDisplayLabel, getRepertorioTextos, matchesCanticoQuery } from '../_lib/canticos';
import { getStatusMusica } from '../_lib/liturgia';

// --- AUTOCOMPLETE DE CÂNTICO ---
export function CanticoAutocomplete({ value, onChange, canticos, onCreate, disabled }: {
  value: Cantico | null;
  onChange: (c: Cantico | null) => void;
  canticos: Cantico[];
  onCreate?: (nome: string) => Promise<Cantico>;
  disabled?: boolean;
}) {
  const textosRepertorio = getRepertorioTextos(canticos);
  const [query, setQuery] = useState(getCanticoDisplayLabel(value));
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(getCanticoDisplayLabel(value)); }, [value]);

  const filtrados = canticos.filter((c) => matchesCanticoQuery(c, query)).slice(0, 8);

  const abrirDropdown = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(256, filtrados.length * 60 + 56);
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 300),
      zIndex: 9999,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setOpen(true);
  };

  const dropdown = open && !disabled ? (
    <div
      style={dropdownStyle}
      className="bg-white border border-slate-200 rounded-2xl max-h-64 overflow-auto shadow-2xl"
    >
      {filtrados.map(c => {
        const st = getStatusMusica(c.ultima_vez);
        const titulo = getCanticoDisplayLabel(c);
        return (
          <div
            key={c.id}
            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 active:bg-slate-100"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onChange(c); setQuery(getCanticoDisplayLabel(c)); setOpen(false); }}
          >
            <div className="text-base font-semibold text-slate-800">{titulo}</div>
            <div className={`text-xs font-bold mt-0.5 ${st.cor}`}>{st.label} · {st.dataFormatada}</div>
          </div>
        );
      })}
      {onCreate && query.trim() && !canticos.some(c => c.nome.toLowerCase() === query.toLowerCase()) && (
        <div
          className="px-4 py-3 text-emerald-700 font-bold text-base hover:bg-emerald-50 cursor-pointer border-t border-emerald-100 active:bg-emerald-100"
          onMouseDown={e => e.preventDefault()}
          onClick={async () => {
            if (!onCreate) return;
            const n = await onCreate(query);
            onChange(n);
            setQuery(n.nome);
            setOpen(false);
          }}
        >
          + Cadastrar &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={query}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); abrirDropdown(); if (!e.target.value) onChange(null); }}
        onFocus={abrirDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={textosRepertorio.placeholderBusca}
        className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500 bg-emerald-50/50 disabled:bg-slate-50 disabled:cursor-default"
      />
      {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
