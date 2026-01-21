'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Cantico {
  id: string;
  nome: string;
}

interface LouvorItem {
  id?: string;
  cantico_id: string | null;
  tipo: string;
  ordem: number;
  tom: string | null;
}

interface Culto {
  'Culto nr.': number;
  Dia: string;
}

const TIPOS_LITURGIA = [
  'Prelúdio',
  'Salmo',
  'Cântico',
  'Oferta',
  'Pregação',
  'Ceia',
  'Pósludio'
];

const TONS_MUSICAIS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'
];

function CanticoAutocomplete({
  value,
  onChange,
  canticos,
  onCreate,
}: {
  value: Cantico | null;
  onChange: (c: Cantico | null) => void;
  canticos: Cantico[];
  onCreate: (nome: string) => Promise<Cantico>;
}) {
  const [query, setQuery] = useState(value?.nome || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value?.nome || '');
  }, [value]);

  const filtrados = canticos.filter(c =>
    c.nome.toLowerCase().includes(query.toLowerCase())
  );

  const existeExato = canticos.some(
    c => c.nome.toLowerCase() === query.toLowerCase()
  );

  return (
    <div className="relative">
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) {
            onChange(null);
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full border-2 border-slate-300 rounded-xl p-4 text-base focus:border-emerald-600 focus:outline-none"
        placeholder="Digite o nome do cântico"
      />

      {open && query && (
        <div className="absolute z-20 bg-white border-2 border-slate-300 rounded-xl mt-2 w-full max-h-60 overflow-auto shadow-xl">
          {filtrados.map(c => (
            <div
              key={c.id}
              className="px-4 py-3 hover:bg-emerald-50 cursor-pointer text-base active:bg-emerald-100"
              onClick={() => {
                onChange(c);
                setQuery(c.nome);
                setOpen(false);
              }}
            >
              {c.nome}
            </div>
          ))}

          {!existeExato && (
            <div
              className="px-4 py-3 text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer border-t-2 text-base active:bg-emerald-100"
              onClick={async () => {
                const novo = await onCreate(query);
                onChange(novo);
                setQuery(novo.nome);
                setOpen(false);
              }}
            >
              ➕ Adicionar "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemLiturgia({
  item,
  index,
  total,
  canticos,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onCreate,
}: {
  item: LouvorItem;
  index: number;
  total: number;
  canticos: Cantico[];
  onUpdate: (updated: LouvorItem) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCreate: (nome: string) => Promise<Cantico>;
}) {
  const canticoSelecionado = canticos.find(c => c.id === item.cantico_id) || null;

  // Cores alternadas suaves para diferenciar posições
  const cores = [
    'bg-blue-50 border-blue-200',
    'bg-purple-50 border-purple-200',
    'bg-pink-50 border-pink-200',
    'bg-amber-50 border-amber-200',
    'bg-emerald-50 border-emerald-200',
    'bg-cyan-50 border-cyan-200',
  ];
  const corCard = cores[index % cores.length];

  return (
    <div className={`${corCard} border-2 rounded-2xl p-4 shadow-sm transition-all`}>
      {/* Header com tipo e controles */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex flex-col gap-2">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-10 h-10 bg-white rounded-lg flex items-center justify-center disabled:opacity-30 active:bg-slate-100 touch-manipulation shadow-sm"
            type="button"
          >
            <span className="text-xl">▲</span>
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-10 h-10 bg-white rounded-lg flex items-center justify-center disabled:opacity-30 active:bg-slate-100 touch-manipulation shadow-sm"
            type="button"
          >
            <span className="text-xl">▼</span>
          </button>
        </div>

        <div className="flex-1">
          <select
            value={item.tipo}
            onChange={e => onUpdate({ ...item, tipo: e.target.value })}
            className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-base font-bold text-emerald-800 focus:border-emerald-600 focus:outline-none touch-manipulation bg-white"
          >
            {TIPOS_LITURGIA.map(tipo => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onRemove}
          className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-200 active:bg-red-300 touch-manipulation"
          type="button"
        >
          <span className="text-2xl font-bold">✕</span>
        </button>
      </div>

      {/* Cântico */}
      {item.tipo !== 'Pregação' && (
        <>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-700">
                Cântico
              </label>
              <span className="inline-block bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                Posição {item.ordem}
              </span>
            </div>
            <CanticoAutocomplete
              value={canticoSelecionado}
              onChange={c => onUpdate({ ...item, cantico_id: c?.id || null })}
              canticos={canticos}
              onCreate={onCreate}
            />
          </div>

          {/* Tom */}
          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              Tom (opcional)
            </label>
            <select
              value={item.tom || ''}
              onChange={e => onUpdate({ ...item, tom: e.target.value || null })}
              className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-base focus:border-emerald-600 focus:outline-none touch-manipulation bg-white"
            >
              <option value="">Nenhum</option>
              {TONS_MUSICAIS.map(tom => (
                <option key={tom} value={tom}>
                  {tom}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Mensagem para pregação */}
      {item.tipo === 'Pregação' && (
        <div className="bg-white border-2 border-amber-300 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-amber-800 font-medium">
              📖 Momento da pregação (não requer cântico)
            </p>
            <span className="inline-block bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
              Posição {item.ordem}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CultosPage() {
  const router = useRouter();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [cultoEditando, setCultoEditando] = useState<Culto | null>(null);

  const [dia, setDia] = useState('');
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoadingInicial(true);
    try {
      const { data: canticosData } = await supabase
        .from('canticos')
        .select('id, nome')
        .order('nome');

      if (canticosData) setCanticos(canticosData);

      const { data: cultosData } = await supabase
        .from('Louvores IPPN')
        .select('*')
        .order('Dia', { ascending: false });

      if (cultosData) setCultos(cultosData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingInicial(false);
    }
  };

  const criarCantico = async (nome: string) => {
    const { data, error } = await supabase
      .from('canticos')
      .insert({ nome })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar cântico:', error);
      alert('Erro ao criar cântico');
      return { id: '', nome: '' };
    }

    setCanticos(prev => [...prev, data]);
    return data;
  };

  const editarCulto = async (culto: Culto) => {
    setCultoEditando(culto);
    setDia(culto.Dia);

    const { data: itensData } = await supabase
      .from('louvor_itens')
      .select('*')
      .eq('culto_id', culto['Culto nr.'])
      .order('ordem');

    if (itensData) {
      setItens(itensData);
    } else {
      setItens([]);
    }

    setModoEdicao(true);
  };

  const novoCulto = () => {
    setCultoEditando(null);
    setDia('');
    setItens([
      { cantico_id: null, tipo: 'Prelúdio', ordem: 1, tom: null },
    ]);
    setModoEdicao(true);
  };

  const cancelar = () => {
    setModoEdicao(false);
    setCultoEditando(null);
    setDia('');
    setItens([]);
  };

  const adicionarItem = () => {
    const proximaOrdem = itens.length > 0 ? Math.max(...itens.map(i => i.ordem)) + 1 : 1;
    
    setItens([
      ...itens,
      {
        cantico_id: null,
        tipo: 'Cântico',
        ordem: proximaOrdem,
        tom: null,
      },
    ]);
  };

  const removerItem = (index: number) => {
    const novosItens = itens.filter((_, i) => i !== index);
    // Reordenar
    novosItens.forEach((item, idx) => {
      item.ordem = idx + 1;
    });
    setItens(novosItens);
  };

  const atualizarItem = (index: number, updated: LouvorItem) => {
    const novosItens = [...itens];
    novosItens[index] = updated;
    setItens(novosItens);
  };

  const moverItem = (index: number, direcao: 'cima' | 'baixo') => {
    const novosItens = [...itens];
    const targetIndex = direcao === 'cima' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= novosItens.length) return;

    [novosItens[index], novosItens[targetIndex]] = [novosItens[targetIndex], novosItens[index]];

    // Atualizar ordem
    novosItens.forEach((item, idx) => {
      item.ordem = idx + 1;
    });

    setItens(novosItens);
  };

  const salvarCulto = async () => {
    if (!dia) {
      alert('Por favor, informe a data do culto');
      return;
    }

    setLoading(true);

    try {
      let cultoId: number;

      if (cultoEditando) {
        await supabase
          .from('Louvores IPPN')
          .update({ Dia: dia })
          .eq('"Culto nr."', cultoEditando['Culto nr.']);

        cultoId = cultoEditando['Culto nr.'];

        await supabase
          .from('louvor_itens')
          .delete()
          .eq('culto_id', cultoId);
      } else {
        const { data: novoCultoData, error } = await supabase
          .from('Louvores IPPN')
          .insert({ Dia: dia })
          .select()
          .single();

        if (error || !novoCultoData) {
          throw error;
        }

        cultoId = novoCultoData['Culto nr.'];
      }

      // Inserir novos itens
      const itensParaInserir = itens.map((item, index) => ({
        culto_id: cultoId,
        cantico_id: item.tipo === 'Pregação' ? null : item.cantico_id,
        tipo: item.tipo,
        ordem: index + 1,
        tom: item.tom,
      }));

      if (itensParaInserir.length > 0) {
        await supabase.from('louvor_itens').insert(itensParaInserir);
      }

      alert(cultoEditando ? 'Culto atualizado! ✅' : 'Culto salvo com sucesso! ✅');
      await carregarDados();
      cancelar();
    } catch (err) {
      console.error('Erro ao salvar culto:', err);
      alert('Erro ao salvar culto ❌');
    }

    setLoading(false);
  };

  const formatarData = (data: string) => {
    try {
      return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
    } catch {
      return data;
    }
  };

  if (modoEdicao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header Mobile-First */}
        <header className="bg-white shadow-sm border-b-2 border-slate-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <button
              onClick={cancelar}
              className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation"
            >
              ← Voltar
            </button>

            <Link href="/" className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation">
              🏠
            </Link>
          </div>
        </header>

        <main className="p-4 pb-24">
          <h1 className="text-3xl font-bold mb-6 text-slate-900">
            {cultoEditando ? '✏️ Editar Culto' : '➕ Novo Culto'}
          </h1>

          {/* Data do Culto */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-5 mb-6">
            <label className="font-bold text-slate-700 mb-3 block text-lg">
              📅 Data do Culto
            </label>
            <input
              type="date"
              value={dia}
              onChange={e => setDia(e.target.value)}
              className="w-full border-2 border-slate-300 p-4 rounded-xl text-base focus:border-emerald-600 focus:outline-none touch-manipulation"
            />
          </div>

          {/* Header Itens */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              🎵 Itens Litúrgicos ({itens.length})
            </h2>
          </div>

          {/* Lista de Itens */}
          <div className="space-y-4 mb-6">
            {itens.map((item, idx) => (
              <ItemLiturgia
                key={idx}
                item={item}
                index={idx}
                total={itens.length}
                canticos={canticos}
                onUpdate={updated => atualizarItem(idx, updated)}
                onRemove={() => removerItem(idx)}
                onMoveUp={() => moverItem(idx, 'cima')}
                onMoveDown={() => moverItem(idx, 'baixo')}
                onCreate={criarCantico}
              />
            ))}

            {itens.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border-2 border-slate-200">
                <p className="text-slate-500">Adicione itens litúrgicos ao culto</p>
              </div>
            )}
          </div>

          {/* Botão Adicionar Item */}
          <button
            onClick={adicionarItem}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-5 rounded-2xl font-bold text-lg shadow-lg mb-4 touch-manipulation"
            type="button"
          >
            ➕ Adicionar Item Litúrgico
          </button>

          {/* Botão Salvar */}
          <button
            onClick={salvarCulto}
            disabled={loading}
            className="w-full bg-emerald-900 hover:bg-emerald-950 active:bg-black text-white py-5 rounded-2xl font-bold text-xl shadow-xl disabled:opacity-50 touch-manipulation"
            type="button"
          >
            {loading ? '⏳ Salvando...' : cultoEditando ? '✅ Atualizar Culto' : '💾 Salvar Culto'}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation"
          >
            ← Voltar
          </button>

          <Link href="/" className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation">
            🏠
          </Link>
        </div>
      </header>

      <main className="p-4 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Cultos</h1>
        </div>

        {/* Botão Novo Culto */}
        <button
          onClick={novoCulto}
          className="w-full bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white py-5 rounded-2xl font-bold text-xl shadow-lg mb-6 touch-manipulation"
        >
          ➕ Novo Culto
        </button>

        {/* Loading Inicial */}
        {loadingInicial && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border-2 border-slate-200">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-700 mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Carregando cultos...</p>
          </div>
        )}

        {/* Lista de Cultos */}
        {!loadingInicial && (
          <div className="space-y-4">
            {cultos.map(culto => (
              <div
                key={culto['Culto nr.']}
                onClick={() => editarCulto(culto)}
                className="bg-white p-5 rounded-2xl shadow-sm border-2 border-slate-200 active:border-emerald-500 active:shadow-md transition-all touch-manipulation"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xl text-emerald-800">
                      Culto #{culto['Culto nr.']}
                    </p>
                    <p className="text-base text-slate-600 mt-1">
                      {formatarData(culto.Dia)}
                    </p>
                  </div>
                  <span className="text-3xl">✏️</span>
                </div>
              </div>
            ))}

            {cultos.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl shadow-sm border-2 border-slate-200">
                <span className="text-6xl mb-4 block">🎵</span>
                <p className="text-slate-600">Nenhum culto cadastrado ainda</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}