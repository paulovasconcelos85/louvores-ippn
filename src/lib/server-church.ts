import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { isSuperAdmin } from '@/lib/permissions';

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
  const user = await getAuthenticatedUserFromCookies();
  return user?.id ?? null;
}

export async function resolveCurrentIgrejaId(preferredIgrejaId?: string | null) {
  if (preferredIgrejaId) return preferredIgrejaId;

  const user = await getAuthenticatedUserFromCookies();
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
