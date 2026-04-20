import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { resolveLocalizedText } from '@/lib/church-i18n';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface LegacyLouvorItemRow {
  id: string;
  culto_id: number;
  ordem: number | null;
  tipo: string | null;
  tom: string | null;
  cantico_id: string | null;
  conteudo_publico: string | null;
  conteudo_publico_i18n?: unknown;
  descricao: string | null;
}

interface LegacyCultoRow {
  'Culto nr.': number;
  Dia: string;
  imagem_url: string | null;
  igreja_id: string | null;
  palavra_pastoral: string | null;
  palavra_pastoral_i18n?: unknown;
  palavra_pastoral_autor: string | null;
}

interface StructuredBoletimSecaoRow {
  id: string;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  titulo_i18n?: unknown;
  ordem: number | null;
  visivel: boolean | null;
}

interface StructuredBoletimItemRow {
  id: string;
  secao_id: string | null;
  conteudo: string;
  conteudo_i18n?: unknown;
  destaque: boolean | null;
  ordem: number | null;
}

const BOLETIM_FALLBACK_TIPO_PREFIX = '__boletim__:';

function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getRequestedLocale(request: NextRequest): Locale {
  const locale = request.nextUrl.searchParams.get('locale');
  return SUPPORTED_LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE;
}

function isBoletimFallbackTipo(tipo: string | null | undefined): tipo is string {
  return typeof tipo === 'string' && tipo.startsWith(BOLETIM_FALLBACK_TIPO_PREFIX);
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

function buildLegacyLiturgiaConteudo(
  item: LegacyLouvorItemRow,
  index: number,
  cantico: { nome: string | null; tipo: 'hinario' | 'cantico'; numero: string | null } | null | undefined,
  includeInternal: boolean,
  locale: Locale
) {
  const tituloItem = item.tipo || `Item ${index + 1}`;
  const linhaCantico = cantico?.nome
    ? `\n${cantico.tipo === 'hinario' ? 'Hino' : 'Cantico'}: ${cantico.nome}${item.tom ? ` (${item.tom})` : ''}`
    : '';
  const conteudoBase = resolveLocalizedText(
    item.conteudo_publico_i18n,
    locale,
    item.conteudo_publico || ''
  );
  const descricao = includeInternal ? item.descricao?.trim() || '' : '';

  return `${tituloItem}${
    conteudoBase ? `\n${conteudoBase}` : ''
  }${
    descricao ? `\n${descricao}` : ''
  }${linhaCantico}`;
}

function buildStructuredBoletimItems(
  secoesRaw: StructuredBoletimSecaoRow[],
  itensRaw: StructuredBoletimItemRow[],
  locale: Locale
) {
  const itensPorSecao = new Map<string, StructuredBoletimItemRow[]>();

  for (const item of itensRaw) {
    if (!item.secao_id) continue;
    const atuais = itensPorSecao.get(item.secao_id) || [];
    atuais.push(item);
    itensPorSecao.set(item.secao_id, atuais);
  }

  return [...secoesRaw]
    .filter((secao) => secao.visivel !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .flatMap((secao) => {
      const titulo = resolveLocalizedText(secao.titulo_i18n, locale, secao.titulo);

      return (itensPorSecao.get(secao.id) || [])
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((item, itemIndex) => {
          const conteudo = resolveLocalizedText(
            item.conteudo_i18n,
            locale,
            item.conteudo || ''
          ).trim();

          if (!conteudo) return null;

          return {
            id: item.id,
            conteudo: titulo ? `${titulo}\n${conteudo}` : conteudo,
            ordem: 1000 + ((secao.ordem || 0) * 100) + itemIndex,
          };
        })
        .filter((item): item is { id: string; conteudo: string; ordem: number } => Boolean(item));
    });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromServerCookies(request);
    const includeInternal = Boolean(user?.id);
    const locale = getRequestedLocale(request);
    const igrejaId = request.nextUrl.searchParams.get('igreja_id');

    if (!igrejaId) {
      return NextResponse.json({ error: 'igreja_id e obrigatorio.' }, { status: 400 });
    }

    const { data: cultosRaw, error: cultosError } = await supabaseAdmin
      .from('Louvores IPPN')
      .select('"Culto nr.", Dia, imagem_url, igreja_id, palavra_pastoral, palavra_pastoral_i18n, palavra_pastoral_autor')
      .eq('igreja_id', igrejaId)
      .order('Dia', { ascending: false })
      .limit(7);

    if (cultosError) throw cultosError;

    const cultos = ((cultosRaw || []) as LegacyCultoRow[]).slice(1);
    const cultoIds = cultos.map((culto) => culto['Culto nr.']);

    if (cultoIds.length === 0) {
      return NextResponse.json({ boletins: [] });
    }

    const [
      { data: itensRaw, error: itensError },
      { data: secoesRaw, error: secoesError },
    ] = await Promise.all([
      supabaseAdmin
        .from('louvor_itens')
        .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao')
        .in('culto_id', cultoIds)
        .order('culto_id', { ascending: false })
        .order('ordem', { ascending: true }),
      supabaseAdmin
        .from('boletim_secoes')
        .select('id, culto_id, tipo, titulo, titulo_i18n, ordem, visivel')
        .eq('igreja_id', igrejaId)
        .in('culto_id', cultoIds)
        .order('culto_id', { ascending: false })
        .order('ordem', { ascending: true }),
    ]);

    if (itensError) throw itensError;
    if (secoesError) throw secoesError;

    const itens = (itensRaw || []) as LegacyLouvorItemRow[];
    const secoesEstruturadas = (secoesRaw || []) as StructuredBoletimSecaoRow[];
    const secaoIds = secoesEstruturadas
      .map((secao) => secao.id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    const { data: itensEstruturadosRaw, error: itensEstruturadosError } =
      secaoIds.length > 0
        ? await supabaseAdmin
            .from('boletim_itens')
            .select('id, secao_id, conteudo, conteudo_i18n, destaque, ordem')
            .in('secao_id', secaoIds)
            .order('ordem', { ascending: true })
        : { data: [], error: null };

    if (itensEstruturadosError) throw itensEstruturadosError;

    const canticosPorId = await resolveCanticosPorId(itens.map((item) => item.cantico_id));

    const itensPorCulto = new Map<number, LegacyLouvorItemRow[]>();
    const secoesEstruturadasPorCulto = new Map<number, StructuredBoletimSecaoRow[]>();
    const itensEstruturados = (itensEstruturadosRaw || []) as StructuredBoletimItemRow[];

    for (const item of itens) {
      const lista = itensPorCulto.get(item.culto_id) || [];
      lista.push(item);
      itensPorCulto.set(item.culto_id, lista);
    }

    for (const secao of secoesEstruturadas) {
      if (typeof secao.culto_id !== 'number') continue;
      const lista = secoesEstruturadasPorCulto.get(secao.culto_id) || [];
      lista.push(secao);
      secoesEstruturadasPorCulto.set(secao.culto_id, lista);
    }

    const boletins = cultos.map((culto) => {
      const itensCultoBase = itensPorCulto.get(culto['Culto nr.']) || [];
      const itensLegacyCompletos = itensCultoBase.map((item, index) => {
        const cantico = item.cantico_id ? canticosPorId.get(String(item.cantico_id)) : null;

        return {
          id: item.id,
          conteudo: buildLegacyLiturgiaConteudo(
            item,
            index,
            cantico,
            includeInternal,
            locale
          ),
          ordem: item.ordem ?? index,
        };
      });
      const itensLiturgia = itensCultoBase
        .filter((item) => !isBoletimFallbackTipo(item.tipo))
        .map((item, index) => {
          const cantico = item.cantico_id ? canticosPorId.get(String(item.cantico_id)) : null;

          return {
            id: item.id,
            conteudo: buildLegacyLiturgiaConteudo(
              item,
              index,
              cantico,
              includeInternal,
              locale
            ),
            ordem: item.ordem ?? index,
          };
        });
      const itensEstruturadosCulto = buildStructuredBoletimItems(
        secoesEstruturadasPorCulto.get(culto['Culto nr.']) || [],
        itensEstruturados,
        locale
      );
      const itensCulto =
        itensEstruturadosCulto.length > 0
          ? [...itensLiturgia, ...itensEstruturadosCulto].sort(
              (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
            )
          : itensLegacyCompletos;

      const itensComPastoral =
        resolveLocalizedText(culto.palavra_pastoral_i18n, locale, culto.palavra_pastoral || '').trim()
          ? [
              {
                id: `legacy-pastoral-${culto['Culto nr.']}`,
                conteudo: `Palavra Pastoral\n${resolveLocalizedText(
                  culto.palavra_pastoral_i18n,
                  locale,
                  culto.palavra_pastoral || ''
                ).trim()}${
                  culto.palavra_pastoral_autor?.trim()
                    ? `\n\n${culto.palavra_pastoral_autor.trim()}`
                    : ''
                }`,
                ordem: -1,
              },
              ...itensCulto,
            ]
          : itensCulto;

      return {
        id: `legacy-${culto['Culto nr.']}`,
        cultoId: culto['Culto nr.'],
        data: culto.Dia,
        imagemUrl: culto.imagem_url,
        itens: itensComPastoral,
      };
    });

    return NextResponse.json({ boletins });
  } catch (error: any) {
    console.error('Erro ao carregar boletins anteriores:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar boletins anteriores.' },
      { status: 500 }
    );
  }
}
