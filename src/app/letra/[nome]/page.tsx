'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LetraPage() {
  const { nome } = useParams();
  const router = useRouter();
  const [letra, setLetra] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    async function fetchLetra() {
      setLoading(true);

      const nomeDecodificado = decodeURIComponent(nome as string);

      const { data, error } = await supabase
        .from('canticos')
        .select('letra')
        .eq('nome', nomeDecodificado)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar letra:', error);
      }

      setLetra(data?.letra || null);
      setLoading(false);
    }

    fetchLetra();
  }, [nome]);



  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => router.back()} className="text-emerald-700 font-semibold">
          ← Voltar
        </button>
        <button onClick={() => router.push('/')} className="text-emerald-700 font-semibold">
          Home
        </button>
      </header>

      <h1 className="text-xl font-bold mb-4">{decodeURIComponent(nome as string)}</h1>

      {loading ? (
        <p className="text-slate-500">Carregando letra...</p>
      ) : letra ? (
        <div className="whitespace-pre-wrap text-2xl leading-loose font-sans">{letra}</div>
      ) : (
        <p className="text-slate-500">Letra ainda não disponível.</p>
      )}
    </div>
  );
}
