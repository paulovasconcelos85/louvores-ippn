import { supabase } from '@/lib/supabase';
import type { TablesInsert } from '@/lib/database.types';
import type { Locale } from '@/i18n/config';
import { resolveLocalizedText } from '@/lib/church-i18n';
import { BOLETIM_FALLBACK_TIPO_PREFIX, LITURGIA_META_TIPO, type Cantico, type BoletimSecaoRascunho, type Culto, type LouvorItemRow, type LouvorItemRowComCantico, type CultoLookupRow, type StructuredBoletimSecaoRow, type StructuredBoletimItemRow, MESES_HISTORICO_CANTICOS } from './tipos';
import { normalizeModoRepertorio } from './canticos';
import { getCultoDateKey, isUuid, erroColunaNaoEncontrada } from './liturgia';
import { clonarSecoesBoletimRascunho, buildBoletimSecoesFromFallbackRows, buildBoletimSecoesEstruturadasPorCulto, buildBoletimFallbackRows } from './boletim';

export async function carregarBoletimSecoesEstruturadasPorCulto(
  igrejaId: string,
  cultoIds: number[],
  locale: Locale
) {
  if (cultoIds.length === 0) {
    return new Map<number, BoletimSecaoRascunho[]>();
  }

  const { data: secoesRaw, error: secoesError } = await supabase
    .from('boletim_secoes')
    .select('id, igreja_id, culto_id, tipo, titulo, titulo_i18n, icone, ordem, visivel')
    .eq('igreja_id', igrejaId)
    .in('culto_id', cultoIds)
    .order('culto_id', { ascending: true })
    .order('ordem', { ascending: true });

  if (secoesError) throw secoesError;

  const secoes = (secoesRaw || []) as StructuredBoletimSecaoRow[];
  const secaoIds = secoes
    .map((secao) => secao.id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  if (secaoIds.length === 0) {
    return new Map<number, BoletimSecaoRascunho[]>();
  }

  const { data: itensRaw, error: itensError } = await supabase
    .from('boletim_itens')
    .select('*')
    .in('secao_id', secaoIds)
    .order('ordem', { ascending: true });

  if (itensError) throw itensError;

  return buildBoletimSecoesEstruturadasPorCulto(
    secoes,
    (itensRaw || []) as StructuredBoletimItemRow[],
    locale
  );
}

export async function carregarUltimasSecoesBoletimPorTipo(
  igrejaId: string,
  diaAtual: string,
  tipoDesejado: string | null,
  locale: Locale
): Promise<{ secoes: BoletimSecaoRascunho[]; origemDia: string | null }> {
  const { data: cultosAnterioresRaw, error: cultosError } = await supabase
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia')
    .eq('igreja_id', igrejaId)
    .lt('Dia', getCultoDateKey(diaAtual))
    .order('Dia', { ascending: false })
    .limit(40);

  if (cultosError) throw cultosError;

  const cultosAnteriores = (cultosAnterioresRaw || []) as CultoLookupRow[];
  if (cultosAnteriores.length === 0) {
    return { secoes: [], origemDia: null };
  }

  const cultoIds = cultosAnteriores
    .map((culto) => culto['Culto nr.'])
    .filter((cultoId): cultoId is number => typeof cultoId === 'number');

  if (cultoIds.length === 0) {
    return { secoes: [], origemDia: null };
  }

  const cultosAgrupadosPorDia = new Map<string, number[]>();
  cultosAnteriores.forEach((culto) => {
    const dia = getCultoDateKey(culto.Dia);
    const atuais = cultosAgrupadosPorDia.get(dia) || [];
    atuais.push(culto['Culto nr.']);
    cultosAgrupadosPorDia.set(dia, atuais);
  });

  const secoesEstruturadasPorCulto = await carregarBoletimSecoesEstruturadasPorCulto(
    igrejaId,
    cultoIds,
    locale
  );

  if (secoesEstruturadasPorCulto.size > 0) {
    for (const [dia, idsDoDia] of cultosAgrupadosPorDia.entries()) {
      const secoesDoDia =
        idsDoDia
          .map((cultoId) => secoesEstruturadasPorCulto.get(cultoId) || [])
          .find((secoes) => secoes.length > 0)
          ?.filter(
            (secao) =>
              (tipoDesejado === null || secao.tipo === tipoDesejado) &&
              secao.itens.some((item) => item.conteudo.trim().length > 0)
          ) || [];

      if (secoesDoDia.length > 0) {
        return {
          secoes: clonarSecoesBoletimRascunho(secoesDoDia),
          origemDia: dia,
        };
      }
    }
  }

  const { data: fallbackRowsRaw, error: fallbackError } = await supabase
    .from('louvor_itens')
    .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
    .in('culto_id', cultoIds)
    .like('tipo', `${BOLETIM_FALLBACK_TIPO_PREFIX}%`)
    .order('ordem', { ascending: true });

  if (fallbackError) throw fallbackError;

  const fallbackRows = (fallbackRowsRaw || []) as LouvorItemRow[];
  if (fallbackRows.length === 0) {
    return { secoes: [], origemDia: null };
  }

  const rowsPorCulto = new Map<number, LouvorItemRow[]>();
  fallbackRows.forEach((row) => {
    const atuais = rowsPorCulto.get(row.culto_id) || [];
    atuais.push(row);
    rowsPorCulto.set(row.culto_id, atuais);
  });

  for (const [dia, idsDoDia] of cultosAgrupadosPorDia.entries()) {
    const rowsDoDia = idsDoDia.flatMap((cultoId) => rowsPorCulto.get(cultoId) || []);
    const secoesDoDia = buildBoletimSecoesFromFallbackRows(rowsDoDia, locale).filter(
      (secao) =>
        (tipoDesejado === null || secao.tipo === tipoDesejado) &&
        secao.itens.some((item) => item.conteudo.trim().length > 0)
    );

    if (secoesDoDia.length > 0) {
      return {
        secoes: clonarSecoesBoletimRascunho(secoesDoDia),
        origemDia: dia,
      };
    }
  }

  return { secoes: [], origemDia: null };
}

export async function buscarPastorPadrao(igrejaId: string): Promise<string | null> {
  try {
    const { data: vinculosPastor, error: vinculoError } = await supabase
      .from('pessoas_igrejas')
      .select('pessoa_id')
      .eq('igreja_id', igrejaId)
      .eq('cargo', 'pastor')
      .eq('ativo', true)
      .limit(10);

    if (!vinculoError) {
      const pessoaIds = (vinculosPastor || [])
        .map((item) => item.pessoa_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      if (pessoaIds.length > 0) {
        const { data: pessoasData, error: pessoasError } = await supabase
          .from('pessoas')
          .select('id, nome')
          .in('id', pessoaIds)
          .order('nome', { ascending: true })
          .limit(1);

        if (!pessoasError) {
          const nomeVinculado =
            typeof pessoasData?.[0]?.nome === 'string' ? pessoasData[0].nome.trim() : '';

          if (nomeVinculado) {
            return nomeVinculado;
          }
        } else {
          console.warn('Falha ao buscar nomes dos pastores vinculados:', pessoasError);
        }
      }
    } else {
      console.warn('Falha ao buscar pastor por vínculo da igreja:', vinculoError);
    }

    return null;
  } catch (error) {
    console.warn('Falha inesperada ao buscar pastor padrão da igreja:', error);
    return null;
  }
}

export async function carregarLouvorItensComCanticos(
  cultoId: number,
  canticosFallback: Cantico[] = [],
  igrejaId?: string | null
): Promise<LouvorItemRowComCantico[]> {
  const { data: itens, error: itensError } = await supabase
    .from('louvor_itens')
    .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
    .eq('culto_id', cultoId)
    .order('ordem');

  if (itensError) throw itensError;

  const itemRows = (itens || []) as LouvorItemRow[];
  const canticoIds = Array.from(
    new Set(
      itemRows
        .map((item) => item.cantico_id)
        .filter(Boolean)
        .map((value) => String(value))
    )
  );
  const canticoIdsUuid = canticoIds.filter(isUuid);
  const canticoIdsHinario = canticoIds
    .filter((value) => !isUuid(value) && /^\d+$/.test(value))
    .map((value) => Number(value));

  const [canticosLegadosResult, hinarioNovoCanticoResult, canticosUnificadosResult] =
    canticoIds.length > 0
      ? await Promise.all([
          canticoIdsUuid.length > 0
            ? (() => {
                let query = supabase.from('canticos').select('id, nome').in('id', canticoIdsUuid);

                if (igrejaId) {
                  query = query.eq('igreja_id', igrejaId);
                }

                return query;
              })()
            : Promise.resolve({ data: [], error: null }),
          canticoIdsHinario.length > 0
            ? supabase.from('hinario_novo_cantico').select('id, titulo').in('id', canticoIdsHinario)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('canticos_unificados').select('id, nome').in('id', canticoIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (canticosLegadosResult.error) throw canticosLegadosResult.error;
  if (hinarioNovoCanticoResult.error) throw hinarioNovoCanticoResult.error;
  if (canticosUnificadosResult.error) throw canticosUnificadosResult.error;

  const canticosPorId = new Map<string, string | null>();

  canticosFallback.forEach((cantico) => {
    canticosPorId.set(String(cantico.id), cantico.nome);
  });

  ((canticosLegadosResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId) || !canticosPorId.get(canticoId)) {
      canticosPorId.set(canticoId, cantico.nome);
    }
  });

  ((hinarioNovoCanticoResult.data || []) as Array<{ id: string | number; titulo: string | null }>).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId) || !canticosPorId.get(canticoId)) {
      canticosPorId.set(canticoId, cantico.titulo);
    }
  });

  ((canticosUnificadosResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId) || !canticosPorId.get(canticoId)) {
      canticosPorId.set(canticoId, cantico.nome);
    }
  });

  return itemRows.map((item) => ({
    ...item,
    canticos: item.cantico_id
      ? { nome: canticosPorId.get(String(item.cantico_id)) || null }
      : null,
  }));
}

