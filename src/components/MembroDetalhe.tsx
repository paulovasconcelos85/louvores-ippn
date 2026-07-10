'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { CargoTipo, getCargoCor } from '@/lib/permissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';
import { resolvePessoaIdForCurrentUser } from '@/lib/client-current-person';
import { getStoredChurchId } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage, resolveApiSuccessMessage } from '@/lib/api-feedback';
import RelacionamentosCard from '@/components/RelacionamentosCard';
import EnderecoAutocomplete, { EnderecoGoogle } from '@/components/EnderecoAutocomplete';
import AssinaturaCanvas, { AssinaturaCanvasHandle } from '@/components/AssinaturaCanvas';
import { gerarFichaCandidatoPdf, NOME_PASTOR_PADRAO } from '@/lib/ficha-candidato-pdf';
import { getIntlLocale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import {
  ArrowLeft, Save, Phone, Mail, MapPin, Calendar, Heart,
  AlertCircle, MessageSquare, Plus, Edit2, Trash2, User,
  Cake, Church, Clock, Briefcase, GraduationCap, Home,
  Users, BookOpen, Globe, Flag, ChevronDown, ChevronUp, Camera, Send, Copy,
  ClipboardCheck, PenLine, Download,
} from 'lucide-react';
import { buildCompletarCadastroUrl, enviarConviteWhatsApp } from '@/lib/cadastro-link';

interface Membro {
  id: string;
  nome: string;
  apelido: string | null;
  cargo: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  data_casamento: string | null;
  data_batismo: string | null;
  situacao_saude: string | null;
  endereco_completo: string | null;
  status_membro: 'ativo' | 'afastado' | 'falecido' | 'visitante' | 'congregado';
  ativo: boolean;
  observacoes: string | null;
  foto_url: string | null;
  sexo: 'M' | 'F' | null;
  estado_civil: string | null;
  conjuge_nome: string | null;
  conjuge_religiao: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  naturalidade_cidade: string | null;
  naturalidade_uf: string | null;
  nacionalidade: string | null;
  escolaridade: string | null;
  profissao: string | null;
  logradouro: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  batizado: boolean | null;
  data_profissao_fe: string | null;
  transferido_ipb: boolean | null;
  transferido_outra_denominacao: string | null;
  cursos_discipulado: string[] | null;
  grupo_familiar_nome: string | null;
  grupo_familiar_lider: string | null;
  cadastro_token: string | null;
  is_teste: boolean;
  classificacao_membro: 'comungante' | 'nao_comungante' | 'aderente_comungante' | 'aderente_nao_comungante' | null;
  outras_pessoas_mesmo_telefone: string[] | null;
  // Ficha de Candidato à Membresia
  atividade_atual: string | null;
  pais_origem: string | null;
  uniao_estavel_tempo: string | null;
  igreja_sede_congregacao: 'sede' | 'congregacao_manaus' | 'congregacao_interior' | null;
  congregacao_nome: string | null;
  transferencia_ipb_origem: string | null;
  transferencia_jurisdicao_sem_carta: string | null;
  transferencia_observacao: string | null;
  proposito_entrevista: 'batismo_infantil' | 'profissao_fe' | 'profissao_fe_e_batismo' | null;
  assinatura_ficha: string | null;
  assinatura_ficha_em: string | null;
}

interface NotaPastoral {
  id: string;
  tipo: string;
  titulo: string | null;
  conteudo: string;
  privado: boolean;
  criado_em: string;
  atualizado_em: string;
  autor: { nome: string; cargo: string };
}

type TipoNota = 'nota' | 'visita' | 'ligacao' | 'oracao' | 'aconselhamento' | 'urgente';

interface IgrejaResumo {
  timezone: string | null;
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

// ─── Mini Mapa ────────────────────────────────────────────────────────────────
function MapaMembro({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const locale = useLocale();
  const tr = (pt: string, es: string, en: string) =>
    locale === 'es' ? es : locale === 'en' ? en : pt;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  if (!key) return (
    <a
      href={`https://maps.google.com/?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:underline mt-1 block"
    >
      {tr('Ver no Google Maps', 'Ver en Google Maps', 'View on Google Maps')} ↗
    </a>
  );
  const src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lng}&zoom=15`;
  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-500" /> {tr('Localização no Mapa', 'Ubicación en el Mapa', 'Map Location')}
        </span>
        <a
          href={`https://maps.google.com/?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline font-medium"
        >
          {tr('Abrir no Maps', 'Abrir en Maps', 'Open in Maps')} ↗
        </a>
      </div>
      <iframe
        title={tr(`Mapa - ${nome}`, `Mapa - ${nome}`, `Map - ${nome}`)}
        src={src}
        width="100%"
        height="220"
        style={{ border: 0, display: 'block' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

// ─── Seção Colapsável ────────────────────────────────────────────────────────
function SecaoColapsavel({
  titulo, icone, children, defaultAberta = true,
}: {
  titulo: string; icone: React.ReactNode; children: React.ReactNode; defaultAberta?: boolean;
}) {
  const [aberta, setAberta] = useState(defaultAberta);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setAberta(!aberta)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">{icone}{titulo}</h3>
        {aberta
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {aberta && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// ─── Campo de Info ────────────────────────────────────────────────────────────
function CampoInfo({
  icone, label, valor, span2 = false,
}: {
  icone: React.ReactNode; label: string; valor: React.ReactNode; span2?: boolean;
}) {
  if (!valor || valor === '-') return null;
  return (
    <div className={`flex items-start gap-3 ${span2 ? 'sm:col-span-2' : ''}`}>
      <span className="text-slate-400 mt-0.5">{icone}</span>
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm text-slate-900 font-medium">{valor}</p>
      </div>
    </div>
  );
}

const CURSOS_DISCIPULADO: Record<string, string> = {
  apostila_01: 'Apostila 01 — Conhecendo a Jesus',
  apostila_02: 'Apostila 02 — Conhecendo a Nova Vida',
  apostila_03: 'Apostila 03 — Conhecendo a Nossa Fé',
};

// ─── Assinatura digital da Ficha de Candidato à Membresia (no tablet) ──────────
function AssinaturaFichaOverlay({
  membro, assinanteNome, tr, onFechar, onSalvo,
}: {
  membro: Membro;
  assinanteNome: string;
  tr: (pt: string, es: string, en: string) => string;
  onFechar: () => void;
  onSalvo: (assinaturaFicha: string, assinaturaFichaEm: string) => void;
}) {
  const canvasRef = useRef<AssinaturaCanvasHandle | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const confirmar = async () => {
    const dataUrl = canvasRef.current?.paraDataUrl();
    if (!dataUrl) {
      setErro(tr('Desenhe a assinatura antes de confirmar.', 'Dibuje la firma antes de confirmar.', 'Draw the signature before confirming.'));
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const agora = new Date().toISOString();
      const params = new URLSearchParams();
      const igrejaId = getStoredChurchId();
      if (igrejaId) params.set('igreja_id', igrejaId);
      const response = await fetch(`/api/pessoas/${membro.id}?${params.toString()}`, {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ assinatura_ficha: dataUrl, assinatura_ficha_em: agora }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || tr('Erro ao salvar assinatura.', 'Error al guardar la firma.', 'Error saving signature.'));
      }
      onSalvo(dataUrl, agora);
    } catch (error) {
      setErro(error instanceof Error ? error.message : tr('Erro ao salvar assinatura.', 'Error al guardar la firma.', 'Error saving signature.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-y-auto p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900">
            {tr('Confirmação da Ficha de Candidato à Membresia', 'Confirmación de la Ficha de Candidato a Membresía', 'Membership Candidate Form Confirmation')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {tr('Ficha de', 'Ficha de', 'Form of')} {membro.nome} — {tr('confirmado e assinado por', 'confirmado y firmado por', 'confirmed and signed by')} {assinanteNome || tr('pastor/presbítero', 'pastor/presbítero', 'pastor/elder')}
          </p>
        </div>

        <div className="h-56 mb-3">
          <AssinaturaCanvas ref={canvasRef} className="w-full h-full touch-none bg-white rounded-xl border-2 border-dashed border-slate-300" />
        </div>

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => canvasRef.current?.limpar()}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            {tr('Limpar', 'Limpiar', 'Clear')}
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {salvando ? tr('Salvando...', 'Guardando...', 'Saving...') : tr('Confirmar assinatura', 'Confirmar firma', 'Confirm signature')}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            {tr('Cancelar', 'Cancelar', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MembroDetalheProps {
  membroId: string;
  /** Quando embutido (ex.: split view), evita o wrapper de tela cheia. */
  embutido?: boolean;
  /** Dados já conhecidos (ex.: cache da lista) para render imediato sem spinner. */
  membroInicial?: Partial<Membro> | null;
  /** Ação do botão "voltar". Padrão: navega para /admin/membros. */
  onVoltar?: () => void;
  /** Chamado após salvar alterações com sucesso (para a lista se atualizar). */
  onAtualizado?: () => void;
  /** Navega para outro membro (ex.: via relacionamentos). Padrão: router.push. */
  onNavegarMembro?: (id: string) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function MembroDetalhe({
  membroId,
  embutido = false,
  membroInicial = null,
  onVoltar,
  onAtualizado,
  onNavegarMembro,
}: MembroDetalheProps) {
  const router = useRouter();
  const voltar = onVoltar ?? (() => router.push('/admin/membros'));
  const navegarMembro = onNavegarMembro ?? ((id: string) => router.push(`/admin/membros/${id}`));
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { user } = useAuth();
  const { permissoes, usuarioPermitido } = usePermissions();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );

  const [membro, setMembro] = useState<Membro | null>(
    () => (membroInicial ? (membroInicial as Membro) : null)
  );
  const [notas, setNotas] = useState<NotaPastoral[]>([]);
  const [loading, setLoading] = useState(!membroInicial);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [fotoError, setFotoError] = useState(false);
  const [igrejaResumo, setIgrejaResumo] = useState<IgrejaResumo | null>(null);

  // ── Form states ──────────────────────────────────────────────────────────────
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataCasamento, setDataCasamento] = useState('');
  const [dataBatismo, setDataBatismo] = useState('');
  const [dataProfissaoFe, setDataProfissaoFe] = useState('');
  const [situacaoSaude, setSituacaoSaude] = useState('');
  const [statusMembro, setStatusMembro] = useState<string>('ativo');
  const [observacoes, setObservacoes] = useState('');
  const [sexo, setSexo] = useState<string>('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [conjugeReligiao, setConjugeReligiao] = useState('');
  const [nomePai, setNomePai] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [naturalidadeCidade, setNaturalidadeCidade] = useState('');
  const [naturalidadeUf, setNaturalidadeUf] = useState('');
  const [nacionalidade, setNacionalidade] = useState('Brasileira');
  const [escolaridade, setEscolaridade] = useState('');
  const [profissao, setProfissao] = useState('');

  // Endereço
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [enderecoCompletoEdit, setEnderecoCompletoEdit] = useState('');
  const [complemento, setComplemento] = useState('');

  // Vida eclesiástica
  const [batizado, setBatizado] = useState(false);
  const [classificacaoMembro, setClassificacaoMembro] = useState<string>('');
  const [isTeste, setIsTeste] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState(false);
  const [erroDelete, setErroDelete] = useState('');
  const [transferidoIpb, setTransferidoIpb] = useState(false);
  const [transferidoOutra, setTransferidoOutra] = useState('');
  const [cursosDiscipulado, setCursosDiscipulado] = useState<string[]>([]);
  const [grupoFamiliarNome, setGrupoFamiliarNome] = useState('');
  const [grupoFamiliarLider, setGrupoFamiliarLider] = useState('');

  // Ficha de Candidato à Membresia
  const [atividadeAtual, setAtividadeAtual] = useState('');
  const [paisOrigem, setPaisOrigem] = useState('');
  const [uniaoEstavelTempo, setUniaoEstavelTempo] = useState('');
  const [igrejaSedeCongregacao, setIgrejaSedeCongregacao] = useState('');
  const [congregacaoNome, setCongregacaoNome] = useState('');
  const [transferenciaIpbOrigem, setTransferenciaIpbOrigem] = useState('');
  const [transferenciaJurisdicaoSemCarta, setTransferenciaJurisdicaoSemCarta] = useState('');
  const [transferenciaObservacao, setTransferenciaObservacao] = useState('');
  const [propositoEntrevista, setPropositoEntrevista] = useState('');
  const [assinaturaAberta, setAssinaturaAberta] = useState(false);

  // ── Notas ────────────────────────────────────────────────────────────────────
  const [modalNotaAberto, setModalNotaAberto] = useState(false);
  const [tipoNota, setTipoNota] = useState<TipoNota>('nota');
  const [tituloNota, setTituloNota] = useState('');
  const [conteudoNota, setConteudoNota] = useState('');
  const [notaPrivada, setNotaPrivada] = useState(false);

  const podeAcessar = permissoes.podePastorearMembros;
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
  const getStatusLabel = (status: string) =>
    ({
      ativo: tr('Ativo', 'Activo', 'Active'),
      visitante: tr('Visitante', 'Visitante', 'Visitor'),
      congregado: tr('Congregado', 'Congregante', 'Congregant'),
      afastado: tr('Afastado', 'Alejado', 'Away'),
      falecido: tr('Falecido', 'Fallecido', 'Deceased'),
    }[status] || status);
  const getMaritalStatusLabel = (value: string | null) =>
    value
      ? ({
          solteiro: tr('Solteiro(a)', 'Soltero(a)', 'Single'),
          casado: tr('Casado(a)', 'Casado(a)', 'Married'),
          divorciado: tr('Divorciado(a)', 'Divorciado(a)', 'Divorced'),
          viuvo: tr('Viúvo(a)', 'Viudo(a)', 'Widowed'),
          uniao_estavel: tr('União Estável', 'Unión Estable', 'Civil Union'),
        }[value] || value)
      : null;
  const getEducationLabel = (value: string | null) =>
    value
      ? ({
          fundamental_incompleto: tr('Fund. Incompleto', 'Primaria Incompleta', 'Elementary Incomplete'),
          fundamental_completo: tr('Fund. Completo', 'Primaria Completa', 'Elementary Complete'),
          medio_incompleto: tr('Médio Incompleto', 'Secundaria Incompleta', 'High School Incomplete'),
          medio_completo: tr('Médio Completo', 'Secundaria Completa', 'High School Complete'),
          superior_incompleto: tr('Superior Incompleto', 'Universidad Incompleta', 'College Incomplete'),
          superior_completo: tr('Superior Completo', 'Universidad Completa', 'College Complete'),
          pos_graduacao: tr('Pós-Graduação', 'Posgrado', 'Postgraduate'),
          mestrado: tr('Mestrado', 'Maestría', "Master's"),
          doutorado: tr('Doutorado', 'Doctorado', 'Doctorate'),
        }[value] || value)
      : null;

  const carregarMembro = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const igrejaId = getStoredChurchId();
      if (igrejaId) params.set('igreja_id', igrejaId);

      const response = await fetch(`/api/pessoas/${membroId}?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(
            locale,
            payload,
            tr(
              'Erro ao carregar membro',
              'Error al cargar miembro',
              'Error loading member'
            )
          )
        );
      }

      const data = payload.data;
      setMembro(data);
      setIgrejaResumo(payload.igreja || null);
      setFotoError(false);
      setNome(data.nome);
      setApelido(data.apelido || '');
      setFotoUrl(data.foto_url || '');
      setTelefone(data.telefone ? formatPhoneNumber(data.telefone) : '');
      setDataNascimento(data.data_nascimento || '');
      setDataCasamento(data.data_casamento || '');
      setDataBatismo(data.data_batismo || '');
      setDataProfissaoFe(data.data_profissao_fe || '');
      setSituacaoSaude(data.situacao_saude || '');
      setStatusMembro(data.status_membro || 'ativo');
      setObservacoes(data.observacoes || '');
      setSexo(data.sexo || '');
      setEstadoCivil(data.estado_civil || '');
      setConjugeNome(data.conjuge_nome || '');
      setConjugeReligiao(data.conjuge_religiao || '');
      setNomePai(data.nome_pai || '');
      setNomeMae(data.nome_mae || '');
      setNaturalidadeCidade(data.naturalidade_cidade || '');
      setNaturalidadeUf(data.naturalidade_uf || '');
      setNacionalidade(data.nacionalidade || 'Brasileira');
      setEscolaridade(data.escolaridade || '');
      setProfissao(data.profissao || '');
      setLogradouro(data.logradouro || '');
      setBairro(data.bairro || '');
      setCep(data.cep || '');
      setCidade(data.cidade || '');
      setUf(data.uf || '');
      setLatitude(data.latitude ?? null);
      setLongitude(data.longitude ?? null);
      setGooglePlaceId(data.google_place_id ?? null);
      setEnderecoCompletoEdit(data.endereco_completo || '');
      setComplemento('');
      setBatizado(data.batizado ?? false);
      setClassificacaoMembro(data.classificacao_membro || '');
      setIsTeste(data.is_teste ?? false);
      setTransferidoIpb(data.transferido_ipb ?? false);
      setTransferidoOutra(data.transferido_outra_denominacao || '');
      setCursosDiscipulado(data.cursos_discipulado || []);
      setGrupoFamiliarNome(data.grupo_familiar_nome || '');
      setGrupoFamiliarLider(data.grupo_familiar_lider || '');
      setAtividadeAtual(data.atividade_atual || '');
      setPaisOrigem(data.pais_origem || '');
      setUniaoEstavelTempo(data.uniao_estavel_tempo || '');
      setIgrejaSedeCongregacao(data.igreja_sede_congregacao || '');
      setCongregacaoNome(data.congregacao_nome || '');
      setTransferenciaIpbOrigem(data.transferencia_ipb_origem || '');
      setTransferenciaJurisdicaoSemCarta(data.transferencia_jurisdicao_sem_carta || '');
      setTransferenciaObservacao(data.transferencia_observacao || '');
      setPropositoEntrevista(data.proposito_entrevista || '');
    } catch (error) {
      console.error('Erro ao carregar membro:', error);
      setMensagem(
        tr(
          'Erro ao carregar dados do membro',
          'Error al cargar los datos del miembro',
          'Error loading member data'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [membroId, tr, locale]);

  const carregarNotas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notas_pastorais')
        .select('*, autor:autor_id (nome, cargo)')
        .eq('membro_id', membroId)
        .order('criado_em', { ascending: false });
      if (error) return;
      setNotas(
        (data || []).map((nota: any) => ({
          id: nota.id,
          tipo: nota.tipo,
          titulo: nota.titulo,
          conteudo: nota.conteudo,
          privado: nota.privado,
          criado_em: nota.criado_em,
          atualizado_em: nota.atualizado_em,
          autor: {
            nome: nota.autor?.nome || tr('Desconhecido', 'Desconocido', 'Unknown'),
            cargo: nota.autor?.cargo || 'membro',
          },
        }))
      );
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    }
  }, [membroId, tr]);

  useEffect(() => {
    if (user && podeAcessar && membroId) {
      carregarMembro();
      carregarNotas();
    }
  }, [carregarMembro, carregarNotas, membroId, podeAcessar, user]);

  const salvarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');
    try {
      const cursosArray = cursosDiscipulado;
      const response = await fetch(`/api/pessoas/${membroId}`, {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          nome: nome.trim(),
          apelido: apelido.trim() || null,
          foto_url: fotoUrl.trim() || null,
          telefone: telefone ? unformatPhoneNumber(telefone) : null,
          data_nascimento: dataNascimento || null,
          data_casamento: dataCasamento || null,
          data_batismo: dataBatismo || null,
          data_profissao_fe: dataProfissaoFe || null,
          situacao_saude: situacaoSaude.trim() || null,
          status_membro: statusMembro,
          observacoes: observacoes.trim() || null,
          sexo: sexo || null,
          estado_civil: estadoCivil || null,
          conjuge_nome: conjugeNome.trim() || null,
          conjuge_religiao: conjugeReligiao.trim() || null,
          nome_pai: nomePai.trim() || null,
          nome_mae: nomeMae.trim() || null,
          naturalidade_cidade: naturalidadeCidade.trim() || null,
          naturalidade_uf: naturalidadeUf || null,
          nacionalidade: nacionalidade.trim() || null,
          escolaridade: escolaridade || null,
          profissao: profissao.trim() || null,
          logradouro: logradouro.trim() || null,
          bairro: bairro.trim() || null,
          cep: cep.replace(/\D/g, '') || null,
          cidade: cidade.trim() || null,
          uf: uf || null,
          latitude,
          longitude,
          google_place_id: googlePlaceId,
          endereco_completo: enderecoCompletoEdit || null,
          batizado,
          classificacao_membro: classificacaoMembro || null,
          transferido_ipb: transferidoIpb,
          transferido_outra_denominacao: transferidoOutra.trim() || null,
          cursos_discipulado: cursosArray.length > 0 ? cursosArray : null,
          grupo_familiar_nome: grupoFamiliarNome.trim() || null,
          grupo_familiar_lider: grupoFamiliarLider.trim() || null,
          is_teste: isTeste,
          atividade_atual: atividadeAtual.trim() || null,
          pais_origem: paisOrigem.trim() || null,
          uniao_estavel_tempo: uniaoEstavelTempo.trim() || null,
          igreja_sede_congregacao: igrejaSedeCongregacao || null,
          congregacao_nome: congregacaoNome.trim() || null,
          transferencia_ipb_origem: transferenciaIpbOrigem.trim() || null,
          transferencia_jurisdicao_sem_carta: transferenciaJurisdicaoSemCarta.trim() || null,
          transferencia_observacao: transferenciaObservacao.trim() || null,
          proposito_entrevista: propositoEntrevista || null,
          igreja_id: getStoredChurchId(),
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(
            locale,
            payload,
            tr(
              'Erro ao salvar alterações',
              'Error al guardar cambios',
              'Error saving changes'
            )
          )
        );
      }
      setMensagem(
        resolveApiSuccessMessage(
          locale,
          payload,
          tr(
            'Alterações salvas com sucesso!',
            '¡Cambios guardados con éxito!',
            'Changes saved successfully!'
          )
        )
      );
      setModoEdicao(false);
      carregarMembro();
      onAtualizado?.();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setMensagem(error.message || tr(
        'Erro ao salvar alterações',
        'Error al guardar cambios',
        'Error saving changes'
      ));
    } finally {
      setSalvando(false);
    }
  };

  const deletarMembro = async () => {
    try {
      const igrejaId = getStoredChurchId();
      const response = await fetch(
        `/api/pessoas/${membroId}?igreja_id=${igrejaId}`,
        { method: 'DELETE', headers: await buildAuthenticatedHeaders() }
      );
      const payload = await response.json();

      if (!response.ok) {
        const msgErro = resolveApiErrorMessage(locale, payload, tr('Erro ao excluir', 'Error al eliminar', 'Error deleting'));
        setConfirmandoDelete(false);
        setErroDelete(msgErro);
        return;
      }

      // A API pode apenas desvincular da igreja sem excluir o cadastro
      if (payload.messageCode === 'PERSON_REMOVED_FROM_CHURCH') {
        setConfirmandoDelete(false);
        setErroDelete(tr(
          'Este cadastro existe em mais de uma igreja — foi apenas desvinculado desta congregação, não excluído do sistema.',
          'Este registro existe en más de una iglesia — solo se desvinculó de esta congregación.',
          'This record exists in more than one church — it was only unlinked from this congregation, not deleted.'
        ));
        onAtualizado?.();
        return;
      }

      onAtualizado?.();
      router.back();
    } catch (error: any) {
      setConfirmandoDelete(false);
      setErroDelete(error.message || tr('Erro ao excluir membro', 'Error al eliminar', 'Error deleting member'));
    }
  };

  const adicionarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conteudoNota.trim()) return;
    try {
      const autorId = await resolvePessoaIdForCurrentUser(user);

      const { error } = await supabase.from('notas_pastorais').insert({
        membro_id: membroId,
        autor_id: autorId || null,
        tipo: tipoNota,
        titulo: tituloNota.trim() || null,
        conteudo: conteudoNota.trim(),
        privado: notaPrivada,
      });
      if (error) throw error;
      setMensagem(
        tr(
          'Nota adicionada com sucesso!',
          '¡Nota agregada con éxito!',
          'Note added successfully!'
        )
      );
      setModalNotaAberto(false);
      setTituloNota('');
      setConteudoNota('');
      setTipoNota('nota');
      setNotaPrivada(false);
      carregarNotas();
    } catch {
      setMensagem(
        tr(
          'Erro ao adicionar nota',
          'Error al agregar nota',
          'Error adding note'
        )
      );
    }
  };

  const deletarNota = async (notaId: string) => {
    if (
      !confirm(
        tr(
          'Tem certeza que deseja excluir esta nota?',
          '¿Seguro que deseas eliminar esta nota?',
          'Are you sure you want to delete this note?'
        )
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase
        .from('notas_pastorais')
        .delete()
        .eq('id', notaId);
      if (error) throw error;
      setMensagem(
        tr(
          'Nota excluída com sucesso',
          'Nota eliminada con éxito',
          'Note deleted successfully'
        )
      );
      carregarNotas();
    } catch {
      setMensagem(
        tr(
          'Erro ao excluir nota',
          'Error al eliminar nota',
          'Error deleting note'
        )
      );
    }
  };

  const churchTimezone = igrejaResumo?.timezone || DEFAULT_TIMEZONE;

  const calcularIdade = (dataNasc: string | null) => {
    const nasc = parseDateOnly(dataNasc);
    if (!nasc) return null;
    const hoje = getTodayInTimeZone(churchTimezone);
    let idade = hoje.year - nasc.year;
    const mes = hoje.month - nasc.month;
    if (mes < 0 || (mes === 0 && hoje.day < nasc.day)) idade--;
    return idade;
  };

  const formatarData = (data: string | null) =>
    (() => {
      const parsed = parseDateOnly(data);
      return parsed
        ? new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString(intlLocale)
        : '-';
    })();

  const formatarDataHora = (data: string) =>
    new Date(data).toLocaleString(intlLocale, {
      timeZone: churchTimezone,
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getTipoNotaLabel = (tipo: string) =>
    ({
      nota: tr('Nota', 'Nota', 'Note'),
      visita: tr('Visita', 'Visita', 'Visit'),
      ligacao: tr('Ligação', 'Llamada', 'Call'),
      oracao: tr('Oração', 'Oración', 'Prayer'),
      aconselhamento: tr('Aconselhamento', 'Consejería', 'Counseling'),
      urgente: tr('Urgente', 'Urgente', 'Urgent'),
    }[tipo] || tipo);

  const getTipoNotaCor = (tipo: string) =>
    ({
      nota: 'bg-slate-100 text-slate-800',
      visita: 'bg-blue-100 text-blue-800',
      ligacao: 'bg-green-100 text-green-800',
      oracao: 'bg-purple-100 text-purple-800',
      aconselhamento: 'bg-yellow-100 text-yellow-800',
      urgente: 'bg-red-100 text-red-800',
    }[tipo] || 'bg-slate-100 text-slate-800');

  const abrirWhatsApp = () => {
    if (!membro?.telefone) {
      setMensagem(
        tr(
          'Membro não possui telefone cadastrado',
          'El miembro no tiene teléfono registrado',
          'Member has no phone number on file'
        )
      );
      return;
    }
    const num = membro.telefone.replace(/\D/g, '');
    const msg = tr(
      `Olá ${membro.nome}! Que a paz do Senhor esteja contigo!`,
      `Hola ${membro.nome}. Que la paz del Senor esté contigo.`,
      `Hello ${membro.nome}. May the Lord's peace be with you.`
    );
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const ligarPara = () => {
    if (!membro?.telefone) {
      setMensagem(
        tr(
          'Membro não possui telefone cadastrado',
          'El miembro no tiene teléfono registrado',
          'Member has no phone number on file'
        )
      );
      return;
    }
    window.location.href = `tel:${membro.telefone}`;
  };

  const pedirCadastro = () => {
    if (!membro?.cadastro_token) {
      setMensagem(tr('Link indisponível para este cadastro.', 'Enlace no disponible.', 'Link unavailable.'));
      return;
    }
    enviarConviteWhatsApp(membro.nome, membro.telefone, membro.cadastro_token);
  };

  const copiarLinkCadastro = async () => {
    if (!membro?.cadastro_token) {
      setMensagem(tr('Link indisponível para este cadastro.', 'Enlace no disponible.', 'Link unavailable.'));
      return;
    }
    try {
      await navigator.clipboard.writeText(buildCompletarCadastroUrl(membro.cadastro_token));
      setMensagem(tr('Link de cadastro copiado com sucesso!', '¡Enlace copiado con éxito!', 'Registration link copied successfully!'));
    } catch {
      setMensagem(tr('Não foi possível copiar o link.', 'No se pudo copiar el enlace.', 'Could not copy the link.'));
    }
  };

  const inputCls = 'w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  if (loading && !membro) {
    return (
      <div className={`${embutido ? 'min-h-[60vh]' : 'min-h-screen bg-slate-50'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto" />
          <p className="mt-4 text-slate-600">
            {tr('Carregando dados...', 'Cargando datos...', 'Loading data...')}
          </p>
        </div>
      </div>
    );
  }

  if (!membro) {
    return (
      <div className={`${embutido ? 'min-h-[60vh]' : 'min-h-screen bg-slate-50'} flex items-center justify-center`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-bold text-slate-900 mb-2">
            {tr('Membro não encontrado', 'Miembro no encontrado', 'Member not found')}
          </p>
          <button
            onClick={voltar}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {tr('Voltar para lista', 'Volver a la lista', 'Back to list')}
          </button>
        </div>
      </div>
    );
  }

  const idade = calcularIdade(membro.data_nascimento);
  const enderecoVisual = [membro.logradouro, membro.bairro, membro.cidade, membro.uf]
    .filter(Boolean)
    .join(', ');

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className={embutido ? '' : 'min-h-screen bg-slate-50'}>
      <main className={embutido ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={voltar} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div className="flex items-center gap-4">
              <div className="relative">
                {membro.foto_url && !fotoError ? (
                  <img
                    src={membro.foto_url}
                    alt={membro.nome}
                    onError={() => setFotoError(true)}
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center shadow-sm">
                    <User className="w-8 h-8 text-blue-400" />
                  </div>
                )}
                {modoEdicao && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  {membro.nome}
                  {membro.apelido && (
                    <span className="ml-2 text-xl font-medium text-slate-400">"{membro.apelido}"</span>
                  )}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                  {membro.sexo && (
                    <span>
                      {membro.sexo === 'M'
                        ? `♂ ${tr('Masculino', 'Masculino', 'Male')}`
                        : `♀ ${tr('Feminino', 'Femenino', 'Female')}`}
                    </span>
                  )}
                  {membro.profissao && <><span>·</span><span>{membro.profissao}</span></>}
                  {idade && <><span>·</span><span>{idade} {tr('anos', 'años', 'years')}</span></>}
                </div>
              </div>
            </div>
          </div>
          {!modoEdicao && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={() => setAssinaturaAberta(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                <PenLine className="w-4 h-4" />
                {membro.assinatura_ficha
                  ? tr('Reassinar ficha', 'Volver a firmar', 'Re-sign form')
                  : tr('Assinar no tablet', 'Firmar en tablet', 'Sign on tablet')}
              </button>
              <button
                onClick={() => gerarFichaCandidatoPdf(membro, { tr, intlLocale, assinanteNome: NOME_PASTOR_PADRAO })}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
              >
                <Download className="w-4 h-4" /> {tr('Baixar Ficha (PDF)', 'Descargar Ficha (PDF)', 'Download Form (PDF)')}
              </button>
              <button
                onClick={() => setModoEdicao(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Edit2 className="w-4 h-4" /> {tr('Editar', 'Editar', 'Edit')}
              </button>
            </div>
          )}
        </div>

        {membro.assinatura_ficha_em && (
          <p className="text-xs text-slate-400 -mt-4 mb-6 text-right">
            {tr('Ficha assinada em', 'Ficha firmada el', 'Form signed on')}{' '}
            {new Date(membro.assinatura_ficha_em).toLocaleString(intlLocale)}
          </p>
        )}

        {assinaturaAberta && (
          <AssinaturaFichaOverlay
            membro={membro}
            assinanteNome={NOME_PASTOR_PADRAO}
            tr={tr}
            onFechar={() => setAssinaturaAberta(false)}
            onSalvo={(assinaturaFicha, assinaturaFichaEm) => {
              setMembro(prev => (prev ? { ...prev, assinatura_ficha: assinaturaFicha, assinatura_ficha_em: assinaturaFichaEm } : prev));
              setAssinaturaAberta(false);
            }}
          />
        )}

        {/* Mensagem */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg ${mensagem.includes('sucesso') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm">{mensagem}</span>
              <button onClick={() => setMensagem('')} className="text-current opacity-50 hover:opacity-100">✕</button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Coluna Principal ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Ações Rápidas */}
            {!modoEdicao && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">
                  {tr('Ações Rápidas', 'Acciones Rápidas', 'Quick Actions')}
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <button
                    onClick={abrirWhatsApp}
                    disabled={!membro.telefone}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    onClick={ligarPara}
                    disabled={!membro.telefone}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Phone className="w-5 h-5" /> {tr('Ligar', 'Llamar', 'Call')}
                  </button>
                  <button
                    onClick={() => setModalNotaAberto(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" /> {tr('Nova Nota', 'Nueva Nota', 'New Note')}
                  </button>
                </div>

                {/* Link para o próprio membro completar o cadastro */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">
                    {tr(
                      'Peça que o próprio membro complete o cadastro (e o dos filhos):',
                      'Pide que el propio miembro complete el registro (y el de los hijos):',
                      'Ask the member to complete their own data (and their children):'
                    )}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      onClick={pedirCadastro}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
                    >
                      <Send className="w-4 h-4" /> {tr('Pedir cadastro (WhatsApp)', 'Pedir registro (WhatsApp)', 'Request data (WhatsApp)')}
                    </button>
                    <button
                      onClick={copiarLinkCadastro}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                    >
                      <Copy className="w-4 h-4" /> {tr('Copiar link', 'Copiar enlace', 'Copy link')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ MODO EDIÇÃO ══ */}
            {modoEdicao ? (
              <form onSubmit={salvarAlteracoes} className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>ℹ️ {tr('Nota:', 'Nota:', 'Note:')}</strong>{' '}
                    {tr(
                      'Para editar email, cargo ou habilidades, use a página /admin/usuarios',
                      'Para editar correo, cargo o habilidades, usa la página /admin/usuarios',
                      'To edit email, role, or skills, use the /admin/usuarios page'
                    )}
                  </p>
                </div>

                {/* Dados Básicos */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> {tr('Dados Básicos', 'Datos Básicos', 'Basic Information')}
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> {tr('URL da Foto', 'URL de la Foto', 'Photo URL')}
                    </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <input
                          type="url"
                          value={fotoUrl}
                          onChange={(e) => { setFotoUrl(e.target.value); setFotoError(false); }}
                          placeholder="https://example.com/photo.jpg"
                          className={inputCls}
                        />
                      </div>
                      {fotoUrl && !fotoError ? (
                        <img
                          src={fotoUrl}
                          alt=""
                          onError={() => setFotoError(true)}
                          className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Nome Completo', 'Nombre Completo', 'Full Name')} *</label>
                      <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Apelido', 'Apodo', 'Nickname')}</label>
                      <input type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder={tr('Como é conhecido(a)...', 'Cómo se le conoce...', 'Known as...')} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Telefone', 'Teléfono', 'Phone')}</label>
                      <input type="tel" value={telefone} onChange={(e) => setTelefone(formatPhoneNumber(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Sexo', 'Sexo', 'Sex')}</label>
                      <select value={sexo} onChange={(e) => setSexo(e.target.value)} className={inputCls}>
                        <option value="">{tr('Não informado', 'No informado', 'Not informed')}</option>
                        <option value="M">{tr('Masculino', 'Masculino', 'Male')}</option>
                        <option value="F">{tr('Feminino', 'Femenino', 'Female')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Status do Membro', 'Estado del Miembro', 'Member Status')}</label>
                      <select value={statusMembro} onChange={(e) => setStatusMembro(e.target.value)} className={inputCls}>
                        <option value="ativo">{tr('Ativo', 'Activo', 'Active')}</option>
                        <option value="visitante">{tr('Visitante', 'Visitante', 'Visitor')}</option>
                        <option value="congregado">{tr('Congregado', 'Congregante', 'Congregant')}</option>
                        <option value="afastado">{tr('Afastado', 'Alejado', 'Away')}</option>
                        <option value="falecido">{tr('Falecido', 'Fallecido', 'Deceased')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Data de Nascimento', 'Fecha de Nacimiento', 'Birth Date')}</label>
                      <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Estado Civil', 'Estado Civil', 'Marital Status')}</label>
                      <select value={estadoCivil} onChange={(e) => setEstadoCivil(e.target.value)} className={inputCls}>
                        <option value="">{tr('Não informado', 'No informado', 'Not informed')}</option>
                        <option value="solteiro">{tr('Solteiro(a)', 'Soltero(a)', 'Single')}</option>
                        <option value="casado">{tr('Casado(a)', 'Casado(a)', 'Married')}</option>
                        <option value="divorciado">{tr('Divorciado(a)', 'Divorciado(a)', 'Divorced')}</option>
                        <option value="viuvo">{tr('Viúvo(a)', 'Viudo(a)', 'Widowed')}</option>
                        <option value="uniao_estavel">{tr('União Estável', 'Unión Estable', 'Civil Union')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Data de Casamento', 'Fecha de Matrimonio', 'Marriage Date')}</label>
                      <input type="date" value={dataCasamento} onChange={(e) => setDataCasamento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Nome do Cônjuge', 'Nombre del Cónyuge', "Spouse's Name")}</label>
                      <input type="text" value={conjugeNome} onChange={(e) => setConjugeNome(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Religião do Cônjuge', 'Religión del Cónyuge', "Spouse's Religion")}</label>
                      <input type="text" value={conjugeReligiao} onChange={(e) => setConjugeReligiao(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Nome do Pai', 'Nombre del Padre', "Father's Name")}</label>
                      <input type="text" value={nomePai} onChange={(e) => setNomePai(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Nome da Mãe', 'Nombre de la Madre', "Mother's Name")}</label>
                      <input type="text" value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Naturalidade (Cidade)', 'Origen (Ciudad)', 'Origin (City)')}</label>
                      <input type="text" value={naturalidadeCidade} onChange={(e) => setNaturalidadeCidade(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('UF Naturalidade', 'Estado de Origen', 'Origin State')}</label>
                      <input type="text" maxLength={2} value={naturalidadeUf} onChange={(e) => setNaturalidadeUf(e.target.value.toUpperCase())} className={inputCls} placeholder="AM" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Nacionalidade', 'Nacionalidad', 'Nationality')}</label>
                      <input type="text" value={nacionalidade} onChange={(e) => setNacionalidade(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('País de Origem (se estrangeiro)', 'País de Origen (si extranjero)', 'Country of Origin (if foreign)')}</label>
                      <input type="text" value={paisOrigem} onChange={(e) => setPaisOrigem(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Tempo de União Estável', 'Tiempo de Unión Estable', 'Civil Union Duration')}</label>
                      <input type="text" value={uniaoEstavelTempo} onChange={(e) => setUniaoEstavelTempo(e.target.value)} className={inputCls} placeholder={tr('Ex.: 3 anos', 'Ej.: 3 años', 'E.g.: 3 years')} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Profissão', 'Profesión', 'Profession')}</label>
                      <input type="text" value={profissao} onChange={(e) => setProfissao(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Atividade Atual', 'Actividad Actual', 'Current Activity')}</label>
                      <input type="text" value={atividadeAtual} onChange={(e) => setAtividadeAtual(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Escolaridade', 'Escolaridad', 'Education')}</label>
                      <select value={escolaridade} onChange={(e) => setEscolaridade(e.target.value)} className={inputCls}>
                        <option value="">{tr('Não informada', 'No informada', 'Not informed')}</option>
                        <option value="fundamental_incompleto">{tr('Fund. Incompleto', 'Primaria Incompleta', 'Elementary Incomplete')}</option>
                        <option value="fundamental_completo">{tr('Fund. Completo', 'Primaria Completa', 'Elementary Complete')}</option>
                        <option value="medio_incompleto">{tr('Médio Incompleto', 'Secundaria Incompleta', 'High School Incomplete')}</option>
                        <option value="medio_completo">{tr('Médio Completo', 'Secundaria Completa', 'High School Complete')}</option>
                        <option value="superior_incompleto">{tr('Superior Incompleto', 'Universidad Incompleta', 'College Incomplete')}</option>
                        <option value="superior_completo">{tr('Superior Completo', 'Universidad Completa', 'College Complete')}</option>
                        <option value="pos_graduacao">{tr('Pós-Graduação', 'Posgrado', 'Postgraduate')}</option>
                        <option value="mestrado">{tr('Mestrado', 'Maestría', "Master's")}</option>
                        <option value="doutorado">{tr('Doutorado', 'Doctorado', 'Doctorate')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {tr('Endereço', 'Dirección', 'Address')}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {tr('Buscar endereço', 'Buscar dirección', 'Search address')}
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                      {tr(
                        'Pesquise e selecione na lista para atualizar o endereço automaticamente.',
                        'Busca y selecciona en la lista para actualizar la dirección automáticamente.',
                        'Search and select from the list to update the address automatically.'
                      )}
                    </p>
                    <EnderecoAutocomplete
                      initialValue={enderecoCompletoEdit}
                      onSelect={(e: EnderecoGoogle) => {
                        setLogradouro(e.logradouro);
                        setBairro(e.bairro);
                        setCep(e.cep);
                        setCidade(e.cidade);
                        setUf(e.uf);
                        setLatitude(e.latitude);
                        setLongitude(e.longitude);
                        setGooglePlaceId(e.google_place_id);
                        setEnderecoCompletoEdit(e.endereco_completo);
                      }}
                    />
                  </div>

                  {/* Endereço atual */}
                  {(logradouro || bairro) && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                      <p className="text-xs text-slate-500 mb-1">
                        {tr('Endereço atual', 'Dirección actual', 'Current address')}
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        {logradouro}{bairro && `, ${bairro}`}
                        {cep && ` — ${tr('CEP', 'CP', 'ZIP')} ${cep}`}
                      </p>
                      <p className="text-sm text-slate-600">{cidade}{uf && ` / ${uf}`}</p>
                    </div>
                  )}

                  {/* Complemento — só aparece quando há endereço selecionado */}
                  {(logradouro || bairro) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {tr('Complemento', 'Complemento', 'Additional info')}
                      </label>
                      <input
                        type="text"
                        value={complemento}
                        onChange={(e) => {
                          setComplemento(e.target.value);
                          const base = logradouro + (bairro ? `, ${bairro}` : '');
                          setEnderecoCompletoEdit(e.target.value ? `${base}, ${e.target.value}` : base);
                        }}
                        placeholder={tr('Apto, bloco, casa, referência...', 'Depto, bloque, casa, referencia...', 'Apt, block, house, reference...')}
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>

                {/* Vida Eclesiástica */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3 flex items-center gap-2">
                    <Church className="w-4 h-4" /> {tr('Vida Eclesiástica', 'Vida Eclesiástica', 'Church Life')}
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Classificação eclesiástica', 'Clasificación eclesiástica', 'Church classification')}</label>
                    <select value={classificacaoMembro} onChange={(e) => setClassificacaoMembro(e.target.value)} className={inputCls}>
                      <option value="">{tr('— não definida —', '— no definida —', '— not set —')}</option>
                      <option value="comungante">{tr('Comungante', 'Comulgante', 'Communicant')}</option>
                      <option value="nao_comungante">{tr('Não comungante', 'No comulgante', 'Non-communicant')}</option>
                      <option value="aderente_comungante">{tr('Aderente comungante', 'Adherente comulgante', 'Adherent communicant')}</option>
                      <option value="aderente_nao_comungante">{tr('Aderente não comungante', 'Adherente no comulgante', 'Adherent non-communicant')}</option>
                    </select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Data de Batismo', 'Fecha de Bautismo', 'Baptism Date')}</label>
                      <input type="date" value={dataBatismo} onChange={(e) => setDataBatismo(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Data de Profissão de Fé', 'Fecha de Profesión de Fe', 'Profession of Faith Date')}</label>
                      <input type="date" value={dataProfissaoFe} onChange={(e) => setDataProfissaoFe(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Grupo Familiar', 'Grupo Familiar', 'Family Group')}</label>
                      <input type="text" value={grupoFamiliarNome} onChange={(e) => setGrupoFamiliarNome(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Líder do Grupo Familiar', 'Líder del Grupo Familiar', 'Family Group Leader')}</label>
                      <input type="text" value={grupoFamiliarLider} onChange={(e) => setGrupoFamiliarLider(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Cursos de Discipulado', 'Cursos de Discipulado', 'Discipleship Courses')}</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(CURSOS_DISCIPULADO).map(([id, label]) => {
                        const marcado = cursosDiscipulado.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setCursosDiscipulado(prev => marcado ? prev.filter(c => c !== id) : [...prev, id])}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              marcado
                                ? 'bg-purple-100 border-purple-400 text-purple-800'
                                : 'bg-white border-slate-300 text-slate-600 hover:border-purple-300'
                            }`}
                          >
                            {marcado && (
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={batizado} onChange={(e) => setBatizado(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      <span className="text-sm text-slate-700 font-medium">{tr('Batizado', 'Bautizado', 'Baptized')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={transferidoIpb} onChange={(e) => setTransferidoIpb(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      <span className="text-sm text-slate-700 font-medium">{tr('Transferido IPB', 'Transferido IPB', 'Transferred from IPB')}</span>
                    </label>
                  </div>
                  {transferidoIpb && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Qual igreja IPB?', '¿Cuál iglesia IPB?', 'Which IPB church?')}</label>
                      <input type="text" value={transferenciaIpbOrigem} onChange={(e) => setTransferenciaIpbOrigem(e.target.value)} className={inputCls} />
                    </div>
                  )}
                  {!transferidoIpb && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Transferido de outra denominação', 'Transferido de otra denominación', 'Transferred from another denomination')}</label>
                        <input type="text" value={transferidoOutra} onChange={(e) => setTransferidoOutra(e.target.value)} className={inputCls} placeholder={tr('Nome da denominação anterior', 'Nombre de la denominación anterior', 'Previous denomination name')} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Transferência por jurisdição (sem carta)', 'Transferencia por jurisdicción (sin carta)', 'Transfer by jurisdiction (no letter)')}</label>
                        <input type="text" value={transferenciaJurisdicaoSemCarta} onChange={(e) => setTransferenciaJurisdicaoSemCarta(e.target.value)} className={inputCls} placeholder={tr('Nome da denominação', 'Nombre de la denominación', 'Denomination name')} />
                      </div>
                    </div>
                  )}
                  {(transferidoIpb || transferidoOutra || transferenciaJurisdicaoSemCarta) && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Observação da transferência', 'Observación de la transferencia', 'Transfer note')}</label>
                      <input type="text" value={transferenciaObservacao} onChange={(e) => setTransferenciaObservacao(e.target.value)} className={inputCls} />
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Igreja Sede / Congregação', 'Iglesia Sede / Congregación', 'Main Church / Congregation')}</label>
                      <select value={igrejaSedeCongregacao} onChange={(e) => setIgrejaSedeCongregacao(e.target.value)} className={inputCls}>
                        <option value="">{tr('— não definida —', '— no definida —', '— not set —')}</option>
                        <option value="sede">{tr('Igreja Sede (Central ou Pedras Vivas)', 'Iglesia Sede (Central o Pedras Vivas)', 'Main Church (Central or Pedras Vivas)')}</option>
                        <option value="congregacao_manaus">{tr('Congregação em Manaus', 'Congregación en Manaus', 'Congregation in Manaus')}</option>
                        <option value="congregacao_interior">{tr('Congregação no Interior', 'Congregación en el interior', 'Congregation in the countryside')}</option>
                      </select>
                    </div>
                    {igrejaSedeCongregacao && igrejaSedeCongregacao !== 'sede' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Qual congregação?', '¿Cuál congregación?', 'Which congregation?')}</label>
                        <input type="text" value={congregacaoNome} onChange={(e) => setCongregacaoNome(e.target.value)} className={inputCls} />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Propósito da entrevista', 'Propósito de la entrevista', 'Purpose of the interview')}</label>
                    <select value={propositoEntrevista} onChange={(e) => setPropositoEntrevista(e.target.value)} className={inputCls}>
                      <option value="">{tr('— não definido —', '— no definido —', '— not set —')}</option>
                      <option value="batismo_infantil">{tr('Batismo Infantil', 'Bautismo Infantil', 'Infant Baptism')}</option>
                      <option value="profissao_fe">{tr('Profissão de Fé', 'Profesión de Fe', 'Profession of Faith')}</option>
                      <option value="profissao_fe_e_batismo">{tr('Profissão de Fé e Batismo', 'Profesión de Fe y Bautismo', 'Profession of Faith and Baptism')}</option>
                    </select>
                  </div>
                </div>

                {/* Saúde e Observações */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3">{tr('Saúde & Observações', 'Salud y Observaciones', 'Health & Notes')}</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Situação de Saúde', 'Situación de Salud', 'Health Status')}</label>
                    <textarea value={situacaoSaude} onChange={(e) => setSituacaoSaude(e.target.value)} rows={3} className={inputCls} placeholder={tr('Informações relevantes sobre saúde...', 'Información relevante sobre salud...', 'Relevant health information...')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{tr('Observações Gerais', 'Observaciones Generales', 'General Notes')}</label>
                    <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} className={inputCls} placeholder={tr('Informações importantes sobre o membro...', 'Información importante sobre el miembro...', 'Important information about the member...')} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {salvando ? tr('Salvando...', 'Guardando...', 'Saving...') : tr('Salvar Alterações', 'Guardar Cambios', 'Save Changes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModoEdicao(false); carregarMembro(); }}
                    className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    {tr('Cancelar', 'Cancelar', 'Cancel')}
                  </button>
                </div>
              </form>

            ) : (
              /* ══ MODO VISUALIZAÇÃO ══ */
              <>
                <SecaoColapsavel titulo={tr('Dados Pessoais', 'Datos Personales', 'Personal Data')} icone={<User className="w-5 h-5 text-slate-600" />}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <CampoInfo icone={<Mail className="w-5 h-5" />} label="Email" valor={membro.email} />
                    <div>
                      <CampoInfo icone={<Phone className="w-5 h-5" />} label={tr('Telefone', 'Teléfono', 'Phone')} valor={membro.telefone ? formatPhoneNumber(membro.telefone) : null} />
                      {membro.outras_pessoas_mesmo_telefone && membro.outras_pessoas_mesmo_telefone.length > 0 && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>
                            {tr(
                              'Este telefone também está cadastrado para: ',
                              'Este teléfono también está registrado para: ',
                              'This phone is also registered to: '
                            )}
                            <span className="font-medium">{membro.outras_pessoas_mesmo_telefone.join(', ')}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    <CampoInfo icone={<User className="w-5 h-5" />} label={tr('Sexo', 'Sexo', 'Sex')} valor={membro.sexo === 'M' ? tr('Masculino', 'Masculino', 'Male') : membro.sexo === 'F' ? tr('Feminino', 'Femenino', 'Female') : null} />
                    <CampoInfo icone={<Cake className="w-5 h-5" />} label={tr('Nascimento', 'Nacimiento', 'Birth')} valor={membro.data_nascimento ? `${formatarData(membro.data_nascimento)} (${idade} ${tr('anos', 'años', 'years')})` : null} />
                    <CampoInfo
                      icone={<Heart className="w-5 h-5" />}
                      label={tr('Estado Civil', 'Estado Civil', 'Marital Status')}
                      valor={getMaritalStatusLabel(membro.estado_civil)}
                    />
                    <CampoInfo icone={<Heart className="w-5 h-5" />} label={tr('Casamento', 'Matrimonio', 'Marriage')} valor={formatarData(membro.data_casamento)} />
                    <CampoInfo icone={<Users className="w-5 h-5" />} label={tr('Cônjuge', 'Cónyuge', 'Spouse')} valor={membro.conjuge_nome} />
                    <CampoInfo icone={<Globe className="w-5 h-5" />} label={tr('Religião do Cônjuge', 'Religión del Cónyuge', "Spouse's Religion")} valor={membro.conjuge_religiao} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label={tr('Pai', 'Padre', 'Father')} valor={membro.nome_pai} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label={tr('Mãe', 'Madre', 'Mother')} valor={membro.nome_mae} />
                    <CampoInfo icone={<Flag className="w-5 h-5" />} label={tr('Naturalidade', 'Origen', 'Origin')} valor={[membro.naturalidade_cidade, membro.naturalidade_uf].filter(Boolean).join(' - ') || null} />
                    <CampoInfo icone={<Globe className="w-5 h-5" />} label={tr('Nacionalidade', 'Nacionalidad', 'Nationality')} valor={membro.pais_origem ? `${membro.nacionalidade} (${membro.pais_origem})` : membro.nacionalidade} />
                    <CampoInfo icone={<Briefcase className="w-5 h-5" />} label={tr('Profissão', 'Profesión', 'Profession')} valor={membro.profissao} />
                    <CampoInfo icone={<Briefcase className="w-5 h-5" />} label={tr('Atividade Atual', 'Actividad Actual', 'Current Activity')} valor={membro.atividade_atual} />
                    <CampoInfo
                      icone={<GraduationCap className="w-5 h-5" />}
                      label={tr('Escolaridade', 'Escolaridad', 'Education')}
                      valor={getEducationLabel(membro.escolaridade)}
                    />
                    {membro.estado_civil === 'uniao_estavel' && (
                      <CampoInfo icone={<Heart className="w-5 h-5" />} label={tr('Tempo de União Estável', 'Tiempo de Unión Estable', 'Civil Union Duration')} valor={membro.uniao_estavel_tempo} />
                    )}
                  </div>

                  {/* Endereço + Mapa */}
                  {enderecoVisual && (
                    <div className="mt-4 flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 mb-0.5">{tr('Endereço', 'Dirección', 'Address')}</p>
                        <p className="text-sm text-slate-900 font-medium">
                          {membro.logradouro}{membro.bairro && `, ${membro.bairro}`}
                          {membro.cep && ` — ${tr('CEP', 'CP', 'ZIP')} ${membro.cep}`}<br />
                          {membro.cidade}{membro.uf && ` / ${membro.uf}`}
                        </p>
                        {membro.latitude && membro.longitude && (
                          <MapaMembro
                            lat={membro.latitude}
                            lng={membro.longitude}
                            nome={membro.nome}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </SecaoColapsavel>

                <SecaoColapsavel titulo={tr('Vida Eclesiástica', 'Vida Eclesiástica', 'Church Life')} icone={<Church className="w-5 h-5 text-slate-600" />}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <CampoInfo icone={<Church className="w-5 h-5" />} label={tr('Batismo', 'Bautismo', 'Baptism')} valor={formatarData(membro.data_batismo)} />
                    <CampoInfo icone={<Calendar className="w-5 h-5" />} label={tr('Profissão de Fé', 'Profesión de Fe', 'Profession of Faith')} valor={formatarData(membro.data_profissao_fe)} />
                    <CampoInfo icone={<Users className="w-5 h-5" />} label={tr('Grupo Familiar', 'Grupo Familiar', 'Family Group')} valor={membro.grupo_familiar_nome} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label={tr('Líder do Grupo', 'Líder del Grupo', 'Group Leader')} valor={membro.grupo_familiar_lider} />
                    <CampoInfo
                      icone={<Church className="w-5 h-5" />}
                      label={tr('Igreja Sede / Congregação', 'Iglesia Sede / Congregación', 'Main Church / Congregation')}
                      valor={
                        membro.igreja_sede_congregacao === 'sede'
                          ? tr('Igreja Sede (Central ou Pedras Vivas)', 'Iglesia Sede (Central o Pedras Vivas)', 'Main Church (Central or Pedras Vivas)')
                          : membro.congregacao_nome
                      }
                    />
                    <CampoInfo
                      icone={<ClipboardCheck className="w-5 h-5" />}
                      label={tr('Propósito da Entrevista', 'Propósito de la Entrevista', 'Interview Purpose')}
                      valor={
                        ({
                          batismo_infantil: tr('Batismo Infantil', 'Bautismo Infantil', 'Infant Baptism'),
                          profissao_fe: tr('Profissão de Fé', 'Profesión de Fe', 'Profession of Faith'),
                          profissao_fe_e_batismo: tr('Profissão de Fé e Batismo', 'Profesión de Fe y Bautismo', 'Profession of Faith and Baptism'),
                        } as Record<string, string>)[membro.proposito_entrevista || ''] || null
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {membro.classificacao_membro && (() => {
                      const map: Record<string, { label: string; cls: string }> = {
                        comungante: { label: tr('Comungante', 'Comulgante', 'Communicant'), cls: 'bg-purple-100 text-purple-800 border-purple-300' },
                        nao_comungante: { label: tr('Não comungante', 'No comulgante', 'Non-communicant'), cls: 'bg-sky-100 text-sky-800 border-sky-300' },
                        aderente_comungante: { label: tr('Aderente comungante', 'Adherente comulgante', 'Adherent communicant'), cls: 'bg-teal-100 text-teal-800 border-teal-300' },
                        aderente_nao_comungante: { label: tr('Aderente não comungante', 'Adherente no comulgante', 'Adherent non-communicant'), cls: 'bg-slate-100 text-slate-700 border-slate-300' },
                      };
                      const c = map[membro.classificacao_membro];
                      return c ? <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${c.cls}`}>{c.label}</span> : null;
                    })()}
                    {membro.batizado && <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300">✓ {tr('Batizado', 'Bautizado', 'Baptized')}</span>}
                    {membro.transferido_ipb && (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold border border-green-300">
                        ✓ {tr('Transferido IPB', 'Transferido IPB', 'Transferred from IPB')}{membro.transferencia_ipb_origem ? `: ${membro.transferencia_ipb_origem}` : ''}
                      </span>
                    )}
                    {membro.transferido_outra_denominacao && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-300">
                        {tr('Transferido de:', 'Transferido de:', 'Transferred from:')} {membro.transferido_outra_denominacao}
                      </span>
                    )}
                    {membro.transferencia_jurisdicao_sem_carta && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-300">
                        {tr('Transferência por jurisdição:', 'Transferencia por jurisdicción:', 'Transfer by jurisdiction:')} {membro.transferencia_jurisdicao_sem_carta}
                      </span>
                    )}
                  </div>
                  {membro.transferencia_observacao && (
                    <p className="mt-2 text-xs text-slate-500">
                      {tr('Obs. da transferência:', 'Obs. de la transferencia:', 'Transfer note:')} {membro.transferencia_observacao}
                    </p>
                  )}
                  {membro.cursos_discipulado && membro.cursos_discipulado.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                        <BookOpen className="w-4 h-4" /> {tr('Cursos de Discipulado', 'Cursos de Discipulado', 'Discipleship Courses')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {membro.cursos_discipulado.map((curso) => (
                          <span key={curso} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-800 text-xs font-medium border border-purple-200">
                            <svg className="w-3 h-3 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            {CURSOS_DISCIPULADO[curso.toLowerCase()] ?? curso}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </SecaoColapsavel>

                {(membro.situacao_saude || membro.observacoes) && (
                  <SecaoColapsavel titulo={tr('Saúde & Observações', 'Salud y Observaciones', 'Health & Notes')} icone={<AlertCircle className="w-5 h-5 text-slate-600" />}>
                    {membro.situacao_saude && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <Heart className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-900 mb-1">{tr('Situação de Saúde', 'Situación de Salud', 'Health Status')}</p>
                            <p className="text-sm text-red-800">{membro.situacao_saude}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {membro.observacoes && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-amber-900 mb-1">{tr('Observações', 'Observaciones', 'Notes')}</p>
                            <p className="text-sm text-amber-800 whitespace-pre-line">{membro.observacoes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </SecaoColapsavel>
                )}
              </>
            )}

            {/* Timeline de Notas */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-600" /> {tr('Histórico de Acompanhamento', 'Historial de Seguimiento', 'Follow-up History')}
                </h3>
                <button
                  onClick={() => setModalNotaAberto(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> {tr('Nova Nota', 'Nueva Nota', 'New Note')}
                </button>
              </div>
              {notas.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">{tr('Nenhuma nota de acompanhamento ainda', 'Todavía no hay notas de seguimiento', 'No follow-up notes yet')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notas.map((nota) => (
                    <div key={nota.id} className="border-l-4 border-purple-400 pl-4 py-2">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getTipoNotaCor(nota.tipo)}`}>{getTipoNotaLabel(nota.tipo)}</span>
                          {nota.privado && <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">{tr('Privado', 'Privado', 'Private')}</span>}
                          {nota.titulo && <span className="text-sm font-semibold text-slate-900">{nota.titulo}</span>}
                        </div>
                        {(permissoes.isSuperAdmin || ['admin', 'pastor'].includes(usuarioPermitido?.cargo || '')) && (
                          <button onClick={() => deletarNota(nota.id)} className="p-1 hover:bg-red-50 rounded text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-line mb-2">{nota.conteudo}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{nota.autor.nome}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatarDataHora(nota.criado_em)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">{tr('Status', 'Estado', 'Status')}</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">{tr('Tipo', 'Tipo', 'Type')}</p>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${getCargoCor(membro.cargo as CargoTipo)}`}>{getCargoLabelLocalized(membro.cargo as CargoTipo)}</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{tr('Situação', 'Situación', 'Status')}</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                    membro.status_membro === 'ativo' ? 'bg-green-100 text-green-800 border-green-300' :
                    membro.status_membro === 'visitante' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                    membro.status_membro === 'congregado' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                    membro.status_membro === 'afastado' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    'bg-gray-100 text-gray-800 border-gray-300'
                  }`}>
                    {getStatusLabel(membro.status_membro)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{tr('Cadastro', 'Registro', 'Record')}</p>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${membro.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {membro.ativo ? tr('Ativo', 'Activo', 'Active') : tr('Inativo', 'Inactivo', 'Inactive')}
                  </span>
                </div>
              </div>
            </div>

            {(membro.grupo_familiar_nome || membro.grupo_familiar_lider) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Home className="w-5 h-5 text-slate-600" /> {tr('Grupo Familiar', 'Grupo Familiar', 'Family Group')}
                </h3>
                {membro.grupo_familiar_nome && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-500">{tr('Nome do Grupo', 'Nombre del Grupo', 'Group Name')}</p>
                    <p className="text-sm font-semibold text-slate-900">{membro.grupo_familiar_nome}</p>
                  </div>
                )}
                {membro.grupo_familiar_lider && (
                  <div>
                    <p className="text-xs text-slate-500">{tr('Líder', 'Líder', 'Leader')}</p>
                    <p className="text-sm font-semibold text-slate-900">{membro.grupo_familiar_lider}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">{tr('Estatísticas', 'Estadísticas', 'Statistics')}</h3>
              <div className="space-y-3">
                {[
                  { label: tr('Total de Notas', 'Total de Notas', 'Total Notes'), val: notas.length, cor: 'text-slate-900' },
                  { label: tr('Visitas', 'Visitas', 'Visits'), val: notas.filter((n) => n.tipo === 'visita').length, cor: 'text-blue-600' },
                  { label: tr('Ligações', 'Llamadas', 'Calls'), val: notas.filter((n) => n.tipo === 'ligacao').length, cor: 'text-green-600' },
                  { label: tr('Urgentes', 'Urgentes', 'Urgent'), val: notas.filter((n) => n.tipo === 'urgente').length, cor: 'text-red-600' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{stat.label}</span>
                    <span className={`text-lg font-bold ${stat.cor}`}>{stat.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {permissoes.isSuperAdmin && (
              <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 space-y-4">
                <h3 className="font-semibold text-red-800 text-sm uppercase tracking-wide">
                  {tr('Zona do Superadmin', 'Zona del Superadmin', 'Superadmin Zone')}
                </h3>

                {/* Toggle is_teste */}
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-sm text-red-700 font-medium">
                    {tr('Cadastro de teste', 'Registro de prueba', 'Test record')}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const novoValor = !isTeste;
                      setIsTeste(novoValor);
                      try {
                        await fetch(`/api/pessoas/${membroId}`, {
                          method: 'PATCH',
                          headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
                          body: JSON.stringify({ is_teste: novoValor, igreja_id: getStoredChurchId() }),
                        });
                        onAtualizado?.();
                      } catch {
                        setIsTeste(!novoValor);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isTeste ? 'bg-red-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isTeste ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
                {isTeste && (
                  <p className="text-xs text-red-600">
                    {tr('Não contabiliza em totais e relatórios.', 'No se contabiliza en totales.', 'Not counted in totals.')}
                  </p>
                )}

                {/* Botão deletar */}
                {!confirmandoDelete ? (
                  <button
                    type="button"
                    onClick={() => { setErroDelete(''); setConfirmandoDelete(true); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {tr('Excluir cadastro', 'Eliminar registro', 'Delete record')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-700 font-medium text-center">
                      {tr('Confirmar exclusão de', 'Confirmar eliminación de', 'Confirm deletion of')}{' '}
                      <strong>{membro.nome}</strong>?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={deletarMembro}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        {tr('Sim, excluir', 'Sí, eliminar', 'Yes, delete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmandoDelete(false); setErroDelete(''); }}
                        className="flex-1 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        {tr('Cancelar', 'Cancelar', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
                {erroDelete && (
                  <p className="text-xs text-red-700 bg-red-100 border border-red-300 rounded-lg px-3 py-2">
                    ⚠️ {erroDelete}
                  </p>
                )}
              </div>
            )}

            <RelacionamentosCard
              membroId={membroId}
              membroNome={membro.nome}
              membroSexo={membro.sexo}
              autorId={usuarioPermitido?.id}
              podeEditar={permissoes.isSuperAdmin || ['admin', 'pastor', 'presbitero'].includes(usuarioPermitido?.cargo || '')}
              onNavegar={navegarMembro}
            />
          </div>
        </div>
      </main>

      {/* Modal Nova Nota */}
      {modalNotaAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{tr('Nova Nota de Acompanhamento', 'Nueva Nota de Seguimiento', 'New Follow-up Note')}</h3>
              <button
                onClick={() => { setModalNotaAberto(false); setTituloNota(''); setConteudoNota(''); setTipoNota('nota'); setNotaPrivada(false); }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <span className="text-slate-500">✕</span>
              </button>
            </div>
            <form onSubmit={adicionarNota} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Tipo de Nota', 'Tipo de Nota', 'Note Type')} *</label>
                  <select
                    value={tipoNota}
                    onChange={(e) => setTipoNota(e.target.value as TipoNota)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="nota">{tr('Nota Geral', 'Nota General', 'General Note')}</option>
                    <option value="visita">{tr('Visita Domiciliar', 'Visita Domiciliaria', 'Home Visit')}</option>
                    <option value="ligacao">{tr('Ligação Telefônica', 'Llamada Telefónica', 'Phone Call')}</option>
                    <option value="oracao">{tr('Pedido de Oração', 'Pedido de Oración', 'Prayer Request')}</option>
                    <option value="aconselhamento">{tr('Aconselhamento', 'Consejería', 'Counseling')}</option>
                    <option value="urgente">{tr('Urgente', 'Urgente', 'Urgent')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Título (opcional)', 'Título (opcional)', 'Title (optional)')}</label>
                  <input
                    type="text"
                    value={tituloNota}
                    onChange={(e) => setTituloNota(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder={tr('Ex: Visita de acompanhamento', 'Ej.: Visita de seguimiento', 'Ex: Follow-up visit')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{tr('Conteúdo da Nota', 'Contenido de la Nota', 'Note Content')} *</label>
                <textarea
                  value={conteudoNota}
                  onChange={(e) => setConteudoNota(e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder={tr('Descreva o acompanhamento, observações, pedidos de oração...', 'Describe el seguimiento, observaciones y pedidos de oración...', 'Describe the follow-up, notes, and prayer requests...')}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notaPrivada}
                  onChange={(e) => setNotaPrivada(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">{tr('Nota privada (apenas pastor e liderança)', 'Nota privada (solo pastor y liderazgo)', 'Private note (pastor and leadership only)')}</span>
              </label>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button type="submit" className="flex-1 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-all font-medium">
                  {tr('Salvar Nota', 'Guardar Nota', 'Save Note')}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalNotaAberto(false); setTituloNota(''); setConteudoNota(''); setTipoNota('nota'); setNotaPrivada(false); }}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  {tr('Cancelar', 'Cancelar', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
