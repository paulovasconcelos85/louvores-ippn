import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';
import { getSupabaseAdmin, MODELO_LITURGICO_INICIAL, slugsOcupados } from '@/lib/igreja-onboarding';
import { normalizarSlug, sugerirSlugs, validarSlug } from '@/lib/slug-igreja';

// POST /api/igrejas/criar
// Autoatendimento da landing: cria a igreja e deixa quem cadastrou como
// responsável (pastor ou admin) dela. Quem ainda não tem conta ganha uma
// conta de e-mail e senha na mesma operação.

const PAISES = new Set(['BR', 'PT', 'US', 'CA', 'AO', 'MZ', 'ES', 'AR', 'MX', 'OUTRO']);
const DIAS_SEMANA = new Set(['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']);

// Limite simples por IP para conter robôs; em serverless vale por instância.
const tentativasPorIp = new Map<string, number[]>();
const JANELA_MS = 60 * 60 * 1000;
const MAX_TENTATIVAS = 5;

function excedeuLimite(ip: string) {
  const agora = Date.now();
  const recentes = (tentativasPorIp.get(ip) || []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  tentativasPorIp.set(ip, recentes);
  return recentes.length > MAX_TENTATIVAS;
}

function texto(value: unknown, max = 160) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 400, 'Dados inválidos.');
  }

  // Campo invisível no formulário: só robôs preenchem.
  if (texto(body.website)) {
    return apiSuccess({ ok: true });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (excedeuLimite(ip)) {
    return apiError('TOO_MANY_ATTEMPTS', 429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }

  const nome = texto(body.nome, 160);
  const sigla = texto(body.sigla, 30);
  const cidade = texto(body.cidade, 80);
  const regiao = texto(body.regiao, 60);
  const paisInformado = texto(body.pais, 10)?.toUpperCase() || 'BR';
  const pais = PAISES.has(paisInformado) ? paisInformado : 'BR';
  const slug = normalizarSlug(texto(body.slug, 80) || '');
  const cargo = body.cargo === 'pastor' ? 'pastor' : 'admin';
  const cultoDia = texto(body.culto_dia, 12);
  const cultoHorario = texto(body.culto_horario, 5);

  if (!nome || nome.length < 4) {
    return apiError('CHURCH_NAME_REQUIRED', 400, 'Informe o nome da igreja.');
  }

  const motivoSlug = validarSlug(slug);
  if (motivoSlug) {
    return apiError('SLUG_INVALID', 400, 'Escolha um endereço válido: de 3 a 40 letras, números ou hífens.', { motivo: motivoSlug });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const usuarioLogado = await getAuthenticatedUserFromServerCookies(request);

  const responsavelNome = texto(body.responsavel_nome, 120);
  const email = (usuarioLogado?.email || texto(body.email, 180) || '').toLowerCase();
  const senha = typeof body.senha === 'string' ? body.senha : '';

  if (!usuarioLogado) {
    if (!responsavelNome) return apiError('OWNER_NAME_REQUIRED', 400, 'Informe seu nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError('EMAIL_INVALID', 400, 'Informe um e-mail válido.');
    if (senha.length < 8) return apiError('PASSWORD_TOO_SHORT', 400, 'A senha precisa ter pelo menos 8 caracteres.');

    const { data: contaExistente, error: contaError } = await supabaseAdmin
      .from('usuarios_acesso')
      .select('id')
      .eq('email', email)
      .not('auth_user_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (contaError) {
      console.error('Erro ao verificar conta existente:', contaError);
      return apiError('CREATE_CHURCH_FAILED', 500, 'Não foi possível criar a igreja agora.');
    }

    if (contaExistente) {
      return apiError('EMAIL_ALREADY_REGISTERED', 409, 'Este e-mail já tem conta no OIKOS Hub. Entre com ele e volte para criar a igreja.');
    }
  }

  const ocupados = await slugsOcupados([slug]);
  if (ocupados.has(slug)) {
    const candidatos = sugerirSlugs({ nome, sigla, cidade });
    const emUso = await slugsOcupados(candidatos);
    const sugestoes = candidatos.filter((item) => !emUso.has(item)).slice(0, 3);
    return apiError('SLUG_TAKEN', 409, `O endereço "${slug}" já está em uso. Experimente: ${sugestoes.join(', ')}.`);
  }

  // Tudo o que foi criado, para desfazer se algum passo falhar.
  const criados: { igrejaId?: string; pessoaId?: string; pessoaNova?: boolean; authUserId?: string } = {};
  const agora = new Date().toISOString();

  try {
    const { data: igreja, error: igrejaError } = await supabaseAdmin
      .from('igrejas')
      .insert({
        nome,
        slug,
        nome_abreviado: sigla,
        cidade,
        regiao,
        uf: pais === 'BR' ? regiao : null,
        pais,
        email: usuarioLogado ? null : email,
        ativo: true,
        visivel_publico: true,
        permite_cadastro_canticos: true,
        modelo_liturgico_padrao: MODELO_LITURGICO_INICIAL,
      })
      .select('id, slug, nome')
      .single();

    if (igrejaError) {
      if (igrejaError.code === '23505') {
        return apiError('SLUG_TAKEN', 409, `O endereço "${slug}" acabou de ser usado por outra igreja. Escolha outro.`);
      }
      throw igrejaError;
    }

    criados.igrejaId = igreja.id;

    if (cultoDia && DIAS_SEMANA.has(cultoDia) && cultoHorario && /^\d{2}:\d{2}$/.test(cultoHorario)) {
      const { error: cultoError } = await supabaseAdmin.from('igreja_cultos').insert({
        id: crypto.randomUUID(),
        igreja_id: igreja.id,
        nome: cultoDia === 'domingo' ? 'Culto dominical' : 'Culto',
        dia_semana: cultoDia,
        horario: cultoHorario,
        ativo: true,
        ordem: 1,
      });
      if (cultoError) throw cultoError;
    }

    // Pessoa do responsável: reaproveita o cadastro de quem já tem conta.
    let pessoaId: string | null = null;

    if (usuarioLogado) {
      const { data: porUsuario } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .eq('usuario_id', usuarioLogado.id)
        .limit(1)
        .maybeSingle();
      pessoaId = porUsuario?.id || null;
    }

    if (!pessoaId) {
      const { data: porEmail, error: porEmailError } = await supabaseAdmin
        .from('pessoas')
        .select('id')
        .eq('email', email)
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (porEmailError) throw porEmailError;
      pessoaId = porEmail?.id || null;
    }

    if (!pessoaId) {
      const { data: pessoa, error: pessoaError } = await supabaseAdmin
        .from('pessoas')
        .insert({
          nome: responsavelNome || email.split('@')[0],
          email,
          cargo,
          ativo: true,
          tem_acesso: true,
          status_membro: 'ativo',
          igreja_id: igreja.id,
          usuario_id: usuarioLogado?.id || null,
          criado_em: agora,
          atualizado_em: agora,
        })
        .select('id')
        .single();
      if (pessoaError) throw pessoaError;
      pessoaId = pessoa.id;
      criados.pessoaNova = true;
    }

    criados.pessoaId = pessoaId!;

    // O trigger sincronizar_acesso_pessoas_igrejas_aiu cria usuarios_acesso e
    // usuarios_igrejas a partir deste vínculo.
    const { error: vinculoError } = await supabaseAdmin.from('pessoas_igrejas').insert({
      pessoa_id: pessoaId,
      igreja_id: igreja.id,
      status_membro: 'ativo',
      cargo,
      ativo: true,
      observacoes: 'Responsável que criou a igreja pela landing',
      criado_em: agora,
      atualizado_em: agora,
    });
    if (vinculoError) throw vinculoError;

    if (!usuarioLogado) {
      // Criada depois da pessoa: o gatilho de auth só aceita e-mails já cadastrados.
      const { data: novoUsuario, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: responsavelNome },
      });

      if (authError || !novoUsuario.user) {
        const jaExiste = /already|registered|exists/i.test(authError?.message || '');
        await desfazer(criados);
        return jaExiste
          ? apiError('EMAIL_ALREADY_REGISTERED', 409, 'Este e-mail já tem conta no OIKOS Hub. Entre com ele e volte para criar a igreja.')
          : apiError('CREATE_ACCOUNT_FAILED', 500, authError?.message || 'Não foi possível criar sua conta.');
      }

      criados.authUserId = novoUsuario.user.id;

      await supabaseAdmin
        .from('pessoas')
        .update({ usuario_id: novoUsuario.user.id, atualizado_em: agora })
        .eq('id', pessoaId);

      await supabaseAdmin
        .from('usuarios_acesso')
        .update({ auth_user_id: novoUsuario.user.id, atualizado_em: agora })
        .eq('pessoa_id', pessoaId);
    } else {
      await supabaseAdmin
        .from('usuarios_acesso')
        .update({ auth_user_id: usuarioLogado.id, atualizado_em: agora })
        .eq('pessoa_id', pessoaId)
        .is('auth_user_id', null);
    }

    return apiSuccess(
      { igreja, contaCriada: !usuarioLogado },
      { status: 201, message: 'Igreja criada com sucesso.', messageCode: 'CHURCH_CREATED' }
    );
  } catch (error: any) {
    console.error('Erro no autoatendimento de igreja:', error);
    await desfazer(criados);
    return apiError('CREATE_CHURCH_FAILED', 500, 'Não foi possível criar a igreja agora. Tente novamente em instantes.');
  }
}

async function desfazer(criados: { igrejaId?: string; pessoaId?: string; pessoaNova?: boolean; authUserId?: string }) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    if (criados.authUserId) await supabaseAdmin.auth.admin.deleteUser(criados.authUserId);
    if (criados.igrejaId) {
      await supabaseAdmin.from('usuarios_igrejas').delete().eq('igreja_id', criados.igrejaId);
      await supabaseAdmin.from('pessoas_igrejas').delete().eq('igreja_id', criados.igrejaId);
      await supabaseAdmin.from('igreja_cultos').delete().eq('igreja_id', criados.igrejaId);
    }
    if (criados.pessoaNova && criados.pessoaId) {
      await supabaseAdmin.from('usuarios_acesso').delete().eq('pessoa_id', criados.pessoaId);
      await supabaseAdmin.from('pessoas').delete().eq('id', criados.pessoaId);
    }
    if (criados.igrejaId) await supabaseAdmin.from('igrejas').delete().eq('id', criados.igrejaId);
  } catch (error) {
    console.error('Erro ao desfazer criação de igreja:', error);
  }
}
