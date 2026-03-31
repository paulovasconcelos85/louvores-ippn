'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { getStoredChurchId } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar,
  Heart, Church, AlertCircle, Check, ChevronRight,
  Camera, BookOpen, Home, Briefcase, GraduationCap,
  Globe, Flag, Users
} from 'lucide-react';

type CargoTipo = 'membro' | 'presbitero' | 'diacono' | 'pastor' | 'seminarista' | 'admin';
type StatusMembro = 'ativo' | 'afastado' | 'falecido' | 'visitante' | 'congregado';

interface Secao {
  id: string;
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  cor: string;
}

const SECOES: Secao[] = [
  {
    id: 'identificacao',
    titulo: 'Identificação',
    descricao: 'Nome, cargo e situação',
    icone: <User className="w-5 h-5" />,
    cor: 'blue',
  },
  {
    id: 'contato',
    titulo: 'Contato',
    descricao: 'Telefone, email e endereço',
    icone: <Phone className="w-5 h-5" />,
    cor: 'green',
  },
  {
    id: 'familia',
    titulo: 'Família',
    descricao: 'Filiação, cônjuge e origem',
    icone: <Users className="w-5 h-5" />,
    cor: 'orange',
  },
  {
    id: 'datas',
    titulo: 'Datas',
    descricao: 'Nascimento, casamento e batismo',
    icone: <Calendar className="w-5 h-5" />,
    cor: 'purple',
  },
  {
    id: 'eclesiastica',
    titulo: 'Eclesiástica',
    descricao: 'Vida na igreja e discipulado',
    icone: <Church className="w-5 h-5" />,
    cor: 'indigo',
  },
  {
    id: 'pastoral',
    titulo: 'Pastoral',
    descricao: 'Saúde e observações',
    icone: <Heart className="w-5 h-5" />,
    cor: 'rose',
  },
];

const COR_MAP: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-600 border-blue-200',
  green:  'bg-green-100 text-green-600 border-green-200',
  orange: 'bg-orange-100 text-orange-600 border-orange-200',
  purple: 'bg-purple-100 text-purple-600 border-purple-200',
  indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
  rose:   'bg-rose-100 text-rose-600 border-rose-200',
};

const COR_BG: Record<string, string> = {
  blue:   'bg-blue-600',
  green:  'bg-green-600',
  orange: 'bg-orange-500',
  purple: 'bg-purple-600',
  indigo: 'bg-indigo-600',
  rose:   'bg-rose-600',
};

