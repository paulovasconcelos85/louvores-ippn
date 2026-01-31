'use client';

import { useState } from 'react';
import Link from 'next/link'; // Adicionado import do Link
import { 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Loader2,
  Church,
  BookOpen,
  Handshake,
  User,
  Mic2,
  Music2,
  Guitar,
  Piano,
  Sliders,
  Volume2,
  Video,
  Baby,
  Shield,
  UsersRound,
  Heart,
  CheckCircle2,
  Clock,
  Youtube,
  Music
} from 'lucide-react';
import { useEscalaDoCulto } from '@/hooks/useEscalaDoCulto';

interface EscalaIntegradaProps {
  dataCulto: string;
  cultoConcluido?: boolean;
}

// Ícone Spotify customizado
const SpotifyIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

// Ordem das categorias (baseado no schema do banco)
const ORDEM_CATEGORIAS = [
  'lideranca_pastor',
  'lideranca_presbitero', 
  'lideranca_diacono',
  'lideranca',
  'louvor_lideranca',
  'louvor_vocal',
  'louvor_instrumento',
  'instrumento',
  'tecnica',
  'tecnico_audio',
  'tecnico_video',
  'ministerio_infantil',
  'apoio_seguranca',
  'apoio_geral',
  'apoio'
];

// Ícones por categoria
const ICONES_CATEGORIAS: Record<string, any> = {
  lideranca_pastor: Church,
  lideranca_presbitero: BookOpen,
  lideranca_diacono: Handshake,
  lideranca: User,
  louvor_lideranca: Mic2,
  louvor_vocal: Music2,
  louvor_instrumento: Guitar,
  instrumento: Piano,
  tecnica: Sliders,
  tecnico_audio: Volume2,
  tecnico_video: Video,
  ministerio_infantil: Baby,
  apoio_seguranca: Shield,
  apoio_geral: UsersRound,
  apoio: Heart
};

// Labels amigáveis
const LABELS_CATEGORIAS: Record<string, string> = {
  lideranca_pastor: 'Pastor',
  lideranca_presbitero: 'Presbítero',
  lideranca_diacono: 'Diácono',
  lideranca: 'Liderança',
  louvor_lideranca: 'Ministração',
  louvor_vocal: 'Vozes',
  louvor_instrumento: 'Instrumentos',
  instrumento: 'Instrumentos',
  tecnica: 'Técnica',
  tecnico_audio: 'Áudio',
  tecnico_video: 'Vídeo',
  ministerio_infantil: 'Ministério Infantil',
  apoio_seguranca: 'Segurança',
  apoio_geral: 'Apoio',
  apoio: 'Apoio'
};

export function EscalaIntegrada({ dataCulto, cultoConcluido = false }: EscalaIntegradaProps) {
  const [expandida, setExpandida] = useState(false);
  const { escala, loading } = useEscalaDoCulto(dataCulto, expandida);

  const toggleExpansao = () => {
    setExpandida(!expandida);
  };

  // Ordenar funções por categoria
  const funcoesPorCategoria = escala?.funcoes.reduce((acc: any, funcao: any) => {
    const categoria = funcao.tag.categoria;
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(funcao);
    return acc;
  }, {} as Record<string, any>);

  // Ordenar categorias
  const categoriasOrdenadas = funcoesPorCategoria 
    ? ORDEM_CATEGORIAS.filter(cat => funcoesPorCategoria[cat])
    : [];

  const totalPessoas = escala?.funcoes.length || 0;
  const confirmados = escala?.funcoes.filter((f: any) => f.confirmado).length || 0;

  return (
    <div className="mt-3 border-t border-emerald-200/30 pt-3">
      {/* Botão Toggle */}
      <button
        onClick={toggleExpansao}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all group"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-100" />
          <span className="text-sm font-medium text-emerald-50">
            {escala ? escala.titulo : 'Escala do Culto'}
          </span>
          {escala && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-emerald-100">
              {confirmados}/{totalPessoas}
            </span>
          )}
        </div>
        {expandida ? (
          <ChevronUp className="w-4 h-4 text-emerald-100 group-hover:translate-y-[-2px] transition-transform" />
        ) : (
          <ChevronDown className="w-4 h-4 text-emerald-100 group-hover:translate-y-[2px] transition-transform" />
        )}
      </button>

      {/* Conteúdo Expandido */}
      {expandida && (
        <div className="mt-3 animate-slideDown">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-100" />
            </div>
          ) : escala ? (
            <div className="space-y-3">
              {/* Cânticos (se houver) */}
              {escala.canticos && escala.canticos.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-emerald-100 uppercase mb-2 px-2 flex items-center gap-2">
                    <Music className="w-3.5 h-3.5" />
                    Cânticos
                  </h4>
                  <div className="space-y-1.5">
                    {escala.canticos.map((cantico: any) => (
                      <div
                        key={cantico.id}
                        className="flex items-center justify-between px-3 py-2 bg-white/10 backdrop-blur-sm rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {cantico.nome}
                          </p>
                          {cantico.tags && cantico.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cantico.tags.slice(0, 3).map((tag: string, idx: number) => (
                                <span 
                                  key={idx} 
                                  className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/30 rounded text-[10px] text-emerald-100 font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Links YouTube e Spotify */}
                        {(cantico.youtube_url || cantico.spotify_url) && (
                          <div className="flex gap-2 ml-3">
                            {cantico.youtube_url && (
                              <a
                                href={cantico.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-md transition-colors"
                                title="Ver no YouTube"
                              >
                                <Youtube className="w-4 h-4 text-white" />
                              </a>
                            )}
                            {cantico.spotify_url && (
                              <a
                                href={cantico.spotify_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                className="p-1.5 bg-green-600/80 hover:bg-green-600 rounded-md transition-colors"
                                title="Ouvir no Spotify"
                              >
                                <SpotifyIcon size={16} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipe de serviço */}
              {categoriasOrdenadas.map((categoria) => {
                const funcoes = funcoesPorCategoria![categoria];
                const label = LABELS_CATEGORIAS[categoria] || categoria;
                const IconeCategoria = ICONES_CATEGORIAS[categoria] || User;
                
                return (
                  <div key={categoria}>
                    <h4 className="text-xs font-semibold text-emerald-100 uppercase mb-2 px-2 flex items-center gap-2">
                      <IconeCategoria className="w-3.5 h-3.5" />
                      {label}
                    </h4>
                    <div className="space-y-1.5">
                      {funcoes.map((funcao: any) => (
                        <div
                          key={funcao.id}
                          className="flex items-center justify-between px-3 py-2 bg-white/10 backdrop-blur-sm rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                funcao.confirmado ? 'bg-green-400' : 'bg-yellow-300'
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-white">
                                {funcao.usuario.nome}
                              </p>
                              <p className="text-xs text-emerald-100/70">
                                {funcao.tag.nome}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${
                              funcao.confirmado
                                ? 'bg-green-500/30 text-green-100'
                                : 'bg-yellow-500/30 text-yellow-100'
                            }`}
                          >
                            {funcao.confirmado ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Confirmado
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                Pendente
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer com link */}
              {!cultoConcluido && escala && (
                <div className="text-center pt-2 border-t border-white/10">
                  <Link
                    href={`/escala/${escala.id}`}
                    className="text-xs text-emerald-100 hover:text-white hover:underline inline-flex items-center gap-1"
                  >
                    Confirmar presença →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-emerald-100/70">
                Nenhuma escala cadastrada para este culto
              </p>
            </div>
          )}
        </div>
      )}

      {/* Animação CSS */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            max-height: 800px;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}