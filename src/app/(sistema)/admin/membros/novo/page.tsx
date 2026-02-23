'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar,
  Heart, Church, AlertCircle, Check, ChevronRight
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
    id: 'datas',
    titulo: 'Datas',
    descricao: 'Nascimento, casamento e batismo',
    icone: <Calendar className="w-5 h-5" />,
    cor: 'purple',
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
  blue: 'bg-blue-100 text-blue-600 border-blue-200',
  green: 'bg-green-100 text-green-600 border-green-200',
  purple: 'bg-purple-100 text-purple-600 border-purple-200',
  rose: 'bg-rose-100 text-rose-600 border-rose-200',
};

const COR_ATIVO: Record<string, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  purple: 'bg-purple-600',
  rose: 'bg-rose-600',
};

export default function NovoMembroPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { permissoes, usuarioPermitido } = usePermissions();

  const [secaoAtiva, setSecaoAtiva] = useState('identificacao');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // Campos
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState<CargoTipo>('membro');
  const [statusMembro, setStatusMembro] = useState<StatusMembro>('ativo');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataCasamento, setDataCasamento] = useState('');
  const [dataBatismo, setDataBatismo] = useState('');
  const [situacaoSaude, setSituacaoSaude] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const podeAcessar = permissoes.isSuperAdmin ||
    ['admin', 'pastor', 'presbitero'].includes(usuarioPermitido?.cargo || '');

  const salvar = async () => {
    if (!nome.trim()) {
      setErro('O nome é obrigatório.');
      setSecaoAtiva('identificacao');
      return;
    }

    setSalvando(true);
    setErro('');

    try {
      const { error } = await supabase.from('pessoas').insert({
        nome: nome.trim(),
        cargo,
        status_membro: statusMembro,
        telefone: telefone ? unformatPhoneNumber(telefone) : null,
        email: email.trim() || null,
        endereco_completo: endereco.trim() || null,
        data_nascimento: dataNascimento || null,
        data_casamento: dataCasamento || null,
        data_batismo: dataBatismo || null,
        situacao_saude: situacaoSaude.trim() || null,
        observacoes: observacoes.trim() || null,
        ativo: true,
        criado_por: user?.id ?? null,
      });

      if (error) throw error;

      setSucesso(true);
      setTimeout(() => router.push('/admin/membros'), 1500);
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
        setErro('Já existe um membro com este email.');
      } else {
        setErro('Erro ao salvar. Tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const secaoCompleta = (id: string): boolean => {
    if (id === 'identificacao') return nome.trim().length > 0;
    if (id === 'contato') return !!(telefone || email);
    if (id === 'datas') return !!(dataNascimento || dataBatismo);
    return false;
  };

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

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header fixo */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/membros')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
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
            {salvando ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SECOES.map((s) => (
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
              <div className={`${secaoAtiva === s.id ? '' : 'text-slate-400'}`}>
                {s.icone}
              </div>
              <span className={`text-xs font-semibold ${secaoAtiva === s.id ? '' : 'text-slate-500'}`}>
                {s.titulo}
              </span>
            </button>
          ))}
        </div>

        {/* ─── SEÇÃO: Identificação ─── */}
        {secaoAtiva === 'identificacao' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Identificação</h2>
                  <p className="text-blue-100 text-xs">Nome, cargo e situação</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João da Silva Pereira"
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-blue-500 transition-colors text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Cargo / Função
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    { value: 'membro', label: 'Membro' },
                    { value: 'congregado', label: 'Congregado' },
                    { value: 'diacono', label: 'Diácono' },
                    { value: 'presbitero', label: 'Presbítero' },
                    { value: 'seminarista', label: 'Seminarista' },
                    { value: 'pastor', label: 'Pastor' },
                  ] as { value: CargoTipo; label: string }[]).map((op) => (
                    <button
                      key={op.value}
                      onClick={() => setCargo(op.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        cargo === op.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Situação
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    { value: 'ativo', label: '🟢 Ativo' },
                    { value: 'visitante', label: '🔵 Visitante' },
                    { value: 'congregado', label: '🟣 Congregado' },
                    { value: 'afastado', label: '🟡 Afastado' },
                    { value: 'falecido', label: '⚫ Falecido' },
                  ] as { value: StatusMembro; label: string }[]).map((op) => (
                    <button
                      key={op.value}
                      onClick={() => setStatusMembro(op.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        statusMembro === op.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Avançar */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setSecaoAtiva('contato')}
                disabled={!nome.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próximo: Contato
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Contato ─── */}
        {secaoAtiva === 'contato' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-green-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Contato</h2>
                  <p className="text-green-100 text-xs">Telefone, email e endereço</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Telefone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhoneNumber(e.target.value))}
                    placeholder="(92) 99999-9999"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-green-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao@email.com"
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-green-500 transition-colors text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Endereço completo
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <textarea
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                    rows={2}
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-green-500 transition-colors text-slate-900 placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setSecaoAtiva('identificacao')}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={() => setSecaoAtiva('datas')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Próximo: Datas
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Datas ─── */}
        {secaoAtiva === 'datas' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-purple-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Datas</h2>
                  <p className="text-purple-100 text-xs">Nascimento, casamento e batismo</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="text-lg">🎂</span> Data de Nascimento
                </label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-purple-500 transition-colors text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="text-lg">💍</span> Data de Casamento
                </label>
                <input
                  type="date"
                  value={dataCasamento}
                  onChange={(e) => setDataCasamento(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-purple-500 transition-colors text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="text-lg">✝️</span> Data de Batismo
                </label>
                <input
                  type="date"
                  value={dataBatismo}
                  onChange={(e) => setDataBatismo(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-purple-500 transition-colors text-slate-900"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setSecaoAtiva('contato')}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={() => setSecaoAtiva('pastoral')}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
              >
                Próximo: Pastoral
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO: Pastoral ─── */}
        {secaoAtiva === 'pastoral' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-rose-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Cuidado Pastoral</h2>
                  <p className="text-rose-100 text-xs">Saúde e observações</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Situação de Saúde
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Condições relevantes para o cuidado pastoral
                </p>
                <textarea
                  value={situacaoSaude}
                  onChange={(e) => setSituacaoSaude(e.target.value)}
                  placeholder="Ex: Hipertensão, dificuldade de locomoção..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-rose-500 transition-colors text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Observações Gerais
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Informações importantes para a liderança
                </p>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Situação familiar, necessidades especiais..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-rose-500 transition-colors text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setSecaoAtiva('datas')}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || !nome.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {salvando ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {salvando ? 'Salvando...' : 'Cadastrar Membro'}
              </button>
            </div>
          </div>
        )}

        {/* Resumo flutuante do que foi preenchido */}
        {nome && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Resumo</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-900">{nome}</span>
              </div>
              {telefone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{telefone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{email}</span>
                </div>
              )}
              {dataNascimento && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {new Date(dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}