import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getUserPermissionContext } from '@/lib/server-church';

const TIMEZONE_PADRAO = 'America/Manaus';

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

// Duplicado de boletins-home/route.ts de propósito: aquele arquivo não é um
// módulo compartilhado, e essa é uma conta pequena e isolada.
function getCurrentMonthInTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    if (Number.isFinite(month) && month >= 1 && month <= 12) return month;
  } catch {
    // cai no padrão abaixo
  }
  return new Date().getMonth() + 1;
}

function parseMesDiaNascimento(value: string | null | undefined) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const igrejaIdParam = searchParams.get('igreja_id');

  const contexto = await getUserPermissionContext(igrejaIdParam, request);

  if (!contexto?.user?.id) {
    return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');
  }

  // A igreja autorizada (resolvida pelo vínculo do usuário), não a pedida.
  const igrejaId = contexto.igrejaId;
  if (!igrejaId) {
    return apiError('CHURCH_REQUIRED', 400, 'Nenhuma igreja vinculada a esse usuário.');
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: igreja } = await supabase
      .from('igrejas')
      .select('timezone_boletim')
      .eq('id', igrejaId)
      .maybeSingle();

    const timezone = igreja?.timezone_boletim?.trim() || TIMEZONE_PADRAO;
    const mesAtual = getCurrentMonthInTimeZone(timezone);

    const { data: pessoas, error } = await supabase
      .from('pessoas')
      .select('nome, apelido, data_nascimento, pessoas_igrejas!inner(igreja_id, ativo, status_membro)')
      .eq('pessoas_igrejas.igreja_id', igrejaId)
      .eq('pessoas_igrejas.ativo', true)
      .in('pessoas_igrejas.status_membro', ['ativo', 'congregado']);

    if (error) throw error;

    const aniversariantes = (pessoas || [])
      .map((pessoa) => {
        const partes = parseMesDiaNascimento(pessoa.data_nascimento);
        if (!partes || partes.month !== mesAtual) return null;
        return {
          nome: pessoa.apelido?.trim() || pessoa.nome,
          dia: partes.day,
          mes: partes.month,
        };
      })
      .filter((item): item is { nome: string; dia: number; mes: number } => item !== null)
      .sort((a, b) => a.dia - b.dia);

    return apiSuccess({ aniversariantes });
  } catch (error: any) {
    console.error('Erro ao listar aniversariantes:', error);
    return apiError('LOAD_BIRTHDAYS_FAILED', 500, error.message || 'Erro ao carregar aniversariantes.');
  }
}
