import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

type IgrejaPublica = {
  id: string;
  nome: string;
  nome_abreviado?: string | null;
  slug?: string | null;
  cidade?: string | null;
  uf?: string | null;
  apresentacao_titulo?: string | null;
  apresentacao_texto?: string | null;
  apresentacao_titulo_i18n?: Record<string, string> | null;
  apresentacao_texto_i18n?: Record<string, string> | null;
  ativo?: boolean | null;
  visivel_publico?: boolean | null;
};

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown) {
  const trimmed = trimString(value);
  return trimmed || null;
}

function nullableLowerEmail(value: unknown) {
  const trimmed = trimString(value).toLowerCase();
  return trimmed || null;
}

async function findChurchById(igrejaId: string) {
  const { data, error } = await supabaseAdmin
    .from('igrejas')
    .select('id, nome, nome_abreviado, slug, cidade, uf, apresentacao_titulo, apresentacao_texto, apresentacao_titulo_i18n, apresentacao_texto_i18n, ativo, visivel_publico')
    .eq('id', igrejaId)
    .eq('ativo', true)
    .maybeSingle<IgrejaPublica>();

  if (error) throw error;
  if (!data) return null;
  if (data.visivel_publico === false) return null;
  return data;
}

async function findChurchBySlug(igrejaSlug: string) {
  const normalizedSlug = trimString(igrejaSlug).toLowerCase();

  if (!normalizedSlug) return null;

  const { data, error } = await supabaseAdmin
    .from('igrejas')
    .select('id, nome, nome_abreviado, slug, cidade, uf, apresentacao_titulo, apresentacao_texto, apresentacao_titulo_i18n, apresentacao_texto_i18n, ativo, visivel_publico')
    .eq('slug', normalizedSlug)
    .eq('ativo', true)
    .maybeSingle<IgrejaPublica>();

  if (error) throw error;
  if (!data) return null;
  if (data.visivel_publico === false) return null;
  return data;
}

async function resolveDefaultPublicChurch() {
  const bySlug = await supabaseAdmin
    .from('igrejas')
    .select('id, nome, nome_abreviado, slug, cidade, uf, apresentacao_titulo, apresentacao_texto, apresentacao_titulo_i18n, apresentacao_texto_i18n, ativo, visivel_publico')
    .eq('slug', 'ippn')
    .eq('ativo', true)
    .maybeSingle<IgrejaPublica>();

  if (bySlug.error) throw bySlug.error;
  if (bySlug.data && bySlug.data.visivel_publico !== false) return bySlug.data;

  const byName = await supabaseAdmin
    .from('igrejas')
    .select('id, nome, nome_abreviado, slug, cidade, uf, apresentacao_titulo, apresentacao_texto, apresentacao_titulo_i18n, apresentacao_texto_i18n, ativo, visivel_publico')
    .ilike('nome', '%ponta negra%')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle<IgrejaPublica>();

  if (byName.error) throw byName.error;
  if (byName.data && byName.data.visivel_publico !== false) return byName.data;

  const fallback = await supabaseAdmin
    .from('igrejas')
    .select('id, nome, nome_abreviado, slug, cidade, uf, apresentacao_titulo, apresentacao_texto, apresentacao_titulo_i18n, apresentacao_texto_i18n, ativo, visivel_publico')
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .limit(1)
    .maybeSingle<IgrejaPublica>();

  if (fallback.error) throw fallback.error;
  if (fallback.data && fallback.data.visivel_publico !== false) return fallback.data;

  return null;
}

