import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { isSuperAdmin, podeGerenciarUsuariosComTags, podePastorearMembros } from '@/lib/permissions';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getSupabaseAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getBearerToken(request?: Request | null) {
  const authHeader = request?.headers.get('Authorization');
  return authHeader?.replace(/^Bearer\s+/i, '').trim() || null;
}

async function getAuthenticatedUserFromCookies() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function getAuthenticatedUser(request?: Request | null) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const supabaseAnon = getSupabaseAnonClient();
    const userResponse = await supabaseAnon.auth.getUser(bearerToken);

    if (userResponse.data.user) {
      return userResponse.data.user;
    }
  }

  return getAuthenticatedUserFromCookies();
}

export async function getAuthenticatedUserFromServerCookies(request?: Request | null) {
  return getAuthenticatedUser(request);
}

async function getDefaultIgrejaId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: igreja, error } = await supabaseAdmin
    .from('igrejas')
    .select('id')
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return igreja?.id || null;
}

export async function getAuthenticatedUserIdFromCookies() {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}

export async function resolveCurrentIgrejaId(preferredIgrejaId?: string | null, request?: Request | null) {
  if (preferredIgrejaId) return preferredIgrejaId;

  const user = await getAuthenticatedUser(request);
  if (!user?.id) return null;

  const supabaseAdmin = getSupabaseAdmin();

  const { data: acesso, error: acessoError } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (acessoError) throw acessoError;
  if (!acesso) {
    return isSuperAdmin(user.email) ? getDefaultIgrejaId(supabaseAdmin) : null;
  }

  const { data: vinculo, error: vinculoError } = await supabaseAdmin
    .from('usuarios_igrejas')
    .select('igreja_id')
    .eq('usuario_id', acesso.id)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();

  if (vinculoError) throw vinculoError;

  return (
    vinculo?.igreja_id ||
    acesso.igreja_id ||
    (isSuperAdmin(user.email) ? await getDefaultIgrejaId(supabaseAdmin) : null)
  );
}

export async function resolveAuthorizedCurrentIgrejaId(
  preferredIgrejaId?: string | null,
  request?: Request | null
) {
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return null;

  const supabaseAdmin = getSupabaseAdmin();

  const { data: acesso, error: acessoError } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, igreja_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (acessoError) throw acessoError;

  const ehSuperAdmin = isSuperAdmin(user.email);

  if (!acesso) {
    if (ehSuperAdmin) {
      return preferredIgrejaId || (await getDefaultIgrejaId(supabaseAdmin));
    }
    return null;
  }

  const { data: vinculos, error: vinculosError } = await supabaseAdmin
    .from('usuarios_igrejas')
    .select('igreja_id')
    .eq('usuario_id', acesso.id)
    .eq('ativo', true);

  if (vinculosError) throw vinculosError;

  const igrejaIds = new Set(
    [acesso.igreja_id, ...(vinculos || []).map((vinculo) => vinculo.igreja_id)].filter(Boolean)
  );

  if (preferredIgrejaId && igrejaIds.has(preferredIgrejaId)) {
    return preferredIgrejaId;
  }

  if (ehSuperAdmin) {
    return preferredIgrejaId || [...igrejaIds][0] || (await getDefaultIgrejaId(supabaseAdmin));
  }

  return [...igrejaIds][0] || null;
}

export async function getUserPermissionContext(
  preferredIgrejaId?: string | null,
  request?: Request | null
) {
  const user = await getAuthenticatedUser(request);
  if (!user?.id) return null;

  const supabaseAdmin = getSupabaseAdmin();
  const igrejaId = await resolveAuthorizedCurrentIgrejaId(preferredIgrejaId, request);
  const ehSuperAdmin = isSuperAdmin(user.email);

  const { data: acesso, error: acessoError } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, pessoa_id, igreja_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (acessoError) throw acessoError;

  let cargo: string | null = ehSuperAdmin ? 'superadmin' : null;

  if (acesso?.id) {
    let query = supabaseAdmin
      .from('usuarios_igrejas')
      .select('cargo')
      .eq('usuario_id', acesso.id)
      .eq('ativo', true)
      .limit(1);

    if (igrejaId) {
      query = query.eq('igreja_id', igrejaId);
    }

    const { data: vinculo, error: vinculoError } = await query.maybeSingle();
    if (vinculoError) throw vinculoError;
    cargo = (vinculo?.cargo as string | null) || cargo;
  }

  let tags: Array<{ id: string; nome: string; categoria: string; cor?: string | null; icone?: string | null }> = [];

  if (acesso?.pessoa_id) {
    const { data: tagsData, error: tagsError } = await supabaseAdmin
      .from('usuarios_tags')
      .select(`
        tag_id,
        tags_funcoes (
          id,
          nome,
          categoria,
          cor,
          icone
        )
      `)
      .eq('pessoa_id', acesso.pessoa_id);

    if (tagsError) throw tagsError;

    tags = (tagsData || [])
      .map((item: any) => item.tags_funcoes)
      .filter(Boolean);
  }

  return {
    user,
    acesso,
    igrejaId,
    cargo,
    tags,
    isSuperAdmin: ehSuperAdmin,
    canManageUsers: podeGerenciarUsuariosComTags((cargo as any) || null, tags, user.email),
    canPastorMembers: podePastorearMembros((cargo as any) || null),
  };
}
