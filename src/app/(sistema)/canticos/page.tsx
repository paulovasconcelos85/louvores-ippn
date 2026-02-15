'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  X, 
  Edit2, 
  Trash2,
  Music,
  Search,
  AlertCircle,
  Youtube,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Filter,
  Calendar,
  Download,
  Settings,
  FileJson,
  FileText,
  Upload,
  Eye
} from 'lucide-react';

interface CanticoUnificado {
  tipo: 'hinario' | 'cantico';
  id: string;
  numero: string | null;
  nome: string;
  letra: string | null;
  tags: string[] | null;
  referencia: string | null;
  autor_letra: string | null;
  compositor: string | null;
  audio_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  created_at: string;
  holyrics_paragraphs: HolyricsParagraph[] | null;
  holyrics_artist: string | null;
  holyrics_key: string | null;
  holyrics_bpm: number | null;
}

interface HolyricsParagraph {
  number: number;
  description: string;
  text: string;
}

const TAGS_LITURGICAS = [
  'Prelúdio', 'Poslúdio', 'Oferta', 'Ceia', 'Comunhão', 'Hino', 'Salmo',
  'Adoração', 'Confissão', 'Arrependimento', 'Edificação', 'Instrução',
  'Consagração', 'Doxologia', 'Bênçãos', 'Gratidão'
];

const TAGS_ESTILO = [
  'Alegre', 'Contemplativo', 'Lento', 'Moderado', 'Rápido', 'Animado',
  'Solene', 'Festivo', 'Reflexivo', 'Triunfante', 'Suave', 'Poderoso'
];

const TONS_MUSICAIS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
];