async function resolveSelectedChurch(
  igrejaId?: string | null,
  igrejaSlug?: string | null
) {
  const normalizedId = trimString(igrejaId);
  const normalizedSlug = trimString(igrejaSlug).toLowerCase();

  if (normalizedId) {
    const church = await findChurchById(normalizedId);
    if (!church) {
      throw new Error('A igreja informada não está disponível para cadastro público.');
    }
    return church;
  }

  if (normalizedSlug) {
    const church = await findChurchBySlug(normalizedSlug);
    if (!church) {
      throw new Error('A igreja informada não está disponível para cadastro público.');
    }
    return church;
  }

  const fallback = await resolveDefaultPublicChurch();

  if (!fallback) {
    throw new Error('Nenhuma igreja pública está disponível para cadastro no momento.');
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const igreja = await resolveSelectedChurch(
      request.nextUrl.searchParams.get('igreja_id'),
      request.nextUrl.searchParams.get('igreja_slug')
    );

    return NextResponse.json({
      igreja,
    });
  } catch (error: any) {
    console.error('Erro ao resolver contexto do cadastro público:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao carregar dados do cadastro.' },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const igreja = await resolveSelectedChurch(body.igreja_id, body.igreja_slug);

    const nome = trimString(body.nome);
    const telefone = trimString(body.telefone);
    const email = nullableLowerEmail(body.email);
    const statusMembro = trimString(body.status_membro) || 'visitante';

    if (!nome) {
      return NextResponse.json(
        { error: 'Preencha seu nome completo.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const payloadPessoa: Record<string, unknown> = {
      nome,
      telefone: telefone || null,
      sexo: nullableString(body.sexo),
      status_membro: statusMembro,
      data_nascimento: nullableString(body.data_nascimento),
      email,
      logradouro: nullableString(body.logradouro),
      bairro: nullableString(body.bairro),
      cep: nullableString(body.cep),
      cidade: nullableString(body.cidade) || igreja.cidade || null,
      uf: nullableString(body.uf) || igreja.uf || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      google_place_id: nullableString(body.google_place_id),
      endereco_completo: nullableString(body.endereco_completo),
      nome_pai: nullableString(body.nome_pai),
      nome_mae: nullableString(body.nome_mae),
      estado_civil: nullableString(body.estado_civil),
      conjuge_nome: nullableString(body.conjuge_nome),
      conjuge_religiao: nullableString(body.conjuge_religiao),
      data_casamento: nullableString(body.data_casamento),
      naturalidade_cidade: nullableString(body.naturalidade_cidade),
      naturalidade_uf: nullableString(body.naturalidade_uf),
      profissao: nullableString(body.profissao),
      escolaridade: nullableString(body.escolaridade),
      batizado: Boolean(body.batizado),
      data_batismo: nullableString(body.data_batismo),
      data_profissao_fe: nullableString(body.data_profissao_fe),
      transferido_ipb: Boolean(body.transferido_ipb),
      transferido_outra_denominacao: nullableString(body.transferido_outra_denominacao),
      cursos_discipulado: Array.isArray(body.cursos_discipulado)
        ? body.cursos_discipulado
        : null,
      grupo_familiar_nome: nullableString(body.grupo_familiar_nome),
      grupo_familiar_lider: nullableString(body.grupo_familiar_lider),
      situacao_saude: nullableString(body.situacao_saude),
      observacoes: nullableString(body.observacoes),
      ativo: body.ativo !== false,
      cargo: 'membro',
      atualizado_em: now,
    };

    // Cadastro público sempre cria uma pessoa nova: e-mail, telefone e
    // endereço podem ser compartilhados por mais de uma pessoa (família), e
    // nenhum deles identifica com segurança "é a mesma pessoa preenchendo de
    // novo". Update só acontece pelo link individual /completar/{token}
    // (endpoint /api/completar-cadastro), que resolve a pessoa pelo token.
    const { data: pessoaCriada, error: pessoaInsertError } = await supabaseAdmin
      .from('pessoas')
      .insert({
        ...payloadPessoa,
        criado_em: now,
      })
      .select('id')
      .single();

    if (pessoaInsertError) throw pessoaInsertError;
    const pessoaId: string = pessoaCriada.id;

    const { error: vinculoError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .insert({
        pessoa_id: pessoaId,
        igreja_id: igreja.id,
        status_membro: statusMembro,
        cargo: 'membro',
        ativo: body.ativo !== false,
        atualizado_em: now,
      });

    if (vinculoError) throw vinculoError;

    return NextResponse.json({
      success: true,
      pessoa_id: pessoaId,
      igreja,
    });
  } catch (error: any) {
    console.error('Erro ao salvar cadastro público:', error);

    return NextResponse.json(
      { error: error.message || 'Ocorreu um erro ao enviar o cadastro.' },
      { status: 500 }
    );
  }
}
