'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import {
  Calendar,
  Clock,
  Church,
  Music,
  Users,
  Plus,
  Edit2,
  Trash2,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Filter,
  ChevronDown,
  Loader2,
  PartyPopper,
  MessageCircle,
  Link as LinkIcon,
  Image as ImageIcon,
  Download
} from 'lucide-react';

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
  escalas_funcoes?: EscalaFuncao[];
}

interface EscalaFuncao {
  id: string;
  ordem: number;
  confirmado: boolean;
  tags_funcoes: {
    nome: string;
    categoria: string;
    cor: string;
  };
  pessoas: {
    nome: string;
    email: string;
  };
}

interface Culto {
  'Culto nr.': number;
  'Dia': string;
}

// 🎵 CATEGORIAS APENAS PARA LOUVOR E TÉCNICA
const CATEGORIAS_MUSICAIS = {
  'louvor_lideranca': { nome: '🎤 Ministração', ordem: 1 },
  'louvor_vocal': { nome: '🎵 Vocais', ordem: 2 },
  'louvor_instrumento': { nome: '🎸 Instrumentos', ordem: 3 },
  'tecnico_audio': { nome: '🎛️ Mesa/Áudio', ordem: 4 },
  'tecnico_video': { nome: '📽️ Mídia/Slideshow', ordem: 5 },
};

