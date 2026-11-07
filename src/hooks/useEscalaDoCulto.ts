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
  ordem: number | null;
  confirmado: boolean | null;
  tag: Tag;
  usuario: Usuario;
}

interface Cantico {
  id: string;
  nome: string;
  tags: string[] | null;
  youtube_url: string | null;
  spotify_url: string | null;
}

interface Escala {
  id: string;
  titulo: string;
  status: string | null;
  funcoes: Funcao[];
  canticos: Cantico[];  // 👈 NOVA PROPRIEDADE
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

        // 1. Buscar escala para esta data (incluindo culto_id agora)
        const { data: escalas, error: escalaError } = await supabase
          .from('escalas')
          .select('id, titulo, status, culto_id')
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

        // 3. Buscar tags das funções
        const tagIds = (funcoes || []).map(f => f.tag_id);
        const { data: tags } = await supabase
          .from('tags_funcoes')
          .select('id, nome, categoria, cor')
          .in('id', tagIds);

        // 4. Buscar pessoas escaladas
        const pessoaIds = (funcoes || []).map(f => f.pessoa_id).filter((id): id is string => Boolean(id));
        const { data: pessoas } = await supabase
          .from('pessoas')
          .select('id, nome, email')
          .in('id', pessoaIds);

        // 5. 🎵 BUSCAR CÂNTICOS DO CULTO
        let canticos: Cantico[] = [];
        
        if (escalas.culto_id) {
          // Buscar louvor_itens que têm cantico_id
          const { data: louvorItens, error: louvorError } = await supabase
            .from('louvor_itens')
            .select('cantico_id')
            .eq('culto_id', escalas.culto_id)
            .not('cantico_id', 'is', null)
            .order('ordem', { ascending: true });

          if (!louvorError && louvorItens && louvorItens.length > 0) {
            // Buscar os cânticos pelos IDs encontrados
            const canticoIds = louvorItens
              .map(item => item.cantico_id)
              .filter((id): id is string => Boolean(id));

            if (canticoIds.length > 0) {
              const { data: canticosData } = await supabase
                .from('canticos')
                .select('id, nome, tags, youtube_url, spotify_url')
                .in('id', canticoIds);

              if (canticosData) {
                // Manter a ordem dos cânticos conforme aparecem em louvor_itens
                canticos = canticoIds
                  .map(id => canticosData.find(c => c.id === id))
                  .filter((c): c is Cantico => c !== undefined);
              }
            }
          }
        }

        // 6. Criar maps para lookup rápido
        const tagsMap = new Map(tags?.map(t => [t.id, t]) || []);
        const pessoasMap = new Map(pessoas?.map(p => [p.id, p]) || []);

        // 7. Montar funções completas
        const funcoesFormatadas: Funcao[] = (funcoes || []).map(f => {
          const tag = tagsMap.get(f.tag_id);
          const pessoa = f.pessoa_id ? pessoasMap.get(f.pessoa_id) : undefined;

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
          funcoes: funcoesFormatadas,
          canticos  // 👈 INCLUINDO OS CÂNTICOS
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