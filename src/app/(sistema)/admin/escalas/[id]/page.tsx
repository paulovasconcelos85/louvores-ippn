'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { formatPhoneNumber } from '@/lib/phone-mask';

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  ordem_categoria: number;
  ordem: number;
  cor: string;
  icone: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
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
  status: 'rascunho' | 'publicada' | 'concluida';
  culto_id?: number;
  escalas_funcoes: EscalaFuncao[];
}

// Mapeamento de categorias
const CATEGORIAS_INFO = {
  'lideranca_pastor': { nome: '📕 Liderança - Pastor', ordem: 10 },
  'lideranca_presbitero': { nome: '📖 Liderança - Presbíteros', ordem: 12 },
  'lideranca_diacono': { nome: '✝️ Liderança - Diáconos', ordem: 15 },
  'louvor_lideranca': { nome: '🎤 Louvor - Ministração', ordem: 20 },
  'louvor_vocal': { nome: '🎵 Louvor - Vocais', ordem: 30 },
  'louvor_instrumento': { nome: '🎸 Louvor - Instrumentos', ordem: 40 },
  'tecnico_audio': { nome: '🎛️ Técnica - Áudio', ordem: 50 },
  'tecnico_video': { nome: '📽️ Técnica - Vídeo/Mídia', ordem: 51 },
  'apoio_geral': { nome: '🤝 Apoio - Geral', ordem: 60 },
  'ministerio_infantil': { nome: '👶 Ministério Infantil', ordem: 70 },
  'apoio_seguranca': { nome: '🛡️ Apoio - Segurança', ordem: 80 },
};

