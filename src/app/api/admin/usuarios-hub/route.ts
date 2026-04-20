import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getUserPermissionContext,
  resolveAuthorizedCurrentIgrejaId,
} from '@/lib/server-church';
import { apiError, apiSuccess } from '@/lib/api-response';

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

const userHubCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

type IgrejaBasica = {
  id: string;
  nome: string;
  sigla: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean | null;
};

type UsuarioAcessoRow = {
  id: string;
  nome: string | null;
  email: string;
  telefone: string | null;
  pessoa_id: string | null;
  auth_user_id: string | null;
  igreja_id: string | null;
  cargo: string | null;
  ativo: boolean | null;
};

type UsuarioIgrejaRow = {
  usuario_id: string;
  igreja_id: string;
  cargo: string | null;
  ativo: boolean | null;
};

type PessoaRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  usuario_id: string | null;
  igreja_id: string | null;
  cargo: string | null;
  status_membro: string | null;
  ativo: boolean | null;
};

type PessoaIgrejaRow = {
  igreja_id: string;
  cargo: string | null;
  status_membro: string | null;
  ativo: boolean | null;
};

type RequestChurchAccess = {
  igrejaId: string;
  cargo: string;
  ativo?: boolean;
};

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function buildDisplayName(
  nome: string | null | undefined,
  email: string | null | undefined
) {
  const normalizedName = nome?.trim();
  return normalizedName || email || 'Usuário sem nome';
}

function createRouteError(message: string, code: string, status = 500) {
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = code;
  error.status = status;
  return error;
}

async function getManageableChurchIds(
  request: NextRequest,
  preferredIgrejaId: string | null,
  allowAll: boolean
) {
  const permissionContext = await getUserPermissionContext(preferredIgrejaId, request);

  if (!permissionContext?.user) {
    return {
      permissionContext,
      churchIds: [] as string[],
    };
  }

  if (allowAll && permissionContext.isSuperAdmin) {
    const { data: igrejas, error } = await supabaseAdmin
      .from('igrejas')
      .select('id')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;

    return {
      permissionContext,
      churchIds: (igrejas || []).map((igreja) => igreja.id as string),
    };
  }

  const igrejaId = await resolveAuthorizedCurrentIgrejaId(preferredIgrejaId, request);

  return {
    permissionContext,
    churchIds: igrejaId ? [igrejaId] : [],
  };
}

async function findUniqueAccessByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id, nome, email, telefone, pessoa_id, auth_user_id, igreja_id, cargo, ativo')
    .eq('email', email)
    .limit(2);

  if (error) throw error;

  if ((data || []).length > 1) {
    throw createRouteError(
      'Há mais de um usuário de acesso com este e-mail. Resolva a duplicidade antes de continuar.',
      'HUB_DUPLICATE_ACCESS_EMAIL',
      409
    );
  }

  return ((data || [])[0] || null) as UsuarioAcessoRow | null;
}

async function findUniquePessoaByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('pessoas')
    .select('id, nome, email, telefone, usuario_id, igreja_id, cargo, status_membro, ativo')
    .eq('email', email)
    .limit(2);

  if (error) throw error;

  if ((data || []).length > 1) {
    throw createRouteError(
      'Há mais de uma pessoa com este e-mail. Resolva a duplicidade antes de continuar.',
      'HUB_DUPLICATE_PERSON_EMAIL',
      409
    );
  }

  return ((data || [])[0] || null) as PessoaRow | null;
}

function choosePrimaryAccess(requestedChurches: RequestChurchAccess[]) {
  return requestedChurches.find((church) => church.ativo !== false) || requestedChurches[0] || null;
}

