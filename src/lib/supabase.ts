// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ error }) => {
    if (error?.message?.includes('Refresh Token Not Found')) {
      supabase.auth.signOut()
    }
  })
}
