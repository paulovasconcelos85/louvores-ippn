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

interface UltimaExecucao {
  data: string;
  diasAtras: number;
  cultoNr: number;
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
  cultoAtualId,
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
  cultoAtualId: number | null;
}) {
  const canticoSelecionado = canticos.find(c => c.id === item.cantico_id) || null;
  const [ultimaExecucao, setUltimaExecucao] = useState<UltimaExecucao | null>(null);
  const [loadingExecucao, setLoadingExecucao] = useState(false);

  // Buscar última execução quando o cântico muda
  useEffect(() => {
    async function buscarUltimaExecucao() {
      if (!item.cantico_id) {
        setUltimaExecucao(null);
        return;
      }

      setLoadingExecucao(true);

      try {
        // Buscar última execução deste cântico (excluindo o culto atual se estiver editando)
        let query = supabase
          .from('vw_execucoes_louvores')
          .select('data, culto_nr')
          .eq('cantico', canticos.find(c => c.id === item.cantico_id)?.nome || '')
          .order('data', { ascending: false });

        // Se estiver editando um culto, excluir ele da busca
        if (cultoAtualId) {
          query = query.neq('culto_nr', cultoAtualId);
        }

        const { data, error } = await query.limit(1);

        if (error) {
          console.error('Erro ao buscar última execução:', error);
          setUltimaExecucao(null);
          return;
        }

        if (data && data.length > 0) {
          const ultima = data[0];
          const hoje = new Date();
          const dataExecucao = new Date(ultima.data + 'T00:00:00');
          const diasAtras = Math.floor((hoje.getTime() - dataExecucao.getTime()) / (1000 * 60 * 60 * 24));

          setUltimaExecucao({
            data: ultima.data,
            diasAtras: diasAtras,
            cultoNr: ultima.culto_nr,
          });
        } else {
          setUltimaExecucao(null);
        }
      } catch (error) {
        console.error('Erro ao buscar última execução:', error);
        setUltimaExecucao(null);
      } finally {
        setLoadingExecucao(false);
      }
    }

    buscarUltimaExecucao();
  }, [item.cantico_id, canticos, cultoAtualId]);

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

  // Função para formatar a mensagem da última execução
  const formatarUltimaExecucao = () => {
    if (loadingExecucao) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 animate-pulse">
          <p className="text-xs text-slate-500">🔍 Verificando...</p>
        </div>
      );
    }

    if (!ultimaExecucao) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
          <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
            <span>✨</span>
            <span>Primeira vez que este cântico será usado</span>
          </p>
        </div>
      );
    }

    // Determinar cor e ícone baseado em quantos dias atrás
    let corFundo = 'bg-slate-50';
    let corBorda = 'border-slate-200';
    let corTexto = 'text-slate-600';
    let icone = '📅';
    let mensagem = '';

    if (ultimaExecucao.diasAtras === 0) {
      corFundo = 'bg-red-50';
      corBorda = 'border-red-200';
      corTexto = 'text-red-700';
      icone = '⚠️';
      mensagem = `Usado HOJE no culto atual`;
    } else if (ultimaExecucao.diasAtras <= 7) {
      corFundo = 'bg-amber-50';
      corBorda = 'border-amber-200';
      corTexto = 'text-amber-700';
      icone = '⚠️';
      mensagem = `Usado há ${ultimaExecucao.diasAtras} dia${ultimaExecucao.diasAtras > 1 ? 's' : ''} (semana passada)`;
    } else if (ultimaExecucao.diasAtras <= 30) {
      corFundo = 'bg-yellow-50';
      corBorda = 'border-yellow-200';
      corTexto = 'text-yellow-700';
      icone = '📌';
      mensagem = `Usado há ${ultimaExecucao.diasAtras} dias`;
    } else if (ultimaExecucao.diasAtras <= 90) {
      corFundo = 'bg-blue-50';
      corBorda = 'border-blue-200';
      corTexto = 'text-blue-600';
      icone = '📅';
      mensagem = `Usado há ${Math.floor(ultimaExecucao.diasAtras / 30)} ${Math.floor(ultimaExecucao.diasAtras / 30) === 1 ? 'mês' : 'meses'}`;
    } else {
      corFundo = 'bg-emerald-50';
      corBorda = 'border-emerald-200';
      corTexto = 'text-emerald-600';
      icone = '✅';
      mensagem = `Usado há ${Math.floor(ultimaExecucao.diasAtras / 30)} meses`;
    }

    const dataFormatada = new Date(ultimaExecucao.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    return (
      <div className={`${corFundo} border ${corBorda} rounded-lg p-2.5`}>
        <p className={`text-xs ${corTexto} font-medium flex items-center gap-1.5`}>
          <span>{icone}</span>
          <span>{mensagem} • {dataFormatada} • Culto #{ultimaExecucao.cultoNr}</span>
        </p>
      </div>
    );
  };

  return (
    <div className={`${corCard} border-2 rounded-2xl p-4 shadow-sm transition-all`}>
      {/* Header com posição e botões de movimento/remover */}
      <div className="flex items-center justify-between mb-4">
        <span className="inline-block bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
          Posição {item.ordem}
        </span>
        
        <div className="flex gap-2">
          {index > 0 && (
            <button
              onClick={onMoveUp}
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold touch-manipulation"
              type="button"
            >
              ⬆️
            </button>
          )}
          
          {index < total - 1 && (
            <button
              onClick={onMoveDown}
              className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold touch-manipulation"
              type="button"
            >
              ⬇️
            </button>
          )}
          
          <button
            onClick={onRemove}
            className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold touch-manipulation"
            type="button"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Campo de Tipo Litúrgico */}
      <div className="mb-3">
        <label className="text-sm font-bold text-slate-700 mb-2 block">
          🎭 Tipo Litúrgico
        </label>
        <select
          value={item.tipo}
          onChange={e => onUpdate({ ...item, tipo: e.target.value })}
          className="w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-base focus:border-emerald-600 focus:outline-none touch-manipulation bg-white"
        >
          {TIPOS_LITURGIA.map(tipo => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </div>

      {/* Cântico */}
      {item.tipo !== 'Pregação' && (
        <>
          <div className="mb-3">
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              🎵 Cântico
            </label>
            <CanticoAutocomplete
              value={canticoSelecionado}
              onChange={c => onUpdate({ ...item, cantico_id: c?.id || null })}
              canticos={canticos}
              onCreate={onCreate}
            />
          </div>

          {/* Informação da última execução */}
          {item.cantico_id && (
            <div className="mb-4 -mt-2">
              {formatarUltimaExecucao()}
            </div>
          )}

          {/* Tom */}
          <div>
            <label className="text-sm font-bold text-slate-700 mb-2 block">
              🎼 Tom (opcional)
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
          <p className="text-sm text-amber-800 font-medium">
            📖 Momento da pregação (não requer cântico)
          </p>
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
                cultoAtualId={cultoEditando?.['Culto nr.'] || null}
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
            �🏠
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