import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { syncApprovedUserAccess } from '@/lib/access-sync';
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
} from '@/i18n/config';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  let authError =
    requestUrl.searchParams.get('error_description') ||
    requestUrl.searchParams.get('error');
  const locale = normalizeLocale(requestUrl.searchParams.get('lang'));
  // 1. Pegamos o parâmetro 'next' da URL, ou mandamos para /admin por padrão
  const next = requestUrl.searchParams.get('next') ?? '/admin';
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const applyResponseCookies = (response: NextResponse) => {
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    if (locale) {
      response.cookies.set(LOCALE_COOKIE_NAME, locale, {
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax',
      });
    }

    return response;
  };

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
            cookiesToSet.push({ name, value, options });
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookiesToSet.push({ name, value: '', options });
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      if (data.user) {
        let syncResult;

        try {
          syncResult = await syncApprovedUserAccess({
            id: data.user.id,
            email: data.user.email,
          });
        } catch (syncError) {
          authError =
            syncError instanceof Error
              ? syncError.message
              : 'Erro ao sincronizar acesso do usuário.';
        }

        if (authError) {
          await supabase.auth.signOut();
        }

        if (syncResult && syncResult.status !== 'granted') {
          await supabase.auth.signOut();
          const loginUrl = new URL('/login', request.url);
          loginUrl.searchParams.set('erro', syncResult.message);
          if (locale) {
            loginUrl.searchParams.set('lang', locale);
          }
          return applyResponseCookies(NextResponse.redirect(loginUrl));
        }
      }

      if (authError) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('erro', authError);
        if (locale) {
          loginUrl.searchParams.set('lang', locale);
        }
        return applyResponseCookies(NextResponse.redirect(loginUrl));
      }

      return applyResponseCookies(NextResponse.redirect(new URL(next, request.url)));
    }

    authError = error.message;
  }

  // Em caso de erro, volta para o login
  if (authError) {
    const fallbackUrl = new URL('/login', request.url);
    fallbackUrl.searchParams.set('erro', authError);
    if (locale) {
      fallbackUrl.searchParams.set('lang', locale);
    }
    return applyResponseCookies(NextResponse.redirect(fallbackUrl));
  }

  const fallbackResponse = NextResponse.redirect(new URL('/login', request.url));

  return applyResponseCookies(fallbackResponse);
}
