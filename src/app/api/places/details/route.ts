import { NextRequest, NextResponse } from 'next/server';
import { getGoogleMapsLanguage } from '@/i18n/config';
import { getLocaleFromNextRequest } from '@/i18n/server';

export async function GET(request: NextRequest) {
  const place_id = request.nextUrl.searchParams.get('place_id');
  const sessiontoken = request.nextUrl.searchParams.get('sessiontoken');

  if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 });

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', place_id);
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!);
  url.searchParams.set('language', getGoogleMapsLanguage(getLocaleFromNextRequest(request)));
  url.searchParams.set('fields', 'address_components,geometry,formatted_address');
  if (sessiontoken) url.searchParams.set('sessiontoken', sessiontoken);

  const res = await fetch(url.toString());
  const data = await res.json();
  return NextResponse.json(data);
}
