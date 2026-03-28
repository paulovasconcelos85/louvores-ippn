import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { syncApprovedUserAccess } from '@/lib/access-sync';

export async function POST() {
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
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Usuário não autenticado.' },
      { status: 401 }
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
