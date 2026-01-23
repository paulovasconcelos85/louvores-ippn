'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { CargoTipo, getCargoLabel, getCargoCor, getCargoIcone } from '@/lib/permissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';

interface UsuarioPermitido {
  id: string;
  email: string;
  nome: string;
  cargo: CargoTipo;
  ativo: boolean;
  criado_em: string;
  telefone?: string;
  observacoes?: string;
}

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  cor: string;
  icone: string;
  ordem: number;
  ativo: boolean;
}

interface UsuarioComTags extends UsuarioPermitido {
  tags?: Tag[];
}

export default function GerenciarUsuarios() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();
  const [usuarios, setUsuarios] = useState<UsuarioComTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoCargo, setNovoCargo] = useState<CargoTipo>('musico');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  // Estados para edição
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioPermitido | null>(null);
  const [editandoNome, setEditandoNome] = useState('');
  const [editandoTelefone, setEditandoTelefone] = useState('');
  const [editandoCargo, setEditandoCargo] = useState<CargoTipo>('musico');
  
  // Estados para tags
  const [todasTags, setTodasTags] = useState<any[]>([]);
  const [tagsUsuario, setTagsUsuario] = useState<string[]>([]); // IDs das tags que o usuário tem
  const [loadingTags, setLoadingTags] = useState(false);

  const totalLoading = authLoading || permLoading;

  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }

    // Redireciona se não tem permissão para gerenciar usuários
    if (!totalLoading && user && !permissoes.podeGerenciarUsuarios) {
      router.push('/admin');
    }
  }, [user, totalLoading, permissoes.podeGerenciarUsuarios, router]);

  useEffect(() => {
    if (user && permissoes.podeGerenciarUsuarios) {
      carregarUsuarios();
      carregarTodasTags();
    }
  }, [user, permissoes.podeGerenciarUsuarios]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  // Função para formatar telefone brasileiro
  const formatarTelefone = (valor: string) => {
    // Remove tudo que não é número
    const numeros = valor.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + 9 dígitos)
    const numeroLimitado = numeros.slice(0, 11);
    
    // Aplica a máscara
    if (numeroLimitado.length <= 10) {
      // Formato fixo: (XX) XXXX-XXXX
      return numeroLimitado
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      // Formato celular: (XX) XXXXX-XXXX
      return numeroLimitado
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const valorFormatado = formatarTelefone(e.target.value);
    setter(valorFormatado);
  };

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios_permitidos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Buscar tags de cada usuário
      const usuariosComTags = await Promise.all(
        (data || []).map(async (usuario) => {
          const { data: tagsData } = await supabase
            .from('usuarios_tags')
            .select('tag_id, tags_funcoes(id, nome, categoria, cor)')
            .eq('usuario_id', usuario.id);

          return {
            ...usuario,
            tags: tagsData?.map(t => t.tags_funcoes).filter(Boolean) || []
          };
        })
      );

      setUsuarios(usuariosComTags);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      setMensagem('❌ Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const carregarTodasTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags_funcoes')
        .select('*')
        .eq('ativo', true)
        .order('ordem');

      if (error) throw error;
      setTodasTags(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const carregarTagsUsuario = async (usuarioId: string) => {
    try {
      setLoadingTags(true);
      const { data, error } = await supabase
        .from('usuarios_tags')
        .select('tag_id')
        .eq('usuario_id', usuarioId);

      if (error) throw error;
      setTagsUsuario(data?.map(t => t.tag_id) || []);
    } catch (error: any) {
      console.error('Erro ao carregar tags do usuário:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  const toggleTag = async (tagId: string) => {
    if (!usuarioEditando) return;

    const jaTemTag = tagsUsuario.includes(tagId);

    try {
      if (jaTemTag) {
        // Remover tag
        const { error } = await supabase
          .from('usuarios_tags')
          .delete()
          .eq('usuario_id', usuarioEditando.id)
          .eq('tag_id', tagId);

        if (error) throw error;
        setTagsUsuario(prev => prev.filter(t => t !== tagId));
      } else {
        // Adicionar tag
        const { error } = await supabase
          .from('usuarios_tags')
          .insert({
            usuario_id: usuarioEditando.id,
            tag_id: tagId,
            nivel_habilidade: 1 // padrão: básico
          });

        if (error) throw error;
        setTagsUsuario(prev => [...prev, tagId]);
      }
    } catch (error: any) {
      console.error('Erro ao alterar tag:', error);
      setMensagem(`❌ Erro ao ${jaTemTag ? 'remover' : 'adicionar'} habilidade`);
    }
  };

  const adicionarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .insert({
          email: novoEmail.toLowerCase().trim(),
          nome: novoNome.trim(),
          telefone: novoTelefone ? unformatPhoneNumber(novoTelefone.trim()) : null,
          cargo: novoCargo,
          ativo: true,
          criado_por: user?.id,
        });

      if (error) throw error;

      setMensagem(`✅ ${novoNome} adicionado como ${getCargoLabel(novoCargo)}!`);
      setNovoEmail('');
      setNovoNome('');
      setNovoTelefone('');
      setNovoCargo('musico');
      carregarUsuarios();
    } catch (error: any) {
      if (error.code === '23505') {
        setMensagem('❌ Este email já está cadastrado');
      } else {
        setMensagem(`❌ Erro: ${error.message}`);
      }
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .update({ ativo, atualizado_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setMensagem(ativo ? '✅ Usuário ativado' : '⚠️ Usuário desativado');
      carregarUsuarios();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const removerUsuario = async (id: string, email: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja REMOVER ${nome} (${email})?\n\nEssa pessoa não poderá mais fazer login.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMensagem('🗑️ Usuário removido com sucesso');
      carregarUsuarios();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const abrirModalEdicao = (usuario: UsuarioPermitido) => {
    setUsuarioEditando(usuario);
    setEditandoNome(usuario.nome);
    setEditandoTelefone(usuario.telefone ? formatPhoneNumber(usuario.telefone) : '');
    setEditandoCargo(usuario.cargo);
    carregarTagsUsuario(usuario.id);
  };

  const fecharModalEdicao = () => {
    setUsuarioEditando(null);
    setEditandoNome('');
    setEditandoTelefone('');
    setEditandoCargo('musico');
    setTagsUsuario([]);
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditando) return;

    setSalvando(true);
    setMensagem('');

    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .update({
          nome: editandoNome.trim(),
          telefone: editandoTelefone ? unformatPhoneNumber(editandoTelefone.trim()) : null,
          cargo: editandoCargo,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', usuarioEditando.id);

      if (error) throw error;

      setMensagem(`✅ ${editandoNome} atualizado com sucesso!`);
      fecharModalEdicao();
      carregarUsuarios();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  if (totalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user || !permissoes.podeGerenciarUsuarios) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Info do usuário logado */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-emerald-800">
                👤 Logado como: <span className="font-semibold">{usuarioPermitido?.nome || user.email}</span>
              </p>
              {usuarioPermitido?.cargo && (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getCargoCor(usuarioPermitido.cargo)}`}>
                  {getCargoIcone(usuarioPermitido.cargo)} {getCargoLabel(usuarioPermitido.cargo)}
                </span>
              )}
              {permissoes.isSuperAdmin && (
                <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-900 border border-yellow-300">
                  ⭐ Super Admin (Lista Hardcoded)
                </span>
              )}
            </div>
          </div>

          {/* Mensagem */}
          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              mensagem.includes('⚠️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {mensagem}
            </div>
          )}

          {/* Formulário Adicionar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span>➕</span>
              Adicionar Novo Usuário
            </h3>
            <form onSubmit={adicionarUsuario} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    E-mail * <span className="text-xs text-slate-500">(usado para login)</span>
                  </label>
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="usuario@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="João da Silva"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Telefone <span className="text-xs text-slate-500">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(formatPhoneNumber(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="(92) 98139-4605 ou +1 (555) 123-4567"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    💡 Detecta automaticamente BR ou EUA/Canadá
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cargo / Função *
                  </label>
                  <select
                    value={novoCargo}
                    onChange={(e) => setNovoCargo(e.target.value as CargoTipo)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                  >
                    <option value="musico">🎵 Músico/Cantor</option>
                    <option value="seminarista">📚 Seminarista</option>
                    <option value="presbitero">👔 Presbítero</option>
                    <option value="staff">🛠️ Staff/Equipe</option>
                    <option value="pastor">📖 Pastor</option>
                    <option value="admin">🔐 Administrador</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {novoCargo === 'admin' && '⚠️ Admin pode gerenciar usuários e escalas'}
                    {novoCargo === 'pastor' && '📖 Pastor pode criar escalas e gerenciar conteúdo'}
                    {novoCargo === 'presbitero' && '👔 Presbítero pode criar escalas e gerenciar conteúdo'}
                    {novoCargo === 'staff' && '🛠️ Staff pode criar escalas'}
                    {novoCargo === 'musico' && '🎵 Músico pode acessar o sistema'}
                    {novoCargo === 'seminarista' && '📚 Seminarista pode acessar o sistema'}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="w-full sm:w-auto bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {salvando ? 'Adicionando...' : 'Adicionar Usuário'}
              </button>
            </form>
          </div>

          {/* Lista de Usuários */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Usuários Cadastrados ({usuarios.length})
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {usuarios.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Nenhum usuário cadastrado ainda
                  </div>
                ) : (
                  usuarios.map((usuario) => (
                    <div
                      key={usuario.id}
                      className="p-6 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h4 className="text-lg font-medium text-slate-900">
                              {usuario.nome}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getCargoCor(usuario.cargo)}`}>
                              {getCargoIcone(usuario.cargo)} {getCargoLabel(usuario.cargo)}
                            </span>
                            {!usuario.ativo && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">
                                ⚠️ Desativado
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 text-sm mb-1">📧 {usuario.email}</p>
                          {usuario.telefone && (
                            <p className="text-slate-600 text-sm mb-1">📱 {formatPhoneNumber(usuario.telefone)}</p>
                          )}
                          {usuario.tags && usuario.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {usuario.tags.slice(0, 4).map((tag: any) => (
                                <span
                                  key={tag.id}
                                  className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700"
                                >
                                  {tag.nome}
                                </span>
                              ))}
                              {usuario.tags.length > 4 && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                                  +{usuario.tags.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-slate-400 text-xs mt-1">
                            Adicionado em {new Date(usuario.criado_em).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => abrirModalEdicao(usuario)}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-all"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => alterarStatus(usuario.id, !usuario.ativo)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                              usuario.ativo
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                          >
                            {usuario.ativo ? '⏸️ Desativar' : '▶️ Ativar'}
                          </button>
                          <button
                            onClick={() => removerUsuario(usuario.id, usuario.email, usuario.nome)}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-all"
                          >
                            🗑️ Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Informações sobre Cargos */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span>ℹ️</span>
              Sobre os Cargos e Permissões
            </h4>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <p className="font-medium mb-2">🔐 Acesso ao Painel Admin:</p>
                <ul className="space-y-1 pl-4">
                  <li>✓ Pastor, Presbítero, Músico</li>
                  <li>✓ Seminarista, Staff, Admin</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">👥 Gerenciar Usuários:</p>
                <ul className="space-y-1 pl-4">
                  <li>✓ Administrador (cargo no banco)</li>
                  <li>✓ Super-Admins (lista hardcoded)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">📋 Criar/Editar Escalas:</p>
                <ul className="space-y-1 pl-4">
                  <li>✓ Pastor, Presbítero</li>
                  <li>✓ Staff, Admin</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">🎵 Gerenciar Músicas/Cultos:</p>
                <ul className="space-y-1 pl-4">
                  <li>✓ Todos com acesso ao admin</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-xs text-blue-700">
                💡 <strong>Dica:</strong> Usuários desativados mantêm seus dados mas não conseguem fazer login.
                Remover um usuário é permanente e apaga todas as suas informações.
              </p>
              {permissoes.isSuperAdmin && (
                <p className="text-xs text-yellow-800 mt-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                  ⭐ <strong>Super-Admin:</strong> Você está na lista hardcoded de <code className="bg-yellow-100 px-1 rounded">ADMIN_EMAILS</code> no arquivo <code className="bg-yellow-100 px-1 rounded">admin-config.ts</code>. 
                  Isso significa que você sempre terá acesso total, mesmo sem estar cadastrado no banco de dados.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Edição */}
        {usuarioEditando && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">✏️ Editar Usuário</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Editando: <span className="font-semibold">{usuarioEditando.email}</span>
                  </p>
                </div>
                <button
                  onClick={fecharModalEdicao}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                  disabled={salvando}
                >
                  <span className="text-slate-500">✕</span>
                </button>
              </div>

              <form onSubmit={salvarEdicao} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    E-mail (não editável)
                  </label>
                  <input
                    type="email"
                    value={usuarioEditando.email}
                    disabled
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    💡 O email não pode ser alterado após o cadastro
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="João da Silva"
                    disabled={salvando}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Telefone <span className="text-xs text-slate-500">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    value={editandoTelefone}
                    onChange={(e) => setEditandoTelefone(formatPhoneNumber(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="(92) 98139-4605 ou +1 (555) 123-4567"
                    disabled={salvando}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    💡 Detecta automaticamente BR ou EUA/Canadá
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cargo / Função *
                  </label>
                  <select
                    value={editandoCargo}
                    onChange={(e) => setEditandoCargo(e.target.value as CargoTipo)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    disabled={salvando}
                  >
                    <option value="musico">🎵 Músico/Cantor</option>
                    <option value="seminarista">📚 Seminarista</option>
                    <option value="presbitero">👔 Presbítero</option>
                    <option value="staff">🛠️ Staff/Equipe</option>
                    <option value="pastor">📖 Pastor</option>
                    <option value="admin">🔐 Administrador</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {editandoCargo === 'admin' && '⚠️ Admin pode gerenciar usuários e escalas'}
                    {editandoCargo === 'pastor' && '📖 Pastor pode criar escalas e gerenciar conteúdo'}
                    {editandoCargo === 'presbitero' && '👔 Presbítero pode criar escalas e gerenciar conteúdo'}
                    {editandoCargo === 'staff' && '🛠️ Staff pode criar escalas'}
                    {editandoCargo === 'musico' && '🎵 Músico pode acessar o sistema'}
                    {editandoCargo === 'seminarista' && '📚 Seminarista pode acessar o sistema'}
                  </p>
                </div>

                {/* Seção de Tags/Habilidades */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-700">
                      🎵 Habilidades & Funções
                    </label>
                    {loadingTags && (
                      <span className="text-xs text-slate-500">Carregando...</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Marque as habilidades e funções que esta pessoa pode exercer
                  </p>

                  {/* Agrupar tags por categoria */}
                  <div className="space-y-4">
                    {['lideranca', 'instrumento', 'vocal', 'tecnica', 'apoio'].map(categoria => {
                      const tagsDaCategoria = todasTags.filter(tag => tag.categoria === categoria);
                      if (tagsDaCategoria.length === 0) return null;

                      const categoriaLabels: Record<string, string> = {
                        lideranca: '📖 Liderança',
                        instrumento: '🎸 Instrumentos',
                        vocal: '🎤 Vozes',
                        tecnica: '🎛️ Técnica',
                        apoio: '👥 Apoio'
                      };

                      return (
                        <div key={categoria} className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-slate-700 mb-2">
                            {categoriaLabels[categoria]}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {tagsDaCategoria.map(tag => (
                              <label
                                key={tag.id}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                  tagsUsuario.includes(tag.id)
                                    ? 'bg-emerald-100 border-2 border-emerald-600'
                                    : 'bg-white border-2 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={tagsUsuario.includes(tag.id)}
                                  onChange={() => toggleTag(tag.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  disabled={loadingTags}
                                />
                                <span className={`text-sm ${
                                  tagsUsuario.includes(tag.id)
                                    ? 'font-semibold text-emerald-900'
                                    : 'text-slate-700'
                                }`}>
                                  {tag.nome}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {todasTags.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      Nenhuma habilidade cadastrada ainda
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="flex-1 bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button
                    type="button"
                    onClick={fecharModalEdicao}
                    disabled={salvando}
                    className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}