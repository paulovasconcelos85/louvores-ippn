'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { getStoredChurchId } from '@/lib/church-utils';
import { isSuperAdmin } from '@/lib/permissions';
import { jsPDF } from 'jspdf';

// --- CONFIGURAÇÕES ---
const CARGOS_LIDERANCA = ['seminarista', 'presbitero', 'pastor', 'admin', 'superadmin'];
const CARGOS_MUSICA = ['musico'];

const TIPOS_LITURGICOS = [
  'Prelúdio',
  'Saudação e Acolhida à Igreja',
  'Cânticos Congregacionais',
  'Confissão de Pecados',
  'Dízimos e Ofertas',
  'Cântico para as Ofertas e Dízimos',
  'Oração pelas Crianças',
  'Pregação da Palavra',
  'Santa Ceia',
  'Cântico Final',
  'Oração Final e Bênção Apostólica',
  'Lembretes',
];

// --- TIPOS ---
interface Cantico {
  id: string;
  nome: string;
  tipo?: string;
  ultima_vez?: string | null;
}

interface CanticoNoItem {
  cantico_id: string | null;
  tom: string | null;
}

interface LouvorItem {
  id?: string;
  tipo: string;
  ordem: number;
  conteudo_publico: string | null;
  descricao: string | null;
  horario: string | null;
  canticos_lista: CanticoNoItem[];
}

interface Culto {
  'Culto nr.': number;
  Dia: string;
  imagem_url?: string | null;
  palavra_pastoral?: string | null;
  palavra_pastoral_autor?: string | null;
}

// --- HELPERS ---
function isPrimeirosDomingo(data: Date): boolean {
  const d = new Date(data);
  return d.getDay() === 0 && d.getDate() <= 7;
}

function calcularProximoDomingo(base: Date): Date {
  const d = new Date(base);
  const diasAte = (7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diasAte);
  return d;
}

function modeloPadrao(dia: string): LouvorItem[] {
  const data = new Date(dia + 'T00:00:00');
  const primeiroDomingo = isPrimeirosDomingo(data);

  const itens: LouvorItem[] = [
    { tipo: 'Prelúdio', ordem: 1, conteudo_publico: null, descricao: null, horario: '9h-9h05', canticos_lista: [] },
    { tipo: 'Saudação e Acolhida à Igreja', ordem: 2, conteudo_publico: null, descricao: 'Salmo 138.1-2\nIgreja da Família de Deus\nLeitura Responsiva: Salmo ____ (_______)\nOração de Invocação e Entrega do Culto ao Senhor (_______)', horario: '9h05-9h10', canticos_lista: [] },
    { tipo: 'Cânticos Congregacionais', ordem: 3, conteudo_publico: null, descricao: null, horario: '9h10-9h25', canticos_lista: [{ cantico_id: null, tom: null }, { cantico_id: null, tom: null }, { cantico_id: null, tom: null }] },
    { tipo: 'Confissão de Pecados', ordem: 4, conteudo_publico: null, descricao: 'Leitura Não Responsiva e Oração: Salmo 40.1-3 (_______)\nDar minutos para os irmãos.\nOração pelos enfermos.', horario: '9h25-9h30', canticos_lista: [] },
    { tipo: 'Dízimos e Ofertas', ordem: 5, conteudo_publico: null, descricao: 'Passagem de Dízimos e Ofertas. 1 Tm 6.17-19\nLembrar aos presentes colocar o código 0,09 no PIX;\nEnvelopes de Dízimo.', horario: '9h30-9h35', canticos_lista: [] },
    { tipo: 'Cântico para as Ofertas e Dízimos', ordem: 6, conteudo_publico: null, descricao: 'Oração pelas ofertas e dízimo.', horario: '9h35-9h40', canticos_lista: [{ cantico_id: null, tom: null }] },
    { tipo: 'Oração pelas Crianças', ordem: 7, conteudo_publico: null, descricao: 'Chamar irmão (_______)', horario: '9h40-9h45', canticos_lista: [] },
    { tipo: 'Pregação da Palavra', ordem: 8, conteudo_publico: null, descricao: null, horario: '9h45-10h25', canticos_lista: [] },
  ];

  if (primeiroDomingo) {
    itens.push({ tipo: 'Santa Ceia', ordem: 9, conteudo_publico: null, descricao: null, horario: '10h25', canticos_lista: [] });
  }

  itens.push(
    { tipo: 'Cântico Final', ordem: itens.length + 1, conteudo_publico: null, descricao: 'Poslúdio', horario: '10h25', canticos_lista: [{ cantico_id: null, tom: null }] },
    { tipo: 'Oração Final e Bênção Apostólica', ordem: itens.length + 2, conteudo_publico: null, descricao: 'Amém tríplice', horario: '10h30', canticos_lista: [] },
    { tipo: 'Lembretes', ordem: itens.length + 3, conteudo_publico: null, descricao: 'Apresentação dos convidados\nAniversariantes / Casamento', horario: '10h35', canticos_lista: [] },
  );

  return itens.map((it, i) => ({ ...it, ordem: i + 1 }));
}

