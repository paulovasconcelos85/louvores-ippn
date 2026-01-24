'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Loader2 } from 'lucide-react';
import { useEscalaDoCulto } from '@/hooks/useEscalaDoCulto';

interface EscalaIntegradaProps {
  dataCulto: string;
  cultoConcluido?: boolean;
}

// Ordem das categorias (baseado no schema do banco)
const ORDEM_CATEGORIAS = ['lideranca', 'vocal', 'instrumento', 'tecnica', 'apoio'];

// Labels amigáveis
const LABELS_CATEGORIAS: Record<string, string> = {
  lideranca: '📖 Liderança',
  vocal: '🎤 Vozes',
  instrumento: '🎸 Instrumentos',
  tecnica: '🎛️ Técnica',
  apoio: '👥 Apoio'
};

export function EscalaIntegrada({ dataCulto, cultoConcluido = false }: EscalaIntegradaProps) {
  const [expandida, setExpandida] = useState(false);
  const { escala, loading } = useEscalaDoCulto(dataCulto, expandida);

  const toggleExpansao = () => {
    setExpandida(!expandida);
  };

  // Ordenar funções por categoria
  const funcoesPorCategoria = escala?.funcoes.reduce((acc, funcao) => {
    const categoria = funcao.tag.categoria;
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(funcao);
    return acc;
  }, {} as Record<string, typeof escala.funcoes>);

  // Ordenar categorias
  const categoriasOrdenadas = funcoesPorCategoria 
    ? ORDEM_CATEGORIAS.filter(cat => funcoesPorCategoria[cat])
    : [];

  const totalPessoas = escala?.funcoes.length || 0;
  const confirmados = escala?.funcoes.filter(f => f.confirmado).length || 0;

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
              {categoriasOrdenadas.map((categoria) => {
                const funcoes = funcoesPorCategoria![categoria];
                const label = LABELS_CATEGORIAS[categoria] || categoria;
                
                return (
                  <div key={categoria}>
                    <h4 className="text-xs font-semibold text-emerald-100 uppercase mb-2 px-2">
                      {label}
                    </h4>
                    <div className="space-y-1.5">
                      {funcoes.map((funcao) => (
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
                            className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              funcao.confirmado
                                ? 'bg-green-500/30 text-green-100'
                                : 'bg-yellow-500/30 text-yellow-100'
                            }`}
                          >
                            {funcao.confirmado ? '✓ Confirmado' : '⏱ Pendente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer com link */}
              {!cultoConcluido && (
                <div className="text-center pt-2 border-t border-white/10">
                  <a
                    href={`/escala/${escala.id}`}
                    className="text-xs text-emerald-100 hover:text-white hover:underline inline-flex items-center gap-1"
                  >
                    Confirmar presença →
                  </a>
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
            max-height: 500px;
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