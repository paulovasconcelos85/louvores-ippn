'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CifraPage() {
  const { id } = useParams();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [cifra, setCifra] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCifra() {
      const { data, error } = await supabase
        .from('canticos')
        .select('nome, cifra')
        .eq('id', id)
        .single();

      if (!error && data) {
        setNome(data.nome);
        setCifra(data.cifra);
      }

      setLoading(false);
    }

    fetchCifra();
  }, [id]);

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

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

      <main className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{nome}</h1>

        {cifra ? (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-lg leading-relaxed whitespace-pre-wrap font-mono">
            {cifra}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded-lg">
            Cifra ainda não disponível.
          </div>
        )}
      </main>
    </div>
  );
}
