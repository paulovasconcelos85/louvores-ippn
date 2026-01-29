'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { CargoTipo, getCargoLabel, getCargoCor } from '@/lib/permissions';
import { formatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';
import { 
  Users, Phone, MapPin, Calendar, Heart, AlertCircle, 
  MessageSquare, Search, Filter, Cake, Church, UserX,
  Mail
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
}

type FiltroAniversario = 'todos' | 'hoje' | 'mes' | 'proximos7dias';
type FiltroStatus = 'todos' | 'ativo' | 'afastado' | 'visitante' | 'congregado' | 'falecido';

export default function PastorarMembrosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroAniversario, setFiltroAniversario] = useState<FiltroAniversario>('todos');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('ativo');
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const totalLoading = authLoading || permLoading;

  const podeAcessar = permissoes.isSuperAdmin || 
    ['admin', 'pastor', 'presbitero', 'seminarista'].includes(usuarioPermitido?.cargo || '');

  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }

    if (!totalLoading && user && !podeAcessar) {
      router.push('/admin');
    }
  }, [user, totalLoading, podeAcessar, router]);

  useEffect(() => {
    if (user && podeAcessar) {
      carregarMembros();
    }
  }, [user, podeAcessar]);

  const carregarMembros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pessoas')
        .select('*')
        .order('nome');

      if (error) throw error;
      setMembros(data || []);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      setMensagem('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  // Funções de utilidade
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

  const ehAniversarioHoje = (dataNascimento: string | null): boolean => {
    if (!dataNascimento) return false;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    return hoje.getMonth() === nascimento.getMonth() && 
           hoje.getDate() === nascimento.getDate();
  };

  const ehAniversarioNesteMes = (dataNascimento: string | null): boolean => {
    if (!dataNascimento) return false;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    return hoje.getMonth() === nascimento.getMonth();
  };

  const ehAniversarioProximos7Dias = (dataNascimento: string | null): boolean => {
    if (!dataNascimento) return false;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    const proximos7Dias = new Date();
    proximos7Dias.setDate(proximos7Dias.getDate() + 7);

    const aniversarioEsteAno = new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate());
    
    return aniversarioEsteAno >= hoje && aniversarioEsteAno <= proximos7Dias;
  };

  const formatarData = (data: string | null): string => {
    if (!data) return '-';
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      ativo: 'Ativo',
      afastado: 'Afastado',
      falecido: 'Falecido',
      visitante: 'Visitante',
      congregado: 'Congregado'
    };
    return labels[status] || status;
  };

  const getStatusCor = (status: string): string => {
    const cores: Record<string, string> = {
      ativo: 'bg-green-100 text-green-800 border-green-300',
      afastado: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      falecido: 'bg-gray-100 text-gray-800 border-gray-300',
      visitante: 'bg-blue-100 text-blue-800 border-blue-300',
      congregado: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    return cores[status] || 'bg-slate-100 text-slate-800 border-slate-300';
  };

  // Filtros
  const membrosFiltrados = membros.filter(m => {
    if (!mostrarInativos && !m.ativo) return false;
    if (filtroStatus !== 'todos' && m.status_membro !== filtroStatus) return false;
    if (filtroAniversario === 'hoje' && !ehAniversarioHoje(m.data_nascimento)) return false;
    if (filtroAniversario === 'mes' && !ehAniversarioNesteMes(m.data_nascimento)) return false;
    if (filtroAniversario === 'proximos7dias' && !ehAniversarioProximos7Dias(m.data_nascimento)) return false;

    if (filtroTexto === '') return true;
    const busca = filtroTexto.toLowerCase();
    return (
      m.nome.toLowerCase().includes(busca) ||
      (m.email && m.email.toLowerCase().includes(busca)) ||
      (m.telefone && formatPhoneNumber(m.telefone).includes(busca)) ||
      (m.endereco_completo && m.endereco_completo.toLowerCase().includes(busca))
    );
  });

  const aniversariantesHoje = membros.filter(m => 
    m.ativo && m.status_membro === 'ativo' && ehAniversarioHoje(m.data_nascimento)
  );

  const abrirWhatsApp = (telefone: string | null, nome: string) => {
    if (!telefone) {
      setMensagem('Este membro não possui telefone cadastrado');
      return;
    }
    const numeroLimpo = telefone.replace(/\D/g, '');
    const mensagem = `Olá ${nome}! Que a paz do Senhor esteja contigo!`;
    window.open(`https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  const ligarPara = (telefone: string | null) => {
    if (!telefone) {
      setMensagem('Este membro não possui telefone cadastrado');
      return;
    }
    window.location.href = `tel:${telefone}`;
  };

  if (totalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user || !podeAcessar) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Pastorear Membros
            </h1>
            <p className="text-slate-600 mt-1">
              Acompanhamento e cuidado pastoral da igreja
            </p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors font-medium"
          >
            ← Voltar
          </button>
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

        {/* Aniversariantes de Hoje */}
        {aniversariantesHoje.length > 0 && (
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-300 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Cake className="w-8 h-8 text-pink-600" />
              <div>
                <h3 className="text-xl font-bold text-pink-900">
                  Aniversariantes de Hoje
                </h3>
                <p className="text-sm text-pink-700">
                  Não esqueça de parabenizar
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {aniversariantesHoje.map(membro => (
                <div
                  key={membro.id}
                  className="bg-white rounded-lg p-4 border-2 border-pink-200 hover:border-pink-400 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/membros/${membro.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{membro.nome}</p>
                      <p className="text-sm text-slate-600">
                        {calcularIdade(membro.data_nascimento)} anos
                      </p>
                    </div>
                    <Cake className="w-6 h-6 text-pink-500" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirWhatsApp(membro.telefone, membro.nome);
                      }}
                      className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      WhatsApp
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        ligarPara(membro.telefone);
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total
            </p>
            <p className="text-2xl font-bold text-slate-900">{membros.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <p className="text-sm text-green-600 flex items-center gap-2">
              <Church className="w-4 h-4" />
              Ativos
            </p>
            <p className="text-2xl font-bold text-green-900">
              {membros.filter(m => m.status_membro === 'ativo').length}
            </p>
          </div>
          <div className="bg-pink-50 rounded-lg border border-pink-200 p-4">
            <p className="text-sm text-pink-600 flex items-center gap-2">
              <Cake className="w-4 h-4" />
              Aniver. Hoje
            </p>
            <p className="text-2xl font-bold text-pink-900">{aniversariantesHoje.length}</p>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-sm text-blue-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Este Mês
            </p>
            <p className="text-2xl font-bold text-blue-900">
              {membros.filter(m => ehAniversarioNesteMes(m.data_nascimento)).length}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            Filtros
          </h3>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, email, telefone ou endereço..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <select
                value={filtroAniversario}
                onChange={(e) => setFiltroAniversario(e.target.value as FiltroAniversario)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos os Aniversários</option>
                <option value="hoje">Hoje</option>
                <option value="proximos7dias">Próximos 7 dias</option>
                <option value="mes">Este mês</option>
              </select>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Ativos</option>
                <option value="visitante">Visitantes</option>
                <option value="congregado">Congregados</option>
                <option value="afastado">Afastados</option>
                <option value="falecido">Falecidos</option>
              </select>

              <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={mostrarInativos}
                  onChange={(e) => setMostrarInativos(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 font-medium whitespace-nowrap">
                  Mostrar inativos
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Lista de Membros */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6" />
              Membros
              <span className="ml-2 text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
                {membrosFiltrados.length}
              </span>
            </h3>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto"></div>
                <p className="mt-2 text-slate-600">Carregando membros...</p>
              </div>
            ) : membrosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                <p>Nenhum membro encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {membrosFiltrados.map(membro => {
                  const idade = calcularIdade(membro.data_nascimento);
                  const ehMembro = membro.cargo === 'membro';
                  const temAlerta = membro.situacao_saude || membro.observacoes || ehAniversarioProximos7Dias(membro.data_nascimento);

                  return (
                    <div
                      key={membro.id}
                      onClick={() => router.push(`/admin/membros/${membro.id}`)}
                      className={`border-2 rounded-lg p-4 transition-all hover:shadow-md cursor-pointer ${
                        !membro.ativo ? 'opacity-60' :
                        ehAniversarioHoje(membro.data_nascimento) ? 'border-pink-300 bg-pink-50' :
                        temAlerta ? 'border-amber-300 bg-amber-50/30' :
                        'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Nome e Status */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="text-lg font-bold text-slate-900">{membro.nome}</h4>
                            
                            {ehAniversarioHoje(membro.data_nascimento) && (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-pink-100 text-pink-800 border border-pink-300 flex items-center gap-1">
                                <Cake className="w-3 h-3" />
                                Aniversário
                              </span>
                            )}
                            
                            {!ehMembro && (
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getCargoCor(membro.cargo as CargoTipo)}`}>
                                {getCargoLabel(membro.cargo as CargoTipo)}
                              </span>
                            )}
                            
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusCor(membro.status_membro)}`}>
                              {getStatusLabel(membro.status_membro)}
                            </span>
                          </div>

                          {/* Alertas Prioritários */}
                          {temAlerta && (
                            <div className="mb-3 space-y-2">
                              {ehAniversarioProximos7Dias(membro.data_nascimento) && !ehAniversarioHoje(membro.data_nascimento) && (
                                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                                  <Cake className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm text-blue-800">
                                    Aniversário próximo: {formatarData(membro.data_nascimento)}
                                  </span>
                                </div>
                              )}
                              
                              {membro.situacao_saude && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
                                  <Heart className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-red-900">Saúde:</p>
                                    <p className="text-sm text-red-800 line-clamp-2">{membro.situacao_saude}</p>
                                  </div>
                                </div>
                              )}
                              
                              {membro.observacoes && (
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-amber-900">Observações:</p>
                                    <p className="text-sm text-amber-800 line-clamp-2">{membro.observacoes}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Informações Básicas */}
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-slate-600">
                            {membro.data_nascimento && (
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span>{formatarData(membro.data_nascimento)} ({idade} anos)</span>
                              </div>
                            )}
                            {membro.telefone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span>{formatPhoneNumber(membro.telefone)}</span>
                              </div>
                            )}
                            {membro.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="truncate">{membro.email}</span>
                              </div>
                            )}
                            {membro.endereco_completo && (
                              <div className="flex items-center gap-2 sm:col-span-2">
                                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{membro.endereco_completo}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirWhatsApp(membro.telefone, membro.nome);
                            }}
                            disabled={!membro.telefone}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap flex items-center gap-2 justify-center"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            WhatsApp
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              ligarPara(membro.telefone);
                            }}
                            disabled={!membro.telefone}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2 justify-center"
                          >
                            <Phone className="w-4 h-4" />
                            Ligar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/membros/${membro.id}`);
                            }}
                            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
                          >
                            Ver Detalhes
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