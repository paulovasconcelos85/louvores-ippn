'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getStoredChurchId } from '@/lib/church-utils';

/** Nome da igreja (a informada ou a selecionada no painel), para textos compartilhados. */
export function useNomeIgreja(igrejaId?: string | null) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    const id = igrejaId || getStoredChurchId();
    if (!id) return;

    let ativo = true;
    supabase
      .from('igrejas')
      .select('nome')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setNome(data?.nome || '');
      });

    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  return nome;
}