export async function inserirLouvorItensComCompatibilidadeI18n(rows: TablesInsert<'louvor_itens'>[]) {
  if (rows.length === 0) return;

  const insertResult = await supabase.from('louvor_itens').insert(rows);
  if (!insertResult.error) return;

  if (!erroColunaNaoEncontrada(insertResult.error, 'conteudo_publico_i18n')) {
    throw insertResult.error;
  }

  const rowsSemI18n = rows.map(({ conteudo_publico_i18n, ...row }) => {
    void conteudo_publico_i18n;
    return row;
  });
  const fallbackResult = await supabase.from('louvor_itens').insert(rowsSemI18n);

  if (fallbackResult.error) throw fallbackResult.error;
}

export async function sincronizarBoletimFallbackLegado(
  cultoIds: number[],
  secoes: BoletimSecaoRascunho[]
) {
  if (cultoIds.length === 0) return;

  try {
    const fallbackRows = cultoIds.flatMap((cultoId) =>
      buildBoletimFallbackRows(secoes, 1000).map((row) => ({
        id: crypto.randomUUID(),
        culto_id: cultoId,
        ...row,
      }))
    );

    await inserirLouvorItensComCompatibilidadeI18n(fallbackRows);

    const fallbackRowIds = fallbackRows.map((row) => row.id);
    const deleteQuery = supabase
      .from('louvor_itens')
      .delete()
      .in('culto_id', cultoIds)
      .like('tipo', `${BOLETIM_FALLBACK_TIPO_PREFIX}%`);

    const { error: deleteFallbackError } = fallbackRowIds.length > 0
      ? await deleteQuery.not('id', 'in', `(${fallbackRowIds.join(',')})`)
      : await deleteQuery;

    if (deleteFallbackError) throw deleteFallbackError;
  } catch (error) {
    console.warn('Falha ao sincronizar fallback legado do boletim:', error);
  }
}

