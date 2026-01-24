import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Tag {
  nome: string;
  categoria: string;
  cor: string;
}

interface Usuario {
  nome: string;
  email: string;
}

interface Funcao {
  id: string;
  ordem: number;
  confirmado: boolean;
  tag: Tag;
  usuario: Usuario;
}

interface Escala {
  id: string;
  titulo: string;
  status: string;
  funcoes: Funcao[];
}

export function useEscalaDoCulto(dataCulto: string, shouldFetch: boolean = true) {
  const [escala, setEscala] = useState<Escala | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldFetch || !dataCulto) return;

    async function buscarEscala() {
      try {
        setLoading(true);

        // 1. Buscar escala para esta data
        const { data: escalas, error: escalaError } = await supabase
          .from('escalas')
          .select('id, titulo, status')
          .eq('data', dataCulto)
          .single();

        if (escalaError || !escalas) {
          setEscala(null);
          return;
        }

        // 2. Buscar funções/escalados
        const { data: funcoes, error: funcoesError } = await supabase
          .from('escalas_funcoes')
          .select(`
            id,
            ordem,
            confirmado,
            tags_funcoes (
              nome,
              categoria,
              cor
            ),
            usuarios_permitidos (
              nome,
              email
            )
          `)
          .eq('escala_id', escalas.id)
          .order('ordem', { ascending: true });

        if (funcoesError) {
          console.error('Erro ao buscar funções:', funcoesError);
          setEscala(null);
          return;
        }

        // 3. Formatar dados
        const funcoesFormatadas: Funcao[] = (funcoes || []).map((f: any) => ({
          id: f.id,
          ordem: f.ordem,
          confirmado: f.confirmado,
          tag: {
            nome: f.tags_funcoes?.nome || 'Função não encontrada',
            categoria: f.tags_funcoes?.categoria || 'Demais',
            cor: f.tags_funcoes?.cor || '#64748b'
          },
          usuario: {
            nome: f.usuarios_permitidos?.nome || 'Nome não encontrado',
            email: f.usuarios_permitidos?.email || ''
          }
        }));

        setEscala({
          id: escalas.id,
          titulo: escalas.titulo,
          status: escalas.status,
          funcoes: funcoesFormatadas
        });

      } catch (error) {
        console.error('Erro ao buscar escala:', error);
        setEscala(null);
      } finally {
        setLoading(false);
      }
    }

    buscarEscala();
  }, [dataCulto, shouldFetch]);

  return { escala, loading };
}