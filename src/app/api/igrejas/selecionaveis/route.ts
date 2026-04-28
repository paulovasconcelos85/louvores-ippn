import { createClient } from '@supabase/supabase-js';
import https from 'node:https';
import { normalizeIgreja } from '@/lib/church-utils';
import {
  findUsuarioAcessoByAuthOrEmail,
  getAuthenticatedUserFromServerCookies,
  resolveCurrentIgrejaId,
} from '@/lib/server-church';
import { isSuperAdmin } from '@/lib/permissions';
import { apiError, apiSuccess } from '@/lib/api-response';

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

function buildSupabaseRestUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL nao configurada.');
  }

  return new URL(path, `${baseUrl}/`);
}

function getSupabaseServiceHeaders() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada.');
  }

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

function shouldAllowInsecureTls() {
  return process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0';
}

function isTlsCertificateChainError(error: unknown) {
  return (
    error instanceof Error &&
    /self-signed certificate in certificate chain/i.test(error.message)
  );
}

async function supabaseRestGetOnce<T>(path: string, rejectUnauthorized: boolean) {
  const url = buildSupabaseRestUrl(path);
  const headers = getSupabaseServiceHeaders();

  return new Promise<T>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        headers,
        rejectUnauthorized,
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          try {
            const parsed = body ? (JSON.parse(body) as T) : (null as T);

            if ((response.statusCode || 500) >= 400) {
              const message =
                typeof parsed === 'object' &&
                parsed &&
                'message' in parsed &&
                typeof parsed.message === 'string'
                  ? parsed.message
                  : `Supabase REST respondeu com status ${response.statusCode || 500}.`;

              reject(new Error(message));
              return;
            }

            resolve(parsed);
          } catch (parseError) {
            reject(parseError);
          }
        });
      }
    );

    request.on('error', reject);
    request.end();
  });
}

async function supabaseRestGet<T>(path: string) {
  try {
    return await supabaseRestGetOnce<T>(path, !shouldAllowInsecureTls());
  } catch (error) {
    if (!shouldAllowInsecureTls() && isTlsCertificateChainError(error)) {
      return supabaseRestGetOnce<T>(path, false);
    }

    throw error;
  }
}

async function listarIgrejasAtivas(igrejaIds?: string[]) {
  const url = new URL('/rest/v1/igrejas', buildSupabaseRestUrl('').toString());
  url.searchParams.set('select', '*');
  url.searchParams.set('ativo', 'eq.true');
  url.searchParams.set('order', 'nome.asc');

  if (igrejaIds && igrejaIds.length > 0) {
    url.searchParams.set('id', `in.(${igrejaIds.join(',')})`);
  }

  return supabaseRestGet<Record<string, unknown>[]>(url.pathname + url.search);
}

export async function GET(request: Request) {
  let etapa = 'iniciando';

  try {
    let user: { id?: string; email?: string | null } | null = null;

    try {
      etapa = 'auth.getUser';
      user = await getAuthenticatedUserFromServerCookies(request);
    } catch (authError) {
      console.warn(
        'Falha ao identificar usuario na rota de igrejas selecionaveis; seguindo como visitante.',
        authError
      );
    }

    let igrejasRaw: Record<string, unknown>[] | null = [];

    if (!user?.id) {
      etapa = 'query-igrejas-publicas';
      igrejasRaw = await listarIgrejasAtivas();
    } else if (isSuperAdmin(user.email)) {
      etapa = 'query-igrejas-superadmin';
      igrejasRaw = await listarIgrejasAtivas();
    } else {
      try {
        etapa = 'buscar-acesso';
        const acesso = await findUsuarioAcessoByAuthOrEmail(supabaseAdmin, user.id, user.email);

        etapa = 'buscar-vinculos';
        const { data: vinculos, error: vinculosError } = await supabaseAdmin
          .from('usuarios_igrejas')
          .select('igreja_id')
          .eq('usuario_id', acesso?.id || '')
          .eq('ativo', true);

        if (vinculosError) throw vinculosError;

        const igrejaIds = Array.from(
          new Set(
            [acesso?.igreja_id, ...(vinculos || []).map((vinculo) => vinculo.igreja_id)]
              .filter(Boolean)
          )
        );

        if (igrejaIds.length > 0) {
          etapa = 'query-igrejas-vinculadas';
          igrejasRaw = await listarIgrejasAtivas(igrejaIds);
        } else {
          igrejasRaw = [];
        }
      } catch (userChurchError) {
        console.warn(
          'Falha ao carregar igrejas vinculadas; retornando lista publica.',
          userChurchError
        );
        etapa = 'fallback-query-igrejas-publicas';
        igrejasRaw = await listarIgrejasAtivas();
      }
    }

    const igrejas = (igrejasRaw || []).map(normalizeIgreja).filter(Boolean);

    etapa = 'resolver-igreja-atual';
    let igrejaAtualId: string | null = null;

    if (user?.id) {
      try {
        igrejaAtualId = await resolveCurrentIgrejaId(null, request);
      } catch (resolveError) {
        console.warn('Falha ao resolver igreja atual; seguindo sem igreja atual.', resolveError);
      }
    }

    etapa = 'resposta';
    return apiSuccess({
      igrejas,
      igrejaAtualId,
    });
  } catch (error: any) {
    console.error('Erro ao listar igrejas selecionaveis:', { etapa, error });
    return apiError(
      'LOAD_CHURCHES_FAILED',
      500,
      error.message || 'Erro ao carregar igrejas.'
    );
  }
}
