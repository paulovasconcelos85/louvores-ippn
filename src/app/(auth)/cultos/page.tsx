'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


interface Cantico {
  id: string;
  nome: string;
}

function CanticoAutocomplete({
  label,
  value,
  onChange,
  canticos,
  onCreate,
}: {
  label: string;
  value: Cantico | null;
  onChange: (c: Cantico) => void;
  canticos: Cantico[];
  onCreate: (nome: string) => Promise<Cantico>;
}) {
  const [query, setQuery] = useState(value?.nome || '');
  const [open, setOpen] = useState(false);

  const filtrados = canticos.filter(c =>
    c.nome.toLowerCase().includes(query.toLowerCase())
  );

  const existeExato = canticos.some(
    c => c.nome.toLowerCase() === query.toLowerCase()
  );

  return (
    <div className="relative space-y-1">
      <label className="font-semibold text-slate-700">{label}</label>

      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full border rounded-lg p-3"
        placeholder="Digite o nome do cântico"
      />

      {open && query && (
        <div className="absolute z-10 bg-white border rounded-lg mt-1 w-full max-h-60 overflow-auto shadow">
          {filtrados.map(c => (
            <div
              key={c.id}
              className="px-3 py-2 hover:bg-emerald-50 cursor-pointer"
              onClick={() => {
                onChange(c);
                setQuery(c.nome);
                setOpen(false);
              }}
            >
              {c.nome}
            </div>
          ))}

          {!existeExato && (
            <div
              className="px-3 py-2 text-emerald-700 font-semibold hover:bg-emerald-50 cursor-pointer border-t"
              onClick={async () => {
                const novo = await onCreate(query);
                onChange(novo);
                setQuery(novo.nome);
                setOpen(false);
              }}
            >
              ➕ Adicionar “{query}”
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CultosPage() {
  const router = useRouter();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [dia, setDia] = useState('');
  const [preludio, setPreludio] = useState<Cantico | null>(null);
  const [lista, setLista] = useState<(Cantico | null)[]>(Array(9).fill(null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchCanticos() {
      const { data } = await supabase
        .from('canticos')
        .select('id, nome')
        .order('nome');
      if (data) setCanticos(data);
    }
    fetchCanticos();
  }, []);

  const criarCantico = async (nome: string) => {
    const { data } = await supabase
      .from('canticos')
      .insert({ nome })
      .select()
      .single();

    setCanticos(prev => [...prev, data]);
    return data;
  };

  const salvarCulto = async () => {
    setLoading(true);

    const payload: any = {
      Dia: dia,
      "Prelúdio_id": preludio?.id || null,
    };

    lista.forEach((c, i) => {
      payload[`Cântico ${i + 2}_id`] = c?.id || null;
    });

    const { error } = await supabase.from('Louvores IPPN').insert(payload);

    if (!error) {
      alert('Culto salvo com sucesso!');
      router.push('/');
    } else {
      console.error(error);
      alert('Erro ao salvar culto');
    }

    setLoading(false);
  };

  return (
  <div className="min-h-screen bg-slate-50">
    {/* Header */}
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-emerald-700 font-semibold"
        >
          ← Voltar
        </button>

        <Link href="/" className="text-emerald-700 font-semibold">
          🏠 Home
        </Link>
      </div>
    </header>

    {/* Conteúdo */}
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Cadastro de Culto</h1>

      <div className="space-y-4">
        <div>
          <label className="font-semibold">Data do Culto</label>
          <input
            type="date"
            value={dia}
            onChange={e => setDia(e.target.value)}
            className="w-full border p-3 rounded-lg"
          />
        </div>

        <CanticoAutocomplete
          label="Prelúdio"
          value={preludio}
          onChange={setPreludio}
          canticos={canticos}
          onCreate={criarCantico}
        />

        {lista.map((c, idx) => (
          <CanticoAutocomplete
            key={idx}
            label={`Cântico ${idx + 2}`}
            value={c}
            onChange={novo => {
              const novaLista = [...lista];
              novaLista[idx] = novo;
              setLista(novaLista);
            }}
            canticos={canticos}
            onCreate={criarCantico}
          />
        ))}

        <button
          onClick={salvarCulto}
          disabled={loading}
          className="w-full bg-emerald-800 text-white py-3 rounded-xl font-bold mt-6"
        >
          {loading ? 'Salvando...' : 'Salvar Culto'}
        </button>
      </div>
    </main>
  </div>
);
}
