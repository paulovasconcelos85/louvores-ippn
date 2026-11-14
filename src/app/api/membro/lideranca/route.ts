import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getUserPermissionContext } from '@/lib/server-church';

// Ofícios pastorais (não cargos operacionais/técnicos como staff, secretário,
// tesoureiro ou músico), em ordem de exibição.
const CARGOS_LIDERANCA = ['pastor', 'presbitero', 'diacono', 'seminarista'] as const;
const ORDEM_CARGOS: Record<string, number> = Object.fromEntries(
  CARGOS_LIDERANCA.map((cargo, indice) => [cargo, indice])
);

let supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return supabaseAdmin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const igrejaIdParam = searchParams.get('igreja_id');

  const contexto = await getUserPermissionContext(igrejaIdParam, request);

  if (!contexto?.user?.id) {
    return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');
  }

  const igrejaId = contexto.igrejaId;
  if (!igrejaId) {
    return apiError('CHURCH_REQUIRED', 400, 'Nenhuma igreja vinculada a esse usuário.');
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: pessoas, error } = await supabase
      .from('pessoas')
      .select('nome, apelido, cargo, telefone, email, foto_url, pessoas_igrejas!inner(igreja_id, ativo)')
      .eq('pessoas_igrejas.igreja_id', igrejaId)
      .eq('pessoas_igrejas.ativo', true)
      .eq('ativo', true)
      .in('cargo', [...CARGOS_LIDERANCA]);

    if (error) throw error;

    const lideranca = (pessoas || [])
      .map((pessoa) => ({
        nome: pessoa.apelido?.trim() || pessoa.nome,
        cargo: pessoa.cargo,
        telefone: pessoa.telefone,
        email: pessoa.email,
        fotoUrl: pessoa.foto_url,
      }))
      .sort((a, b) => (ORDEM_CARGOS[a.cargo || ''] ?? 99) - (ORDEM_CARGOS[b.cargo || ''] ?? 99) || a.nome.localeCompare(b.nome));

    return apiSuccess({ lideranca });
  } catch (error: any) {
    console.error('Erro ao listar liderança:', error);
    return apiError('LOAD_LEADERSHIP_FAILED', 500, error.message || 'Erro ao carregar a liderança da igreja.');
  }
}
