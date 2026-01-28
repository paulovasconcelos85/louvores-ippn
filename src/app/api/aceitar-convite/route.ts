import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { token, user_id } = await request.json();

    if (!token || !user_id) {
      return NextResponse.json(
        { error: 'Token e user_id são obrigatórios' },
        { status: 400 }
      );
    }

    // 1. Buscar convite
    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('convites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pendente')
      .single();

    if (conviteError || !convite) {
      return NextResponse.json(
        { error: 'Convite inválido ou já utilizado' },
        { status: 404 }
      );
    }

    // 2. Verificar expiração
    if (new Date(convite.expira_em) < new Date()) {
      await supabaseAdmin
        .from('convites')
        .update({ status: 'expirado' })
        .eq('id', convite.id);

      return NextResponse.json(
        { error: 'Convite expirado' },
        { status: 410 }
      );
    }

    // 3. Verificar se user_id existe no Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado no sistema de autenticação' },
        { status: 404 }
      );
    }

    // 4. CENÁRIO A: Pessoa já existe (fantasma virando usuário)
    if (convite.pessoa_id) {
      const { data: pessoa } = await supabaseAdmin
        .from('pessoas')
        .select('*')
        .eq('id', convite.pessoa_id)
        .single();

      if (!pessoa) {
        return NextResponse.json(
          { error: 'Pessoa vinculada ao convite não encontrada' },
          { status: 404 }
        );
      }

      // Atualizar pessoa para ter acesso
      const { error: updateError } = await supabaseAdmin
        .from('pessoas')
        .update({
          usuario_id: user_id, // Vincular ao Auth
          email: user.email || convite.email,
          tem_acesso: true,
          ativo: true,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', convite.pessoa_id);

      if (updateError) throw updateError;

      // Criar/atualizar registro em usuarios_acesso
      const { error: acessoError } = await supabaseAdmin
        .from('usuarios_acesso')
        .upsert({
          id: user_id,
          pessoa_id: convite.pessoa_id,
          email: user.email || convite.email,
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          telefone: pessoa.telefone,
          ativo: true,
          atualizado_em: new Date().toISOString()
        });

      if (acessoError) throw acessoError;

      // Marcar convite como aceito
      await supabaseAdmin
        .from('convites')
        .update({
          status: 'aceito',
          aceito_em: new Date().toISOString()
        })
        .eq('id', convite.id);

      return NextResponse.json({
        success: true,
        message: `${pessoa.nome} agora tem acesso ao sistema!`,
        pessoa_id: convite.pessoa_id,
        redirect: '/admin'
      });
    }

    // 5. CENÁRIO B: Nova pessoa (criar do zero)
    const novaPessoaId = user_id; // Usar o mesmo ID do Auth!

    // Verificar se já existe pessoa com este email
    const { data: pessoaExistente } = await supabaseAdmin
      .from('pessoas')
      .select('id, tem_acesso, email')
      .eq('email', user.email || convite.email)
      .single();

    if (pessoaExistente) {
      // Pessoa já existe - apenas atualizar para dar acesso
      const { error: updateError } = await supabaseAdmin
        .from('pessoas')
        .update({
          usuario_id: user_id,
          tem_acesso: true,
          ativo: true,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', pessoaExistente.id);

      if (updateError) throw updateError;

      // Criar/atualizar registro em usuarios_acesso
      const { error: acessoError } = await supabaseAdmin
        .from('usuarios_acesso')
        .upsert({
          id: user_id,
          pessoa_id: pessoaExistente.id,
          email: user.email || convite.email,
          nome: convite.nome,
          cargo: convite.cargo,
          telefone: convite.telefone,
          ativo: true
        });

      if (acessoError) throw acessoError;

      // Marcar convite como aceito
      await supabaseAdmin
        .from('convites')
        .update({
          status: 'aceito',
          aceito_em: new Date().toISOString()
        })
        .eq('id', convite.id);

      return NextResponse.json({
        success: true,
        message: `${convite.nome} agora tem acesso ao sistema!`,
        pessoa_id: pessoaExistente.id,
        redirect: '/admin'
      });
    }

    // Se não existe, criar nova pessoa
    const { error: pessoaError } = await supabaseAdmin
      .from('pessoas')
      .insert({
        id: novaPessoaId,
        nome: convite.nome,
        cargo: convite.cargo,
        email: user.email || convite.email,
        telefone: convite.telefone,
        usuario_id: user_id,
        tem_acesso: true,
        ativo: true
      });

    if (pessoaError) throw pessoaError;

    // Criar registro em usuarios_acesso
    const { error: acessoError } = await supabaseAdmin
      .from('usuarios_acesso')
      .insert({
        id: user_id,
        pessoa_id: novaPessoaId,
        email: user.email || convite.email,
        nome: convite.nome,
        cargo: convite.cargo,
        telefone: convite.telefone,
        ativo: true
      });

    if (acessoError) throw acessoError;

    // Marcar convite como aceito
    await supabaseAdmin
      .from('convites')
      .update({
        status: 'aceito',
        aceito_em: new Date().toISOString()
      })
      .eq('id', convite.id);

    return NextResponse.json({
      success: true,
      message: `Bem-vindo ${convite.nome}!`,
      pessoa_id: novaPessoaId,
      redirect: '/admin'
    });

  } catch (error: any) {
    console.error('Erro ao aceitar convite:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao aceitar convite' },
      { status: 500 }
    );
  }
}