function getStatusMusica(dataStr: string | null | undefined) {
  if (!dataStr) return { label: 'PRIMEIRA VEZ', cor: 'text-blue-600', bg: 'bg-blue-50', dias: -1, dataFormatada: 'Nunca tocada' };
  const data = new Date(dataStr + 'T00:00:00');
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000);
  const fmt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (dias < 30) return { label: 'RECENTE', cor: 'text-emerald-600', bg: 'bg-emerald-50', dias, dataFormatada: fmt };
  if (dias < 90) return { label: 'MODERADO', cor: 'text-amber-600', bg: 'bg-amber-50', dias, dataFormatada: fmt };
  if (dias < 180) return { label: 'HÁ TEMPO', cor: 'text-orange-600', bg: 'bg-orange-50', dias, dataFormatada: fmt };
  return { label: 'HÁ MUITO', cor: 'text-red-600', bg: 'bg-red-50', dias, dataFormatada: fmt };
}

// --- AUTOCOMPLETE DE CÂNTICO ---
function CanticoAutocomplete({ value, onChange, canticos, onCreate, disabled }: {
  value: Cantico | null;
  onChange: (c: Cantico | null) => void;
  canticos: Cantico[];
  onCreate: (nome: string) => Promise<Cantico>;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value?.nome || '');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(value?.nome || ''); }, [value]);

  const filtrados = canticos.filter(c =>
    c.nome.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const abrirDropdown = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(256, filtrados.length * 60 + 56);
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 300),
      zIndex: 9999,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
    setOpen(true);
  };

  const dropdown = open && query && !disabled ? (
    <div
      style={dropdownStyle}
      className="bg-white border border-slate-200 rounded-2xl max-h-64 overflow-auto shadow-2xl"
    >
      {filtrados.map(c => {
        const st = getStatusMusica(c.ultima_vez);
        return (
          <div
            key={c.id}
            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 active:bg-slate-100"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { onChange(c); setQuery(c.nome); setOpen(false); }}
          >
            <div className="text-base font-semibold text-slate-800">{c.nome}</div>
            <div className={`text-xs font-bold mt-0.5 ${st.cor}`}>{st.label} · {st.dataFormatada}</div>
          </div>
        );
      })}
      {!canticos.some(c => c.nome.toLowerCase() === query.toLowerCase()) && (
        <div
          className="px-4 py-3 text-emerald-700 font-bold text-base hover:bg-emerald-50 cursor-pointer border-t border-emerald-100 active:bg-emerald-100"
          onMouseDown={e => e.preventDefault()}
          onClick={async () => { const n = await onCreate(query); onChange(n); setQuery(n.nome); setOpen(false); }}
        >
          + Cadastrar "{query}"
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={query}
        disabled={disabled}
        onChange={e => { setQuery(e.target.value); abrirDropdown(); if (!e.target.value) onChange(null); }}
        onFocus={abrirDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar cântico..."
        className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-emerald-500 bg-emerald-50/50 disabled:bg-slate-50 disabled:cursor-default"
      />
      {typeof window !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}

// --- LINHA DE CÂNTICO ---
function LinhaCantico({ musica, canticos, onChange, onRemove, podVerTom, onCreate, canEditarMusica }: any) {
  const cantico = canticos.find((c: Cantico) => c.id === musica.cantico_id) || null;

  return (
    <div className="flex items-center gap-2 mt-3 pl-3 border-l-2 border-emerald-300">
      <span className="text-emerald-500 text-base flex-shrink-0">🎵</span>
      <CanticoAutocomplete
        value={cantico}
        onChange={c => onChange({ ...musica, cantico_id: c?.id || null })}
        canticos={canticos}
        onCreate={onCreate}
        disabled={!canEditarMusica}
      />
      {podVerTom && (
        <select
          value={musica.tom || ''}
          onChange={e => onChange({ ...musica, tom: e.target.value })}
          disabled={!canEditarMusica}
          className="border border-slate-200 rounded-xl px-2 py-3 text-base bg-white w-24 focus:outline-none focus:border-emerald-500 disabled:bg-slate-50 flex-shrink-0"
        >
          <option value="">Tom</option>
          {['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Am', 'Em', 'Dm'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}
      {canEditarMusica && (
        <button onClick={onRemove} className="text-slate-300 hover:text-red-400 active:text-red-500 transition-colors text-2xl leading-none w-10 h-10 flex items-center justify-center flex-shrink-0">×</button>
      )}
    </div>
  );
}

// --- ITEM DA LITURGIA (linha) ---
function ItemLiturgia({ item, index, canticos, onCreate, onUpdate, onRemove, onMove, isLideranca, podVerTom, canEditarMusica }: any) {
  const [expandido, setExpandido] = useState(true);

  const adicionarCantico = () => {
    onUpdate({ ...item, canticos_lista: [...item.canticos_lista, { cantico_id: null, tom: null }] });
  };

  const atualizarCantico = (idx: number, nova: CanticoNoItem) => {
    const lista = [...item.canticos_lista];
    lista[idx] = nova;
    onUpdate({ ...item, canticos_lista: lista });
  };

  const removerCantico = (idx: number) => {
    onUpdate({ ...item, canticos_lista: item.canticos_lista.filter((_: any, i: number) => i !== idx) });
  };

  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all">
      {/* Cabeçalho do item */}
      <div className="flex items-center gap-3 px-4 py-4 bg-slate-50/80">
        <span className="text-sm font-black text-slate-400 w-6 text-center flex-shrink-0">{index + 1}</span>

        {/* Tipo litúrgico */}
        {isLideranca ? (
          <select
            value={item.tipo}
            onChange={e => onUpdate({ ...item, tipo: e.target.value })}
            className="flex-1 font-bold text-slate-800 text-base bg-transparent border-none focus:outline-none cursor-pointer min-w-0"
          >
            {TIPOS_LITURGICOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <span className="flex-1 font-bold text-slate-800 text-base min-w-0">{item.tipo}</span>
        )}

        {/* Horário (interno) */}
        {isLideranca && (
          <input
            value={item.horario || ''}
            onChange={e => onUpdate({ ...item, horario: e.target.value })}
            placeholder="horário"
            className="w-24 text-sm text-slate-500 border border-slate-200 rounded-xl px-2 py-2.5 bg-white focus:outline-none focus:border-slate-400 text-center flex-shrink-0"
          />
        )}

        {/* Ações */}
        {isLideranca && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => onMove('cima')} className="w-9 h-9 hover:bg-slate-200 rounded-xl text-slate-400 text-base flex items-center justify-center active:bg-slate-300">↑</button>
            <button onClick={() => onMove('baixo')} className="w-9 h-9 hover:bg-slate-200 rounded-xl text-slate-400 text-base flex items-center justify-center active:bg-slate-300">↓</button>
            <button onClick={onRemove} className="w-9 h-9 hover:bg-red-50 rounded-xl text-slate-300 hover:text-red-400 text-base flex items-center justify-center active:bg-red-100">🗑</button>
          </div>
        )}

        <button onClick={() => setExpandido(!expandido)} className="text-slate-400 hover:text-slate-600 w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0 active:bg-slate-100">
          {expandido ? '▲' : '▼'}
        </button>
      </div>

      {expandido && (
        <div className="px-4 py-4 space-y-4">
          {/* Campo público */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">
              <span>📢</span> Público
            </label>
            <textarea
              value={item.conteudo_publico || ''}
              onChange={e => onUpdate({ ...item, conteudo_publico: e.target.value })}
              disabled={!isLideranca}
              placeholder="Visível para todos..."
              rows={2}
              className="w-full text-base text-slate-700 border border-emerald-100 rounded-xl px-4 py-3 bg-emerald-50/30 focus:outline-none focus:border-emerald-300 resize-none disabled:cursor-default disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:py-0 placeholder:text-slate-300"
            />
          </div>

          {/* Campo interno */}
          {isLideranca && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <span>🔒</span> Interno
              </label>
              <textarea
                value={item.descricao || ''}
                onChange={e => onUpdate({ ...item, descricao: e.target.value })}
                placeholder="Observações internas (só liderança vê)..."
                rows={2}
                className="w-full text-base text-slate-600 border border-slate-100 rounded-xl px-4 py-3 bg-slate-50/50 focus:outline-none focus:border-slate-300 resize-none placeholder:text-slate-300"
              />
            </div>
          )}

          {/* Cânticos */}
          <div>
            {item.canticos_lista.map((m: CanticoNoItem, idx: number) => (
              <LinhaCantico
                key={idx}
                musica={m}
                canticos={canticos}
                onChange={(nova: CanticoNoItem) => atualizarCantico(idx, nova)}
                onRemove={() => removerCantico(idx)}
                podVerTom={podVerTom}
                onCreate={onCreate}
                canEditarMusica={canEditarMusica}
              />
            ))}
            {canEditarMusica && (
              <button
                onClick={adicionarCantico}
                className="mt-3 ml-2 text-emerald-600 hover:text-emerald-800 text-base font-bold flex items-center gap-2 hover:bg-emerald-50 px-3 py-2.5 rounded-xl transition-colors active:bg-emerald-100"
              >
                <span>🎵</span> Adicionar cântico
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- EDITOR DE LITURGIA ---
function EditorLiturgia({ culto, onSalvo, onCancelar, canticos, setCanticos, userRole }: any) {
  const [dia, setDia] = useState<string>(culto?.Dia || '');
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [palavraPastoral, setPalavraPastoral] = useState(culto?.palavra_pastoral || '');
  const [palavraPastoralAutor, setPalavraPastoralAutor] = useState(culto?.palavra_pastoral_autor || 'Rev. Rosther Guimarães Lopes');
  const [imagemUpload, setImagemUpload] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(culto?.imagem_url || null);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [importando, setImportando] = useState(false);
  const [loading, setLoading] = useState(false);

  const isLideranca = CARGOS_LIDERANCA.includes(userRole);
  const isMusico = CARGOS_MUSICA.includes(userRole);
  const podVerTom = isLideranca || isMusico;
  const canEditarMusica = isLideranca || isMusico;

  useEffect(() => {
    if (culto) {
      carregarItens(culto['Culto nr.']);
    } else if (dia) {
      setItens(modeloPadrao(dia));
    }
  }, []);

  const carregarItens = async (cultoNr: number) => {
    const { data } = await supabase
      .from('louvor_itens')
      .select('*, canticos(nome)')
      .eq('culto_id', cultoNr)
      .order('ordem');

    if (!data) return;

    // Agrupar linhas do mesmo item
    const agrupados: LouvorItem[] = [];
    data.forEach((linha: any) => {
      const ultimo = agrupados[agrupados.length - 1];
      if (
        ultimo &&
        ultimo.tipo === linha.tipo &&
        ultimo.conteudo_publico === linha.conteudo_publico &&
        ultimo.descricao === linha.descricao &&
        ultimo.horario === linha.horario
      ) {
        ultimo.canticos_lista.push({ cantico_id: linha.cantico_id, tom: linha.tom });
      } else {
        agrupados.push({
          id: linha.id,
          tipo: linha.tipo,
          ordem: linha.ordem,
          conteudo_publico: linha.conteudo_publico,
          descricao: linha.descricao,
          horario: linha.horario,
          canticos_lista: linha.cantico_id ? [{ cantico_id: linha.cantico_id, tom: linha.tom }] : [],
        });
      }
    });

    setItens(agrupados);
  };

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagemUpload(file);
    const reader = new FileReader();
    reader.onload = e => setImagemPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const importarInstagram = async () => {
    if (!instagramUrl.trim()) return;
    setImportando(true);
    try {
      const postId = instagramUrl.match(/\/p\/([^\/]+)/)?.[1] || instagramUrl.match(/\/reel\/([^\/]+)/)?.[1];
      if (!postId) { alert('URL inválida'); return; }
      const response = await fetch('/api/instagram-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl: instagramUrl }),
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const file = new File([blob], `instagram-${postId}.jpg`, { type: 'image/jpeg' });
      setImagemUpload(file);
      const reader = new FileReader();
      reader.onload = e => setImagemPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setInstagramUrl('');
      alert('✅ Imagem importada!');
    } catch { alert('❌ Erro ao importar'); }
    finally { setImportando(false); }
  };

  const uploadImagem = async (file: File, cultoNr: number): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const nome = `culto-${cultoNr}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('liturgias_thumbnails').upload(nome, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from('liturgias_thumbnails').getPublicUrl(nome);
    return data.publicUrl;
  };

  const adicionarItem = (posicao: number) => {
    const novo: LouvorItem = {
      tipo: 'Cânticos Congregacionais',
      ordem: posicao + 1,
      conteudo_publico: null,
      descricao: null,
      horario: null,
      canticos_lista: [],
    };
    const novos = [...itens];
    novos.splice(posicao, 0, novo);
    setItens(novos.map((it, i) => ({ ...it, ordem: i + 1 })));
  };

  const salvar = async () => {
    if (!dia) return alert('Selecione a data!');
    setLoading(true);
    try {
      let cId = culto?.['Culto nr.'];
      let imagemUrl = culto?.imagem_url || null;

      if (!cId) {
        const { data, error } = await supabase
          .from('Louvores IPPN')
          .insert({ Dia: dia, palavra_pastoral: palavraPastoral || null, palavra_pastoral_autor: palavraPastoralAutor || null })
          .select().single();
        if (error) throw error;
        cId = data['Culto nr.'];
      } else {
        await supabase.from('Louvores IPPN').update({
          Dia: dia,
          palavra_pastoral: palavraPastoral || null,
          palavra_pastoral_autor: palavraPastoralAutor || null,
        }).eq('"Culto nr."', cId);
      }

      if (imagemUpload) {
        const url = await uploadImagem(imagemUpload, cId);
        if (url) {
          imagemUrl = url;
          await supabase.from('Louvores IPPN').update({ imagem_url: imagemUrl }).eq('"Culto nr."', cId);
        }
      }

      await supabase.from('louvor_itens').delete().eq('culto_id', cId);

      const rows: any[] = [];
      let ord = 1;
      itens.forEach(it => {
        if (it.canticos_lista.length > 0) {
          it.canticos_lista.forEach(m => {
            rows.push({
              culto_id: cId, ordem: ord++, tipo: it.tipo,
              conteudo_publico: it.conteudo_publico || null,
              descricao: it.descricao || null,
              horario: it.horario || null,
              cantico_id: m.cantico_id || null,
              tom: m.tom || null,
            });
          });
        } else {
          rows.push({
            culto_id: cId, ordem: ord++, tipo: it.tipo,
            conteudo_publico: it.conteudo_publico || null,
            descricao: it.descricao || null,
            horario: it.horario || null,
            cantico_id: null, tom: null,
          });
        }
      });

      const { error } = await supabase.from('louvor_itens').insert(rows);
      if (error) throw error;

      alert('✅ Salvo com sucesso!');
      onSalvo();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <button onClick={onCancelar} className="text-emerald-700 font-bold text-base px-4 py-2.5 hover:bg-emerald-50 rounded-xl transition-colors active:bg-emerald-100">
          ← Voltar
        </button>
        <h2 className="font-black text-slate-800 text-base uppercase tracking-wider">
          {culto ? 'Editar Liturgia' : 'Nova Liturgia'}
        </h2>
        <div className="w-24" />
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* DATA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Data do Culto</label>
          <input
            type="date"
            value={dia}
            onChange={e => {
              setDia(e.target.value);
              if (!culto && e.target.value) setItens(modeloPadrao(e.target.value));
            }}
            disabled={!isLideranca}
            className="text-2xl font-black text-emerald-800 border-none focus:outline-none bg-transparent w-full py-1"
          />
        </div>

        {/* PALAVRA PASTORAL */}
        {isLideranca && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="text-xs font-black text-emerald-600 uppercase tracking-widest block mb-3">
              ✝️ Palavra Pastoral
            </label>
            <textarea
              value={palavraPastoral}
              onChange={e => setPalavraPastoral(e.target.value)}
              placeholder="Escreva a palavra pastoral da semana..."
              rows={4}
              className="w-full text-base text-slate-700 border border-emerald-100 rounded-xl px-4 py-3 bg-emerald-50/30 focus:outline-none focus:border-emerald-300 resize-none placeholder:text-slate-300 mb-3"
            />
            <input
              value={palavraPastoralAutor}
              onChange={e => setPalavraPastoralAutor(e.target.value)}
              placeholder="Autor"
              className="w-full text-base text-slate-500 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-slate-300 italic"
            />
          </div>
        )}

        {/* IMAGEM */}
        {isLideranca && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">
              Imagem do Tema
            </label>

            {/* Instagram */}
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                placeholder="URL do post do Instagram..."
                value={instagramUrl}
                onChange={e => setInstagramUrl(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-purple-400"
              />
              <button
                onClick={importarInstagram}
                disabled={importando}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {importando ? '⏳' : '📥'}
              </button>
            </div>

            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs text-slate-400">ou</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {imagemPreview && (
              <div className="relative mb-3 group">
                <img src={imagemPreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <button
                  onClick={() => { setImagemPreview(null); setImagemUpload(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >×</button>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleImagemChange}
              className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>
        )}

        {/* ITENS DA LITURGIA */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Liturgia</h3>
            {isLideranca && (
              <button
                onClick={() => adicionarItem(0)}
                className="text-sm font-bold text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-xl transition-colors active:bg-emerald-100"
              >
                + item no início
              </button>
            )}
          </div>

          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={idx}>
                <ItemLiturgia
                  item={it}
                  index={idx}
                  canticos={canticos}
                  onCreate={async (nome: string) => {
                    const { data }: any = await supabase.from('canticos').insert({ nome }).select().single();
                    const novo = { ...data, ultima_vez: null };
                    setCanticos((prev: Cantico[]) => [...prev, novo]);
                    return novo;
                  }}
                  onUpdate={(u: LouvorItem) => {
                    const novos = [...itens];
                    novos[idx] = u;
                    setItens(novos);
                  }}
                  onRemove={() => setItens(itens.filter((_, i) => i !== idx))}
                  onMove={(d: string) => {
                    const novos = [...itens];
                    const alvo = d === 'cima' ? idx - 1 : idx + 1;
                    if (alvo >= 0 && alvo < novos.length) {
                      [novos[idx], novos[alvo]] = [novos[alvo], novos[idx]];
                      setItens(novos);
                    }
                  }}
                  isLideranca={isLideranca}
                  podVerTom={podVerTom}
                  canEditarMusica={canEditarMusica}
                />

                {isLideranca && (
                  <button
                    onClick={() => adicionarItem(idx + 1)}
                    className="w-full mt-1 py-2.5 text-sm text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors font-semibold active:bg-emerald-100"
                  >
                    + adicionar item aqui
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Botão salvar fixo */}
      {isLideranca && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-40">
          <button
            onClick={salvar}
            disabled={loading}
            className="w-full max-w-2xl mx-auto block bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-2xl font-bold text-base shadow-lg disabled:opacity-60 transition-colors"
          >
            {loading ? '⏳ Salvando...' : '✅ Salvar Liturgia'}
          </button>
        </div>
      )}
    </div>
  );
}

// --- CARD DE CULTO NA LISTAGEM ---
function CultoCard({ culto, onEditar, onWhatsApp, onPDF }: any) {
  const dataFormatada = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-all shadow-sm">
      <div className="flex items-center gap-4 p-4">
        {culto.imagem_url && (
          <img src={culto.imagem_url} alt="" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">#{culto['Culto nr.']}</p>
          <h3 className="font-bold text-slate-800 text-base capitalize truncate mt-0.5">{dataFormatada}</h3>
          {culto.palavra_pastoral && (
            <p className="text-sm text-emerald-600 truncate mt-1">✝️ Palavra pastoral disponível</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => onWhatsApp(culto)} className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:bg-emerald-200 transition-colors flex items-center justify-center" title="WhatsApp">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.559 4.189 1.619 6.011L0 24l6.117-1.605a11.847 11.847 0 005.925 1.586h.005c6.635 0 12.032-5.396 12.035-12.032a11.76 11.76 0 00-3.528-8.485" />
            </svg>
          </button>
          <button onClick={() => onPDF(culto)} className="w-11 h-11 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center" title="PDF">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <button onClick={() => onEditar(culto)} className="w-11 h-11 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center text-lg" title="Editar">
            ✏️
          </button>
        </div>
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function CultosPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [editando, setEditando] = useState<Culto | null | 'novo'>(null);
  const [loading, setLoading] = useState(true);

  const isLideranca = userRole ? CARGOS_LIDERANCA.includes(userRole) : false;

  useEffect(() => {
    carregarTudo();
  }, []);

  const carregarTudo = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (isSuperAdmin(user.email)) {
        setUserRole('superadmin');
      } else {
        const igrejaId = getStoredChurchId();
        const { data: acesso } = await supabase
          .from('usuarios_acesso')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (acesso?.id) {
          let query = supabase
            .from('usuarios_igrejas')
            .select('cargo')
            .eq('usuario_id', acesso.id)
            .eq('ativo', true)
            .limit(1);

          if (igrejaId) {
            query = query.eq('igreja_id', igrejaId);
          }

          const { data } = await query.maybeSingle();
          setUserRole(data?.cargo || 'staff');
        } else {
          setUserRole('staff');
        }
      }
    } else {
      setUserRole('staff');
    }

    const { data: todosCanticos } = await supabase
      .from('canticos_unificados')
      .select('id, nome, tipo, numero')
      .order('nome');
    if (todosCanticos) setCanticos(todosCanticos.map(c => ({ ...c, ultima_vez: null })));

    const { data: cultosData } = await supabase
      .from('Louvores IPPN')
      .select('*')
      .order('Dia', { ascending: false });
    if (cultosData) setCultos(cultosData);

    // Buscar últimas datas dos cânticos
    if (todosCanticos) {
      const { data: itens } = await supabase.from('louvor_itens').select('cantico_id, culto_id').not('cantico_id', 'is', null);
      const { data: todosCultos } = await supabase.from('Louvores IPPN').select('"Culto nr.", Dia');
      if (itens && todosCultos) {
        const mapaCultos = new Map(todosCultos.map((c: any) => [c['Culto nr.'], c.Dia]));
        const mapaUltimas = new Map<string, string>();
        itens.forEach((it: any) => {
          const dia = mapaCultos.get(it.culto_id);
          if (!dia) return;
          if (!mapaUltimas.has(it.cantico_id) || dia > mapaUltimas.get(it.cantico_id)!) {
            mapaUltimas.set(it.cantico_id, dia as string);
          }
        });
        setCanticos(todosCanticos.map(c => ({ ...c, ultima_vez: mapaUltimas.get(c.id) || null })));
      }
    }

    setLoading(false);
  };

  const shareWhatsApp = async (culto: Culto) => {
    const cultoNr = culto['Culto nr.'];
    const { data } = await supabase.from('louvor_itens').select('*, canticos(nome)').eq('culto_id', cultoNr).order('ordem');
    if (!data) return;

    const dataFmt = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR');
    let texto = `LITURGIA DO CULTO DE *${dataFmt}*\n\n`;

    if (culto.palavra_pastoral) {
      texto += `✝️ *PALAVRA PASTORAL*\n${culto.palavra_pastoral}\n— ${culto.palavra_pastoral_autor || ''}\n\n`;
    }

    data.forEach((it: any) => {
      texto += `*${it.tipo.toUpperCase()}*`;
      if (it.horario) texto += ` _(${it.horario})_`;
      texto += '\n';
      if (it.conteudo_publico) texto += `${it.conteudo_publico}\n`;
      if (it.canticos?.nome) texto += `🎵 ${it.canticos.nome}${it.tom ? ` (${it.tom})` : ''}\n`;
      texto += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const sharePDF = async (culto: Culto) => {
    const cultoNr = culto['Culto nr.'];
    const { data } = await supabase
      .from('louvor_itens')
      .select('*, canticos(nome)')
      .eq('culto_id', cultoNr)
      .order('ordem');
    if (!data) return;

    // Agrupar itens consecutivos do mesmo tipo/horario/conteudo
    type ItemAgrupado = {
      tipo: string;
      horario: string | null;
      conteudo_publico: string | null;
      descricao: string | null;
      canticos: { nome: string; tom: string | null }[];
    };
    const agrupados: ItemAgrupado[] = [];
    for (const it of data) {
      const ultimo = agrupados[agrupados.length - 1];
      if (
        ultimo &&
        ultimo.tipo === it.tipo &&
        ultimo.horario === it.horario &&
        ultimo.conteudo_publico === it.conteudo_publico &&
        ultimo.descricao === it.descricao
      ) {
        if (it.canticos?.nome) {
          ultimo.canticos.push({ nome: it.canticos.nome, tom: it.tom });
        }
      } else {
        agrupados.push({
          tipo: it.tipo,
          horario: it.horario,
          conteudo_publico: it.conteudo_publico,
          descricao: it.descricao,
          canticos: it.canticos?.nome ? [{ nome: it.canticos.nome, tom: it.tom }] : [],
        });
      }
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 14;
    const colGap = 6;
    const colW = (pw - m * 2 - colGap) / 2;
    const lineH = 5.5;
    const titleH = 6.5;
    const headerBottom = 32;
    const contentBottom = ph - 12;

    // Função para calcular altura de um item
    const calcAlturaItem = (it: ItemAgrupado, largura: number): number => {
      doc.setFontSize(11);
      const tituloTxt = `${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
      const tituloLinhas = doc.splitTextToSize(tituloTxt, largura);
      let h = tituloLinhas.length * titleH + 2;
      if (it.conteudo_publico) {
        doc.setFontSize(10);
        const cl = doc.splitTextToSize(it.conteudo_publico, largura - 4);
        h += cl.length * lineH;
      }
      if (it.descricao) {
        doc.setFontSize(9);
        const dl = doc.splitTextToSize(it.descricao, largura - 4);
        h += dl.length * lineH;
      }
      h += it.canticos.length * lineH;
      h += 6;
      return h;
    };

    // Cabeçalho
    doc.setFillColor(16, 60, 48);
    doc.rect(0, 0, pw, headerBottom - 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('IGREJA PRESBITERIANA DA PONTA NEGRA', pw / 2, 11, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Uma igreja da familia de Deus  -  Manaus/AM', pw / 2, 18, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('LITURGIA', pw / 2, 26, { align: 'center' });

    // Data
    const dataFmt = new Date(culto.Dia + 'T00:00:00')
      .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    let y = headerBottom + 4;
    doc.text(dataFmt, pw / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(16, 60, 48);
    doc.line(m, y, pw - m, y);
    y += 6;

    // Decidir se usa 1 ou 2 colunas
    const alturaTotal1col = agrupados.reduce((acc, it) => acc + calcAlturaItem(it, pw - m * 2), 0);
    const espacoDisponivel = contentBottom - y - 6;
    const usarDuasColunas = alturaTotal1col > espacoDisponivel;

    const renderItem = (it: ItemAgrupado, num: number, xBase: number, yPos: number, largura: number): number => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      const tituloTxt = `${num}. ${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
      const tituloLinhas = doc.splitTextToSize(tituloTxt, largura);
      doc.text(tituloLinhas, xBase, yPos);
      yPos += tituloLinhas.length * titleH + 2;

      if (it.conteudo_publico) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(55, 55, 55);
        const cl = doc.splitTextToSize(it.conteudo_publico, largura - 4);
        doc.text(cl, xBase + 3, yPos);
        yPos += cl.length * lineH;
      }

      if (it.descricao) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        const dl = doc.splitTextToSize(it.descricao, largura - 4);
        doc.text(dl, xBase + 3, yPos);
        yPos += dl.length * lineH;
      }

      for (const c of it.canticos) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(16, 90, 60);
        const nomeTxt = `${c.nome}${c.tom ? ' (' + c.tom + ')' : ''}`;
        const cl = doc.splitTextToSize(nomeTxt, largura - 4);
        doc.text(cl, xBase + 3, yPos);
        yPos += cl.length * lineH;
      }

      return yPos + 6;
    };

    if (!usarDuasColunas) {
      // Uma coluna simples
      let num = 1;
      for (const it of agrupados) {
        y = renderItem(it, num, m, y, pw - m * 2);
        num++;
      }
    } else {
      // Fluxo jornal: preenche col1 até contentBottom, resto vai pra col2
      const x1 = m;
      const x2 = m + colW + colGap;

      // Linha divisória
      doc.setDrawColor(220, 220, 220);
      doc.line(x2 - colGap / 2, y - 2, x2 - colGap / 2, contentBottom);

      let col = 1;
      let xAtual = x1;
      let yAtual = y;
      let larguraAtual = colW;
      let num = 1;

      for (const it of agrupados) {
        const h = calcAlturaItem(it, larguraAtual);

        // Se não cabe na coluna atual, vai para col2
        if (col === 1 && yAtual + h > contentBottom) {
          col = 2;
          xAtual = x2;
          yAtual = y;
          larguraAtual = colW;
        }

        yAtual = renderItem(it, num, xAtual, yAtual, larguraAtual);
        num++;
      }
    }



    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-base">Carregando...</p>
      </div>
    </div>
  );

  if (editando !== null) return (
    <EditorLiturgia
      culto={editando === 'novo' ? null : editando}
      canticos={canticos}
      setCanticos={setCanticos}
      userRole={userRole}
      onSalvo={() => { setEditando(null); carregarTudo(); }}
      onCancelar={() => setEditando(null)}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Liturgias</h1>
          {isLideranca && (
            <button
              onClick={() => setEditando('novo')}
              className="bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold text-base hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm"
            >
              + Nova
            </button>
          )}
        </div>

        <div className="space-y-3">
          {cultos.map(c => (
            <CultoCard
              key={c['Culto nr.']}
              culto={c}
              onEditar={(culto: Culto) => setEditando(culto)}
              onWhatsApp={shareWhatsApp}
              onPDF={sharePDF}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
