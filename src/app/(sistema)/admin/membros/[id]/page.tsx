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
  Cake, Church, Clock
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
}

interface NotaPastoral {
  id: string;
  tipo: string;
  titulo: string | null;
  conteudo: string;
  privado: boolean;
  criado_em: string;
  atualizado_em: string;
  autor: {
    nome: string;
    cargo: string;
  };
}

type TipoNota = 'nota' | 'visita' | 'ligacao' | 'oracao' | 'aconselhamento' | 'urgente';

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

  // Estados do formulário
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataCasamento, setDataCasamento] = useState('');
  const [dataBatismo, setDataBatismo] = useState('');
  const [situacaoSaude, setSituacaoSaude] = useState('');
  const [endereco, setEndereco] = useState('');
  const [statusMembro, setStatusMembro] = useState<string>('ativo');
  const [observacoes, setObservacoes] = useState('');

  // Estados para nova nota
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
      const { data, error } = await supabase
        .from('pessoas')
        .select('*')
        .eq('id', membroId)
        .single();

      if (error) throw error;
      
      setMembro(data);
      setNome(data.nome);
      setTelefone(data.telefone ? formatPhoneNumber(data.telefone) : '');
      setDataNascimento(data.data_nascimento || '');
      setDataCasamento(data.data_casamento || '');
      setDataBatismo(data.data_batismo || '');
      setSituacaoSaude(data.situacao_saude || '');
      setEndereco(data.endereco_completo || '');
      setStatusMembro(data.status_membro || 'ativo');
      setObservacoes(data.observacoes || '');
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
        .select(`
          *,
          autor:autor_id (
            nome,
            cargo
          )
        `)
        .eq('membro_id', membroId)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro Supabase ao carregar notas:', error);
        return;
      }
      
      // Transform data to match interface
      const notasFormatadas = (data || []).map((nota: any) => ({
        id: nota.id,
        tipo: nota.tipo,
        titulo: nota.titulo,
        conteudo: nota.conteudo,
        privado: nota.privado,
        criado_em: nota.criado_em,
        atualizado_em: nota.atualizado_em,
        autor: {
          nome: nota.autor?.nome || 'Desconhecido',
          cargo: nota.autor?.cargo || 'membro'
        }
      }));
      
      setNotas(notasFormatadas);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    }
  };

  const salvarAlteracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      const { error } = await supabase
        .from('pessoas')
        .update({
          nome: nome.trim(),
          telefone: telefone ? unformatPhoneNumber(telefone) : null,
          data_nascimento: dataNascimento || null,
          data_casamento: dataCasamento || null,
          data_batismo: dataBatismo || null,
          situacao_saude: situacaoSaude.trim() || null,
          endereco_completo: endereco.trim() || null,
          status_membro: statusMembro,
          observacoes: observacoes.trim() || null,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', membroId);

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
      const { error } = await supabase
        .from('notas_pastorais')
        .insert({
          membro_id: membroId,
          autor_id: usuarioPermitido?.id,
          tipo: tipoNota,
          titulo: tituloNota.trim() || null,
          conteudo: conteudoNota.trim(),
          privado: notaPrivada
        });

      if (error) throw error;

      setMensagem('Nota adicionada com sucesso!');
      setModalNotaAberto(false);
      setTituloNota('');
      setConteudoNota('');
      setTipoNota('nota');
      setNotaPrivada(false);
      carregarNotas();
    } catch (error) {
      console.error('Erro ao adicionar nota:', error);
      setMensagem('Erro ao adicionar nota');
    }
  };

  const deletarNota = async (notaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

    try {
      const { error } = await supabase
        .from('notas_pastorais')
        .delete()
        .eq('id', notaId);

      if (error) throw error;

      setMensagem('Nota excluída com sucesso');
      carregarNotas();
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
      setMensagem('Erro ao excluir nota');
    }
  };

  const calcularIdade = (dataNascimento: string | null): number | null => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  const formatarData = (data: string | null): string => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const formatarDataHora = (data: string): string => {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTipoNotaLabel = (tipo: string): string => {
    const labels: Record<string, string> = {
      nota: 'Nota',
      visita: 'Visita',
      ligacao: 'Ligação',
      oracao: 'Oração',
      aconselhamento: 'Aconselhamento',
      urgente: 'Urgente'
    };
    return labels[tipo] || tipo;
  };

  const getTipoNotaCor = (tipo: string): string => {
    const cores: Record<string, string> = {
      nota: 'bg-slate-100 text-slate-800',
      visita: 'bg-blue-100 text-blue-800',
      ligacao: 'bg-green-100 text-green-800',
      oracao: 'bg-purple-100 text-purple-800',
      aconselhamento: 'bg-yellow-100 text-yellow-800',
      urgente: 'bg-red-100 text-red-800'
    };
    return cores[tipo] || 'bg-slate-100 text-slate-800';
  };

  const abrirWhatsApp = () => {
    if (!membro?.telefone) {
      setMensagem('Membro não possui telefone cadastrado');
      return;
    }
    const numeroLimpo = membro.telefone.replace(/\D/g, '');
    const mensagem = `Olá ${membro.nome}! Que a paz do Senhor esteja contigo!`;
    window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const ligarPara = () => {
    if (!membro?.telefone) {
      setMensagem('Membro não possui telefone cadastrado');
      return;
    }
    window.location.href = `tel:${membro.telefone}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
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
          <button
            onClick={() => router.push('/admin/membros')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Voltar para lista de membros
          </button>
        </div>
      </div>
    );
  }

  const idade = calcularIdade(membro.data_nascimento);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/membros')}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <User className="w-8 h-8 text-blue-600" />
                {membro.nome}
              </h1>
              <p className="text-slate-600 mt-1">
                Informações completas e acompanhamento pastoral
              </p>
            </div>
          </div>
          
          {!modoEdicao && (
            <button
              onClick={() => setModoEdicao(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
          )}
        </div>

        {/* Mensagem */}
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg ${
            mensagem.includes('sucesso') ? 'bg-green-50 text-green-800 border border-green-200' :
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

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ações Rápidas */}
            {!modoEdicao && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Ações Rápidas</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <button
                    onClick={abrirWhatsApp}
                    disabled={!membro.telefone}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </button>
                  <button
                    onClick={ligarPara}
                    disabled={!membro.telefone}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Phone className="w-5 h-5" />
                    Ligar
                  </button>
                  <button
                    onClick={() => setModalNotaAberto(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Nova Nota
                  </button>
                </div>
              </div>
            )}

            {/* Formulário de Edição */}
            {modoEdicao ? (
              <form onSubmit={salvarAlteracoes} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Editar Informações Pastorais</h3>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-800">
                    <strong>ℹ️ Nota:</strong> Para editar <strong>email, cargo ou habilidades</strong>, use a página <strong>/admin/usuarios</strong>
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={telefone}
                        onChange={(e) => setTelefone(formatPhoneNumber(e.target.value))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Data de Casamento
                      </label>
                      <input
                        type="date"
                        value={dataCasamento}
                        onChange={(e) => setDataCasamento(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Data de Batismo
                      </label>
                      <input
                        type="date"
                        value={dataBatismo}
                        onChange={(e) => setDataBatismo(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Status do Membro
                    </label>
                    <select
                      value={statusMembro}
                      onChange={(e) => setStatusMembro(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="visitante">Visitante</option>
                      <option value="congregado">Congregado</option>
                      <option value="afastado">Afastado</option>
                      <option value="falecido">Falecido</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Rua, número, bairro, cidade"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Situação de Saúde
                    </label>
                    <textarea
                      value={situacaoSaude}
                      onChange={(e) => setSituacaoSaude(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Informações relevantes sobre saúde..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Observações Gerais
                    </label>
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Informações importantes sobre o membro..."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {salvando ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoEdicao(false);
                      carregarMembro();
                    }}
                    className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              /* Visualização de Informações */
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Informações Pessoais</h3>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  {membro.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Email</p>
                        <p className="text-sm text-slate-900 font-medium">{membro.email}</p>
                      </div>
                    </div>
                  )}
                  
                  {membro.telefone && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Telefone</p>
                        <p className="text-sm text-slate-900 font-medium">{formatPhoneNumber(membro.telefone)}</p>
                      </div>
                    </div>
                  )}
                  
                  {membro.data_nascimento && (
                    <div className="flex items-start gap-3">
                      <Cake className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Nascimento</p>
                        <p className="text-sm text-slate-900 font-medium">
                          {formatarData(membro.data_nascimento)} ({idade} anos)
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {membro.data_casamento && (
                    <div className="flex items-start gap-3">
                      <Heart className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Casamento</p>
                        <p className="text-sm text-slate-900 font-medium">{formatarData(membro.data_casamento)}</p>
                      </div>
                    </div>
                  )}
                  
                  {membro.data_batismo && (
                    <div className="flex items-start gap-3">
                      <Church className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Batismo</p>
                        <p className="text-sm text-slate-900 font-medium">{formatarData(membro.data_batismo)}</p>
                      </div>
                    </div>
                  )}
                  
                  {membro.endereco_completo && (
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Endereço</p>
                        <p className="text-sm text-slate-900 font-medium">{membro.endereco_completo}</p>
                      </div>
                    </div>
                  )}
                </div>

                {membro.situacao_saude && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
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
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900 mb-1">Observações</p>
                        <p className="text-sm text-amber-800 whitespace-pre-line">{membro.observacoes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline de Notas Pastorais */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                  Histórico de Acompanhamento
                </h3>
                <button
                  onClick={() => setModalNotaAberto(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Nova Nota
                </button>
              </div>

              {notas.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Nenhuma nota de acompanhamento ainda</p>
                  <p className="text-xs mt-1">Clique em "Nova Nota" para começar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notas.map((nota) => (
                    <div key={nota.id} className="border-l-4 border-purple-400 pl-4 py-2">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getTipoNotaCor(nota.tipo)}`}>
                            {getTipoNotaLabel(nota.tipo)}
                          </span>
                          {nota.privado && (
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                              Privado
                            </span>
                          )}
                          {nota.titulo && (
                            <span className="text-sm font-semibold text-slate-900">{nota.titulo}</span>
                          )}
                        </div>
                        {(permissoes.isSuperAdmin || ['admin', 'pastor'].includes(usuarioPermitido?.cargo || '')) && (
                          <button
                            onClick={() => deletarNota(nota.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-700 whitespace-pre-line mb-2">{nota.conteudo}</p>
                      
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {nota.autor.nome}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatarDataHora(nota.criado_em)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Card de Status */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tipo</p>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${getCargoCor(membro.cargo as CargoTipo)}`}>
                    {getCargoLabel(membro.cargo as CargoTipo)}
                  </span>
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
                    {membro.status_membro === 'ativo' ? 'Ativo' :
                     membro.status_membro === 'visitante' ? 'Visitante' :
                     membro.status_membro === 'congregado' ? 'Congregado' :
                     membro.status_membro === 'afastado' ? 'Afastado' : 'Falecido'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Cadastro</p>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${
                    membro.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {membro.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card de Estatísticas */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Estatísticas</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total de Notas</span>
                  <span className="text-lg font-bold text-slate-900">{notas.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Visitas</span>
                  <span className="text-lg font-bold text-blue-600">
                    {notas.filter(n => n.tipo === 'visita').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Ligações</span>
                  <span className="text-lg font-bold text-green-600">
                    {notas.filter(n => n.tipo === 'ligacao').length}
                  </span>
                </div>
              </div>
            </div>
                <RelacionamentosCard
                  membroId={membroId}
                  membroNome={membro.nome}
                  autorId={usuarioPermitido?.id}
                  podeEditar={
                    permissoes.isSuperAdmin ||
                    ['admin', 'pastor', 'presbitero'].includes(usuarioPermitido?.cargo || '')
                  }
                  onNavegar={(id) => router.push(`/admin/membros/${id}`)}
                />
          </div>
        </div>
      </main>

      {/* Modal para Nova Nota */}
      {modalNotaAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Nova Nota de Acompanhamento</h3>
              <button
                onClick={() => {
                  setModalNotaAberto(false);
                  setTituloNota('');
                  setConteudoNota('');
                  setTipoNota('nota');
                  setNotaPrivada(false);
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <span className="text-slate-500">✕</span>
              </button>
            </div>

            <form onSubmit={adicionarNota} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Nota *
                  </label>
                  <select
                    value={tipoNota}
                    onChange={(e) => setTipoNota(e.target.value as TipoNota)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="nota">Nota Geral</option>
                    <option value="visita">Visita Domiciliar</option>
                    <option value="ligacao">Ligação Telefônica</option>
                    <option value="oracao">Pedido de Oração</option>
                    <option value="aconselhamento">Aconselhamento</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Título (opcional)
                  </label>
                  <input
                    type="text"
                    value={tituloNota}
                    onChange={(e) => setTituloNota(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Visita de acompanhamento"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Conteúdo da Nota *
                </label>
                <textarea
                  value={conteudoNota}
                  onChange={(e) => setConteudoNota(e.target.value)}
                  required
                  rows={6}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Descreva o acompanhamento, observações, pedidos de oração..."
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notaPrivada}
                    onChange={(e) => setNotaPrivada(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700">Nota privada (apenas pastor e liderança podem ver)</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-all font-medium"
                >
                  Salvar Nota
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalNotaAberto(false);
                    setTituloNota('');
                    setConteudoNota('');
                    setTipoNota('nota');
                    setNotaPrivada(false);
                  }}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}