export async function uploadImagemTema(file: File, cultoNr: number): Promise<string> {
  const ext = file.name.split('.').pop();
  const nome = `culto-${cultoNr}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('liturgias_thumbnails').upload(nome, file, { upsert: false });
  if (error) throw new Error(`Falha ao fazer upload da imagem: ${error.message}`);
  const { data } = supabase.storage.from('liturgias_thumbnails').getPublicUrl(nome);
  return data.publicUrl;
}

// --- PÁGINA PRINCIPAL ---
// A tela abre para criar o boletim novo; os antigos só são buscados quando alguém pede.
export const LIMITE_CULTOS_RECENTES = 12;

// Com limite por linha, o dia mais antigo pode vir pela metade; descarta-o para não exibir um boletim incompleto.
export function recortarDiaIncompleto(cultos: Culto[], limite: number) {
  if (cultos.length < limite) return cultos;

  const diaMaisAntigo = getCultoDateKey(cultos[cultos.length - 1].Dia);
  const completos = cultos.filter((culto) => getCultoDateKey(culto.Dia) !== diaMaisAntigo);
  return completos.length > 0 ? completos : cultos;
}

export async function anexarNomesLiturgia(cultosBase: Culto[], locale: Locale): Promise<Culto[]> {
  if (cultosBase.length === 0) return cultosBase;

  try {
    const { data: nomesLiturgiaRows, error: nomesLiturgiaError } = await supabase
      .from('louvor_itens')
      .select('culto_id, conteudo_publico, conteudo_publico_i18n, ordem')
      .in('culto_id', cultosBase.map((culto) => culto['Culto nr.']))
      .eq('tipo', LITURGIA_META_TIPO)
      .order('ordem', { ascending: true });

    if (nomesLiturgiaError) {
      console.warn('Falha ao carregar nomes das liturgias:', nomesLiturgiaError);
      return cultosBase;
    }

    const nomesPorCulto = new Map<number, string>();

    (nomesLiturgiaRows || []).forEach((row: any) => {
      const cultoId = typeof row.culto_id === 'number' ? row.culto_id : Number(row.culto_id);
      const nome = resolveLocalizedText(
        row.conteudo_publico_i18n,
        locale,
        typeof row.conteudo_publico === 'string' ? row.conteudo_publico.trim() : ''
      );

      if (Number.isFinite(cultoId) && nome && !nomesPorCulto.has(cultoId)) {
        nomesPorCulto.set(cultoId, nome);
      }
    });

    return cultosBase.map((culto) => ({
      ...culto,
      nome_liturgia: nomesPorCulto.get(culto['Culto nr.']) || null,
    }));
  } catch (error) {
    console.warn('Falha inesperada ao carregar nomes das liturgias:', error);
    return cultosBase;
  }
}

// Busca o hinário só quando o modo de repertório o usa, e sem trazer as letras.
export async function consultarHinario(modoRepertorioRaw: unknown) {
  const modo = normalizeModoRepertorio(modoRepertorioRaw);
  if (modo === 'livre' || modo === 'canticos') return { data: [] };

  let query = supabase.from('hinario_novo_cantico').select('id, numero, titulo').order('numero');
  if (modo === 'hinario') {
    query = query.not('letra', 'is', null).neq('letra', '');
  }
  const { data } = await query;
  return { data };
}

// Última vez que cada cântico foi usado nesta igreja, olhando só os últimos meses.
export async function carregarUltimoUsoCanticos(igrejaId: string) {
  const inicio = new Date();
  inicio.setMonth(inicio.getMonth() - MESES_HISTORICO_CANTICOS);

  const { data: cultosRecentes, error: cultosError } = await supabase
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia')
    .eq('igreja_id', igrejaId)
    .gte('Dia', inicio.toISOString().slice(0, 10));
  if (cultosError) throw cultosError;
  if (!cultosRecentes || cultosRecentes.length === 0) return new Map<string, string>();

  const diaPorCulto = new Map(cultosRecentes.map((culto: any) => [culto['Culto nr.'], culto.Dia as string]));
  const { data: itens, error: itensError } = await supabase
    .from('louvor_itens')
    .select('cantico_id, culto_id')
    .in('culto_id', [...diaPorCulto.keys()])
    .not('cantico_id', 'is', null);
  if (itensError) throw itensError;

  const ultimoUso = new Map<string, string>();
  (itens || []).forEach((item: any) => {
    const dia = diaPorCulto.get(item.culto_id);
    const chave = String(item.cantico_id);
    if (dia && (!ultimoUso.has(chave) || dia > ultimoUso.get(chave)!)) {
      ultimoUso.set(chave, dia);
    }
  });
  return ultimoUso;
}
