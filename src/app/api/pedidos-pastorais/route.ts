import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';

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

const CATEGORIAS_VALIDAS = new Set(['oracao', 'aconselhamento', 'visita', 'outro']);

type UsuarioAcessoPedido = {
  id: string;
  pessoa_id: string | null;
  igreja_id: string | null;
};

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null;
}

function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

async function findUsuarioAcessoParaIgreja(authUserId: string, igrejaId: string) {
  const { data: acessos, error: acessosError } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, pessoa_id, igreja_id')
    .eq('auth_user_id', authUserId);

  if (acessosError) throw acessosError;

  const acessosUsuario = (acessos || []) as UsuarioAcessoPedido[];

  if (acessosUsuario.length === 0) {
    return null;
  }

  const acessoDireto = acessosUsuario.find((acesso) => acesso.igreja_id === igrejaId);

  if (acessoDireto) {
    return acessoDireto;
  }

  const acessoIds = acessosUsuario.map((acesso) => acesso.id);
  const { data: vinculo, error: vinculoError } = await supabaseAdmin
    .from('usuarios_igrejas')
    .select('usuario_id')
    .in('usuario_id', acessoIds)
    .eq('igreja_id', igrejaId)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();

  if (vinculoError) throw vinculoError;

  return acessosUsuario.find((acesso) => acesso.id === vinculo?.usuario_id) || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const igrejaId = sanitizeString(body.igreja_id);
    const nomeSolicitante = sanitizeString(body.nome_solicitante);
    const emailSolicitante = sanitizeString(body.email_solicitante)?.toLowerCase() || null;
    const telefoneSolicitante = sanitizeString(body.telefone_solicitante);
    const categoria = sanitizeString(body.categoria) || 'oracao';
    const assunto = sanitizeString(body.assunto);
    const mensagem = sanitizeString(body.mensagem);
    const desejaRetorno = sanitizeBoolean(body.deseja_retorno, true);

    if (!igrejaId || !nomeSolicitante || !mensagem) {
      return NextResponse.json(
        { error: 'Igreja, nome e mensagem são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!CATEGORIAS_VALIDAS.has(categoria)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 });
    }

    const { data: igreja, error: igrejaError } = await supabaseAdmin
      .from('igrejas')
      .select('id, nome, ativo')
      .eq('id', igrejaId)
      .eq('ativo', true)
      .maybeSingle();

    if (igrejaError) throw igrejaError;

    if (!igreja) {
      return NextResponse.json({ error: 'Igreja inválida ou inativa.' }, { status: 400 });
    }

    const user = await getAuthenticatedUserFromServerCookies(request);

    let usuarioAcessoId: string | null = null;
    let pessoaId: string | null = null;

    if (user?.id) {
      const acesso = await findUsuarioAcessoParaIgreja(user.id, igrejaId);

      usuarioAcessoId = acesso?.id || null;
      pessoaId = acesso?.pessoa_id || null;
    }

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos_pastorais')
      .insert({
        igreja_id: igrejaId,
        usuario_acesso_id: usuarioAcessoId,
        pessoa_id: pessoaId,
        nome_solicitante: nomeSolicitante,
        email_solicitante: emailSolicitante,
        telefone_solicitante: telefoneSolicitante,
        categoria,
        assunto,
        mensagem,
        deseja_retorno: desejaRetorno,
        status: 'novo',
      })
      .select('id, criado_em, status')
      .single();

    if (pedidoError) throw pedidoError;

    return NextResponse.json({
      success: true,
      pedido,
      igreja: {
        id: igreja.id,
        nome: igreja.nome,
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar pedido pastoral público:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar pedido pastoral.' },
      { status: 500 }
    );
  }
}
