'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { usePessoas, Pessoa } from '@/hooks/usePessoas';
import { CargoTipo, getCargoLabel, getCargoCor, getCargoIcone } from '@/lib/permissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  cor: string;
  icone: string;
}

type SortField = 'nome' | 'email' | 'telefone' | 'cargo' | 'ativo' | 'tem_acesso';
type SortDirection = 'asc' | 'desc';

export default function GerenciarPessoas() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();
  const { 
    pessoas, 
    loading: pessoasLoading, 
    listarPessoas, 
    criarPessoa, 
    atualizarPessoa, 
    deletarPessoa,
    enviarConvite: enviarConviteHook 
  } = usePessoas();

  // Estados principais
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviandoConvite, setEnviandoConvite] = useState<string | null>(null);

  // Estados de ordenação e filtro
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [filtroAcesso, setFiltroAcesso] = useState<'todos' | 'com_acesso' | 'sem_acesso'>('todos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  // Estados para Nova Pessoa
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoCargo, setNovoCargo] = useState<CargoTipo>('musico');
  const [criarFantasma, setcriarFantasma] = useState(false);

  // Estados para Edição
  const [pessoaEditando, setPessoaEditando] = useState<Pessoa | null>(null);
  const [editandoNome, setEditandoNome] = useState('');
  const [editandoEmail, setEditandoEmail] = useState('');
  const [editandoTelefone, setEditandoTelefone] = useState('');
  const [editandoCargo, setEditandoCargo] = useState<CargoTipo>('musico');

  // Estados para tags
  const [todasTags, setTodasTags] = useState<Tag[]>([]);
  const [tagsUsuario, setTagsUsuario] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

    // Estados para Modal de Convite
  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [emailConvidado, setEmailConvidado] = useState('');

  const totalLoading = authLoading || permLoading;

  // Verificação de Segurança
  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }

    if (!totalLoading && user && !permissoes.podeGerenciarUsuarios) {
      router.push('/admin');
    }
  }, [user, totalLoading, permissoes.podeGerenciarUsuarios, router]);

  // Carregamento Inicial
  useEffect(() => {
    if (user && permissoes.podeGerenciarUsuarios) {
      listarPessoas();
      carregarTodasTags();
    }
  }, [user, permissoes.podeGerenciarUsuarios]);

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

  const carregarTagsUsuario = async (pessoaId: string) => {
    try {
      setLoadingTags(true);
      const { data, error } = await supabase
        .from('usuarios_tags')
        .select('tag_id')
        .eq('pessoa_id', pessoaId);

      if (error) throw error;
      setTagsUsuario(data?.map(t => t.tag_id) || []);
    } catch (error) {
      console.error('Erro ao carregar tags da pessoa:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  // Ordenação e Filtro
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

  const pessoasFiltradas = pessoas
    .filter(p => {
      // Filtro ativo/inativo
      if (!mostrarInativos && !p.ativo) return false;

      // Filtro de acesso
      if (filtroAcesso === 'com_acesso' && !p.tem_acesso) return false;
      if (filtroAcesso === 'sem_acesso' && p.tem_acesso) return false;

      // Busca por texto
      if (filtroTexto === '') return true;
      const busca = filtroTexto.toLowerCase();
      return (
        p.nome.toLowerCase().includes(busca) ||
        (p.email && p.email.toLowerCase().includes(busca)) ||
        getCargoLabel(p.cargo as CargoTipo).toLowerCase().includes(busca) ||
        (p.telefone && formatPhoneNumber(p.telefone).includes(busca))
      );
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'cargo') {
        aValue = getCargoLabel(a.cargo);
        bValue = getCargoLabel(b.cargo);
      }

      if (sortField === 'email') {
        aValue = a.email || '';
        bValue = b.email || '';
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

  // Ações
  const toggleTag = async (tagId: string) => {
    if (!pessoaEditando) return;

    const jaTemTag = tagsUsuario.includes(tagId);

    try {
      if (jaTemTag) {
        const { error } = await supabase
          .from('usuarios_tags')
          .delete()
          .eq('pessoa_id', pessoaEditando.id)
          .eq('tag_id', tagId);

        if (error) throw error;
        setTagsUsuario(prev => prev.filter(t => t !== tagId));
      } else {
        const { error } = await supabase
          .from('usuarios_tags')
          .insert({
            pessoa_id: pessoaEditando.id,
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

  const adicionarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      const resultado = await criarPessoa({
        nome: novoNome.trim(),
        cargo: novoCargo,
        email: criarFantasma ? undefined : novoEmail.toLowerCase().trim(),
        telefone: novoTelefone ? unformatPhoneNumber(novoTelefone.trim()) : undefined
      });

      if (resultado.success) {
        setMensagem(`✅ ${novoNome} cadastrado${criarFantasma ? ' (fantasma - sem acesso)' : ''}!`);
        setNovoEmail('');
        setNovoNome('');
        setNovoTelefone('');
        setNovoCargo('musico');
        setcriarFantasma(false);
        setMostrarFormulario(false);
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (id: string, ativo: boolean) => {
    try {
      const resultado = await atualizarPessoa(id, { ativo });
      
      if (resultado.success) {
        setMensagem(ativo ? '✅ Pessoa ativada' : '⚠️ Pessoa desativada');
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const removerPessoa = async (id: string, nome: string, temAcesso: boolean) => {
    if (temAcesso) {
      setMensagem('❌ Não é possível remover pessoa com acesso ao sistema. Desative-a primeiro.');
      return;
    }

    if (!confirm(`Tem certeza que deseja REMOVER ${nome}?`)) {
      return;
    }

    try {
      const resultado = await deletarPessoa(id);
      
      if (resultado.success) {
        setMensagem('🗑️ Pessoa removida com sucesso');
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const enviarConvitePessoa = async (pessoa: Pessoa) => {
    // Fantasma sem email - precisa adicionar email primeiro
    if (!pessoa.email) {
      setMensagem('❌ Adicione um email para esta pessoa antes de enviar convite');
      return;
    }

    // Já tem acesso
    if (pessoa.tem_acesso) {
      setMensagem('ℹ️ Esta pessoa já tem acesso ao sistema');
      return;
    }

    if (!confirm(`Enviar convite de acesso para ${pessoa.nome} (${pessoa.email})?`)) {
      return;
    }

    setEnviandoConvite(pessoa.id);
    setMensagem('');

    try {
      const resultado = await enviarConviteHook({
        pessoa_id: pessoa.id,
        email: pessoa.email,
        nome: pessoa.nome,
        cargo: pessoa.cargo,
        telefone: pessoa.telefone
      });

      if (resultado.success) {
        setLinkConvite(resultado.data.link);
        setNomeConvidado(pessoa.nome);
        setEmailConvidado(pessoa.email);
        setMensagem('✅ Convite enviado por email!');
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setEnviandoConvite(null);
    }
  };


  // Modal de Edição
  const abrirModalEdicao = (pessoa: Pessoa) => {
    setPessoaEditando(pessoa);
    setEditandoNome(pessoa.nome);
    setEditandoEmail(pessoa.email || '');
    setEditandoTelefone(pessoa.telefone ? formatPhoneNumber(pessoa.telefone) : '');
    setEditandoCargo(pessoa.cargo);
    carregarTagsUsuario(pessoa.id);
  };

  const fecharModalEdicao = () => {
    setPessoaEditando(null);
    setEditandoNome('');
    setEditandoEmail('');
    setEditandoTelefone('');
    setEditandoCargo('musico');
    setTagsUsuario([]);
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pessoaEditando) return;

    setSalvando(true);
    setMensagem('');

    try {
      const resultado = await atualizarPessoa(pessoaEditando.id, {
        nome: editandoNome.trim(),
        email: editandoEmail ? editandoEmail.toLowerCase().trim() : undefined,
        telefone: editandoTelefone ? unformatPhoneNumber(editandoTelefone.trim()) : undefined,
        cargo: editandoCargo
      });

      if (resultado.success) {
        setMensagem(`✅ ${editandoNome} atualizado com sucesso!`);
        fecharModalEdicao();
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  // Renderização
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

  const countComAcesso = pessoas.filter(p => p.tem_acesso).length;
  const countSemAcesso = pessoas.filter(p => !p.tem_acesso).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Gerenciar Pessoas</h1>
              <p className="text-slate-600 mt-1">
                Membros da igreja e usuários do sistema
              </p>
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

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Total de Pessoas</p>
              <p className="text-2xl font-bold text-slate-900">{pessoas.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <p className="text-sm text-emerald-600">✓ Com Acesso</p>
              <p className="text-2xl font-bold text-emerald-900">{countComAcesso}</p>
            </div>
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <p className="text-sm text-purple-600">👻 Fantasmas</p>
              <p className="text-2xl font-bold text-purple-900">{countSemAcesso}</p>
            </div>
          </div>

          {/* Mensagem */}
          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              mensagem.includes('⚠️') || mensagem.includes('ℹ️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm">{mensagem}</span>
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
              {mostrarFormulario ? '✕ Cancelar' : '➕ Adicionar Pessoa'}
            </button>
          </div>

          {/* Formulário Adicionar */}
          {mostrarFormulario && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span>➕</span>
                Nova Pessoa
              </h3>
              <form onSubmit={adicionarPessoa} className="space-y-4">
                {/* Checkbox Fantasma */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criarFantasma}
                      onChange={(e) => setcriarFantasma(e.target.checked)}
                      className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <p className="font-semibold text-purple-900">👻 Criar como Fantasma</p>
                      <p className="text-sm text-purple-700">Pessoa sem acesso ao sistema (não precisa de email)</p>
                    </div>
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {!criarFantasma && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        required={!criarFantasma}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                        placeholder="usuario@email.com"
                      />
                    </div>
                  )}
                  <div className={criarFantasma ? 'sm:col-span-2' : ''}>
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
                  {salvando ? 'Cadastrando...' : 'Cadastrar Pessoa'}
                </button>
              </form>
            </div>
          )}

          {/* Tabela de Pessoas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>👥</span>
                Pessoas Cadastradas
                <span className="ml-2 text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
                  {pessoasFiltradas.length}
                </span>
              </h3>
            </div>

            <div className="p-6">
              {/* Filtros */}
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nome, email, cargo ou telefone..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={filtroAcesso}
                    onChange={(e) => setFiltroAcesso(e.target.value as any)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="todos">Todos</option>
                    <option value="com_acesso">✓ Com Acesso</option>
                    <option value="sem_acesso">👻 Fantasmas</option>
                  </select>

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
              </div>

              {pessoasLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto"></div>
                  <p className="mt-2 text-slate-600">Carregando pessoas...</p>
                </div>
              ) : pessoasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>Nenhuma pessoa encontrada</p>
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
                          onClick={() => handleSort('tem_acesso')}
                          className="text-center px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors hidden md:table-cell"
                        >
                          <div className="flex items-center justify-center gap-2">
                            Acesso {getSortIcon('tem_acesso')}
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
                      {pessoasFiltradas.map((pessoa) => (
                        <tr 
                          key={pessoa.id}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            !pessoa.ativo ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {!pessoa.tem_acesso && (
                                <span className="text-lg" title="Fantasma - sem acesso">👻</span>
                              )}
                              <div>
                                <div className="font-medium text-slate-900">{pessoa.nome}</div>
                                <div className="text-sm text-slate-500 lg:hidden">{pessoa.email || 'Sem email'}</div>
                                {pessoa.tags && pessoa.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {pessoa.tags.slice(0, 2).map((tag) => (
                                      <span
                                        key={tag.id}
                                        className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600"
                                      >
                                        {tag.nome}
                                      </span>
                                    ))}
                                    {pessoa.tags.length > 2 && (
                                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                                        +{pessoa.tags.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm hidden lg:table-cell">
                            {pessoa.email || <span className="text-slate-400 italic">Sem email</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm hidden xl:table-cell">
                            {pessoa.telefone ? formatPhoneNumber(pessoa.telefone) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCargoCor(pessoa.cargo as CargoTipo)}`}>
                              {getCargoIcone(pessoa.cargo as CargoTipo)} {getCargoLabel(pessoa.cargo as CargoTipo)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            {pessoa.tem_acesso ? (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                ✓ Sim
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                                👻 Não
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center hidden md:table-cell">
                            {pessoa.ativo ? (
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
                              {!pessoa.tem_acesso && (
                                <button
                                  onClick={() => enviarConvitePessoa(pessoa)}
                                  disabled={enviandoConvite === pessoa.id || !pessoa.ativo || !pessoa.email}
                                  className="p-1.5 rounded hover:bg-blue-50 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  title={!pessoa.email ? 'Adicione email primeiro' : 'Enviar convite de acesso'}
                                >
                                  {enviandoConvite === pessoa.id ? (
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <span className="text-lg">📧</span>
                                  )}
                                </button>
                              )}
                              
                              <button
                                onClick={() => abrirModalEdicao(pessoa)}
                                className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                                title="Editar"
                              >
                                <span className="text-lg">✏️</span>
                              </button>

                              <button
                                onClick={() => alterarStatus(pessoa.id, !pessoa.ativo)}
                                className={`p-1.5 rounded transition-colors ${
                                  pessoa.ativo
                                    ? 'hover:bg-yellow-50 text-yellow-600'
                                    : 'hover:bg-green-50 text-green-600'
                                }`}
                                title={pessoa.ativo ? 'Desativar' : 'Ativar'}
                              >
                                <span className="text-lg">{pessoa.ativo ? '⏸️' : '▶️'}</span>
                              </button>

                              <button
                                onClick={() => removerPessoa(pessoa.id, pessoa.nome, pessoa.tem_acesso)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                                title={pessoa.tem_acesso ? 'Desative antes de remover' : 'Remover'}
                                disabled={pessoa.tem_acesso}
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

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span>ℹ️</span>
              Sobre Pessoas e Acesso
            </h4>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <p className="font-medium mb-2">👻 Pessoas Fantasmas:</p>
                <ul className="space-y-1 pl-4">
                  <li>✓ Podem ser escaladas normalmente</li>
                  <li>✓ Não acessam o sistema</li>
                  <li>✓ Podem receber convite depois</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">✓ Pessoas com Acesso:</p>
                <ul className="space-y-1 pl-4">
                  <li>✓ Fazem login no sistema</li>
                  <li>✓ Têm permissões por cargo</li>
                  <li>✓ Podem ser desativadas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Edição */}
        {pessoaEditando && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">✏️ Editar Pessoa</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {pessoaEditando.tem_acesso ? '✓ Com acesso' : '👻 Fantasma'} • {pessoaEditando.email || 'Sem email'}
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
                    E-mail {pessoaEditando.tem_acesso && '(não editável - possui acesso)'}
                  </label>
                  <input
                    type="email"
                    value={editandoEmail}
                    onChange={(e) => setEditandoEmail(e.target.value)}
                    disabled={pessoaEditando.tem_acesso || salvando}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none disabled:bg-slate-50 disabled:text-slate-500"
                    placeholder="Adicionar email para enviar convite"
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

                {/* Tags/Habilidades */}
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
                    {Object.entries(
                      todasTags.reduce((acc, tag) => {
                        if (!acc[tag.categoria]) {
                          acc[tag.categoria] = [];
                        }
                        acc[tag.categoria].push(tag);
                        return acc;
                      }, {} as Record<string, Tag[]>)
                    )
                    .sort(([catA], [catB]) => catA.localeCompare(catB))
                    .map(([categoria, tagsDaCategoria]) => {
                      const categoriaLabels: Record<string, string> = {
                        // Liderança
                        lideranca: '📖 Liderança',
                        lideranca_pastor: '👨‍⚕️ Pastor',
                        lideranca_presbitero: '👔 Presbítero',
                        lideranca_diacono: '🤝 Diácono',
                        
                        // Louvor
                        louvor_lideranca: '🎵 Ministração',
                        louvor_vocal: '🎤 Vozes',
                        louvor_instrumento: '🎸 Instrumentos',
                        
                        // Instrumentos avulsos
                        instrumento: '🎺 Outros Instrumentos',
                        
                        // Técnica
                        tecnica: '🎛️ Técnica',
                        tecnico_audio: '🔊 Áudio',
                        tecnico_video: '📹 Vídeo',
                        
                        // Apoio
                        apoio: '👥 Apoio',
                        apoio_geral: '🤲 Apoio Geral',
                        apoio_seguranca: '🛡️ Segurança',
                        
                        // Ministério
                        ministerio_infantil: '👶 Infantil'
                      };

                      return (
                        <div key={categoria} className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-slate-700 mb-2">
                            {categoriaLabels[categoria] || categoria}
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
        {/* Modal de Convite */}
        {linkConvite && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📧</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Convite Enviado!
                </h3>
                <p className="text-slate-600">
                  Email automático enviado para
                </p>
                <p className="text-emerald-700 font-semibold text-lg">
                  {nomeConvidado}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-lg">💡</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 mb-1">
                      Envie também pelo WhatsApp!
                    </p>
                    <p className="text-xs text-slate-600">
                      Copie o link abaixo ou clique para abrir direto no WhatsApp
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Link do Convite:</p>
                  <p className="text-xs text-slate-900 break-all font-mono leading-relaxed">
                    {linkConvite}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(linkConvite);
                    setMensagem('✅ Link copiado para área de transferência!');
                  }}
                  className="flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-lg hover:bg-slate-200 transition-all font-medium"
                >
                  <span className="text-xl">📋</span>
                  Copiar Link
                </button>

                <button
                  onClick={() => {
                    const msg = `Olá *${nomeConvidado}*! 👋\n\n` +
                      `Você foi convidado(a) para acessar o *OIKOS Hub* da Igreja Presbiteriana Ponta Negra.\n\n` +
                      `✅ *Clique aqui para aceitar:*\n${linkConvite}\n\n` +
                      `⏰ _Este convite expira em 7 dias._`;
                    
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-all font-medium"
                >
                  <span className="text-xl">📱</span>
                  WhatsApp
                </button>
              </div>

              <button
                onClick={() => setLinkConvite(null)}
                className="w-full text-slate-600 text-sm hover:text-slate-900 py-2 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}