export default function EscalasPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: permLoading, permissoes, usuarioPermitido } = usePermissions();
  
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  
  const [filtroPeriodo, setFiltroPeriodo] = useState<'30dias' | '3meses' | 'todos'>('30dias');
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  
  const [modalAberto, setModalAberto] = useState(false);
  const [escalaEditando, setEscalaEditando] = useState<Escala | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregandoModal, setCarregandoModal] = useState(false);
  
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoCulto, setTipoCulto] = useState('dominical_manha');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState<'rascunho' | 'publicada' | 'concluida'>('rascunho');
  
  const [cultosDisponiveis, setCultosDisponiveis] = useState<Culto[]>([]);
  const [cultoSelecionado, setCultoSelecionado] = useState<number | null>(null);
  const [criarNovoCulto, setcriarNovoCulto] = useState(true);
  const [buscandoCultos, setBuscandoCultos] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const totalLoading = authLoading || permLoading;

  const encontrarProximoDomingoDisponivel = async (): Promise<string> => {
    try {
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      
      const diaDaSemana = hoje.getDay();
      const diasAteProximoDomingo = diaDaSemana === 0 ? 7 : (7 - diaDaSemana);
      
      const datasParaVerificar: string[] = [];
      
      for (let i = 0; i < 8; i++) {
        const domingo = new Date(hoje);
        domingo.setDate(hoje.getDate() + diasAteProximoDomingo + (i * 7));
        datasParaVerificar.push(domingo.toISOString().split('T')[0]);
      }

      const { data: escalasExistentes, error } = await supabase
        .from('escalas')
        .select('data')
        .in('data', datasParaVerificar)
        .eq('tipo_culto', 'dominical_manha');

      if (error) throw error;

      const datasComEscala = new Set(escalasExistentes?.map(e => e.data) || []);
      const domingoDisponivel = datasParaVerificar.find(data => !datasComEscala.has(data));
      
      return domingoDisponivel || datasParaVerificar[0];
    } catch (error) {
      const hoje = new Date();
      const diaDaSemana = hoje.getDay();
      const diasAteProximoDomingo = diaDaSemana === 0 ? 7 : (7 - diaDaSemana);
      hoje.setDate(hoje.getDate() + diasAteProximoDomingo);
      return hoje.toISOString().split('T')[0];
    }
  };

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
  }, [user, permissoes.podeGerenciarEscalas, filtroPeriodo, filtroStatus, filtroTipo]);

  useEffect(() => {
    if (data && modalAberto) {
      buscarCultosNaData();
    }
  }, [data, modalAberto]);

  const carregarEscalas = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('escalas')
        .select(`
          *,
          escalas_funcoes (
            id,
            ordem,
            confirmado,
            tags_funcoes (
              nome,
              categoria,
              cor
            ),
            pessoas (
              nome,
              email
            )
          )
        `)
        .order('data', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .order('ordem', { foreignTable: 'escalas_funcoes', ascending: true });

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataHoje = hoje.toISOString().split('T')[0];

      if (filtroPeriodo === '30dias') {
        const dataFim = new Date(hoje);
        dataFim.setDate(dataFim.getDate() + 30);
        const dataFimStr = dataFim.toISOString().split('T')[0];
        
        query = query.gte('data', dataHoje).lte('data', dataFimStr);
      } else if (filtroPeriodo === '3meses') {
        const dataFim = new Date(hoje);
        dataFim.setMonth(dataFim.getMonth() + 3);
        const dataFimStr = dataFim.toISOString().split('T')[0];
        
        query = query.gte('data', dataHoje).lte('data', dataFimStr);
      }

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
      setMensagem('Erro ao carregar escalas');
    } finally {
      setLoading(false);
    }
  };

  const buscarCultosNaData = async () => {
    if (!data) return;
    
    setBuscandoCultos(true);
    setDebugInfo(`Buscando cultos para: ${data}`);
    
    try {
      const { data: cultos, error } = await supabase
        .from('Louvores IPPN')
        .select('*')
        .eq('Dia', data);

      if (error) {
        console.error('Erro:', error);
        setDebugInfo(`${error.message}`);
        setcriarNovoCulto(true);
        setCultoSelecionado(null);
        setBuscandoCultos(false);
        return;
      }

      const cultosOrdenados = cultos?.sort((a, b) => b['Culto nr.'] - a['Culto nr.']) || [];

      setCultosDisponiveis(cultosOrdenados);
      
      if (cultosOrdenados.length > 0) {
        setcriarNovoCulto(false);
        setCultoSelecionado(cultosOrdenados[0]['Culto nr.']);
        setDebugInfo(`Culto #${cultosOrdenados[0]['Culto nr.']} encontrado - será usado`);
      } else {
        setcriarNovoCulto(true);
        setCultoSelecionado(null);
        setDebugInfo(`Nenhum culto encontrado - novo será criado`);
      }
    } catch (error: any) {
      console.error('Erro:', error);
      setDebugInfo(`${error?.message || 'Erro'}`);
      setcriarNovoCulto(true);
      setCultoSelecionado(null);
    } finally {
      setBuscandoCultos(false);
    }
  };

  const criarCultoAutomaticamente = async (dataEscala: string): Promise<number | null> => {
    try {
      const { data: novoCulto, error: errorCulto } = await supabase
        .from('Louvores IPPN')
        .insert({ Dia: dataEscala })
        .select()
        .single();

      if (errorCulto) throw errorCulto;
      
      const cultoId = novoCulto['Culto nr.'];

      const modeloPadrao = [
        { culto_id: cultoId, ordem: 1, tipo: 'Prelúdio', descricao: null, cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 2, tipo: 'Saudação e Acolhida à Igreja', descricao: 'Salmo 138.1-2\nIgreja da Família de Deus\nLeitura Responsiva: Salmo ____ (_______)\nOração de Invocação e Entrega do Culto ao Senhor (_______)', cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 3, tipo: 'Cânticos Congregacionais', descricao: null, cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 4, tipo: 'Cânticos Congregacionais', descricao: null, cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 5, tipo: 'Cânticos Congregacionais', descricao: null, cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 6, tipo: 'Confissão de Pecados', descricao: 'Leitura Não Responsiva e Oração: Salmo 40.1-3 (_______)\nDar minutos para os irmãos.\nOração pelos enfermos.', cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 7, tipo: 'Dízimos e Ofertas', descricao: 'Passagem de Dízimos e Ofertas. 1 Tm 6.17-19\nLembrar aos presentes colocar o código 0,09 no PIX;\nEnvelopes de Dízimo.', cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 8, tipo: 'Cântico para as Ofertas', descricao: 'Oração pelas ofertas e dízimo.', cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 9, tipo: 'Pregação da Palavra', descricao: null, cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 10, tipo: 'Cântico Final', descricao: 'Poslúdio', cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 11, tipo: 'Oração - Bênção Apostólica', descricao: 'Amém tríplice', cantico_id: null, tom: null },
        { culto_id: cultoId, ordem: 12, tipo: 'Lembretes - Liturgo', descricao: 'Apresentação dos convidados\nAniversariantes / Casamento', cantico_id: null, tom: null }
      ];

      await supabase.from('louvor_itens').insert(modeloPadrao);
      
      return cultoId;
    } catch (error) {
      console.error('Erro ao criar culto:', error);
      return null;
    }
  };

  const abrirModalNova = async () => {
    setCarregandoModal(true);
    setModalAberto(true);
    
    setEscalaEditando(null);
    setObservacoes('');
    setStatus('rascunho');
    setCultosDisponiveis([]);
    setCultoSelecionado(null);
    setcriarNovoCulto(true);
    setDebugInfo('');
    
    try {
      const proximoDomingo = await encontrarProximoDomingoDisponivel();
      setData(proximoDomingo);
      
      const dataObj = new Date(proximoDomingo + 'T00:00:00');
      const diaFormatado = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
      const tituloSugerido = `Culto Dominical - ${diaFormatado.charAt(0).toUpperCase() + diaFormatado.slice(1)}`;
      setTitulo(tituloSugerido);
      
      setHoraInicio('09:00');
      setHoraFim('');
      setTipoCulto('dominical_manha');
    } catch (error) {
      console.error('Erro ao preparar modal:', error);
      setData('');
      setTitulo('');
      setHoraInicio('09:00');
      setHoraFim('');
      setTipoCulto('dominical_manha');
    } finally {
      setCarregandoModal(false);
    }
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
    setDebugInfo('');
    setCarregandoModal(false);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEscalaEditando(null);
    setDebugInfo('');
    setCarregandoModal(false);
  };

  const salvarEscala = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      let cultoIdFinal = cultoSelecionado;

      if (criarNovoCulto && !cultoSelecionado) {
        const { data: verificacao } = await supabase
          .from('Louvores IPPN')
          .select('*')
          .eq('Dia', data);

        if (verificacao && verificacao.length > 0) {
          cultoIdFinal = verificacao[0]['Culto nr.'];
          setMensagem(`Culto #${cultoIdFinal} já existia para esta data, vinculando...`);
        } else {
          const novoCultoId = await criarCultoAutomaticamente(data);
          if (!novoCultoId) {
            throw new Error('Falha ao criar culto automaticamente');
          }
          cultoIdFinal = novoCultoId;
        }
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
        const { error } = await supabase
          .from('escalas')
          .update(dados)
          .eq('id', escalaEditando.id);

        if (error) throw error;
        setMensagem(cultoIdFinal 
          ? `Escala atualizada e vinculada ao Culto #${cultoIdFinal}!`
          : 'Escala atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('escalas')
          .insert(dados);

        if (error) throw error;
        setMensagem(cultoIdFinal 
          ? `Escala criada e vinculada ao Culto #${cultoIdFinal} (com liturgia padrão)!`
          : 'Escala criada com sucesso!');
      }

      fecharModal();
      carregarEscalas();
    } catch (error: any) {
      console.error('Erro ao salvar escala:', error);
      setMensagem(`Erro: ${error.message}`);
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
      setMensagem('Escala deletada com sucesso');
      carregarEscalas();
    } catch (error: any) {
      setMensagem(`Erro: ${error.message}`);
    }
  };

  // 🎨 GERAR IMAGEM DA ESCALA (estilo Excel)
  const gerarImagemEscala = (escala: Escala) => {
    if (!escala.escalas_funcoes) return;

    const dataFormatada = new Date(escala.data + 'T00:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long'
    });

    // Agrupar por categoria
    const grupos: Record<string, EscalaFuncao[]> = {};
    
    escala.escalas_funcoes.forEach(func => {
      const cat = func.tags_funcoes.categoria;
      // Filtrar apenas categorias musicais
      if (CATEGORIAS_MUSICAIS[cat as keyof typeof CATEGORIAS_MUSICAIS]) {
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(func);
      }
    });

    // Montar texto formatado
    let texto = `📅 ${escala.titulo.toUpperCase()}\n`;
    texto += `DATA: ${dataFormatada.toUpperCase()}\n`;
    texto += `HORÁRIO: ${escala.hora_inicio}\n`;
    if (escala.culto_id) texto += `CULTO: #${escala.culto_id}\n`;
    texto += `\n${'═'.repeat(30)}\n\n`;

    // Ordenar categorias
    const categoriasOrdenadas = Object.keys(grupos).sort((a, b) => {
      const ordemA = CATEGORIAS_MUSICAIS[a as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
      const ordemB = CATEGORIAS_MUSICAIS[b as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
      return ordemA - ordemB;
    });

    categoriasOrdenadas.forEach(cat => {
      const catInfo = CATEGORIAS_MUSICAIS[cat as keyof typeof CATEGORIAS_MUSICAIS];
      const funcoes = grupos[cat];

      texto += `${catInfo.nome}\n`;
      funcoes.forEach(func => {
        texto += `  • ${func.pessoas.nome} - ${func.tags_funcoes.nome}\n`;
      });
      texto += `\n`;
    });

    texto += `${'═'.repeat(30)}\n`;
    texto += `Igreja Presbiteriana da Ponta Negra\n`;
    texto += `Uma igreja da família de Deus`;

    // Copiar para clipboard e abrir WhatsApp
    navigator.clipboard.writeText(texto);
    
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    
    setMensagem('✅ Escala copiada! Abrindo WhatsApp...');
    setTimeout(() => setMensagem(''), 3000);
  };

  const getStatusInfo = (status: string) => {
    const info = {
      rascunho: { icon: FileEdit, color: 'bg-gray-100 text-gray-800', label: 'Rascunho' },
      publicada: { icon: CheckCircle2, color: 'bg-blue-100 text-blue-800', label: 'Publicada' },
      concluida: { icon: PartyPopper, color: 'bg-green-100 text-green-800', label: 'Concluída' }
    };
    return info[status as keyof typeof info] || info.rascunho;
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

  // 🎯 Filtrar apenas categorias musicais
  const filtrarApenasMusicais = (funcoes: EscalaFuncao[]) => {
    return funcoes.filter(f => 
      CATEGORIAS_MUSICAIS[f.tags_funcoes.categoria as keyof typeof CATEGORIAS_MUSICAIS]
    ).sort((a, b) => {
      const catA = CATEGORIAS_MUSICAIS[a.tags_funcoes.categoria as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
      const catB = CATEGORIAS_MUSICAIS[b.tags_funcoes.categoria as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
      return catA - catB;
    });
  };

  if (totalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-emerald-700 mx-auto" />
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
          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagem.includes('sucesso') || mensagem.includes('criada') || mensagem.includes('atualizada') || mensagem.includes('deletada') || mensagem.includes('copiada')
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : mensagem.includes('existia') || mensagem.includes('encontrado')
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {mensagem}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  Período
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroPeriodo('30dias')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filtroPeriodo === '30dias'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Próximos 30 dias
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('3meses')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filtroPeriodo === '3meses'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Próximos 3 meses
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('todos')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filtroPeriodo === 'todos'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Todas as escalas
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
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

                <button
                  onClick={abrirModalNova}
                  className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus size={20} />
                  Criar Nova Escala
                </button>
              </div>
            </div>
          </div>

          {/* 🎵 CARDS COMPACTOS */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <Loader2 className="animate-spin h-8 w-8 text-emerald-700" />
              </div>
            ) : escalas.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-300">
                <Calendar className="mx-auto mb-4 text-slate-400" size={48} />
                <p className="text-slate-500 text-lg mb-2">Nenhuma escala encontrada</p>
                <p className="text-slate-400 text-sm mb-4">Comece criando uma nova escala para este mês</p>
                <button
                  onClick={abrirModalNova}
                  className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-all text-sm font-medium inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  Criar Primeira Escala
                </button>
              </div>
            ) : (
              escalas.map((escala) => {
                const statusInfo = getStatusInfo(escala.status);
                const StatusIcon = statusInfo.icon;
                const funcoesVisiveis = escala.escalas_funcoes ? filtrarApenasMusicais(escala.escalas_funcoes) : [];
                
                return (
                  <div
                    key={escala.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Header Compacto */}
                    <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-white font-bold text-xl flex-1 leading-tight">
                          {escala.titulo}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 flex-shrink-0 ${statusInfo.color}`}>
                          <StatusIcon size={12} />
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-emerald-50 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>
                            {new Date(escala.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{escala.hora_inicio}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {escala.culto_id && (
                        <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
                          <Music size={16} className="text-amber-600" />
                          <span className="font-medium text-amber-900">
                            Culto #{escala.culto_id}
                          </span>
                        </div>
                      )}

                      {funcoesVisiveis.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                            <Users size={16} className="text-slate-600" />
                            <span className="text-xs font-semibold text-slate-600 uppercase">
                              Equipe ({funcoesVisiveis.length})
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {funcoesVisiveis.map((func) => (
                              <div
                                key={func.id}
                                className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded px-2.5 py-2"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: func.tags_funcoes.cor || '#64748b' }}
                                  />
                                  <span className="font-medium text-slate-700 truncate">
                                    {func.pessoas.nome}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-slate-500 text-[10px]">
                                    {func.tags_funcoes.nome}
                                  </span>
                                  {func.confirmado && (
                                    <CheckCircle2 size={12} className="text-green-600" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded flex items-center justify-center gap-2">
                          <Users size={14} />
                          Nenhuma pessoa escalada
                        </div>
                      )}

                      {escala.observacoes && (
                        <div className="text-xs text-slate-600 bg-slate-50 rounded p-2 flex items-start gap-2">
                          <MessageCircle size={12} className="flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{escala.observacoes}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer com ações */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                      <button
                        onClick={() => gerarImagemEscala(escala)}
                        className="flex-1 px-3 py-2 bg-green-100 text-green-800 rounded text-sm font-medium hover:bg-green-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ImageIcon size={16} />
                        Compartilhar
                      </button>
                      <button
                        onClick={() => router.push(`/admin/escalas/${escala.id}`)}
                        className="px-3 py-2 bg-blue-100 text-blue-800 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        <Users size={16} />
                      </button>
                      <button
                        onClick={() => abrirModalEdicao(escala)}
                        className="p-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deletarEscala(escala.id, escala.titulo)}
                        className="p-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>


      {/* Modal (continuação na próxima mensagem devido ao tamanho) */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {escalaEditando ? (
                  <>
                    <Edit2 size={24} className="text-emerald-700" />
                    Editar Escala
                  </>
                ) : (
                  <>
                    <Plus size={24} className="text-emerald-700" />
                    Nova Escala
                  </>
                )}
              </h3>
              <button
                onClick={fecharModal}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                disabled={salvando}
              >
                <span className="text-slate-500 text-xl">×</span>
              </button>
            </div>

            <form onSubmit={salvarEscala} className="p-6 space-y-4">
              {carregandoModal && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-emerald-700 mx-auto" />
                    <p className="text-sm text-slate-600 mt-3">Preparando próximo domingo...</p>
                  </div>
                </div>
              )}

              {!carregandoModal && (
                <>
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

                  <div className="border-t border-slate-200 pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                      <Music size={18} />
                      Vínculo com Programação Musical
                    </label>

                    {debugInfo && (
                      <div className="mb-3 p-2 bg-slate-100 rounded text-xs text-slate-700 font-mono flex items-start gap-2">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        {debugInfo}
                      </div>
                    )}

                    {buscandoCultos ? (
                      <div className="text-center py-4">
                        <Loader2 className="animate-spin h-6 w-6 text-emerald-700 mx-auto" />
                        <p className="text-xs text-slate-500 mt-2">Buscando cultos...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
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
                            <p className="font-medium text-slate-900 flex items-center gap-2">
                              <Plus size={16} />
                              Criar novo culto automaticamente
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              Um novo registro será criado em "Louvores IPPN" com liturgia padrão pré-preenchida
                            </p>
                          </div>
                        </label>

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
                              <p className="font-medium text-emerald-900 flex items-center gap-2">
                                <LinkIcon size={16} />
                                Vincular a culto existente ({cultosDisponiveis.length} encontrado{cultosDisponiveis.length > 1 ? 's' : ''})
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
                </>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={salvando || carregandoModal}
                  className="flex-1 bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {salvando ? 'Salvando...' : escalaEditando ? 'Salvar Alterações' : 'Criar Escala'}
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando || carregandoModal}
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