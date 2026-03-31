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
    isSuperAdmin: boolean;
  };
  isSuperAdmin: boolean;
  refetch: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, loading: authLoading } = useAuth();
  const [usuarioPermitido, setUsuarioPermitido] = useState<UsuarioPermitido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!user?.id) {
      setUsuarioPermitido(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const ehSuperAdminEmail = isSuperAdmin(user.email);

      let acesso = null;

      try {
        acesso = await findUsuarioAcesso(user.id, user.email);
      } catch (acessoError) {
        console.error('Erro ao buscar usuario de acesso:', acessoError);

        if (!ehSuperAdminEmail) {
          setError('Erro ao verificar permissões');
          setUsuarioPermitido(null);
          return;
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
          setUsuarioPermitido({
            id: user.id,
            email: user.email || '',
            nome: user.email?.split('@')[0] || 'Admin',
            cargo: 'superadmin',
            ativo: true,
            tags: [],
          });
          return;
        }

        setError('Erro ao verificar permissões');
        setUsuarioPermitido(null);
        return;
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
        setError('Você não tem permissão para acessar o sistema');
        setUsuarioPermitido(null);
        return;
      }

      if (!vinculo && ehSuperAdmin) {
        setUsuarioPermitido({
          id: user.id,
          email: user.email || '',
          nome: user.email?.split('@')[0] || 'Admin',
          cargo: 'superadmin',
          ativo: true,
          tags: tagsUsuario,
        });
        return;
      }

      if (acesso && !acesso.ativo && !ehSuperAdmin) {
        setError('Usuário desativado');
        setUsuarioPermitido(null);
        return;
      }

      setUsuarioPermitido({
        id: user.id,
        email: acesso?.email || user.email || '',
        nome: acesso?.nome || user.email?.split('@')[0] || '',
        cargo: vinculo!.cargo,
        ativo: vinculo!.ativo,
        telefone: acesso?.telefone,
        foto_url: acesso?.foto_url,
        observacoes: acesso?.observacoes,
        tags: tagsUsuario,
      });
    } catch (err) {
      console.error('Erro ao buscar permissões:', err);
      setError('Erro ao verificar permissões');
      setUsuarioPermitido(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!authLoading) {
      fetchPermissions();
    }
  }, [authLoading, fetchPermissions]);

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
