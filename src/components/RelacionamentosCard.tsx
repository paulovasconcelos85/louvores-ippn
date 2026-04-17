'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoredChurchId } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { useLocale } from '@/i18n/provider';
import { Users, Plus, Trash2, Search } from 'lucide-react';

type TipoRelacionamento =
  | 'conjuge' | 'pai' | 'mae' | 'filho' | 'filha'
  | 'irmao' | 'irma' | 'avo_paterno' | 'avo_paterna'
  | 'avo_materno' | 'avo_materna' | 'neto' | 'neta'
  | 'cunhado' | 'cunhada' | 'sogro' | 'sogra'
  | 'genro' | 'nora' | 'tio' | 'tia'
  | 'sobrinho' | 'sobrinha' | 'primo' | 'prima';

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
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
  const tipoLabels: Record<TipoRelacionamento, string> = {
    conjuge: tr('Cônjuge', 'Cónyuge', 'Spouse'),
    pai: tr('Pai', 'Padre', 'Father'),
    mae: tr('Mãe', 'Madre', 'Mother'),
    filho: tr('Filho', 'Hijo', 'Son'),
    filha: tr('Filha', 'Hija', 'Daughter'),
    irmao: tr('Irmão', 'Hermano', 'Brother'),
    irma: tr('Irmã', 'Hermana', 'Sister'),
    avo_paterno: tr('Avô Paterno', 'Abuelo Paterno', 'Paternal Grandfather'),
    avo_paterna: tr('Avó Paterna', 'Abuela Paterna', 'Paternal Grandmother'),
    avo_materno: tr('Avô Materno', 'Abuelo Materno', 'Maternal Grandfather'),
    avo_materna: tr('Avó Materna', 'Abuela Materna', 'Maternal Grandmother'),
    neto: tr('Neto', 'Nieto', 'Grandson'),
    neta: tr('Neta', 'Nieta', 'Granddaughter'),
    cunhado: tr('Cunhado', 'Cuñado', 'Brother-in-law'),
    cunhada: tr('Cunhada', 'Cuñada', 'Sister-in-law'),
    sogro: tr('Sogro', 'Suegro', 'Father-in-law'),
    sogra: tr('Sogra', 'Suegra', 'Mother-in-law'),
    genro: tr('Genro', 'Yerno', 'Son-in-law'),
    nora: tr('Nora', 'Nuera', 'Daughter-in-law'),
    tio: tr('Tio', 'Tío', 'Uncle'),
    tia: tr('Tia', 'Tía', 'Aunt'),
    sobrinho: tr('Sobrinho', 'Sobrino', 'Nephew'),
    sobrinha: tr('Sobrinha', 'Sobrina', 'Niece'),
    primo: tr('Primo', 'Primo', 'Cousin'),
    prima: tr('Prima', 'Prima', 'Cousin'),
  };
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

  const carregarRelacionamentos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const igrejaId = getStoredChurchId();
      if (igrejaId) params.set('igreja_id', igrejaId);
      params.set('ativo', 'true');

      const pessoasResponse = await fetch(`/api/pessoas?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const pessoasPayload = await pessoasResponse.json();

      if (!pessoasResponse.ok) {
        throw new Error(
          pessoasPayload.error ||
            tr(
              'Erro ao carregar pessoas',
              'Error al cargar personas',
              'Error loading people'
            )
        );
      }

      const pessoasMap = new Map(
        ((pessoasPayload.data || []) as Array<Relacionamento['pessoa_relacionada']>).map((pessoa) => [pessoa.id, pessoa])
      );

      const { data, error } = await supabase
        .from('relacionamentos')
        .select(`
          id,
          tipo,
          pessoa_relacionada_id
        `)
        .eq('pessoa_id', membroId)
        .order('tipo');

      if (error) throw error;

      const formatados = (data || [])
        .map((r: any) => {
          const pessoaRelacionada = pessoasMap.get(r.pessoa_relacionada_id);
          if (!pessoaRelacionada) return null;

          return {
            id: r.id,
            tipo: r.tipo as TipoRelacionamento,
            pessoa_relacionada: pessoaRelacionada,
          };
        })
        .filter(Boolean) as Relacionamento[];

      setRelacionamentos(formatados);
    } catch (err) {
      console.error('Erro ao carregar relacionamentos:', err);
    } finally {
      setLoading(false);
    }
  }, [membroId, tr]);

  useEffect(() => {
    void carregarRelacionamentos();
  }, [carregarRelacionamentos]);

  // Busca pessoas com debounce simples
  useEffect(() => {
    if (busca.length < 2) {
      setPessoas([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams();
        const igrejaId = getStoredChurchId();
        if (igrejaId) params.set('igreja_id', igrejaId);
        params.set('ativo', 'true');
        params.set('busca', busca);

        const response = await fetch(`/api/pessoas?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ||
              tr(
                'Erro ao buscar pessoas',
                'Error al buscar personas',
                'Error searching people'
              )
          );
        }

        setPessoas(
          ((payload.data || []) as PessoaOpcao[])
            .filter((pessoa) => pessoa.id !== membroId)
            .slice(0, 8)
        );
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, membroId, tr]);

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
          setMensagem(
            tr(
              'Este relacionamento já está cadastrado.',
              'Esta relación ya está registrada.',
              'This relationship is already registered.'
            )
          );
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
      setMensagem(
        tr(
          'Erro ao salvar relacionamento.',
          'Error al guardar la relación.',
          'Error saving relationship.'
        )
      );
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string, pessoaRelacionadaId: string) => {
    if (
      !confirm(
        tr(
          'Remover este relacionamento? O inverso também será removido.',
          '¿Eliminar esta relación? La relación inversa también será eliminada.',
          'Remove this relationship? The reverse relationship will also be removed.'
        )
      )
    ) {
      return;
    }
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
    const label = tipoLabels[r.tipo] ?? r.tipo;
    if (!acc[label]) acc[label] = [];
    acc[label].push(r);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          {tr('Família', 'Familia', 'Family')}
        </h3>
        {podeEditar && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {tr('Adicionar', 'Agregar', 'Add')}
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
          <p className="text-sm">
            {tr(
              'Nenhum relacionamento cadastrado',
              'No hay relaciones registradas',
              'No relationships registered'
            )}
          </p>
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
                          {tipoLabels[r.tipo]}
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
                {tr('Adicionar Relacionamento', 'Agregar Relación', 'Add Relationship')}
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
                  {tr('Buscar membro', 'Buscar miembro', 'Search member')} *
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
                      {tr('Trocar', 'Cambiar', 'Change')}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder={tr('Digite o nome...', 'Escribe el nombre...', 'Type the name...')}
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
                        {tr('Nenhum membro encontrado', 'No se encontraron miembros', 'No members found')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {membroNome} {tr('é', 'es', 'is')} <strong>__</strong>{' '}
                  {tr('de', 'de', 'of')} {pessoaSelecionada?.nome ?? '...'}
                </label>
                <select
                  value={tipoSelecionado}
                  onChange={(e) => setTipoSelecionado(e.target.value as TipoRelacionamento)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {(Object.entries(tipoLabels) as [TipoRelacionamento, string][]).map(
                    ([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    )
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {tr(
                    'O relacionamento inverso será criado automaticamente.',
                    'La relación inversa se creará automáticamente.',
                    'The reverse relationship will be created automatically.'
                  )}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={salvar}
                  disabled={!pessoaSelecionada || salvando}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {salvando
                    ? tr('Salvando...', 'Guardando...', 'Saving...')
                    : tr('Salvar', 'Guardar', 'Save')}
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