// Ícone Spotify customizado
const SpotifyIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export default function CanticosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canticos, setCanticos] = useState<CanticoUnificado[]>([]);
  const [historico, setHistorico] = useState<Map<string, string[]>>(new Map());
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'hinario' | 'cantico'>('todos');
  const [filtroTags, setFiltroTags] = useState<string[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [modalHolyrics, setModalHolyrics] = useState<CanticoUnificado | null>(null);
  const [mostrarPreview, setMostrarPreview] = useState(true);
  const [form, setForm] = useState<{ 
    nome: string; 
    letra: string; 
    referencia: string; 
    tags: string[];
    youtube_url: string;
    spotify_url: string;
  }>({
    nome: '',
    letra: '',
    referencia: '',
    tags: [],
    youtube_url: '',
    spotify_url: '',
  });
  
  const [holyForm, setHolyForm] = useState<{
    artist: string;
    key: string;
    bpm: number;
    letraParaSlides: string; // Texto completo que será dividido em slides
  }>({
    artist: '',
    key: '',
    bpm: 0,
    letraParaSlides: ''
  });

  const [avisoSimilaridade, setAvisoSimilaridade] = useState<string[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Converte texto em slides (quebra por linha em branco)
  const textoParaSlides = (texto: string): HolyricsParagraph[] => {
    if (!texto.trim()) return [];
    
    // Divide por linhas duplas (linha em branco)
    const paragrafos = texto.split(/\n\s*\n/).filter(p => p.trim());
    
    return paragrafos.map((texto, idx) => ({
      number: idx + 1,
      description: '',
      text: texto.trim()
    }));
  };

  // Converte slides em texto (junta com linha em branco)
  const slidesParaTexto = (slides: HolyricsParagraph[]): string => {
    return slides.map(s => s.text).join('\n\n');
  };

  const fetchHistoricoCanticos = useCallback(async () => {
    const { data: louvoresItens, error: erroItens } = await supabase
      .from('louvor_itens')
      .select('cantico_id, culto_id')
      .not('cantico_id', 'is', null);

    if (erroItens || !louvoresItens || louvoresItens.length === 0) return;

    const cultosIds = [...new Set(louvoresItens.map(item => item.culto_id))];

    const { data: cultos } = await supabase
      .from('Louvores IPPN')
      .select('Culto nr., Dia')
      .in('Culto nr.', cultosIds);

    if (!cultos) return;

    const cultosMap = new Map<number, string>();
    cultos.forEach((culto: any) => {
      if (culto.Dia) {
        cultosMap.set(culto['Culto nr.'], culto.Dia);
      }
    });

    const mapa = new Map<string, string[]>();

    louvoresItens.forEach((item: any) => {
      const canticoId = item.cantico_id;
      const dia = cultosMap.get(item.culto_id);

      if (!canticoId || !dia) return;

      if (!mapa.has(canticoId)) {
        mapa.set(canticoId, []);
      }

      const datas = mapa.get(canticoId)!;
      if (!datas.includes(dia)) {
        datas.push(dia);
      }
    });

    mapa.forEach((datas, id) => {
      const datasOrdenadas = datas.sort((a, b) => {
        return new Date(b).getTime() - new Date(a).getTime();
      });
      mapa.set(id, datasOrdenadas.slice(0, 3));
    });

    setHistorico(mapa);
  }, []);

  const fetchCanticos = useCallback(async () => {
    let query = supabase
      .from('canticos_unificados')
      .select('*');

    if (filtroTipo !== 'todos') {
      query = query.eq('tipo', filtroTipo);
    }

    if (busca.trim()) {
      const termo = busca.trim();
      if (/^\d+$/.test(termo)) {
        query = query.or(`numero.eq.${termo.padStart(3, '0')},nome.ilike.%${termo}%,letra.ilike.%${termo}%`);
      } else {
        query = query.or(`nome.ilike.%${termo}%,letra.ilike.%${termo}%`);
      }
    }

    if (filtroTags.length > 0) {
      query = query.contains('tags', filtroTags);
    }

    const { data } = await query.order('numero', { ascending: true, nullsFirst: false });

    if (data) setCanticos(data);
  }, [busca, filtroTipo, filtroTags]);

  const calcularSimilaridade = useCallback((str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.7;
    const palavras1 = s1.split(/\s+/);
    const palavras2 = s2.split(/\s+/);
    const palavrasComuns = palavras1.filter(p => palavras2.includes(p)).length;
    const totalPalavras = Math.max(palavras1.length, palavras2.length);
    return palavrasComuns / totalPalavras;
  }, []);

  const extrairYoutubeId = (url: string): string | null => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const formatarData = (data: string): string => {
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Abre modal Holyrics
  const abrirModalHolyrics = (cantico: CanticoUnificado) => {
    setModalHolyrics(cantico);
    
    // Se já tem configuração salva, carrega ela
    if (cantico.holyrics_paragraphs && cantico.holyrics_paragraphs.length > 0) {
      setHolyForm({
        artist: cantico.holyrics_artist || cantico.autor_letra || '',
        key: cantico.holyrics_key || '',
        bpm: cantico.holyrics_bpm || 0,
        letraParaSlides: slidesParaTexto(cantico.holyrics_paragraphs)
      });
    } else {
      // Senão, usa a letra original
      setHolyForm({
        artist: cantico.autor_letra || '',
        key: '',
        bpm: 0,
        letraParaSlides: cantico.letra || ''
      });
    }
  };

  const fecharModalHolyrics = () => {
    setModalHolyrics(null);
    setHolyForm({ artist: '', key: '', bpm: 0, letraParaSlides: '' });
    setMostrarPreview(true);
  };

  // Salvar configuração Holyrics
  const salvarConfigHolyrics = async () => {
    if (!modalHolyrics) return;

    const slides = textoParaSlides(holyForm.letraParaSlides);

    // Se for tipo 'hinario', não pode salvar
    if (modalHolyrics.tipo === 'hinario') {
      alert('❌ Não é possível salvar configuração Holyrics para hinos do hinário.');
      return;
    }

    const { error } = await supabase
      .from('canticos')
      .update({
        holyrics_paragraphs: slides,
        holyrics_artist: holyForm.artist,
        holyrics_key: holyForm.key,
        holyrics_bpm: holyForm.bpm || null
      })
      .eq('id', modalHolyrics.id);

    if (!error) {
      await fetchCanticos();
      alert('✅ Configuração Holyrics salva!');
    } else {
      console.error('Erro ao salvar:', error);
      alert('❌ Erro ao salvar configuração: ' + error.message);
    }
  };

  // Exportar para JSON Holyrics
  const exportarJSON = () => {
    if (!modalHolyrics) return;

    const slides = textoParaSlides(holyForm.letraParaSlides);

    const holyrics = {
      id: Date.now(),
      title: modalHolyrics.nome,
      artist: holyForm.artist,
      author: modalHolyrics.autor_letra || '',
      note: '',
      copyright: '',
      language: 'pt',
      key: holyForm.key,
      bpm: holyForm.bpm || 0,
      time_sig: '',
      midi: null,
      order: '',
      arrangements: [],
      lyrics: {
        full_text: slides.map(p => p.text).join('\n\n'),
        full_text_with_comment: null,
        paragraphs: slides.map(s => ({
          number: s.number,
          description: s.description,
          text: s.text,
          text_with_comment: null,
          translations: null
        }))
      },
      streaming: {
        audio: {
          spotify: modalHolyrics.spotify_url || '',
          youtube: modalHolyrics.youtube_url || '',
          deezer: ''
        },
        backing_track: {
          spotify: '',
          youtube: '',
          deezer: ''
        }
      },
      extras: {
        extra: modalHolyrics.referencia || ''
      }
    };

    const blob = new Blob([JSON.stringify(holyrics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modalHolyrics.nome.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Exportar para TXT
  const exportarTXT = () => {
    if (!modalHolyrics) return;

    let txt = `Título: ${modalHolyrics.nome}\n`;
    if (holyForm.artist) txt += `Artista: ${holyForm.artist}\n`;
    txt += '\n';
    txt += holyForm.letraParaSlides;

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modalHolyrics.nome.replace(/[^a-z0-9]/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar arquivo Holyrics
  const importarArquivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    // Aceita apenas .muf, .mufl ou .json
    if (!fileName.endsWith('.muf') && !fileName.endsWith('.mufl') && !fileName.endsWith('.json')) {
      alert('❌ Formato não suportado. Use arquivos .muf, .mufl ou .json do Holyrics.');
      return;
    }

    // Se for .json, tenta ler
    if (fileName.endsWith('.json')) {
      try {
        const texto = await file.text();
        const dados = JSON.parse(texto);
        
        // Extrai os dados do formato Holyrics
        if (dados.title && dados.lyrics?.paragraphs) {
          const letraCompleta = dados.lyrics.paragraphs
            .map((p: any) => p.text)
            .join('\n\n');
          
          setHolyForm({
            artist: dados.artist || '',
            key: dados.key || '',
            bpm: dados.bpm || 0,
            letraParaSlides: letraCompleta
          });
          
          alert('✅ Arquivo importado com sucesso!');
        } else {
          alert('❌ Arquivo JSON não está no formato Holyrics.');
        }
      } catch (error) {
        alert('❌ Erro ao ler arquivo JSON.');
      }
    } else {
      // Para .muf e .mufl, por enquanto só avisa que precisa abrir no Holyrics
      alert('⚠️ Arquivos .muf/.mufl só podem ser abertos no aplicativo Holyrics. Use a exportação JSON para compartilhar entre sistemas.');
    }
    
    // Limpa o input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchCanticos();
    fetchHistoricoCanticos();
  }, [fetchCanticos, fetchHistoricoCanticos]);

  useEffect(() => {
    if (criandoNovo && form.nome.length > 2) {
      const similares = canticos
        .filter(c => c.tipo === 'cantico')
        .filter(c => calcularSimilaridade(c.nome, form.nome) > 0.6)
        .map(c => c.nome);
      setAvisoSimilaridade(similares);
    } else {
      setAvisoSimilaridade([]);
    }
  }, [form.nome, criandoNovo, canticos, calcularSimilaridade]);

  const toggleExpandir = (id: string) => {
    if (editando) return;
    setExpandido(expandido === id ? null : id);
  };

  const iniciarEdicao = (c: CanticoUnificado) => {
    if (c.tipo === 'hinario') {
      alert('❌ Hinos do Hinário Novo Cântico não podem ser editados aqui.');
      return;
    }

    setCriandoNovo(false);
    setExpandido(null);
    setEditando(c.id);
    setForm({
      nome: c.nome,
      letra: c.letra || '',
      referencia: c.referencia || '',
      tags: c.tags || [],
      youtube_url: c.youtube_url || '',
      spotify_url: c.spotify_url || '',
    });
    setAvisoSimilaridade([]);
  };

  const iniciarNovo = () => {
    setCriandoNovo(true);
    setEditando(null);
    setExpandido(null);
    setForm({ nome: '', letra: '', referencia: '', tags: [], youtube_url: '', spotify_url: '' });
    setAvisoSimilaridade([]);
  };

  const cancelar = () => {
    setCriandoNovo(false);
    setEditando(null);
    setForm({ nome: '', letra: '', referencia: '', tags: [], youtube_url: '', spotify_url: '' });
    setAvisoSimilaridade([]);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      alert('O nome do cântico é obrigatório!');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      letra: form.letra.trim(),
      referencia: form.referencia.trim(),
      tags: form.tags,
      youtube_url: form.youtube_url.trim() || null,
      spotify_url: form.spotify_url.trim() || null,
    };

    if (editando) {
      const { error } = await supabase.from('canticos').update(payload).eq('id', editando);
      if (!error) {
        await fetchCanticos();
        setEditando(null);
        alert('✅ Cântico atualizado!');
      } else alert('❌ Erro ao salvar.');
      return;
    }

    const { error } = await supabase.from('canticos').insert(payload);
    if (!error) {
      await fetchCanticos();
      setCriandoNovo(false);
      alert('✅ Cântico criado!');
    } else alert('❌ Erro ao criar.');
  };

  const deletar = async (id: string, nome: string, tipo: string) => {
    if (tipo === 'hinario') {
      alert('❌ Hinos do Hinário Novo Cântico não podem ser deletados.');
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    const { error } = await supabase.from('canticos').delete().eq('id', id);
    
    if (!error) {
      await fetchCanticos();
      if (editando === id) {
        setEditando(null);
      }
      if (expandido === id) {
        setExpandido(null);
      }
      alert('✅ Cântico deletado!');
    } else {
      alert('❌ Erro ao deletar.');
    }
  };

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag) 
        : [...prev.tags, tag]
    }));
  };

  const toggleFiltroTag = (tag: string) => {
    setFiltroTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const renderTagSelector = (tags: string[], label: string) => (
    <div className="space-y-2">
      <label className="font-bold text-xs text-slate-600 uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all ${
              form.tags.includes(tag) 
                ? 'bg-emerald-600 border-emerald-700 text-white shadow-md scale-105' 
                : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );

  const renderFormulario = () => (
    <div className="space-y-5">
      <div>
        <label className="font-bold text-sm text-slate-700 mb-2 block">Nome do Cântico *</label>
        <input
          className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-emerald-600 outline-none"
          value={form.nome}
          onChange={e => setForm({ ...form, nome: e.target.value })}
          placeholder="Ex: Castelo Forte"
          autoFocus={criandoNovo}
        />
        {avisoSimilaridade.length > 0 && (
          <div className="mt-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-amber-800 text-sm">Cânticos similares encontrados:</p>
                <ul className="text-amber-700 text-sm mt-1 space-y-1">
                  {avisoSimilaridade.map((n, i) => <li key={i}>• {n}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
            <Youtube size={18} className="text-red-600" />
            Link do YouTube
          </label>
          <input
            className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-red-500 outline-none text-sm"
            value={form.youtube_url}
            onChange={e => setForm({ ...form, youtube_url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
        <div>
          <label className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
            <SpotifyIcon size={18} />
            <span>Link do Spotify</span>
          </label>
          <input
            className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-green-500 outline-none text-sm"
            value={form.spotify_url}
            onChange={e => setForm({ ...form, spotify_url: e.target.value })}
            placeholder="https://open.spotify.com/track/..."
          />
        </div>
      </div>
      
      {renderTagSelector(TAGS_LITURGICAS, 'Tags Litúrgicas')}
      {renderTagSelector(TAGS_ESTILO, 'Estilo e Ritmo')}

      <div>
        <label className="font-bold text-sm text-slate-700 mb-2 block">Letra</label>
        <textarea
          className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[150px] focus:border-emerald-600 outline-none font-mono text-sm"
          value={form.letra}
          onChange={e => setForm({ ...form, letra: e.target.value })}
          placeholder="Digite a letra do cântico..."
        />
      </div>

      <div>
        <label className="font-bold text-sm text-slate-700 mb-2 block">Referência Bíblica</label>
        <textarea
          className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[100px] focus:border-emerald-600 outline-none"
          value={form.referencia}
          onChange={e => setForm({ ...form, referencia: e.target.value })}
          placeholder="Ex: Salmo 23, João 3:16..."
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          onClick={salvar} 
          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={20} />
          {editando ? 'Salvar' : 'Criar Cântico'}
        </button>
        <button 
          onClick={cancelar} 
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <X size={20} />
          Cancelar
        </button>
      </div>
    </div>
  );

  // Preview dos slides gerados
  const slidesPreview = textoParaSlides(holyForm.letraParaSlides);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <main className="p-4 pb-24 max-w-6xl mx-auto">
        <div className="mb-6 pt-4">
          <button 
            onClick={() => router.back()} 
            className="text-emerald-700 font-bold flex items-center gap-2 hover:text-emerald-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Voltar</span>
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Music className="text-emerald-700" size={32} />
            Cânticos e Hinário
          </h1>
          <p className="text-slate-600 mt-2">
            {canticos.length} {canticos.length === 1 ? 'cântico' : 'cânticos'} disponíveis
          </p>
        </div>

        <button 
          onClick={iniciarNovo} 
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-5 rounded-2xl font-bold text-lg shadow-lg mb-6 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={24} />
          Novo Cântico
        </button>

        {criandoNovo && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-2xl p-5 shadow-lg mb-6">
            <h2 className="text-xl font-bold text-emerald-900 mb-4 flex items-center gap-2">
              <Music size={24} />
              Criar Novo Cântico
            </h2>
            {renderFormulario()}
          </div>
        )}

        {/* BUSCA E FILTROS */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, número do hino, letra ou tags..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full border-2 border-slate-300 pl-12 pr-4 py-4 rounded-xl text-base focus:border-emerald-600 outline-none shadow-sm"
            />
          </div>

          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-600" />
              <span className="font-semibold text-slate-700">Filtros Avançados</span>
              {(filtroTipo !== 'todos' || filtroTags.length > 0) && (
                <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">
                  {(filtroTipo !== 'todos' ? 1 : 0) + filtroTags.length}
                </span>
              )}
            </div>
            {mostrarFiltros ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {mostrarFiltros && (
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-4">
              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">Tipo</label>
                <div className="flex gap-2">
                  {(['todos', 'hinario', 'cantico'] as const).map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTipo(tipo)}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                        filtroTipo === tipo
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tipo === 'todos' ? 'Todos' : tipo === 'hinario' ? '📖 Hinário NC' : '🎵 Cânticos'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">Tags Litúrgicas</label>
                <div className="flex flex-wrap gap-2">
                  {TAGS_LITURGICAS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleFiltroTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                        filtroTags.includes(tag)
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {(filtroTipo !== 'todos' || filtroTags.length > 0) && (
                <button
                  onClick={() => {
                    setFiltroTipo('todos');
                    setFiltroTags([]);
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* LISTA DE CÂNTICOS */}
        <div className="space-y-3">
          {canticos.map(c => {
            const youtubeId = extrairYoutubeId(c.youtube_url || '');
            const estaExpandido = expandido === c.id;
            const estaEditando = editando === c.id;
            const ehHinario = c.tipo === 'hinario';
            const datasUsado = historico.get(c.id) || [];
            
            return (
              <div key={c.id} className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                {estaEditando ? (
                  <div className="p-5">
                    {renderFormulario()}
                  </div>
                ) : (
                  <>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div 
                          className="flex-1 cursor-pointer" 
                          onClick={() => toggleExpandir(c.id)}
                        >
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="font-bold text-lg text-emerald-800">{c.nome}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                              ehHinario 
                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                : 'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              {ehHinario ? '📖 Hinário' : '🎵 Cântico'}
                            </span>
                            
                            {datasUsado.length > 0 && (
                              <div className="flex items-center gap-1.5 ml-2">
                                <Calendar size={14} className="text-slate-400" />
                                <div className="flex gap-1">
                                  {datasUsado.map((data, idx) => (
                                    <span 
                                      key={idx}
                                      className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md font-medium border border-violet-200"
                                      title={`Cantado em ${new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                                    >
                                      {formatarData(data)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {estaExpandido ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </div>
                          
                          {ehHinario && (c.autor_letra || c.compositor) && (
                            <div className="text-xs text-slate-600 mb-2">
                              {c.autor_letra && <span>✍️ {c.autor_letra}</span>}
                              {c.compositor && c.compositor !== c.autor_letra && (
                                <span className="ml-3">🎼 {c.compositor}</span>
                              )}
                            </div>
                          )}

                          {(c.youtube_url || c.spotify_url || c.audio_url) && (
                            <div className="flex gap-3 mt-2">
                              {c.youtube_url && (
                                <a 
                                  href={c.youtube_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-medium hover:underline"
                                >
                                  <Youtube size={16} />
                                  YouTube
                                </a>
                              )}
                              {c.spotify_url && (
                                <a 
                                  href={c.spotify_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium hover:underline"
                                >
                                  <SpotifyIcon size={16} />
                                  Spotify
                                </a>
                              )}
                              {c.audio_url && (
                                <a 
                                  href={c.audio_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 text-slate-600 hover:text-slate-700 text-sm font-medium hover:underline"
                                >
                                  🎵 Áudio
                                </a>
                              )}
                            </div>
                          )}

                          {c.tags && c.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {c.tags.map((tag, idx) => (
                                <span 
                                  key={idx} 
                                  className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-700 font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Botões de ação */}
                        <div className="flex gap-2 flex-shrink-0">
                          {/* Botão Holyrics */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModalHolyrics(c);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Exportar para Holyrics"
                          >
                            <Download size={20} />
                          </button>
                          
                          {!ehHinario && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  iniciarEdicao(c);
                                }}
                                className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={20} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletar(c.id, c.nome, c.tipo);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Deletar"
                              >
                                <Trash2 size={20} />
                              </button>
                            </>
                          )}
                          {ehHinario && (
                            <div className="p-2 text-slate-400" title="Hinos do hinário não podem ser editados">
                              🔒
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {estaExpandido && (
                      <div className="border-t-2 border-slate-200 p-5 bg-slate-50">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 space-y-4">
                            {c.letra && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <BookOpen size={18} className="text-emerald-700" />
                                  <h4 className="font-bold text-slate-700">Letra</h4>
                                </div>
                                <div className="bg-white rounded-xl p-4 border-2 border-slate-200 whitespace-pre-wrap font-serif text-slate-800 leading-relaxed">
                                  {c.letra}
                                </div>
                              </div>
                            )}

                            {c.referencia && (
                              <div>
                                <h4 className="font-bold text-slate-700 mb-2">📖 Referência Bíblica</h4>
                                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 text-slate-700 whitespace-pre-wrap">
                                  {c.referencia}
                                </div>
                              </div>
                            )}
                          </div>

                          {youtubeId && (
                            <div className="lg:col-span-1">
                              <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Youtube size={18} className="text-red-600" />
                                Vídeo
                              </h4>
                              <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg sticky top-4">
                                <iframe
                                  width="100%"
                                  height="100%"
                                  src={`https://www.youtube.com/embed/${youtubeId}`}
                                  title={c.nome}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  className="border-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {canticos.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Music size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum cântico encontrado</p>
            <p className="text-sm mt-2">Tente ajustar os filtros ou a busca</p>
          </div>
        )}
      </main>

      {/* MODAL HOLYRICS - VERSÃO RESPONSIVA */}
      {modalHolyrics && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 sm:p-6 text-white rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Download size={24} className="sm:w-7 sm:h-7" />
                    Exportar para Holyrics
                  </h2>
                  <p className="text-blue-100 mt-1 text-sm sm:text-base truncate">{modalHolyrics.nome}</p>
                </div>
                <button 
                  onClick={fecharModalHolyrics}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content - COM SCROLL */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Metadados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <label className="font-bold text-xs sm:text-sm text-slate-700 mb-1 sm:mb-2 block">Artista/Compositor</label>
                  <input
                    type="text"
                    value={holyForm.artist}
                    onChange={e => setHolyForm({ ...holyForm, artist: e.target.value })}
                    className="w-full border-2 border-slate-300 p-2 sm:p-3 rounded-xl focus:border-blue-600 outline-none text-sm"
                    placeholder="Nome do artista"
                  />
                </div>

                <div>
                  <label className="font-bold text-xs sm:text-sm text-slate-700 mb-1 sm:mb-2 block">Tom Musical</label>
                  <select
                    value={holyForm.key}
                    onChange={e => setHolyForm({ ...holyForm, key: e.target.value })}
                    className="w-full border-2 border-slate-300 p-2 sm:p-3 rounded-xl focus:border-blue-600 outline-none text-sm"
                  >
                    <option value="">Selecione</option>
                    {TONS_MUSICAIS.map(tom => (
                      <option key={tom} value={tom}>{tom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-xs sm:text-sm text-slate-700 mb-1 sm:mb-2 block">BPM</label>
                  <input
                    type="number"
                    value={holyForm.bpm || ''}
                    onChange={e => setHolyForm({ ...holyForm, bpm: parseInt(e.target.value) || 0 })}
                    className="w-full border-2 border-slate-300 p-2 sm:p-3 rounded-xl focus:border-blue-600 outline-none text-sm"
                    placeholder="120"
                  />
                </div>
              </div>

              {/* Importar arquivo */}
              <div className="mb-4 sm:mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".muf,.mufl,.json"
                  onChange={importarArquivo}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors text-sm"
                >
                  <Upload size={16} />
                  Importar (.json, .muf, .mufl)
                </button>
              </div>

              {/* Editor e Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Editor */}
                <div>
                  <label className="font-bold text-xs sm:text-sm text-slate-700 mb-2 block">
                    Editor de Letra
                    <span className="text-slate-500 font-normal ml-2 text-xs block sm:inline">
                      (Linha em branco = novo slide)
                    </span>
                  </label>
                  <textarea
                    value={holyForm.letraParaSlides}
                    onChange={e => setHolyForm({ ...holyForm, letraParaSlides: e.target.value })}
                    className="w-full border-2 border-slate-300 p-3 sm:p-4 rounded-xl focus:border-blue-600 outline-none font-mono text-xs sm:text-sm h-64 sm:h-96"
                    placeholder="Digite a letra aqui...

      Deixe uma linha em branco entre as estrofes.

      Cada estrofe separada será um slide diferente no Holyrics."
                  />
                </div>

                {/* Preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold text-xs sm:text-sm text-slate-700">Preview dos Slides</label>
                    <button
                      onClick={() => setMostrarPreview(!mostrarPreview)}
                      className="flex items-center gap-1 text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      <Eye size={14} />
                      {mostrarPreview ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  {mostrarPreview && (
                    <div className="border-2 border-slate-300 rounded-xl p-3 sm:p-4 bg-slate-50 h-64 sm:h-96 overflow-y-auto space-y-2 sm:space-y-3">
                      {slidesPreview.length > 0 ? (
                        slidesPreview.map((slide, idx) => (
                          <div key={idx} className="bg-white border-2 border-blue-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-blue-600">Slide {slide.number}</span>
                              <span className="text-xs text-slate-500">{slide.text.split('\n').length} {slide.text.split('\n').length === 1 ? 'linha' : 'linhas'}</span>
                            </div>
                            <div className="whitespace-pre-wrap text-xs sm:text-sm font-serif text-slate-800 leading-relaxed">
                              {slide.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-slate-400">
                          <Music size={24} className="mx-auto mb-2 opacity-30" />
                          <p className="text-xs">Nenhum slide para mostrar</p>
                          <p className="text-xs mt-1">Digite a letra no editor</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!mostrarPreview && (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 h-64 sm:h-96 flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <Eye size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Preview oculto</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer - Ações */}
            <div className="border-t-2 border-slate-200 p-4 sm:p-6 bg-slate-50 rounded-b-2xl flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  <button
                    onClick={exportarJSON}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors shadow-md text-sm"
                  >
                    <FileJson size={16} />
                    JSON
                  </button>
                  <button
                    onClick={exportarTXT}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors shadow-md text-sm"
                  >
                    <FileText size={16} />
                    TXT
                  </button>
                  {/* Botão MUFL - placeholder por enquanto */}
                  <button
                    onClick={() => alert('⚠️ Formato .mufl em desenvolvimento. Por favor, envie um exemplo de arquivo .mufl para implementarmos.')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors shadow-md text-sm"
                  >
                    <Download size={16} />
                    MUFL
                  </button>
                </div>

                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={salvarConfigHolyrics}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg text-sm"
                  >
                    <Save size={18} />
                    Salvar
                  </button>
                  <button
                    onClick={fecharModalHolyrics}
                    className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors text-sm"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="mt-3 sm:mt-4 text-xs text-slate-500 text-center">
                <p>💡 Deixe uma linha em branco entre estrofes para criar slides separados</p>
                <p className="mt-1">🎵 Total de slides: <strong className="text-blue-600">{slidesPreview.length}</strong></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}