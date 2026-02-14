'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Filter
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

// Ícone Spotify customizado
const SpotifyIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

export default function CanticosPage() {
  const router = useRouter();
  const [canticos, setCanticos] = useState<CanticoUnificado[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'hinario' | 'cantico'>('todos');
  const [filtroTags, setFiltroTags] = useState<string[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
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
  
  const [avisoSimilaridade, setAvisoSimilaridade] = useState<string[]>([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const fetchCanticos = useCallback(async () => {
    let query = supabase
      .from('canticos_unificados')
      .select('*');

    // Filtro de tipo
    if (filtroTipo !== 'todos') {
      query = query.eq('tipo', filtroTipo);
    }

    // Filtro de busca
    if (busca.trim()) {
      const termo = busca.trim();
      // Busca por número exato (para hinos)
      if (/^\d+$/.test(termo)) {
        query = query.or(`numero.eq.${termo.padStart(3, '0')},nome.ilike.%${termo}%,letra.ilike.%${termo}%`);
      } else {
        query = query.or(`nome.ilike.%${termo}%,letra.ilike.%${termo}%`);
      }
    }

    // Filtro de tags
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

  useEffect(() => {
    fetchCanticos();
  }, [fetchCanticos]);

  useEffect(() => {
    if (criandoNovo && form.nome.length > 2) {
      const similares = canticos
        .filter(c => c.tipo === 'cantico') // Só verifica similaridade em cânticos (não hinos)
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
    // Só permite editar cânticos (não hinos do hinário)
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

          {/* Botão para mostrar/ocultar filtros */}
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

          {/* Painel de filtros */}
          {mostrarFiltros && (
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 space-y-4">
              {/* Filtro por tipo */}
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

              {/* Filtro por tags */}
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

              {/* Botão limpar filtros */}
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
            
            return (
              <div key={c.id} className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                {/* MODO EDIÇÃO */}
                {estaEditando ? (
                  <div className="p-5">
                    {renderFormulario()}
                  </div>
                ) : (
                  <>
                    {/* CABEÇALHO DO CARD */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div 
                          className="flex-1 cursor-pointer" 
                          onClick={() => toggleExpandir(c.id)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-lg text-emerald-800">{c.nome}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                              ehHinario 
                                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                : 'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              {ehHinario ? '📖 Hinário' : '🎵 Cântico'}
                            </span>
                            {estaExpandido ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </div>
                          
                          {/* Autor/Compositor (só para hinos) */}
                          {ehHinario && (c.autor_letra || c.compositor) && (
                            <div className="text-xs text-slate-600 mb-2">
                              {c.autor_letra && <span>✍️ {c.autor_letra}</span>}
                              {c.compositor && c.compositor !== c.autor_letra && (
                                <span className="ml-3">🎼 {c.compositor}</span>
                              )}
                            </div>
                          )}

                          {/* Botões YouTube e Spotify */}
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

                          {/* Tags */}
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

                    {/* CONTEÚDO EXPANDIDO */}
                    {estaExpandido && (
                      <div className="border-t-2 border-slate-200 p-5 bg-slate-50">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Coluna da Letra e Referência (2/3) */}
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

                          {/* Coluna do Vídeo (1/3) */}
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
    </div>
  );
}