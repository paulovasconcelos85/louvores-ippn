// hooks/usePermissions.ts
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
  refetch: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, loading: authLoading } = useAuth();
  const [usuarioPermitido, setUsuarioPermitido] = useState<UsuarioPermitido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user?.email) {
      setUsuarioPermitido(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verificar se é super-admin (da lista hardcoded)
      const ehSuperAdmin = isSuperAdmin(user.email);

      // Se for super-admin, não precisa estar no banco
      // Mas ainda tentamos buscar para pegar nome/telefone se houver
      const { data, error: fetchError } = await supabase
        .from('usuarios_permitidos')
        .select('id, email, nome, cargo, ativo, telefone, foto_url, observacoes')
        .eq('email', user.email)
        .maybeSingle(); // usa maybeSingle ao invés de single para não dar erro se não existir

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = nenhuma linha encontrada (ok para super-admin)
        console.error('Erro ao buscar permissões:', fetchError);
        
        // Se é super-admin mas não está no banco, ainda permite acesso
        if (ehSuperAdmin) {
          setUsuarioPermitido({
            id: user.id,
            email: user.email,
            nome: user.email.split('@')[0], // usa parte antes do @ como nome
            cargo: 'admin',
            ativo: true
          });
          return;
        }
        
        setError('Usuário não autorizado');
        setUsuarioPermitido(null);
        return;
      }

      // Se não achou no banco E não é super-admin
      if (!data && !ehSuperAdmin) {
        setError('Usuário não cadastrado no sistema');
        setUsuarioPermitido(null);
        return;
      }

      // Se não achou no banco MAS é super-admin
      if (!data && ehSuperAdmin) {
        setUsuarioPermitido({
          id: user.id,
          email: user.email,
          nome: user.email.split('@')[0],
          cargo: 'admin',
          ativo: true
        });
        return;
      }

      // Verificar se está ativo (exceto super-admins)
      if (data && !data.ativo && !ehSuperAdmin) {
        setError('Usuário desativado');
        setUsuarioPermitido(null);
        return;
      }

      setUsuarioPermitido(data as UsuarioPermitido);
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
  }, [user?.email, authLoading]);

  const permissoes = {
    podeAcessarAdmin: podeAcessarAdmin(usuarioPermitido?.cargo || null),
    podeGerenciarUsuarios: podeGerenciarUsuarios(
      usuarioPermitido?.cargo || null,
      user?.email // ← IMPORTANTE: Passa o email para verificar super-admin
    ),
    podeGerenciarEscalas: podeGerenciarEscalas(usuarioPermitido?.cargo || null),
    podeGerenciarConteudo: podeGerenciarConteudo(usuarioPermitido?.cargo || null),
    isSuperAdmin: isSuperAdmin(user?.email)
  };

  return {
    usuarioPermitido,
    loading: authLoading || loading,
    error,
    permissoes,
    refetch: fetchPermissions
  };
}