import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import { normalizeIgreja } from '@/lib/church-utils';
import {
  getAuthenticatedUserFromServerCookies,
  resolveAuthorizedCurrentIgrejaId,
} from '@/lib/server-church';

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

type PessoaVinculoRow = {
  igreja_id: string;
  cargo: string | null;
  status_membro: string | null;
  ativo: boolean | null;
};

type PessoaDashboardRow = {
  id: string;
  nome: string | null;
  data_nascimento: string | null;
  grupo_familiar_nome: string | null;
  usuario_id: string | null;
  pessoas_igrejas?: PessoaVinculoRow[] | PessoaVinculoRow | null;
};

type AcessoPessoaRow = {
  id: string;
  pessoa_id: string | null;
};

type UsuarioIgrejaRow = {
  usuario_id: string | null;
};

type CultoDashboardRow = {
  'Culto nr.': number;
  Dia: string;
};

type LouvorItemDashboardRow = {
  culto_id: number;
  cantico_id: string | number | null;
  tom: string | null;
};

type PessoaNormalizada = {
  id: string;
  birthDate: string | null;
  familyName: string | null;
  hasAccess: boolean;
  role: string;
  status: string;
  active: boolean;
};

const STATUS_ORDER = ['ativo', 'congregado', 'visitante', 'afastado', 'falecido'];
const AGE_BUCKETS = [
  { key: '0-12', min: 0, max: 12 },
  { key: '13-17', min: 13, max: 17 },
  { key: '18-25', min: 18, max: 25 },
  { key: '26-40', min: 26, max: 40 },
  { key: '41-60', min: 41, max: 60 },
  { key: '61+', min: 61, max: Number.POSITIVE_INFINITY },
] as const;

function parsePositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getAnoFromDate(date: string) {
  return Number(date.slice(0, 4));
}

function getMesFromDate(date: string) {
  return Number(date.slice(5, 7));
}

function normalizeVinculo(vinculos: PessoaDashboardRow['pessoas_igrejas']) {
  if (Array.isArray(vinculos)) {
    return vinculos[0] || null;
  }

  return vinculos || null;
}

function calculateAge(date: string | null) {
  if (!date) return null;

  const [yearRaw, monthRaw, dayRaw] = date.split('-').map(Number);
  if (!yearRaw || !monthRaw || !dayRaw) return null;

  const today = new Date();
  let age = today.getFullYear() - yearRaw;
  const monthDiff = today.getMonth() + 1 - monthRaw;

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dayRaw)) {
    age -= 1;
  }

  if (age < 0 || age > 120) return null;
  return age;
}

function buildAgeBreakdown(ages: number[]) {
  return AGE_BUCKETS.map((bucket) => ({
    faixa: bucket.key,
    total: ages.filter((age) => age >= bucket.min && age <= bucket.max).length,
  }));
}

