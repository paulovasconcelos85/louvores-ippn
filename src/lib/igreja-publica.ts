import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { resilientServerFetch } from '@/lib/resilient-server-fetch';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: resilientServerFetch,
    },
  }
);

export interface IgrejaPublica {
  id: string;
  slug: string;
  nome: string;
  nome_abreviado: string | null;
  nome_completo: string | null;
  logo_url: string | null;
}

// Dados mínimos para o app (PWA) e os metadados da página do boletim.
// `cache` evita repetir a consulta entre generateMetadata e a página na mesma requisição.
export const buscarIgrejaPublicaPorSlug = cache(async (slug: string): Promise<IgrejaPublica | null> => {
  const { data, error } = await supabaseAdmin
    .from('igrejas')
    .select('id, slug, nome, nome_abreviado, nome_completo, logo_url, visivel_publico')
    .eq('slug', slug.trim().toLowerCase())
    .eq('ativo', true)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.visivel_publico === false) return null;

  return {
    id: data.id,
    slug: data.slug,
    nome: data.nome,
    nome_abreviado: data.nome_abreviado ?? null,
    nome_completo: data.nome_completo ?? null,
    logo_url: data.logo_url?.trim() || null,
  };
});

// Bandeiras e outros emojis não cabem bem no rótulo sob o ícone do app.
function semEmoji(texto: string) {
  return texto.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, '').trim();
}

export function nomeCompletoIgreja(igreja: IgrejaPublica) {
  return semEmoji(igreja.nome_completo || igreja.nome);
}

export function nomeCurtoIgreja(igreja: IgrejaPublica) {
  const candidato = [igreja.nome_abreviado, igreja.nome]
    .map((valor) => (valor ? semEmoji(valor) : ''))
    .find(Boolean);
  return (candidato || igreja.slug.toUpperCase()).slice(0, 12);
}
