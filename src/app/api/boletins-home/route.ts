import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeIgreja, resolveBoletimSourceTable } from '@/lib/church-utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const igrejaId = searchParams.get('igreja_id');
    const page = Number(searchParams.get('page') || '0');
    const safePage = Number.isFinite(page) && page >= 0 ? page : 0;
    const from = safePage * 10;
    const to = from + 9;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: igrejaRaw, error: igrejaError } = await supabaseAdmin
      .from('igrejas')
      .select('*')
      .eq('id', igrejaId)
      .maybeSingle();

    if (igrejaError) throw igrejaError;

    const igreja = igrejaRaw ? normalizeIgreja(igrejaRaw) : null;

    if (!igreja) {
      return NextResponse.json(
        { error: 'Igreja nao encontrada.' },
        { status: 404 }
      );
    }

    const sourceTable = resolveBoletimSourceTable(igreja);

    if (!sourceTable) {
      return NextResponse.json({
        igreja,
        sourceTable: null,
        boletins: [],
        total: 0,
        message: 'Esta igreja ainda nao possui uma fonte de boletim configurada no sistema.',
      });
    }

    const agora = new Date();
    const diaSemana = agora.getDay();
    const horaAtual = agora.getHours();
    let dataDeCorteFuturos: Date;

    if (user) {
      dataDeCorteFuturos = new Date();
      dataDeCorteFuturos.setDate(dataDeCorteFuturos.getDate() + 14);
    } else if (diaSemana === 6 && horaAtual >= 14) {
      dataDeCorteFuturos = new Date();
      dataDeCorteFuturos.setDate(dataDeCorteFuturos.getDate() + 1);
      dataDeCorteFuturos.setHours(23, 59, 59);
    } else if (diaSemana === 0) {
      dataDeCorteFuturos = new Date();
      dataDeCorteFuturos.setHours(23, 59, 59);
    } else {
      dataDeCorteFuturos = new Date();
      dataDeCorteFuturos.setHours(0, 0, 0, 0);
    }

    const { data, error } = await supabaseAdmin
      .from(sourceTable)
      .select(`
        "Culto nr.",
        Dia,
        imagem_url,
        palavra_pastoral,
        palavra_pastoral_autor,
        louvor_itens (
          id,
          ordem,
          tipo,
          tom,
          conteudo_publico,
          canticos ( nome )
        )
      `)
      .lte('Dia', dataDeCorteFuturos.toISOString())
      .order('"Culto nr."', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({
      igreja,
      sourceTable,
      boletins: data || [],
      total: (data || []).length,
      message: null,
    });
  } catch (error: any) {
    console.error('Erro ao carregar boletins da home:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar boletins.' },
      { status: 500 }
    );
  }
}
