'use client';

import { useCallback, useState } from 'react';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import type { CargoTipo } from '@/lib/permissions';
import { useLocale } from '@/i18n/provider';
import { resolveApiErrorMessage, resolveApiSuccessMessage } from '@/lib/api-feedback';

export interface HubUsuarioVinculo {
  igreja_id: string;
  igreja_nome: string;
  igreja_sigla?: string | null;
  cargo: CargoTipo;
  ativo: boolean;
}

export interface HubUsuario {
  id: string;
  nome: string | null;
  email: string;
  telefone: string | null;
  pessoa_id: string | null;
  auth_user_id: string | null;
  nome_exibicao: string;
  ativo: boolean;
  vinculos: HubUsuarioVinculo[];
}

export interface HubUsuarioIgrejaPayload {
  igrejaId: string;
  cargo: CargoTipo;
  ativo: boolean;
}

export interface HubUsuarioPayload {
  userId?: string;
  nome?: string;
  email: string;
  telefone?: string;
  pessoaId?: string;
  igrejas: HubUsuarioIgrejaPayload[];
}

type HubIgreja = {
  id: string;
  nome: string;
  sigla?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ativo?: boolean | null;
};

export function useHubUsuarios() {
  const locale = useLocale();
  const [usuarios, setUsuarios] = useState<HubUsuario[]>([]);
  const [igrejas, setIgrejas] = useState<HubIgreja[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listarUsuarios = useCallback(
    async (params?: { scope?: 'current' | 'all'; igrejaId?: string | null }) => {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams();

        if (params?.scope) {
          searchParams.set('scope', params.scope);
        }

        if (params?.igrejaId) {
          searchParams.set('igreja_id', params.igrejaId);
        }

        const query = searchParams.toString();
        const response = await fetch(
          `/api/admin/usuarios-hub${query ? `?${query}` : ''}`,
          {
            headers: await buildAuthenticatedHeaders(),
          }
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(resolveApiErrorMessage(locale, payload, 'Erro ao carregar hub de usuários.'));
        }

        setUsuarios((payload.usuarios || []) as HubUsuario[]);
        setIgrejas((payload.igrejas || []) as HubIgreja[]);

        return {
          success: true,
          usuarios: (payload.usuarios || []) as HubUsuario[],
          igrejas: (payload.igrejas || []) as HubIgreja[],
        };
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar hub de usuários.');
        setUsuarios([]);
        return {
          success: false,
          usuarios: [] as HubUsuario[],
          igrejas: [] as HubIgreja[],
          error: err.message || 'Erro ao carregar hub de usuários.',
        };
      } finally {
        setLoading(false);
      }
    },
    [locale]
  );

  const salvarUsuario = useCallback(async (payload: HubUsuarioPayload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/usuarios-hub', {
        method: 'POST',
        headers: await buildAuthenticatedHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(resolveApiErrorMessage(locale, data, 'Erro ao salvar usuário no hub.'));
      }

      return {
        success: true,
        message: resolveApiSuccessMessage(locale, data, data.message),
      };
    } catch (err: any) {
      const message = err.message || 'Erro ao salvar usuário no hub.';
      setError(message);
      return {
        success: false,
        error: message,
      };
    } finally {
      setLoading(false);
    }
  }, [locale]);

  return {
    usuarios,
    igrejas,
    loading,
    error,
    listarUsuarios,
    salvarUsuario,
  };
}
