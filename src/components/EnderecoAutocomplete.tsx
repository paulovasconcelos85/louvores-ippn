'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, X, Check } from 'lucide-react';

export interface EnderecoGoogle {
  logradouro: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  endereco_completo: string;
}

const inputCls =
  'w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 bg-white';

export default function EnderecoAutocomplete({
  onSelect,
}: {
  onSelect: (e: EnderecoGoogle) => void;
}) {
  const [query, setQuery] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState('');
  const sessionToken = useRef(Math.random().toString(36).slice(2));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async (texto: string) => {
    if (texto.length < 4) {
      setSugestoes([]);
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(texto)}&sessiontoken=${sessionToken.current}`
      );
      const data = await res.json();
      setSugestoes(data.predictions || []);
    } catch {
      setSugestoes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    setSelecionado('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(v), 350);
  };

  const selecionar = async (place: any) => {
    setSugestoes([]);
    setSelecionado(place.description);
    setQuery(place.description);
    try {
      const res = await fetch(
        `/api/places/details?place_id=${place.place_id}&sessiontoken=${sessionToken.current}`
      );
      const data = await res.json();
      sessionToken.current = Math.random().toString(36).slice(2);
      if (data.result) {
        const comps = data.result.address_components || [];
        const get = (t: string) =>
          comps.find((c: any) => c.types.includes(t))?.long_name || '';
        const getS = (t: string) =>
          comps.find((c: any) => c.types.includes(t))?.short_name || '';
        const num = get('street_number');
        const rua = get('route');
        onSelect({
          logradouro: num ? `${rua}, ${num}` : rua,
          bairro:
            get('sublocality_level_1') ||
            get('sublocality') ||
            get('neighborhood'),
          cep: get('postal_code').replace('-', ''),
          cidade: get('administrative_area_level_2'),
          uf: getS('administrative_area_level_1'),
          latitude: data.result.geometry?.location?.lat || null,
          longitude: data.result.geometry?.location?.lng || null,
          google_place_id: place.place_id,
          endereco_completo: place.description,
        });
      }
    } catch {
      /* silent */
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Digite o endereço ou bairro..."
          className={`${inputCls} pl-10 pr-10`}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSugestoes([]);
              setSelecionado('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {sugestoes.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {sugestoes.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onClick={() => selecionar(s)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <p className="text-sm font-medium text-slate-900 leading-tight">
                {s.structured_formatting?.main_text || s.description}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {s.structured_formatting?.secondary_text || ''}
              </p>
            </button>
          ))}
        </div>
      )}

      {carregando && (
        <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5">
          <span className="animate-spin inline-block w-3 h-3 border-b border-blue-600 rounded-full" />
          Buscando endereços...
        </p>
      )}

      {selecionado && !sugestoes.length && (
        <p className="mt-1.5 text-xs text-blue-600 font-medium flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Endereço selecionado
        </p>
      )}
    </div>
  );
}