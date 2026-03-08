'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { CargoTipo, getCargoLabel, getCargoCor } from '@/lib/permissions';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';
import RelacionamentosCard from '@/components/RelacionamentosCard';
import {
  ArrowLeft, Save, Phone, Mail, MapPin, Calendar, Heart,
  AlertCircle, MessageSquare, Plus, Edit2, Trash2, User,
  Cake, Church, Clock, Briefcase, GraduationCap, Home,
  Users, BookOpen, Globe, Flag, ChevronDown, ChevronUp, Camera
} from 'lucide-react';

interface Membro {
  id: string;
  nome: string;
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

// ─── Seção Colapsável ────────────────────────────────────────────────────────
function SecaoColapsavel({ titulo, icone, children, defaultAberta = true }: {
  titulo: string; icone: React.ReactNode; children: React.ReactNode; defaultAberta?: boolean;
}) {
  const [aberta, setAberta] = useState(defaultAberta);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setAberta(!aberta)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">{icone}{titulo}</h3>
        {aberta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {aberta && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

// ─── Campo de Info ────────────────────────────────────────────────────────────
function CampoInfo({ icone, label, valor, span2 = false }: {
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

export default function MembroDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const membroId = params?.id as string;
  const { user } = useAuth();
  const { permissoes, usuarioPermitido } = usePermissions();

  const [membro, setMembro] = useState<Membro | null>(null);
  const [notas, setNotas] = useState<NotaPastoral[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [modoEdicao, setModoEdicao] = useState(false);
  const [fotoError, setFotoError] = useState(false);

  // ── Form states ──
  const [nome, setNome] = useState('');
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
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [batizado, setBatizado] = useState(false);
  const [transferidoIpb, setTransferidoIpb] = useState(false);
  const [transferidoOutra, setTransferidoOutra] = useState('');
  const [cursosDiscipulado, setCursosDiscipulado] = useState('');
  const [grupoFamiliarNome, setGrupoFamiliarNome] = useState('');
  const [grupoFamiliarLider, setGrupoFamiliarLider] = useState('');

  // ── Notas ──
  const [modalNotaAberto, setModalNotaAberto] = useState(false);
  const [tipoNota, setTipoNota] = useState<TipoNota>('nota');
  const [tituloNota, setTituloNota] = useState('');
  const [conteudoNota, setConteudoNota] = useState('');
  const [notaPrivada, setNotaPrivada] = useState(false);

  const podeAcessar = permissoes.isSuperAdmin ||
    ['admin', 'pastor', 'presbitero', 'seminarista'].includes(usuarioPermitido?.cargo || '');

  useEffect(() => {
    if (user && podeAcessar && membroId) {
      carregarMembro();
      carregarNotas();
    }
  }, [user, podeAcessar, membroId]);

  const carregarMembro = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('pessoas').select('*').eq('id', membroId).single();
      if (error) throw error;
      setMembro(data);
      setFotoError(false);
      setNome(data.nome);
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
      setBatizado(data.batizado ?? false);
      setTransferidoIpb(data.transferido_ipb ?? false);
      setTransferidoOutra(data.transferido_outra_denominacao || '');
      setCursosDiscipulado((data.cursos_discipulado || []).join(', '));
      setGrupoFamiliarNome(data.grupo_familiar_nome || '');
      setGrupoFamiliarLider(data.grupo_familiar_lider || '');
    } catch (error) {
      console.error('Erro ao carregar membro:', error);
      setMensagem('Erro ao carregar dados do membro');
    } finally {
      setLoading(false);
    }
  };

  const carregarNotas = async () => {
    try {
      const { data, error } = await supabase
        .from('notas_pastorais')
        .select('*, autor:autor_id (nome, cargo)')
        .eq('membro_id', membroId)
        .order('criado_em', { ascending: false });
      if (error) return;
      setNotas((data || []).map((nota: any) => ({
        id: nota.id, tipo: nota.tipo, titulo: nota.titulo,
        conteudo: nota.conteudo, privado: nota.privado,
        criado_em: nota.criado_em, atualizado_em: nota.atualizado_em,
        autor: { nome: nota.autor?.nome || 'Desconhecido', cargo: nota.autor?.cargo || 'membro' },
      })));
    } catch (error) { console.error('Erro ao carregar notas:', error); }
  };

  const salvarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');
    try {
      const cursosArray = cursosDiscipulado.split(',').map(c => c.trim()).filter(Boolean);
      const { error } = await supabase.from('pessoas').update({
        nome: nome.trim(),
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
        batizado,
        transferido_ipb: transferidoIpb,
        transferido_outra_denominacao: transferidoOutra.trim() || null,
        cursos_discipulado: cursosArray.length > 0 ? cursosArray : null,
        grupo_familiar_nome: grupoFamiliarNome.trim() || null,
        grupo_familiar_lider: grupoFamiliarLider.trim() || null,
        atualizado_em: new Date().toISOString(),
      }).eq('id', membroId);
      if (error) throw error;
      setMensagem('Alterações salvas com sucesso!');
      setModoEdicao(false);
      carregarMembro();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setMensagem('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const adicionarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conteudoNota.trim()) return;
    try {
      const { error } = await supabase.from('notas_pastorais').insert({
        membro_id: membroId, autor_id: usuarioPermitido?.id,
        tipo: tipoNota, titulo: tituloNota.trim() || null,
        conteudo: conteudoNota.trim(), privado: notaPrivada,
      });
      if (error) throw error;
      setMensagem('Nota adicionada com sucesso!');
      setModalNotaAberto(false);
      setTituloNota(''); setConteudoNota(''); setTipoNota('nota'); setNotaPrivada(false);
      carregarNotas();
    } catch { setMensagem('Erro ao adicionar nota'); }
  };

  const deletarNota = async (notaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;
    try {
      const { error } = await supabase.from('notas_pastorais').delete().eq('id', notaId);
      if (error) throw error;
      setMensagem('Nota excluída com sucesso');
      carregarNotas();
    } catch { setMensagem('Erro ao excluir nota'); }
  };

  const calcularIdade = (dataNasc: string | null) => {
    if (!dataNasc) return null;
    const hoje = new Date(); const nasc = new Date(dataNasc);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  };

  const formatarData = (data: string | null) =>
    data ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

  const formatarDataHora = (data: string) =>
    new Date(data).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getTipoNotaLabel = (tipo: string) =>
    ({ nota: 'Nota', visita: 'Visita', ligacao: 'Ligação', oracao: 'Oração', aconselhamento: 'Aconselhamento', urgente: 'Urgente' }[tipo] || tipo);

  const getTipoNotaCor = (tipo: string) =>
    ({ nota: 'bg-slate-100 text-slate-800', visita: 'bg-blue-100 text-blue-800', ligacao: 'bg-green-100 text-green-800', oracao: 'bg-purple-100 text-purple-800', aconselhamento: 'bg-yellow-100 text-yellow-800', urgente: 'bg-red-100 text-red-800' }[tipo] || 'bg-slate-100 text-slate-800');

  const abrirWhatsApp = () => {
    if (!membro?.telefone) { setMensagem('Membro não possui telefone cadastrado'); return; }
    const num = membro.telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(`Olá ${membro.nome}! Que a paz do Senhor esteja contigo!`)}`, '_blank');
  };

  const ligarPara = () => {
    if (!membro?.telefone) { setMensagem('Membro não possui telefone cadastrado'); return; }
    window.location.href = `tel:${membro.telefone}`;
  };

  const inputCls = 'w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto" />
          <p className="mt-4 text-slate-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!membro) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-bold text-slate-900 mb-2">Membro não encontrado</p>
          <button onClick={() => router.push('/admin/membros')} className="text-blue-600 hover:text-blue-800 font-medium">Voltar para lista</button>
        </div>
      </div>
    );
  }

  const idade = calcularIdade(membro.data_nascimento);
  const enderecoCompleto = [membro.logradouro, membro.bairro, membro.cidade, membro.uf].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header com foto */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/membros')} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div className="flex items-center gap-4">
              {/* Avatar */}
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
                <h1 className="text-3xl font-bold text-slate-900">{membro.nome}</h1>
                <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                  {membro.sexo && <span>{membro.sexo === 'M' ? '♂ Masculino' : '♀ Feminino'}</span>}
                  {membro.profissao && <><span>·</span><span>{membro.profissao}</span></>}
                  {idade && <><span>·</span><span>{idade} anos</span></>}
                </div>
              </div>
            </div>
          </div>
          {!modoEdicao && (
            <button onClick={() => setModoEdicao(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <Edit2 className="w-4 h-4" /> Editar
            </button>
          )}
        </div>

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
                <h3 className="font-semibold text-slate-900 mb-4">Ações Rápidas</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <button onClick={abrirWhatsApp} disabled={!membro.telefone} className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    WhatsApp
                  </button>
                  <button onClick={ligarPara} disabled={!membro.telefone} className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                    <Phone className="w-5 h-5" /> Ligar
                  </button>
                  <button onClick={() => setModalNotaAberto(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                    <Plus className="w-5 h-5" /> Nova Nota
                  </button>
                </div>
              </div>
            )}

            {/* ── MODO EDIÇÃO ── */}
            {modoEdicao ? (
              <form onSubmit={salvarAlteracoes} className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>ℹ️ Nota:</strong> Para editar <strong>email, cargo ou habilidades</strong>, use a página <strong>/admin/usuarios</strong>
                  </p>
                </div>

                {/* Foto e Dados Básicos */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Dados Básicos
                  </h3>

                  {/* Foto URL */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> URL da Foto
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input type="url" value={fotoUrl} onChange={e => { setFotoUrl(e.target.value); setFotoError(false); }}
                          placeholder="https://exemplo.com/foto.jpg" className={inputCls} />
                      </div>
                      {fotoUrl && !fotoError && (
                        <img src={fotoUrl} alt="" onError={() => setFotoError(true)}
                          className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 flex-shrink-0" />
                      )}
                      {(!fotoUrl || fotoError) && (
                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
                      <input type="text" value={nome} onChange={e => setNome(e.target.value)} required className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                      <input type="tel" value={telefone} onChange={e => setTelefone(formatPhoneNumber(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Sexo</label>
                      <select value={sexo} onChange={e => setSexo(e.target.value)} className={inputCls}>
                        <option value="">Não informado</option>
                        <option value="M">Masculino</option>
                        <option value="F">Feminino</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Status do Membro</label>
                      <select value={statusMembro} onChange={e => setStatusMembro(e.target.value)} className={inputCls}>
                        <option value="ativo">Ativo</option>
                        <option value="visitante">Visitante</option>
                        <option value="congregado">Congregado</option>
                        <option value="afastado">Afastado</option>
                        <option value="falecido">Falecido</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                      <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estado Civil</label>
                      <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className={inputCls}>
                        <option value="">Não informado</option>
                        <option value="solteiro">Solteiro(a)</option>
                        <option value="casado">Casado(a)</option>
                        <option value="divorciado">Divorciado(a)</option>
                        <option value="viuvo">Viúvo(a)</option>
                        <option value="uniao_estavel">União Estável</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Casamento</label>
                      <input type="date" value={dataCasamento} onChange={e => setDataCasamento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Cônjuge</label>
                      <input type="text" value={conjugeNome} onChange={e => setConjugeNome(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Religião do Cônjuge</label>
                      <input type="text" value={conjugeReligiao} onChange={e => setConjugeReligiao(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Pai</label>
                      <input type="text" value={nomePai} onChange={e => setNomePai(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Mãe</label>
                      <input type="text" value={nomeMae} onChange={e => setNomeMae(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Naturalidade (Cidade)</label>
                      <input type="text" value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">UF Naturalidade</label>
                      <input type="text" maxLength={2} value={naturalidadeUf} onChange={e => setNaturalidadeUf(e.target.value.toUpperCase())} className={inputCls} placeholder="AM" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nacionalidade</label>
                      <input type="text" value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
                      <input type="text" value={profissao} onChange={e => setProfissao(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Escolaridade</label>
                      <select value={escolaridade} onChange={e => setEscolaridade(e.target.value)} className={inputCls}>
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

                {/* Endereço */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Endereço
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Logradouro</label>
                      <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} className={inputCls} placeholder="Rua, Av., número..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                      <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                      <input type="text" value={cep} onChange={e => setCep(e.target.value)} maxLength={9} className={inputCls} placeholder="00000-000" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                      <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">UF</label>
                      <input type="text" maxLength={2} value={uf} onChange={e => setUf(e.target.value.toUpperCase())} className={inputCls} placeholder="AM" />
                    </div>
                  </div>
                </div>

                {/* Vida Eclesiástica */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3 flex items-center gap-2">
                    <Church className="w-4 h-4" /> Vida Eclesiástica
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Batismo</label>
                      <input type="date" value={dataBatismo} onChange={e => setDataBatismo(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Profissão de Fé</label>
                      <input type="date" value={dataProfissaoFe} onChange={e => setDataProfissaoFe(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grupo Familiar</label>
                      <input type="text" value={grupoFamiliarNome} onChange={e => setGrupoFamiliarNome(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Líder do Grupo Familiar</label>
                      <input type="text" value={grupoFamiliarLider} onChange={e => setGrupoFamiliarLider(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cursos de Discipulado (separados por vírgula)</label>
                    <input type="text" value={cursosDiscipulado} onChange={e => setCursosDiscipulado(e.target.value)} className={inputCls} placeholder="Curso 1, Curso 2, Curso 3" />
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={batizado} onChange={e => setBatizado(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      <span className="text-sm text-slate-700 font-medium">Batizado</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={transferidoIpb} onChange={e => setTransferidoIpb(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                      <span className="text-sm text-slate-700 font-medium">Transferido IPB</span>
                    </label>
                  </div>
                  {!transferidoIpb && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Transferido de outra denominação</label>
                      <input type="text" value={transferidoOutra} onChange={e => setTransferidoOutra(e.target.value)} className={inputCls} placeholder="Nome da denominação anterior" />
                    </div>
                  )}
                </div>

                {/* Saúde e Observações */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <h3 className="font-semibold text-slate-900 border-b pb-3">Saúde & Observações</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Situação de Saúde</label>
                    <textarea value={situacaoSaude} onChange={e => setSituacaoSaude(e.target.value)} rows={3} className={inputCls} placeholder="Informações relevantes sobre saúde..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observações Gerais</label>
                    <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={4} className={inputCls} placeholder="Informações importantes sobre o membro..." />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button type="submit" disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium">
                    <Save className="w-4 h-4" />
                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button type="button" onClick={() => { setModoEdicao(false); carregarMembro(); }} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                    Cancelar
                  </button>
                </div>
              </form>

            ) : (
              /* ── MODO VISUALIZAÇÃO ── */
              <>
                {/* Dados Pessoais */}
                <SecaoColapsavel titulo="Dados Pessoais" icone={<User className="w-5 h-5 text-slate-600" />}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <CampoInfo icone={<Mail className="w-5 h-5" />} label="Email" valor={membro.email} />
                    <CampoInfo icone={<Phone className="w-5 h-5" />} label="Telefone" valor={membro.telefone ? formatPhoneNumber(membro.telefone) : null} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label="Sexo" valor={membro.sexo === 'M' ? 'Masculino' : membro.sexo === 'F' ? 'Feminino' : null} />
                    <CampoInfo icone={<Cake className="w-5 h-5" />} label="Nascimento" valor={membro.data_nascimento ? `${formatarData(membro.data_nascimento)} (${idade} anos)` : null} />
                    <CampoInfo icone={<Heart className="w-5 h-5" />} label="Estado Civil"
                      valor={membro.estado_civil ? ({ solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)', uniao_estavel: 'União Estável' }[membro.estado_civil] || membro.estado_civil) : null} />
                    <CampoInfo icone={<Heart className="w-5 h-5" />} label="Casamento" valor={formatarData(membro.data_casamento)} />
                    <CampoInfo icone={<Users className="w-5 h-5" />} label="Cônjuge" valor={membro.conjuge_nome} />
                    <CampoInfo icone={<Globe className="w-5 h-5" />} label="Religião do Cônjuge" valor={membro.conjuge_religiao} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label="Pai" valor={membro.nome_pai} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label="Mãe" valor={membro.nome_mae} />
                    <CampoInfo icone={<Flag className="w-5 h-5" />} label="Naturalidade" valor={[membro.naturalidade_cidade, membro.naturalidade_uf].filter(Boolean).join(' - ') || null} />
                    <CampoInfo icone={<Globe className="w-5 h-5" />} label="Nacionalidade" valor={membro.nacionalidade} />
                    <CampoInfo icone={<Briefcase className="w-5 h-5" />} label="Profissão" valor={membro.profissao} />
                    <CampoInfo icone={<GraduationCap className="w-5 h-5" />} label="Escolaridade"
                      valor={membro.escolaridade ? ({ fundamental_incompleto: 'Fund. Incompleto', fundamental_completo: 'Fund. Completo', medio_incompleto: 'Médio Incompleto', medio_completo: 'Médio Completo', superior_incompleto: 'Superior Incompleto', superior_completo: 'Superior Completo', pos_graduacao: 'Pós-Graduação', mestrado: 'Mestrado', doutorado: 'Doutorado' }[membro.escolaridade] || membro.escolaridade) : null} />
                  </div>
                  {enderecoCompleto && (
                    <div className="mt-4 flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Endereço</p>
                        <p className="text-sm text-slate-900 font-medium">
                          {membro.logradouro}{membro.bairro && `, ${membro.bairro}`}
                          {membro.cep && ` - CEP ${membro.cep}`}<br />
                          {membro.cidade}{membro.uf && ` / ${membro.uf}`}
                        </p>
                        {membro.latitude && membro.longitude && (
                          <a href={`https://maps.google.com/?q=${membro.latitude},${membro.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 block">Ver no Google Maps</a>
                        )}
                      </div>
                    </div>
                  )}
                </SecaoColapsavel>

                {/* Vida Eclesiástica */}
                <SecaoColapsavel titulo="Vida Eclesiástica" icone={<Church className="w-5 h-5 text-slate-600" />}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <CampoInfo icone={<Church className="w-5 h-5" />} label="Batismo" valor={formatarData(membro.data_batismo)} />
                    <CampoInfo icone={<Calendar className="w-5 h-5" />} label="Profissão de Fé" valor={formatarData(membro.data_profissao_fe)} />
                    <CampoInfo icone={<Users className="w-5 h-5" />} label="Grupo Familiar" valor={membro.grupo_familiar_nome} />
                    <CampoInfo icone={<User className="w-5 h-5" />} label="Líder do Grupo" valor={membro.grupo_familiar_lider} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {membro.batizado && <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-300">✓ Batizado</span>}
                    {membro.transferido_ipb && <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold border border-green-300">✓ Transferido IPB</span>}
                    {membro.transferido_outra_denominacao && (
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-300">
                        Transferido de: {membro.transferido_outra_denominacao}
                      </span>
                    )}
                  </div>
                  {membro.cursos_discipulado && membro.cursos_discipulado.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><BookOpen className="w-4 h-4" /> Cursos de Discipulado</p>
                      <div className="flex flex-wrap gap-2">
                        {membro.cursos_discipulado.map(curso => (
                          <span key={curso} className="px-3 py-1 rounded-full bg-purple-50 text-purple-800 text-xs font-medium border border-purple-200">{curso}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </SecaoColapsavel>

                {/* Saúde e Observações */}
                {(membro.situacao_saude || membro.observacoes) && (
                  <SecaoColapsavel titulo="Saúde & Observações" icone={<AlertCircle className="w-5 h-5 text-slate-600" />}>
                    {membro.situacao_saude && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <Heart className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-red-900 mb-1">Situação de Saúde</p>
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
                            <p className="text-sm font-semibold text-amber-900 mb-1">Observações</p>
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
                  <MessageSquare className="w-5 h-5 text-slate-600" /> Histórico de Acompanhamento
                </h3>
                <button onClick={() => setModalNotaAberto(true)} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                  <Plus className="w-4 h-4" /> Nova Nota
                </button>
              </div>
              {notas.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Nenhuma nota de acompanhamento ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notas.map(nota => (
                    <div key={nota.id} className="border-l-4 border-purple-400 pl-4 py-2">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getTipoNotaCor(nota.tipo)}`}>{getTipoNotaLabel(nota.tipo)}</span>
                          {nota.privado && <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">Privado</span>}
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
            {/* Card Status */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tipo</p>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${getCargoCor(membro.cargo as CargoTipo)}`}>{getCargoLabel(membro.cargo as CargoTipo)}</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Situação</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                    membro.status_membro === 'ativo' ? 'bg-green-100 text-green-800 border-green-300' :
                    membro.status_membro === 'visitante' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                    membro.status_membro === 'congregado' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                    membro.status_membro === 'afastado' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                    'bg-gray-100 text-gray-800 border-gray-300'
                  }`}>
                    {{ ativo: 'Ativo', visitante: 'Visitante', congregado: 'Congregado', afastado: 'Afastado', falecido: 'Falecido' }[membro.status_membro]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Cadastro</p>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${membro.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {membro.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>

            {/* Grupo Familiar */}
            {(membro.grupo_familiar_nome || membro.grupo_familiar_lider) && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Home className="w-5 h-5 text-slate-600" /> Grupo Familiar
                </h3>
                {membro.grupo_familiar_nome && <div className="mb-2"><p className="text-xs text-slate-500">Nome do Grupo</p><p className="text-sm font-semibold text-slate-900">{membro.grupo_familiar_nome}</p></div>}
                {membro.grupo_familiar_lider && <div><p className="text-xs text-slate-500">Líder</p><p className="text-sm font-semibold text-slate-900">{membro.grupo_familiar_lider}</p></div>}
              </div>
            )}

            {/* Estatísticas */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Estatísticas</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total de Notas', val: notas.length, cor: 'text-slate-900' },
                  { label: 'Visitas', val: notas.filter(n => n.tipo === 'visita').length, cor: 'text-blue-600' },
                  { label: 'Ligações', val: notas.filter(n => n.tipo === 'ligacao').length, cor: 'text-green-600' },
                  { label: 'Urgentes', val: notas.filter(n => n.tipo === 'urgente').length, cor: 'text-red-600' },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{stat.label}</span>
                    <span className={`text-lg font-bold ${stat.cor}`}>{stat.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <RelacionamentosCard
              membroId={membroId}
              membroNome={membro.nome}
              autorId={usuarioPermitido?.id}
              podeEditar={permissoes.isSuperAdmin || ['admin', 'pastor', 'presbitero'].includes(usuarioPermitido?.cargo || '')}
              onNavegar={(id) => router.push(`/admin/membros/${id}`)}
            />
          </div>
        </div>
      </main>

      {/* Modal Nova Nota */}
      {modalNotaAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Nova Nota de Acompanhamento</h3>
              <button onClick={() => { setModalNotaAberto(false); setTituloNota(''); setConteudoNota(''); setTipoNota('nota'); setNotaPrivada(false); }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                <span className="text-slate-500">✕</span>
              </button>
            </div>
            <form onSubmit={adicionarNota} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Nota *</label>
                  <select value={tipoNota} onChange={e => setTipoNota(e.target.value as TipoNota)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="nota">Nota Geral</option>
                    <option value="visita">Visita Domiciliar</option>
                    <option value="ligacao">Ligação Telefônica</option>
                    <option value="oracao">Pedido de Oração</option>
                    <option value="aconselhamento">Aconselhamento</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Título (opcional)</label>
                  <input type="text" value={tituloNota} onChange={e => setTituloNota(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Visita de acompanhamento" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Conteúdo da Nota *</label>
                <textarea value={conteudoNota} onChange={e => setConteudoNota(e.target.value)} required rows={6}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Descreva o acompanhamento, observações, pedidos de oração..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={notaPrivada} onChange={e => setNotaPrivada(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-slate-700">Nota privada (apenas pastor e liderança)</span>
              </label>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button type="submit" className="flex-1 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-all font-medium">Salvar Nota</button>
                <button type="button" onClick={() => { setModalNotaAberto(false); setTituloNota(''); setConteudoNota(''); setTipoNota('nota'); setNotaPrivada(false); }}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}