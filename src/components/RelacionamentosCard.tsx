'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Plus, Trash2, Search } from 'lucide-react';

type TipoRelacionamento =
  | 'conjuge' | 'pai' | 'mae' | 'filho' | 'filha'
  | 'irmao' | 'irma' | 'avo_paterno' | 'avo_paterna'
  | 'avo_materno' | 'avo_materna' | 'neto' | 'neta'
  | 'cunhado' | 'cunhada' | 'sogro' | 'sogra'
  | 'genro' | 'nora' | 'tio' | 'tia'
  | 'sobrinho' | 'sobrinha' | 'primo' | 'prima';

const TIPO_LABELS: Record<TipoRelacionamento, string> = {
  conjuge: 'Cônjuge',
  pai: 'Pai',
  mae: 'Mãe',
  filho: 'Filho',
  filha: 'Filha',
  irmao: 'Irmão',
  irma: 'Irmã',
  avo_paterno: 'Avô Paterno',
  avo_paterna: 'Avó Paterna',
  avo_materno: 'Avô Materno',
  avo_materna: 'Avó Materna',
  neto: 'Neto',
  neta: 'Neta',
  cunhado: 'Cunhado',
  cunhada: 'Cunhada',
  sogro: 'Sogro',
  sogra: 'Sogra',
  genro: 'Genro',
  nora: 'Nora',
  tio: 'Tio',
  tia: 'Tia',
  sobrinho: 'Sobrinho',
  sobrinha: 'Sobrinha',
  primo: 'Primo',
  prima: 'Prima',
};

const GRAU_COR: Record<string, string> = {
  conjuge: 'bg-pink-100 text-pink-800 border-pink-300',
  pai: 'bg-blue-100 text-blue-800 border-blue-300',
  mae: 'bg-blue-100 text-blue-800 border-blue-300',
  filho: 'bg-green-100 text-green-800 border-green-300',
  filha: 'bg-green-100 text-green-800 border-green-300',
  irmao: 'bg-purple-100 text-purple-800 border-purple-300',
  irma: 'bg-purple-100 text-purple-800 border-purple-300',
  avo_paterno: 'bg-amber-100 text-amber-800 border-amber-300',
  avo_paterna: 'bg-amber-100 text-amber-800 border-amber-300',
  avo_materno: 'bg-amber-100 text-amber-800 border-amber-300',
  avo_materna: 'bg-amber-100 text-amber-800 border-amber-300',
  neto: 'bg-teal-100 text-teal-800 border-teal-300',
  neta: 'bg-teal-100 text-teal-800 border-teal-300',
  cunhado: 'bg-slate-100 text-slate-800 border-slate-300',
  cunhada: 'bg-slate-100 text-slate-800 border-slate-300',
  sogro: 'bg-orange-100 text-orange-800 border-orange-300',
  sogra: 'bg-orange-100 text-orange-800 border-orange-300',
  genro: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  nora: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  tio: 'bg-violet-100 text-violet-800 border-violet-300',
  tia: 'bg-violet-100 text-violet-800 border-violet-300',
  sobrinho: 'bg-lime-100 text-lime-800 border-lime-300',
  sobrinha: 'bg-lime-100 text-lime-800 border-lime-300',
  primo: 'bg-rose-100 text-rose-800 border-rose-300',
  prima: 'bg-rose-100 text-rose-800 border-rose-300',
};

interface Relacionamento {
  id: string;
  tipo: TipoRelacionamento;
  pessoa_relacionada: {
    id: string;
    nome: string;
    cargo: string;
    status_membro: string;
  };
}

interface PessoaOpcao {
  id: string;
  nome: string;
}

interface Props {
  membroId: string;
  membroNome: string;
  autorId: string | undefined;
  podeEditar: boolean;
  onNavegar: (id: string) => void;
}

