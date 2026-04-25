import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getUserPermissionContext } from '@/lib/server-church';

type LeadStatus = 'novo' | 'em_contato' | 'demo_agendada' | 'convertido' | 'perdido';

const STATUS_VALIDOS = new Set<LeadStatus>([
  'novo',
  'em_contato',
  'demo_agendada',
  'convertido',
  'perdido',
]);

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
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

async function ensureSalesAccess(request: NextRequest) {
  const contexto = await getUserPermissionContext(null, request);

  if (!contexto?.user?.id) {
    return { error: apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.') };
  }

  if (!contexto.isSuperAdmin) {
    return {
      error: apiError(
        'SALES_ACCESS_REQUIRED',
        403,
        'Sem permissão para acessar os leads comerciais.'
      ),
    };
  }

  return { contexto };
}

export async function GET(request: NextRequest) {
  const auth = await ensureSalesAccess(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  if (status && status !== 'todos' && !STATUS_VALIDOS.has(status as LeadStatus)) {
    return apiError('OIKOS_LEAD_STATUS_INVALID', 400, 'Status inválido.');
  }

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('oikos_leads')
      .select(
        `
          id,
          nome,
          contato,
          mensagem,
          igreja,
          funcao,
          locale,
          origem,
          status,
          criado_em,
          atualizado_em
        `
      )
      .order('criado_em', { ascending: false });

    if (status && status !== 'todos') {
      query = query.eq('status', status);
    }

    const [leadsResult, novo, emContato, demoAgendada, convertido, perdido] = await Promise.all([
      query,
      supabase.from('oikos_leads').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
      supabase.from('oikos_leads').select('id', { count: 'exact', head: true }).eq('status', 'em_contato'),
      supabase.from('oikos_leads').select('id', { count: 'exact', head: true }).eq('status', 'demo_agendada'),
      supabase.from('oikos_leads').select('id', { count: 'exact', head: true }).eq('status', 'convertido'),
      supabase.from('oikos_leads').select('id', { count: 'exact', head: true }).eq('status', 'perdido'),
    ]);

    if (leadsResult.error) throw leadsResult.error;
    if (novo.error) throw novo.error;
    if (emContato.error) throw emContato.error;
    if (demoAgendada.error) throw demoAgendada.error;
    if (convertido.error) throw convertido.error;
    if (perdido.error) throw perdido.error;

    return apiSuccess({
      leads: leadsResult.data || [],
      contadores: {
        novo: novo.count || 0,
        em_contato: emContato.count || 0,
        demo_agendada: demoAgendada.count || 0,
        convertido: convertido.count || 0,
        perdido: perdido.count || 0,
        total:
          (novo.count || 0) +
          (emContato.count || 0) +
          (demoAgendada.count || 0) +
          (convertido.count || 0) +
          (perdido.count || 0),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar leads OIKOS:', error);
    return apiError(
      'LOAD_OIKOS_LEADS_FAILED',
      500,
      error.message || 'Erro ao carregar leads comerciais.'
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureSalesAccess(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const id = typeof body?.id === 'string' ? body.id : null;
  const status = typeof body?.status === 'string' ? body.status : null;

  if (!id || !status || !STATUS_VALIDOS.has(status as LeadStatus)) {
    return apiError(
      'OIKOS_LEAD_AND_STATUS_REQUIRED',
      400,
      'Lead e status válidos são obrigatórios.'
    );
  }

  try {
    const { data: lead, error } = await getSupabaseAdmin()
      .from('oikos_leads')
      .update({ status })
      .eq('id', id)
      .select(
        `
          id,
          nome,
          contato,
          mensagem,
          igreja,
          funcao,
          locale,
          origem,
          status,
          criado_em,
          atualizado_em
        `
      )
      .single();

    if (error) throw error;

    return apiSuccess(
      { lead },
      {
        message: 'Status do lead atualizado.',
        messageCode: 'OIKOS_LEAD_UPDATED',
      }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar lead OIKOS:', error);
    return apiError(
      'UPDATE_OIKOS_LEAD_FAILED',
      500,
      error.message || 'Erro ao atualizar lead comercial.'
    );
  }
}
