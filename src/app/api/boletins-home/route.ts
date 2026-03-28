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

interface LegacyLouvorItemRow {
  id: string;
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
  palavra_pastoral: string | null;
  palavra_pastoral_autor: string | null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
async function buildLegacyBoletimFallback(igrejaId: string) {
  const { data: cultoRaw, error: cultoError } = await supabaseAdmin
    .from('Louvores IPPN')
    .select('"Culto nr.", Dia, imagem_url, palavra_pastoral, palavra_pastoral_autor, igreja_id')
    .eq('igreja_id', igrejaId)
    .order('Dia', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cultoError) throw cultoError;
  if (!cultoRaw) {
    return {
      boletimSecoes: [],
      legacyMessage: 'Esta igreja ainda nao publicou secoes do boletim.',
    };
  }

  const culto = cultoRaw as LegacyCultoRow;

  const { data: itensRaw, error: itensError } = await supabaseAdmin
    .from('louvor_itens')
    .select('id, ordem, tipo, tom, cantico_id, conteudo_publico')
    .eq('culto_id', culto['Culto nr.'])
    .order('ordem', { ascending: true });

  if (itensError) throw itensError;

  const itens = (itensRaw || []) as LegacyLouvorItemRow[];
  const canticoIds = itens
    .map((item) => item.cantico_id)
    .filter((value): value is string => Boolean(value && isUuid(value)));

  const { data: canticosRaw, error: canticosError } =
    canticoIds.length > 0
      ? await supabaseAdmin
          .from('canticos')
          .select('id, nome')
          .in('id', canticoIds)
      : { data: [], error: null };

  if (canticosError) throw canticosError;

  const canticosPorId = new Map(
    ((canticosRaw || []) as Array<{ id: string; nome: string | null }>).map((cantico) => [
      cantico.id,
      cantico.nome,
    ])
  );

  const secoes: Array<{
    id: string;
    igreja_id: string | null;
    culto_id: number | null;
    tipo: string;
    titulo: string;
    icone: string | null;
    ordem: number | null;
    visivel: boolean | null;
    criado_em: string | null;
    itens: BoletimItemRow[];
  }> = [];

  if (culto.palavra_pastoral) {
    secoes.push({
      id: `legacy-palavra-${culto['Culto nr.']}`,
      igreja_id: null,
      culto_id: culto['Culto nr.'],
      tipo: 'palavra_pastoral',
      titulo: 'Palavra Pastoral',
      icone: null,
      ordem: 0,
      visivel: true,
      criado_em: null,
      itens: [
        {
          id: `legacy-palavra-conteudo-${culto['Culto nr.']}`,
          secao_id: `legacy-palavra-${culto['Culto nr.']}`,
          conteudo: culto.palavra_pastoral_autor
            ? `${culto.palavra_pastoral}\n\n— ${culto.palavra_pastoral_autor}`
            : culto.palavra_pastoral,
          destaque: true,
          ordem: 0,
          criado_em: null,
        },
      ],
    });
  }

  if (culto.imagem_url) {
    secoes.push({
      id: `legacy-imagem-${culto['Culto nr.']}`,
      igreja_id: null,
      culto_id: culto['Culto nr.'],
      tipo: 'imagem_tema',
      titulo: 'Imagem do Boletim',
      icone: null,
      ordem: 1,
      visivel: true,
      criado_em: null,
      itens: [
        {
          id: `legacy-imagem-conteudo-${culto['Culto nr.']}`,
          secao_id: `legacy-imagem-${culto['Culto nr.']}`,
          conteudo: culto.imagem_url,
          destaque: false,
          ordem: 0,
          criado_em: null,
        },
      ],
    });
  }

  if (itens.length > 0) {
    secoes.push({
      id: `legacy-liturgia-${culto['Culto nr.']}`,
      igreja_id: null,
      culto_id: culto['Culto nr.'],
      tipo: 'liturgia',
      titulo: `Liturgia do culto de ${culto.Dia}`,
      icone: null,
      ordem: 2,
      visivel: true,
      criado_em: null,
      itens: itens.map((item, index) => {
        const tituloItem = item.tipo || `Item ${index + 1}`;
        const nomeCantico = item.cantico_id
          ? canticosPorId.get(item.cantico_id)
          : null;
        const cantico = nomeCantico
          ? `\nCantico: ${nomeCantico}${item.tom ? ` (${item.tom})` : ''}`
          : '';
        const conteudoBase = item.conteudo_publico?.trim() || '';

        return {
          id: item.id,
          secao_id: `legacy-liturgia-${culto['Culto nr.']}`,
          conteudo: `${tituloItem}${conteudoBase ? `\n${conteudoBase}` : ''}${cantico}`,
          destaque: false,
          ordem: item.ordem ?? index,
          criado_em: null,
        };
      }),
    });
  }

  return {
    boletimSecoes: secoes,
    legacyMessage:
      secoes.length > 0
        ? 'Boletim exibido a partir da liturgia legada enquanto esta igreja conclui a migracao para secoes do boletim.'
        : 'Esta igreja ainda nao publicou secoes do boletim.',
  };
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

    let boletimSecoes = secoes.map((secao) => ({
      ...secao,
      itens: (itensPorSecao.get(secao.id) || []).sort(
        (a, b) => (a.ordem || 0) - (b.ordem || 0)
      ),
    }));

    let message: string | null = null;

<<<<<<< HEAD
    if (boletimSecoes.length === 0 && isIgrejaLegacyIPPN(igrejaRaw)) {
=======
    if (boletimSecoes.length === 0) {
>>>>>>> 9672938 (Melhora final nos boletins, agora eles estão mais bonitos e organizados. Além disso, adicionei uma funcionalidade de busca para facilitar a navegação pelos boletins. Espero que gostem!)
      const fallback = await buildLegacyBoletimFallback(igrejaId);
      boletimSecoes = fallback.boletimSecoes;
      message = fallback.legacyMessage;
    }

    return NextResponse.json({
      igreja,
      igrejaDetalhes,
      agendaCultos: cultosRaw || [],
      redesSociais: redesRaw || [],
      boletimSecoes,
      totalSecoes: boletimSecoes.length,
      message,
    });
  } catch (error: any) {
    console.error('Erro ao carregar boletim da home:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar boletim.' },
      { status: 500 }
    );
  }
}
