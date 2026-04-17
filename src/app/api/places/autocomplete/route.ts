import { NextRequest, NextResponse } from 'next/server';
import { getGoogleMapsLanguage } from '@/i18n/config';
import { getLocaleFromNextRequest } from '@/i18n/server';

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input');
  const sessiontoken = request.nextUrl.searchParams.get('sessiontoken');

  if (!input) return NextResponse.json({ predictions: [] });

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', input);
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!);
  url.searchParams.set('language', getGoogleMapsLanguage(getLocaleFromNextRequest(request)));
  url.searchParams.set('components', 'country:br');
  url.searchParams.set('types', 'address');
  if (sessiontoken) url.searchParams.set('sessiontoken', sessiontoken);

  const res = await fetch(url.toString());
  const data = await res.json();
  return NextResponse.json(data);
}
