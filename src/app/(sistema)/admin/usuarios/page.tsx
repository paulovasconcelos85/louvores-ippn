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

type SortField = 'nome' | 'email' | 'telefone' | 'cargo' | 'ativo' | 'criado_em';
type SortDirection = 'asc' | 'desc';

export default function GerenciarUsuarios() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();
  
  // Estados principais
  const [usuarios, setUsuarios] = useState<UsuarioComTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviandoConvite, setEnviandoConvite] = useState<string | null>(null);

  // Estados de ordenação e filtro
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  // Estados para Novo Usuário
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoCargo, setNovoCargo] = useState<CargoTipo>('musico');
  
  // Estados para Edição
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioPermitido | null>(null);
  const [editandoNome, setEditandoNome] = useState('');
  const [editandoTelefone, setEditandoTelefone] = useState('');
  const [editandoCargo, setEditandoCargo] = useState<CargoTipo>('musico');
  
  // Estados para tags
  const [todasTags, setTodasTags] = useState<Tag[]>([]);
  const [tagsUsuario, setTagsUsuario] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const totalLoading = authLoading || permLoading;

  // 1. Verificação de Segurança
  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }

    if (!totalLoading && user && !permissoes.podeGerenciarUsuarios) {
      router.push('/admin');
    }
  }, [user, totalLoading, permissoes.podeGerenciarUsuarios, router]);

  // 2. Carregamento Inicial
  useEffect(() => {
    if (user && permissoes.podeGerenciarUsuarios) {
      carregarUsuarios();
      carregarTodasTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, permissoes.podeGerenciarUsuarios]);

  // --- FUNÇÕES DE DADOS ---

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios_permitidos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Carregar tags para cada usuário
      const usuariosComTags = await Promise.all(
        (data || []).map(async (usuario) => {
          const { data: tagsData } = await supabase
            .from('usuarios_tags')
            .select('tag_id, tags_funcoes(id, nome, categoria, cor)')
            .eq('usuario_id', usuario.id);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tagsFormatadas = tagsData?.map((t: any) => t.tags_funcoes).filter(Boolean) || [];

          return {
            ...usuario,
            tags: tagsFormatadas
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
    } catch (error) {
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
    } catch (error) {
      console.error('Erro ao carregar tags do usuário:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  // --- FUNÇÕES DE ORDENAÇÃO E FILTRO ---

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const usuariosFiltrados = usuarios
    .filter(u => {
      // Filtro de status ativo/inativo
      if (!mostrarInativos && !u.ativo) return false;
      
      // Filtro de busca por texto
      if (filtroTexto === '') return true;
      const busca = filtroTexto.toLowerCase();
      return (
        u.nome.toLowerCase().includes(busca) ||
        u.email.toLowerCase().includes(busca) ||
        getCargoLabel(u.cargo).toLowerCase().includes(busca) ||
        (u.telefone && formatPhoneNumber(u.telefone).includes(busca))
      );
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'cargo') {
        aValue = getCargoLabel(a.cargo);
        bValue = getCargoLabel(b.cargo);
      }

      if (sortField === 'telefone') {
        aValue = a.telefone || '';
        bValue = b.telefone || '';
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  // --- AÇÕES ---

  const toggleTag = async (tagId: string) => {
    if (!usuarioEditando) return;

    const jaTemTag = tagsUsuario.includes(tagId);

    try {
      if (jaTemTag) {
        const { error } = await supabase
          .from('usuarios_tags')
          .delete()
          .eq('usuario_id', usuarioEditando.id)
          .eq('tag_id', tagId);

        if (error) throw error;
        setTagsUsuario(prev => prev.filter(t => t !== tagId));
      } else {
        const { error } = await supabase
          .from('usuarios_tags')
          .insert({
            usuario_id: usuarioEditando.id,
            tag_id: tagId,
            nivel_habilidade: 1
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
      setMostrarFormulario(false);
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

  const enviarConvite = async (usuario: UsuarioPermitido) => {
    if (!confirm(`Enviar convite de acesso para ${usuario.nome} (${usuario.email})?`)) {
      return;
    }

    setEnviandoConvite(usuario.id);
    setMensagem('');

    try {
      const response = await fetch('/api/enviar-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: usuario.email,
          nome: usuario.nome
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar convite');
      }

      setMensagem(`✅ Convite enviado para ${usuario.email}! O usuário receberá um email para definir a senha.`);
    } catch (error: any) {
      console.error('Erro ao enviar convite:', error);
      setMensagem(`❌ Erro ao enviar convite: ${error.message}`);
    } finally {
      setEnviandoConvite(null);
    }
  };

  // --- MODAL DE EDIÇÃO ---

  const abrirModalEdicao = (usuario: UsuarioComTags) => {
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

  // --- RENDERIZAÇÃO ---

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Gerenciar Usuários</h1>
              <p className="text-slate-600 mt-1">Controle de acesso e permissões do sistema</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← Voltar
            </button>
          </div>

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
                  ⭐ Super Admin
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
              <div className="flex items-center justify-between">
                <span>{mensagem}</span>
                <button
                  onClick={() => setMensagem('')}
                  className="text-current opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Botão Adicionar */}
          <div className="flex justify-end">
            <button
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium flex items-center gap-2"
            >
              {mostrarFormulario ? '✕ Cancelar' : '➕ Adicionar Usuário'}
            </button>
          </div>

          {/* Formulário Adicionar (Colapsável) */}
          {mostrarFormulario && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span>➕</span>
                Novo Usuário
              </h3>
              <form onSubmit={adicionarUsuario} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      E-mail *
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
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={novoTelefone}
                      onChange={(e) => setNovoTelefone(formatPhoneNumber(e.target.value))}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                      placeholder="(92) 98139-4605"
                    />
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
          )}

          {/* Tabela de Usuários */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>👥</span>
                  Usuários Cadastrados
                  <span className="ml-2 text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
                    {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuário' : 'usuários'}
                  </span>
                </h3>
              </div>
            </div>

            <div className="p-6">
              {/* Filtros */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nome, email, cargo ou telefone..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={mostrarInativos}
                    onChange={(e) => setMostrarInativos(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700 font-medium whitespace-nowrap">
                    Mostrar inativos
                  </span>
                </label>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto"></div>
                  <p className="mt-2 text-slate-600">Carregando usuários...</p>
                </div>
              ) : usuariosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th 
                          onClick={() => handleSort('nome')}
                          className="text-left px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            Nome {getSortIcon('nome')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('email')}
                          className="text-left px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors hidden lg:table-cell"
                        >
                          <div className="flex items-center gap-2">
                            Email {getSortIcon('email')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('telefone')}
                          className="text-left px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors hidden xl:table-cell"
                        >
                          <div className="flex items-center gap-2">
                            Telefone {getSortIcon('telefone')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('cargo')}
                          className="text-left px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            Cargo {getSortIcon('cargo')}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('ativo')}
                          className="text-center px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors hidden md:table-cell"
                        >
                          <div className="flex items-center justify-center gap-2">
                            Status {getSortIcon('ativo')}
                          </div>
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-700">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosFiltrados.map((usuario) => (
                        <tr 
                          key={usuario.id}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            !usuario.ativo ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{usuario.nome}</div>
                            <div className="text-sm text-slate-500 lg:hidden">{usuario.email}</div>
                            {usuario.tags && usuario.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {usuario.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600"
                                  >
                                    {tag.nome}
                                  </span>
                                ))}
                                {usuario.tags.length > 2 && (
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                                    +{usuario.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm hidden lg:table-cell">
                            {usuario.email}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm hidden xl:table-cell">
                            {usuario.telefone ? formatPhoneNumber(usuario.telefone) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCargoCor(usuario.cargo)}`}>
                              {getCargoIcone(usuario.cargo)} {getCargoLabel(usuario.cargo)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            {usuario.ativo ? (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                ✓ Ativo
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                ✗ Inativo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => enviarConvite(usuario)}
                                disabled={enviandoConvite === usuario.id || !usuario.ativo}
                                className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Enviar convite"
                              >
                                {enviandoConvite === usuario.id ? (
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <span className="text-lg">📧</span>
                                )}
                              </button>
                              
                              <button
                                onClick={() => abrirModalEdicao(usuario)}
                                className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                                title="Editar"
                              >
                                <span className="text-lg">✏️</span>
                              </button>

                              <button
                                onClick={() => alterarStatus(usuario.id, !usuario.ativo)}
                                className={`p-1.5 rounded transition-colors ${
                                  usuario.ativo
                                    ? 'hover:bg-yellow-50 text-yellow-600'
                                    : 'hover:bg-green-50 text-green-600'
                                }`}
                                title={usuario.ativo ? 'Desativar' : 'Ativar'}
                              >
                                <span className="text-lg">{usuario.ativo ? '⏸️' : '▶️'}</span>
                              </button>

                              <button
                                onClick={() => removerUsuario(usuario.id, usuario.email, usuario.nome)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                                title="Remover"
                              >
                                <span className="text-lg">🗑️</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                  <li>✓ Administrador</li>
                  <li>✓ Super-Admins (hardcoded)</li>
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
                    disabled={salvando}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={editandoTelefone}
                    onChange={(e) => setEditandoTelefone(formatPhoneNumber(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    disabled={salvando}
                  />
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