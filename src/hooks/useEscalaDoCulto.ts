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
    if (!shouldFetch || !dataCulto) {
      return;
    }

    async function buscarEscala() {
      try {
        setLoading(true);

        // 1. Buscar escala para esta data
        const { data: escalas, error: escalaError } = await supabase
          .from('escalas')
          .select('id, titulo, status')
          .eq('data', dataCulto)
          .maybeSingle();

        if (escalaError) {
          console.error('Erro ao buscar escala:', escalaError);
          setEscala(null);
          return;
        }

        if (!escalas) {
          setEscala(null);
          return;
        }

        // 2. Buscar funções/escalados (SEM nested query)
        const { data: funcoes, error: funcoesError } = await supabase
          .from('escalas_funcoes')
          .select('id, ordem, confirmado, tag_id, pessoa_id')
          .eq('escala_id', escalas.id)
          .order('ordem', { ascending: true });

        if (funcoesError) {
          console.error('Erro ao buscar funções:', funcoesError);
          setEscala(null);
          return;
        }

        if (!funcoes || funcoes.length === 0) {
          setEscala({
            id: escalas.id,
            titulo: escalas.titulo,
            status: escalas.status,
            funcoes: []
          });
          return;
        }

        // 3. Buscar tags das funções
        const tagIds = funcoes.map(f => f.tag_id).filter(Boolean);
        const { data: tags } = await supabase
          .from('tags_funcoes')
          .select('id, nome, categoria, cor')
          .in('id', tagIds);

        // 4. Buscar pessoas escaladas
        const pessoaIds = funcoes.map(f => f.pessoa_id).filter(Boolean);
        const { data: pessoas } = await supabase
          .from('pessoas')
          .select('id, nome, email')
          .in('id', pessoaIds);

        // 5. Criar maps para lookup rápido
        const tagsMap = new Map(tags?.map(t => [t.id, t]) || []);
        const pessoasMap = new Map(pessoas?.map(p => [p.id, p]) || []);

        // 6. Montar funções completas
        const funcoesFormatadas: Funcao[] = funcoes.map(f => {
          const tag = tagsMap.get(f.tag_id);
          const pessoa = pessoasMap.get(f.pessoa_id);

          return {
            id: f.id,
            ordem: f.ordem,
            confirmado: f.confirmado,
            tag: {
              nome: tag?.nome || 'Função não encontrada',
              categoria: tag?.categoria || 'apoio',
              cor: tag?.cor || '#64748b'
            },
            usuario: {
              nome: pessoa?.nome || 'Nome não encontrado',
              email: pessoa?.email || ''
            }
          };
        });

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