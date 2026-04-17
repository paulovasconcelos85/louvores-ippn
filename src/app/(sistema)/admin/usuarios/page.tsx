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
  X,
  Music,
  Briefcase,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  UserCheck
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { usePessoas, Pessoa } from '@/hooks/usePessoas';
import { useLocale } from '@/i18n/provider';
import { CargoTipo, getCargoCor } from '@/lib/permissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';
import { UsuariosHubPanel } from '@/components/UsuariosHubPanel';

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  cor: string;
  icone: string;
}

type SortField = 'nome' | 'email' | 'telefone' | 'cargo' | 'ativo' | 'tem_acesso';
type SortDirection = 'asc' | 'desc';
type VisaoGestao = 'pessoas' | 'acessos';

const TAGS_RESTRITAS = ['Pastor', 'Presbítero', 'Pregação', 'Diácono'];
const CARGOS_GESTAO_LOCAL: CargoTipo[] = ['membro', 'diacono', 'musico', 'staff', 'seminarista'];
const CARGOS_GESTAO_GLOBAL: CargoTipo[] = ['membro', 'diacono', 'musico', 'staff', 'seminarista', 'presbitero', 'pastor', 'admin'];

export default function GerenciarPessoas() {
  const router = useRouter();
  const locale = useLocale();
  const tr = (pt: string, es: string, en: string) =>
    locale === 'es' ? es : locale === 'en' ? en : pt;
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();
  const { 
    pessoas, 
    loading: pessoasLoading, 
    listarPessoas, 
    criarPessoa, 
    atualizarPessoa, 
    deletarPessoa,
    liberarAcesso
  } = usePessoas();

  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [liberandoAcessoId, setLiberandoAcessoId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [visaoGestao, setVisaoGestao] = useState<VisaoGestao>('pessoas');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [filtroAcesso, setFiltroAcesso] = useState<'todos' | 'com_acesso' | 'sem_acesso'>('todos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoPainel, setModoPainel] = useState<'cadastros' | 'hub_macro'>('cadastros');

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

  const getCargoLabel = (cargo: CargoTipo) =>
    ({
      membro: tr('Membro', 'Miembro', 'Member'),
      diacono: tr('Diácono', 'Diácono', 'Deacon'),
      presbitero: tr('Presbítero', 'Presbítero', 'Elder'),
      pastor: tr('Pastor', 'Pastor', 'Pastor'),
      seminarista: tr('Seminarista', 'Seminarista', 'Seminarian'),
      staff: tr('Staff', 'Staff', 'Staff'),
      musico: tr('Músico', 'Músico', 'Musician'),
      admin: tr('Administrador', 'Administrador', 'Administrator'),
      superadmin: tr('Super Admin', 'Super Admin', 'Super Admin'),
    } satisfies Record<CargoTipo, string>)[cargo];

  const totalLoading = authLoading || permLoading;
  const ehGestaoGlobal = permissoes.isSuperAdmin || usuarioPermitido?.cargo === 'admin';
  const ehGestaoLocal = permissoes.podeGerenciarUsuarios && !ehGestaoGlobal;
  const cargosDisponiveis = ehGestaoGlobal ? CARGOS_GESTAO_GLOBAL : CARGOS_GESTAO_LOCAL;
  const todasTagsDisponiveis = ehGestaoGlobal
    ? todasTags
    : todasTags.filter((tag) => !TAGS_RESTRITAS.includes(tag.nome));

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
  }, [user, permissoes.podeGerenciarUsuarios, listarPessoas]);

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
    const tagSelecionada = todasTags.find((tag) => tag.id === tagId);
    if (!ehGestaoGlobal && tagSelecionada && TAGS_RESTRITAS.includes(tagSelecionada.nome)) {
      setMensagem(`❌ ${tr('Apenas gestão global pode atribuir tags de liderança e pregação.', 'Solo la gestión global puede asignar etiquetas de liderazgo y predicación.', 'Only global management can assign leadership and preaching tags.')}`);
      return;
    }
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
    } catch {
      setMensagem(`❌ ${tr('Erro ao alterar habilidade.', 'Error al cambiar habilidad.', 'Error changing skill.')}`);
    }
  };

  const adicionarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');
    try {
      if (!ehGestaoGlobal && !apenasMembro && !cargosDisponiveis.includes(novoCargo)) {
        throw new Error(tr('A gestão local não pode atribuir este cargo.', 'La gestión local no puede asignar este cargo.', 'Local management cannot assign this role.'));
      }

      const resultado = await criarPessoa({
        nome: novoNome.trim(),
        cargo: apenasMembro ? 'membro' : novoCargo, // Define "membro" automaticamente
        email: apenasMembro ? undefined : novoEmail.toLowerCase().trim(),
        telefone: novoTelefone ? unformatPhoneNumber(novoTelefone.trim()) : undefined
      });
      if (resultado.success) {
        setMensagem(`✅ ${tr(`${novoNome} cadastrado com sucesso!`, `${novoNome} registrado con éxito.`, `${novoNome} registered successfully.`)}`);
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
      setMensagem(`❌ ${tr('Erro:', 'Error:', 'Error:')} ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (id: string, ativo: boolean) => {
    try {
      const resultado = await atualizarPessoa(id, { ativo });
      if (resultado.success) {
        setMensagem(
          ativo
            ? `✅ ${tr('Pessoa ativada.', 'Persona activada.', 'Person activated.')}`
            : `⚠️ ${tr('Pessoa desativada.', 'Persona desactivada.', 'Person deactivated.')}`
        );
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ ${tr('Erro:', 'Error:', 'Error:')} ${error.message}`);
    }
  };

  const removerPessoa = async (id: string, nome: string, temAcesso: boolean) => {
    if (temAcesso) {
      setMensagem(`❌ ${tr('Não é possível remover pessoa com acesso ao sistema. Desative-a primeiro.', 'No es posible eliminar una persona con acceso al sistema. Desactívala primero.', 'You cannot remove a person with system access. Deactivate them first.')}`);
      return;
    }
    if (!confirm(tr(`Tem certeza que deseja REMOVER ${nome}?`, `¿Seguro que deseas ELIMINAR a ${nome}?`, `Are you sure you want to REMOVE ${nome}?`))) return;
    try {
      const resultado = await deletarPessoa(id);
      if (resultado.success) {
        setMensagem(`🗑️ ${tr('Pessoa removida com sucesso.', 'Persona eliminada con éxito.', 'Person removed successfully.')}`);
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ ${tr('Erro:', 'Error:', 'Error:')} ${error.message}`);
    }
  };

  const liberarAcessoPessoa = async (pessoa: Pessoa) => {
    if (pessoa.tem_acesso) {
      setMensagem(`ℹ️ ${tr('Esta pessoa já possui acesso liberado.', 'Esta persona ya tiene acceso habilitado.', 'This person already has granted access.')}`);
      return;
    }

    if (!pessoa.email) {
      setMensagem(`❌ ${tr('Adicione um e-mail antes de liberar o acesso.', 'Agrega un correo antes de habilitar el acceso.', 'Add an email before granting access.')}`);
      return;
    }

    if (!confirm(tr(`Liberar acesso para ${pessoa.nome} usando ${pessoa.email}?`, `¿Habilitar acceso para ${pessoa.nome} usando ${pessoa.email}?`, `Grant access to ${pessoa.nome} using ${pessoa.email}?`))) return;

    try {
      setLiberandoAcessoId(pessoa.id);
      const resultado = await liberarAcesso(pessoa.id);

      if (resultado.success) {
        setMensagem(`✅ ${resultado.message}`);
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ ${tr('Erro:', 'Error:', 'Error:')} ${error.message}`);
    } finally {
      setLiberandoAcessoId(null);
    }
  };

  const abrirModalEdicao = (pessoa: Pessoa) => {
    setPessoaEditando(pessoa);
    setEditandoNome(pessoa.nome);
    setEditandoEmail(pessoa.email || '');
    setEditandoTelefone(pessoa.telefone ? formatPhoneNumber(pessoa.telefone) : '');
    setEditandoCargo(
      !ehGestaoGlobal && !cargosDisponiveis.includes(pessoa.cargo)
        ? 'membro'
        : pessoa.cargo
    );
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
      if (!ehGestaoGlobal && !cargosDisponiveis.includes(editandoCargo)) {
        throw new Error(tr('A gestão local não pode atribuir este cargo.', 'La gestión local no puede asignar este cargo.', 'Local management cannot assign this role.'));
      }

      const resultado = await atualizarPessoa(pessoaEditando.id, {
        nome: editandoNome.trim(),
        email: ehGestaoGlobal && editandoEmail ? editandoEmail.toLowerCase().trim() : undefined,
        telefone: editandoTelefone ? unformatPhoneNumber(editandoTelefone.trim()) : undefined,
        cargo: editandoCargo
      });
      if (resultado.success) {
        setMensagem(`✅ ${tr(`${editandoNome} atualizado com sucesso!`, `${editandoNome} actualizado con éxito.`, `${editandoNome} updated successfully.`)}`);
        fecharModalEdicao();
        listarPessoas();
      } else {
        setMensagem(`❌ ${resultado.error}`);
      }
    } catch (error: any) {
      setMensagem(`❌ ${tr('Erro:', 'Error:', 'Error:')} ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  if (totalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">{tr('Verificando permissões...', 'Verificando permisos...', 'Checking permissions...')}</p>
        </div>
      </div>
    );
  }

  if (!user || !permissoes.podeGerenciarUsuarios) return null;

  const countComAcesso = pessoas.filter(p => p.tem_acesso).length;
  const countSemAcesso = pessoas.filter(p => !p.tem_acesso).length;
  const pessoasBase = pessoasFiltradas.filter((pessoa) => !pessoa.tem_acesso);
  const acessosBase = pessoasFiltradas.filter((pessoa) => pessoa.tem_acesso);
  const listaExibida = visaoGestao === 'pessoas' ? pessoasBase : acessosBase;
  const tituloSecao = visaoGestao === 'pessoas'
    ? tr('Pessoas da Igreja', 'Personas de la Iglesia', 'Church People')
    : tr('Acessos e Permissões', 'Accesos y Permisos', 'Access and Permissions');
  const descricaoSecao =
    visaoGestao === 'pessoas'
      ? tr('Cadastros internos, membros sem login e organização da base da igreja.', 'Registros internos, miembros sin inicio de sesión y organización de la base de la iglesia.', 'Internal records, members without login, and church database organization.')
      : tr('Usuários com acesso ao sistema, perfis, cargos e habilitações.', 'Usuarios con acceso al sistema, perfiles, cargos y habilidades.', 'Users with system access, profiles, roles, and skills.');
  const badgeSecao = visaoGestao === 'pessoas' ? pessoasBase.length : acessosBase.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-8 h-8 text-emerald-700" />
                {tr('Gerenciar Pessoas', 'Gestionar Personas', 'Manage People')}
              </h1>
              <p className="text-slate-600 mt-1">{tr('Membros da igreja e usuários do sistema', 'Miembros de la iglesia y usuarios del sistema', 'Church members and system users')}</p>
            </div>
            <button 
              onClick={() => router.push('/admin')} 
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {tr('Voltar', 'Volver', 'Back')}
            </button>
          </div>

          {/* Info do usuário logado */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-emerald-800">
                <User className="w-4 h-4" />
                {tr('Logado como:', 'Conectado como:', 'Signed in as:')} <span className="font-semibold">{usuarioPermitido?.nome || user.email}</span>
              </div>
              {usuarioPermitido?.cargo && (
                <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getCargoCor(usuarioPermitido.cargo)}`}>
                  {getCargoLabel(usuarioPermitido.cargo)}
                </span>
              )}
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                ehGestaoGlobal ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-900'
              }`}>
                {ehGestaoGlobal
                  ? tr('Gestão global', 'Gestión global', 'Global management')
                  : tr('Gestão local da igreja', 'Gestión local de la iglesia', 'Local church management')}
              </span>
            </div>
            <p className="mt-3 text-sm text-emerald-900">
              {ehGestaoGlobal
                ? tr('Você pode gerenciar acessos, cargos e tags sensíveis conforme o contexto da igreja selecionada.', 'Puedes gestionar accesos, cargos y etiquetas sensibles según el contexto de la iglesia seleccionada.', 'You can manage access, roles, and sensitive tags according to the selected church context.')
                : tr('Você pode cuidar do cadastro e dos acessos da igreja ativa, mas cargos administrativos e tags sensíveis continuam centralizados.', 'Puedes cuidar el registro y los accesos de la iglesia activa, pero los cargos administrativos y las etiquetas sensibles siguen centralizados.', 'You can manage the active church records and access, but administrative roles and sensitive tags remain centralized.')}
            </p>
          </div>

          {ehGestaoLocal && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <p className="font-semibold mb-1">{tr('Escopo da gestão local', 'Alcance de la gestión local', 'Scope of local management')}</p>
              <p>{tr('Pastores, presbíteros e secretaria ajudam no cadastro e na liberação de acesso da igreja ativa. Promoções administrativas e tags de liderança continuam reservadas à gestão global.', 'Pastores, presbíteros y secretaría ayudan con el registro y la liberación de acceso de la iglesia activa. Las promociones administrativas y etiquetas de liderazgo siguen reservadas a la gestión global.', 'Pastors, elders, and office staff help with registration and access release for the active church. Administrative promotions and leadership tags remain reserved for global management.')}</p>
            </div>
          )}

          {permissoes.isSuperAdmin && (
            <div className="bg-white rounded-xl border border-slate-200 p-2 inline-flex gap-2 shadow-sm">
              <button
                type="button"
                onClick={() => setModoPainel('cadastros')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  modoPainel === 'cadastros'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tr('Cadastros da igreja', 'Registros de la iglesia', 'Church records')}
              </button>
              <button
                type="button"
                onClick={() => setModoPainel('hub_macro')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  modoPainel === 'hub_macro'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tr('Hub macro', 'Hub macro', 'Macro hub')}
              </button>
            </div>
          )}

          {permissoes.isSuperAdmin && modoPainel === 'hub_macro' ? (
            <UsuariosHubPanel />
          ) : (
            <>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">{tr('Total de Pessoas', 'Total de Personas', 'Total People')}</p>
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{pessoas.length}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-emerald-600">{tr('Com Acesso', 'Con Acceso', 'With Access')}</p>
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-900">{countComAcesso}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-600">{tr('Membros (Sem Acesso)', 'Miembros (Sin Acceso)', 'Members (No Access)')}</p>
                <UserX className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-blue-900">{countSemAcesso}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-2 inline-flex gap-2 shadow-sm">
            <button
              type="button"
              onClick={() => setVisaoGestao('pessoas')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                visaoGestao === 'pessoas' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tr('Pessoas da igreja', 'Personas de la iglesia', 'Church people')}
            </button>
            <button
              type="button"
              onClick={() => setVisaoGestao('acessos')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                visaoGestao === 'acessos' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tr('Acessos e permissões', 'Accesos y permisos', 'Access and permissions')}
            </button>
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
              {mostrarFormulario
                ? tr('Cancelar', 'Cancelar', 'Cancel')
                : visaoGestao === 'pessoas'
                  ? tr('Adicionar Pessoa', 'Agregar Persona', 'Add Person')
                  : tr('Adicionar Acesso', 'Agregar Acceso', 'Add Access')}
            </button>
          </div>

          {/* Formulário Adicionar */}
          {mostrarFormulario && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-top-4 duration-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-700" />
                {visaoGestao === 'pessoas'
                  ? tr('Nova Pessoa da Igreja', 'Nueva Persona de la Iglesia', 'New Church Person')
                  : tr('Novo Usuário / Acesso', 'Nuevo Usuario / Acceso', 'New User / Access')}
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
                      <p className="font-semibold text-emerald-900">{tr('Cadastrar apenas como Membro', 'Registrar solo como Miembro', 'Register only as Member')}</p>
                      <p className="text-sm text-emerald-700">{tr('Apenas registro na base de dados, sem login no sistema.', 'Solo registro en la base de datos, sin acceso al sistema.', 'Database record only, without system login.')}</p>
                    </div>
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {!apenasMembro && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">{tr('E-mail', 'Correo electrónico', 'Email')} *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input 
                          type="email" 
                          value={novoEmail} 
                          onChange={(e) => setNovoEmail(e.target.value)} 
                          required={!apenasMembro} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none" 
                          placeholder={tr('exemplo@email.com', 'ejemplo@email.com', 'example@email.com')}
                        />
                      </div>
                    </div>
                  )}
                  <div className={apenasMembro ? 'sm:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Nome Completo', 'Nombre Completo', 'Full Name')} *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={novoNome} 
                        onChange={(e) => setNovoNome(e.target.value)} 
                        required 
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none" 
                        placeholder={tr('Nome da pessoa', 'Nombre de la persona', 'Person name')}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Telefone', 'Teléfono', 'Phone')}</label>
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
                  
                  {/* Campo de Cargo só aparece se NÃO for "apenas membro" */}
                  {!apenasMembro && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Cargo / Função', 'Cargo / Función', 'Role / Function')} *</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <select 
                          value={novoCargo} 
                          onChange={(e) => setNovoCargo(e.target.value as CargoTipo)} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 outline-none appearance-none"
                        >
                          {cargosDisponiveis.map((cargo) => (
                            <option key={cargo} value={cargo}>
                              {getCargoLabel(cargo)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={salvando}
                  className="w-full sm:w-auto bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 font-medium"
                >
                  {salvando ? tr('Cadastrando...', 'Registrando...', 'Registering...') : tr('Cadastrar Pessoa', 'Registrar Persona', 'Register Person')}
                </button>
              </form>
            </div>
          )}

          {/* Tabela de Pessoas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {visaoGestao === 'pessoas' ? <Users className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                {tituloSecao}
              </h3>
              <span className="text-sm bg-white/20 text-white px-3 py-1 rounded-full font-medium">
                {badgeSecao} {tr('itens', 'elementos', 'items')}
              </span>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">{descricaoSecao}</p>
              {/* Filtros */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={visaoGestao === 'pessoas'
                      ? tr('Buscar por nome, cargo ou telefone...', 'Buscar por nombre, cargo o teléfono...', 'Search by name, role, or phone...')
                      : tr('Buscar por nome, email, cargo ou telefone...', 'Buscar por nombre, correo, cargo o teléfono...', 'Search by name, email, role, or phone...')}
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
                    <option value="todos">{tr('Todos', 'Todos', 'All')}</option>
                    <option value="com_acesso">{tr('Com Acesso', 'Con Acceso', 'With Access')}</option>
                    <option value="sem_acesso">{tr('Sem Acesso', 'Sin Acceso', 'Without Access')}</option>
                  </select>

                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mostrarInativos}
                      onChange={(e) => setMostrarInativos(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700 font-medium">{tr('Inativos', 'Inactivos', 'Inactive')}</span>
                  </label>
                </div>
              </div>

              {pessoasLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto"></div>
                  <p className="mt-2 text-slate-500 text-sm">{tr('Carregando...', 'Cargando...', 'Loading...')}</p>
                </div>
              ) : listaExibida.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{visaoGestao === 'pessoas'
                    ? tr('Nenhuma pessoa sem acesso encontrada', 'No se encontró ninguna persona sin acceso', 'No person without access found')
                    : tr('Nenhum acesso encontrado', 'No se encontró ningún acceso', 'No access found')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-100">
                        <th onClick={() => handleSort('nome')} className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
                          <div className="flex items-center gap-2">{tr('Nome', 'Nombre', 'Name')} {getSortIcon('nome')}</div>
                        </th>
                        <th onClick={() => handleSort('email')} className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-50 hidden lg:table-cell">
                          <div className="flex items-center gap-2">{tr('Email', 'Email', 'Email')} {getSortIcon('email')}</div>
                        </th>
                        <th onClick={() => handleSort('cargo')} className="text-left px-4 py-3 font-semibold text-slate-600 cursor-pointer hover:bg-slate-50">
                          <div className="flex items-center gap-2">{tr('Cargo', 'Cargo', 'Role')} {getSortIcon('cargo')}</div>
                        </th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">{tr('Acesso', 'Acceso', 'Access')}</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">{tr('Status', 'Estado', 'Status')}</th>
                        <th className="text-center px-4 py-3 font-semibold text-slate-600">{tr('Ações', 'Acciones', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {listaExibida.map((pessoa) => (
                        <tr key={pessoa.id} className={`hover:bg-slate-50/50 transition-colors ${!pessoa.ativo ? 'opacity-60 bg-slate-50/30' : ''}`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${pessoa.tem_acesso ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {pessoa.tem_acesso ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{pessoa.nome}</div>
                                <div className="text-xs text-slate-500 lg:hidden">{pessoa.email || tr('Sem email', 'Sin correo', 'No email')}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600 text-sm hidden lg:table-cell">
                            {pessoa.email || <span className="text-slate-400 italic">{tr('Sem email', 'Sin correo', 'No email')}</span>}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getCargoCor(pessoa.cargo as CargoTipo)}`}>
                              {getCargoLabel(pessoa.cargo as CargoTipo)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            {pessoa.tem_acesso ? 
                              <span className="text-emerald-600 text-xs font-bold uppercase tracking-wider">{tr('Acesso OK', 'Acceso OK', 'Access OK')}</span> : 
                              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{tr('Cadastro local', 'Registro local', 'Local record')}</span>
                            }
                          </td>
                          <td className="px-4 py-4 text-center hidden md:table-cell">
                            {pessoa.ativo ? 
                              <span className="inline-flex items-center gap-1.5 text-green-600 text-xs font-bold"><Play className="w-3 h-3 fill-current" /> {tr('Ativo', 'Activo', 'Active')}</span> : 
                              <span className="inline-flex items-center gap-1.5 text-red-400 text-xs font-bold"><Pause className="w-3 h-3 fill-current" /> {tr('Inativo', 'Inactivo', 'Inactive')}</span>
                            }
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-1">
                              {!pessoa.tem_acesso && (
                                <button
                                  onClick={() => liberarAcessoPessoa(pessoa)}
                                  disabled={liberandoAcessoId === pessoa.id || !pessoa.email}
                                  className="p-2 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors disabled:opacity-30"
                                  title={tr('Liberar acesso', 'Habilitar acceso', 'Grant access')}
                                >
                                  {liberandoAcessoId === pessoa.id ? (
                                    <div className="animate-spin w-4 h-4 border-2 border-emerald-700 border-b-transparent rounded-full" />
                                  ) : (
                                    <UserCheck className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <button onClick={() => abrirModalEdicao(pessoa)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title={tr('Editar', 'Editar', 'Edit')}>
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => alterarStatus(pessoa.id, !pessoa.ativo)} 
                                className={`p-2 rounded-lg transition-colors ${pessoa.ativo ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-green-50 text-green-600'}`}
                                title={pessoa.ativo ? tr('Pausar/Inativar', 'Pausar/Desactivar', 'Pause/Deactivate') : tr('Ativar', 'Activar', 'Activate')}
                              >
                                {pessoa.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => removerPessoa(pessoa.id, pessoa.nome, pessoa.tem_acesso)} 
                                disabled={pessoa.tem_acesso}
                                className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors disabled:opacity-20"
                                title={tr('Remover', 'Eliminar', 'Remove')}
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
              {tr('Guia de Gerenciamento', 'Guía de Gestión', 'Management Guide')}
            </div>
            <div className="grid sm:grid-cols-2 gap-8 text-sm">
              <div className="space-y-2">
                <p className="text-white font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" /> {tr('Membros da Igreja', 'Miembros de la Iglesia', 'Church Members')}
                </p>
                <ul className="space-y-1 list-inside list-disc opacity-80">
                  <li>{tr('Pessoas registradas para organização interna', 'Personas registradas para organización interna', 'People registered for internal organization')}</li>
                  <li>{tr('Não possuem senha ou acesso ao painel', 'No tienen contraseña ni acceso al panel', 'They do not have a password or panel access')}</li>
                  <li>{tr('Ganham acesso quando um administrador libera o e-mail para login', 'Obtienen acceso cuando un administrador habilita el correo para iniciar sesión', 'They gain access when an administrator enables the email for login')}</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-white font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> {tr('Usuários com Acesso', 'Usuarios con Acceso', 'Users with Access')}
                </p>
                <ul className="space-y-1 list-inside list-disc opacity-80">
                  <li>{tr('Podem entrar com e-mail e senha, Google ou Microsoft', 'Pueden ingresar con correo y contraseña, Google o Microsoft', 'They can sign in with email and password, Google, or Microsoft')}</li>
                  <li>{tr('Permissões de visualização baseadas no cargo e no vínculo com a igreja', 'Permisos de visualización basados en el cargo y el vínculo con la iglesia', 'Viewing permissions based on role and church relationship')}</li>
                  <li>{tr('Podem ser inativados para bloqueio imediato de acesso', 'Pueden desactivarse para bloquear el acceso de inmediato', 'They can be deactivated for immediate access blocking')}</li>
                </ul>
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
                    <h3 className="text-xl font-bold text-slate-900">{tr('Editar Pessoa', 'Editar Persona', 'Edit Person')}</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {pessoaEditando.tem_acesso
                        ? tr('Usuário do Sistema', 'Usuario del Sistema', 'System User')
                        : tr('Membro da Igreja', 'Miembro de la Iglesia', 'Church Member')}
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
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">{tr('Nome Completo', 'Nombre Completo', 'Full Name')}</label>
                      <input type="text" value={editandoNome} onChange={(e) => setEditandoNome(e.target.value)} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">{tr('E-mail', 'Correo electrónico', 'Email')}</label>
                      <input 
                        type="email" 
                        value={editandoEmail} 
                        onChange={(e) => setEditandoEmail(e.target.value)} 
                        disabled={pessoaEditando.tem_acesso || !ehGestaoGlobal} 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50" 
                      />
                      {!ehGestaoGlobal && (
                        <p className="mt-1 text-xs text-slate-500">{tr('A gestão local não altera e-mail.', 'La gestión local no cambia el correo.', 'Local management does not change email.')}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">{tr('Cargo / Função', 'Cargo / Función', 'Role / Function')}</label>
                      <select
                        value={editandoCargo}
                        onChange={(e) => setEditandoCargo(e.target.value as CargoTipo)}
                        disabled={!ehGestaoGlobal && !cargosDisponiveis.includes(pessoaEditando.cargo)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                      >
                        {cargosDisponiveis.map((cargo) => (
                          <option key={cargo} value={cargo}>
                            {getCargoLabel(cargo)}
                          </option>
                        ))}
                      </select>
                      {!ehGestaoGlobal && (
                        <p className="mt-1 text-xs text-slate-500">{tr('Cargos pastorais e administrativos ficam sob gestão global.', 'Los cargos pastorales y administrativos quedan bajo gestión global.', 'Pastoral and administrative roles remain under global management.')}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">{tr('Telefone', 'Teléfono', 'Phone')}</label>
                      <input type="tel" value={editandoTelefone} onChange={(e) => setEditandoTelefone(formatPhoneNumber(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                </div>

                {/* Habilidades - Tags */}
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Music className="w-4 h-4 text-emerald-600" />
                    {tr('Habilidades & Funções', 'Habilidades y Funciones', 'Skills & Functions')}
                    {loadingTags && <div className="animate-spin w-3 h-3 border border-slate-400 border-b-transparent rounded-full ml-auto" />}
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {todasTagsDisponiveis.map(tag => (
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
                  {!ehGestaoGlobal && (
                    <p className="text-xs text-slate-500">{tr('Tags de liderança e pregação ficam ocultas para a gestão local.', 'Las etiquetas de liderazgo y predicación quedan ocultas para la gestión local.', 'Leadership and preaching tags remain hidden for local management.')}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button type="submit" disabled={salvando} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50">
                    {salvando ? tr('Salvando...', 'Guardando...', 'Saving...') : tr('Salvar Alterações', 'Guardar Cambios', 'Save Changes')}
                  </button>
                  <button type="button" onClick={fecharModalEdicao} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
                    {tr('Cancelar', 'Cancelar', 'Cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

            </>
          )}

        </div>
      </main>
    </div>
  );
}
