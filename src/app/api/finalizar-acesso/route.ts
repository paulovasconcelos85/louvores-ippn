import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { syncApprovedUserAccess } from '@/lib/access-sync';
import { isSuperAdmin } from '@/lib/permissions';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authHeader = request.headers.get('Authorization');

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

  let user = null;
  let authError = null;

  const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim() || undefined;

  if (bearerToken) {
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const userResponse = await supabaseClient.auth.getUser(bearerToken);
    user = userResponse.data.user;
    authError = userResponse.error;
  }

  if (!user) {
    const userResponse = await supabase.auth.getUser();
    user = userResponse.data.user;
    authError = userResponse.error;
  }

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Usuário não autenticado.' },
      { status: 401 }
    );
  }

  if (isSuperAdmin(user.email)) {
    return NextResponse.json(
      {
        status: 'granted',
        message: 'Acesso de superadmin validado com sucesso.',
      },
      { status: 200 }
    );
  }

  try {
    const result = await syncApprovedUserAccess({
      id: user.id,
      email: user.email,
    });

    const statusMap: Record<typeof result.status, number> = {
      granted: 200,
      pending_approval: 403,
      not_found: 404,
      conflict: 409,
    };

    return NextResponse.json(result, { status: statusMap[result.status] });
  } catch (error: any) {
    console.error('Erro ao finalizar acesso:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao finalizar acesso.' },
      { status: 500 }
    );
  }
}