export async function GET(request: NextRequest) {
  try {
    const preferredIgrejaId = request.nextUrl.searchParams.get('igreja_id');
    const scope = request.nextUrl.searchParams.get('scope') === 'all' ? 'all' : 'current';

    const { permissionContext, churchIds } = await getManageableChurchIds(
      request,
      preferredIgrejaId,
      scope === 'all'
    );

    if (!permissionContext?.user) {
      return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');
    }

    if (!permissionContext.canManageUsers) {
      return apiError(
        'FORBIDDEN',
        403,
        'Sem permissão para visualizar o hub de usuários.'
      );
    }

    if (churchIds.length === 0) {
      return apiSuccess({
        success: true,
        scope,
        igrejas: [],
        usuarios: [],
      });
    }

    const { data: igrejas, error: igrejasError } = await supabaseAdmin
      .from('igrejas')
      .select('id, nome, sigla, cidade, uf, ativo')
      .in('id', churchIds)
      .order('nome', { ascending: true });

    if (igrejasError) throw igrejasError;

    const { data: vinculosRaw, error: vinculosError } = await supabaseAdmin
      .from('usuarios_igrejas')
      .select('usuario_id, igreja_id, cargo, ativo')
      .in('igreja_id', churchIds);

    if (vinculosError) throw vinculosError;

    const vinculos = (vinculosRaw || []) as UsuarioIgrejaRow[];

    const { data: acessosFallbackRaw, error: acessosFallbackError } = await supabaseAdmin
      .from('usuarios_acesso')
      .select('id, nome, email, telefone, pessoa_id, auth_user_id, igreja_id, cargo, ativo')
      .in('igreja_id', churchIds);

    if (acessosFallbackError) throw acessosFallbackError;

    const accessIds = Array.from(
      new Set([
        ...(vinculos || []).map((vinculo) => vinculo.usuario_id),
        ...((acessosFallbackRaw || []) as UsuarioAcessoRow[]).map((acesso) => acesso.id),
      ].filter(Boolean))
    );

    let acessos: UsuarioAcessoRow[] = [];

    if (accessIds.length > 0) {
      const { data: acessosRaw, error: acessosError } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, nome, email, telefone, pessoa_id, auth_user_id, igreja_id, cargo, ativo')
        .in('id', accessIds)
        .order('email', { ascending: true });

      if (acessosError) throw acessosError;
      acessos = (acessosRaw || []) as UsuarioAcessoRow[];
    }

    const churchesById = new Map<string, IgrejaBasica>(
      ((igrejas || []) as IgrejaBasica[]).map((igreja) => [igreja.id, igreja])
    );
    const accessById = new Map<string, UsuarioAcessoRow>(acessos.map((acesso) => [acesso.id, acesso]));

    const aggregated = new Map<
      string,
      {
        id: string;
        nome: string | null;
        email: string;
        telefone: string | null;
        pessoa_id: string | null;
        auth_user_id: string | null;
        vinculos: Array<{
          igreja_id: string;
          igreja_nome: string;
          igreja_sigla: string | null;
          cargo: string;
          ativo: boolean;
        }>;
      }
    >();

    function ensureUser(acesso: UsuarioAcessoRow) {
      const existing = aggregated.get(acesso.id);
      if (existing) return existing;

      const created = {
        id: acesso.id,
        nome: acesso.nome,
        email: acesso.email,
        telefone: acesso.telefone,
        pessoa_id: acesso.pessoa_id,
        auth_user_id: acesso.auth_user_id,
        vinculos: [] as Array<{
          igreja_id: string;
          igreja_nome: string;
          igreja_sigla: string | null;
          cargo: string;
          ativo: boolean;
        }>,
      };

      aggregated.set(acesso.id, created);
      return created;
    }

    function upsertChurchLink(
      usuarioId: string,
      churchId: string,
      cargo: string | null,
      ativo: boolean | null
    ) {
      const acesso = accessById.get(usuarioId);
      if (!acesso) return;

      const church = churchesById.get(churchId);
      if (!church) return;

      const user = ensureUser(acesso);
      const existing = user.vinculos.find((vinculo) => vinculo.igreja_id === churchId);

      const payload = {
        igreja_id: churchId,
        igreja_nome: church.sigla || church.nome,
        igreja_sigla: church.sigla,
        cargo: cargo || acesso.cargo || 'membro',
        ativo: ativo ?? acesso.ativo ?? true,
      };

      if (existing) {
        Object.assign(existing, payload);
        return;
      }

      user.vinculos.push(payload);
    }

    for (const vinculo of vinculos) {
      upsertChurchLink(vinculo.usuario_id, vinculo.igreja_id, vinculo.cargo, vinculo.ativo);
    }

    for (const acesso of acessos) {
      if (acesso.igreja_id) {
        upsertChurchLink(acesso.id, acesso.igreja_id, acesso.cargo, acesso.ativo);
      } else {
        ensureUser(acesso);
      }
    }

    const usuarios = Array.from(aggregated.values())
      .map((usuario) => ({
        ...usuario,
        nome_exibicao: buildDisplayName(usuario.nome, usuario.email),
        ativo: usuario.vinculos.some((vinculo) => vinculo.ativo),
        vinculos: usuario.vinculos.sort((a, b) =>
          userHubCollator.compare(a.igreja_nome, b.igreja_nome)
        ),
      }))
      .sort((a, b) => userHubCollator.compare(a.nome_exibicao, b.nome_exibicao));

    return apiSuccess({
      scope,
      igrejas: igrejas || [],
      usuarios,
    });
  } catch (error: any) {
    console.error('Erro ao listar hub de usuários:', error);
    return apiError(
      error.code || 'LOAD_HUB_USERS_FAILED',
      error.status || 500,
      error.message || 'Erro ao listar hub de usuários.'
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestedChurches = Array.isArray(body.igrejas)
      ? (body.igrejas as RequestChurchAccess[])
      : [];

    const firstChurchId = requestedChurches[0]?.igrejaId || null;
    const permissionContext = await getUserPermissionContext(firstChurchId, request);

    if (!permissionContext?.user) {
      return apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.');
    }

    if (!permissionContext.canManageUsers) {
      return apiError(
        'FORBIDDEN',
        403,
        'Sem permissão para provisionar usuários.'
      );
    }

    const normalizedEmail = normalizeEmail(body.email);
    const normalizedName = typeof body.nome === 'string' ? body.nome.trim() : '';
    const normalizedPhone =
      typeof body.telefone === 'string'
        ? body.telefone.replace(/\D/g, '').trim() || null
        : null;

    if (!normalizedEmail) {
      return apiError('HUB_EMAIL_REQUIRED', 400, 'E-mail é obrigatório.');
    }

    if (requestedChurches.length === 0) {
      return apiError(
        'HUB_CHURCH_REQUIRED',
        400,
        'Selecione pelo menos uma igreja para conceder acesso.'
      );
    }

    const allowedChurchIds = permissionContext.isSuperAdmin
      ? await getManageableChurchIds(request, null, true).then((result) => result.churchIds)
      : await getManageableChurchIds(request, firstChurchId, false).then((result) => result.churchIds);

    const allowedSet = new Set(allowedChurchIds);

    for (const church of requestedChurches) {
      if (!allowedSet.has(church.igrejaId)) {
        return apiError(
          'HUB_SCOPE_FORBIDDEN',
          403,
          'Você tentou gerenciar uma igreja fora do seu escopo atual.'
        );
      }
    }

    let existingAccess: UsuarioAcessoRow | null = null;

    if (body.userId) {
      const { data: accessById, error: accessByIdError } = await supabaseAdmin
        .from('usuarios_acesso')
        .select('id, nome, email, telefone, pessoa_id, auth_user_id, igreja_id, cargo, ativo')
        .eq('id', body.userId)
        .maybeSingle<UsuarioAcessoRow>();

      if (accessByIdError) throw accessByIdError;
      existingAccess = accessById || null;
    }

    const accessByEmail = await findUniqueAccessByEmail(normalizedEmail);

    if (existingAccess && accessByEmail && existingAccess.id !== accessByEmail.id) {
      return apiError(
        'HUB_ACCESS_EMAIL_CONFLICT',
        409,
        'Este e-mail já pertence a outro usuário de acesso.'
      );
    }

    existingAccess = existingAccess || accessByEmail;

    let pessoa: PessoaRow | null = null;

    if (body.pessoaId) {
      const { data: pessoaById, error: pessoaByIdError } = await supabaseAdmin
        .from('pessoas')
        .select('id, nome, email, telefone, usuario_id, igreja_id, cargo, status_membro, ativo')
        .eq('id', body.pessoaId)
        .maybeSingle<PessoaRow>();

      if (pessoaByIdError) throw pessoaByIdError;
      pessoa = pessoaById || null;
    }

    if (!pessoa && existingAccess?.pessoa_id) {
      const { data: pessoaByAccess, error: pessoaByAccessError } = await supabaseAdmin
        .from('pessoas')
        .select('id, nome, email, telefone, usuario_id, igreja_id, cargo, status_membro, ativo')
        .eq('id', existingAccess.pessoa_id)
        .maybeSingle<PessoaRow>();

      if (pessoaByAccessError) throw pessoaByAccessError;
      pessoa = pessoaByAccess || null;
    }

    if (!pessoa) {
      pessoa = await findUniquePessoaByEmail(normalizedEmail);
    }

    if (existingAccess?.pessoa_id && pessoa?.id && existingAccess.pessoa_id !== pessoa.id) {
      return apiError(
        'HUB_ACCESS_PERSON_CONFLICT',
        409,
        'O usuário de acesso já está vinculado a outra pessoa.'
      );
    }

    if (
      existingAccess?.auth_user_id &&
      pessoa?.usuario_id &&
      existingAccess.auth_user_id !== pessoa.usuario_id
    ) {
      return apiError(
        'HUB_PERSON_AUTH_CONFLICT',
        409,
        'Conflito entre o usuário autenticado e o cadastro de pessoa vinculado.'
      );
    }

    const primaryChurch = choosePrimaryAccess(requestedChurches);
    const now = new Date().toISOString();

    if (!primaryChurch) {
      return apiError(
        'HUB_INVALID_CHURCH_SELECTION',
        400,
        'Selecione pelo menos uma igreja válida.'
      );
    }

    if (!pessoa) {
      const { data: createdPessoa, error: createPessoaError } = await supabaseAdmin
        .from('pessoas')
        .insert({
          nome: normalizedName || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          telefone: normalizedPhone,
          usuario_id: existingAccess?.auth_user_id || null,
          igreja_id: primaryChurch.igrejaId,
          cargo: primaryChurch.cargo,
          status_membro: 'ativo',
          ativo: primaryChurch.ativo !== false,
          criado_em: now,
          atualizado_em: now,
        })
        .select('id, nome, email, telefone, usuario_id, igreja_id, cargo, status_membro, ativo')
        .single<PessoaRow>();

      if (createPessoaError) throw createPessoaError;
      pessoa = createdPessoa;
    } else {
      const pessoaUpdate: Record<string, unknown> = {
        atualizado_em: now,
      };

      if (normalizedName) pessoaUpdate.nome = normalizedName;
      if (normalizedEmail) pessoaUpdate.email = normalizedEmail;
      if (normalizedPhone !== null) pessoaUpdate.telefone = normalizedPhone;
      if (!pessoa.usuario_id && existingAccess?.auth_user_id) {
        pessoaUpdate.usuario_id = existingAccess.auth_user_id;
      }

      if (Object.keys(pessoaUpdate).length > 1) {
        const { error: pessoaUpdateError } = await supabaseAdmin
          .from('pessoas')
          .update(pessoaUpdate)
          .eq('id', pessoa.id);

        if (pessoaUpdateError) throw pessoaUpdateError;
      }
    }

    const accessPayload = {
      email: normalizedEmail,
      nome: normalizedName || pessoa.nome,
      telefone: normalizedPhone ?? pessoa.telefone ?? null,
      pessoa_id: pessoa.id,
      igreja_id: primaryChurch.igrejaId,
      cargo: primaryChurch.cargo,
      ativo: requestedChurches.some((church) => church.ativo !== false),
      atualizado_em: now,
    };

    let savedAccess: UsuarioAcessoRow;

    if (existingAccess) {
      const { data: updatedAccess, error: updateAccessError } = await supabaseAdmin
        .from('usuarios_acesso')
        .update(accessPayload)
        .eq('id', existingAccess.id)
        .select('id, nome, email, telefone, pessoa_id, auth_user_id, igreja_id, cargo, ativo')
        .single<UsuarioAcessoRow>();

      if (updateAccessError) throw updateAccessError;
      savedAccess = updatedAccess;
    } else {
      const { data: createdAccess, error: createAccessError } = await supabaseAdmin
        .from('usuarios_acesso')
        .insert({
          ...accessPayload,
          criado_em: now,
        })
        .select('id, nome, email, telefone, pessoa_id, auth_user_id, igreja_id, cargo, ativo')
        .single<UsuarioAcessoRow>();

      if (createAccessError) throw createAccessError;
      savedAccess = createdAccess;
    }

    const { data: existingLinksRaw, error: existingLinksError } = await supabaseAdmin
      .from('usuarios_igrejas')
      .select('usuario_id, igreja_id, cargo, ativo')
      .eq('usuario_id', savedAccess.id)
      .in('igreja_id', allowedChurchIds);

    if (existingLinksError) throw existingLinksError;

    const existingLinks = (existingLinksRaw || []) as UsuarioIgrejaRow[];
    const requestedChurchIds = new Set(requestedChurches.map((church) => church.igrejaId));

    for (const church of requestedChurches) {
      const { error: upsertChurchError } = await supabaseAdmin
        .from('usuarios_igrejas')
        .upsert(
          {
            usuario_id: savedAccess.id,
            igreja_id: church.igrejaId,
            cargo: church.cargo,
            ativo: church.ativo !== false,
          },
          { onConflict: 'usuario_id,igreja_id' }
        );

      if (upsertChurchError) throw upsertChurchError;
    }

    for (const existingLink of existingLinks) {
      if (!requestedChurchIds.has(existingLink.igreja_id)) {
        const { error: disableChurchError } = await supabaseAdmin
          .from('usuarios_igrejas')
          .update({
            ativo: false,
          })
          .eq('usuario_id', savedAccess.id)
          .eq('igreja_id', existingLink.igreja_id);

        if (disableChurchError) throw disableChurchError;
      }
    }

    const { data: pessoaLinksRaw, error: pessoaLinksError } = await supabaseAdmin
      .from('pessoas_igrejas')
      .select('igreja_id, cargo, status_membro, ativo')
      .eq('pessoa_id', pessoa.id);

    if (pessoaLinksError) throw pessoaLinksError;

    const pessoaLinks = (pessoaLinksRaw || []) as PessoaIgrejaRow[];
    const existingPessoaChurchIds = new Set(pessoaLinks.map((link) => link.igreja_id));

    for (const church of requestedChurches) {
      const pessoaChurchPayload = {
        pessoa_id: pessoa.id,
        igreja_id: church.igrejaId,
        cargo: church.cargo,
        ativo: church.ativo !== false,
        status_membro:
          pessoaLinks.find((link) => link.igreja_id === church.igrejaId)?.status_membro ||
          'ativo',
        atualizado_em: now,
      };

      if (existingPessoaChurchIds.has(church.igrejaId)) {
        const { error: updatePessoaChurchError } = await supabaseAdmin
          .from('pessoas_igrejas')
          .update({
            cargo: pessoaChurchPayload.cargo,
            ativo: pessoaChurchPayload.ativo,
            status_membro: pessoaChurchPayload.status_membro,
            atualizado_em: now,
          })
          .eq('pessoa_id', pessoa.id)
          .eq('igreja_id', church.igrejaId);

        if (updatePessoaChurchError) throw updatePessoaChurchError;
      } else {
        const { error: insertPessoaChurchError } = await supabaseAdmin
          .from('pessoas_igrejas')
          .insert({
            ...pessoaChurchPayload,
            criado_em: now,
          });

        if (insertPessoaChurchError) throw insertPessoaChurchError;
      }
    }

    const { error: updatePessoaMirrorError } = await supabaseAdmin
      .from('pessoas')
      .update({
        nome: normalizedName || pessoa.nome,
        email: normalizedEmail,
        telefone: normalizedPhone ?? pessoa.telefone ?? null,
        usuario_id: pessoa.usuario_id || savedAccess.auth_user_id || null,
        igreja_id: primaryChurch.igrejaId,
        cargo: primaryChurch.cargo,
        ativo: primaryChurch.ativo !== false,
        atualizado_em: now,
      })
      .eq('id', pessoa.id);

    if (updatePessoaMirrorError) throw updatePessoaMirrorError;

    return apiSuccess(
      {
        data: {
          id: savedAccess.id,
          pessoa_id: pessoa.id,
          email: savedAccess.email,
        },
      },
      {
        message: existingAccess
          ? 'Usuário atualizado no hub com sucesso.'
          : 'Usuário cadastrado no hub com sucesso.',
        messageCode: existingAccess ? 'HUB_USER_UPDATED' : 'HUB_USER_CREATED',
      }
    );
  } catch (error: any) {
    console.error('Erro ao salvar hub de usuários:', error);
    return apiError(
      error.code || 'SAVE_HUB_USER_FAILED',
      error.status || 500,
      error.message || 'Erro ao salvar hub de usuários.'
    );
  }
}
