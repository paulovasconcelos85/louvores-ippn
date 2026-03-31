'use client';

import { useState, useCallback } from 'react';
import { CargoTipo } from '@/lib/permissions';
import { getStoredChurchId } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';

export interface Pessoa {
  id: string;
  nome: string;
  cargo: CargoTipo;
  email?: string;
  telefone?: string;
  ativo: boolean;
  tem_acesso: boolean;
  usuario_id?: string;
  foto_url?: string;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
  tags?: Array<{
    id: string;
    nome: string;
    categoria: string;
    cor: string;
    icone: string;
  }>;
}

export function usePessoas() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendChurchId = (params: URLSearchParams) => {
    const igrejaId = getStoredChurchId();
    if (igrejaId) params.append('igreja_id', igrejaId);
  };

  // Listar pessoas
  const listarPessoas = useCallback(async (filtros?: {
    ativo?: boolean;
    tem_acesso?: boolean;
    cargo?: string;
    busca?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      appendChurchId(params);
      if (filtros?.ativo !== undefined) params.append('ativo', String(filtros.ativo));
      if (filtros?.tem_acesso !== undefined) params.append('tem_acesso', String(filtros.tem_acesso));
      if (filtros?.cargo) params.append('cargo', filtros.cargo);
      if (filtros?.busca) params.append('busca', filtros.busca);

      const response = await fetch(`/api/pessoas?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao listar pessoas');

      setPessoas(data.data || []);
      return data.data || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Criar pessoa
  const criarPessoa = useCallback(async (dados: {
    nome: string;
    cargo: string;
    email?: string;
    telefone?: string;
    observacoes?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pessoas', {
        method: 'POST',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...dados,
          igreja_id: getStoredChurchId(),
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao criar pessoa');

      return { success: true, data: data.data };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualizar pessoa
  const atualizarPessoa = useCallback(async (id: string, dados: Partial<Pessoa>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/pessoas/${id}`, {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...dados,
          igreja_id: getStoredChurchId(),
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar pessoa');

      return { success: true, data: data.data };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Deletar pessoa
  const deletarPessoa = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      appendChurchId(params);

      const response = await fetch(`/api/pessoas/${id}?${params.toString()}`, {
        method: 'DELETE',
        headers: await buildAuthenticatedHeaders(),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao deletar pessoa');

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const enviarConvite = useCallback(async (dados: {
    pessoa_id?: string;
    email: string;
    nome?: string;
    cargo?: string;
    telefone?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      void dados;
      throw new Error('O fluxo de convites foi desativado. Cadastre o acesso por outro processo.');
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const liberarAcesso = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      appendChurchId(params);

      const response = await fetch(`/api/pessoas/${id}/liberar-acesso?${params.toString()}`, {
        method: 'POST',
        headers: await buildAuthenticatedHeaders(),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Erro ao liberar acesso');

      return { success: true, message: data.message };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    pessoas,
    loading,
    error,
    listarPessoas,
    criarPessoa,
    atualizarPessoa,
    deletarPessoa,
    enviarConvite,
    liberarAcesso
  };
}
