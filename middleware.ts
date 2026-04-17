import { NextResponse, type NextRequest } from 'next/server';
import {
  getPreferredLocale,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
} from './src/i18n/config';

export function middleware(request: NextRequest) {
  const locale = getPreferredLocale({
    queryLocale: request.nextUrl.searchParams.get('lang'),
    cookieLocale: request.cookies.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });

  const response = NextResponse.next();

  if (request.cookies.get(LOCALE_COOKIE_NAME)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
