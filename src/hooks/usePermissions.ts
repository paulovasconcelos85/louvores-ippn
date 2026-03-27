'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { UsuarioPermitido } from '@/lib/permissions';
import {
  podeAcessarAdmin,
  podeGerenciarUsuarios,
  podeGerenciarEscalas,
  podeGerenciarConteudo,
  isSuperAdmin
} from '@/lib/permissions';

interface UsePermissionsReturn {
  usuarioPermitido: UsuarioPermitido | null;
  loading: boolean;
  error: string | null;
  permissoes: {
    podeAcessarAdmin: boolean;
    podeGerenciarUsuarios: boolean;
    podeGerenciarEscalas: boolean;
    podeGerenciarConteudo: boolean;
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

  const fetchPermissions = async () => {
    if (!user?.id) {
      setUsuarioPermitido(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verificar se é super-admin (da lista hardcoded)
      const ehSuperAdminEmail = isSuperAdmin(user.email);

      // Buscar vínculo com a igreja — fonte de verdade para o cargo
      const { data: vinculo, error: vinculoError } = await supabase
        .from('usuarios_igrejas')
        .select('cargo, ativo, igreja_id')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (vinculoError && vinculoError.code !== 'PGRST116') {
        console.error('Erro ao buscar vínculo de igreja:', vinculoError);

        if (ehSuperAdminEmail) {
          setUsuarioPermitido({
            id: user.id,
            email: user.email || '',
            nome: user.email?.split('@')[0] || 'Admin',
            cargo: 'superadmin',
            ativo: true
          });
          return;
        }

        setError('Erro ao verificar permissões');
        setUsuarioPermitido(null);
        return;
      }

      const ehSuperAdminCargo = vinculo?.cargo === 'superadmin';
      const ehSuperAdmin = ehSuperAdminEmail || ehSuperAdminCargo;

      // Sem vínculo ativo e não é super-admin
      if (!vinculo && !ehSuperAdmin) {
        setError('Você não tem permissão para acessar o sistema');
        setUsuarioPermitido(null);
        return;
      }

      // Sem vínculo mas é super-admin
      if (!vinculo && ehSuperAdmin) {
        setUsuarioPermitido({
          id: user.id,
          email: user.email || '',
          nome: user.email?.split('@')[0] || 'Admin',
          cargo: 'superadmin',
          ativo: true
        });
        return;
      }

      // Buscar dados complementares do usuário em usuarios_acesso
      const { data: acesso } = await supabase
        .from('usuarios_acesso')
        .select('email, nome, telefone, foto_url, observacoes, ativo')
        .eq('id', user.id)
        .maybeSingle();

      // Verificar se está ativo (exceto super-admins)
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
        observacoes: acesso?.observacoes
      });

    } catch (err) {
      console.error('Erro ao buscar permissões:', err);
      setError('Erro ao verificar permissões');
      setUsuarioPermitido(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchPermissions();
    }
  }, [user?.id, authLoading]);

  const permissoes = {
    podeAcessarAdmin: podeAcessarAdmin(usuarioPermitido?.cargo || null),
    podeGerenciarUsuarios: podeGerenciarUsuarios(
      usuarioPermitido?.cargo || null,
      user?.email
    ),
    podeGerenciarEscalas: podeGerenciarEscalas(usuarioPermitido?.cargo || null),
    podeGerenciarConteudo: podeGerenciarConteudo(usuarioPermitido?.cargo || null),
    isSuperAdmin: isSuperAdmin(user?.email, usuarioPermitido?.cargo)
  };

  return {
    usuarioPermitido,
    loading: authLoading || loading,
    error,
    permissoes,
    isSuperAdmin: isSuperAdmin(user?.email, usuarioPermitido?.cargo),
    refetch: fetchPermissions
  };
}