export default function GerenciarEscalaPage() {
  const router = useRouter();
  const params = useParams();
  const escalaId = params?.id as string;
  
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  
  const [escala, setEscala] = useState<Escala | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  // Estados de edição inline
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoCulto, setTipoCulto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState<'rascunho' | 'publicada' | 'concluida'>('rascunho');
  
  // Modal de adicionar pessoa
  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaParaAdicionar, setCategoriaParaAdicionar] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState('');
  const [funcaoSelecionada, setFuncaoSelecionada] = useState('');
  
  // Listas disponíveis
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([]);
  const [todasTags, setTodasTags] = useState<Tag[]>([]);

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
    if (user && permissoes.podeGerenciarEscalas && escalaId) {
      carregarDados();
    }
  }, [user, permissoes.podeGerenciarEscalas, escalaId]);

  useEffect(() => {
    if (escala) {
      setTitulo(escala.titulo);
      setData(escala.data);
      setHoraInicio(escala.hora_inicio);
      setHoraFim(escala.hora_fim || '');
      setTipoCulto(escala.tipo_culto);
      setObservacoes(escala.observacoes || '');
      setStatus(escala.status);
    }
  }, [escala]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar escala
      const { data: escalaData, error: escalaError } = await supabase
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
              ordem_categoria,
              ordem,
              cor,
              icone
            ),
            pessoas (
              id,
              nome,
              email,
              telefone
            )
          )
        `)
        .eq('id', escalaId)
        .single();

      if (escalaError) throw escalaError;
      
      // Ordenar funções
      if (escalaData.escalas_funcoes) {
        escalaData.escalas_funcoes.sort((a: EscalaFuncao, b: EscalaFuncao) => {
          const catA = a.tags_funcoes.ordem_categoria || 999;
          const catB = b.tags_funcoes.ordem_categoria || 999;
          if (catA !== catB) return catA - catB;
          return (a.tags_funcoes.ordem || 999) - (b.tags_funcoes.ordem || 999);
        });
      }
      
      setEscala(escalaData);
      
      // Carregar usuários
      const { data: usuarios } = await supabase
        .from('pessoas')
        .select('id, nome, email, telefone')
        .eq('ativo', true)
        .order('nome');
      
      setTodosUsuarios(usuarios || []);
      
      // Carregar tags
      const { data: tags } = await supabase
        .from('tags_funcoes')
        .select('*')
        .eq('ativo', true)
        .order('ordem_categoria, ordem');
      
      setTodasTags(tags || []);
      
    } catch (error: any) {
      console.error('Erro ao carregar:', error);
      setMensagem('❌ Erro ao carregar escala');
    } finally {
      setLoading(false);
    }
  };

  const salvarCampos = async () => {
    if (!escala) return;
    
    setSalvando(true);
    setMensagem('');
    
    try {
      const { error } = await supabase
        .from('escalas')
        .update({
          titulo,
          data,
          hora_inicio: horaInicio,
          hora_fim: horaFim || null,
          tipo_culto: tipoCulto,
          observacoes: observacoes || null,
          status,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', escalaId);

      if (error) throw error;
      
      setMensagem('✅ Alterações salvas!');
      setTimeout(() => setMensagem(''), 2000);
      carregarDados();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalAdicionar = (categoria: string) => {
    setCategoriaParaAdicionar(categoria);
    setUsuarioSelecionado('');
    setFuncaoSelecionada('');
    setModalAberto(true);
  };

  const adicionarPessoa = async () => {
    if (!usuarioSelecionado || !funcaoSelecionada || !escala) {
      setMensagem('⚠️ Selecione usuário e função');
      return;
    }

    const usuario = todosUsuarios.find(u => u.id === usuarioSelecionado);
    const tag = todasTags.find(t => t.id === funcaoSelecionada);
    if (!usuario || !tag) return;

    const novaFuncao: EscalaFuncao = {
      id: crypto.randomUUID(), // temporário
      ordem: 0,
      confirmado: false,
      tags_funcoes: tag,
      pessoas: usuario,
    };

    setEscala(prev => ({
      ...prev!,
      escalas_funcoes: [...prev!.escalas_funcoes, novaFuncao]
    }));

    setModalAberto(false);
  };


  const removerPessoa = async (funcaoId: string, nome: string) => {
    if (!confirm(`Remover ${nome} da escala?`) || !escala) return;

    setEscala(prev => ({
      ...prev!,
      escalas_funcoes: prev!.escalas_funcoes.filter(f => f.id !== funcaoId)
    }));

    setMensagem('🗑️ Pessoa removida (pendente de salvar)');
  };


  const toggleConfirmacao = async (funcaoId: string, confirmadoAtual: boolean) => {
    if (!escala) return;

    setEscala(prev => ({
      ...prev!,
      escalas_funcoes: prev!.escalas_funcoes.map(f =>
        f.id === funcaoId ? { ...f, confirmado: !confirmadoAtual } : f
      )
    }));
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

  const agruparPorCategoria = () => {
    if (!escala?.escalas_funcoes) return {};
    
    const grupos: Record<string, EscalaFuncao[]> = {};
    
    escala.escalas_funcoes.forEach(func => {
      const cat = func.tags_funcoes.categoria;
      if (!grupos[cat]) {
        grupos[cat] = [];
      }
      grupos[cat].push(func);
    });
    
    return grupos;
  };

  const getTagsDaCategoria = (categoria: string) => {
    return todasTags.filter(tag => tag.categoria === categoria);
  };

  const enviarParaGrupo = () => {
    if (!escala) return;

    const dataFormatada = new Date(escala.data + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long'
    }).toUpperCase();

    let texto = `*${escala.titulo.toUpperCase()} - ${dataFormatada}*\n\n`;
    texto += `HORARIO: ${escala.hora_inicio}\n`;
    if (escala.culto_id) texto += `CULTO: #${escala.culto_id}\n\n`;

    texto += `Por favor, confirme sua participacao no app Liturgia IPPN\n`;
    texto += `https://liturgia.ippontanegra.com.br/escala/${escala.id}\n\n`;
    texto += `-----------------------------------\n\n`;

    const grupos = agruparPorCategoria();
    const categoriasOrdenadas = Object.keys(grupos).sort((a, b) => {
      const ordemA = CATEGORIAS_INFO[a as keyof typeof CATEGORIAS_INFO]?.ordem || 999;
      const ordemB = CATEGORIAS_INFO[b as keyof typeof CATEGORIAS_INFO]?.ordem || 999;
      return ordemA - ordemB;
    });

    categoriasOrdenadas.forEach(categoria => {
      const funcoes = grupos[categoria];
      const catInfo = CATEGORIAS_INFO[categoria as keyof typeof CATEGORIAS_INFO];
      if (!catInfo || funcoes.length === 0) return;

      texto += `${catInfo.nome.toUpperCase()}\n`;

      funcoes.forEach(func => {
        texto += `- ${func.pessoas.nome} - ${func.tags_funcoes.nome}\n`;
      });

      texto += `\n`;
    });

    texto += `-----------------------------------\n`;
    texto += `Igreja Presbiteriana da Ponta Negra\n`;
    texto += `Uma igreja da familia de Deus`;

    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };


  const salvarEscalaCompleta = async () => {
    if (!escala) return;
    setSalvando(true);
    setMensagem('');

    try {
      await supabase.from('escalas_funcoes').delete().eq('escala_id', escalaId);

      const payload = escala.escalas_funcoes.map(f => ({
        escala_id: escalaId,
        usuario_id: f.pessoas.id,
        tag_id: f.tags_funcoes.id,
        ordem: f.ordem,
        confirmado: f.confirmado
      }));

      const { error } = await supabase.from('escalas_funcoes').insert(payload);
      if (error) throw error;

      setMensagem('✅ Escala salva com sucesso!');
      carregarDados();
    } catch (e:any) {
      setMensagem('❌ Erro ao salvar escala');
    } finally {
      setSalvando(false);
    }
  };


  if (totalLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!escala) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">❌</p>
          <p className="text-slate-600">Escala não encontrada</p>
          <button
            onClick={() => router.push('/admin/escalas')}
            className="mt-4 text-emerald-700 hover:text-emerald-800 font-medium"
          >
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  const grupos = agruparPorCategoria();
  const categoriasOrdenadas = Object.keys(CATEGORIAS_INFO).sort((a, b) => {
    const ordemA = CATEGORIAS_INFO[a as keyof typeof CATEGORIAS_INFO]?.ordem || 999;
    const ordemB = CATEGORIAS_INFO[b as keyof typeof CATEGORIAS_INFO]?.ordem || 999;
    return ordemA - ordemB;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/admin/escalas')}
              className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2"
            >
              <span>←</span>
              <span>Voltar</span>
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={enviarParaGrupo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <span>📱</span>
                <span>Enviar para Grupo</span>
              </button>
            </div>
          </div>

          {/* Mensagem */}
          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              mensagem.includes('⚠️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span>{mensagem}</span>
                <button onClick={() => setMensagem('')} className="text-current opacity-50 hover:opacity-100">✕</button>
              </div>
            </div>
          )}

          {/* Card de Informações Editáveis */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">📝 Informações do Culto</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Título</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hora Início</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hora Fim</label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Culto</label>
                <select
                  value={tipoCulto}
                  onChange={(e) => setTipoCulto(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="dominical_manha">Dominical - Manhã</option>
                  <option value="dominical_noite">Dominical - Noite</option>
                  <option value="quarta">Quarta-feira</option>
                  <option value="especial">Culto Especial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="rascunho">📝 Rascunho</option>
                  <option value="publicada">✅ Publicada</option>
                  <option value="concluida">🎉 Concluída</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none resize-none"
                placeholder="Anotações, instruções especiais..."
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={salvarCampos}
                disabled={salvando}
                className="px-6 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 font-medium"
              >
                {salvando ? 'Salvando...' : '💾 Salvar Alterações'}
              </button>
            </div>
          </div>

          {/* Escalados por Categoria */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>👥</span>
              Equipe Escalada ({escala.escalas_funcoes.length})
            </h2>

            {categoriasOrdenadas.map(categoria => {
              const funcoes = grupos[categoria] || [];
              const catInfo = CATEGORIAS_INFO[categoria as keyof typeof CATEGORIAS_INFO];
              
              if (!catInfo) return null;
              
              return (
                <div key={categoria} className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
                  {/* Header da Categoria */}
                  <div className="bg-slate-100 px-4 py-3 border-b-2 border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-base">
                      {catInfo.nome} ({funcoes.length})
                    </h3>
                    <button
                      onClick={() => abrirModalAdicionar(categoria)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <span className="text-lg">+</span>
                      <span>Adicionar</span>
                    </button>
                  </div>
                  
                  {/* Pessoas da Categoria */}
                  <div className="divide-y divide-slate-100">
                    {funcoes.length === 0 ? (
                      <div className="px-4 py-6 text-center text-slate-400">
                        <p className="text-sm">Nenhuma pessoa escalada</p>
                        <p className="text-xs mt-1">Clique em "+ Adicionar" para escalar alguém</p>
                      </div>
                    ) : (
                      funcoes.map(func => (
                        <div
                          key={func.id}
                          className="px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: func.tags_funcoes.cor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900">
                                  {func.pessoas.nome}
                                </span>
                                <span className="text-sm text-slate-600">
                                  {func.tags_funcoes.icone} {func.tags_funcoes.nome}
                                </span>
                              </div>
                              {func.pessoas.telefone && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  📱 {formatPhoneNumber(func.pessoas.telefone)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleConfirmacao(func.id, func.confirmado)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-colors ${
                                  func.confirmado
                                    ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                }`}
                              >
                                {func.confirmado ? '✅ Confirmado' : '⏳ Pendente'}
                              </button>
                              
                              <button
                                onClick={() => removerPessoa(func.id, func.pessoas.nome)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remover"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end pt-8">
          <button
            onClick={salvarEscalaCompleta}
            className="px-8 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-colors font-semibold shadow"
          >
            💾 Salvar Escala
          </button>
        </div>
      </main>

      {/* Modal Adicionar Pessoa */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-emerald-600 px-6 py-4 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                + Adicionar Pessoa
              </h3>
              <p className="text-emerald-100 text-sm mt-1">
                {CATEGORIAS_INFO[categoriaParaAdicionar as keyof typeof CATEGORIAS_INFO]?.nome}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Pessoa *
                </label>
                <select
                  value={usuarioSelecionado}
                  onChange={(e) => setUsuarioSelecionado(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="">Selecione...</option>
                  {todosUsuarios.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Função *
                </label>
                <select
                  value={funcaoSelecionada}
                  onChange={(e) => setFuncaoSelecionada(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="">Selecione...</option>
                  {getTagsDaCategoria(categoriaParaAdicionar).map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.icone} {tag.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={adicionarPessoa}
                  disabled={!usuarioSelecionado || !funcaoSelecionada || salvando}
                  className="flex-1 bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {salvando ? 'Adicionando...' : 'Adicionar'}
                </button>
                <button
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}