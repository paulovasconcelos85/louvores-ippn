'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  UserPlus, 
  Users, 
  Mail, 
  Phone, 
  ShieldCheck, 
  UserX, 
  Edit2, 
  Pause, 
  Play, 
  Trash2, 
  ArrowLeft, 
  Search, 
  CheckCircle2, 
  Info,
  Copy,
  MessageCircle,
  X,
  Music,
  BookOpen,
  Briefcase,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  GraduationCap,
  Scale
} from 'lucide-react';
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

  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviandoConvite, setEnviandoConvite] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [filtroAcesso, setFiltroAcesso] = useState<'todos' | 'com_acesso' | 'sem_acesso'>('todos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoCargo, setNovoCargo] = useState<CargoTipo>('musico');
  const [apenasMembro, setApenasMembro] = useState(false);

  const [pessoaEditando, setPessoaEditando] = useState<Pessoa | null>(null);
  const [editandoNome, setEditandoNome] = useState('');
  const [editandoEmail, setEditandoEmail] = useState('');
  const [editandoTelefone, setEditandoTelefone] = useState('');
  const [editandoCargo, setEditandoCargo] = useState<CargoTipo>('musico');

  const [todasTags, setTodasTags] = useState<Tag[]>([]);
  const [tagsUsuario, setTagsUsuario] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const [linkConvite, setLinkConvite] = useState<string | null>(null);
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [emailConvidado, setEmailConvidado] = useState('');

  const totalLoading = authLoading || permLoading;

  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }
    if (!totalLoading && user && !permissoes.podeGerenciarUsuarios) {
      router.push('/admin');
    }
  }, [user, totalLoading, permissoes.podeGerenciarUsuarios, router]);

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ChevronsUpDown className="w-4 h-4 text-slate-400" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const pessoasFiltradas = pessoas
    .filter(p => {
      if (!mostrarInativos && !p.ativo) return false;
      if (filtroAcesso === 'com_acesso' && !p.tem_acesso) return false;
      if (filtroAcesso === 'sem_acesso' && p.tem_acesso) return false;
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
      setMensagem(`❌ Erro ao alterar habilidade`);
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
        email: apenasMembro ? undefined : novoEmail.toLowerCase().trim(),
        telefone: novoTelefone ? unformatPhoneNumber(novoTelefone.trim()) : undefined
      });
      if (resultado.success) {
        setMensagem(`✅ ${novoNome} cadastrado com sucesso!`);
        setNovoEmail('');
        setNovoNome('');
        setNovoTelefone('');
        setNovoCargo('musico');
        setApenasMembro(false);
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
    if (!confirm(`Tem certeza que deseja REMOVER ${nome}?`)) return;
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
    if (!pessoa.email) {
      setMensagem('❌ Adicione um email para esta pessoa antes de enviar convite');
      return;
    }
    if (pessoa.tem_acesso) {
      setMensagem('ℹ️ Esta pessoa já tem acesso ao sistema');
      return;
    }
    if (!confirm(`Enviar convite de acesso para ${pessoa.nome} (${pessoa.email})?`)) return;
    setEnviandoConvite(pessoa.id);
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

  if (!user || !permissoes.podeGerenciarUsuarios) return null;

  const countComAcesso = pessoas.filter(p => p.tem_acesso).length;
  const countSemAcesso = pessoas.filter(p => !p.tem_acesso).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-8 h-8 text-emerald-700" />
                Gerenciar Pessoas
              </h1>
              <p className="text-slate-600 mt-1">Membros da igreja e usuários do sistema</p>
            </div>
            <button 
              onClick={() => router.push('/admin')} 
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>

          {/* Info do usuário logado */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-emerald-800">
                <User className="w-4 h-4" />
                Logado como: <span className="font-semibold">{usuarioPermitido?.nome || user.email}</span>
              </div>
              {usuarioPermitido?.cargo && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getCargoCor(usuarioPermitido.cargo)}`}>
                  {getCargoLabel(usuarioPermitido.cargo)}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Total de Pessoas</p>
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{pessoas.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-emerald-600">Com Acesso</p>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-900">{countComAcesso}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-600">Membros (Sem Acesso)</p>
                <UserX className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-blue-900">{countSemAcesso}</p>
            </div>
          </div>

          {/* Mensagem */}
          {mensagem && (
            <div className={`p-4 rounded-lg flex items-center justify-between ${
              mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {mensagem.includes('✅') ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                <span className="text-sm">{mensagem}</span>
              </div>
              <button onClick={() => setMensagem('')} className="text-current opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Botão Adicionar */}
          <div className="flex justify-end">
            <button 
              onClick={() => setMostrarFormulario(!mostrarFormulario)} 
              className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium flex items-center gap-2"
            >
              {mostrarFormulario ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {mostrarFormulario ? 'Cancelar' : 'Adicionar Pessoa'}
            </button>
          </div>

          {/* Formulário Adicionar */}
          {mostrarFormulario && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-top-4 duration-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-700" />
                Nova Pessoa
              </h3>
              <form onSubmit={adicionarPessoa} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={apenasMembro} 
                      onChange={(e) => setApenasMembro(e.target.checked)} 
                      className="w-5 h-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" 
                    />
                    <div>
                      <p className="font-semibold text-emerald-900">Cadastrar apenas como Membro</p>
                      <p className="text-sm text-emerald-700">Apenas registro na base de dados (sem login no sistema)</p>
                    </div>
                  </label>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {!apenasMembro && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">E-mail *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                          type="email" 
                          value={novoEmail} 
                          onChange={(e) => setNovoEmail(e.target.value)} 
                          required={!apenasMembro} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none" 
                          placeholder="exemplo@email.com"
                        />
                      </div>
                    </div>
                  )}
                  <div className={apenasMembro ? 'sm:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nome Completo *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={novoNome} 
                        onChange={(e) => setNovoNome(e.target.value)} 
                        required 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none" 
                        placeholder="Nome da pessoa"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="tel" 
                        value={novoTelefone} 
                        onChange={(e) => setNovoTelefone(formatPhoneNumber(e.target.value))} 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none" 
                        placeholder="(92) 90000-0000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cargo / Função *</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <select 
                        value={novoCargo} 
                        onChange={(e) => setNovoCargo(e.target.value as CargoTipo)} 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none appearance-none"
                      >
                        <option value="musico">Músico/Cantor</option>
                        <option value="seminarista">Seminarista</option>
                        <option value="presbitero">Presbítero</option>
                        <option value="staff">Staff/Equipe</option>
                        <option value="pastor">Pastor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={salvando}
                  className="w-full sm:w-auto bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 font-medium"
                >
                  {salvando ? 'Cadastrando...' : 'Cadastrar Pessoa'}
                </button>
              </form>
            </div>
          )}

          {/* Tabela de Pessoas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Pessoas Cadastradas
              </h3>
              <span className="text-sm bg-white/20 text-white px-3 py-1 rounded-full font-medium">
                {pessoasFiltradas.length} pessoas
              </span>
            </div>

            <div className="p-6">
              {/* Filtros */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, email, cargo ou telefone..."
                    value={filtroTexto}
                    onChange={(e) => setFiltroTexto(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={filtroAcesso}
                    onChange={(e) => setFiltroAcesso(e.target.value as any)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="todos">Todos os Acessos</option>
                    <option value="com_acesso">Com Acesso</option>
                    <option value="sem_acesso">Membros (Sem Acesso)</option>
                  </select>

                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mostrarInativos}
                      onChange={(e) => setMostrarInativos(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700 font-medium">Inativos</span>
                  </label>
                </div>
              </div>

              {pessoasLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto"></div>
                  <p className="mt-2 text-slate-500 text-sm">Carregando...</p>
                </div>
              ) : pessoasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma pessoa encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-100">
                        <th onClick={() => handleSort('nome')} className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
                          <div className="flex items-center gap-2">Nome {getSortIcon('nome')}</div>
                        </th>
                        <th onClick={() => handleSort('email')} className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 hidden lg:table-cell">
                          <div className="flex items-center gap-2">Email {getSortIcon('email')}</div>
                        </th>
                        <th onClick={() => handleSort('cargo')} className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
                          <div className="flex items-center gap-2">Cargo {getSortIcon('cargo')}</div>
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Acesso</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Status</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pessoasFiltradas.map((pessoa) => (
                        <tr key={pessoa.id} className={`hover:bg-slate-50/50 transition-colors ${!pessoa.ativo ? 'opacity-60 bg-slate-50/30' : ''}`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${pessoa.tem_acesso ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {pessoa.tem_acesso ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{pessoa.nome}</div>
                                <div className="text-xs text-slate-500 lg:hidden">{pessoa.email || 'Sem email'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600 text-sm hidden lg:table-cell">
                            {pessoa.email || <span className="text-slate-400 italic">Sem email</span>}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getCargoCor(pessoa.cargo as CargoTipo)}`}>
                              {getCargoLabel(pessoa.cargo as CargoTipo)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            {pessoa.tem_acesso ? 
                              <span className="text-emerald-600 text-xs font-bold uppercase tracking-wider">Acesso OK</span> : 
                              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Membro</span>
                            }
                          </td>
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            {pessoa.ativo ? 
                              <span className="inline-flex items-center gap-1.5 text-green-600 text-xs font-bold"><Play className="w-3 h-3 fill-current" /> Ativo</span> : 
                              <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-bold"><Pause className="w-3 h-3 fill-current" /> Inativo</span>
                            }
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1">
                              {!pessoa.tem_acesso && (
                                <button 
                                  onClick={() => enviarConvitePessoa(pessoa)} 
                                  disabled={enviandoConvite === pessoa.id || !pessoa.ativo || !pessoa.email}
                                  className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                                  title="Enviar convite de acesso"
                                >
                                  {enviandoConvite === pessoa.id ? <div className="animate-spin w-4 h-4 border-2 border-emerald-600 border-b-transparent rounded-full" /> : <Mail className="w-4 h-4" />}
                                </button>
                              )}
                              <button onClick={() => abrirModalEdicao(pessoa)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => alterarStatus(pessoa.id, !pessoa.ativo)} 
                                className={`p-2 rounded-lg transition-colors ${pessoa.ativo ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-green-50 text-green-600'}`}
                                title={pessoa.ativo ? 'Pausar/Inativar' : 'Ativar'}
                              >
                                {pessoa.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => removerPessoa(pessoa.id, pessoa.nome, pessoa.tem_acesso)} 
                                disabled={pessoa.tem_acesso}
                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors disabled:opacity-20"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
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

          {/* Info Footer */}
          <div className="bg-slate-900 rounded-xl p-6 text-slate-400 border border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold mb-4">
              <Info className="w-5 h-5 text-emerald-500" />
              Guia de Gerenciamento
            </div>
            <div className="grid sm:grid-cols-2 gap-8 text-sm">
              <div className="space-y-2">
                <p className="text-white font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" /> Membros da Igreja
                </p>
                <ul className="space-y-1 list-inside list-disc opacity-80">
                  <li>Pessoas registradas para organização interna</li>
                  <li>Não possuem senha ou acesso ao painel</li>
                  <li>Podem ser convidadas para ter acesso a qualquer momento</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-white font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Usuários com Acesso
                </p>
                <ul className="space-y-1 list-inside list-disc opacity-80">
                  <li>Possuem login e senha no sistema</li>
                  <li>Permissões de visualização baseadas no Cargo</li>
                  <li>Podem ser inativados para bloqueio imediato de acesso</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Edição */}
        {pessoaEditando && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Editar Pessoa</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {pessoaEditando.tem_acesso ? 'Usuário do Sistema' : 'Membro da Igreja'}
                    </p>
                  </div>
                </div>
                <button onClick={fecharModalEdicao} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={salvarEdicao} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Nome Completo</label>
                      <input type="text" value={editandoNome} onChange={(e) => setEditandoNome(e.target.value)} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">E-mail</label>
                      <input 
                        type="email" 
                        value={editandoEmail} 
                        onChange={(e) => setEditandoEmail(e.target.value)} 
                        disabled={pessoaEditando.tem_acesso} 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50" 
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Cargo / Função</label>
                      <select value={editandoCargo} onChange={(e) => setEditandoCargo(e.target.value as CargoTipo)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option value="musico">🎵 Músico/Cantor</option>
                        <option value="seminarista">📚 Seminarista</option>
                        <option value="presbitero">👔 Presbítero</option>
                        <option value="staff">🛠️ Staff/Equipe</option>
                        <option value="pastor">📖 Pastor</option>
                        <option value="admin">🔐 Administrador</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">Telefone</label>
                      <input type="tel" value={editandoTelefone} onChange={(e) => setEditandoTelefone(formatPhoneNumber(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Habilidades - Tags */}
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Music className="w-4 h-4 text-emerald-600" />
                    Habilidades & Funções
                    {loadingTags && <div className="animate-spin w-3 h-3 border border-slate-400 border-b-transparent rounded-full ml-auto" />}
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {todasTags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                          tagsUsuario.includes(tag.id) 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200 scale-105' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                        }`}
                      >
                        {tagsUsuario.includes(tag.id) ? <CheckCircle2 className="w-3 h-3" /> : null}
                        {tag.nome}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button type="submit" disabled={salvando} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50">
                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button type="button" onClick={fecharModalEdicao} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Convite */}
        {linkConvite && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Convite Gerado!</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Um convite foi enviado para <strong>{emailConvidado}</strong>. Você também pode compartilhar o link manualmente.
              </p>

              <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
                <code className="text-[10px] text-slate-400 block mb-2 font-mono uppercase tracking-widest">Link de Acesso Único</code>
                <p className="text-xs text-slate-600 break-all font-mono font-medium">{linkConvite}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(linkConvite);
                    setMensagem('✅ Link copiado!');
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group"
                >
                  <Copy className="w-6 h-6 text-slate-400 group-hover:text-slate-900" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Copiar Link</span>
                </button>
                <button 
                  onClick={() => {
                    const msg = `Olá *${nomeConvidado}*! 👋\nVocê foi convidado(a) para o sistema da IPPN.\n\n✅ *Acesse aqui:*\n${linkConvite}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-2xl transition-all group"
                >
                  <MessageCircle className="w-6 h-6 text-green-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-green-600 uppercase">WhatsApp</span>
                </button>
              </div>

              <button onClick={() => setLinkConvite(null)} className="w-full text-slate-400 font-bold hover:text-slate-900 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
