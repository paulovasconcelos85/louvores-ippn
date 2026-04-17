import type { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getPreferredLocale, LOCALE_COOKIE_NAME } from './config';

export async function getRequestLocale() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return getPreferredLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get('accept-language'),
  });
}

export function getLocaleFromNextRequest(request: NextRequest) {
  return getPreferredLocale({
    queryLocale: request.nextUrl.searchParams.get('lang'),
    cookieLocale: request.cookies.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });
}
