import { createClient } from '@supabase/supabase-js';
import https from 'node:https';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeIgreja } from '@/lib/church-utils';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';

function shouldAllowInsecureTls() {
  return process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0';
}

function isTlsCertificateChainError(error: unknown) {
  return (
    error instanceof Error &&
    /self-signed certificate in certificate chain/i.test(error.message)
  );
}

async function nodeHttpsFetchOnce(input: string | URL | Request, init?: RequestInit, rejectUnauthorized = true) {
  const requestUrl =
    input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
  const requestMethod = init?.method || (input instanceof Request ? input.method : 'GET');
  const requestHeaders = new Headers(input instanceof Request ? input.headers : init?.headers);
  const requestBody =
    init?.body ||
    (input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD' ? await input.text() : undefined);

  return new Promise<Response>((resolve, reject) => {
    const request = https.request(
      requestUrl,
      {
        method: requestMethod,
        headers: Object.fromEntries(requestHeaders.entries()),
        rejectUnauthorized,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on('end', () => {
          const body = Buffer.concat(chunks);
          const headers = new Headers();

          Object.entries(response.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach((headerValue) => headers.append(key, headerValue));
              return;
            }

            if (typeof value === 'string') {
              headers.set(key, value);
            }
          });

          resolve(
            new Response(body, {
              status: response.statusCode || 500,
              statusText: response.statusMessage || '',
              headers,
            })
          );
        });
      }
    );

    request.on('error', reject);

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

async function resilientServerFetch(input: string | URL | Request, init?: RequestInit) {
  try {
    return await nodeHttpsFetchOnce(input, init, !shouldAllowInsecureTls());
  } catch (error) {
    if (!shouldAllowInsecureTls() && isTlsCertificateChainError(error)) {
      return nodeHttpsFetchOnce(input, init, false);
    }

    throw error;
  }
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: resilientServerFetch,
    },
  }
);

interface BoletimSecaoRow {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
}

interface BoletimItemRow {
  id: string;
  secao_id: string | null;
  conteudo: string;
  destaque: boolean | null;
  ordem: number | null;
  criado_em: string | null;
}

interface LegacyLouvorItemRow {
  id: string;
  culto_id?: number;
  ordem: number | null;
  tipo: string | null;
  tom: string | null;
  cantico_id: string | null;
  conteudo_publico: string | null;
  descricao: string | null;
}

interface LegacyCultoRow {
  'Culto nr.': number;
  Dia: string;
  imagem_url: string | null;
  palavra_pastoral: string | null;
  palavra_pastoral_autor: string | null;
}

interface LegacyBoletimSecao {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
  itens: BoletimItemRow[];
}

interface BoletimFallbackMeta {
  secaoTitulo: string;
  secaoIcone: string | null;
  secaoVisivel: boolean;
  secaoOrdem: number;
  itemDestaque: boolean;
  itemOrdem: number;
}

const BOLETIM_FALLBACK_TIPO_PREFIX = '__boletim__:';

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isBoletimFallbackTipo(tipo: string | null | undefined): tipo is string {
  return typeof tipo === 'string' && tipo.startsWith(BOLETIM_FALLBACK_TIPO_PREFIX);
}

function extrairTipoBoletimFallback(tipo: string | null | undefined) {
  if (!isBoletimFallbackTipo(tipo)) return null;
  return tipo.slice(BOLETIM_FALLBACK_TIPO_PREFIX.length) || null;
}

function parseBoletimFallbackMeta(raw: string | null | undefined): BoletimFallbackMeta | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<BoletimFallbackMeta>;

    if (typeof parsed.secaoTitulo !== 'string') return null;
    if (typeof parsed.secaoOrdem !== 'number') return null;
    if (typeof parsed.itemOrdem !== 'number') return null;

    return {
      secaoTitulo: parsed.secaoTitulo,
      secaoIcone: typeof parsed.secaoIcone === 'string' ? parsed.secaoIcone : null,
      secaoVisivel: parsed.secaoVisivel !== false,
      secaoOrdem: parsed.secaoOrdem,
      itemDestaque: parsed.itemDestaque === true,
      itemOrdem: parsed.itemOrdem,
    };
  } catch {
    return null;
  }
}