function buildStatusBreakdown(pessoas: PessoaNormalizada[]) {
  const totals = new Map<string, number>();

  pessoas.forEach((pessoa) => {
    const status = pessoa.status || 'sem_status';
    totals.set(status, (totals.get(status) || 0) + 1);
  });

  return [...totals.entries()]
    .map(([status, total]) => ({ status, total }))
    .sort((a, b) => {
      const indexA = STATUS_ORDER.indexOf(a.status);
      const indexB = STATUS_ORDER.indexOf(b.status);

      if (indexA === -1 && indexB === -1) {
        return a.status.localeCompare(b.status);
      }

      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
}

function buildRolesBreakdown(pessoas: PessoaNormalizada[]) {
  const totals = new Map<string, number>();

  pessoas
    .filter((pessoa) => pessoa.hasAccess && pessoa.role !== 'membro')
    .forEach((pessoa) => {
      totals.set(pessoa.role, (totals.get(pessoa.role) || 0) + 1);
    });

  return [...totals.entries()]
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => {
      if (a.total !== b.total) {
        return b.total - a.total;
      }

      return a.cargo.localeCompare(b.cargo);
    });
}

function buildRecentServiceDays(cultos: CultoDashboardRow[]) {
  const totals = new Map<string, number>();

  cultos.forEach((culto) => {
    totals.set(culto.Dia, (totals.get(culto.Dia) || 0) + 1);
  });

  return [...totals.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([date, total]) => ({ date, total }));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveMusicNames(igrejaId: string, canticoIdsRaw: string[]) {
  const canticoIds = Array.from(new Set(canticoIdsRaw.filter(Boolean)));
  const idsUuid = canticoIds.filter(isUuid);
  const idsHinario = canticoIds
    .filter((value) => !isUuid(value) && /^\d+$/.test(value))
    .map((value) => Number(value));

  const [canticosResult, hinarioResult] = await Promise.all([
    idsUuid.length > 0
      ? supabaseAdmin.from('canticos').select('id, nome').eq('igreja_id', igrejaId).in('id', idsUuid)
      : Promise.resolve({ data: [], error: null }),
    idsHinario.length > 0
      ? supabaseAdmin.from('hinario_novo_cantico').select('id, numero, titulo').in('id', idsHinario)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (canticosResult.error) throw canticosResult.error;
  if (hinarioResult.error) throw hinarioResult.error;

  const nomesPorId = new Map<string, string>();

  ((canticosResult.data || []) as Array<{ id: string; nome: string | null }>).forEach((cantico) => {
    nomesPorId.set(String(cantico.id), cantico.nome?.trim() || 'Cântico sem nome');
  });

  (
    (hinarioResult.data || []) as Array<{
      id: string | number;
      numero: string | null;
      titulo: string | null;
    }>
  ).forEach((hino) => {
    const numero = hino.numero?.trim();
    const titulo = hino.titulo?.trim() || 'Sem título';
    nomesPorId.set(
      String(hino.id),
      numero ? `Hino ${numero} - ${titulo}` : `Hino - ${titulo}`
    );
  });

  return nomesPorId;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUserFromServerCookies(request);

    if (!user?.id) {
      return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');
    }

    const url = new URL(request.url);
    const igrejaParam = url.searchParams.get('igreja_id');
    const requestedYear = parsePositiveInt(url.searchParams.get('year'));
    const igrejaId = await resolveAuthorizedCurrentIgrejaId(igrejaParam, request);

    if (!igrejaId) {
      return apiError('CHURCH_REQUIRED', 400, 'Nenhuma igreja selecionada.');
    }

    const [
      { data: igrejaRaw, error: igrejaError },
      { data: pessoasRaw, error: pessoasError },
      { data: cultosRaw, error: cultosError },
      { data: acessosDiretos, error: acessosDiretosError },
      { data: vinculosUsuarios, error: vinculosUsuariosError },
    ] = await Promise.all([
      supabaseAdmin.from('igrejas').select('*').eq('id', igrejaId).maybeSingle(),
      supabaseAdmin
        .from('pessoas')
        .select(
          `
            id,
            nome,
            data_nascimento,
            grupo_familiar_nome,
            usuario_id,
            pessoas_igrejas!inner(
              igreja_id,
              cargo,
              status_membro,
              ativo
            )
          `
        )
        .eq('pessoas_igrejas.igreja_id', igrejaId)
        .order('nome', { ascending: true }),
      supabaseAdmin
        .from('Louvores IPPN')
        .select('"Culto nr.", Dia')
        .eq('igreja_id', igrejaId)
        .order('Dia', { ascending: false }),
      supabaseAdmin
        .from('usuarios_acesso')
        .select('id, pessoa_id')
        .eq('igreja_id', igrejaId)
        .not('pessoa_id', 'is', null),
      supabaseAdmin
        .from('usuarios_igrejas')
        .select('usuario_id')
        .eq('igreja_id', igrejaId)
        .eq('ativo', true),
    ]);

    if (igrejaError) throw igrejaError;
    if (pessoasError) throw pessoasError;
    if (cultosError) throw cultosError;
    if (acessosDiretosError) throw acessosDiretosError;
    if (vinculosUsuariosError) throw vinculosUsuariosError;

    const igreja = igrejaRaw ? normalizeIgreja(igrejaRaw) : null;

    if (!igreja) {
      return apiError('CHURCH_NOT_FOUND', 404, 'Igreja não encontrada.');
    }

    const usuarioIdsPorVinculo = ((vinculosUsuarios || []) as UsuarioIgrejaRow[])
      .map((vinculo) => vinculo.usuario_id)
      .filter(Boolean) as string[];

    let acessosPorVinculo: AcessoPessoaRow[] = [];

    if (usuarioIdsPorVinculo.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, pessoa_id')
        .in('id', usuarioIdsPorVinculo)
        .not('pessoa_id', 'is', null);

      if (error) throw error;
      acessosPorVinculo = (data || []) as AcessoPessoaRow[];
    }

    const pessoaIdsComAcesso = new Set(
      [...((acessosDiretos || []) as AcessoPessoaRow[]), ...acessosPorVinculo]
        .map((acesso) => acesso.pessoa_id)
        .filter(Boolean) as string[]
    );

    const pessoas = ((pessoasRaw || []) as PessoaDashboardRow[]).map((pessoa) => {
      const vinculo = normalizeVinculo(pessoa.pessoas_igrejas);

      return {
        id: pessoa.id,
        birthDate: pessoa.data_nascimento,
        familyName: pessoa.grupo_familiar_nome?.trim() || null,
        hasAccess: Boolean(pessoa.usuario_id) || pessoaIdsComAcesso.has(pessoa.id),
        role: vinculo?.cargo?.trim() || 'membro',
        status: vinculo?.status_membro?.trim() || 'ativo',
        active: vinculo?.ativo !== false,
      } satisfies PessoaNormalizada;
    });

    const pessoasAtuais = pessoas.filter((pessoa) => pessoa.active);
    const ages = pessoasAtuais
      .map((pessoa) => calculateAge(pessoa.birthDate))
      .filter((age): age is number => age !== null);
    const familyNames = new Set(
      pessoasAtuais
        .map((pessoa) => pessoa.familyName)
        .filter(Boolean) as string[]
    );
    const pessoasComFamilia = pessoasAtuais.filter((pessoa) => Boolean(pessoa.familyName));
    const pessoasServindo = pessoasAtuais.filter(
      (pessoa) => pessoa.hasAccess && pessoa.role !== 'membro'
    );

    const cultos = (cultosRaw || []) as CultoDashboardRow[];
    const anosDisponiveis = Array.from(
      new Set(cultos.map((culto) => getAnoFromDate(culto.Dia)))
    ).sort((a, b) => b - a);

    const selectedYear =
      requestedYear && anosDisponiveis.includes(requestedYear)
        ? requestedYear
        : anosDisponiveis[0] || null;

    const cultosDoAnoSelecionado =
      selectedYear === null
        ? []
        : cultos.filter((culto) => getAnoFromDate(culto.Dia) === selectedYear);
    const cultoIdsDoAnoSelecionado = cultosDoAnoSelecionado.map((culto) => culto['Culto nr.']);

    const monthlyServices = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      total: 0,
    }));

    cultosDoAnoSelecionado.forEach((culto) => {
      const monthIndex = getMesFromDate(culto.Dia) - 1;
      if (monthIndex >= 0 && monthIndex < monthlyServices.length) {
        monthlyServices[monthIndex].total += 1;
      }
    });

    let totalExecutions = 0;
    let uniqueSongs = 0;
    let topKey: string | null = null;
    let averageSongsPerService = 0;
    let mostPlayedSong: string | null = null;
    let topSongs: Array<{ song: string; total: number }> = [];
    const monthlyExecutions = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      total: 0,
    }));
    let topKeys: Array<{ key: string; total: number }> = [];
    let recentSongs: Array<{ song: string; lastDate: string; daysAgo: number }> = [];

    if (cultoIdsDoAnoSelecionado.length > 0) {
      const { data: itensRaw, error: itensError } = await supabaseAdmin
        .from('louvor_itens')
        .select('culto_id, cantico_id, tom')
        .in('culto_id', cultoIdsDoAnoSelecionado)
        .not('cantico_id', 'is', null);

      if (itensError) throw itensError;

      const cultosPorId = new Map(
        cultosDoAnoSelecionado.map((culto) => [culto['Culto nr.'], culto.Dia])
      );
      const itensValidos = ((itensRaw || []) as LouvorItemDashboardRow[])
        .map((item) => ({
          culto_id: item.culto_id,
          cantico_id: item.cantico_id ? String(item.cantico_id) : null,
          tom: item.tom?.trim() || null,
        }))
        .filter((item) => item.cantico_id && cultosPorId.has(item.culto_id));

      if (itensValidos.length > 0) {
        const nomesPorId = await resolveMusicNames(
          igrejaId,
          itensValidos.map((item) => item.cantico_id!).filter(Boolean)
        );

        const executions = itensValidos.map((item) => {
          const date = cultosPorId.get(item.culto_id)!;
          const month = getMesFromDate(date);
          const song =
            nomesPorId.get(item.cantico_id!) || `Música ${item.cantico_id}`;

          return {
            song,
            key: item.tom,
            date,
            month,
          };
        });

        const songTotals = new Map<string, number>();
        const keyTotals = new Map<string, number>();
        const latestSongDates = new Map<string, string>();

        executions.forEach((execution) => {
          songTotals.set(execution.song, (songTotals.get(execution.song) || 0) + 1);

          if (execution.key) {
            keyTotals.set(execution.key, (keyTotals.get(execution.key) || 0) + 1);
          }

          const currentLatest = latestSongDates.get(execution.song);
          if (!currentLatest || execution.date > currentLatest) {
            latestSongDates.set(execution.song, execution.date);
          }

          const monthIndex = execution.month - 1;
          if (monthIndex >= 0 && monthIndex < monthlyExecutions.length) {
            monthlyExecutions[monthIndex].total += 1;
          }
        });

        topSongs = [...songTotals.entries()]
          .map(([song, total]) => ({ song, total }))
          .sort((a, b) => {
            if (a.total !== b.total) return b.total - a.total;
            return a.song.localeCompare(b.song);
          })
          .slice(0, 8);

        topKeys = [...keyTotals.entries()]
          .map(([key, total]) => ({ key, total }))
          .sort((a, b) => {
            if (a.total !== b.total) return b.total - a.total;
            return a.key.localeCompare(b.key);
          })
          .slice(0, 8);

        const today = new Date();
        recentSongs = [...latestSongDates.entries()]
          .map(([song, lastDate]) => {
            const executionDate = new Date(`${lastDate}T00:00:00`);
            const daysAgo = Math.max(
              0,
              Math.floor((today.getTime() - executionDate.getTime()) / (1000 * 60 * 60 * 24))
            );

            return {
              song,
              lastDate,
              daysAgo,
            };
          })
          .sort((a, b) => a.lastDate.localeCompare(b.lastDate) * -1)
          .slice(0, 8);

        totalExecutions = executions.length;
        uniqueSongs = songTotals.size;
        topKey = topKeys[0]?.key || null;
        averageSongsPerService =
          cultosDoAnoSelecionado.length > 0
            ? Number((executions.length / cultosDoAnoSelecionado.length).toFixed(1))
            : 0;
        mostPlayedSong = topSongs[0]?.song || null;
      }
    }

    return apiSuccess({
      igreja,
      availableYears: anosDisponiveis,
      selectedYear,
      overview: {
        totalRegistered: pessoas.length,
        totalPeople: pessoasAtuais.length,
        inactiveRecords: Math.max(pessoas.length - pessoasAtuais.length, 0),
        activeMembers: pessoasAtuais.filter((pessoa) => pessoa.status === 'ativo').length,
        congregants: pessoasAtuais.filter((pessoa) => pessoa.status === 'congregado').length,
        visitors: pessoasAtuais.filter((pessoa) => pessoa.status === 'visitante').length,
        families: familyNames.size,
        peopleInFamilies: pessoasComFamilia.length,
        withAccess: pessoasAtuais.filter((pessoa) => pessoa.hasAccess).length,
        servingPeople: pessoasServindo.length,
        averageAge:
          ages.length > 0
            ? Number((ages.reduce((acc, age) => acc + age, 0) / ages.length).toFixed(1))
            : null,
      },
      breakdowns: {
        status: buildStatusBreakdown(pessoas),
        age: buildAgeBreakdown(ages),
        roles: buildRolesBreakdown(pessoasAtuais),
      },
      activity: {
        servicesInYear: cultosDoAnoSelecionado.length,
        latestServiceDate: cultos[0]?.Dia || null,
        monthlyServices,
        recentServiceDays: buildRecentServiceDays(cultos),
      },
      music: {
        totalExecutions,
        uniqueSongs,
        topKey,
        averageSongsPerService,
        mostPlayedSong,
        topSongs,
        monthlyExecutions,
        topKeys,
        recentSongs,
      },
    });
  } catch (error: any) {
    console.error('Erro ao carregar dashboard:', error);
    return apiError(
      'LOAD_DASHBOARD_FAILED',
      500,
      error.message || 'Erro ao carregar dashboard.'
    );
  }
}
