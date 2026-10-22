'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { TagPermissao, UsuarioPermitido } from '@/lib/permissions';
import {
  podeAcessarAdmin,
  podeGerenciarUsuariosComTags,
  podeGerenciarEscalasComTags,
  podeGerenciarConteudo,
  podeGerenciarCultos,
  podeGerenciarCanticos,
  podePastorearMembros,
  podeEditarLiturgiaCompleta,
  podeEditarLouvor,
  podeEditarRecursosMultimidia,
  isSuperAdmin,
} from '@/lib/permissions';

async function findUsuarioAcesso(
  authUserId: string,
  email?: string | null
) {
  const byAuth = await supabase
    .from('usuarios_acesso')
    .select('id, pessoa_id, email, nome, telefone, foto_url, observacoes, ativo')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (byAuth.error && byAuth.error.code !== 'PGRST116') {
    throw byAuth.error;
  }

  if (byAuth.data) {
    return byAuth.data;
  }

  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const byEmail = await supabase
    .from('usuarios_acesso')
    .select('id, pessoa_id, email, nome, telefone, foto_url, observacoes, ativo')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (byEmail.error && byEmail.error.code !== 'PGRST116') {
    throw byEmail.error;
  }

  return byEmail.data || null;
}

interface UsePermissionsReturn {
  usuarioPermitido: UsuarioPermitido | null;
  loading: boolean;
  error: string | null;
  permissoes: {
    podeAcessarAdmin: boolean;
    podeGerenciarUsuarios: boolean;
    podeGerenciarEscalas: boolean;
    podeGerenciarConteudo: boolean;
    podeGerenciarCultos: boolean;
    podeGerenciarCanticos: boolean;
    podePastorearMembros: boolean;
    podeEditarLiturgiaCompleta: boolean;
    podeEditarLouvor: boolean;
    podeEditarRecursosMultimidia: boolean;
    isSuperAdmin: boolean;
  };
  isSuperAdmin: boolean;
  refetch: () => Promise<void>;
}

interface ResultadoPermissoes {
  usuarioPermitido: UsuarioPermitido | null;
  error: string | null;
}

async function resolverPermissoes(user: { id: string; email?: string | null }): Promise<ResultadoPermissoes> {
  try {
    const ehSuperAdminEmail = isSuperAdmin(user.email);

    let acesso = null;

    try {
      acesso = await findUsuarioAcesso(user.id, user.email);
    } catch (acessoError) {
      console.error('Erro ao buscar usuario de acesso:', acessoError);

      if (!ehSuperAdminEmail) {
        return { usuarioPermitido: null, error: 'Erro ao verificar permissões' };
      }
    }

    const { data: vinculo, error: vinculoError } = await supabase
      .from('usuarios_igrejas')
      .select('cargo, ativo, igreja_id')
      .eq('usuario_id', acesso?.id || '')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (vinculoError && vinculoError.code !== 'PGRST116') {
      console.error('Erro ao buscar vínculo de igreja:', vinculoError);

      if (ehSuperAdminEmail) {
        return {
          usuarioPermitido: {
            id: user.id,
            email: user.email || '',
            nome: user.email?.split('@')[0] || 'Admin',
            cargo: 'superadmin',
            ativo: true,
            tags: [],
          },
          error: null,
        };
      }

      return { usuarioPermitido: null, error: 'Erro ao verificar permissões' };
    }

    let tagsUsuario: TagPermissao[] = [];

    if (acesso?.pessoa_id) {
      const { data: tagsData, error: tagsError } = await supabase
        .from('usuarios_tags')
        .select(`
          tag_id,
          tags_funcoes (
            id,
            nome,
            categoria,
            cor,
            icone
          )
        `)
        .eq('pessoa_id', acesso.pessoa_id);

      if (tagsError) {
        console.error('Erro ao buscar tags do usuario:', tagsError);
      } else {
        tagsUsuario = (tagsData || [])
          .map((item: any) => item.tags_funcoes)
          .filter(Boolean) as TagPermissao[];
      }
    }

    const ehSuperAdminCargo = vinculo?.cargo === 'superadmin';
    const ehSuperAdmin = ehSuperAdminEmail || ehSuperAdminCargo;

    if (!vinculo && !ehSuperAdmin) {
      return { usuarioPermitido: null, error: 'Você não tem permissão para acessar o sistema' };
    }

    if (!vinculo && ehSuperAdmin) {
      return {
        usuarioPermitido: {
          id: user.id,
          email: user.email || '',
          nome: user.email?.split('@')[0] || 'Admin',
          cargo: 'superadmin',
          ativo: true,
          tags: tagsUsuario,
        },
        error: null,
      };
    }

    if (acesso && !acesso.ativo && !ehSuperAdmin) {
      return { usuarioPermitido: null, error: 'Usuário desativado' };
    }

    return {
      usuarioPermitido: {
        id: user.id,
        email: acesso?.email || user.email || '',
        nome: acesso?.nome || user.email?.split('@')[0] || '',
        cargo: vinculo!.cargo,
        ativo: vinculo!.ativo,
        telefone: acesso?.telefone,
        foto_url: acesso?.foto_url,
        observacoes: acesso?.observacoes,
        tags: tagsUsuario,
      },
      error: null,
    };
  } catch (err) {
    console.error('Erro ao buscar permissões:', err);
    return { usuarioPermitido: null, error: 'Erro ao verificar permissões' };
  }
}