export default function RelacionamentosCard({
  membroId,
  membroNome,
  autorId,
  podeEditar,
  onNavegar,
}: Props) {
  const [relacionamentos, setRelacionamentos] = useState<Relacionamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Form
  const [busca, setBusca] = useState('');
  const [pessoas, setPessoas] = useState<PessoaOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaOpcao | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoRelacionamento>('conjuge');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarRelacionamentos();
  }, [membroId]);

  const carregarRelacionamentos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('relacionamentos')
        .select(`
          id,
          tipo,
          pessoa_relacionada:pessoa_relacionada_id (
            id,
            nome,
            cargo,
            status_membro
          )
        `)
        .eq('pessoa_id', membroId)
        .order('tipo');

      if (error) throw error;

      const formatados = (data || []).map((r: any) => ({
        id: r.id,
        tipo: r.tipo as TipoRelacionamento,
        pessoa_relacionada: r.pessoa_relacionada,
      }));

      setRelacionamentos(formatados);
    } catch (err) {
      console.error('Erro ao carregar relacionamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Busca pessoas com debounce simples
  useEffect(() => {
    if (busca.length < 2) {
      setPessoas([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await supabase
          .from('pessoas')
          .select('id, nome')
          .ilike('nome', `%${busca}%`)
          .neq('id', membroId)
          .eq('ativo', true)
          .limit(8);
        setPessoas(data || []);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, membroId]);

  const salvar = async () => {
    if (!pessoaSelecionada) return;
    setSalvando(true);
    setMensagem('');
    try {
      const { error } = await supabase
        .from('relacionamentos')
        .insert({
          pessoa_id: membroId,
          pessoa_relacionada_id: pessoaSelecionada.id,
          tipo: tipoSelecionado,
          criado_por: autorId ?? null,
        });

      if (error) {
        if (error.code === '23505') {
          setMensagem('Este relacionamento já está cadastrado.');
        } else {
          throw error;
        }
        return;
      }

      setModalAberto(false);
      setBusca('');
      setPessoaSelecionada(null);
      setTipoSelecionado('conjuge');
      await carregarRelacionamentos();
    } catch (err) {
      console.error(err);
      setMensagem('Erro ao salvar relacionamento.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string, pessoaRelacionadaId: string) => {
    if (!confirm('Remover este relacionamento? O inverso também será removido.')) return;
    try {
      // Remove os dois lados
      await supabase
        .from('relacionamentos')
        .delete()
        .or(`id.eq.${id},and(pessoa_id.eq.${pessoaRelacionadaId},pessoa_relacionada_id.eq.${membroId})`);

      await carregarRelacionamentos();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  // Agrupa por tipo para exibição
  const agrupados = relacionamentos.reduce<Record<string, Relacionamento[]>>((acc, r) => {
    const label = TIPO_LABELS[r.tipo] ?? r.tipo;
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          Família
        </h3>
        {podeEditar && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
        </div>
      ) : relacionamentos.length === 0 ? (
        <div className="text-center py-6 text-slate-500">
          <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">Nenhum relacionamento cadastrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(agrupados).map(([tipoLabel, itens]) => (
            <div key={tipoLabel}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {tipoLabel}
              </p>
              <div className="space-y-2">
                {itens.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                  >
                    <button
                      className="flex items-center gap-3 flex-1 text-left"
                      onClick={() => onNavegar(r.pessoa_relacionada.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-sm flex-shrink-0">
                        {r.pessoa_relacionada.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {r.pessoa_relacionada.nome}
                        </p>
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${
                            GRAU_COR[r.tipo] ?? 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {TIPO_LABELS[r.tipo]}
                        </span>
                      </div>
                    </button>

                    {podeEditar && (
                      <button
                        onClick={() => excluir(r.id, r.pessoa_relacionada.id)}
                        className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Adicionar Relacionamento
              </h3>
              <button
                onClick={() => {
                  setModalAberto(false);
                  setBusca('');
                  setPessoaSelecionada(null);
                  setMensagem('');
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {mensagem && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {mensagem}
                </div>
              )}

              {/* Busca de pessoa */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Buscar membro *
                </label>
                {pessoaSelecionada ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-semibold text-sm">
                        {pessoaSelecionada.nome.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-blue-900">
                        {pessoaSelecionada.nome}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setPessoaSelecionada(null);
                        setBusca('');
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Digite o nome..."
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      autoFocus
                    />
                    {buscando && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                      </div>
                    )}
                    {pessoas.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {pessoas.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setPessoaSelecionada(p);
                              setBusca('');
                              setPessoas([]);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm text-slate-800 flex items-center gap-2 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs flex-shrink-0">
                              {p.nome.charAt(0).toUpperCase()}
                            </div>
                            {p.nome}
                          </button>
                        ))}
                      </div>
                    )}
                    {busca.length >= 2 && !buscando && pessoas.length === 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-500">
                        Nenhum membro encontrado
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {membroNome} é <strong>__</strong> de {pessoaSelecionada?.nome ?? '...'}
                </label>
                <select
                  value={tipoSelecionado}
                  onChange={(e) => setTipoSelecionado(e.target.value as TipoRelacionamento)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {(Object.entries(TIPO_LABELS) as [TipoRelacionamento, string][]).map(
                    ([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    )
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  O relacionamento inverso será criado automaticamente.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={salvar}
                  disabled={!pessoaSelecionada || salvando}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => {
                    setModalAberto(false);
                    setBusca('');
                    setPessoaSelecionada(null);
                    setMensagem('');
                  }}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}