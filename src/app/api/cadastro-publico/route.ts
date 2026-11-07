import type { Database, TablesInsert } from '@/lib/database.types';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  dataOpcional,
  lerCorpo,
  listaDeTextos,
  numeroOpcional,
  textoObrigatorio,
  textoOpcional,
} from '@/lib/validacao';

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const IGREJA_INDISPONIVEL = 'A igreja informada não está disponível para cadastro público.';

const cadastroSchema = z.object({
  igreja_id: textoOpcional(36).refine((id) => !id || z.uuid().safeParse(id).success, IGREJA_INDISPONIVEL),
  igreja_slug: textoOpcional(80),
  nome: textoObrigatorio(160, 'Preencha seu nome completo.'),
  telefone: textoOpcional(40),
  email: textoOpcional(180).transform((email) => email?.toLowerCase() ?? null),
  sexo: z.enum(['M', 'F']).nullable().catch(null),
  // Só os status oferecidos no formulário público; cargo e "ativo" não vêm
  // do cliente, porque o vínculo dispara a sincronização de acesso por e-mail.
  status_membro: z.enum(['ativo', 'congregado', 'visitante']).catch('visitante'),
  data_nascimento: dataOpcional(),
  logradouro: textoOpcional(200),
  bairro: textoOpcional(120),
  cep: textoOpcional(20),
  cidade: textoOpcional(120),
  uf: textoOpcional(40),
  latitude: numeroOpcional(-90, 90),
  longitude: numeroOpcional(-180, 180),
  google_place_id: textoOpcional(300),
  endereco_completo: textoOpcional(400),
  nome_pai: textoOpcional(160),
  nome_mae: textoOpcional(160),
  estado_civil: textoOpcional(40),
  conjuge_nome: textoOpcional(160),
  conjuge_religiao: textoOpcional(120),
  data_casamento: dataOpcional(),
  naturalidade_cidade: textoOpcional(120),
  naturalidade_uf: textoOpcional(40),
  profissao: textoOpcional(120),
  escolaridade: textoOpcional(80),
  batizado: z.preprocess(Boolean, z.boolean()),
  data_batismo: dataOpcional(),
  data_profissao_fe: dataOpcional(),
  transferido_ipb: z.preprocess(Boolean, z.boolean()),
  transferido_outra_denominacao: textoOpcional(160),
  cursos_discipulado: listaDeTextos(30, 120),
  grupo_familiar_nome: textoOpcional(160),
  grupo_familiar_lider: textoOpcional(160),
  situacao_saude: textoOpcional(1000),
  observacoes: textoOpcional(2000),
});

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
    const corpo = await lerCorpo(request, cadastroSchema);
    if (corpo.error) return corpo.error;
    const { igreja_id, igreja_slug, cidade, uf, ...dados } = corpo.data;
    const igreja = await resolveSelectedChurch(igreja_id, igreja_slug);

    const now = new Date().toISOString();
    const payloadPessoa: TablesInsert<'pessoas'> = {
      ...dados,
      cidade: cidade || igreja.cidade || null,
      uf: uf || igreja.uf || null,
      ativo: true,
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
        status_membro: dados.status_membro,
        cargo: 'membro',
        ativo: true,
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