// Uma busca por usuário, compartilhada por todas as instâncias do hook (cabeçalho,
// página, componentes) e reaproveitada entre telas por alguns minutos.
const VALIDADE_CACHE_MS = 5 * 60 * 1000;

let cache: {
  userId: string;
  promessa: Promise<ResultadoPermissoes>;
  resultado: ResultadoPermissoes | null;
  buscadoEm: number;
} | null = null;

const ouvintes = new Set<(userId: string, resultado: ResultadoPermissoes) => void>();

function obterPermissoes(user: { id: string; email?: string | null }, forcar = false) {
  const valido =
    cache &&
    cache.userId === user.id &&
    (cache.resultado === null || Date.now() - cache.buscadoEm < VALIDADE_CACHE_MS);

  if (valido && !forcar) return cache!.promessa;

  const entrada = {
    userId: user.id,
    promessa: resolverPermissoes(user),
    resultado: null as ResultadoPermissoes | null,
    buscadoEm: Date.now(),
  };
  cache = entrada;

  entrada.promessa.then((resultado) => {
    if (cache !== entrada) return;
    entrada.resultado = resultado;
    entrada.buscadoEm = Date.now();
    ouvintes.forEach((ouvinte) => ouvinte(user.id, resultado));
  });

  return entrada.promessa;
}

function resultadoEmCache(userId: string | undefined) {
  if (!userId || !cache || cache.userId !== userId || !cache.resultado) return null;
  return cache.resultado;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, loading: authLoading } = useAuth();
  const inicial = resultadoEmCache(user?.id);
  const [usuarioPermitido, setUsuarioPermitido] = useState<UsuarioPermitido | null>(inicial?.usuarioPermitido ?? null);
  const [loading, setLoading] = useState(!inicial);
  const [error, setError] = useState<string | null>(inicial?.error ?? null);

  const aplicar = useCallback((resultado: ResultadoPermissoes) => {
    setUsuarioPermitido(resultado.usuarioPermitido);
    setError(resultado.error);
    setLoading(false);
  }, []);

  const carregar = useCallback(
    async (forcar: boolean) => {
      if (!user?.id) {
        setUsuarioPermitido(null);
        setError(null);
        setLoading(false);
        return;
      }

      const emCache = forcar ? null : resultadoEmCache(user.id);
      if (emCache) {
        aplicar(emCache);
      } else {
        setLoading(true);
      }

      aplicar(await obterPermissoes({ id: user.id, email: user.email }, forcar));
    },
    [user?.id, user?.email, aplicar]
  );

  const fetchPermissions = useCallback(() => carregar(true), [carregar]);

  useEffect(() => {
    if (!user?.id) return;
    const ouvinte = (userId: string, resultado: ResultadoPermissoes) => {
      if (userId === user.id) aplicar(resultado);
    };
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, [user?.id, aplicar]);

  useEffect(() => {
    if (!authLoading) {
      carregar(false);
    }
  }, [authLoading, carregar]);

  const tags = usuarioPermitido?.tags || [];
  const cargo = usuarioPermitido?.cargo || null;

  const permissoes = {
    podeAcessarAdmin: podeAcessarAdmin(cargo, tags),
    podeGerenciarUsuarios: podeGerenciarUsuariosComTags(cargo, tags, user?.email),
    podeGerenciarEscalas: podeGerenciarEscalasComTags(cargo, tags),
    podeGerenciarConteudo: podeGerenciarConteudo(cargo, tags),
    podeGerenciarCultos: podeGerenciarCultos(cargo, tags),
    podeGerenciarCanticos: podeGerenciarCanticos(cargo, tags),
    podePastorearMembros: podePastorearMembros(cargo),
    podeEditarLiturgiaCompleta: podeEditarLiturgiaCompleta(cargo),
    podeEditarLouvor: podeEditarLouvor(cargo, tags),
    podeEditarRecursosMultimidia: podeEditarRecursosMultimidia(cargo, tags),
    isSuperAdmin: isSuperAdmin(user?.email, usuarioPermitido?.cargo),
  };

  return {
    usuarioPermitido,
    loading: authLoading || loading,
    error,
    permissoes,
    isSuperAdmin: isSuperAdmin(user?.email, usuarioPermitido?.cargo),
    refetch: fetchPermissions,
  };
}
