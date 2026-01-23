'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';

interface Escala {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo_culto: string;
  observacoes: string | null;
  status: 'rascunho' | 'publicada' | 'concluida';
  criado_em: string;
  culto_id: number | null;
  funcoes?: EscalaFuncao[];
}

interface EscalaFuncao {
  id: string;
  tag_id: string;
  usuario_id: string;
  ordem: number;
  confirmado: boolean;
  tag: {
    nome: string;
    categoria: string;
    cor: string;
  };
  usuario: {
    nome: string;
    email: string;
  };
}

interface Culto {
  'Culto nr.': number;
  'Dia': string;
}

export default function EscalasPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();
  
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  
  // Filtros
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // Gerar lista de meses
  const gerarOpcoesDeMs = () => {
    const opcoes = [];
    const hoje = new Date();
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    for (let i = -12; i <= 6; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const valor = `${ano}-${mes}`;
      const label = `${mesesNomes[data.getMonth()]}/${ano}`;
      
      opcoes.push({ valor, label });
    }
    
    return opcoes;
  };

  const mesesDisponiveis = gerarOpcoesDeMs();
  
  // Modal de criação/edição
  const [modalAberto, setModalAberto] = useState(false);
  const [escalaEditando, setEscalaEditando] = useState<Escala | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  // Dados do formulário
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoCulto, setTipoCulto] = useState('dominical_manha');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState<'rascunho' | 'publicada' | 'concluida'>('rascunho');
  
  // 🎯 Gerenciamento de cultos
  const [cultosDisponiveis, setCultosDisponiveis] = useState<Culto[]>([]);
  const [cultoSelecionado, setCultoSelecionado] = useState<number | null>(null);
  const [criarNovoCulto, setcriarNovoCulto] = useState(true);
  const [buscandoCultos, setBuscandoCultos] = useState(false);

  const totalLoading = authLoading || permLoading;

  useEffect(() => {
    if (!totalLoading && !user) {
      router.push('/login');
      return;
    }

    if (!totalLoading && user && !permissoes.podeGerenciarEscalas) {
      router.push('/admin');
    }
  }, [user, totalLoading, permissoes.podeGerenciarEscalas, router]);

  useEffect(() => {
    if (user && permissoes.podeGerenciarEscalas) {
      carregarEscalas();
    }
  }, [user, permissoes.podeGerenciarEscalas, filtroMes, filtroStatus, filtroTipo]);

  // 🔍 Buscar cultos quando a data mudar
  useEffect(() => {
    if (data && modalAberto) {
      buscarCultosNaData();
    }
  }, [data, modalAberto]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const carregarEscalas = async () => {
    try {
      setLoading(true);
      
      const [ano, mes] = filtroMes.split('-');
      const primeiroDia = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const ultimoDiaFormatado = `${ano}-${mes}-${ultimoDia}`;

      let query = supabase
        .from('escalas')
        .select('*')
        .gte('data', primeiroDia)
        .lte('data', ultimoDiaFormatado)
        .order('data', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (filtroStatus !== 'todas') {
        query = query.eq('status', filtroStatus);
      }

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo_culto', filtroTipo);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEscalas(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar escalas:', error);
      setMensagem('❌ Erro ao carregar escalas');
    } finally {
      setLoading(false);
    }
  };

  // 🎯 Buscar cultos existentes na data selecionada
  const buscarCultosNaData = async () => {
    if (!data) return;
    
    setBuscandoCultos(true);
    try {
      const { data: cultos, error } = await supabase
        .from('Louvores IPPN')
        .select('*')
        .eq('Dia', data)
        .order('Culto nr.', { ascending: false });

      if (error) throw error;

      setCultosDisponiveis(cultos || []);
      
      // Se encontrou cultos, sugerir vincular ao existente
      if (cultos && cultos.length > 0) {
        setcriarNovoCulto(false);
        setCultoSelecionado(cultos[0]['Culto nr.']);
      } else {
        setcriarNovoCulto(true);
        setCultoSelecionado(null);
      }
    } catch (error) {
      console.error('Erro ao buscar cultos:', error);
    } finally {
      setBuscandoCultos(false);
    }
  };

  // 🎯 Criar novo culto em "Louvores IPPN"
  const criarCultoAutomaticamente = async (dataEscala: string): Promise<number | null> => {
    try {
      const { data, error } = await supabase
        .from('Louvores IPPN')
        .insert({
          Dia: dataEscala
        })
        .select()
        .single();

      if (error) throw error;
      return data['Culto nr.'];
    } catch (error) {
      console.error('Erro ao criar culto:', error);
      return null;
    }
  };

  const abrirModalNova = () => {
    setEscalaEditando(null);
    setTitulo('');
    setData('');
    setHoraInicio('');
    setHoraFim('');
    setTipoCulto('dominical_manha');
    setObservacoes('');
    setStatus('rascunho');
    setCultosDisponiveis([]);
    setCultoSelecionado(null);
    setcriarNovoCulto(true);
    setModalAberto(true);
  };

  const abrirModalEdicao = (escala: Escala) => {
    setEscalaEditando(escala);
    setTitulo(escala.titulo);
    setData(escala.data);
    setHoraInicio(escala.hora_inicio);
    setHoraFim(escala.hora_fim || '');
    setTipoCulto(escala.tipo_culto);
    setObservacoes(escala.observacoes || '');
    setStatus(escala.status);
    setCultoSelecionado(escala.culto_id);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEscalaEditando(null);
  };

  const salvarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      let cultoIdFinal = cultoSelecionado;

      // 🎯 Se marcou para criar novo culto, cria agora
      if (criarNovoCulto) {
        const novoCultoId = await criarCultoAutomaticamente(data);
        if (!novoCultoId) {
          throw new Error('Falha ao criar culto automaticamente');
        }
        cultoIdFinal = novoCultoId;
      }

      const dados = {
        titulo,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim || null,
        tipo_culto: tipoCulto,
        observacoes: observacoes || null,
        status,
        culto_id: cultoIdFinal,
        criado_por: user?.id,
        atualizado_em: new Date().toISOString()
      };

      if (escalaEditando) {
        // Atualizar
        const { error } = await supabase
          .from('escalas')
          .update(dados)
          .eq('id', escalaEditando.id);

        if (error) throw error;
        setMensagem(cultoIdFinal 
          ? '✅ Escala atualizada e vinculada ao culto!'
          : '✅ Escala atualizada com sucesso!');
      } else {
        // Criar nova
        const { error } = await supabase
          .from('escalas')
          .insert(dados);

        if (error) throw error;
        setMensagem(cultoIdFinal 
          ? `✅ Escala criada e vinculada ao Culto #${cultoIdFinal}!`
          : '✅ Escala criada com sucesso!');
      }

      fecharModal();
      carregarEscalas();
    } catch (error: any) {
      console.error('Erro ao salvar escala:', error);
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const deletarEscala = async (id: string, titulo: string) => {
    if (!confirm(`Tem certeza que deseja DELETAR a escala "${titulo}"?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('escalas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMensagem('🗑️ Escala deletada com sucesso');
      carregarEscalas();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const alterarStatus = async (id: string, novoStatus: 'rascunho' | 'publicada' | 'concluida') => {
    try {
      const { error } = await supabase
        .from('escalas')
        .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setMensagem(`✅ Status alterado para "${novoStatus}"`);
      carregarEscalas();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    const cores = {
      rascunho: 'bg-gray-100 text-gray-800',
      publicada: 'bg-blue-100 text-blue-800',
      concluida: 'bg-green-100 text-green-800'
    };
    return cores[status as keyof typeof cores] || cores.rascunho;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      rascunho: '📝',
      publicada: '✅',
      concluida: '🎉'
    };
    return icons[status as keyof typeof icons] || '📝';
  };

  const getTipoCultoLabel = (tipo: string) => {
    const labels = {
      dominical_manha: 'Dominical - Manhã',
      dominical_noite: 'Dominical - Noite',
      quarta: 'Quarta-feira',
      especial: 'Culto Especial'
    };
    return labels[tipo as keyof typeof labels] || tipo;
  };

  if (totalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user || !permissoes.podeGerenciarEscalas) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Mensagem */}
          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              mensagem.includes('⚠️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {mensagem}
            </div>
          )}

          {/* Filtros e Botão Criar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mês</label>
                  <select
                    value={filtroMes}
                    onChange={(e) => setFiltroMes(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none min-w-[160px]"
                  >
                    {mesesDisponiveis.map(opcao => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                  >
                    <option value="todas">Todas</option>
                    <option value="rascunho">Rascunho</option>
                    <option value="publicada">Publicada</option>
                    <option value="concluida">Concluída</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                  >
                    <option value="todos">Todos</option>
                    <option value="dominical_manha">Dominical - Manhã</option>
                    <option value="dominical_noite">Dominical - Noite</option>
                    <option value="quarta">Quarta-feira</option>
                    <option value="especial">Especial</option>
                  </select>
                </div>
              </div>

              {/* Botão Criar Nova */}
              <button
                onClick={abrirModalNova}
                className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium flex items-center gap-2 whitespace-nowrap"
              >
                <span className="text-lg">➕</span>
                Criar Nova Escala
              </button>
            </div>
          </div>

          {/* Lista de Escalas */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
              </div>
            ) : escalas.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-300">
                <p className="text-slate-500 text-lg mb-2">📅 Nenhuma escala encontrada</p>
                <p className="text-slate-400 text-sm mb-4">Comece criando uma nova escala para este mês</p>
                <button
                  onClick={abrirModalNova}
                  className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-all text-sm font-medium"
                >
                  Criar Primeira Escala
                </button>
              </div>
            ) : (
              escalas.map((escala) => (
                <div
                  key={escala.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Header do Card */}
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold text-lg truncate">
                        {escala.titulo}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(escala.status)}`}>
                        {getStatusIcon(escala.status)} {escala.status}
                      </span>
                    </div>
                  </div>

                  {/* Corpo do Card */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-lg">📅</span>
                      <span className="font-medium">
                        {new Date(escala.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-lg">🕐</span>
                      <span>
                        {escala.hora_inicio}
                        {escala.hora_fim && ` - ${escala.hora_fim}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-lg">⛪</span>
                      <span>{getTipoCultoLabel(escala.tipo_culto)}</span>
                    </div>

                    {/* 🎯 Mostrar vínculo com culto */}
                    {escala.culto_id && (
                      <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <span className="text-lg">🎵</span>
                        <span className="font-medium text-amber-900">
                          Culto #{escala.culto_id}
                        </span>
                      </div>
                    )}

                    {escala.observacoes && (
                      <div className="text-xs text-slate-600 bg-slate-50 rounded p-2">
                        💬 {escala.observacoes}
                      </div>
                    )}
                  </div>

                  {/* Footer do Card - Ações */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/admin/escalas/${escala.id}`)}
                      className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                    >
                      👥 Gerenciar
                    </button>
                    <button
                      onClick={() => abrirModalEdicao(escala)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded text-sm font-medium hover:bg-slate-300 transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deletarEscala(escala.id, escala.titulo)}
                      className="px-3 py-1.5 bg-red-100 text-red-800 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modal de Criar/Editar Escala */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {escalaEditando ? '✏️ Editar Escala' : '➕ Nova Escala'}
              </h3>
              <button
                onClick={fecharModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                disabled={salvando}
              >
                <span className="text-slate-500">✕</span>
              </button>
            </div>

            <form onSubmit={salvarEscala} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Título da Escala *
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                  placeholder="Ex: Culto Dominical - 25 de Janeiro"
                  disabled={salvando}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    disabled={salvando}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Culto *
                  </label>
                  <select
                    value={tipoCulto}
                    onChange={(e) => setTipoCulto(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    disabled={salvando}
                  >
                    <option value="dominical_manha">Dominical - Manhã</option>
                    <option value="dominical_noite">Dominical - Noite</option>
                    <option value="quarta">Quarta-feira</option>
                    <option value="especial">Culto Especial</option>
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Hora Início *
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    disabled={salvando}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Hora Fim <span className="text-xs text-slate-500">(opcional)</span>
                  </label>
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    disabled={salvando}
                  />
                </div>
              </div>

              {/* 🎯 Seção de Vínculo com Culto */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  🎵 Vínculo com Programação Musical
                </label>

                {buscandoCultos ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-700 mx-auto"></div>
                    <p className="text-xs text-slate-500 mt-2">Buscando cultos...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Opção: Criar novo culto */}
                    <label className="flex items-start gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="radio"
                        name="opcaoCulto"
                        checked={criarNovoCulto}
                        onChange={() => {
                          setcriarNovoCulto(true);
                          setCultoSelecionado(null);
                        }}
                        disabled={salvando}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">✨ Criar novo culto automaticamente</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Um novo registro será criado em "Louvores IPPN" para esta data
                        </p>
                      </div>
                    </label>

                    {/* Opção: Vincular a culto existente */}
                    {cultosDisponiveis.length > 0 && (
                      <label className="flex items-start gap-3 p-3 border-2 border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors">
                        <input
                          type="radio"
                          name="opcaoCulto"
                          checked={!criarNovoCulto}
                          onChange={() => {
                            setcriarNovoCulto(false);
                            if (cultosDisponiveis.length > 0) {
                              setCultoSelecionado(cultosDisponiveis[0]['Culto nr.']);
                            }
                          }}
                          disabled={salvando}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-emerald-900">
                            🔗 Vincular a culto existente ({cultosDisponiveis.length} encontrado{cultosDisponiveis.length > 1 ? 's' : ''})
                          </p>
                          {!criarNovoCulto && (
                            <select
                              value={cultoSelecionado || ''}
                              onChange={(e) => setCultoSelecionado(Number(e.target.value))}
                              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded text-sm"
                              disabled={salvando}
                            >
                              {cultosDisponiveis.map(culto => (
                                <option key={culto['Culto nr.']} value={culto['Culto nr.']}>
                                  Culto #{culto['Culto nr.']} - {new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </label>
                    )}

                    {cultosDisponiveis.length === 0 && data && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-900">
                          ℹ️ Nenhum culto encontrado para esta data. Um novo será criado automaticamente.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                  disabled={salvando}
                >
                  <option value="rascunho">📝 Rascunho (não visível)</option>
                  <option value="publicada">✅ Publicada (visível para todos)</option>
                  <option value="concluida">🎉 Concluída</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observações <span className="text-xs text-slate-500">(opcional)</span>
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none resize-none"
                  placeholder="Anotações, instruções especiais, etc..."
                  disabled={salvando}
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {salvando ? 'Salvando...' : escalaEditando ? 'Salvar Alterações' : 'Criar Escala'}
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
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