export default function NovoMembroPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { permissoes, usuarioPermitido } = usePermissions();

  const [secaoAtiva, setSecaoAtiva] = useState('identificacao');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // ── Identificação ──
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState<CargoTipo>('membro');
  const [statusMembro, setStatusMembro] = useState<StatusMembro>('ativo');
  const [sexo, setSexo] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // ── Contato ──
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  // ── Família ──
  const [nomePai, setNomePai] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [conjugeReligiao, setConjugeReligiao] = useState('');
  const [naturalidadeCidade, setNaturalidadeCidade] = useState('');
  const [naturalidadeUf, setNaturalidadeUf] = useState('');
  const [nacionalidade, setNacionalidade] = useState('Brasileira');
  const [profissao, setProfissao] = useState('');
  const [escolaridade, setEscolaridade] = useState('');

  // ── Datas ──
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataCasamento, setDataCasamento] = useState('');
  const [dataBatismo, setDataBatismo] = useState('');
  const [dataProfissaoFe, setDataProfissaoFe] = useState('');

  // ── Eclesiástica ──
  const [batizado, setBatizado] = useState(false);
  const [transferidoIpb, setTransferidoIpb] = useState(false);
  const [transferidoOutra, setTransferidoOutra] = useState('');
  const [cursosDiscipulado, setCursosDiscipulado] = useState('');
  const [grupoFamiliarNome, setGrupoFamiliarNome] = useState('');
  const [grupoFamiliarLider, setGrupoFamiliarLider] = useState('');

  // ── Pastoral ──
  const [situacaoSaude, setSituacaoSaude] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const podeAcessar = permissoes.isSuperAdmin ||
    ['admin', 'pastor', 'presbitero'].includes(usuarioPermitido?.cargo || '');

  const ORDEM_SECOES = SECOES.map(s => s.id);

  const avancar = () => {
    const idx = ORDEM_SECOES.indexOf(secaoAtiva);
    if (idx < ORDEM_SECOES.length - 1) setSecaoAtiva(ORDEM_SECOES[idx + 1]);
  };

  const voltar = () => {
    const idx = ORDEM_SECOES.indexOf(secaoAtiva);
    if (idx > 0) setSecaoAtiva(ORDEM_SECOES[idx - 1]);
  };

  const secaoCompleta = (id: string): boolean => {
    if (id === 'identificacao') return nome.trim().length > 0;
    if (id === 'contato') return !!(telefone || email);
    if (id === 'familia') return !!(nomePai || nomeMae || estadoCivil);
    if (id === 'datas') return !!(dataNascimento || dataBatismo);
    if (id === 'eclesiastica') return batizado || !!grupoFamiliarNome || !!cursosDiscipulado;
    return false;
  };

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('O nome é obrigatório.');
      setSecaoAtiva('identificacao');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const cursosArray = cursosDiscipulado
        .split(',').map(c => c.trim()).filter(Boolean);

      const response = await fetch('/api/pessoas', {
        method: 'POST',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
        nome: nome.trim(),
        cargo,
        status_membro: statusMembro,
        sexo: sexo || null,
        foto_url: fotoUrl.trim() || null,
        telefone: telefone ? unformatPhoneNumber(telefone) : null,
        email: email.trim() || null,
        logradouro: logradouro.trim() || null,
        bairro: bairro.trim() || null,
        cep: cep.replace(/\D/g, '') || null,
        cidade: cidade.trim() || null,
        uf: uf || null,
        nome_pai: nomePai.trim() || null,
        nome_mae: nomeMae.trim() || null,
        estado_civil: estadoCivil || null,
        conjuge_nome: conjugeNome.trim() || null,
        conjuge_religiao: conjugeReligiao.trim() || null,
        naturalidade_cidade: naturalidadeCidade.trim() || null,
        naturalidade_uf: naturalidadeUf || null,
        nacionalidade: nacionalidade.trim() || 'Brasileira',
        profissao: profissao.trim() || null,
        escolaridade: escolaridade || null,
        data_nascimento: dataNascimento || null,
        data_casamento: dataCasamento || null,
        data_batismo: dataBatismo || null,
        data_profissao_fe: dataProfissaoFe || null,
        batizado,
        transferido_ipb: transferidoIpb,
        transferido_outra_denominacao: transferidoOutra.trim() || null,
        cursos_discipulado: cursosArray.length > 0 ? cursosArray : null,
        grupo_familiar_nome: grupoFamiliarNome.trim() || null,
        grupo_familiar_lider: grupoFamiliarLider.trim() || null,
        situacao_saude: situacaoSaude.trim() || null,
        observacoes: observacoes.trim() || null,
        ativo: true,
        criado_por: user?.id ?? null,
        igreja_id: getStoredChurchId(),
        })
      });

      const payload = await response.json();
      if (!response.ok) throw Object.assign(new Error(payload.error || 'Erro ao salvar'), payload);
      setSucesso(true);
      setTimeout(() => router.push('/admin/membros'), 1500);
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') setErro('Já existe um membro com este email.');
      else setErro('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // ── Helpers de estilo ──
  const inputCls = (cor: string) =>
    `w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-${cor}-500 transition-colors text-slate-900 placeholder:text-slate-400`;

  const selectCls = (cor: string) =>
    `w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-${cor}-500 transition-colors text-slate-900 bg-white`;

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Membro cadastrado!</h2>
          <p className="text-slate-500">Redirecionando...</p>
        </div>
      </div>
    );
  }

  const secaoAtual = SECOES.find(s => s.id === secaoAtiva)!;
  const idxAtual = ORDEM_SECOES.indexOf(secaoAtiva);
  const isUltima = idxAtual === SECOES.length - 1;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin/membros')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Novo Membro</h1>
              <p className="text-xs text-slate-500">Igreja Presbiteriana Ponta Negra</p>
            </div>
          </div>
          <button
            onClick={salvar}
            disabled={salvando || !nome.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm shadow-sm"
          >
            {salvando
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <Check className="w-4 h-4" />}
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1">
            {SECOES.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i <= idxAtual ? COR_BG[s.cor] : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Etapa {idxAtual + 1} de {SECOES.length}: <span className="font-medium text-slate-600">{secaoAtual.titulo}</span>
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Erro */}
        {erro && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{erro}</p>
          </div>
        )}

        {/* Navegação por seções */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SECOES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSecaoAtiva(s.id)}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                secaoAtiva === s.id
                  ? `border-current ${COR_MAP[s.cor]} shadow-sm`
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {secaoCompleta(s.id) && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div className={secaoAtiva === s.id ? '' : 'text-slate-400'}>{s.icone}</div>
              <span className={`text-xs font-semibold leading-tight text-center ${secaoAtiva === s.id ? '' : 'text-slate-500'}`}>
                {s.titulo}
              </span>
            </button>
          ))}
        </div>

        {/* ─── SEÇÃO: Identificação ─── */}
        {secaoAtiva === 'identificacao' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Identificação</h2>
                <p className="text-blue-100 text-xs">Nome, cargo, sexo e foto</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Foto */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> URL da Foto
                </label>
                <input
                  type="url"
                  value={fotoUrl}
                  onChange={e => setFotoUrl(e.target.value)}
                  placeholder="https://exemplo.com/foto.jpg"
                  className={inputCls('blue')}
                />
                {fotoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={fotoUrl}
                      alt="Pré-visualização"
                      className="w-14 h-14 rounded-full object-cover border-2 border-blue-200"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                    <span className="text-xs text-slate-500">Pré-visualização da foto</span>
                  </div>
                )}
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: João da Silva Pereira"
                  autoFocus
                  className={inputCls('blue')}
                />
              </div>

              {/* Sexo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Sexo</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: '', label: 'Não informado' }, { value: 'M', label: '♂ Masculino' }, { value: 'F', label: '♀ Feminino' }].map(op => (
                    <button key={op.value} type="button" onClick={() => setSexo(op.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${sexo === op.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Cargo / Função</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    { value: 'membro', label: 'Membro' },
                    { value: 'congregado', label: 'Congregado' },
                    { value: 'diacono', label: 'Diácono' },
                    { value: 'presbitero', label: 'Presbítero' },
                    { value: 'seminarista', label: 'Seminarista' },
                    { value: 'pastor', label: 'Pastor' },
                  ] as { value: CargoTipo; label: string }[]).map(op => (
                    <button key={op.value} type="button" onClick={() => setCargo(op.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${cargo === op.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Situação</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    { value: 'ativo', label: '🟢 Ativo' },
                    { value: 'visitante', label: '🔵 Visitante' },
                    { value: 'congregado', label: '🟣 Congregado' },
                    { value: 'afastado', label: '🟡 Afastado' },
                    { value: 'falecido', label: '⚫ Falecido' },
                  ] as { value: StatusMembro; label: string }[]).map(op => (
                    <button key={op.value} type="button" onClick={() => setStatusMembro(op.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${statusMembro === op.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={avancar} disabled={!nome.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Próximo: Contato <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Contato ─── */}
        {secaoAtiva === 'contato' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-green-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Contato & Endereço</h2>
                <p className="text-green-100 text-xs">Telefone, email e endereço completo</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="tel" value={telefone} onChange={e => setTelefone(formatPhoneNumber(e.target.value))}
                      placeholder="(92) 99999-9999"
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-green-500 transition-colors text-slate-900 placeholder:text-slate-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="joao@email.com"
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-green-500 transition-colors text-slate-900 placeholder:text-slate-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Endereço
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Logradouro (Rua, Av., número...)</label>
                    <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)}
                      placeholder="Av. das Flores, 123"
                      className={inputCls('green')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Bairro</label>
                    <input type="text" value={bairro} onChange={e => setBairro(e.target.value)}
                      className={inputCls('green')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">CEP</label>
                    <input type="text" value={cep} onChange={e => setCep(e.target.value)}
                      maxLength={9} placeholder="00000-000"
                      className={inputCls('green')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cidade</label>
                    <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
                      className={inputCls('green')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">UF</label>
                    <input type="text" maxLength={2} value={uf}
                      onChange={e => setUf(e.target.value.toUpperCase())}
                      placeholder="AM" className={inputCls('green')} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={voltar} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors">← Voltar</button>
              <button onClick={avancar} className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors">
                Próximo: Família <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Família ─── */}
        {secaoAtiva === 'familia' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-orange-500 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Família & Origem</h2>
                <p className="text-orange-100 text-xs">Filiação, cônjuge, naturalidade e formação</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Filiação */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> Filiação
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nome do Pai</label>
                    <input type="text" value={nomePai} onChange={e => setNomePai(e.target.value)}
                      className={inputCls('orange')} placeholder="Nome completo do pai" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nome da Mãe</label>
                    <input type="text" value={nomeMae} onChange={e => setNomeMae(e.target.value)}
                      className={inputCls('orange')} placeholder="Nome completo da mãe" />
                  </div>
                </div>
              </div>

              {/* Estado civil */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Estado Civil
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { value: '', label: 'Não informado' },
                    { value: 'solteiro', label: 'Solteiro(a)' },
                    { value: 'casado', label: 'Casado(a)' },
                    { value: 'divorciado', label: 'Divorciado(a)' },
                    { value: 'viuvo', label: 'Viúvo(a)' },
                    { value: 'uniao_estavel', label: 'União Estável' },
                  ].map(op => (
                    <button key={op.value} type="button" onClick={() => setEstadoCivil(op.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${estadoCivil === op.value ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cônjuge */}
              {['casado', 'uniao_estavel'].includes(estadoCivil) && (
                <div className="grid sm:grid-cols-2 gap-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <div>
                    <label className="block text-xs text-slate-600 font-semibold mb-1">Nome do Cônjuge</label>
                    <input type="text" value={conjugeNome} onChange={e => setConjugeNome(e.target.value)}
                      className={inputCls('orange')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 font-semibold mb-1">Religião do Cônjuge</label>
                    <input type="text" value={conjugeReligiao} onChange={e => setConjugeReligiao(e.target.value)}
                      placeholder="Ex: Católico, Evangélico..." className={inputCls('orange')} />
                  </div>
                </div>
              )}

              {/* Naturalidade e Nacionalidade */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Flag className="w-4 h-4" /> Naturalidade & Nacionalidade
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Cidade natal</label>
                    <input type="text" value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)}
                      className={inputCls('orange')} placeholder="Manaus" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">UF natal</label>
                    <input type="text" maxLength={2} value={naturalidadeUf}
                      onChange={e => setNaturalidadeUf(e.target.value.toUpperCase())}
                      placeholder="AM" className={inputCls('orange')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nacionalidade</label>
                    <input type="text" value={nacionalidade} onChange={e => setNacionalidade(e.target.value)}
                      className={inputCls('orange')} />
                  </div>
                </div>
              </div>

              {/* Profissão e Escolaridade */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" /> Profissão
                  </label>
                  <input type="text" value={profissao} onChange={e => setProfissao(e.target.value)}
                    placeholder="Ex: Engenheiro, Professor..." className={inputCls('orange')} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" /> Escolaridade
                  </label>
                  <select value={escolaridade} onChange={e => setEscolaridade(e.target.value)} className={selectCls('orange')}>
                    <option value="">Não informada</option>
                    <option value="fundamental_incompleto">Fund. Incompleto</option>
                    <option value="fundamental_completo">Fund. Completo</option>
                    <option value="medio_incompleto">Médio Incompleto</option>
                    <option value="medio_completo">Médio Completo</option>
                    <option value="superior_incompleto">Superior Incompleto</option>
                    <option value="superior_completo">Superior Completo</option>
                    <option value="pos_graduacao">Pós-Graduação</option>
                    <option value="mestrado">Mestrado</option>
                    <option value="doutorado">Doutorado</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={voltar} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors">← Voltar</button>
              <button onClick={avancar} className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors">
                Próximo: Datas <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Datas ─── */}
        {secaoAtiva === 'datas' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-purple-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Datas</h2>
                <p className="text-purple-100 text-xs">Nascimento, casamento, batismo e profissão de fé</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {[
                { emoji: '🎂', label: 'Data de Nascimento', value: dataNascimento, setter: setDataNascimento },
                { emoji: '💍', label: 'Data de Casamento', value: dataCasamento, setter: setDataCasamento },
                { emoji: '✝️', label: 'Data de Batismo', value: dataBatismo, setter: setDataBatismo },
                { emoji: '🙏', label: 'Data de Profissão de Fé', value: dataProfissaoFe, setter: setDataProfissaoFe },
              ].map(campo => (
                <div key={campo.label}>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <span className="text-lg">{campo.emoji}</span> {campo.label}
                  </label>
                  <input type="date" value={campo.value} onChange={e => campo.setter(e.target.value)}
                    className={inputCls('purple')} />
                </div>
              ))}
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={voltar} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors">← Voltar</button>
              <button onClick={avancar} className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors">
                Próximo: Eclesiástica <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Eclesiástica ─── */}
        {secaoAtiva === 'eclesiastica' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Church className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Vida Eclesiástica</h2>
                <p className="text-indigo-100 text-xs">Grupo familiar, discipulado e transferências</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Checkboxes */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 hover:bg-indigo-100 transition-colors">
                  <input type="checkbox" checked={batizado} onChange={e => setBatizado(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-900">✝️ Batizado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 hover:bg-indigo-100 transition-colors">
                  <input type="checkbox" checked={transferidoIpb} onChange={e => setTransferidoIpb(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-900">📋 Transferido IPB</span>
                </label>
              </div>

              {/* Denominação anterior */}
              {!transferidoIpb && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Transferido de outra denominação</label>
                  <input type="text" value={transferidoOutra} onChange={e => setTransferidoOutra(e.target.value)}
                    placeholder="Nome da denominação anterior" className={inputCls('indigo')} />
                </div>
              )}

              {/* Grupo Familiar */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Home className="w-4 h-4" /> Grupo Familiar
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Nome do Grupo</label>
                    <input type="text" value={grupoFamiliarNome} onChange={e => setGrupoFamiliarNome(e.target.value)}
                      placeholder="Ex: Grupo Família Abençoada" className={inputCls('indigo')} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Líder do Grupo</label>
                    <input type="text" value={grupoFamiliarLider} onChange={e => setGrupoFamiliarLider(e.target.value)}
                      placeholder="Nome do líder" className={inputCls('indigo')} />
                  </div>
                </div>
              </div>

              {/* Cursos */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Cursos de Discipulado
                </label>
                <input type="text" value={cursosDiscipulado} onChange={e => setCursosDiscipulado(e.target.value)}
                  placeholder="Curso 1, Curso 2, Curso 3 (separados por vírgula)"
                  className={inputCls('indigo')} />
                {cursosDiscipulado && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cursosDiscipulado.split(',').map(c => c.trim()).filter(Boolean).map(c => (
                      <span key={c} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-medium border border-indigo-200">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={voltar} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors">← Voltar</button>
              <button onClick={avancar} className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                Próximo: Pastoral <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Pastoral ─── */}
        {secaoAtiva === 'pastoral' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-rose-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white">Cuidado Pastoral</h2>
                <p className="text-rose-100 text-xs">Saúde e observações confidenciais</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Situação de Saúde</label>
                <p className="text-xs text-slate-400 mb-2">Condições relevantes para o cuidado pastoral</p>
                <textarea value={situacaoSaude} onChange={e => setSituacaoSaude(e.target.value)}
                  placeholder="Ex: Hipertensão, dificuldade de locomoção..."
                  rows={3} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-rose-500 transition-colors text-slate-900 placeholder:text-slate-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Observações Gerais</label>
                <p className="text-xs text-slate-400 mb-2">Informações importantes para a liderança</p>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                  placeholder="Situação familiar, necessidades especiais..."
                  rows={4} className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-rose-500 transition-colors text-slate-900 placeholder:text-slate-400 resize-none" />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={voltar} className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors">← Voltar</button>
              <button onClick={salvar} disabled={salvando || !nome.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {salvando
                  ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  : <Check className="w-4 h-4" />}
                {salvando ? 'Salvando...' : 'Cadastrar Membro'}
              </button>
            </div>
          </div>
        )}

        {/* Resumo flutuante */}
        {nome && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Resumo</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {fotoUrl
                  ? <img src={fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" onError={e => (e.currentTarget.style.display='none')} />
                  : <User className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-900">{nome}</span>
                {sexo && <span className="text-xs text-slate-400">{sexo === 'M' ? '♂' : '♀'}</span>}
              </div>
              {telefone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">{telefone}</span></div>}
              {email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">{email}</span></div>}
              {dataNascimento && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">{new Date(dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span></div>}
              {profissao && <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">{profissao}</span></div>}
              {grupoFamiliarNome && <div className="flex items-center gap-2"><Home className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">{grupoFamiliarNome}</span></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
