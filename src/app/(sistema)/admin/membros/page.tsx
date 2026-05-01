'use client';

import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { CargoTipo, getCargoCor } from '@/lib/permissions';
import { formatPhoneNumber } from '@/lib/phone-mask';
import { getStoredChurchId } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage } from '@/lib/api-feedback';
import FamiliaView from '@/components/FamiliaView';
import { getIntlLocale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import { 
  Users, Phone, MapPin, Calendar, Heart, AlertCircle, 
  Search, Filter, Cake, Church, Mail, Briefcase, Home, BookOpen, Printer
} from 'lucide-react';

interface Membro {
  id: string;
  nome: string;
  cargo: string;
  email: string | null;
  telefone: string | null;
  foto_url: string | null;
  data_nascimento: string | null;
  data_casamento: string | null;
  data_batismo: string | null;
  situacao_saude: string | null;
  endereco_completo: string | null;
  status_membro: 'ativo' | 'afastado' | 'falecido' | 'visitante' | 'congregado';
  ativo: boolean;
  observacoes: string | null;
  sexo: 'M' | 'F' | null;
  estado_civil: string | null;
  profissao: string | null;
  escolaridade: string | null;
  logradouro: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  batizado: boolean | null;
  data_profissao_fe: string | null;
  grupo_familiar_nome: string | null;
  grupo_familiar_lider: string | null;
  cursos_discipulado: string[] | null;
  naturalidade_cidade: string | null;
  naturalidade_uf: string | null;
}

type FiltroAniversario = 'todos' | 'hoje' | 'mes' | 'proximos7dias';
type FiltroStatus = 'todos' | 'ativo' | 'afastado' | 'visitante' | 'congregado' | 'falecido';
type FiltroBatismo = 'todos' | 'batizado' | 'nao_batizado';
type FiltroGrupo = string;
type TipoListaImpressao = 'membros' | 'todos';

interface IgrejaResumo {
  timezone: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  slug: string | null;
}

const DEFAULT_TIMEZONE = 'America/Manaus';

function parseDateOnly(data: string | null) {
  if (!data) return null;
  const match = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getTodayInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function getBirthdayDateForYear(data: string | null, year: number) {
  const parsed = parseDateOnly(data);
  return parsed ? new Date(year, parsed.month - 1, parsed.day) : null;
}

// ─── Avatar do membro ─────────────────────────────────────────────────────────
function MembroAvatar({ nome, fotoUrl, size = 'md' }: { nome: string; fotoUrl: string | null; size?: 'sm' | 'md' }) {
  const [error, setError] = useState(false);
  const sz = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-12 h-12 text-sm';
  const initials = nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

  if (fotoUrl && !error) {
    return (
      <img src={fotoUrl} alt={nome} onError={() => setError(true)}
        className={`${sz} rounded-full object-cover border-2 border-slate-200 flex-shrink-0`} />
    );
  }
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-blue-200 flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold text-blue-600">{initials}</span>
    </div>
  );
}

export default function PastorarMembrosPage() {
  const router = useRouter();
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );

  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [visaoFamilia, setVisaoFamilia] = useState(false);
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
  const [igrejaResumo, setIgrejaResumo] = useState<IgrejaResumo | null>(null);
  const [tipoListaImpressao, setTipoListaImpressao] = useState<TipoListaImpressao>('membros');

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroAniversario, setFiltroAniversario] = useState<FiltroAniversario>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [filtroBatismo, setFiltroBatismo] = useState<FiltroBatismo>('todos');
  const [filtroGrupo, setFiltroGrupo] = useState<FiltroGrupo>('todos');
  const [filtroProfissao, setFiltroProfissao] = useState('');

  const totalLoading = authLoading || permLoading;
  const podeAcessar = permissoes.podePastorearMembros;

  useEffect(() => {
    if (!totalLoading && !user) { router.push('/login'); return; }
    if (!totalLoading && user && !podeAcessar) router.push('/admin');
  }, [user, totalLoading, podeAcessar, router]);

  const carregarMembros = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const igrejaId = getStoredChurchId();
      if (igrejaId) params.set('igreja_id', igrejaId);

      const response = await fetch(`/api/pessoas?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(
            locale,
            payload,
            tr(
              'Erro ao carregar membros',
              'Error al cargar miembros',
              'Error loading members'
            )
          )
        );
      }

      setMembros(payload.data || []);
      setIgrejaResumo(payload.igreja || null);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      setMensagem(
        tr(
          'Erro ao carregar membros',
          'Error al cargar miembros',
          'Error loading members'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [tr, locale]);

  useEffect(() => {
    if (user && podeAcessar) void carregarMembros();
  }, [user, podeAcessar, carregarMembros]);

  const churchTimezone = igrejaResumo?.timezone || DEFAULT_TIMEZONE;

  // ── Helpers de data ──
  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return null;
    const hoje = getTodayInTimeZone(churchTimezone);
    const nascimento = parseDateOnly(dataNascimento);
    if (!nascimento) return null;
    let idade = hoje.year - nascimento.year;
    const mes = hoje.month - nascimento.month;
    if (mes < 0 || (mes === 0 && hoje.day < nascimento.day)) idade--;
    return idade;
  };

  const ehAniversarioHoje = (data: string | null) => {
    if (!data) return false;
    const hoje = getTodayInTimeZone(churchTimezone);
    const d = parseDateOnly(data);
    return !!d && hoje.month === d.month && hoje.day === d.day;
  };

  const ehAniversarioNesteMes = (data: string | null) =>
    data ? getTodayInTimeZone(churchTimezone).month === parseDateOnly(data)?.month : false;

  const ehAniversarioProximos7Dias = (data: string | null) => {
    if (!data) return false;
    const hojeParts = getTodayInTimeZone(churchTimezone);
    const hoje = new Date(hojeParts.year, hojeParts.month - 1, hojeParts.day);
    const prox = new Date(hoje);
    prox.setDate(prox.getDate() + 7);
    const anivEsteAno = getBirthdayDateForYear(data, hojeParts.year);
    const anivProximoAno = getBirthdayDateForYear(data, hojeParts.year + 1);
    return [anivEsteAno, anivProximoAno].some((aniv) => aniv && aniv >= hoje && aniv <= prox);
  };

  const formatarData = (data: string | null) =>
    (() => {
      const parsed = parseDateOnly(data);
      return parsed
        ? new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString(intlLocale)
        : tr('-', '-', '-');
    })();

  const getStatusLabel = (status: string) =>
    ({
      ativo: tr('Ativo', 'Activo', 'Active'),
      afastado: tr('Afastado', 'Alejado', 'Away'),
      falecido: tr('Falecido', 'Fallecido', 'Deceased'),
      visitante: tr('Visitante', 'Visitante', 'Visitor'),
      congregado: tr('Congregado', 'Congregante', 'Congregant'),
    }[status] || status);

  const getCargoLabelLocalized = (cargo: CargoTipo) =>
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

  const getStatusCor = (status: string) =>
    ({ ativo: 'bg-green-100 text-green-800 border-green-300', afastado: 'bg-yellow-100 text-yellow-800 border-yellow-300', falecido: 'bg-gray-100 text-gray-800 border-gray-300', visitante: 'bg-blue-100 text-blue-800 border-blue-300', congregado: 'bg-purple-100 text-purple-800 border-purple-300' }[status] || 'bg-slate-100 text-slate-800 border-slate-300');

  const enderecoResumido = (m: Membro) => {
    if (m.bairro && m.cidade) return `${m.bairro}, ${m.cidade}/${m.uf || ''}`;
    if (m.endereco_completo) return m.endereco_completo;
    return null;
  };

  const camposIncompletos = (m: Membro) => {
    const faltando: string[] = [];
    if (!m.telefone) faltando.push(tr('telefone', 'teléfono', 'phone'));
    if (!m.email) faltando.push('email');
    if (!m.data_nascimento) faltando.push(tr('nascimento', 'nacimiento', 'birth date'));
    if (!m.sexo) faltando.push(tr('sexo', 'sexo', 'sex'));
    if (!m.estado_civil) faltando.push(tr('estado civil', 'estado civil', 'marital status'));
    if (!m.logradouro && !m.endereco_completo) faltando.push(tr('endereço', 'dirección', 'address'));
    if (!m.cidade) faltando.push(tr('cidade', 'ciudad', 'city'));
    if (!m.uf) faltando.push(tr('UF', 'provincia/estado', 'state'));
    return faltando;
  };

  const gruposUnicos = Array.from(
    new Set(membros.map(m => m.grupo_familiar_nome).filter(Boolean))
  ) as string[];

  // ── Filtros aplicados ──
  const membrosFiltrados = membros.filter(m => {
    if (!mostrarInativos && !m.ativo) return false;
    if (filtroStatus !== 'todos' && m.status_membro !== filtroStatus) return false;
    if (filtroAniversario === 'hoje' && !ehAniversarioHoje(m.data_nascimento)) return false;
    if (filtroAniversario === 'mes' && !ehAniversarioNesteMes(m.data_nascimento)) return false;
    if (filtroAniversario === 'proximos7dias' && !ehAniversarioProximos7Dias(m.data_nascimento)) return false;
    if (filtroBatismo === 'batizado' && !m.batizado) return false;
    if (filtroBatismo === 'nao_batizado' && m.batizado) return false;
    if (filtroGrupo !== 'todos' && m.grupo_familiar_nome !== filtroGrupo) return false;
    if (filtroProfissao && !(m.profissao || '').toLowerCase().includes(filtroProfissao.toLowerCase())) return false;
    if (!filtroTexto) return true;
    const busca = filtroTexto.toLowerCase();
    return (
      m.nome.toLowerCase().includes(busca) ||
      (m.email && m.email.toLowerCase().includes(busca)) ||
      (m.telefone && formatPhoneNumber(m.telefone).includes(busca)) ||
      (m.bairro && m.bairro.toLowerCase().includes(busca)) ||
      (m.cidade && m.cidade.toLowerCase().includes(busca)) ||
      (m.profissao && m.profissao.toLowerCase().includes(busca)) ||
      (m.grupo_familiar_nome && m.grupo_familiar_nome.toLowerCase().includes(busca)) ||
      (m.endereco_completo && m.endereco_completo.toLowerCase().includes(busca))
    );
  });

  const aniversariantesHoje = membros.filter(m =>
    m.ativo && m.status_membro === 'ativo' && ehAniversarioHoje(m.data_nascimento)
  );

  const membrosParaVotacao = membros
    .filter((m) => m.ativo && m.status_membro === 'ativo')
    .sort((a, b) => a.nome.localeCompare(b.nome, intlLocale, { sensitivity: 'base' }));
  const todosParaImpressao = [...membros]
    .sort((a, b) => a.nome.localeCompare(b.nome, intlLocale, { sensitivity: 'base' }));
  const pessoasParaImpressao = tipoListaImpressao === 'membros' ? membrosParaVotacao : todosParaImpressao;
  const localizacaoIgreja = [igrejaResumo?.cidade, igrejaResumo?.uf, igrejaResumo?.pais].filter(Boolean).join(', ');
  const tituloListaImpressao =
    tipoListaImpressao === 'membros'
      ? tr('Lista de Membros para Votação', 'Lista de Miembros para Votación', 'Voting Member List')
      : tr('Lista Geral de Pessoas', 'Lista General de Personas', 'Full People List');
  const descricaoListaImpressao =
    tipoListaImpressao === 'membros'
      ? tr('Somente membros ativos', 'Solo miembros activos', 'Active members only')
      : tr('Todos os status', 'Todos los estados', 'All statuses');

  const imprimirLista = (tipo: TipoListaImpressao) => {
    flushSync(() => setTipoListaImpressao(tipo));
    window.print();
  };

  const abrirWhatsApp = (telefone: string | null, nome: string) => {
    if (!telefone) {
      setMensagem(
        tr(
          'Este membro não possui telefone cadastrado',
          'Este miembro no tiene teléfono registrado',
          'This member has no phone number on file'
        )
      );
      return;
    }
    const num = telefone.replace(/\D/g, '');
    const msg = tr(
      `Olá ${nome}! Que a paz do Senhor esteja contigo!`,
      `Hola ${nome}. Que la paz del Senor esté contigo.`,
      `Hello ${nome}. May the Lord's peace be with you.`
    );
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const ligarPara = (telefone: string | null) => {
    if (!telefone) {
      setMensagem(
        tr(
          'Este membro não possui telefone cadastrado',
          'Este miembro no tiene teléfono registrado',
          'This member has no phone number on file'
        )
      );
      return;
    }
    window.location.href = `tel:${telefone}`;
  };

  if (totalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto" />
          <p className="mt-4 text-slate-600">
            {tr(
              'Verificando permissões...',
              'Verificando permisos...',
              'Checking permissions...'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!user || !podeAcessar) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          #membros-admin-screen {
            display: none !important;
          }

          #lista-membros-impressao {
            display: block !important;
            position: static !important;
            width: 100%;
            padding: 0;
          }

          @page {
            margin: 16mm;
          }
        }
      `}</style>

      <section
        id="lista-membros-impressao"
        className="hidden bg-white text-slate-900 print:block"
        aria-hidden="true"
      >
        <header className="mb-6 border-b-2 border-slate-900 pb-3">
          <h1 className="m-0 text-[22px] font-bold">
            {tituloListaImpressao}
          </h1>
          <p className="m-0 mt-1 text-sm text-slate-600">
            {localizacaoIgreja || igrejaResumo?.slug || ''}
          </p>
          <p className="m-0 mt-1 text-sm text-slate-600">
            {descricaoListaImpressao} · {pessoasParaImpressao.length}
          </p>
        </header>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-10 border border-slate-300 bg-slate-100 p-2 text-center text-slate-700">#</th>
              <th className="border border-slate-300 bg-slate-100 p-2 text-left text-slate-700">
                {tr('Nome', 'Nombre', 'Name')}
              </th>
              <th className="border border-slate-300 bg-slate-100 p-2 text-left text-slate-700">
                {tr('Telefone', 'Teléfono', 'Phone')}
              </th>
              {tipoListaImpressao === 'todos' && (
                <th className="border border-slate-300 bg-slate-100 p-2 text-left text-slate-700">
                  {tr('Status', 'Estado', 'Status')}
                </th>
              )}
              <th className="w-1/3 border border-slate-300 bg-slate-100 p-2 text-left text-slate-700">
                {tr('Assinatura', 'Firma', 'Signature')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pessoasParaImpressao.map((membro, index) => (
              <tr key={membro.id}>
                <td className="border border-slate-300 p-2 text-center">{index + 1}</td>
                <td className="border border-slate-300 p-2">{membro.nome}</td>
                <td className="border border-slate-300 p-2">
                  {membro.telefone ? formatPhoneNumber(membro.telefone) : ''}
                </td>
                {tipoListaImpressao === 'todos' && (
                  <td className="border border-slate-300 p-2">
                    {getStatusLabel(membro.status_membro)}
                    {!membro.ativo ? ` / ${tr('Inativo', 'Inactivo', 'Inactive')}` : ''}
                  </td>
                )}
                <td className="border border-slate-300 p-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <main id="membros-admin-screen" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />{' '}
              {tr('Pastorear Membros', 'Pastorear Miembros', 'Member Care')}
            </h1>
            <p className="text-slate-600 mt-1">
              {tr(
                'Acompanhamento e cuidado pastoral da igreja',
                'Seguimiento y cuidado pastoral de la iglesia',
                'Pastoral follow-up and care for the church'
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => imprimirLista('membros')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm shadow-sm"
            >
              <Printer className="w-4 h-4" />
              {tr('Imprimir membros', 'Imprimir miembros', 'Print members')}
            </button>
            <button
              onClick={() => imprimirLista('todos')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm shadow-sm"
            >
              <Printer className="w-4 h-4" />
              {tr('Imprimir todos', 'Imprimir todos', 'Print everyone')}
            </button>
            <button onClick={() => router.push('/admin/membros/novo')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold text-sm shadow-sm">
              <span className="text-lg leading-none">+</span>{' '}
              {tr('Adicionar', 'Agregar', 'Add')}
            </button>
            <button onClick={() => router.push('/admin')} className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors font-medium">
              ← {tr('Voltar', 'Volver', 'Back')}
            </button>
          </div>
        </div>

        {/* Mensagem */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg ${mensagem.includes('sucesso') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm">{mensagem}</span>
              <button
                onClick={() => setMensagem('')}
                className="text-current opacity-50 hover:opacity-100"
                aria-label={tr('Fechar mensagem', 'Cerrar mensaje', 'Close message')}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Aniversariantes de Hoje */}
        {aniversariantesHoje.length > 0 && (
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-300 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Cake className="w-8 h-8 text-pink-600" />
              <div>
                <h3 className="text-xl font-bold text-pink-900">
                  {tr(
                    'Aniversariantes de Hoje',
                    'Cumpleañeros de Hoy',
                    "Today's Birthdays"
                  )}
                </h3>
                <p className="text-sm text-pink-700">
                  {tr(
                    'Não esqueça de parabenizar',
                    'No olvides felicitar',
                    "Don't forget to congratulate them"
                  )}
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {aniversariantesHoje.map(membro => (
                <div key={membro.id}
                  className="bg-white rounded-lg p-4 border-2 border-pink-200 hover:border-pink-400 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/membros/${membro.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <MembroAvatar nome={membro.nome} fotoUrl={membro.foto_url} />
                      <div>
                        <p className="font-bold text-slate-900">{membro.nome}</p>
                        <p className="text-sm text-slate-600">
                          {calcularIdade(membro.data_nascimento)}{' '}
                          {tr('anos', 'años', 'years')}
                        </p>
                        {membro.profissao && <p className="text-xs text-slate-500">{membro.profissao}</p>}
                      </div>
                    </div>
                    <Cake className="w-6 h-6 text-pink-500 flex-shrink-0" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={e => { e.stopPropagation(); abrirWhatsApp(membro.telefone, membro.nome); }}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      WhatsApp
                    </button>
                    <button onClick={e => { e.stopPropagation(); ligarPara(membro.telefone); }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: tr('Total', 'Total', 'Total'), val: membros.length, cor: 'bg-white border-slate-200', text: 'text-slate-900', sub: 'text-slate-500', icone: <Users className="w-3.5 h-3.5" /> },
            { label: tr('Ativos', 'Activos', 'Active'), val: membros.filter(m => m.status_membro === 'ativo').length, cor: 'bg-green-50 border-green-200', text: 'text-green-900', sub: 'text-green-600', icone: <Church className="w-3.5 h-3.5" /> },
            { label: tr('Aniv. Hoje', 'Cumpl. Hoy', 'Birthdays Today'), val: aniversariantesHoje.length, cor: 'bg-pink-50 border-pink-200', text: 'text-pink-900', sub: 'text-pink-600', icone: <Cake className="w-3.5 h-3.5" /> },
            { label: tr('Este Mês', 'Este Mes', 'This Month'), val: membros.filter(m => ehAniversarioNesteMes(m.data_nascimento)).length, cor: 'bg-blue-50 border-blue-200', text: 'text-blue-900', sub: 'text-blue-600', icone: <Calendar className="w-3.5 h-3.5" /> },
            { label: tr('Batizados', 'Bautizados', 'Baptized'), val: membros.filter(m => m.batizado).length, cor: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-900', sub: 'text-indigo-600', icone: <Church className="w-3.5 h-3.5" /> },
            { label: tr('Grupos', 'Grupos', 'Groups'), val: gruposUnicos.length, cor: 'bg-amber-50 border-amber-200', text: 'text-amber-900', sub: 'text-amber-600', icone: <Home className="w-3.5 h-3.5" /> },
          ].map(stat => (
            <div key={stat.label} className={`rounded-lg border p-4 ${stat.cor}`}>
              <p className={`text-xs flex items-center gap-1 mb-1 ${stat.sub}`}>{stat.icone}{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.text}`}>{stat.val}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        {!visaoFamilia && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />{' '}
                {tr('Filtros', 'Filtros', 'Filters')}
              </h3>
              <button onClick={() => setFiltrosExpandidos(!filtrosExpandidos)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                {filtrosExpandidos
                  ? tr('Menos filtros ▲', 'Menos filtros ▲', 'Fewer filters ▲')
                  : tr('Mais filtros ▼', 'Más filtros ▼', 'More filters ▼')}
              </button>
            </div>
            <div className="space-y-3">
              {/* Busca geral — agora inclui bairro, profissão, grupo */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" placeholder={tr(
                  'Buscar por nome, email, telefone, bairro, profissão, grupo familiar...',
                  'Buscar por nombre, correo, teléfono, barrio, profesión o grupo familiar...',
                  'Search by name, email, phone, neighborhood, profession, or family group...'
                )}
                  value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as FiltroStatus)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="todos">{tr('Todos os Status', 'Todos los estados', 'All statuses')}</option>
                  <option value="ativo">{tr('Ativos', 'Activos', 'Active')}</option>
                  <option value="visitante">{tr('Visitantes', 'Visitantes', 'Visitors')}</option>
                  <option value="congregado">{tr('Congregados', 'Congregantes', 'Congregants')}</option>
                  <option value="afastado">{tr('Afastados', 'Alejados', 'Away')}</option>
                  <option value="falecido">{tr('Falecidos', 'Fallecidos', 'Deceased')}</option>
                </select>
                <select value={filtroAniversario} onChange={e => setFiltroAniversario(e.target.value as FiltroAniversario)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="todos">{tr('Todos os Aniversários', 'Todos los cumpleaños', 'All birthdays')}</option>
                  <option value="hoje">{tr('Hoje', 'Hoy', 'Today')}</option>
                  <option value="proximos7dias">{tr('Próximos 7 dias', 'Próximos 7 días', 'Next 7 days')}</option>
                  <option value="mes">{tr('Este mês', 'Este mes', 'This month')}</option>
                </select>
                <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100">
                  <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700 font-medium whitespace-nowrap">
                    {tr('Mostrar inativos', 'Mostrar inactivos', 'Show inactive')}
                  </span>
                </label>
              </div>
              {filtrosExpandidos && (
                <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                  <select value={filtroBatismo} onChange={e => setFiltroBatismo(e.target.value as FiltroBatismo)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="todos">{tr('Batismo: Todos', 'Bautismo: Todos', 'Baptism: All')}</option>
                    <option value="batizado">{tr('Batizados', 'Bautizados', 'Baptized')}</option>
                    <option value="nao_batizado">{tr('Não batizados', 'No bautizados', 'Not baptized')}</option>
                  </select>
                  <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="todos">{tr('Todos os grupos', 'Todos los grupos', 'All groups')}</option>
                    {gruposUnicos.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder={tr(
                      'Filtrar por profissão...',
                      'Filtrar por profesión...',
                      'Filter by profession...'
                    )} value={filtroProfissao}
                      onChange={e => setFiltroProfissao(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista / Famílias */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              {visaoFamilia
                ? tr('Famílias', 'Familias', 'Families')
                : tr('Membros', 'Miembros', 'Members')}
              {!visaoFamilia && (
                <span className="ml-2 text-sm font-normal bg-white/20 px-3 py-1 rounded-full">{membrosFiltrados.length}</span>
              )}
            </h3>
            <div className="flex items-center bg-white/20 rounded-lg p-1 gap-1">
              <button onClick={() => setVisaoFamilia(false)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${!visaoFamilia ? 'bg-white text-blue-700' : 'text-white hover:bg-white/10'}`}>{tr('Lista', 'Lista', 'List')}</button>
              <button onClick={() => setVisaoFamilia(true)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${visaoFamilia ? 'bg-white text-blue-700' : 'text-white hover:bg-white/10'}`}>
                <Users className="w-4 h-4" /> {tr('Famílias', 'Familias', 'Families')}
              </button>
            </div>
          </div>

          <div className="p-6">
            {visaoFamilia ? (
              <FamiliaView />
            ) : loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto" />
                <p className="mt-2 text-slate-600">
                  {tr('Carregando membros...', 'Cargando miembros...', 'Loading members...')}
                </p>
              </div>
            ) : membrosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                <p>{tr('Nenhum membro encontrado', 'No se encontraron miembros', 'No members found')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {membrosFiltrados.map(membro => {
                  const idade = calcularIdade(membro.data_nascimento);
                  const ehMembroCargo = membro.cargo === 'membro';
                  const temAlerta = membro.situacao_saude || membro.observacoes || ehAniversarioProximos7Dias(membro.data_nascimento);
                  const endereco = enderecoResumido(membro);
                  const faltando = camposIncompletos(membro);
                  const cadastroIncompleto = faltando.length > 0;

                  return (
                    <div key={membro.id}
                      onClick={() => router.push(`/admin/membros/${membro.id}`)}
                      className={`border-2 rounded-lg p-4 transition-all hover:shadow-md cursor-pointer ${
                        !membro.ativo ? 'opacity-60' :
                        ehAniversarioHoje(membro.data_nascimento) ? 'border-pink-300 bg-pink-50' :
                        cadastroIncompleto ? 'border-orange-300 bg-orange-50/50' :
                        temAlerta ? 'border-amber-300 bg-amber-50/30' :
                        'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Avatar */}
                          <MembroAvatar nome={membro.nome} fotoUrl={membro.foto_url} />

                          <div className="flex-1 min-w-0">
                            {/* Nome e badges */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <h4 className="text-lg font-bold text-slate-900">{membro.nome}</h4>
                              {membro.sexo && <span className="text-xs text-slate-500">{membro.sexo === 'M' ? '♂' : '♀'}</span>}
                              {ehAniversarioHoje(membro.data_nascimento) && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-800 border border-pink-300 flex items-center gap-1">
                                  <Cake className="w-3 h-3" /> {tr('Aniversário', 'Cumpleaños', 'Birthday')}
                                </span>
                              )}
                              {!ehMembroCargo && (
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getCargoCor(membro.cargo as CargoTipo)}`}>
                                  {getCargoLabelLocalized(membro.cargo as CargoTipo)}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusCor(membro.status_membro)}`}>
                                {getStatusLabel(membro.status_membro)}
                              </span>
                              {membro.batizado && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                                  {tr('Batizado', 'Bautizado', 'Baptized')}
                                </span>
                              )}
                              {cadastroIncompleto && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300 flex items-center gap-1"
                                  title={`${tr('Faltando:', 'Falta:', 'Missing:')} ${faltando.join(', ')}`}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  {tr('Cadastro incompleto', 'Registro incompleto', 'Incomplete data')}
                                </span>
                              )}
                            </div>

                            {/* Alertas */}
                            {temAlerta && (
                              <div className="mb-2 space-y-1.5">
                                {ehAniversarioProximos7Dias(membro.data_nascimento) && !ehAniversarioHoje(membro.data_nascimento) && (
                                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5">
                                    <Cake className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    <span className="text-xs text-blue-800">
                                      {tr('Aniversário próximo:', 'Próximo cumpleaños:', 'Upcoming birthday:')} {formatarData(membro.data_nascimento)}
                                    </span>
                                  </div>
                                )}
                                {membro.situacao_saude && (
                                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                                    <Heart className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-red-800 line-clamp-1"><strong>{tr('Saúde:', 'Salud:', 'Health:')}</strong> {membro.situacao_saude}</p>
                                  </div>
                                )}
                                {membro.observacoes && (
                                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-800 line-clamp-1"><strong>{tr('Obs:', 'Obs.:', 'Notes:')}</strong> {membro.observacoes}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Informações enriquecidas */}
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-sm text-slate-600">
                              {membro.data_nascimento && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span>{formatarData(membro.data_nascimento)} ({idade} {tr('anos', 'años', 'years')})</span>
                                </div>
                              )}
                              {membro.telefone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span>{formatPhoneNumber(membro.telefone)}</span>
                                </div>
                              )}
                              {membro.email && (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{membro.email}</span>
                                </div>
                              )}
                              {membro.profissao && (
                                <div className="flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span>{membro.profissao}</span>
                                </div>
                              )}
                              {membro.grupo_familiar_nome && (
                                <div className="flex items-center gap-1.5">
                                  <Home className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{tr('Grupo:', 'Grupo:', 'Group:')} {membro.grupo_familiar_nome}</span>
                                </div>
                              )}
                              {endereco && (
                                <div className="flex items-center gap-1.5 sm:col-span-2">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{endereco}</span>
                                </div>
                              )}
                            </div>

                            {/* Cursos de discipulado */}
                            {membro.cursos_discipulado && membro.cursos_discipulado.length > 0 && (
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                {membro.cursos_discipulado.map(c => (
                                  <span key={c} className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200">{c}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Cursos de discipulado */}
                          {membro.cursos_discipulado && membro.cursos_discipulado.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                              {membro.cursos_discipulado.map(c => (
                                <span key={c} className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200">{c}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <button onClick={e => { e.stopPropagation(); abrirWhatsApp(membro.telefone, membro.nome); }} disabled={!membro.telefone}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1.5 justify-center">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            WhatsApp
                          </button>
                          <button onClick={e => { e.stopPropagation(); ligarPara(membro.telefone); }} disabled={!membro.telefone}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium flex items-center gap-1.5 justify-center">
                            <Phone className="w-3.5 h-3.5" /> {tr('Ligar', 'Llamar', 'Call')}
                          </button>
                          <button onClick={e => { e.stopPropagation(); router.push(`/admin/membros/${membro.id}`); }}
                            className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-medium">
                            {tr('Detalhes', 'Detalles', 'Details')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
