'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';


interface Cantico {
  id: string;
  nome: string;
  letra: string | null;
  cifra: string | null;
}

export default function CanticosPage() {
  const router = useRouter();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<{ nome: string; letra: string; cifra: string }>({
    nome: '',
    letra: '',
    cifra: '',
  });

  useEffect(() => {
    fetchCanticos();
  }, []);

  const fetchCanticos = async () => {
    const { data } = await supabase
      .from('canticos')
      .select('id, nome, letra, cifra')
      .order('nome');

    if (data) setCanticos(data);
  };

  const iniciarEdicao = (c: Cantico) => {
    setEditando(c.id);
    setForm({
      nome: c.nome,
      letra: c.letra || '',
      cifra: c.cifra || '',
    });
  };

  const salvar = async () => {
    if (!editando) return;

    const { error } = await supabase
      .from('canticos')
      .update({
        nome: form.nome,
        letra: form.letra,
        cifra: form.cifra,
      })
      .eq('id', editando);

    if (!error) {
      await fetchCanticos();
      setEditando(null);
      alert('Cântico salvo com sucesso.');
    } else {
      console.error(error);
      alert('Erro ao salvar.');
    }
  };

  const filtrados = canticos.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

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
        <h1 className="text-2xl font-bold mb-4">Cânticos</h1>

        <input
            type="text"
            placeholder="Buscar cântico..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full border p-3 rounded-lg mb-4"
        />

        <div className="space-y-3">
            {filtrados.map(c => (
            <div key={c.id} className="bg-white border rounded-xl p-4 shadow-sm">
                <div
                className="font-semibold text-lg cursor-pointer"
                onClick={() => iniciarEdicao(c)}
                >
                {c.nome}
                </div>

                {editando === c.id && (
                <div className="mt-4 space-y-3">
                    <div>
                    <label className="font-semibold text-sm">Nome</label>
                    <input
                        className="w-full border p-2 rounded"
                        value={form.nome}
                        onChange={e => setForm({ ...form, nome: e.target.value })}
                    />
                    </div>

                    <div>
                    <label className="font-semibold text-sm">Letra</label>
                    <textarea
                        className="w-full border p-2 rounded min-h-[150px]"
                        value={form.letra}
                        onChange={e => setForm({ ...form, letra: e.target.value })}
                        placeholder="Cole ou digite a letra completa aqui"
                    />
                    </div>

                    <div>
                    <label className="font-semibold text-sm">Cifra</label>
                    <textarea
                        className="w-full border p-2 rounded min-h-[150px]"
                        value={form.cifra}
                        onChange={e => setForm({ ...form, cifra: e.target.value })}
                        placeholder="Cole ou digite a cifra aqui"
                    />
                    </div>

                    <div className="flex gap-2">
                    <button
                        onClick={salvar}
                        className="bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold"
                    >
                        Salvar
                    </button>
                    <button
                        onClick={() => setEditando(null)}
                        className="bg-slate-200 px-4 py-2 rounded-lg"
                    >
                        Cancelar
                    </button>
                    </div>
                </div>
                )}
            </div>
            ))}
        </div>
        </main>
    </div>
    );

}
