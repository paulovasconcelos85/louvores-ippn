'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LetraPage() {
  const { nome } = useParams();
  const router = useRouter();
  const [dados, setDados] = useState<{
    letra: string | null;
    referencia: string | null;
    tags: string[] | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDados() {
      setLoading(true);
      const nomeDecodificado = decodeURIComponent(nome as string);

      const { data, error } = await supabase
        .from('canticos')
        .select('letra, referencia, tags') // Buscando os novos campos
        .eq('nome', nomeDecodificado)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar dados:', error);
      }

      setDados(data || null);
      setLoading(false);
    }

    fetchDados();
  }, [nome]);

  const nomeExibicao = decodeURIComponent(nome as string);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="text-emerald-700 font-semibold">
          ← Voltar
        </button>
        <button onClick={() => router.push('/')} className="text-emerald-700 font-semibold">
          Home
        </button>
      </header>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 leading-tight mb-2">
          {nomeExibicao}
        </h1>
        
        {!loading && dados && (
          <div className="space-y-2">
            {/* Referência Bíblica Discreta */}
            {dados.referencia && (
              <p className="text-sm text-slate-500 italic flex items-center gap-1">
                <span>📖</span> {dados.referencia}
              </p>
            )}

            {/* Tags Litúrgicas Pequenas */}
            {dados.tags && dados.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dados.tags.map((tag) => (
                  <span 
                    key={tag} 
                    className="text-[10px] uppercase tracking-wider font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-slate-400 animate-pulse">Carregando letra...</p>
      ) : dados?.letra ? (
        <div className="whitespace-pre-wrap text-2xl leading-relaxed font-sans text-slate-800 pb-20">
          {dados.letra}
        </div>
      ) : (
        <p className="text-slate-500">Letra ainda não disponível.</p>
      )}
    </div>
  );
}