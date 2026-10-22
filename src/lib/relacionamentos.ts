import { supabase } from '@/lib/supabase';

// UUIDs ocupam ~40 caracteres na URL; lotes deste tamanho ficam bem abaixo do limite do gateway.
const TAMANHO_LOTE = 150;

export interface RelacionamentoFamiliarRow {
  pessoa_id: string;
  pessoa_relacionada_id: string;
  tipo: string;
}

/**
 * Relacionamentos apenas das pessoas informadas, em lotes paralelos.
 * Buscar a tabela inteira ultrapassa o limite de 1000 linhas do PostgREST e
 * corta famílias sem aviso, além de trazer vínculos de outras igrejas.
 */
export async function buscarRelacionamentosDasPessoas(pessoaIds: string[]) {
  const ids = [...new Set(pessoaIds.filter(Boolean))];
  if (ids.length === 0) return [] as RelacionamentoFamiliarRow[];

  const lotes: string[][] = [];
  for (let inicio = 0; inicio < ids.length; inicio += TAMANHO_LOTE) {
    lotes.push(ids.slice(inicio, inicio + TAMANHO_LOTE));
  }

  const resultados = await Promise.all(
    lotes.map((lote) =>
      supabase
        .from('relacionamentos')
        .select('pessoa_id, pessoa_relacionada_id, tipo')
        .in('pessoa_id', lote)
    )
  );

  const erro = resultados.find((resultado) => resultado.error)?.error;
  if (erro) throw erro;

  return resultados.flatMap((resultado) => (resultado.data || []) as RelacionamentoFamiliarRow[]);
}
