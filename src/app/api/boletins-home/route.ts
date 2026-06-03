import { createClient } from '@supabase/supabase-js';
import https from 'node:https';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { buscarDevocionalCadaDia, formatarConteudoCadaDia } from '@/lib/cada-dia';
import { resolveLocalizedText } from '@/lib/church-i18n';
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
  titulo_i18n?: unknown;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
}

interface BoletimItemRow {
  id: string;
  secao_id: string | null;
  conteudo: string;
  conteudo_i18n?: unknown;
  destaque: boolean | null;
  ordem: number | null;
  criado_em: string | null;
  imagem_url?: string | null;
  liturgia_nome?: string | null;
  liturgia_titulo?: string | null;
  liturgia_publico?: string | null;
  liturgia_interno?: string | null;
  liturgia_horario?: string | null;
}

interface LegacyLouvorItemRow {
  id: string;
  culto_id?: number;
  ordem: number | null;
  tipo: string | null;
  tom: string | null;
  cantico_id: string | null;
  conteudo_publico: string | null;
  conteudo_publico_i18n?: unknown;
  descricao: string | null;
  horario?: string | null;
}

interface LegacyCultoRow {
  'Culto nr.': number;
  Dia: string;
  imagem_url: string | null;
  palavra_pastoral: string | null;
  palavra_pastoral_i18n?: unknown;
  palavra_pastoral_autor: string | null;
}

interface BoletimPublicacaoConfig {
  dia_publicacao_boletim?: number | null;
  horario_publicacao_boletim?: string | null;
  timezone_boletim?: string | null;
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
  secaoTituloI18n?: Partial<Record<Locale, string>> | null;
  secaoIcone: string | null;
  secaoVisivel: boolean;
  secaoOrdem: number;
  itemDestaque: boolean;
  itemOrdem: number;
  itemImagemUrl?: string | null;
}

const BOLETIM_FALLBACK_TIPO_PREFIX = '__boletim__:';
const LITURGIA_META_TIPO = '__liturgia__:nome';
const CADA_DIA_SECTION_ID = 'cada-dia-devocional';
const ANIVERSARIANTES_SECTION_ID = 'aniversariantes-do-mes';
const ANIVERSARIANTES_DEFAULT_TIMEZONE = 'America/Manaus';

function getRequestedLocale(request: NextRequest): Locale {
  const locale = request.nextUrl.searchParams.get('locale');
  return SUPPORTED_LOCALES.includes(locale as Locale) ? (locale as Locale) : DEFAULT_LOCALE;
}

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
      secaoTituloI18n:
        parsed.secaoTituloI18n &&
        typeof parsed.secaoTituloI18n === 'object' &&
        !Array.isArray(parsed.secaoTituloI18n)
          ? (parsed.secaoTituloI18n as Partial<Record<Locale, string>>)
          : null,
      secaoIcone: typeof parsed.secaoIcone === 'string' ? parsed.secaoIcone : null,
      secaoVisivel: parsed.secaoVisivel !== false,
      secaoOrdem: parsed.secaoOrdem,
      itemDestaque: parsed.itemDestaque === true,
      itemOrdem: parsed.itemOrdem,
      itemImagemUrl: typeof parsed.itemImagemUrl === 'string' ? parsed.itemImagemUrl : null,
    };
  } catch {
    return null;
  }
}

