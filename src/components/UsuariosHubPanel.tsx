'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  type CargoTipo,
} from '@/lib/permissions';
import { useLocale } from '@/i18n/provider';
import { resolveApiErrorMessage } from '@/lib/api-feedback';
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
  const locale = useLocale();
  const tr = (pt: string, es: string, en: string) =>
    locale === 'es' ? es : locale === 'en' ? en : pt;
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');
  const [churchDrafts, setChurchDrafts] = useState<ChurchDraft[]>([]);
  const getCargoLabel = (cargo: CargoTipo) =>
    ({
      membro: tr('Membro', 'Miembro', 'Member'),
      diacono: tr('Diácono', 'Diácono', 'Deacon'),
      musico: tr('Músico', 'Músico', 'Musician'),
      staff: tr('Staff', 'Staff', 'Staff'),
      seminarista: tr('Seminarista', 'Seminarista', 'Seminarian'),
      presbitero: tr('Presbítero', 'Presbítero', 'Elder'),
      pastor: tr('Pastor', 'Pastor', 'Pastor'),
      admin: tr('Administrador', 'Administrador', 'Administrator'),
      superadmin: tr('Super Admin', 'Super Admin', 'Super Admin'),
    } satisfies Record<CargoTipo, string>)[cargo];

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
      setErro(tr('Preencha o e-mail do usuário.', 'Completa el correo del usuario.', 'Fill in the user email.'));
      return;
    }

    if (selectedChurches.length === 0) {
      setErro(tr('Selecione pelo menos uma igreja para conceder acesso.', 'Selecciona al menos una iglesia para conceder acceso.', 'Select at least one church to grant access.'));
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
      setErro(result.error || tr('Erro ao salvar usuário.', 'Error al guardar el usuario.', 'Error saving user.'));
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
              {usuario ? usuario.nome_exibicao : tr('Novo Usuário do Hub', 'Nuevo Usuario del Hub', 'New Hub User')}
            </h3>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              {usuario
                ? tr('Editar vínculos de acesso por igreja', 'Editar vínculos de acceso por iglesia', 'Edit church access links')
                : tr('Cadastrar ou aproveitar usuário já existente pelo e-mail', 'Registrar o aprovechar un usuario ya existente por correo', 'Register or reuse an existing user by email')}
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
            <p className="font-semibold text-slate-900 mb-1">{tr('Como esse cadastro funciona', 'Cómo funciona este registro', 'How this registration works')}</p>
            <p>
              {tr('Se o e-mail já existir no sistema, o Next reaproveita o usuário e apenas acrescenta ou atualiza os vínculos por igreja. Isso evita conflito ao liberar o mesmo pastor em mais de uma igreja.', 'Si el correo ya existe en el sistema, Next reutiliza el usuario y solo agrega o actualiza los vínculos por iglesia. Esto evita conflictos al habilitar al mismo pastor en más de una iglesia.', 'If the email already exists in the system, Next reuses the user and only adds or updates church links. This avoids conflicts when granting the same pastor access to more than one church.')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {tr('Nome', 'Nombre', 'Name')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder={tr('Nome completo', 'Nombre completo', 'Full name')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {tr('E-mail', 'Correo electrónico', 'Email')} *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder={tr('exemplo@email.com', 'ejemplo@email.com', 'example@email.com')}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {tr('Telefone', 'Teléfono', 'Phone')}
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
                    placeholder={tr('(92) 90000-0000', '(92) 90000-0000', '(92) 90000-0000')}
                  />
                </div>
              </div>

              {usuario?.auth_user_id ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">{tr('Conta autenticada já vinculada', 'Cuenta autenticada ya vinculada', 'Authenticated account already linked')}</p>
                  <p className="mt-1 break-all">{usuario.auth_user_id}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">{tr('Aguardando primeiro acesso', 'Esperando el primer acceso', 'Awaiting first access')}</p>
                  <p className="mt-1">
                    {tr('O usuário poderá criar a senha depois com o mesmo e-mail autorizado.', 'El usuario podrá crear la contraseña después con el mismo correo autorizado.', 'The user will be able to create the password later with the same authorized email.')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-700">{tr('Acesso por Igreja', 'Acceso por Iglesia', 'Church Access')}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {tr('Marque as igrejas onde esse usuário pode operar e defina o cargo em cada vínculo.', 'Marca las iglesias donde este usuario puede operar y define el cargo en cada vínculo.', 'Select the churches where this user can operate and define the role for each link.')}
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
                          {formatIgrejaLocalizacao(igreja) || tr('Igreja sem localização', 'Iglesia sin ubicación', 'Church without location')}
                        </p>
                      </div>
                    </label>

                    {draft.enabled && (
                      <div className="grid md:grid-cols-2 gap-4 mt-4 pl-7">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-2">
                            {tr('Cargo neste vínculo', 'Cargo en este vínculo', 'Role in this link')}
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
                              {tr('Acesso ativo', 'Acceso activo', 'Active access')}
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
              {saving
                ? tr('Salvando...', 'Guardando...', 'Saving...')
                : usuario
                  ? tr(
                      'Salvar Alterações',
                      'Guardar Cambios',
                      'Save Changes'
                    )
                  : tr(
                      'Cadastrar Usuário',
                      'Registrar Usuario',
                      'Register User'
                    )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              {tr('Cancelar', 'Cancelar', 'Cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UsuariosHubPanel() {
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
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
  const getCargoLabel = useCallback(
    (cargo: CargoTipo) =>
      ({
        membro: tr('Membro', 'Miembro', 'Member'),
        diacono: tr('Diácono', 'Diácono', 'Deacon'),
        musico: tr('Músico', 'Músico', 'Musician'),
        staff: tr('Staff', 'Staff', 'Staff'),
        seminarista: tr('Seminarista', 'Seminarista', 'Seminarian'),
        presbitero: tr('Presbítero', 'Presbítero', 'Elder'),
        pastor: tr('Pastor', 'Pastor', 'Pastor'),
        admin: tr('Administrador', 'Administrador', 'Administrator'),
        superadmin: tr('Super Admin', 'Super Admin', 'Super Admin'),
      } satisfies Record<CargoTipo, string>)[cargo],
    [tr]
  );

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
          throw new Error(
            resolveApiErrorMessage(
              locale,
              payload,
              tr(
                'Erro ao carregar igrejas.',
                'Error al cargar iglesias.',
                'Error loading churches.'
              )
            )
          );
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
        console.error(
          tr(
            'Erro ao carregar escopo do hub:',
            'Error al cargar el alcance del hub:',
            'Error loading hub scope:'
          ),
          err
        );
      }
    }

    void carregarIgrejas();

    return () => {
      ativo = false;
    };
  }, [tr, locale]);

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

    setMensagem(
      result.message ||
        tr(
          'Usuário salvo com sucesso.',
          'Usuario guardado con éxito.',
          'User saved successfully.'
        )
    );
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
              {tr('Hub de Usuários', 'Hub de Usuarios', 'User Hub')}
            </h2>
            <p className="text-slate-600 mt-1">
              {tr(
                'Visão macro de usuários com acesso no sistema, com vínculos em uma ou mais igrejas.',
                'Vista macro de usuarios con acceso al sistema, con vínculos en una o más iglesias.',
                'Macro view of users with system access, linked to one or more churches.'
              )}
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
            {tr('Novo usuário macro', 'Nuevo usuario macro', 'New hub user')}
          </button>
        </div>

        <div className="mt-6 grid xl:grid-cols-[auto,1fr] gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              {tr('Modo de Gestão', 'Modo de Gestión', 'Management Mode')}
            </p>
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
                {tr('Igreja atual', 'Iglesia actual', 'Current church')}
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
                {tr('Todas', 'Todas', 'All')}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3 max-w-sm">
              {tr(
                'Em “Todas”, você trabalha com o usuário já existente no sistema e só acrescenta novos vínculos de igreja, sem tentar cadastrá-lo de novo com o mesmo e-mail.',
                'En “Todas”, trabajas con el usuario ya existente en el sistema y solo agregas nuevos vínculos de iglesia, sin intentar registrarlo de nuevo con el mismo correo.',
                'In “All”, you work with the user that already exists in the system and only add new church links, without trying to register them again with the same email.'
              )}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              {tr('Escopo Atual', 'Alcance Actual', 'Current Scope')}
            </p>
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
            <p className="text-sm text-slate-600">
              {tr('Total de Usuários', 'Total de Usuarios', 'Total Users')}
            </p>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{usuarios.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-emerald-700">
              {tr('Acessos Ativos', 'Accesos Activos', 'Active Access')}
            </p>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-900">{countAtivos}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-700">
              {tr('Sem Acesso Ativo', 'Sin Acceso Activo', 'No Active Access')}
            </p>
            <Info className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-900">{countInativos}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            {tr('Usuários do Hub', 'Usuarios del Hub', 'Hub Users')}
          </h3>
          <span className="text-sm bg-white/15 text-white px-3 py-1 rounded-full font-medium">
            {usuariosFiltrados.length}{' '}
            {tr('itens', 'elementos', 'items')}
          </span>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={tr(
                  'Buscar por nome, e-mail, cargo ou igreja...',
                  'Buscar por nombre, correo, cargo o iglesia...',
                  'Search by name, email, role, or church...'
                )}
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
              <span className="text-sm text-slate-700 font-medium">
                {tr(
                  'Mostrar sem acesso ativo',
                  'Mostrar sin acceso activo',
                  'Show without active access'
                )}
              </span>
            </label>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
              <p className="mt-2 text-slate-500 text-sm">
                {tr('Carregando hub...', 'Cargando hub...', 'Loading hub...')}
              </p>
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>
                {tr(
                  'Nenhum usuário encontrado neste escopo.',
                  'No se encontró ningún usuario en este alcance.',
                  'No users found in this scope.'
                )}
              </p>
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
                          {usuario.ativo
                            ? tr('Acesso ativo', 'Acceso activo', 'Active access')
                            : tr(
                                'Sem acesso ativo',
                                'Sin acceso activo',
                                'No active access'
                              )}
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
                        title={tr(
                          'Editar vínculos',
                          'Editar vínculos',
                          'Edit links'
                        )}
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
          {tr('Guia do Hub Macro', 'Guía del Hub Macro', 'Hub Guide')}
        </div>
        <div className="grid sm:grid-cols-2 gap-8 text-sm">
          <div className="space-y-2">
            <p className="text-white font-semibold">
              {tr(
                'Quando usar a visão “Todas”',
                'Cuándo usar la vista “Todas”',
                'When to use the “All” view'
              )}
            </p>
            <ul className="space-y-1 list-inside list-disc opacity-80">
              <li>
                {tr(
                  'Para dar acesso do mesmo pastor em mais de uma igreja',
                  'Para dar acceso al mismo pastor en más de una iglesia',
                  'To grant the same pastor access in more than one church'
                )}
              </li>
              <li>
                {tr(
                  'Para corrigir vínculos multi-igreja sem duplicar cadastro',
                  'Para corregir vínculos multiiglesia sin duplicar el registro',
                  'To fix multi-church links without duplicating the record'
                )}
              </li>
              <li>
                {tr(
                  'Para aproveitar o mesmo e-mail já existente no sistema',
                  'Para aprovechar el mismo correo ya existente en el sistema',
                  'To reuse the same email that already exists in the system'
                )}
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-white font-semibold">
              {tr('Fluxo recomendado', 'Flujo recomendado', 'Recommended flow')}
            </p>
            <ul className="space-y-1 list-inside list-disc opacity-80">
              <li>
                {tr(
                  'Busque o usuário já existente pelo nome ou e-mail',
                  'Busca al usuario ya existente por nombre o correo',
                  'Find the existing user by name or email'
                )}
              </li>
              <li>
                {tr(
                  'Abra a edição e habilite a nova igreja',
                  'Abre la edición y habilita la nueva iglesia',
                  'Open the editor and enable the new church'
                )}
              </li>
              <li>
                {tr(
                  'Escolha o cargo nessa nova igreja e salve',
                  'Elige el cargo en esa nueva iglesia y guarda',
                  'Choose the role in that new church and save'
                )}
              </li>
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
