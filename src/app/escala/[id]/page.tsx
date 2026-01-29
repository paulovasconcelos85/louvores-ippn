'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  cor: string;
  icone: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface EscalaFuncao {
  id: string;
  ordem: number;
  confirmado: boolean;
  observacoes?: string;
  tags_funcoes: Tag;
  pessoas: Usuario;
}

interface Escala {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim?: string;
  tipo_culto: string;
  observacoes?: string;
  status: string;
  culto_id?: number;
  escalas_funcoes: EscalaFuncao[];
}

const CATEGORIAS_LABEL: Record<string, string> = {
  lideranca_pastor: 'Liderança - Pastor',
  lideranca_presbitero: 'Liderança - Presbíteros',
  lideranca_diacono: 'Liderança - Diáconos',
  louvor_lideranca: 'Louvor - Ministração',
  louvor_vocal: 'Louvor - Vocais',
  louvor_instrumento: 'Louvor - Instrumentos',
  tecnico_audio: 'Técnica - Áudio',
  tecnico_video: 'Técnica - Mídia',
  apoio_geral: 'Apoio - Geral',
  ministerio_infantil: 'Ministério Infantil',
  apoio_seguranca: 'Apoio - Segurança'
};

const getCategoriaLabel = (slug: string) => {
  return CATEGORIAS_LABEL[slug] || slug;
};


