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

interface CanticoPublico {
  id: string;
  tipo: 'hinario' | 'cantico';
  numero: string | null;
  nome: string;
  letra: string | null;
  referencia: string | null;
  tags: string[] | null;
  autor_letra: string | null;
  compositor: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  audio_url: string | null;
}

const CANTICO_UNIFICADO_SELECT =
  'id, tipo, numero, nome, letra, referencia, tags, autor_letra, compositor, youtube_url, spotify_url, audio_url';
const CANTICO_BASE_SELECT =
  'id, nome, letra, referencia, tags, youtube_url, spotify_url';
const HINARIO_NOVO_CANTICO_SELECT =
  'id, numero, titulo, letra, referencia_biblica, autor_letra, compositor, link_audio';

function normalizarCanticoBase(
  item: Omit<CanticoPublico, 'tipo' | 'numero' | 'autor_letra' | 'compositor' | 'audio_url'> & {
    tipo?: 'hinario' | 'cantico' | null;
    numero?: string | null;
    autor_letra?: string | null;
    compositor?: string | null;
    audio_url?: string | null;
  }
): CanticoPublico {
  return {
    id: item.id,
    tipo: item.tipo || 'cantico',
    numero: item.numero || null,
    nome: item.nome,
    letra: item.letra,
    referencia: item.referencia,
    tags: item.tags,
    autor_letra: item.autor_letra || null,
    compositor: item.compositor || null,
    youtube_url: item.youtube_url,
    spotify_url: item.spotify_url,
    audio_url: item.audio_url || null,
  };
}

function normalizarHinarioNovoCantico(
  item: {
    id: string | number;
    numero: string | null;
    titulo: string;
    letra: string | null;
    referencia_biblica: string | null;
    autor_letra: string | null;
    compositor: string | null;
    link_audio: string | null;
  }
): CanticoPublico {
  return {
    id: String(item.id),
    tipo: 'hinario',
    numero: item.numero || null,
    nome: item.titulo,
    letra: item.letra,
    referencia: item.referencia_biblica,
    tags: null,
    autor_letra: item.autor_letra,
    compositor: item.compositor,
    youtube_url: null,
    spotify_url: null,
    audio_url: item.link_audio,
  };
}

async function buscarCanticosPorNome(nome: string, igrejaId?: string | null) {
  const termo = nome.trim();
  const pattern = `%${termo}%`;

  const [hinarioNovoCanticoResult, canticosUnificadosResult, canticosBaseResult] = await Promise.all([
    supabaseAdmin
      .from('hinario_novo_cantico')
      .select(HINARIO_NOVO_CANTICO_SELECT)
      .ilike('titulo', pattern)
      .limit(10),
    igrejaId
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin
          .from('canticos_unificados')
          .select(CANTICO_UNIFICADO_SELECT)
          .ilike('nome', pattern)
          .limit(10),
    (() => {
      let query = supabaseAdmin
        .from('canticos')
        .select(CANTICO_BASE_SELECT)
        .ilike('nome', pattern)
        .limit(10);

      if (igrejaId) {
        query = query.eq('igreja_id', igrejaId);
      }

      return query;
    })(),
  ]);

  if (hinarioNovoCanticoResult.error) throw hinarioNovoCanticoResult.error;
  if (canticosUnificadosResult.error) throw canticosUnificadosResult.error;
  if (canticosBaseResult.error) throw canticosBaseResult.error;

  const hinario = (
    (hinarioNovoCanticoResult.data || []) as Array<{
      id: string | number;
      numero: string | null;
      titulo: string;
      letra: string | null;
      referencia_biblica: string | null;
      autor_letra: string | null;
      compositor: string | null;
      link_audio: string | null;
    }>
  ).map(normalizarHinarioNovoCantico);
  const unificados = ((canticosUnificadosResult.data || []) as CanticoPublico[]).map(normalizarCanticoBase);
  const base = (
    (canticosBaseResult.data || []) as Array<
      Omit<CanticoPublico, 'tipo' | 'numero'> & { tipo?: null; numero?: null }
    >
  ).map(normalizarCanticoBase);

  return [...hinario, ...unificados, ...base];
}

async function buscarHinarioPorNumero(numero: string | null) {
  if (!numero) return [];

  const numeroLimpo = numero.trim();
  if (!numeroLimpo) return [];

  const candidatos = Array.from(
    new Set([
      numeroLimpo,
      numeroLimpo.padStart(3, '0'),
      numeroLimpo.replace(/^0+/, '') || '0',
    ])
  );

  const { data, error } = await supabaseAdmin
    .from('hinario_novo_cantico')
    .select(HINARIO_NOVO_CANTICO_SELECT)
    .in('numero', candidatos)
    .limit(10);

  if (error) throw error;

  return (
    (data || []) as Array<{
      id: string | number;
      numero: string | null;
      titulo: string;
      letra: string | null;
      referencia_biblica: string | null;
      autor_letra: string | null;
      compositor: string | null;
      link_audio: string | null;
    }>
  ).map(normalizarHinarioNovoCantico);
}

function deduplicarCanticos(lista: CanticoPublico[]) {
  const vistos = new Set<string>();

  return lista.filter((item) => {
    const chave = `${item.tipo}:${item.id}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export async function GET(request: NextRequest) {
  try {
    const nome = request.nextUrl.searchParams.get('nome')?.trim();
    const numero = request.nextUrl.searchParams.get('numero')?.trim() || null;
    const igrejaId = request.nextUrl.searchParams.get('igreja_id')?.trim() || null;

    if (!nome && !numero) {
      return NextResponse.json({ error: 'nome ou numero e obrigatorio.' }, { status: 400 });
    }

    const [listaPorNumero, listaPorNome] = await Promise.all([
      buscarHinarioPorNumero(numero),
      nome ? buscarCanticosPorNome(nome, igrejaId) : Promise.resolve([]),
    ]);
    const lista = deduplicarCanticos([...listaPorNumero, ...listaPorNome]);
    const cantico =
      lista.find((item) => item.letra && item.letra.trim().length > 0) ||
      lista[0] ||
      null;

    return NextResponse.json({ cantico });
  } catch (error: any) {
    console.error('Erro ao carregar cântico público:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar cântico.' },
      { status: 500 }
    );
  }
}
