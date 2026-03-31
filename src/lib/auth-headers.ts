'use client';

import { supabase } from '@/lib/supabase';

export async function buildAuthenticatedHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}
