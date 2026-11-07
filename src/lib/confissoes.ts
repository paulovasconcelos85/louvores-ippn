import { getSupabaseAdmin } from '@/lib/igreja-onboarding';

// Confissões e catecismos (sql/2026-11-07_confissoes.sql): biblioteca pública
// e "texto do dia" do boletim, em ciclo por todos os documentos.

export interface DocumentoConfessional {
  id: string;
  titulo: string;
  sigla: string;
  ano: string | null;
  descricao: string | null;
  ordem_ciclo: number;
  fonte_url: string;
}

export interface ItemConfessional {
  id: string;
  documento_id: string;
  ordem: number;
  secao: string | null;
  rotulo: string;
  pergunta: string | null;
  texto: string;
  referencias: string | null;
}

// Dia 0 do ciclo: o texto do dia avança um item por dia a partir desta data.
const INICIO_CICLO = Date.UTC(2026, 0, 1);

export async function listarDocumentos(): Promise<DocumentoConfessional[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('confissoes_documentos')
    .select('id, titulo, sigla, ano, descricao, ordem_ciclo, fonte_url')
    .order('ordem_ciclo');
  if (error) throw error;
  return data || [];
}

export async function buscarDocumento(id: string) {
  const supabase = getSupabaseAdmin();
  const [{ data: documento, error }, { data: itens, error: itensError }] = await Promise.all([
    supabase
      .from('confissoes_documentos')
      .select('id, titulo, sigla, ano, descricao, ordem_ciclo, fonte_url')
      .eq('id', id)
      .maybeSingle<DocumentoConfessional>(),
    supabase
      .from('confissoes_itens')
      .select('id, documento_id, ordem, secao, rotulo, pergunta, texto, referencias')
      .eq('documento_id', id)
      .order('ordem'),
  ]);
  if (error) throw error;
  if (itensError) throw itensError;
  if (!documento) return null;
  return { documento, itens: (itens || []) as ItemConfessional[] };
}

// data: "AAAA-MM-DD" no fuso de quem lê.
export async function buscarItemDoDia(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const dias = Math.floor((Date.UTC(ano, mes - 1, dia) - INICIO_CICLO) / 86_400_000);

  const supabase = getSupabaseAdmin();
  const documentos = await listarDocumentos();
  const contagens = await Promise.all(
    documentos.map(async (documento) => {
      const { count, error } = await supabase
        .from('confissoes_itens')
        .select('id', { count: 'exact', head: true })
        .eq('documento_id', documento.id);
      if (error) throw error;
      return count || 0;
    })
  );

  const total = contagens.reduce((soma, valor) => soma + valor, 0);
  if (total === 0) return null;

  // Posição no ciclo (também para datas antes do início).
  let posicao = ((dias % total) + total) % total;
  for (let i = 0; i < documentos.length; i += 1) {
    if (posicao < contagens[i]) {
      const { data: item, error } = await supabase
        .from('confissoes_itens')
        .select('id, documento_id, ordem, secao, rotulo, pergunta, texto, referencias')
        .eq('documento_id', documentos[i].id)
        .eq('ordem', posicao + 1)
        .maybeSingle<ItemConfessional>();
      if (error) throw error;
      return item ? { documento: documentos[i], item } : null;
    }
    posicao -= contagens[i];
  }
  return null;
}
