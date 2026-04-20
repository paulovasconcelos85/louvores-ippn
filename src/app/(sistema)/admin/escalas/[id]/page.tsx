'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { getStoredChurchId } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { formatPhoneNumber } from '@/lib/phone-mask';
import { getIntlLocale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import {
  ArrowLeft,
  Calendar,
  Users,
  Plus,
  Save,
  X,
  Trash2,
  CheckCircle2,
  Clock3,
  Phone,
  Loader2,
  UserPlus,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';

interface Tag {
  id: string;
  nome: string;
  categoria: string;
  ordem_categoria: number;
  ordem: number;
  cor: string;
  icone: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
}

interface EscalaFuncao {
  id: string;
  ordem: number;
  confirmado: boolean;
  observacoes?: string;
  tags_funcoes: Tag;
  pessoas: Usuario;
}

interface Escala {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim?: string;
  tipo_culto: string;
  observacoes?: string;
  status: 'rascunho' | 'publicada' | 'concluida';
  culto_id?: number;
  escalas_funcoes: EscalaFuncao[];
  canticos?: Cantico[];
}

interface Cantico {
  id: string;
  nome: string;
  tags: string[] | null;
  youtube_url: string | null;
  spotify_url: string | null;
}

// 🎵 APENAS CATEGORIAS MUSICAIS E TÉCNICAS
const CATEGORIAS_MUSICAIS = {
  'louvor_lideranca': { ordem: 1 },
  'louvor_vocal': { ordem: 2 },
  'louvor_instrumento': { ordem: 3 },
  'tecnico_audio': { ordem: 4 },
  'tecnico_video': { ordem: 5 },
};

export default function GerenciarEscalaPage() {
  const router = useRouter();
  const params = useParams();
  const escalaId = params?.id as string;
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
  
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  
  const [escala, setEscala] = useState<Escala | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [mensagemTipo, setMensagemTipo] = useState<'success' | 'warning' | 'error' | null>(null);
  
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [tipoCulto, setTipoCulto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState<'rascunho' | 'publicada' | 'concluida'>('rascunho');
  
  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaParaAdicionar, setCategoriaParaAdicionar] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState('');
  const [funcaoSelecionada, setFuncaoSelecionada] = useState('');
  
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([]);
  const [todasTags, setTodasTags] = useState<Tag[]>([]);

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
    if (escala) {
      setTitulo(escala.titulo);
      setData(escala.data);
      setHoraInicio(escala.hora_inicio);
      setHoraFim(escala.hora_fim || '');
      setTipoCulto(escala.tipo_culto);
      setObservacoes(escala.observacoes || '');
      setStatus(escala.status);
    }
  }, [escala]);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const igrejaId = getStoredChurchId();

      if (!igrejaId) {
        setEscala(null);
        setMensagem(tr('Selecione uma igreja para visualizar a escala', 'Selecciona una iglesia para ver la escala', 'Select a church to view the schedule'));
        setMensagemTipo('warning');
        return;
      }
      
      const { data: escalaData, error: escalaError } = await supabase
        .from('escalas')
        .select(`
          *,
          escalas_funcoes (
            id,
            ordem,
            confirmado,
            observacoes,
            tags_funcoes (
              id,
              nome,
              categoria,
              ordem_categoria,
              ordem,
              cor,
              icone
            ),
            pessoas (
              id,
              nome,
              email,
              telefone
            )
          )
        `)
        .eq('id', escalaId)
        .eq('igreja_id', igrejaId)
        .single();

      if (escalaError) throw escalaError;
      
      if (escalaData.escalas_funcoes) {
        escalaData.escalas_funcoes.sort((a: EscalaFuncao, b: EscalaFuncao) => {
          const catA = a.tags_funcoes.ordem_categoria || 999;
          const catB = b.tags_funcoes.ordem_categoria || 999;
          if (catA !== catB) return catA - catB;
          return (a.tags_funcoes.ordem || 999) - (b.tags_funcoes.ordem || 999);
        });
      }
      
      setEscala(escalaData);
      
      const params = new URLSearchParams();
      if (igrejaId) params.set('igreja_id', igrejaId);
      params.set('ativo', 'true');

      const usuariosResponse = await fetch(`/api/pessoas?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const usuariosPayload = await usuariosResponse.json();

      if (!usuariosResponse.ok) {
        throw new Error(
          usuariosPayload.error ||
            tr('Erro ao carregar usuários', 'Error al cargar usuarios', 'Error loading users')
        );
      }

      setTodosUsuarios(usuariosPayload.data || []);
      
      const { data: tags } = await supabase
        .from('tags_funcoes')
        .select('*')
        .eq('ativo', true)
        .order('ordem_categoria, ordem');
      
      setTodasTags(tags || []);
      
    } catch (error: any) {
      console.error('Erro ao carregar:', error);
      setMensagem(tr('Erro ao carregar escala', 'Error al cargar la escala', 'Error loading schedule'));
      setMensagemTipo('error');
    } finally {
      setLoading(false);
    }
  }, [escalaId, tr]);

  useEffect(() => {
    if (user && permissoes.podeGerenciarEscalas && escalaId) {
      carregarDados();
    }
  }, [carregarDados, user, permissoes.podeGerenciarEscalas, escalaId]);

  const salvarCampos = async () => {
    if (!escala) return;
    
    setSalvando(true);
    setMensagem('');
    setMensagemTipo(null);
    
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) {
        throw new Error(tr('Nenhuma igreja selecionada', 'Ninguna iglesia seleccionada', 'No church selected'));
      }
      const { error } = await supabase
        .from('escalas')
        .update({
          titulo,
          data,
          hora_inicio: horaInicio,
          hora_fim: horaFim || null,
          tipo_culto: tipoCulto,
          observacoes: observacoes || null,
          status,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', escalaId)
        .eq('igreja_id', igrejaId);

      if (error) throw error;
      
      setMensagem(tr('Alterações salvas!', '¡Cambios guardados!', 'Changes saved!'));
      setMensagemTipo('success');
      setTimeout(() => {
        setMensagem('');
        setMensagemTipo(null);
      }, 2000);
      carregarDados();
    } catch (error: any) {
      setMensagem(`${tr('Erro', 'Error', 'Error')}: ${error.message}`);
      setMensagemTipo('error');
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalAdicionar = (categoria: string) => {
    setCategoriaParaAdicionar(categoria);
    setUsuarioSelecionado('');
    setFuncaoSelecionada('');
    setModalAberto(true);
  };

  const adicionarPessoa = async () => {
    if (!usuarioSelecionado || !funcaoSelecionada || !escala) {
      setMensagem(tr('Selecione usuário e função', 'Selecciona usuario y función', 'Select user and role'));
      setMensagemTipo('warning');
      return;
    }

    const usuario = todosUsuarios.find(u => u.id === usuarioSelecionado);
    const tag = todasTags.find(t => t.id === funcaoSelecionada);
    if (!usuario || !tag) return;

    const novaFuncao: EscalaFuncao = {
      id: crypto.randomUUID(),
      ordem: 0,
      confirmado: false,
      tags_funcoes: tag,
      pessoas: usuario,
    };

    setEscala(prev => ({
      ...prev!,
      escalas_funcoes: [...prev!.escalas_funcoes, novaFuncao]
    }));

    setModalAberto(false);
  };

  const removerPessoa = async (funcaoId: string, nome: string) => {
    if (
      !confirm(
        tr(
          `Remover ${nome} da escala?`,
          `¿Quitar a ${nome} de la escala?`,
          `Remove ${nome} from the schedule?`
        )
      ) ||
      !escala
    ) return;

    setEscala(prev => ({
      ...prev!,
      escalas_funcoes: prev!.escalas_funcoes.filter(f => f.id !== funcaoId)
    }));

    setMensagem(tr('Pessoa removida (pendente de salvar)', 'Persona eliminada (pendiente de guardar)', 'Person removed (pending save)'));
    setMensagemTipo('warning');
  };

  const toggleConfirmacao = async (funcaoId: string, confirmadoAtual: boolean) => {
    if (!escala) return;

    setEscala(prev => ({
      ...prev!,
      escalas_funcoes: prev!.escalas_funcoes.map(f =>
        f.id === funcaoId ? { ...f, confirmado: !confirmadoAtual } : f
      )
    }));
  };

  const getTipoCultoLabel = (tipo: string) => {
    return tipoCultoLabels[tipo as keyof typeof tipoCultoLabels] || tipo;
  };

  const getCategoriaNome = (categoria: string) =>
    ({
      louvor_lideranca: tr('🎤 Ministração', '🎤 Ministración', '🎤 Leading'),
      louvor_vocal: tr('🎵 Vocais', '🎵 Vocales', '🎵 Vocals'),
      louvor_instrumento: tr('🎸 Instrumentos', '🎸 Instrumentos', '🎸 Instruments'),
      tecnico_audio: tr('🎛️ Mesa/Áudio', '🎛️ Mesa/Audio', '🎛️ Audio Desk'),
      tecnico_video: tr('📽️ Mídia/Slideshow', '📽️ Medios/Presentación', '📽️ Media/Slideshow'),
    }[categoria] || categoria);

  // 🎯 Agrupar APENAS por categorias musicais
  const agruparPorCategoria = () => {
    if (!escala?.escalas_funcoes) return {};
    
    const grupos: Record<string, EscalaFuncao[]> = {};
    
    escala.escalas_funcoes.forEach(func => {
      const cat = func.tags_funcoes.categoria;
      // Filtrar apenas categorias musicais
      if (CATEGORIAS_MUSICAIS[cat as keyof typeof CATEGORIAS_MUSICAIS]) {
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(func);
      }
    });
    
    return grupos;
  };

  const getTagsDaCategoria = (categoria: string) => {
    return todasTags.filter(tag => tag.categoria === categoria);
  };

  // 🎨 Gerar imagem da escala para WhatsApp
  const gerarImagemEscala = () => {
    if (!escala) return;

    const dataFormatada = formatarDataLonga(escala.data);

    let texto = `📅 ${escala.titulo.toUpperCase()}\n`;
    texto += `${tr('DATA', 'FECHA', 'DATE')}: ${dataFormatada.toUpperCase()}\n`;
    texto += `${tr('HORÁRIO', 'HORARIO', 'TIME')}: ${escala.hora_inicio}\n`;
    if (escala.culto_id) texto += `${tr('CULTO', 'CULTO', 'SERVICE')}: #${escala.culto_id}\n`;
    texto += `\n${'═'.repeat(30)}\n\n`;

    const grupos = agruparPorCategoria();
    const categoriasOrdenadas = Object.keys(grupos).sort((a, b) => {
      const ordemA = CATEGORIAS_MUSICAIS[a as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
      const ordemB = CATEGORIAS_MUSICAIS[b as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
      return ordemA - ordemB;
    });

    categoriasOrdenadas.forEach(cat => {
      const funcoes = grupos[cat];

      texto += `${getCategoriaNome(cat)}\n`;
      funcoes.forEach(func => {
        texto += `  • ${func.pessoas.nome} - ${func.tags_funcoes.nome}\n`;
      });
      texto += `\n`;
    });

    texto += `${'═'.repeat(30)}\n`;
    texto += `${tr('Igreja Presbiteriana da Ponta Negra', 'Iglesia Presbiteriana de Ponta Negra', 'Ponta Negra Presbyterian Church')}\n`;
    texto += `${tr('Uma igreja da família de Deus', 'Una iglesia de la familia de Dios', "A church in God's family")}`;

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

  const salvarEscalaCompleta = async () => {
    if (!escala) return;
    setSalvando(true);
    setMensagem('');
    setMensagemTipo(null);

    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) {
        throw new Error(tr('Nenhuma igreja selecionada', 'Ninguna iglesia seleccionada', 'No church selected'));
      }
      await supabase.from('escalas_funcoes').delete().eq('escala_id', escalaId);

      const payload = escala.escalas_funcoes.map(f => ({
        escala_id: escalaId,
        usuario_id: f.pessoas.id,
        tag_id: f.tags_funcoes.id,
        ordem: f.ordem,
        confirmado: f.confirmado
      }));

      const { error } = await supabase.from('escalas_funcoes').insert(payload);
      if (error) throw error;

      setMensagem(tr('Escala salva com sucesso!', '¡Escala guardada con éxito!', 'Schedule saved successfully!'));
      setMensagemTipo('success');
      carregarDados();
    } catch {
      setMensagem(tr('Erro ao salvar escala', 'Error al guardar la escala', 'Error saving schedule'));
      setMensagemTipo('error');
    } finally {
      setSalvando(false);
    }
  };

  if (totalLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-emerald-700 mx-auto" />
          <p className="mt-4 text-slate-600">{tr('Carregando...', 'Cargando...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!escala) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-slate-600 text-lg mb-4">
            {tr('Escala não encontrada', 'Escala no encontrada', 'Schedule not found')}
          </p>
          <button
            onClick={() => router.push('/admin/escalas')}
            className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-2 mx-auto"
          >
            <ArrowLeft size={18} />
            {tr('Voltar', 'Volver', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  const grupos = agruparPorCategoria();
  // Filtrar apenas categorias musicais
  const categoriasOrdenadas = Object.keys(CATEGORIAS_MUSICAIS).sort((a, b) => {
    const ordemA = CATEGORIAS_MUSICAIS[a as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
    const ordemB = CATEGORIAS_MUSICAIS[b as keyof typeof CATEGORIAS_MUSICAIS]?.ordem || 999;
    return ordemA - ordemB;
  });

  // Contar apenas pessoas nas categorias musicais
  const totalPessoasMusicais = Object.values(grupos).flat().length;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/admin/escalas')}
              className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              <span>{tr('Voltar', 'Volver', 'Back')}</span>
            </button>
            
            <button
              onClick={gerarImagemEscala}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <ImageIcon size={18} />
              <span>{tr('Compartilhar', 'Compartir', 'Share')}</span>
            </button>
          </div>

          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagemTipo === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : mensagemTipo === 'warning'
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span>{mensagem}</span>
                <button
                  onClick={() => {
                    setMensagem('');
                    setMensagemTipo(null);
                  }}
                  className="text-current opacity-50 hover:opacity-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="text-emerald-700" size={24} />
              {tr('Informações do Culto', 'Información del Culto', 'Service Information')}
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {getTipoCultoLabel(tipoCulto)}{data ? ` • ${formatarDataCompleta(data)}` : ''}
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Título', 'Título', 'Title')}
                </label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Data', 'Fecha', 'Date')}
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Hora Início', 'Hora de Inicio', 'Start Time')}
                </label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Hora Fim', 'Hora de Fin', 'End Time')}
                </label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Tipo de Culto', 'Tipo de Culto', 'Service Type')}
                </label>
                <select
                  value={tipoCulto}
                  onChange={(e) => setTipoCulto(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="dominical_manha">{tipoCultoLabels.dominical_manha}</option>
                  <option value="dominical_noite">{tipoCultoLabels.dominical_noite}</option>
                  <option value="quarta">{tipoCultoLabels.quarta}</option>
                  <option value="especial">{tipoCultoLabels.especial}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Status', 'Estado', 'Status')}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="rascunho">📝 {statusLabels.rascunho}</option>
                  <option value="publicada">✅ {statusLabels.publicada}</option>
                  <option value="concluida">🎉 {statusLabels.concluida}</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {tr('Observações', 'Observaciones', 'Notes')}
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none resize-none"
                placeholder={tr('Anotações, instruções especiais...', 'Anotaciones, instrucciones especiales...', 'Notes, special instructions...')}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={salvarCampos}
                disabled={salvando}
                className="px-6 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 font-medium flex items-center gap-2"
              >
                <Save size={18} />
                {salvando
                  ? tr('Salvando...', 'Guardando...', 'Saving...')
                  : tr('Salvar Alterações', 'Guardar Cambios', 'Save Changes')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="text-emerald-700" size={24} />
              {tr('Equipe Musical', 'Equipo Musical', 'Music Team')} ({totalPessoasMusicais})
            </h2>

            {categoriasOrdenadas.map(categoria => {
              const funcoes = grupos[categoria] || [];
              
              return (
                <div key={categoria} className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-4 py-3 border-b-2 border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-base">
                      {getCategoriaNome(categoria)} ({funcoes.length})
                    </h3>
                    <button
                      onClick={() => abrirModalAdicionar(categoria)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <UserPlus size={16} />
                      <span>{tr('Adicionar', 'Agregar', 'Add')}</span>
                    </button>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {funcoes.length === 0 ? (
                      <div className="px-4 py-6 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">
                          {tr('Nenhuma pessoa escalada', 'Ninguna persona asignada', 'No assigned people')}
                        </p>
                        <p className="text-xs mt-1">
                          {tr('Clique em "Adicionar" para escalar alguém', 'Haz clic en "Agregar" para asignar a alguien', 'Click "Add" to assign someone')}
                        </p>
                      </div>
                    ) : (
                      funcoes.map(func => (
                        <div
                          key={func.id}
                          className="px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: func.tags_funcoes.cor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900">
                                  {func.pessoas.nome}
                                </span>
                                <span className="text-sm text-slate-600">
                                  {func.tags_funcoes.icone} {func.tags_funcoes.nome}
                                </span>
                              </div>
                              {func.pessoas.telefone && (
                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Phone size={12} />
                                  {formatPhoneNumber(func.pessoas.telefone)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleConfirmacao(func.id, func.confirmado)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-colors flex items-center gap-1 ${
                                  func.confirmado
                                    ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                }`}
                              >
                                {func.confirmado ? (
                                  <>
                                    <CheckCircle2 size={12} />
                                    {tr('Confirmado', 'Confirmado', 'Confirmed')}
                                  </>
                                ) : (
                                  <>
                                    <Clock3 size={12} />
                                    {tr('Pendente', 'Pendiente', 'Pending')}
                                  </>
                                )}
                              </button>
                              
                              <button
                                onClick={() => removerPessoa(func.id, func.pessoas.nome)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={tr('Remover', 'Quitar', 'Remove')}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex justify-end pt-8">
          <button
            onClick={salvarEscalaCompleta}
            disabled={salvando}
            className="px-8 py-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-colors font-semibold shadow flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={20} />
            {salvando
              ? tr('Salvando Escala...', 'Guardando Escala...', 'Saving Schedule...')
              : tr('Salvar Escala', 'Guardar Escala', 'Save Schedule')}
          </button>
        </div>
      </main>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-emerald-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserPlus size={24} />
                  {tr('Adicionar Pessoa', 'Agregar Persona', 'Add Person')}
                </h3>
                <p className="text-emerald-100 text-sm mt-1">
                  {getCategoriaNome(categoriaParaAdicionar)}
                </p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="text-white hover:bg-emerald-700 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Pessoa', 'Persona', 'Person')} *
                </label>
                <select
                  value={usuarioSelecionado}
                  onChange={(e) => setUsuarioSelecionado(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="">{tr('Selecione...', 'Selecciona...', 'Select...')}</option>
                  {todosUsuarios.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {tr('Função', 'Función', 'Role')} *
                </label>
                <select
                  value={funcaoSelecionada}
                  onChange={(e) => setFuncaoSelecionada(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="">{tr('Selecione...', 'Selecciona...', 'Select...')}</option>
                  {getTagsDaCategoria(categoriaParaAdicionar).map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.icone} {tag.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={adicionarPessoa}
                  disabled={!usuarioSelecionado || !funcaoSelecionada || salvando}
                  className="flex-1 bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  {salvando
                    ? tr('Adicionando...', 'Agregando...', 'Adding...')
                    : tr('Adicionar', 'Agregar', 'Add')}
                </button>
                <button
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  {tr('Cancelar', 'Cancelar', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
