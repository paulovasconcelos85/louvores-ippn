import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

interface LegacyLouvorItemRow {
  id: string;
  culto_id: number;
  ordem: number | null;
  tipo: string | null;
  tom: string | null;
  cantico_id: string | null;
  conteudo_publico: string | null;
}

interface LegacyCultoRow {
  'Culto nr.': number;
  Dia: string;
  imagem_url: string | null;
  igreja_id: string | null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(request: NextRequest) {
  try {
    const igrejaId = request.nextUrl.searchParams.get('igreja_id');

    if (!igrejaId) {
      return NextResponse.json({ error: 'igreja_id e obrigatorio.' }, { status: 400 });
    }

    const { data: cultosRaw, error: cultosError } = await supabaseAdmin
      .from('Louvores IPPN')
      .select('"Culto nr.", Dia, imagem_url, igreja_id')
      .eq('igreja_id', igrejaId)
      .order('Dia', { ascending: false })
      .limit(7);

    if (cultosError) throw cultosError;

    const cultos = ((cultosRaw || []) as LegacyCultoRow[]).slice(1);
    const cultoIds = cultos.map((culto) => culto['Culto nr.']);

    if (cultoIds.length === 0) {
      return NextResponse.json({ boletins: [] });
    }

    const { data: itensRaw, error: itensError } = await supabaseAdmin
      .from('louvor_itens')
      .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico')
      .in('culto_id', cultoIds)
      .order('culto_id', { ascending: false })
      .order('ordem', { ascending: true });

    if (itensError) throw itensError;

    const itens = (itensRaw || []) as LegacyLouvorItemRow[];
    const canticoIds = itens
      .map((item) => item.cantico_id)
      .filter((value): value is string => Boolean(value && isUuid(value)));

    const { data: canticosRaw, error: canticosError } =
      canticoIds.length > 0
        ? await supabaseAdmin.from('canticos').select('id, nome').in('id', canticoIds)
        : { data: [], error: null };

    if (canticosError) throw canticosError;

    const canticosPorId = new Map(
      ((canticosRaw || []) as Array<{ id: string; nome: string | null }>).map((cantico) => [
        cantico.id,
        cantico.nome,
      ])
    );

    const itensPorCulto = new Map<number, LegacyLouvorItemRow[]>();

    for (const item of itens) {
      const lista = itensPorCulto.get(item.culto_id) || [];
      lista.push(item);
      itensPorCulto.set(item.culto_id, lista);
    }

    const boletins = cultos.map((culto) => {
      const itensCulto = (itensPorCulto.get(culto['Culto nr.']) || []).map((item, index) => {
        const tituloItem = item.tipo || `Item ${index + 1}`;
        const nomeCantico = item.cantico_id ? canticosPorId.get(item.cantico_id) : null;
        const cantico = nomeCantico
          ? `\nCantico: ${nomeCantico}${item.tom ? ` (${item.tom})` : ''}`
          : '';
        const conteudoBase = item.conteudo_publico?.trim() || '';

        return {
          id: item.id,
          conteudo: `${tituloItem}${conteudoBase ? `\n${conteudoBase}` : ''}${cantico}`,
          ordem: item.ordem ?? index,
        };
      });

      return {
        id: `legacy-${culto['Culto nr.']}`,
        cultoId: culto['Culto nr.'],
        data: culto.Dia,
        imagemUrl: culto.imagem_url,
        itens: itensCulto,
      };
    });

    return NextResponse.json({ boletins });
  } catch (error: any) {
    console.error('Erro ao carregar boletins anteriores:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar boletins anteriores.' },
      { status: 500 }
    );
  }
}