export default function EscalaPublicaPage() {
  const params = useParams();
  const router = useRouter();
  const escalaId = params?.id as string;
  const { user } = useAuth();
  
  const [escala, setEscala] = useState<Escala | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  const [minhasFuncoes, setMinhasFuncoes] = useState<EscalaFuncao[]>([]);

  useEffect(() => {
    if (escalaId) {
      carregarEscala();
    }
  }, [escalaId]);

  useEffect(() => {
    if (escala && user) {
      const funcoes = escala.escalas_funcoes.filter(
        f => f.pessoas.id === user.id
      );
      setMinhasFuncoes(funcoes);
    }
  }, [escala, user]);

  const carregarEscala = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('escalas')
        .select(`
          *,
          escalas_funcoes (
            id,
            ordem,
            confirmado,
            observacoes,
            tags_funcoes (
              id,
              nome,
              categoria,
              cor,
              icone
            ),
            pessoas (
              id,
              nome,
              email
            )
          )
        `)
        .eq('id', escalaId)
        .single();

      if (error) throw error;
      setEscala(data);
    } catch (error: any) {
      console.error('Erro ao carregar escala:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmarPresenca = async () => {
    if (!user || minhasFuncoes.length === 0) return;
    
    setConfirmando(true);
    setMensagem('');
    
    try {
      // Confirmar todas as funções do usuário nesta escala
      const updates = minhasFuncoes.map(func => 
        supabase
          .from('escalas_funcoes')
          .update({ confirmado: true })
          .eq('id', func.id)
      );
      
      await Promise.all(updates);
      
      setMensagem('✅ Presença confirmada com sucesso!');
      carregarEscala(); // Recarregar para atualizar status
    } catch (error: any) {
      console.error('Erro ao confirmar:', error);
      setMensagem('❌ Erro ao confirmar presença');
    } finally {
      setConfirmando(false);
    }
  };

  const getTipoCultoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      dominical_manha: 'Dominical - Manhã',
      dominical_noite: 'Dominical - Noite',
      quarta: 'Quarta-feira',
      especial: 'Culto Especial'
    };
    return labels[tipo] || tipo;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando escala...</p>
        </div>
      </div>
    );
  }

  if (!escala) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">❌</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Escala não encontrada</h1>
          <p className="text-slate-600 mb-6">Esta escala pode ter sido removida ou o link está incorreto.</p>
          <button
            onClick={() => router.push('/')}
            className="text-emerald-700 hover:text-emerald-800 font-medium"
          >
            ← Voltar para início
          </button>
        </div>
      </div>
    );
  }

  const todasConfirmadas = minhasFuncoes.length > 0 && minhasFuncoes.every(f => f.confirmado);
  const algumaPendente = minhasFuncoes.length > 0 && minhasFuncoes.some(f => !f.confirmado);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-2xl px-6 py-3 shadow-sm border border-emerald-200 mb-4">
            <h2 className="text-emerald-800 font-bold text-sm uppercase tracking-wider">
              🎵 Sistema de Liturgia IPPN
            </h2>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            {escala.titulo}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-600">
            <span className="flex items-center gap-2">
              <span>📅</span>
              <span className="font-medium">
                {new Date(escala.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span>🕐</span>
              <span className="font-medium">{escala.hora_inicio}</span>
            </span>
          </div>
        </div>

        {/* Mensagem */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-xl ${
            mensagem.includes('✅') ? 'bg-green-50 text-green-800 border-2 border-green-200' :
            'bg-red-50 text-red-800 border-2 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">{mensagem}</span>
              <button
                onClick={() => setMensagem('')}
                className="text-current opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Card Principal */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-6">
          {/* Se não estiver logado */}
          {!user && (
            <div className="bg-amber-50 border-b-2 border-amber-200 px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 mb-1">
                    Faça login para confirmar sua presença
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    Entre com sua conta para ver suas funções e confirmar.
                  </p>
                  <button
                    onClick={() => router.push('/login')}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm"
                  >
                    Fazer Login
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Se estiver logado mas não estiver na escala */}
          {user && minhasFuncoes.length === 0 && (
            <div className="bg-blue-50 border-b-2 border-blue-200 px-6 py-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <p className="font-semibold text-blue-900 mb-1">
                    Você não está escalado(a) para este culto
                  </p>
                  <p className="text-sm text-blue-800">
                    Esta escala é para outras pessoas da equipe.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Se estiver na escala */}
          {user && minhasFuncoes.length > 0 && (
            <div className={`border-b-2 px-6 py-4 ${
              todasConfirmadas 
                ? 'bg-green-50 border-green-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">
                  {todasConfirmadas ? '✅' : '⏳'}
                </span>
                <div className="flex-1">
                  <h3 className={`text-xl font-bold mb-2 ${
                    todasConfirmadas ? 'text-green-900' : 'text-amber-900'
                  }`}>
                    {todasConfirmadas 
                      ? '🎉 Presença confirmada!' 
                      : '⚠️ Aguardando confirmação'}
                  </h3>
                  
                  <div className="space-y-2 mb-4">
                    <p className="font-semibold text-slate-900">
                      Você está escalado(a) para:
                    </p>
                    {minhasFuncoes.map(func => (
                      <div key={func.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border-2 border-slate-200">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: func.tags_funcoes.cor }}
                        />
                        <span className="font-semibold text-slate-900 flex-1">
                          {func.tags_funcoes.icone} {func.tags_funcoes.nome}
                        </span>
                        {func.confirmado && (
                          <span className="text-green-600 font-bold text-sm">✓ Confirmado</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {algumaPendente && (
                    <button
                      onClick={confirmarPresenca}
                      disabled={confirmando}
                      className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {confirmando ? '⏳ Confirmando...' : '✓ Confirmar Presença'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Detalhes do Culto */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span>📋</span>
              Informações do Culto
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-medium w-20">⛪ Tipo:</span>
                <span>{getTipoCultoLabel(escala.tipo_culto)}</span>
              </div>
              {escala.culto_id && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium w-20">🎵 Culto:</span>
                  <span>#{escala.culto_id}</span>
                </div>
              )}
              {escala.observacoes && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold text-slate-700 mb-1">💬 Observações:</p>
                  <p className="text-slate-600 whitespace-pre-line">{escala.observacoes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm">
          <p className="mb-1">Igreja Presbiteriana da Ponta Negra</p>
          <p className="italic">Uma igreja da família de Deus</p>
        </div>
      </div>
    </div>
  );
}