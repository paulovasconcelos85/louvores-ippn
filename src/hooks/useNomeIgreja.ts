'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoredChurchId } from '@/lib/church-utils';

/** Nome e país da igreja (a informada ou a selecionada no painel). */
export function useIgrejaAtual(igrejaId?: string | null) {
  const [igreja, setIgreja] = useState<{ nome: string; pais: string | null }>({ nome: '', pais: null });

  useEffect(() => {
    const id = igrejaId || getStoredChurchId();
    if (!id) return;

    let ativo = true;
    supabase
      .from('igrejas')
      .select('nome, pais')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setIgreja({ nome: data?.nome || '', pais: data?.pais || null });
      });

    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  return igreja;
}

/** Nome da igreja, para textos compartilhados. */
export function useNomeIgreja(igrejaId?: string | null) {
  return useIgrejaAtual(igrejaId).nome;
}
