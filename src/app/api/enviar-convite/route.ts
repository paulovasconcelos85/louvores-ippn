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
    const { pessoa_id, email, nome, cargo, telefone } = await request.json();

    // ============================================
    // CENÁRIO 1: Convidar pessoa existente (fantasma)
    // ============================================
    if (pessoa_id) {
      // Buscar pessoa
      const { data: pessoa, error: pessoaError } = await supabaseAdmin
        .from('pessoas')
        .select('*')
        .eq('id', pessoa_id)
        .single();

      if (pessoaError || !pessoa) {
        return NextResponse.json(
          { error: 'Pessoa não encontrada' },
          { status: 404 }
        );
      }

      // Verificar se já tem acesso
      if (pessoa.tem_acesso) {
        return NextResponse.json(
          { error: 'Esta pessoa já tem acesso ao sistema' },
          { status: 400 }
        );
      }

      // Precisa ter email para enviar convite
      if (!email) {
        return NextResponse.json(
          { error: 'Email é obrigatório para enviar convite' },
          { status: 400 }
        );
      }

      // Atualizar pessoa com email (se não tinha)
      if (!pessoa.email) {
        await supabaseAdmin
          .from('pessoas')
          .update({ email: email.toLowerCase().trim() })
          .eq('id', pessoa_id);
      }

      // Verificar se já existe convite pendente
      const { data: conviteExistente } = await supabaseAdmin
        .from('convites')
        .select('*')
        .eq('pessoa_id', pessoa_id)
        .eq('status', 'pendente')
        .single();

      if (conviteExistente && new Date(conviteExistente.expira_em) > new Date()) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        return NextResponse.json({
          success: true,
          message: 'Já existe um convite pendente para esta pessoa',
          data: {
            token: conviteExistente.token,
            link: `${appUrl}/aceitar-convite/${conviteExistente.token}`,
            expira_em: conviteExistente.expira_em
          }
        });
      }

      // Criar convite
      const { data: convite, error: conviteError } = await supabaseAdmin
        .from('convites')
        .insert({
          pessoa_id,
          email: email.toLowerCase().trim(),
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          telefone: pessoa.telefone,
          status: 'pendente',
          tentativas_envio: 1,
          ultimo_envio: new Date().toISOString()
        })
        .select()
        .single();

      if (conviteError) throw conviteError;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const linkConvite = `${appUrl}/aceitar-convite/${convite.token}`;

      // Enviar convite via Supabase Auth (envia email automaticamente!)
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        convite.email,
        {
          data: {
            nome: pessoa.nome,
            cargo: pessoa.cargo,
            convite_token: convite.token
          },
          redirectTo: linkConvite
        }
      );

      if (inviteError) {
        console.error('⚠️ Erro ao enviar email pelo Supabase:', inviteError);
        // Não falhar - ainda retornar o link manual
      }

      console.log('📧 Link de convite gerado:', linkConvite);

      return NextResponse.json({
        success: true,
        message: `Convite enviado para ${pessoa.nome}`,
        data: {
          token: convite.token,
          link: linkConvite,
          expira_em: convite.expira_em
        }
      });
    }

    // ============================================
    // CENÁRIO 2: Convidar nova pessoa (não existe ainda)
    // ============================================
    if (!email || !nome || !cargo) {
      return NextResponse.json(
        { error: 'Email, nome e cargo são obrigatórios para novo convite' },
        { status: 400 }
      );
    }

    // Verificar se já existe pessoa com este email
    const { data: pessoaExistente } = await supabaseAdmin
      .from('pessoas')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (pessoaExistente) {
      if (pessoaExistente.tem_acesso) {
        return NextResponse.json(
          { error: 'Já existe uma pessoa com este email e ela já tem acesso ao sistema' },
          { status: 400 }
        );
      }

      // Pessoa existe mas não tem acesso - usar ela
      return NextResponse.json(
        { 
          error: 'Já existe uma pessoa com este email. Use o parâmetro pessoa_id para convidá-la.',
          pessoa_id: pessoaExistente.id
        },
        { status: 400 }
      );
    }

    // Verificar se já existe convite pendente com este email
    const { data: conviteExistente } = await supabaseAdmin
      .from('convites')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pendente')
      .single();

    if (conviteExistente && new Date(conviteExistente.expira_em) > new Date()) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.json({
        success: true,
        message: 'Já existe um convite pendente para este email',
        data: {
          token: conviteExistente.token,
          link: `${appUrl}/aceitar-convite/${conviteExistente.token}`,
          expira_em: conviteExistente.expira_em
        }
      });
    }

    // Criar convite SEM pessoa_id (pessoa será criada quando aceitar)
    const { data: convite, error: conviteError } = await supabaseAdmin
      .from('convites')
      .insert({
        pessoa_id: null, // Será criada ao aceitar
        email: email.toLowerCase().trim(),
        nome: nome.trim(),
        cargo,
        telefone: telefone || null,
        status: 'pendente',
        tentativas_envio: 1,
        ultimo_envio: new Date().toISOString()
      })
      .select()
      .single();

    if (conviteError) throw conviteError;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const linkConvite = `${appUrl}/aceitar-convite/${convite.token}`;

    // Enviar convite via Supabase Auth
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      convite.email,
      {
        data: {
          nome: nome,
          cargo: cargo,
          convite_token: convite.token
        },
        redirectTo: linkConvite
      }
    );

    if (inviteError) {
      console.error('⚠️ Erro ao enviar email pelo Supabase:', inviteError);
    }

    console.log('📧 Link de convite gerado:', linkConvite);

    return NextResponse.json({
      success: true,
      message: `Convite criado para ${nome}`,
      data: {
        token: convite.token,
        link: linkConvite,
        expira_em: convite.expira_em
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erro ao enviar convite:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar convite' },
      { status: 500 }
    );
  }
}