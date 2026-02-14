'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { BookOpen, Music, Youtube } from 'lucide-react';

interface LetraData {
  tipo: 'hinario' | 'cantico';
  numero: string | null;
  nome: string;
  letra: string | null;
  referencia: string | null;
  tags: string[] | null;
  autor_letra: string | null;
  compositor: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  audio_url: string | null;
}

const SpotifyIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export default function LetraPage() {
  const { nome } = useParams();
  const router = useRouter();
  const [dados, setDados] = useState<LetraData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDados() {
      setLoading(true);
      const nomeDecodificado = decodeURIComponent(nome as string);

      // Buscar da VIEW unificada
      const { data, error } = await supabase
        .from('canticos_unificados')
        .select('tipo, numero, nome, letra, referencia, tags, autor_letra, compositor, youtube_url, spotify_url, audio_url')
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
  const ehHinario = dados?.tipo === 'hinario';

  const extrairYoutubeId = (url: string | null): string | null => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const youtubeId = extrairYoutubeId(dados?.youtube_url || null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* HEADER */}
      <header className="bg-white border-b-2 border-slate-200 p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.back()} 
            className="text-emerald-700 font-bold flex items-center gap-2 hover:text-emerald-900 transition-colors"
          >
            ← Voltar
          </button>
          <button 
            onClick={() => router.push('/')} 
            className="text-emerald-700 font-bold hover:text-emerald-900 transition-colors"
          >
            Home
          </button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="p-4 max-w-4xl mx-auto py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse flex items-center gap-3">
              <Music className="text-emerald-600" size={32} />
              <span className="text-xl text-slate-600">Carregando...</span>
            </div>
          </div>
        ) : !dados ? (
          <div className="bg-white rounded-2xl p-8 border-2 border-slate-200 text-center">
            <Music className="mx-auto text-slate-400 mb-4" size={48} />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Cântico não encontrado</h2>
            <p className="text-slate-600">Este cântico não está disponível no momento.</p>
          </div>
        ) : (
          <>
            {/* CARD DO CÂNTICO */}
            <div className="bg-white rounded-2xl p-6 md:p-8 border-2 border-slate-200 shadow-lg mb-6">
              {/* BADGE DE TIPO */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                  ehHinario 
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' 
                    : 'bg-green-100 text-green-700 border-2 border-green-200'
                }`}>
                  {ehHinario ? '📖 Hinário Novo Cântico' : '🎵 Cântico'}
                </span>
                {ehHinario && dados.numero && (
                  <span className="text-xs px-3 py-1.5 rounded-full font-mono bg-slate-100 text-slate-700 border-2 border-slate-200">
                    #{dados.numero}
                  </span>
                )}
              </div>

              {/* TÍTULO */}
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-4">
                {nomeExibicao}
              </h1>

              {/* METADADOS */}
              <div className="space-y-2 mb-6">
                {/* Autor e Compositor */}
                {(dados.autor_letra || dados.compositor) && (
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    {dados.autor_letra && (
                      <span className="flex items-center gap-1">
                        <span>✍️</span>
                        <span className="font-medium">Letra:</span> {dados.autor_letra}
                      </span>
                    )}
                    {dados.compositor && dados.compositor !== dados.autor_letra && (
                      <span className="flex items-center gap-1">
                        <span>🎼</span>
                        <span className="font-medium">Música:</span> {dados.compositor}
                      </span>
                    )}
                  </div>
                )}

                {/* Referência Bíblica */}
                {dados.referencia && (
                  <p className="text-sm text-slate-600 flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                    <span>📖</span> 
                    <span className="font-medium">Referência:</span>
                    <span>{dados.referencia}</span>
                  </p>
                )}

                {/* Tags */}
                {dados.tags && dados.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {dados.tags.map((tag) => (
                      <span 
                        key={tag} 
                        className="text-xs uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* LINKS DE MÍDIA */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
                {dados.youtube_url && (
                  <a 
                    href={dados.youtube_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors border-2 border-red-200 font-semibold"
                  >
                    <Youtube size={18} />
                    YouTube
                  </a>
                )}
                {dados.spotify_url && (
                  <a 
                    href={dados.spotify_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border-2 border-green-200 font-semibold"
                  >
                    <SpotifyIcon size={18} />
                    Spotify
                  </a>
                )}
                {dados.audio_url && (
                  <a 
                    href={dados.audio_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors border-2 border-slate-200 font-semibold"
                  >
                    🎵 Áudio
                  </a>
                )}
              </div>
            </div>

            {/* LETRA */}
            {dados.letra ? (
              <div className="bg-white rounded-2xl p-6 md:p-8 border-2 border-slate-200 shadow-lg">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-slate-200">
                  <BookOpen className="text-emerald-700" size={24} />
                  <h2 className="text-2xl font-bold text-slate-800">Letra</h2>
                </div>
                
                <div className="whitespace-pre-wrap text-xl md:text-2xl leading-relaxed font-serif text-slate-800 pb-8">
                  {dados.letra}
                </div>

                {/* Vídeo do YouTube (se disponível) */}
                {youtubeId && (
                  <div className="mt-8 pt-8 border-t-2 border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Youtube className="text-red-600" size={24} />
                      Assista no YouTube
                    </h3>
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xl">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title={nomeExibicao}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="border-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border-2 border-slate-200 text-center">
                <BookOpen className="mx-auto text-slate-400 mb-3" size={48} />
                <p className="text-slate-600 text-lg">Letra ainda não disponível</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}