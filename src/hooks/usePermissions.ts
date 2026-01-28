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
      const ehSuperAdmin = isSuperAdmin(user.email);

      // Buscar pessoa pelo usuario_id (id do auth.users)
      const { data: pessoa, error: fetchError } = await supabase
        .from('pessoas')
        .select('id, email, nome, cargo, ativo, tem_acesso, telefone, foto_url, observacoes, usuario_id')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Erro ao buscar pessoa:', fetchError);
        
        // Se é super-admin mas não está no banco, ainda permite acesso
        if (ehSuperAdmin) {
          setUsuarioPermitido({
            id: user.id,
            email: user.email || '',
            nome: user.email?.split('@')[0] || 'Admin',
            cargo: 'admin',
            ativo: true
          });
          return;
        }
        
        setError('Erro ao verificar permissões');
        setUsuarioPermitido(null);
        return;
      }

      // Se não achou pessoa E não é super-admin
      if (!pessoa && !ehSuperAdmin) {
        setError('Você não tem permissão para acessar o sistema');
        setUsuarioPermitido(null);
        return;
      }

      // Se não achou pessoa MAS é super-admin
      if (!pessoa && ehSuperAdmin) {
        setUsuarioPermitido({
          id: user.id,
          email: user.email || '',
          nome: user.email?.split('@')[0] || 'Admin',
          cargo: 'admin',
          ativo: true
        });
        return;
      }

      // Pessoa existe - verificar se tem acesso
      if (pessoa && !pessoa.tem_acesso && !ehSuperAdmin) {
        setError('Você não tem permissão para acessar o sistema');
        setUsuarioPermitido(null);
        return;
      }

      // Verificar se está ativo (exceto super-admins)
      if (pessoa && !pessoa.ativo && !ehSuperAdmin) {
        setError('Usuário desativado');
        setUsuarioPermitido(null);
        return;
      }

      // Tudo ok - definir permissões
      if (pessoa) {
        setUsuarioPermitido({
          id: pessoa.usuario_id || pessoa.id, // Priorizar usuario_id (id do auth)
          email: pessoa.email || user.email || '',
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          ativo: pessoa.ativo,
          telefone: pessoa.telefone,
          foto_url: pessoa.foto_url,
          observacoes: pessoa.observacoes
        });
      }

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
    isSuperAdmin: isSuperAdmin(user?.email)
  };

  return {
    usuarioPermitido,
    loading: authLoading || loading,
    error,
    permissoes,
    isSuperAdmin: isSuperAdmin(user?.email),
    refetch: fetchPermissions
  };
}