function buildExtraSectionsFromFallbackRows(
  rows: LegacyLouvorItemRow[],
  cultoId: number,
  locale: Locale
): LegacyBoletimSecao[] {
  const secoes = new Map<string, LegacyBoletimSecao>();
  const itemOrders = new Map<string, number>();

  rows.forEach((row) => {
    const tipo = extrairTipoBoletimFallback(row.tipo);
    const meta = parseBoletimFallbackMeta(row.descricao);
    const conteudo = resolveLocalizedText(
      row.conteudo_publico_i18n,
      locale,
      row.conteudo_publico || ''
    );

    if (!tipo || !meta || !conteudo || meta.secaoVisivel === false) return;

    const titulo = resolveLocalizedText(
      meta.secaoTituloI18n,
      locale,
      meta.secaoTitulo
    );
    const key = `${meta.secaoOrdem}:${tipo}:${titulo}`;

    if (!secoes.has(key)) {
      secoes.set(key, {
        id: `legacy-extra-${key}`,
        igreja_id: null,
        culto_id: cultoId,
        tipo,
        titulo,
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
      imagem_url: meta.itemImagemUrl ?? null,
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

function buildLegacyLiturgiaConteudo({
  titulo,
  conteudoPublico,
  conteudoInterno,
}: {
  titulo: string;
  conteudoPublico: string;
  conteudoInterno: string;
}) {
  return `${titulo}${conteudoPublico ? `\n${conteudoPublico}` : ''}${
    conteudoInterno ? `\n${conteudoInterno}` : ''
  }`;
}

function buildLiturgiaBoletimItems(
  itensLiturgia: LegacyLouvorItemRow[],
  canticosPorId: Map<string, { nome: string | null; tipo: 'hinario' | 'cantico'; numero: string | null }>,
  includeInternal: boolean,
  secaoId: string,
  locale: Locale
) {
  const itensBoletim: BoletimItemRow[] = [];
  let grupoAtual: {
    ordem: number | null;
    itemId: string;
    tipo: string;
    conteudoPublico: string;
    conteudoInterno: string;
    horario: string | null;
    canticos: string[];
  } | null = null;

  const finalizarGrupoAtual = () => {
    if (!grupoAtual) return;

    const conteudoPublico = [grupoAtual.conteudoPublico, ...grupoAtual.canticos]
      .filter(Boolean)
      .join('\n')
      .trim();
    const conteudoInterno = includeInternal ? grupoAtual.conteudoInterno : '';

    itensBoletim.push({
      id: grupoAtual.itemId,
      secao_id: secaoId,
      conteudo: buildLegacyLiturgiaConteudo({
        titulo: grupoAtual.tipo,
        conteudoPublico,
        conteudoInterno,
      }),
      destaque: false,
      ordem: grupoAtual.ordem,
      criado_em: null,
      liturgia_titulo: grupoAtual.tipo,
      liturgia_publico: conteudoPublico || null,
      liturgia_interno: conteudoInterno || null,
      liturgia_horario: includeInternal ? grupoAtual.horario : null,
    });

    grupoAtual = null;
  };

  for (const item of itensLiturgia) {
    if (item.tipo === LITURGIA_META_TIPO) {
      finalizarGrupoAtual();

      const nomeLiturgia = resolveLocalizedText(
        item.conteudo_publico_i18n,
        locale,
        item.conteudo_publico || ''
      );
      itensBoletim.push({
        id: item.id,
        secao_id: secaoId,
        conteudo: `${LITURGIA_META_TIPO}\n${nomeLiturgia}`,
        destaque: false,
        ordem: item.ordem,
        criado_em: null,
        liturgia_nome: nomeLiturgia || null,
      });
      continue;
    }

    const tipo = item.tipo?.trim() || `Item ${(item.ordem || itensBoletim.length) + 1}`;
    const conteudoPublico = resolveLocalizedText(
      item.conteudo_publico_i18n,
      locale,
      item.conteudo_publico || ''
    );
    const conteudoInterno = item.descricao?.trim() || '';
    const horario = item.horario?.trim() || null;
    const cantico = item.cantico_id ? canticosPorId.get(String(item.cantico_id)) : null;
    const linhaCantico = cantico?.nome
      ? `${cantico.tipo === 'hinario' ? 'Hino' : 'Cantico'}: ${cantico.nome}${
          item.tom ? ` (${item.tom})` : ''
        }`
      : '';
    const deveAgrupar =
      grupoAtual &&
      grupoAtual.tipo === tipo &&
      grupoAtual.conteudoPublico === conteudoPublico &&
      grupoAtual.conteudoInterno === conteudoInterno &&
      grupoAtual.horario === horario;

    if (!deveAgrupar) {
      finalizarGrupoAtual();
      grupoAtual = {
        ordem: item.ordem,
        itemId: item.id,
        tipo,
        conteudoPublico,
        conteudoInterno,
        horario,
        canticos: linhaCantico ? [linhaCantico] : [],
      };
      continue;
    }

    if (grupoAtual && linhaCantico && !grupoAtual.canticos.includes(linhaCantico)) {
      grupoAtual.canticos.push(linhaCantico);
    }
  }

  finalizarGrupoAtual();

  return itensBoletim;
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

function filtrarSecoesEstruturadasAtuais(
  secoes: BoletimSecaoRow[],
  cultoIdAtual: number | null
) {
  if (cultoIdAtual === null) {
    return secoes;
  }

  const secoesDoCultoAtual = secoes.filter((secao) => secao.culto_id === cultoIdAtual);
  if (secoesDoCultoAtual.length > 0) {
    return secoesDoCultoAtual;
  }

  const secoesGlobais = secoes.filter((secao) => secao.culto_id === null);
  return secoesGlobais.length > 0 ? secoesGlobais : [];
}

function getCultoDateKey(dateValue: string) {
  return String(dateValue || '').slice(0, 10);
}

function parseCultoDateKey(dateValue: string | null | undefined) {
  const match = getCultoDateKey(String(dateValue || '')).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

function formatDateKeyFromUtc(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function shiftDateKey(dateKey: string, days: number) {
  const parts = parseCultoDateKey(dateKey);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatDateKeyFromUtc(date);
}

function parseHorarioPublicacao(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function getTimeZoneWallParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);

  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
}

function getInstantFromTimeZoneWallTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const wallParts = getTimeZoneWallParts(new Date(utcGuess), timeZone);
  const wallAsUtc = Date.UTC(
    wallParts.year,
    wallParts.month - 1,
    wallParts.day,
    wallParts.hour,
    wallParts.minute,
    wallParts.second
  );

  return new Date(utcGuess - (wallAsUtc - utcGuess));
}

function getPublicacaoInstantForCulto(
  cultoDia: string,
  config: BoletimPublicacaoConfig
) {
  const cultoDateKey = getCultoDateKey(cultoDia);
  const cultoDateParts = parseCultoDateKey(cultoDateKey);
  const horario = parseHorarioPublicacao(config.horario_publicacao_boletim);
  const diaPublicacao = Number(config.dia_publicacao_boletim);

  if (
    !cultoDateParts ||
    !horario ||
    !Number.isInteger(diaPublicacao) ||
    diaPublicacao < 0 ||
    diaPublicacao > 6
  ) {
    return null;
  }

  const cultoWeekday = new Date(Date.UTC(cultoDateParts.year, cultoDateParts.month - 1, cultoDateParts.day)).getUTCDay();
  const diasAntesDoCulto = (cultoWeekday - diaPublicacao + 7) % 7;
  const publicacaoDateKey = shiftDateKey(cultoDateKey, -diasAntesDoCulto);
  const publicacaoDateParts = parseCultoDateKey(publicacaoDateKey);

  if (!publicacaoDateParts) return null;

  const timeZone = config.timezone_boletim?.trim() || ANIVERSARIANTES_DEFAULT_TIMEZONE;

  try {
    return getInstantFromTimeZoneWallTime(
      publicacaoDateParts.year,
      publicacaoDateParts.month,
      publicacaoDateParts.day,
      horario.hour,
      horario.minute,
      timeZone
    );
  } catch {
    return getInstantFromTimeZoneWallTime(
      publicacaoDateParts.year,
      publicacaoDateParts.month,
      publicacaoDateParts.day,
      horario.hour,
      horario.minute,
      ANIVERSARIANTES_DEFAULT_TIMEZONE
    );
  }
}

function isCultoPublicadoNoBoletimPublico(
  cultoDia: string,
  config: BoletimPublicacaoConfig,
  now = new Date()
) {
  const publicacaoInstant = getPublicacaoInstantForCulto(cultoDia, config);
  if (!publicacaoInstant) return true;

  return publicacaoInstant.getTime() <= now.getTime();
}

function hasPublicSectionContent(secao: LegacyBoletimSecao) {
  return secao.itens.some((item) => item.conteudo.trim().length > 0);
}

function getNextSectionOrder(secoes: LegacyBoletimSecao[]) {
  const ordens = secoes
    .map((secao) => secao.ordem)
    .filter((ordem): ordem is number => typeof ordem === 'number');

  return ordens.length > 0 ? Math.max(...ordens) + 1 : 99;
}

function isCadaDiaSection(secao: LegacyBoletimSecao) {
  return (
    secao.id === CADA_DIA_SECTION_ID ||
    secao.titulo.trim().toLowerCase() === 'cada dia'
  );
}

async function buildCadaDiaSection(
  secoesAtuais: LegacyBoletimSecao[]
): Promise<LegacyBoletimSecao | null> {
  try {
    const devocional = await buscarDevocionalCadaDia();

    if (!devocional) return null;

    const secaoExistente = secoesAtuais.find(isCadaDiaSection);

    return {
      id: CADA_DIA_SECTION_ID,
      igreja_id: null,
      culto_id: secaoExistente?.culto_id || null,
      tipo: 'outro',
      titulo: 'Cada dia',
      icone: null,
      ordem: secaoExistente?.ordem ?? getNextSectionOrder(secoesAtuais),
      visivel: true,
      criado_em: null,
      itens: [
        {
          id: `${CADA_DIA_SECTION_ID}-item`,
          secao_id: CADA_DIA_SECTION_ID,
          conteudo: formatarConteudoCadaDia(devocional),
          destaque: false,
          ordem: 0,
          criado_em: null,
        },
      ],
    };
  } catch (error) {
    console.warn('Falha ao carregar devocional Cada Dia:', error);
    return null;
  }
}

function isAniversariantesSection(secao: LegacyBoletimSecao) {
  return (
    secao.id === ANIVERSARIANTES_SECTION_ID ||
    secao.titulo.trim().toLowerCase() === 'aniversariantes do mês' ||
    secao.titulo.trim().toLowerCase() === 'aniversariantes do mes'
  );
}

function getCurrentMonthInTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(month) && month >= 1 && month <= 12) return month;
  } catch {
    // fall through to default
  }
  return new Date().getMonth() + 1;
}

function parseMesDiaNascimento(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

async function buildAniversariantesSection(
  igrejaId: string,
  timezoneBoletim: string | null | undefined,
  secoesAtuais: LegacyBoletimSecao[]
): Promise<LegacyBoletimSecao | null> {
  try {
    const timezone = timezoneBoletim?.trim() || ANIVERSARIANTES_DEFAULT_TIMEZONE;
    const mesAtual = getCurrentMonthInTimeZone(timezone);

    const { data: pessoasRaw, error } = await supabaseAdmin
      .from('pessoas')
      .select('nome, data_nascimento, pessoas_igrejas!inner(igreja_id, ativo, status_membro)')
      .eq('pessoas_igrejas.igreja_id', igrejaId)
      .eq('pessoas_igrejas.ativo', true)
      .neq('pessoas_igrejas.status_membro', 'falecido')
      .not('data_nascimento', 'is', null);

    if (error) throw error;

    const aniversariantes = (
      (pessoasRaw || []) as Array<{ nome: string | null; data_nascimento: string | null }>
    )
      .map((pessoa) => {
        const partes = parseMesDiaNascimento(pessoa.data_nascimento);
        const nome = pessoa.nome?.trim();
        if (!partes || !nome) return null;
        if (partes.month !== mesAtual) return null;
        return { dia: partes.day, nome };
      })
      .filter((item): item is { dia: number; nome: string } => item !== null)
      .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    if (aniversariantes.length === 0) return null;

    const conteudo = aniversariantes
      .map((item) => `${String(item.dia).padStart(2, '0')} · ${item.nome}`)
      .join('\n');

    const secaoExistente = secoesAtuais.find(isAniversariantesSection);

    return {
      id: ANIVERSARIANTES_SECTION_ID,
      igreja_id: igrejaId,
      culto_id: secaoExistente?.culto_id || null,
      tipo: 'outro',
      titulo: 'Aniversariantes do mês',
      icone: null,
      ordem: secaoExistente?.ordem ?? getNextSectionOrder(secoesAtuais),
      visivel: true,
      criado_em: null,
      itens: [
        {
          id: `${ANIVERSARIANTES_SECTION_ID}-item`,
          secao_id: ANIVERSARIANTES_SECTION_ID,
          conteudo,
          destaque: false,
          ordem: 0,
          criado_em: null,
        },
      ],
    };
  } catch (error) {
    console.warn('Falha ao montar aniversariantes do mês:', error);
    return null;
  }
}

async function fetchLatestCultosDoBoletim(
  igrejaId: string,
  diaReferencia?: string | null
) {
  const queryCultoReferencia = supabaseAdmin
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia, imagem_url, palavra_pastoral, palavra_pastoral_i18n, palavra_pastoral_autor')
    .eq('igreja_id', igrejaId);

  const { data: cultoAtualRaw, error: cultoAtualError } = diaReferencia
    ? await queryCultoReferencia
        .eq('Dia', getCultoDateKey(diaReferencia))
        .limit(1)
        .maybeSingle()
    : await queryCultoReferencia
        .order('Dia', { ascending: false })
        .limit(1)
        .maybeSingle();

  if (cultoAtualError) throw cultoAtualError;
  if (!cultoAtualRaw?.Dia) return [];

  const { data: cultosRaw, error: cultosError } = await supabaseAdmin
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia, imagem_url, palavra_pastoral, palavra_pastoral_i18n, palavra_pastoral_autor')
    .eq('igreja_id', igrejaId)
    .eq('Dia', cultoAtualRaw.Dia);

  if (cultosError) throw cultosError;

  return ((cultosRaw || []) as LegacyCultoRow[]).sort(
    (a, b) => a['Culto nr.'] - b['Culto nr.']
  );
}

async function fetchCultosDoBoletimDisponivel(
  igrejaId: string,
  config: BoletimPublicacaoConfig,
  includeInternal: boolean
) {
  const { data: cultosRecentesRaw, error: cultosRecentesError } = await supabaseAdmin
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia, imagem_url, palavra_pastoral, palavra_pastoral_i18n, palavra_pastoral_autor')
    .eq('igreja_id', igrejaId)
    .order('Dia', { ascending: false })
    .limit(80);

  if (cultosRecentesError) throw cultosRecentesError;

  const cultosRecentes = (cultosRecentesRaw || []) as LegacyCultoRow[];
  const datasRecentes = Array.from(new Set(cultosRecentes.map((culto) => getCultoDateKey(culto.Dia))));
  const diaDisponivel = includeInternal
    ? datasRecentes[0]
    : datasRecentes.find((dia) => isCultoPublicadoNoBoletimPublico(dia, config));

  if (!diaDisponivel) return [];

  return cultosRecentes
    .filter((culto) => getCultoDateKey(culto.Dia) === diaDisponivel)
    .sort((a, b) => a['Culto nr.'] - b['Culto nr.']);
}

async function buildLatestLiturgiaSection(
  igrejaId: string,
  locale: Locale,
  includeInternal = false,
  diaReferencia?: string | null
): Promise<LegacyBoletimSecao | null> {
  if (diaReferencia === null) return null;

  const cultos = await fetchLatestCultosDoBoletim(igrejaId, diaReferencia);
  if (cultos.length === 0) return null;
  const cultoReferencia = cultos[0];
  const cultoIds = cultos.map((culto) => culto['Culto nr.']);

  const { data: itensRaw, error: itensError } = await supabaseAdmin
    .from('louvor_itens')
    .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
    .in('culto_id', cultoIds)
    .order('ordem', { ascending: true });

  if (itensError) throw itensError;

  const itens = (itensRaw || []) as LegacyLouvorItemRow[];
  const itensLiturgia = itens.filter((item) => !isBoletimFallbackTipo(item.tipo));

  if (itensLiturgia.length === 0) return null;

  const canticosPorId = await resolveCanticosPorId(itensLiturgia.map((item) => item.cantico_id));
  const itensPorCulto = new Map<number, LegacyLouvorItemRow[]>();

  for (const item of itensLiturgia) {
    const cultoId = typeof item.culto_id === 'number' ? item.culto_id : null;
    if (cultoId === null) continue;
    const listaAtual = itensPorCulto.get(cultoId) || [];
    listaAtual.push(item);
    itensPorCulto.set(cultoId, listaAtual);
  }

  let ordemSequencial = 0;
  const itensCombinados = cultos.flatMap((culto) =>
    buildLiturgiaBoletimItems(
      (itensPorCulto.get(culto['Culto nr.']) || []).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)),
      canticosPorId,
      includeInternal,
      `legacy-liturgia-${cultoReferencia.Dia}`,
      locale
    ).map((item) => ({
      ...item,
      ordem: ordemSequencial++,
    }))
  );

  if (itensCombinados.length === 0) return null;

  return {
    id: `legacy-liturgia-${cultoReferencia.Dia}`,
    igreja_id: null,
    culto_id: null,
    tipo: 'liturgia',
    titulo: `Liturgias do boletim de ${cultoReferencia.Dia}`,
    icone: null,
    ordem: 2,
    visivel: true,
    criado_em: null,
    itens: itensCombinados,
  };
}

async function buildLegacyBoletimFallback(
  igrejaId: string,
  locale: Locale,
  includeInternal = false,
  diaReferencia?: string | null
) {
  if (diaReferencia === null) {
    return {
      boletimSecoes: [],
      legacyMessage: 'O boletim ainda nao foi publicado.',
    };
  }

  const cultos = await fetchLatestCultosDoBoletim(igrejaId, diaReferencia);

  if (cultos.length === 0) {
    return {
      boletimSecoes: [],
      legacyMessage: 'Esta igreja ainda nao publicou secoes do boletim.',
    };
  }

  const culto = cultos.find((item) => item.palavra_pastoral?.trim() || item.imagem_url) || cultos[0];
  const cultoIds = cultos.map((item) => item['Culto nr.']);

  const { data: itensRaw, error: itensError } = await supabaseAdmin
    .from('louvor_itens')
    .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
    .in('culto_id', cultoIds)
    .order('ordem', { ascending: true });

  if (itensError) throw itensError;

  const itens = (itensRaw || []) as LegacyLouvorItemRow[];
  const liturgiaSecao = await buildLatestLiturgiaSection(igrejaId, locale, includeInternal, culto.Dia);

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
    const palavraPastoral = resolveLocalizedText(
      culto.palavra_pastoral_i18n,
      locale,
      culto.palavra_pastoral || ''
    );
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
          conteudo: `${palavraPastoral.trim()}${
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

  if (liturgiaSecao) {
    secoes.push(liturgiaSecao);
  }

  const itensDoCultoReferencia = itens.filter((item) => item.culto_id === culto['Culto nr.']);
  secoes.push(...buildExtraSectionsFromFallbackRows(itensDoCultoReferencia, culto['Culto nr.'], locale));

  return {
    boletimSecoes: secoes,
    legacyMessage: secoes.length > 0 ? null : 'Esta igreja ainda nao publicou secoes do boletim.',
  };
}

export async function GET(request: NextRequest) {
  let etapa = 'iniciando';
  try {
    etapa = 'auth';
    const user = await getAuthenticatedUserFromServerCookies(request);
    const includeInternal = Boolean(user?.id);
    const locale = getRequestedLocale(request);
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

    etapa = 'buscar-culto-atual';
    const cultosBoletimDisponiveis = await fetchCultosDoBoletimDisponivel(
      igrejaId,
      igrejaRaw as BoletimPublicacaoConfig,
      includeInternal
    );
    const cultoAtualRaw = cultosBoletimDisponiveis[0] || null;

    const cultoAtualId =
      typeof cultoAtualRaw?.['Culto nr.'] === 'number' ? cultoAtualRaw['Culto nr.'] : null;
    const diaBoletimSelecionado = cultoAtualRaw?.Dia || null;

    etapa = 'buscar-secoes';
    const { data: secoesRaw, error: secoesError } = await supabaseAdmin
      .from('boletim_secoes')
      .select('*')
      .eq('igreja_id', igrejaId)
      .eq('visivel', true)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: true });

    if (secoesError) throw secoesError;

    const secoes = diaBoletimSelecionado
      ? filtrarSecoesEstruturadasAtuais(
          (secoesRaw || []) as BoletimSecaoRow[],
          cultoAtualId
        )
      : [];
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
          'id, nome, nome_abreviado, nome_completo, cidade, uf, pais, regiao, endereco_completo, logradouro, complemento, bairro, telefone, email, site, instagram, youtube, whatsapp, horario_publicacao_boletim, dia_publicacao_boletim, timezone_boletim, apresentacao_titulo, apresentacao_texto, apresentacao_titulo_i18n, apresentacao_texto_i18n, apresentacao_imagem_url, apresentacao_youtube_url, apresentacao_galeria'
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
      titulo: resolveLocalizedText(secao.titulo_i18n, locale, secao.titulo),
      itens: (itensPorSecao.get(secao.id) || []).sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0)
      ).map((item) => ({
        ...item,
        conteudo: resolveLocalizedText(item.conteudo_i18n, locale, item.conteudo),
      })),
    }));

    let message: string | null = null;
    const secoesComConteudo = boletimSecoes.filter((secao) => secao.itens.length > 0);

    if (boletimSecoes.length === 0 || secoesComConteudo.length === 0) {
      etapa = 'fallback-legado';
      const fallback = await buildLegacyBoletimFallback(
        igrejaId,
        locale,
        false,
        diaBoletimSelecionado
      );
      boletimSecoes = fallback.boletimSecoes;
      message = fallback.legacyMessage;
    } else if (cultoAtualId !== null) {
      etapa = 'mesclar-fallback-legado';
      const { data: fallbackRowsRaw, error: fallbackRowsError } = await supabaseAdmin
        .from('louvor_itens')
        .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
        .eq('culto_id', cultoAtualId)
        .like('tipo', `${BOLETIM_FALLBACK_TIPO_PREFIX}%`)
        .order('ordem', { ascending: true });

      if (fallbackRowsError) throw fallbackRowsError;

      const tiposEstruturados = new Set(boletimSecoes.map((secao) => secao.tipo));
      const secoesFallback = buildExtraSectionsFromFallbackRows(
        (fallbackRowsRaw || []) as LegacyLouvorItemRow[],
        cultoAtualId,
        locale
      ).filter((secao) => !tiposEstruturados.has(secao.tipo));

      if (secoesFallback.length > 0) {
        boletimSecoes = [...boletimSecoes, ...secoesFallback].sort(
          (a, b) => (a.ordem || 0) - (b.ordem || 0)
        );
      }
    }

    etapa = 'sincronizar-liturgia';
    const liturgiaSecaoAtual = await buildLatestLiturgiaSection(
      igrejaId,
      locale,
      includeInternal,
      diaBoletimSelecionado
    );
    boletimSecoes = mergeLiturgiaSecao(boletimSecoes, liturgiaSecaoAtual);

    if (includeInternal && boletimSecoes.some((secao) => secao.id.startsWith('legacy-'))) {
      etapa = 'fallback-legado-interno';
      const liturgiaSecaoInterna = await buildLatestLiturgiaSection(
        igrejaId,
        locale,
        true,
        diaBoletimSelecionado
      );

      if (liturgiaSecaoInterna) {
        boletimSecoes = boletimSecoes.map((secao) => {
          if (secao.tipo !== 'liturgia') return secao;

          return {
            ...secao,
            itens: liturgiaSecaoInterna.itens,
          };
        });
      }
    }

    if (diaBoletimSelecionado) {
      etapa = 'cada-dia';
      const cadaDiaSection = await buildCadaDiaSection(boletimSecoes);
      if (cadaDiaSection) {
        boletimSecoes = [
          ...boletimSecoes.filter((secao) => !isCadaDiaSection(secao)),
          cadaDiaSection,
        ]
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      }

      etapa = 'aniversariantes-mes';
      const aniversariantesSection = await buildAniversariantesSection(
        igrejaId,
        igrejaDetalhes?.timezone_boletim,
        boletimSecoes
      );
      boletimSecoes = boletimSecoes.filter((secao) => !isAniversariantesSection(secao));
      if (aniversariantesSection) {
        boletimSecoes = [...boletimSecoes, aniversariantesSection]
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
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
