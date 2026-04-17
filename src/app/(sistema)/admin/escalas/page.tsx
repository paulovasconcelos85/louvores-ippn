'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { getStoredChurchId } from '@/lib/church-utils';
import { getIntlLocale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import {
  Calendar,
  Clock,
  Music,
  Users,
  Plus,
  Edit2,
  Trash2,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PartyPopper,
  MessageCircle,
  Link as LinkIcon,
  Image as ImageIcon,
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
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
  
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [mensagemTipo, setMensagemTipo] = useState<'success' | 'warning' | 'error' | null>(null);
  
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
  const tipoCultoLabels = useMemo(
    () => ({
      dominical_manha: tr('Dominical - Manhã', 'Dominical - Mañana', 'Sunday - Morning'),
      dominical_noite: tr('Dominical - Noite', 'Dominical - Noche', 'Sunday - Evening'),
      quarta: tr('Quarta-feira', 'Miércoles', 'Wednesday'),
      especial: tr('Culto Especial', 'Culto Especial', 'Special Service'),
    }),
    [tr]
  );
  const statusLabels = useMemo(
    () => ({
      rascunho: tr('Rascunho', 'Borrador', 'Draft'),
      publicada: tr('Publicada', 'Publicada', 'Published'),
      concluida: tr('Concluída', 'Concluida', 'Completed'),
    }),
    [tr]
  );
  const formatarDataCurta = useCallback(
    (value: string) =>
      new Date(value + 'T00:00:00').toLocaleDateString(intlLocale, {
        day: '2-digit',
        month: 'short',
      }),
    [intlLocale]
  );
  const formatarDataCompleta = useCallback(
    (value: string) => new Date(value + 'T00:00:00').toLocaleDateString(intlLocale),
    [intlLocale]
  );
  const formatarDataLonga = useCallback(
    (value: string) =>
      new Date(value + 'T00:00:00').toLocaleDateString(intlLocale, {
        day: '2-digit',
        month: 'long',
      }),
    [intlLocale]
  );

  const encontrarProximoDomingoDisponivel = async (): Promise<string> => {
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) {
        throw new Error(tr('Nenhuma igreja selecionada', 'Ninguna iglesia seleccionada', 'No church selected'));
      }
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
        .eq('tipo_culto', 'dominical_manha')
        .eq('igreja_id', igrejaId);

      if (error) throw error;

      const datasComEscala = new Set(escalasExistentes?.map(e => e.data) || []);
      const domingoDisponivel = datasParaVerificar.find(data => !datasComEscala.has(data));
      
      return domingoDisponivel || datasParaVerificar[0];
    } catch {
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

  const carregarEscalas = useCallback(async () => {
    try {
      setLoading(true);
      const igrejaId = getStoredChurchId();

      if (!igrejaId) {
        setEscalas([]);
        setMensagem(tr('Selecione uma igreja para visualizar as escalas', 'Selecciona una iglesia para ver las escalas', 'Select a church to view schedules'));
        setMensagemTipo('warning');
        return;
      }
      
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
        .eq('igreja_id', igrejaId)
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
      setMensagem(tr('Erro ao carregar escalas', 'Error al cargar escalas', 'Error loading schedules'));
      setMensagemTipo('error');
    } finally {
      setLoading(false);
    }
  }, [filtroPeriodo, filtroStatus, filtroTipo, tr]);

  const buscarCultosNaData = useCallback(async () => {
    if (!data) return;
    
    setBuscandoCultos(true);
    setDebugInfo(
      tr(
        `Buscando cultos para: ${data}`,
        `Buscando cultos para: ${data}`,
        `Searching services for: ${data}`
      )
    );
    
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) {
        throw new Error(tr('Nenhuma igreja selecionada', 'Ninguna iglesia seleccionada', 'No church selected'));
      }
      const { data: cultos, error } = await supabase
        .from('Louvores IPPN')
        .select('*')
        .eq('Dia', data)
        .eq('igreja_id', igrejaId);

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
        setDebugInfo(
          tr(
            `Culto #${cultosOrdenados[0]['Culto nr.']} encontrado - será usado`,
            `Culto #${cultosOrdenados[0]['Culto nr.']} encontrado - será usado`,
            `Service #${cultosOrdenados[0]['Culto nr.']} found - it will be used`
          )
        );
      } else {
        setcriarNovoCulto(true);
        setCultoSelecionado(null);
        setDebugInfo(tr('Nenhum culto encontrado - novo será criado', 'No se encontró culto - se creará uno nuevo', 'No service found - a new one will be created'));
      }
    } catch (error: any) {
      console.error('Erro:', error);
      setDebugInfo(`${error?.message || tr('Erro', 'Error', 'Error')}`);
      setcriarNovoCulto(true);
      setCultoSelecionado(null);
    } finally {
      setBuscandoCultos(false);
    }
  }, [data, tr]);

  const criarCultoAutomaticamente = async (dataEscala: string): Promise<number | null> => {
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) {
        throw new Error(tr('Nenhuma igreja selecionada', 'Ninguna iglesia seleccionada', 'No church selected'));
      }
      const { data: novoCulto, error: errorCulto } = await supabase
        .from('Louvores IPPN')
        .insert({ Dia: dataEscala, igreja_id: igrejaId })
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
    } catch {
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
      
      const diaFormatado = formatarDataLonga(proximoDomingo);
      const tituloSugerido = `${tr('Culto Dominical', 'Culto Dominical', 'Sunday Service')} - ${diaFormatado.charAt(0).toUpperCase() + diaFormatado.slice(1)}`;
      setTitulo(tituloSugerido);
      
      setHoraInicio('09:00');
      setHoraFim('');
      setTipoCulto('dominical_manha');
    } catch {
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
    setMensagemTipo(null);

    try {
      const igrejaId = getStoredChurchId();

      if (!igrejaId) {
        throw new Error(tr('Selecione uma igreja antes de salvar a escala', 'Selecciona una iglesia antes de guardar la escala', 'Select a church before saving the schedule'));
      }

      let cultoIdFinal = cultoSelecionado;

      if (criarNovoCulto && !cultoSelecionado) {
        const { data: verificacao } = await supabase
          .from('Louvores IPPN')
          .select('*')
          .eq('Dia', data)
          .eq('igreja_id', igrejaId);

        if (verificacao && verificacao.length > 0) {
          cultoIdFinal = verificacao[0]['Culto nr.'];
          setMensagem(
            tr(
              `Culto #${cultoIdFinal} já existia para esta data, vinculando...`,
              `El culto #${cultoIdFinal} ya existía para esta fecha, vinculando...`,
              `Service #${cultoIdFinal} already existed for this date, linking...`
            )
          );
          setMensagemTipo('warning');
        } else {
          const novoCultoId = await criarCultoAutomaticamente(data);
          if (!novoCultoId) {
            throw new Error(tr('Falha ao criar culto automaticamente', 'Error al crear el culto automáticamente', 'Failed to create service automatically'));
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
        igreja_id: igrejaId,
        criado_por: user?.id,
        atualizado_em: new Date().toISOString()
      };

      if (escalaEditando) {
        const { error } = await supabase
          .from('escalas')
          .update(dados)
          .eq('id', escalaEditando.id)
          .eq('igreja_id', igrejaId);

        if (error) throw error;
        setMensagem(cultoIdFinal 
          ? tr(
              `Escala atualizada e vinculada ao Culto #${cultoIdFinal}!`,
              `¡Escala actualizada y vinculada al Culto #${cultoIdFinal}!`,
              `Schedule updated and linked to Service #${cultoIdFinal}!`
            )
          : tr('Escala atualizada com sucesso!', '¡Escala actualizada con éxito!', 'Schedule updated successfully!'));
        setMensagemTipo('success');
      } else {
        const { error } = await supabase
          .from('escalas')
          .insert(dados);

        if (error) throw error;
        setMensagem(cultoIdFinal 
          ? tr(
              `Escala criada e vinculada ao Culto #${cultoIdFinal} (com liturgia padrão)!`,
              `¡Escala creada y vinculada al Culto #${cultoIdFinal} (con liturgia estándar)!`,
              `Schedule created and linked to Service #${cultoIdFinal} (with default liturgy)!`
            )
          : tr('Escala criada com sucesso!', '¡Escala creada con éxito!', 'Schedule created successfully!'));
        setMensagemTipo('success');
      }

      fecharModal();
      carregarEscalas();
    } catch (error: any) {
      console.error('Erro ao salvar escala:', error);
      setMensagem(`${tr('Erro', 'Error', 'Error')}: ${error.message}`);
      setMensagemTipo('error');
    } finally {
      setSalvando(false);
    }
  };

  const deletarEscala = async (id: string, titulo: string) => {
    if (!confirm(tr(
      `Tem certeza que deseja DELETAR a escala "${titulo}"?\n\nEsta ação não pode ser desfeita.`,
      `¿Seguro que deseas ELIMINAR la escala "${titulo}"?\n\nEsta acción no se puede deshacer.`,
      `Are you sure you want to DELETE the schedule "${titulo}"?\n\nThis action cannot be undone.`
    ))) {
      return;
    }

    try {
      const igrejaId = getStoredChurchId();
      const { error } = await supabase
        .from('escalas')
        .delete()
        .eq('id', id)
        .eq('igreja_id', igrejaId);

      if (error) throw error;
      setMensagem(tr('Escala deletada com sucesso', 'Escala eliminada con éxito', 'Schedule deleted successfully'));
      setMensagemTipo('success');
      carregarEscalas();
    } catch (error: any) {
      setMensagem(`${tr('Erro', 'Error', 'Error')}: ${error.message}`);
      setMensagemTipo('error');
    }
  };

  // 🎨 GERAR IMAGEM DA ESCALA (estilo Excel)
  const gerarImagemEscala = (escala: Escala) => {
    if (!escala.escalas_funcoes) return;

    const dataFormatada = formatarDataLonga(escala.data);

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
    texto += `${tr('DATA', 'FECHA', 'DATE')}: ${dataFormatada.toUpperCase()}\n`;
    texto += `${tr('HORÁRIO', 'HORARIO', 'TIME')}: ${escala.hora_inicio}\n`;
    if (escala.culto_id) texto += `${tr('CULTO', 'CULTO', 'SERVICE')}: #${escala.culto_id}\n`;
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
    texto += `${tr('Igreja Presbiteriana da Ponta Negra', 'Iglesia Presbiteriana de Ponta Negra', 'Ponta Negra Presbyterian Church')}\n`;
    texto += `${tr('Uma igreja da família de Deus', 'Una iglesia de la familia de Dios', "A church in God's family")}`;

    // Copiar para clipboard e abrir WhatsApp
    navigator.clipboard.writeText(texto);
    
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    
    setMensagem(tr('✅ Escala copiada! Abrindo WhatsApp...', '✅ ¡Escala copiada! Abriendo WhatsApp...', '✅ Schedule copied! Opening WhatsApp...'));
    setMensagemTipo('success');
    setTimeout(() => {
      setMensagem('');
      setMensagemTipo(null);
    }, 3000);
  };

  const getStatusInfo = (status: string) => {
    const info = {
      rascunho: { icon: FileEdit, color: 'bg-gray-100 text-gray-800', label: statusLabels.rascunho },
      publicada: { icon: CheckCircle2, color: 'bg-blue-100 text-blue-800', label: statusLabels.publicada },
      concluida: { icon: PartyPopper, color: 'bg-green-100 text-green-800', label: statusLabels.concluida }
    };
    return info[status as keyof typeof info] || info.rascunho;
  };

  const getTipoCultoLabel = (tipo: string) => {
    return tipoCultoLabels[tipo as keyof typeof tipoCultoLabels] || tipo;
  };

  useEffect(() => {
    if (user && permissoes.podeGerenciarEscalas) {
      carregarEscalas();
    }
  }, [carregarEscalas, user, permissoes.podeGerenciarEscalas]);

  useEffect(() => {
    if (data && modalAberto) {
      buscarCultosNaData();
    }
  }, [buscarCultosNaData, data, modalAberto]);

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
          <p className="mt-4 text-slate-600">
            {tr('Verificando permissões...', 'Verificando permisos...', 'Checking permissions...')}
          </p>
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
              mensagemTipo === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : mensagemTipo === 'warning'
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
                  {tr('Período', 'Período', 'Period')}
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
                    {tr('Próximos 30 dias', 'Próximos 30 días', 'Next 30 days')}
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('3meses')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filtroPeriodo === '3meses'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tr('Próximos 3 meses', 'Próximos 3 meses', 'Next 3 months')}
                  </button>
                  <button
                    onClick={() => setFiltroPeriodo('todos')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filtroPeriodo === 'todos'
                        ? 'bg-emerald-700 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {tr('Todas as escalas', 'Todas las escalas', 'All schedules')}
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {tr('Status', 'Estado', 'Status')}
                    </label>
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    >
                      <option value="todas">{tr('Todas', 'Todas', 'All')}</option>
                      <option value="rascunho">{statusLabels.rascunho}</option>
                      <option value="publicada">{statusLabels.publicada}</option>
                      <option value="concluida">{statusLabels.concluida}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {tr('Tipo', 'Tipo', 'Type')}
                    </label>
                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    >
                      <option value="todos">{tr('Todos', 'Todos', 'All')}</option>
                      <option value="dominical_manha">{tipoCultoLabels.dominical_manha}</option>
                      <option value="dominical_noite">{tipoCultoLabels.dominical_noite}</option>
                      <option value="quarta">{tipoCultoLabels.quarta}</option>
                      <option value="especial">{tr('Especial', 'Especial', 'Special')}</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={abrirModalNova}
                  className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus size={20} />
                  {tr('Criar Nova Escala', 'Crear Nueva Escala', 'Create New Schedule')}
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
                <p className="text-slate-500 text-lg mb-2">
                  {tr('Nenhuma escala encontrada', 'No se encontró ninguna escala', 'No schedules found')}
                </p>
                <p className="text-slate-400 text-sm mb-4">
                  {tr('Comece criando uma nova escala para este mês', 'Comienza creando una nueva escala para este mes', 'Start by creating a new schedule for this month')}
                </p>
                <button
                  onClick={abrirModalNova}
                  className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-all text-sm font-medium inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  {tr('Criar Primeira Escala', 'Crear Primera Escala', 'Create First Schedule')}
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
                          <span>{formatarDataCurta(escala.data)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{escala.hora_inicio}</span>
                        </div>
                        <span className="truncate">{getTipoCultoLabel(escala.tipo_culto)}</span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {escala.culto_id && (
                        <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-lg p-2">
                          <Music size={16} className="text-amber-600" />
                          <span className="font-medium text-amber-900">
                            {tr('Culto', 'Culto', 'Service')} #{escala.culto_id}
                          </span>
                        </div>
                      )}

                      {funcoesVisiveis.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                            <Users size={16} className="text-slate-600" />
                            <span className="text-xs font-semibold text-slate-600 uppercase">
                              {tr('Equipe', 'Equipo', 'Team')} ({funcoesVisiveis.length})
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
                          {tr('Nenhuma pessoa escalada', 'Ninguna persona asignada', 'No assigned people')}
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
                        {tr('Compartilhar', 'Compartir', 'Share')}
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
                    {tr('Editar Escala', 'Editar Escala', 'Edit Schedule')}
                  </>
                ) : (
                  <>
                    <Plus size={24} className="text-emerald-700" />
                    {tr('Nova Escala', 'Nueva Escala', 'New Schedule')}
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
                    <p className="text-sm text-slate-600 mt-3">
                      {tr('Preparando próximo domingo...', 'Preparando próximo domingo...', 'Preparing next Sunday...')}
                    </p>
                  </div>
                </div>
              )}

              {!carregandoModal && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {tr('Título da Escala', 'Título de la Escala', 'Schedule Title')} *
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                      placeholder={tr('Ex: Culto Dominical - 25 de Janeiro', 'Ej.: Culto Dominical - 25 de Enero', 'Ex: Sunday Service - January 25')}
                      disabled={salvando}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {tr('Data', 'Fecha', 'Date')} *
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
                        {tr('Tipo de Culto', 'Tipo de Culto', 'Service Type')} *
                      </label>
                      <select
                        value={tipoCulto}
                        onChange={(e) => setTipoCulto(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                        disabled={salvando}
                      >
                        <option value="dominical_manha">{tipoCultoLabels.dominical_manha}</option>
                        <option value="dominical_noite">{tipoCultoLabels.dominical_noite}</option>
                        <option value="quarta">{tipoCultoLabels.quarta}</option>
                        <option value="especial">{tipoCultoLabels.especial}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {tr('Hora Início', 'Hora de Inicio', 'Start Time')} *
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
                        {tr('Hora Fim', 'Hora de Fin', 'End Time')} <span className="text-xs text-slate-500">({tr('opcional', 'opcional', 'optional')})</span>
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
                      {tr('Vínculo com Programação Musical', 'Vínculo con Programación Musical', 'Music Program Link')}
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
                        <p className="text-xs text-slate-500 mt-2">
                          {tr('Buscando cultos...', 'Buscando cultos...', 'Searching services...')}
                        </p>
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
                              {tr('Criar novo culto automaticamente', 'Crear nuevo culto automáticamente', 'Create new service automatically')}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              {tr('Um novo culto será criado com liturgia padrão pré-preenchida', 'Se creará un nuevo culto con liturgia estándar precargada', 'A new service will be created with pre-filled default liturgy')}
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
                                {tr('Vincular a culto existente', 'Vincular a culto existente', 'Link to existing service')} ({cultosDisponiveis.length} {tr(cultosDisponiveis.length > 1 ? 'encontrados' : 'encontrado', cultosDisponiveis.length > 1 ? 'encontrados' : 'encontrado', cultosDisponiveis.length > 1 ? 'found' : 'found')})
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
                                      {tr('Culto', 'Culto', 'Service')} #{culto['Culto nr.']} - {formatarDataCompleta(culto.Dia)}
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
                      {tr('Status', 'Estado', 'Status')} *
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                      disabled={salvando}
                    >
                      <option value="rascunho">📝 {tr('Rascunho (não visível)', 'Borrador (no visible)', 'Draft (not visible)')}</option>
                      <option value="publicada">✅ {tr('Publicada (visível para todos)', 'Publicada (visible para todos)', 'Published (visible to everyone)')}</option>
                      <option value="concluida">🎉 {statusLabels.concluida}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {tr('Observações', 'Observaciones', 'Notes')} <span className="text-xs text-slate-500">({tr('opcional', 'opcional', 'optional')})</span>
                    </label>
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none resize-none"
                      placeholder={tr('Anotações, instruções especiais, etc...', 'Anotaciones, instrucciones especiales, etc...', 'Notes, special instructions, etc...')}
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
                  {salvando
                    ? tr('Salvando...', 'Guardando...', 'Saving...')
                    : escalaEditando
                      ? tr('Salvar Alterações', 'Guardar Cambios', 'Save Changes')
                      : tr('Criar Escala', 'Crear Escala', 'Create Schedule')}
                </button>
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando || carregandoModal}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
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
