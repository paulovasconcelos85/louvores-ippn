import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { syncApprovedUserAccess } from '@/lib/access-sync';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  // 1. Pegamos o parâmetro 'next' da URL, ou mandamos para /admin por padrão
  const next = requestUrl.searchParams.get('next') ?? '/admin';

  if (code) {
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      if (data.user) {
        const syncResult = await syncApprovedUserAccess({
          id: data.user.id,
          email: data.user.email,
        });

        if (syncResult.status !== 'granted') {
          const loginUrl = new URL('/login', request.url);
          loginUrl.searchParams.set('erro', syncResult.message);
          return NextResponse.redirect(loginUrl);
        }
      }

      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // Em caso de erro, volta para o login
  return NextResponse.redirect(new URL('/login', request.url));
}
