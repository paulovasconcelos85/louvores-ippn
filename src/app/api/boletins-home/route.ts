import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeIgreja } from '@/lib/church-utils';

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

interface BoletimSecaoRow {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
}

interface BoletimItemRow {
  id: string;
  secao_id: string | null;
  conteudo: string;
  destaque: boolean | null;
  ordem: number | null;
  criado_em: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const igrejaId = request.nextUrl.searchParams.get('igreja_id');

    if (!igrejaId) {
      return NextResponse.json(
        { error: 'igreja_id e obrigatorio.' },
        { status: 400 }
      );
    }

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

    const { data: secoesRaw, error: secoesError } = await supabaseAdmin
      .from('boletim_secoes')
      .select('*')
      .eq('igreja_id', igrejaId)
      .eq('visivel', true)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: true });

    if (secoesError) throw secoesError;

    const secoes = (secoesRaw || []) as BoletimSecaoRow[];
    const secaoIds = secoes.map((secao) => secao.id);

    const [
      { data: itensRaw, error: itensError },
      { data: cultosRaw, error: cultosError },
      { data: redesRaw, error: redesError },
      { data: igrejaDetalhes, error: detalhesError },
    ] = await Promise.all([
      secaoIds.length > 0
        ? supabaseAdmin
            .from('boletim_itens')
            .select('*')
            .in('secao_id', secaoIds)
            .order('ordem', { ascending: true })
            .order('criado_em', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from('igreja_cultos')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('horario', { ascending: true }),
      supabaseAdmin
        .from('igreja_redes_sociais')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('ativo', true)
        .order('ordem', { ascending: true }),
      supabaseAdmin
        .from('igrejas')
        .select(
          'id, nome, nome_abreviado, nome_completo, cidade, uf, pais, regiao, endereco_completo, logradouro, complemento, bairro, telefone, email, site, instagram, youtube, whatsapp, horario_publicacao_boletim, dia_publicacao_boletim, timezone_boletim'
        )
        .eq('id', igrejaId)
        .maybeSingle(),
    ]);

    if (itensError) throw itensError;
    if (cultosError) throw cultosError;
    if (redesError) throw redesError;
    if (detalhesError) throw detalhesError;
    const itens = (itensRaw || []) as BoletimItemRow[];
    const itensPorSecao = new Map<string, BoletimItemRow[]>();

    for (const item of itens) {
      if (!item.secao_id) continue;
      const secaoItens = itensPorSecao.get(item.secao_id) || [];
      secaoItens.push(item);
      itensPorSecao.set(item.secao_id, secaoItens);
    }

    const boletimSecoes = secoes.map((secao) => ({
      ...secao,
      itens: (itensPorSecao.get(secao.id) || []).sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0)
      ),
    }));

    return NextResponse.json({
      igreja,
      igrejaDetalhes,
      agendaCultos: cultosRaw || [],
      redesSociais: redesRaw || [],
      boletimSecoes,
      totalSecoes: boletimSecoes.length,
      message:
        boletimSecoes.length === 0
          ? 'Esta igreja ainda nao publicou secoes do boletim.'
          : null,
    });
  } catch (error: any) {
    console.error('Erro ao carregar boletim da home:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar boletim.' },
      { status: 500 }
    );
  }
}
