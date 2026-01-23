'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';

interface Escala {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo_culto: string;
  status: string;
}

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  cor: string;
  icone: string;
  ordem: number;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface EscalaFuncao {
  id: string;
  tag_id: string;
  usuario_id: string;
  confirmado: boolean;
  ordem: number;
}

export default function GerenciarEscalaPage() {
  const router = useRouter();
  const params = useParams();
  const escalaId = params.id as string;
  
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  
  const [escala, setEscala] = useState<Escala | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [usuariosPorTag, setUsuariosPorTag] = useState<Record<string, Usuario[]>>({});
  const [funcoesEscala, setFuncoesEscala] = useState<EscalaFuncao[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const totalLoading = authLoading || permLoading;

  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }

    if (!totalLoading && user && !permissoes.podeGerenciarEscalas) {
      router.push('/admin');
    }
  }, [user, totalLoading, permissoes.podeGerenciarEscalas, router]);

  useEffect(() => {
    if (user && permissoes.podeGerenciarEscalas) {
      carregarDados();
    }
  }, [user, permissoes.podeGerenciarEscalas, escalaId]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const carregarDados = async () => {
    try {
      setLoading(true);

      // 1. Carregar dados da escala
      const { data: escalaData, error: escalaError } = await supabase
        .from('escalas')
        .select('*')
        .eq('id', escalaId)
        .single();

      if (escalaError) throw escalaError;
      setEscala(escalaData);

      // 2. Carregar todas as tags ativas
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags_funcoes')
        .select('*')
        .eq('ativo', true)
        .order('ordem');

      if (tagsError) throw tagsError;
      setTags(tagsData || []);

      // 3. Buscar TODOS os usuários com tags de uma vez (otimizado!)
      const { data: usuariosTagsData } = await supabase
        .from('usuarios_tags')
        .select(`
          tag_id,
          usuarios_permitidos (
            id,
            nome,
            email,
            ativo
          )
        `);

      // Agrupar por tag_id
      const usuariosPorTagTemp: Record<string, Usuario[]> = {};
      
      for (const tag of tagsData || []) {
        usuariosPorTagTemp[tag.id] = (usuariosTagsData || [])
          .filter((item: any) => item.tag_id === tag.id)
          .map((item: any) => item.usuarios_permitidos)
          .filter((u: any) => u && u.ativo);
      }

      setUsuariosPorTag(usuariosPorTagTemp);

      // 4. Carregar funções já atribuídas nesta escala
      const { data: funcoesData, error: funcoesError } = await supabase
        .from('escalas_funcoes')
        .select('*')
        .eq('escala_id', escalaId);

      if (funcoesError) throw funcoesError;
      setFuncoesEscala(funcoesData || []);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      setMensagem('❌ Erro ao carregar dados da escala');
    } finally {
      setLoading(false);
    }
  };

  const adicionarFuncao = async (tagId: string, usuarioId: string) => {
    if (!usuarioId) return;

    try {
      setSalvando(true);
      
      // Verificar quantas pessoas já estão nesta função
      const funcoesExistentes = funcoesEscala.filter(f => f.tag_id === tagId);
      const ordem = funcoesExistentes.length;

      const { error } = await supabase
        .from('escalas_funcoes')
        .insert({
          escala_id: escalaId,
          tag_id: tagId,
          usuario_id: usuarioId,
          ordem,
          confirmado: false
        });

      if (error) throw error;

      setMensagem('✅ Pessoa adicionada com sucesso!');
      carregarDados();
    } catch (error: any) {
      console.error('Erro ao adicionar função:', error);
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const removerFuncao = async (funcaoId: string) => {
    try {
      setSalvando(true);

      const { error } = await supabase
        .from('escalas_funcoes')
        .delete()
        .eq('id', funcaoId);

      if (error) throw error;

      setMensagem('🗑️ Pessoa removida');
      carregarDados();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const toggleConfirmacao = async (funcaoId: string, confirmadoAtual: boolean) => {
    try {
      const { error } = await supabase
        .from('escalas_funcoes')
        .update({ confirmado: !confirmadoAtual })
        .eq('id', funcaoId);

      if (error) throw error;

      // Atualizar localmente
      setFuncoesEscala(prev => 
        prev.map(f => f.id === funcaoId ? { ...f, confirmado: !confirmadoAtual } : f)
      );
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
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

  const getCategoriaOrdem = (categoria: string) => {
    const ordem: Record<string, number> = {
      lideranca: 1,
      instrumento: 2,
      vocal: 3,
      tecnica: 4,
      apoio: 5
    };
    return ordem[categoria] || 99;
  };

  const tagsPorCategoria = tags.reduce((acc, tag) => {
    if (!acc[tag.categoria]) {
      acc[tag.categoria] = [];
    }
    acc[tag.categoria].push(tag);
    return acc;
  }, {} as Record<string, Tag[]>);

  const categoriasOrdenadas = Object.keys(tagsPorCategoria).sort(
    (a, b) => getCategoriaOrdem(a) - getCategoriaOrdem(b)
  );

  if (totalLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando escala...</p>
        </div>
      </div>
    );
  }

  if (!user || !permissoes.podeGerenciarEscalas || !escala) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mensagem */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg ${
            mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
            mensagem.includes('⚠️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {mensagem}
          </div>
        )}

        {/* Tabela de Funções */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-emerald-600 border-b border-emerald-600">
            <h2 className="text-lg font-bold text-white">
              👥 Atribuir Músicos e Equipe
            </h2>
          </div>

          <div className="p-6 space-y-8">
            {categoriasOrdenadas.map(categoria => (
              <div key={categoria}>
                <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b-2 border-slate-200">
                  {getCategoriaLabel(categoria)}
                </h3>

                <div className="space-y-3">
                  {tagsPorCategoria[categoria].map(tag => {
                    const funcoesDestaTag = funcoesEscala.filter(f => f.tag_id === tag.id);
                    const usuariosDisponiveis = usuariosPorTag[tag.id] || [];

                    return (
                      <div key={tag.id} className="flex items-start gap-3">
                        {/* Label da Função */}
                        <div className="w-40 flex-shrink-0">
                          <label className="block text-sm font-semibold text-slate-700 pt-2">
                            {tag.nome.toUpperCase()}
                          </label>
                        </div>

                        {/* Lista de Pessoas */}
                        <div className="flex-1 space-y-2">
                          {funcoesDestaTag.length > 0 ? (
                            funcoesDestaTag.map((funcao, index) => {
                              const usuario = usuariosDisponiveis.find(u => u.id === funcao.usuario_id);
                              
                              return (
                                <div key={funcao.id} className="flex items-center gap-2">
                                  <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-900">
                                      {usuario?.nome || 'Usuário não encontrado'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => toggleConfirmacao(funcao.id, funcao.confirmado)}
                                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                          funcao.confirmado
                                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {funcao.confirmado ? '✓ Confirmado' : 'Pendente'}
                                      </button>
                                      <button
                                        onClick={() => removerFuncao(funcao.id)}
                                        disabled={salvando}
                                        className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-slate-400 italic py-2">
                              Nenhuma pessoa atribuída
                            </div>
                          )}

                          {/* Adicionar Nova Pessoa */}
                          <div className="flex items-center gap-2">
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  adicionarFuncao(tag.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                              disabled={salvando || usuariosDisponiveis.length === 0}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">
                                {usuariosDisponiveis.length === 0 
                                  ? 'Nenhuma pessoa disponível'
                                  : '+ Adicionar pessoa'
                                }
                              </option>
                              {usuariosDisponiveis
                                .filter(u => !funcoesDestaTag.some(f => f.usuario_id === u.id))
                                .map(usuario => (
                                  <option key={usuario.id} value={usuario.id}>
                                    {usuario.nome}
                                  </option>
                                ))
                              }
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer com Ações */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {funcoesEscala.length} {funcoesEscala.length === 1 ? 'pessoa atribuída' : 'pessoas atribuídas'}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin/escalas')}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}