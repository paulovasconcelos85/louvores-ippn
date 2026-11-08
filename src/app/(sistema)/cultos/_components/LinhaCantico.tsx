'use client';

import { TONS_MUSICAIS_VALIDOS } from '../_lib/canticos';
import type { Cantico } from '../_lib/tipos';
import { CanticoAutocomplete } from './CanticoAutocomplete';

// --- LINHA DE CÂNTICO ---
export function LinhaCantico({ musica, canticos, onChange, onRemove, podVerTom, onCreate, canEditarMusica }: any) {
  const cantico =
    canticos.find((c: Cantico) => String(c.id) === String(musica.cantico_id || '')) || null;

  return (
    <div className="flex items-center gap-2 mt-3 pl-3 border-l-2 border-emerald-300">
      <span className="text-emerald-500 text-base flex-shrink-0">🎵</span>
      <CanticoAutocomplete
        value={cantico}
        onChange={c => onChange({ ...musica, cantico_id: c?.id ? String(c.id) : null })}
        canticos={canticos}
        onCreate={onCreate}
        disabled={!canEditarMusica}
      />
      {podVerTom && (
        <select
          value={musica.tom || ''}
          onChange={e => onChange({ ...musica, tom: e.target.value })}
          disabled={!canEditarMusica}
          className="border border-slate-200 rounded-xl px-2 py-3 text-base bg-white w-24 focus:outline-none focus:border-emerald-500 disabled:bg-slate-50 flex-shrink-0"
        >
          <option value="">Tom</option>
          {TONS_MUSICAIS_VALIDOS.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      {canEditarMusica && (
        <button onClick={onRemove} className="text-slate-300 hover:text-red-400 active:text-red-500 transition-colors text-2xl leading-none w-10 h-10 flex items-center justify-center flex-shrink-0">×</button>
      )}
    </div>
  );
}
