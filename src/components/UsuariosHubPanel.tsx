'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit2,
  Info,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  CHURCH_STORAGE_KEY,
  formatIgrejaLocalizacao,
  type IgrejaSelecionavel,
} from '@/lib/church-utils';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import {
  getCargoCor,
  getCargoLabel,
  type CargoTipo,
} from '@/lib/permissions';
import {
  useHubUsuarios,
  type HubUsuario,
  type HubUsuarioPayload,
} from '@/hooks/useHubUsuarios';

type HubScope = 'current' | 'all';

type ChurchDraft = {
  igrejaId: string;
  enabled: boolean;
  cargo: CargoTipo;
  ativo: boolean;
};

const CARGOS_PERMITIDOS: CargoTipo[] = [
  'membro',
  'diacono',
  'musico',
  'staff',
  'seminarista',
  'presbitero',
  'pastor',
  'admin',
  'superadmin',
];

function HubUsuarioModal({
  open,
  usuario,
  igrejas,
  defaultChurchId,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  usuario: HubUsuario | null;
  igrejas: IgrejaSelecionavel[];
  defaultChurchId?: string | null;
  onClose: () => void;
  onSave: (payload: HubUsuarioPayload) => Promise<{ success: boolean; error?: string }>;
  saving: boolean;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [churchDrafts, setChurchDrafts] = useState<ChurchDraft[]>([]);

  useEffect(() => {
    if (!open) return;

    setErro('');
    setNome(usuario?.nome || '');
    setEmail(usuario?.email || '');
    setTelefone(formatPhoneNumber(usuario?.telefone || ''));

    setChurchDrafts(
      igrejas.map((igreja) => {
        const existingLink = usuario?.vinculos.find(
          (vinculo) => vinculo.igreja_id === igreja.id
        );

        return {
          igrejaId: igreja.id,
          enabled: existingLink ? true : igreja.id === defaultChurchId,
          cargo: (existingLink?.cargo || 'membro') as CargoTipo,
          ativo: existingLink?.ativo ?? true,
        };
      })
    );
  }, [open, usuario, igrejas, defaultChurchId]);

  if (!open) return null;

  const handleDraftChange = (
    igrejaId: string,
    patch: Partial<ChurchDraft>
  ) => {
    setChurchDrafts((current) =>
      current.map((draft) =>
        draft.igrejaId === igrejaId ? { ...draft, ...patch } : draft
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro('');

    const normalizedEmail = email.trim().toLowerCase();
    const selectedChurches = churchDrafts.filter((draft) => draft.enabled);

    if (!normalizedEmail) {
      setErro('Preencha o e-mail do usuário.');
      return;
    }

    if (selectedChurches.length === 0) {
      setErro('Selecione pelo menos uma igreja para conceder acesso.');
      return;
    }

    const result = await onSave({
      userId: usuario?.id,
      pessoaId: usuario?.pessoa_id || undefined,
      nome: nome.trim() || undefined,
      email: normalizedEmail,
      telefone: telefone ? unformatPhoneNumber(telefone) : undefined,
      igrejas: selectedChurches.map((church) => ({
        igrejaId: church.igrejaId,
        cargo: church.cargo,
        ativo: church.ativo,
      })),
    });

    if (!result.success) {
      setErro(result.error || 'Erro ao salvar usuário.');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {usuario ? usuario.nome_exibicao : 'Novo Usuário do Hub'}
            </h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              {usuario
                ? 'Editar vínculos de acesso por igreja'
                : 'Cadastrar ou aproveitar usuário já existente pelo e-mail'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900 mb-1">Como esse cadastro funciona</p>
            <p>
              Se o e-mail já existir no sistema, o Next reaproveita o usuário e
              apenas acrescenta ou atualiza os vínculos por igreja. Isso evita
              conflito ao liberar o mesmo pastor em mais de uma igreja.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nome
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="Nome completo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="exemplo@email.com"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Telefone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(event) =>
                      setTelefone(formatPhoneNumber(event.target.value))
                    }
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="(92) 90000-0000"
                  />
                </div>
              </div>

              {usuario?.auth_user_id ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Conta autenticada já vinculada</p>
                  <p className="mt-1 break-all">{usuario.auth_user_id}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Aguardando primeiro acesso</p>
                  <p className="mt-1">
                    O usuário poderá criar a senha depois com o mesmo e-mail
                    autorizado.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-700">Acesso por Igreja</h4>
              <p className="text-xs text-slate-500 mt-1">
                Marque as igrejas onde esse usuário pode operar e defina o cargo
                em cada vínculo.
              </p>
            </div>

            <div className="space-y-4">
              {igrejas.map((igreja) => {
                const draft = churchDrafts.find(
                  (item) => item.igrejaId === igreja.id
                );

                if (!draft) return null;

                return (
                  <div
                    key={igreja.id}
                    className="border border-slate-200 rounded-xl p-4 bg-white"
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) =>
                          handleDraftChange(igreja.id, {
                            enabled: event.target.checked,
                          })
                        }
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">
                          {igreja.sigla || igreja.nome}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatIgrejaLocalizacao(igreja) || 'Igreja sem localização'}
                        </p>
                      </div>
                    </label>

                    {draft.enabled && (
                      <div className="grid md:grid-cols-2 gap-4 mt-4 pl-7">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2">
                            Cargo neste vínculo
                          </label>
                          <select
                            value={draft.cargo}
                            onChange={(event) =>
                              handleDraftChange(igreja.id, {
                                cargo: event.target.value as CargoTipo,
                              })
                            }
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
                          >
                            {CARGOS_PERMITIDOS.map((cargo) => (
                              <option key={cargo} value={cargo}>
                                {getCargoLabel(cargo)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={draft.ativo}
                              onChange={(event) =>
                                handleDraftChange(igreja.id, {
                                  ativo: event.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium text-slate-700">
                              Acesso ativo
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
              {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvando...' : usuario ? 'Salvar Alterações' : 'Cadastrar Usuário'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UsuariosHubPanel() {
  const {
    usuarios,
    loading,
    error,
    listarUsuarios,
    salvarUsuario,
  } = useHubUsuarios();

  const [igrejasGerenciaveis, setIgrejasGerenciaveis] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string | null>(null);
  const [hubScope, setHubScope] = useState<HubScope>('current');
  const [mostrarInativos, setMostrarInativos] = useState(true);
  const [busca, setBusca] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<HubUsuario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const igrejasNoEscopo = useMemo(() => {
    if (hubScope === 'all') {
      return igrejasGerenciaveis;
    }

    const igrejaAtual = igrejasGerenciaveis.find(
      (igreja) => igreja.id === igrejaAtualId
    );

    return igrejaAtual ? [igrejaAtual] : igrejasGerenciaveis.slice(0, 1);
  }, [hubScope, igrejasGerenciaveis, igrejaAtualId]);

  useEffect(() => {
    let ativo = true;

    async function carregarIgrejas() {
      try {
        const response = await fetch('/api/igrejas/selecionaveis');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Erro ao carregar igrejas.');
        }

        if (!ativo) return;

        const lista = (payload.igrejas || []) as IgrejaSelecionavel[];
        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const igrejaPreferida =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(CHURCH_STORAGE_KEY)
            : null;
        const prioridade = [
          igrejaUrl,
          igrejaPreferida,
          payload.igrejaAtualId,
          lista[0]?.id || null,
        ].filter(Boolean) as string[];
        const igrejaResolvida =
          prioridade.find((id) => lista.some((igreja) => igreja.id === id)) || null;

        setIgrejasGerenciaveis(lista);
        setIgrejaAtualId(igrejaResolvida);

        if (igrejaResolvida && typeof window !== 'undefined') {
          window.localStorage.setItem(CHURCH_STORAGE_KEY, igrejaResolvida);
        }
      } catch (err: any) {
        console.error('Erro ao carregar escopo do hub:', err);
      }
    }

    void carregarIgrejas();

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    void listarUsuarios({
      scope: hubScope,
      igrejaId: igrejaAtualId || undefined,
    });
  }, [listarUsuarios, hubScope, igrejaAtualId]);

  const usuariosFiltrados = usuarios.filter((usuario) => {
    if (!mostrarInativos && !usuario.ativo) {
      return false;
    }

    if (!busca.trim()) return true;

    const termo = busca.toLowerCase();

    return (
      usuario.nome_exibicao.toLowerCase().includes(termo) ||
      usuario.email.toLowerCase().includes(termo) ||
      usuario.vinculos.some(
        (vinculo) =>
          vinculo.igreja_nome.toLowerCase().includes(termo) ||
          getCargoLabel(vinculo.cargo).toLowerCase().includes(termo)
      )
    );
  });

  const countAtivos = usuarios.filter((usuario) => usuario.ativo).length;
  const countInativos = usuarios.length - countAtivos;

  const handleSave = async (payload: HubUsuarioPayload) => {
    setSalvando(true);
    const result = await salvarUsuario(payload);
    setSalvando(false);

    if (!result.success) {
      return result;
    }

    setMensagem(result.message || 'Usuário salvo com sucesso.');
    await listarUsuarios({
      scope: hubScope,
      igrejaId: igrejaAtualId || undefined,
    });

    return { success: true };
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-slate-900" />
              Hub de Usuários
            </h2>
            <p className="text-slate-600 mt-1">
              Visão macro de usuários com acesso no sistema, com vínculos em uma
              ou mais igrejas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setUsuarioEditando(null);
              setShowModal(true);
            }}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-all font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo usuário macro
          </button>
        </div>

        <div className="mt-6 grid xl:grid-cols-[auto,1fr] gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">Modo de Gestão</p>
            <div className="bg-white rounded-xl border border-slate-200 p-1 inline-flex gap-1">
              <button
                type="button"
                onClick={() => setHubScope('current')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  hubScope === 'current'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Igreja atual
              </button>
              <button
                type="button"
                onClick={() => setHubScope('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  hubScope === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todas
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3 max-w-sm">
              Em “Todas”, você trabalha com o usuário já existente no sistema e
              só acrescenta novos vínculos de igreja, sem tentar cadastrá-lo de
              novo com o mesmo e-mail.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">Escopo Atual</p>
            <div className="flex flex-wrap gap-2">
              {igrejasNoEscopo.map((igreja) => (
                <span
                  key={igreja.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700"
                >
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  {igreja.sigla || igreja.nome}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {mensagem && (
        <div className="p-4 rounded-lg flex items-center justify-between bg-green-50 text-green-800 border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">{mensagem}</span>
          </div>
          <button
            onClick={() => setMensagem('')}
            className="text-current opacity-50 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Total de Usuários</p>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{usuarios.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-emerald-700">Acessos Ativos</p>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-900">{countAtivos}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">Sem Acesso Ativo</p>
            <Info className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-900">{countInativos}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Usuários do Hub
          </h3>
          <span className="text-sm bg-white/15 text-white px-3 py-1 rounded-full font-medium">
            {usuariosFiltrados.length} itens
          </span>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail, cargo ou igreja..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={(event) => setMostrarInativos(event.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700 font-medium">Mostrar sem acesso ativo</span>
            </label>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
              <p className="mt-2 text-slate-500 text-sm">Carregando hub...</p>
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum usuário encontrado neste escopo.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {usuariosFiltrados.map((usuario) => (
                <div
                  key={usuario.id}
                  className={`border rounded-xl p-4 transition-colors ${
                    usuario.ativo
                      ? 'border-slate-200 bg-white'
                      : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="font-semibold text-slate-900 text-lg">
                          {usuario.nome_exibicao}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            usuario.ativo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {usuario.ativo ? 'Acesso ativo' : 'Sem acesso ativo'}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-slate-600 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4">
                        <span>{usuario.email}</span>
                        {usuario.telefone && (
                          <span>{formatPhoneNumber(usuario.telefone)}</span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {usuario.vinculos.map((vinculo) => (
                          <span
                            key={`${usuario.id}-${vinculo.igreja_id}`}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                              vinculo.ativo
                                ? getCargoCor(vinculo.cargo)
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {vinculo.igreja_sigla || vinculo.igreja_nome}
                            <span className="opacity-60">·</span>
                            {getCargoLabel(vinculo.cargo)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setUsuarioEditando(usuario);
                          setShowModal(true);
                        }}
                        className="p-2 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors"
                        title="Editar vínculos"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-6 text-slate-400 border border-slate-800">
        <div className="flex items-center gap-2 text-white font-bold mb-4">
          <Info className="w-5 h-5 text-emerald-500" />
          Guia do Hub Macro
        </div>
        <div className="grid sm:grid-cols-2 gap-8 text-sm">
          <div className="space-y-2">
            <p className="text-white font-semibold">
              Quando usar a visão “Todas”
            </p>
            <ul className="space-y-1 list-inside list-disc opacity-80">
              <li>Para dar acesso do mesmo pastor em mais de uma igreja</li>
              <li>Para corrigir vínculos multi-igreja sem duplicar cadastro</li>
              <li>Para aproveitar o mesmo e-mail já existente no sistema</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-white font-semibold">Fluxo recomendado</p>
            <ul className="space-y-1 list-inside list-disc opacity-80">
              <li>Busque o usuário já existente pelo nome ou e-mail</li>
              <li>Abra a edição e habilite a nova igreja</li>
              <li>Escolha o cargo nessa nova igreja e salve</li>
            </ul>
          </div>
        </div>
      </div>

      <HubUsuarioModal
        open={showModal}
        usuario={usuarioEditando}
        igrejas={hubScope === 'all' ? igrejasGerenciaveis : igrejasNoEscopo}
        defaultChurchId={igrejaAtualId}
        onClose={() => {
          setShowModal(false);
          setUsuarioEditando(null);
        }}
        onSave={handleSave}
        saving={salvando}
      />
    </div>
  );
}