function buildExtraSectionsFromFallbackRows(
  rows: LegacyLouvorItemRow[],
  cultoId: number
): LegacyBoletimSecao[] {
  const secoes = new Map<string, LegacyBoletimSecao>();
  const itemOrders = new Map<string, number>();

  rows.forEach((row) => {
    const tipo = extrairTipoBoletimFallback(row.tipo);
    const meta = parseBoletimFallbackMeta(row.descricao);
    const conteudo = row.conteudo_publico?.trim() || '';

    if (!tipo || !meta || !conteudo || meta.secaoVisivel === false) return;

    const key = `${meta.secaoOrdem}:${tipo}:${meta.secaoTitulo}`;

    if (!secoes.has(key)) {
      secoes.set(key, {
        id: `legacy-extra-${key}`,
        igreja_id: null,
        culto_id: cultoId,
        tipo,
        titulo: meta.secaoTitulo,
        icone: meta.secaoIcone,
        ordem: meta.secaoOrdem + 10,
        visivel: meta.secaoVisivel,
        criado_em: null,
        itens: [],
      });
    }

    secoes.get(key)?.itens.push({
      id: row.id,
      secao_id: `legacy-extra-${key}`,
      conteudo,
      destaque: meta.itemDestaque,
      ordem: meta.itemOrdem,
      criado_em: null,
    });
    itemOrders.set(row.id, meta.itemOrdem);
  });

  return [...secoes.values()]
    .map((secao) => ({
      ...secao,
      itens: [...secao.itens].sort(
        (a, b) => (itemOrders.get(a.id) || 0) - (itemOrders.get(b.id) || 0)
      ),
    }))
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

async function resolveCanticosPorId(canticoIdsRaw: Array<string | null>) {
  const canticoIds = Array.from(
    new Set(
      canticoIdsRaw
        .filter((value): value is string => Boolean(value))
        .map((value) => String(value))
    )
  );

  if (canticoIds.length === 0) {
    return new Map<string, { nome: string | null; tipo: 'hinario' | 'cantico'; numero: string | null }>();
  }

  const canticoIdsUuid = canticoIds.filter(isUuid);
  const canticoIdsHinario = canticoIds
    .filter((value) => !isUuid(value) && /^\d+$/.test(value))
    .map((value) => Number(value));
  const [canticosRawResult, hinarioNovoCanticoResult, canticosUnificadosResult] = await Promise.all([
    canticoIdsUuid.length > 0
      ? supabaseAdmin.from('canticos').select('id, nome').in('id', canticoIdsUuid)
      : Promise.resolve({ data: [], error: null }),
    canticoIdsHinario.length > 0
      ? supabaseAdmin.from('hinario_novo_cantico').select('id, numero, titulo').in('id', canticoIdsHinario)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('canticos_unificados').select('id, nome, tipo, numero').in('id', canticoIds),
  ]);

  if (canticosRawResult.error) throw canticosRawResult.error;
  if (hinarioNovoCanticoResult.error) throw hinarioNovoCanticoResult.error;
  if (canticosUnificadosResult.error) throw canticosUnificadosResult.error;

  const canticosPorId = new Map<string, { nome: string | null; tipo: 'hinario' | 'cantico'; numero: string | null }>();

  ((canticosRawResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    canticosPorId.set(String(cantico.id), {
      nome: cantico.nome,
      tipo: 'cantico',
      numero: null,
    });
  });

  (
    (hinarioNovoCanticoResult.data || []) as Array<{
      id: string | number;
      numero: string | null;
      titulo: string | null;
    }>
  ).forEach((cantico) => {
    const canticoId = String(cantico.id);
    if (!canticosPorId.has(canticoId)) {
      canticosPorId.set(canticoId, {
        nome: cantico.titulo,
        tipo: 'hinario',
        numero: cantico.numero || null,
      });
    }
  });

  ((canticosUnificadosResult.data || []) as Array<{ id: string; nome: string | null; tipo: 'hinario' | 'cantico' | null; numero: string | null }>).forEach((cantico) => {
    if (!canticosPorId.has(String(cantico.id))) {
      canticosPorId.set(String(cantico.id), {
        nome: cantico.nome,
        tipo: cantico.tipo === 'hinario' ? 'hinario' : 'cantico',
        numero: cantico.numero || null,
      });
    }
  });

  return canticosPorId;
}

function mergeLiturgiaSecao(
  secoes: LegacyBoletimSecao[],
  liturgiaSecao: LegacyBoletimSecao | null
) {
  if (!liturgiaSecao) return secoes;

  const semLiturgia = secoes.filter((secao) => secao.tipo !== 'liturgia');
  const secaoExistente = secoes.find((secao) => secao.tipo === 'liturgia');
  const secaoMesclada: LegacyBoletimSecao = {
    ...liturgiaSecao,
    id: secaoExistente?.id || liturgiaSecao.id,
    titulo: secaoExistente?.titulo || liturgiaSecao.titulo,
    icone: secaoExistente?.icone || liturgiaSecao.icone,
    visivel: secaoExistente?.visivel ?? liturgiaSecao.visivel,
    ordem: secaoExistente?.ordem ?? liturgiaSecao.ordem,
  };

  return [...semLiturgia, secaoMesclada].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

async function buildLatestLiturgiaSection(
  igrejaId: string,
  includeInternal = false
): Promise<LegacyBoletimSecao | null> {
  const { data: cultoRaw, error: cultoError } = await supabaseAdmin
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia')
    .eq('igreja_id', igrejaId)
    .order('Dia', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cultoError) throw cultoError;
  if (!cultoRaw) return null;

  const culto = cultoRaw as Pick<LegacyCultoRow, 'Culto nr.' | 'Dia'>;

  const { data: itensRaw, error: itensError } = await supabaseAdmin
    .from('louvor_itens')
    .select('id, ordem, tipo, tom, cantico_id, conteudo_publico, descricao')
    .eq('culto_id', culto['Culto nr.'])
    .order('ordem', { ascending: true });

  if (itensError) throw itensError;

  const itens = (itensRaw || []) as LegacyLouvorItemRow[];
  const itensLiturgia = itens.filter((item) => !isBoletimFallbackTipo(item.tipo));

  if (itensLiturgia.length === 0) return null;

  const canticosPorId = await resolveCanticosPorId(itensLiturgia.map((item) => item.cantico_id));

  return {
    id: `legacy-liturgia-${culto['Culto nr.']}`,
    igreja_id: null,
    culto_id: culto['Culto nr.'],
    tipo: 'liturgia',
    titulo: `Liturgia do culto de ${culto.Dia}`,
    icone: null,
    ordem: 2,
    visivel: true,
    criado_em: null,
    itens: itensLiturgia.map((item, index) => ({
      id: item.id,
      secao_id: `legacy-liturgia-${culto['Culto nr.']}`,
      conteudo: buildLegacyLiturgiaConteudo(
        item,
        index,
        item.cantico_id ? canticosPorId.get(String(item.cantico_id)) : null,
        includeInternal
      ),
      destaque: false,
      ordem: item.ordem ?? index,
      criado_em: null,
    })),
  };
}

async function buildLegacyBoletimFallback(igrejaId: string, includeInternal = false) {
  const { data: cultoRaw, error: cultoError } = await supabaseAdmin
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia, imagem_url, palavra_pastoral, palavra_pastoral_autor, igreja_id')
    .eq('igreja_id', igrejaId)
    .order('Dia', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cultoError) throw cultoError;
  if (!cultoRaw) {
    return {
      boletimSecoes: [],
      legacyMessage: 'Esta igreja ainda nao publicou secoes do boletim.',
    };
  }

  const culto = cultoRaw as LegacyCultoRow;

  const { data: itensRaw, error: itensError } = await supabaseAdmin
    .from('louvor_itens')
    .select('id, ordem, tipo, tom, cantico_id, conteudo_publico, descricao')
    .eq('culto_id', culto['Culto nr.'])
    .order('ordem', { ascending: true });

  if (itensError) throw itensError;

  const itens = (itensRaw || []) as LegacyLouvorItemRow[];
  const itensLiturgia = itens.filter((item) => !isBoletimFallbackTipo(item.tipo));
  const canticosPorId = await resolveCanticosPorId(itens.map((item) => item.cantico_id));

  const secoes: LegacyBoletimSecao[] = [];

  if (culto.imagem_url) {
    secoes.push({
      id: `legacy-imagem-${culto['Culto nr.']}`,
      igreja_id: null,
      culto_id: culto['Culto nr.'],
      tipo: 'imagem_tema',
      titulo: 'Imagem do Boletim',
      icone: null,
      ordem: 0,
      visivel: true,
      criado_em: null,
      itens: [
        {
          id: `legacy-imagem-conteudo-${culto['Culto nr.']}`,
          secao_id: `legacy-imagem-${culto['Culto nr.']}`,
          conteudo: culto.imagem_url,
          destaque: false,
          ordem: 0,
          criado_em: null,
        },
      ],
    });
  }

  if (culto.palavra_pastoral?.trim()) {
    secoes.push({
      id: `legacy-pastoral-${culto['Culto nr.']}`,
      igreja_id: null,
      culto_id: culto['Culto nr.'],
      tipo: 'palavra_pastoral',
      titulo: 'Palavra Pastoral',
      icone: null,
      ordem: 1,
      visivel: true,
      criado_em: null,
      itens: [
        {
          id: `legacy-pastoral-conteudo-${culto['Culto nr.']}`,
          secao_id: `legacy-pastoral-${culto['Culto nr.']}`,
          conteudo: `${culto.palavra_pastoral.trim()}${
            culto.palavra_pastoral_autor?.trim()
              ? `\n\n${culto.palavra_pastoral_autor.trim()}`
              : ''
          }`,
          destaque: true,
          ordem: 0,
          criado_em: null,
        },
      ],
    });
  }

  if (itensLiturgia.length > 0) {
    secoes.push({
      id: `legacy-liturgia-${culto['Culto nr.']}`,
      igreja_id: null,
      culto_id: culto['Culto nr.'],
      tipo: 'liturgia',
      titulo: `Liturgia do culto de ${culto.Dia}`,
      icone: null,
      ordem: 2,
      visivel: true,
      criado_em: null,
      itens: itensLiturgia.map((item, index) => {
        const cantico = item.cantico_id
          ? canticosPorId.get(String(item.cantico_id))
          : null;

        return {
          id: item.id,
          secao_id: `legacy-liturgia-${culto['Culto nr.']}`,
          conteudo: buildLegacyLiturgiaConteudo(
            item,
            index,
            cantico,
            includeInternal
          ),
          destaque: false,
          ordem: item.ordem ?? index,
          criado_em: null,
        };
      }),
    });
  }

  secoes.push(...buildExtraSectionsFromFallbackRows(itens, culto['Culto nr.']));

  return {
    boletimSecoes: secoes,
    legacyMessage: secoes.length > 0 ? null : 'Esta igreja ainda nao publicou secoes do boletim.',
  };
}

function buildLegacyLiturgiaConteudo(
  item: LegacyLouvorItemRow,
  index: number,
  cantico: { nome: string | null; tipo: 'hinario' | 'cantico'; numero: string | null } | null | undefined,
  includeInternal: boolean
) {
  const tituloItem = item.tipo || `Item ${index + 1}`;
  const linhaCantico = cantico?.nome
    ? `\n${cantico.tipo === 'hinario' ? 'Hino' : 'Cantico'}: ${cantico.nome}${item.tom ? ` (${item.tom})` : ''}`
    : '';
  const conteudoBase = item.conteudo_publico?.trim() || '';
  const descricao = includeInternal ? item.descricao?.trim() || '' : '';

  return `${tituloItem}${
    conteudoBase ? `\n${conteudoBase}` : ''
  }${
    descricao ? `\n${descricao}` : ''
  }${linhaCantico}`;
}

export async function GET(request: NextRequest) {
  let etapa = 'iniciando';
  try {
    etapa = 'auth';
    const user = await getAuthenticatedUserFromServerCookies(request);
    const includeInternal = Boolean(user?.id);
    const igrejaId = request.nextUrl.searchParams.get('igreja_id');

    if (!igrejaId) {
      return NextResponse.json(
        { error: 'igreja_id e obrigatorio.' },
        { status: 400 }
      );
    }

    etapa = 'buscar-igreja';
    const { data: igrejaRaw, error: igrejaError } = await supabaseAdmin
      .from('igrejas')
      .select('*')
      .eq('id', igrejaId)
      .maybeSingle();

    if (igrejaError) throw igrejaError;

    const igreja = igrejaRaw ? normalizeIgreja(igrejaRaw) : null;

    if (!igreja) {
      return NextResponse.json(
        { error: 'Igreja nao encontrada.' },
        { status: 404 }
      );
    }

    etapa = 'buscar-secoes';
    const { data: secoesRaw, error: secoesError } = await supabaseAdmin
      .from('boletim_secoes')
      .select('*')
      .eq('igreja_id', igrejaId)
      .eq('visivel', true)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: true });

    if (secoesError) throw secoesError;

    const secoes = (secoesRaw || []) as BoletimSecaoRow[];
    const secaoIds = secoes.map((secao) => secao.id);

    etapa = 'buscar-detalhes-relacionados';
    const [
      { data: itensRaw, error: itensError },
      { data: cultosRaw, error: cultosError },
      { data: redesRaw, error: redesError },
      { data: igrejaDetalhes, error: detalhesError },
    ] = await Promise.all([
      secaoIds.length > 0
        ? supabaseAdmin
            .from('boletim_itens')
            .select('*')
            .in('secao_id', secaoIds)
            .order('ordem', { ascending: true })
            .order('criado_em', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from('igreja_cultos')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('horario', { ascending: true }),
      supabaseAdmin
        .from('igreja_redes_sociais')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('ativo', true)
        .order('ordem', { ascending: true }),
      supabaseAdmin
        .from('igrejas')
        .select(
          'id, nome, nome_abreviado, nome_completo, cidade, uf, pais, regiao, endereco_completo, logradouro, complemento, bairro, telefone, email, site, instagram, youtube, whatsapp, horario_publicacao_boletim, dia_publicacao_boletim, timezone_boletim'
        )
        .eq('id', igrejaId)
        .maybeSingle(),
    ]);

    if (itensError) throw itensError;
    if (cultosError) throw cultosError;
    if (redesError) throw redesError;
    if (detalhesError) throw detalhesError;
    const itens = (itensRaw || []) as BoletimItemRow[];
    const itensPorSecao = new Map<string, BoletimItemRow[]>();

    for (const item of itens) {
      if (!item.secao_id) continue;
      const secaoItens = itensPorSecao.get(item.secao_id) || [];
      secaoItens.push(item);
      itensPorSecao.set(item.secao_id, secaoItens);
    }

    let boletimSecoes = secoes.map((secao) => ({
      ...secao,
      itens: (itensPorSecao.get(secao.id) || []).sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0)
      ),
    }));

    let message: string | null = null;
    const secoesComConteudo = boletimSecoes.filter((secao) => secao.itens.length > 0);

    if (boletimSecoes.length === 0 || secoesComConteudo.length === 0) {
      etapa = 'fallback-legado';
      const fallback = await buildLegacyBoletimFallback(igrejaId, false);
      boletimSecoes = fallback.boletimSecoes;
      message = fallback.legacyMessage;
    }

    etapa = 'sincronizar-liturgia';
    const liturgiaSecaoAtual = await buildLatestLiturgiaSection(igrejaId, includeInternal);
    boletimSecoes = mergeLiturgiaSecao(boletimSecoes, liturgiaSecaoAtual);

    if (includeInternal && boletimSecoes.some((secao) => secao.id.startsWith('legacy-'))) {
      etapa = 'fallback-legado-interno';
      const { data: cultoRaw } = await supabaseAdmin
        .from('Louvores IPPN')
        .select('"Culto nr."')
        .eq('igreja_id', igrejaId)
        .order('Dia', { ascending: false })
        .limit(1)
        .maybeSingle();

      const cultoId = cultoRaw?.['Culto nr.'];

      if (cultoId) {
        const { data: itensRaw, error: itensError } = await supabaseAdmin
          .from('louvor_itens')
          .select('id, ordem, tipo, tom, cantico_id, conteudo_publico, descricao')
          .eq('culto_id', cultoId)
          .order('ordem', { ascending: true });

        if (itensError) throw itensError;

        const itensLegacy = (itensRaw || []) as LegacyLouvorItemRow[];
        const canticosPorId = await resolveCanticosPorId(itensLegacy.map((item) => item.cantico_id));

        boletimSecoes = boletimSecoes.map((secao) => {
          if (secao.tipo !== 'liturgia') return secao;

          const itensAtualizados = secao.itens.map((item, index) => {
            const original = itensLegacy.find((legacyItem) => legacyItem.id === item.id);
            if (!original) return item;

            return {
              ...item,
              conteudo: buildLegacyLiturgiaConteudo(
                original,
                index,
                original.cantico_id ? canticosPorId.get(String(original.cantico_id)) : null,
                true
              ),
            };
          });

          return {
            ...secao,
            itens: itensAtualizados,
          };
        });
      }
    }

    etapa = 'resposta';
    return NextResponse.json({
      igreja,
      igrejaDetalhes,
      agendaCultos: cultosRaw || [],
      redesSociais: redesRaw || [],
      boletimSecoes,
      totalSecoes: boletimSecoes.length,
      message,
    });
  } catch (error: any) {
    console.error('Erro ao carregar boletim da home:', { etapa, error });
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar boletim.', etapa },
      { status: 500 }
    );
  }
}
