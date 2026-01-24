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
  status: 'pendente' | 'confirmado' | 'recusado';
  ordem: number;
  _isNew?: boolean;
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
  const [funcoesOriginais, setFuncoesOriginais] = useState<EscalaFuncao[]>([]);
  const [funcoesRemovidas, setFuncoesRemovidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [temMudancas, setTemMudancas] = useState(false);

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

      const { data: escalaData, error: escalaError } = await supabase
        .from('escalas')
        .select('*')
        .eq('id', escalaId)
        .single();

      if (escalaError) throw escalaError;
      setEscala(escalaData);

      const { data: tagsData, error: tagsError } = await supabase
        .from('tags_funcoes')
        .select('*')
        .eq('ativo', true)
        .order('ordem');

      if (tagsError) throw tagsError;
      setTags(tagsData || []);

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

      const usuariosPorTagTemp: Record<string, Usuario[]> = {};
      
      for (const tag of tagsData || []) {
        usuariosPorTagTemp[tag.id] = (usuariosTagsData || [])
          .filter((item: any) => item.tag_id === tag.id)
          .map((item: any) => item.usuarios_permitidos)
          .filter((u: any) => u && u.ativo);
      }

      setUsuariosPorTag(usuariosPorTagTemp);

      const { data: funcoesData, error: funcoesError } = await supabase
        .from('escalas_funcoes')
        .select('*')
        .eq('escala_id', escalaId);

      if (funcoesError) throw funcoesError;
      
      setFuncoesEscala(funcoesData || []);
      setFuncoesOriginais(funcoesData || []);
      setFuncoesRemovidas([]);
      setTemMudancas(false);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      setMensagem('❌ Erro ao carregar dados da escala');
    } finally {
      setLoading(false);
    }
  };

  const adicionarFuncao = (tagId: string, usuarioId: string) => {
    if (!usuarioId) return;

    const funcoesDestaTag = funcoesEscala.filter(f => f.tag_id === tagId);
    const ordem = funcoesDestaTag.length;

    const novaFuncao: EscalaFuncao = {
      id: `temp_${Date.now()}_${Math.random()}`,
      tag_id: tagId,
      usuario_id: usuarioId,
      ordem,
      confirmado: false,
      status: 'pendente',
      _isNew: true
    };

    setFuncoesEscala(prev => [...prev, novaFuncao]);
    setTemMudancas(true);
    setMensagem('');
  };

  const removerFuncao = (funcaoId: string) => {
    const funcao = funcoesEscala.find(f => f.id === funcaoId);
    
    if (funcao?._isNew) {
      setFuncoesEscala(prev => prev.filter(f => f.id !== funcaoId));
    } else {
      setFuncoesEscala(prev => prev.filter(f => f.id !== funcaoId));
      setFuncoesRemovidas(prev => [...prev, funcaoId]);
    }
    
    setTemMudancas(true);
    setMensagem('');
  };

  const alterarStatus = (funcaoId: string, novoStatus: 'pendente' | 'confirmado' | 'recusado') => {
    setFuncoesEscala(prev => 
      prev.map(f => f.id === funcaoId ? { 
        ...f, 
        status: novoStatus,
        confirmado: novoStatus === 'confirmado'
      } : f)
    );
    setTemMudancas(true);
  };

  const cancelarMudancas = () => {
    setFuncoesEscala(funcoesOriginais);
    setFuncoesRemovidas([]);
    setTemMudancas(false);
    setMensagem('↩️ Mudanças descartadas');
  };

  const salvarTodasMudancas = async () => {
    try {
      setSalvando(true);
      setMensagem('💾 Salvando alterações...');

      if (funcoesRemovidas.length > 0) {
        const { error: deleteError } = await supabase
          .from('escalas_funcoes')
          .delete()
          .in('id', funcoesRemovidas);

        if (deleteError) throw deleteError;
      }

      const novasFuncoes = funcoesEscala.filter(f => f._isNew);
      if (novasFuncoes.length > 0) {
        const { error: insertError } = await supabase
          .from('escalas_funcoes')
          .insert(
            novasFuncoes.map(f => ({
              escala_id: escalaId,
              tag_id: f.tag_id,
              usuario_id: f.usuario_id,
              ordem: f.ordem,
              confirmado: f.confirmado,
              status: f.status
            }))
          );

        if (insertError) throw insertError;
      }

      const funcoesParaAtualizar = funcoesEscala.filter(f => !f._isNew);
      for (const funcao of funcoesParaAtualizar) {
        const original = funcoesOriginais.find(o => o.id === funcao.id);
        if (original && (original.confirmado !== funcao.confirmado || original.status !== funcao.status)) {
          const { error: updateError } = await supabase
            .from('escalas_funcoes')
            .update({ 
              confirmado: funcao.confirmado,
              status: funcao.status
            })
            .eq('id', funcao.id);

          if (updateError) throw updateError;
        }
      }

      setMensagem('✅ Todas as alterações foram salvas com sucesso!');
      await carregarDados();
      
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setMensagem(`❌ Erro ao salvar: ${error.message}`);
    } finally {
      setSalvando(false);
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

  // Contar recusados
  const totalRecusados = funcoesEscala.filter(f => f.status === 'recusado').length;

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mensagem */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg ${
            mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
            mensagem.includes('⚠️') || mensagem.includes('↩️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
            mensagem.includes('💾') ? 'bg-blue-50 text-blue-800 border border-blue-200' :
            'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {mensagem}
          </div>
        )}

        {/* Alerta de recusados */}
        {totalRecusados > 0 && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <p className="font-bold text-red-900">
                  {totalRecusados} {totalRecusados === 1 ? 'pessoa informou' : 'pessoas informaram'} que não {totalRecusados === 1 ? 'pode' : 'podem'} participar
                </p>
                <p className="text-sm text-red-700">
                  Verifique abaixo quem não poderá comparecer e ajuste a escala conforme necessário.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner de mudanças pendentes */}
        {temMudancas && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-amber-800 font-semibold">⚠️ Você tem alterações não salvas</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarMudancas}
                disabled={salvando}
                className="px-4 py-2 text-sm border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={salvarTodasMudancas}
                disabled={salvando}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-semibold"
              >
                {salvando ? '💾 Salvando...' : '💾 Salvar Tudo'}
              </button>
            </div>
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
                        <div className="w-40 flex-shrink-0">
                          <label className="block text-sm font-semibold text-slate-700 pt-2">
                            {tag.nome.toUpperCase()}
                          </label>
                        </div>

                        <div className="flex-1 space-y-2">
                          {funcoesDestaTag.length > 0 ? (
                            funcoesDestaTag.map((funcao) => {
                              const usuario = usuariosDisponiveis.find(u => u.id === funcao.usuario_id);
                              
                              return (
                                <div key={funcao.id} className="flex items-center gap-2">
                                  <div className={`flex-1 px-3 py-2 border-2 rounded-lg flex items-center justify-between ${
                                    funcao.status === 'recusado' 
                                      ? 'bg-red-50 border-red-400'
                                      : funcao._isNew 
                                        ? 'bg-green-50 border-green-300' 
                                        : 'bg-slate-50 border-slate-200'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      {funcao._isNew && (
                                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded font-semibold">
                                          NOVO
                                        </span>
                                      )}
                                      <span className="text-sm font-medium text-slate-900">
                                        {usuario?.nome || 'Usuário não encontrado'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={funcao.status}
                                        onChange={(e) => alterarStatus(funcao.id, e.target.value as any)}
                                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors border ${
                                          funcao.status === 'confirmado'
                                            ? 'bg-green-100 text-green-800 border-green-300'
                                            : funcao.status === 'recusado'
                                              ? 'bg-red-100 text-red-800 border-red-300'
                                              : 'bg-gray-100 text-gray-600 border-gray-300'
                                        }`}
                                      >
                                        <option value="pendente">⏳ Pendente</option>
                                        <option value="confirmado">✓ Confirmado</option>
                                        <option value="recusado">✗ Recusado</option>
                                      </select>
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

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {funcoesEscala.length} {funcoesEscala.length === 1 ? 'pessoa atribuída' : 'pessoas atribuídas'}
              {totalRecusados > 0 && (
                <span className="ml-2 text-red-600 font-semibold">
                  ({totalRecusados} recusou{totalRecusados > 1 ? 'ram' : ''})
                </span>
              )}
              {temMudancas && (
                <span className="ml-2 text-amber-600 font-semibold">
                  (não salvo)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin/escalas')}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
              >
                Voltar
              </button>
              {temMudancas && (
                <button
                  onClick={salvarTodasMudancas}
                  disabled={salvando}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50"
                >
                  {salvando ? '💾 Salvando...' : '💾 Salvar Alterações'}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}