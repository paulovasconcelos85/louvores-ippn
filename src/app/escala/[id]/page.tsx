'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Escala {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo_culto: string;
  status: string;
}

interface Funcao {
  id: string;
  confirmado: boolean;
  status: 'pendente' | 'confirmado' | 'recusado';
  tag: {
    nome: string;
    categoria: string;
    cor: string;
  };
  usuario: {
    id: string;
    nome: string;
  };
}

export default function EscalaPublicaPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [escala, setEscala] = useState<Escala | null>(null);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, [id]);

  const carregar = async () => {
    setLoading(true);

    const { data: escalaData } = await supabase
      .from('escalas')
      .select('*')
      .eq('id', id)
      .single();

    const { data: funcoesData } = await supabase
      .from('escalas_funcoes')
      .select(`
        id,
        confirmado,
        status,
        tag:tags_funcoes (nome, categoria, cor),
        usuario:usuarios_permitidos (id, nome)
      `)
      .eq('escala_id', id)
      .order('ordem');

    setEscala(escalaData);
    setFuncoes(funcoesData as any || []);
    setLoading(false);
  };

  const atualizarStatus = async (funcaoId: string, novoStatus: 'confirmado' | 'recusado') => {
    setAtualizando(funcaoId);
    
    await supabase
      .from('escalas_funcoes')
      .update({ 
        status: novoStatus,
        confirmado: novoStatus === 'confirmado'
      })
      .eq('id', funcaoId);

    await carregar();
    setAtualizando(null);
  };

  const categorias = Array.from(new Set(funcoes.map(f => f.tag.categoria)));

  const getTipoCultoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      dominical_manha: 'Dominical - Manhã',
      dominical_noite: 'Dominical - Noite',
      quarta: 'Quarta-feira',
      especial: 'Culto Especial'
    };
    return labels[tipo] || tipo;
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      lideranca: '📖 Liderança',
      instrumento: '🎸 Instrumentos',
      vocal: '🎤 Vozes',
      tecnica: '🎛️ Técnica',
      apoio: '👥 Apoio'
    };
    return labels[categoria] || categoria;
  };

  if (loading || !escala) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando escala...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-6">
          <h1 className="text-2xl font-bold mb-2">{escala.titulo}</h1>
          <div className="flex items-center gap-2 text-emerald-100 mb-3">
            <span>📅</span>
            <p className="text-sm">
              {new Date(escala.data + 'T00:00:00').toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                day: '2-digit', 
                month: 'long' 
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              🕐 {escala.hora_inicio}{escala.hora_fim && ` - ${escala.hora_fim}`}
            </span>
            <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              ⛪ {getTipoCultoLabel(escala.tipo_culto)}
            </span>
          </div>
        </div>

        <div className="bg-blue-50 border-b-2 border-blue-200 px-6 py-4">
          <p className="text-sm text-blue-900">
            <span className="font-bold">ℹ️ Instruções:</span> Confirme sua presença ou informe se não poderá participar.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {categorias.map(cat => (
            <div key={cat}>
              <h3 className="font-bold text-slate-900 mb-3 pb-2 border-b-2 border-slate-200">
                {getCategoriaLabel(cat)}
              </h3>

              <div className="space-y-3">
                {funcoes.filter(f => f.tag.categoria === cat).map(funcao => {
                  const souEu = user?.id === funcao.usuario.id;
                  const estaAtualizando = atualizando === funcao.id;

                  return (
                    <div 
                      key={funcao.id} 
                      className={`border-2 rounded-xl p-4 transition-all ${
                        funcao.status === 'confirmado' ? 'bg-green-50 border-green-300' :
                        funcao.status === 'recusado' ? 'bg-red-50 border-red-300' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: funcao.tag.cor }}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{funcao.usuario.nome}</p>
                            <p className="text-sm text-slate-600">{funcao.tag.nome}</p>
                          </div>
                        </div>

                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                          funcao.status === 'confirmado' ? 'bg-green-200 text-green-900' :
                          funcao.status === 'recusado' ? 'bg-red-200 text-red-900' :
                          'bg-amber-200 text-amber-900'
                        }`}>
                          {funcao.status === 'confirmado' ? '✅ CONFIRMADO' :
                           funcao.status === 'recusado' ? '❌ NÃO VAI' :
                           '⏳ PENDENTE'}
                        </span>
                      </div>

                      {souEu && (
                        <div className="flex gap-2">
                          <button
                            disabled={estaAtualizando || funcao.status === 'confirmado'}
                            onClick={() => atualizarStatus(funcao.id, 'confirmado')}
                            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                              funcao.status === 'confirmado'
                                ? 'bg-green-200 text-green-800 cursor-default'
                                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                            } disabled:opacity-50`}
                          >
                            {estaAtualizando ? '...' : '✓ Confirmar Presença'}
                          </button>
                          <button
                            disabled={estaAtualizando || funcao.status === 'recusado'}
                            onClick={() => atualizarStatus(funcao.id, 'recusado')}
                            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                              funcao.status === 'recusado'
                                ? 'bg-red-200 text-red-800 cursor-default'
                                : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                            } disabled:opacity-50`}
                          >
                            {estaAtualizando ? '...' : '✗ Não Posso Ir'}
                          </button>
                        </div>
                      )}

                      {!souEu && funcao.status === 'pendente' && (
                        <p className="text-xs text-slate-500 italic">
                          Aguardando confirmação...
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4 text-center">
          <a
            target="_blank"
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `ESCALA – ${escala.titulo}\n${new Date(escala.data).toLocaleDateString('pt-BR')}\n\n` +
              funcoes.map(f => `• ${f.tag.nome}: ${f.usuario.nome}`).join('\n')
            )}`}
            className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            📲 Enviar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
