import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro } from '@/lib/financas-server';
import { GRUPOS_IPB, PAPEIS_EQUIPE, centavos, type GrupoIpb, type PapelEquipe } from '@/lib/financas';

// POST /api/financas/configuracao { igreja_id, acao, ... }
// acao: salvar_conta | salvar_categoria | adicionar_equipe | remover_equipe

function texto(value: unknown, max = 120) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 400, 'Dados inválidos.');
  }

  const ctx = await contextoFinanceiro(request, texto(body.igreja_id, 40));
  if (ctx.error) return ctx.error;
  const { supabaseAdmin, igrejaId, permissoes } = ctx;

  try {
    switch (body.acao) {
      case 'salvar_conta': {
        if (!permissoes.podeConfigurar) return apiError('FORBIDDEN', 403, 'Sem permissão para configurar contas.');
        const nome = texto(body.nome);
        if (!nome) return apiError('ACCOUNT_NAME_REQUIRED', 400, 'Dê um nome à conta.');
        const tipo = ['caixa', 'banco', 'aplicacao'].includes(String(body.tipo)) ? String(body.tipo) : 'banco';
        const dataSaldo = texto(body.data_saldo_inicial, 10);
        if (!dataSaldo || !/^\d{4}-\d{2}-\d{2}$/.test(dataSaldo)) {
          return apiError('ACCOUNT_DATE_REQUIRED', 400, 'Informe a data do saldo inicial.');
        }

        const dados = {
          nome,
          tipo,
          banco: texto(body.banco, 80),
          agencia: texto(body.agencia, 20),
          numero: texto(body.numero, 30),
          saldo_inicial: centavos(Number(body.saldo_inicial)) / 100,
          data_saldo_inicial: dataSaldo,
          ativo: body.ativo !== false,
          atualizado_em: new Date().toISOString(),
        };
        const id = texto(body.id, 40);

        if (id) {
          const { data: atual } = await supabaseAdmin
            .from('fin_contas')
            .select('saldo_inicial, data_saldo_inicial')
            .eq('id', id)
            .eq('igreja_id', igrejaId)
            .maybeSingle();
          if (!atual) return apiError('ACCOUNT_NOT_FOUND', 404, 'Conta não encontrada.');

          const mudouSaldo =
            centavos(atual.saldo_inicial) !== centavos(dados.saldo_inicial) || atual.data_saldo_inicial !== dados.data_saldo_inicial;
          if (mudouSaldo) {
            // Mudar o saldo de implantação alteraria balancetes já entregues à comissão.
            const { count } = await supabaseAdmin
              .from('fin_exames')
              .select('*', { count: 'exact', head: true })
              .eq('igreja_id', igrejaId)
              .in('status', ['enviado', 'parecer', 'aprovado']);
            if ((count || 0) > 0) {
              return apiError('ACCOUNT_LOCKED', 409, 'Já há balancete enviado à comissão; o saldo inicial não pode mais mudar.');
            }
          }

          const { error } = await supabaseAdmin.from('fin_contas').update(dados).eq('id', id).eq('igreja_id', igrejaId);
          if (error) throw error;
          return apiSuccess({ id }, { message: 'Conta atualizada.' });
        }

        const { data, error } = await supabaseAdmin
          .from('fin_contas')
          .insert({ ...dados, igreja_id: igrejaId })
          .select('id')
          .single();
        if (error) throw error;
        return apiSuccess({ id: data.id }, { status: 201, message: 'Conta criada.' });
      }

      case 'salvar_categoria': {
        if (!permissoes.podeConfigurar) return apiError('FORBIDDEN', 403, 'Sem permissão para configurar categorias.');
        const nome = texto(body.nome);
        const grupo = String(body.grupo) as GrupoIpb;
        if (!nome) return apiError('CATEGORY_NAME_REQUIRED', 400, 'Dê um nome à categoria.');
        if (!GRUPOS_IPB[grupo]) return apiError('CATEGORY_GROUP_INVALID', 400, 'Escolha o grupo do relatório da IPB.');
        const tipo = GRUPOS_IPB[grupo].tipo;
        const dados = {
          nome,
          grupo,
          tipo,
          nominal: tipo === 'receita' && body.nominal === true,
          ativo: body.ativo !== false,
        };
        const id = texto(body.id, 40);

        if (id) {
          const { data: atual } = await supabaseAdmin
            .from('fin_categorias')
            .select('grupo')
            .eq('id', id)
            .eq('igreja_id', igrejaId)
            .maybeSingle();
          if (!atual) return apiError('CATEGORY_NOT_FOUND', 404, 'Categoria não encontrada.');

          if (atual.grupo !== grupo) {
            const { count } = await supabaseAdmin
              .from('fin_lancamentos')
              .select('*', { count: 'exact', head: true })
              .eq('categoria_id', id);
            if ((count || 0) > 0) {
              return apiError('CATEGORY_IN_USE', 409, 'Esta categoria já tem lançamentos; o grupo não pode mudar. Crie outra categoria.');
            }
          }

          const { error } = await supabaseAdmin.from('fin_categorias').update(dados).eq('id', id).eq('igreja_id', igrejaId);
          if (error) throw error;
          return apiSuccess({ id }, { message: 'Categoria atualizada.' });
        }

        const { data, error } = await supabaseAdmin
          .from('fin_categorias')
          .insert({ ...dados, igreja_id: igrejaId, ordem: 100 })
          .select('id')
          .single();
        if (error) throw error;
        return apiSuccess({ id: data.id }, { status: 201, message: 'Categoria criada.' });
      }

      case 'adicionar_equipe': {
        if (!permissoes.podeDesignarEquipe) {
          return apiError('FORBIDDEN', 403, 'Só o Conselho (pastor, presbíteros ou administração) designa a equipe.');
        }
        const pessoaId = texto(body.pessoa_id, 40);
        const papel = String(body.papel) as PapelEquipe;
        const ano = Number(body.ano) || new Date().getFullYear();
        if (!pessoaId || !PAPEIS_EQUIPE[papel]) return apiError('TEAM_INVALID', 400, 'Escolha a pessoa e a função.');

        const { data: vinculo } = await supabaseAdmin
          .from('pessoas_igrejas')
          .select('pessoa_id')
          .eq('igreja_id', igrejaId)
          .eq('pessoa_id', pessoaId)
          .limit(1)
          .maybeSingle();
        if (!vinculo) return apiError('TEAM_PERSON_INVALID', 400, 'Esta pessoa não pertence à igreja.');

        if (papel === 'comissao') {
          const { count } = await supabaseAdmin
            .from('fin_equipe')
            .select('*', { count: 'exact', head: true })
            .eq('igreja_id', igrejaId)
            .eq('ano', ano)
            .eq('papel', 'comissao');
          if ((count || 0) >= 3) {
            return apiError('TEAM_COMMITTEE_FULL', 409, 'A Comissão de Exame de Contas tem 3 membros (modelo de estatuto, art. 11).');
          }
        }

        const { error } = await supabaseAdmin
          .from('fin_equipe')
          .upsert({ igreja_id: igrejaId, pessoa_id: pessoaId, papel, ano }, { onConflict: 'igreja_id,pessoa_id,papel,ano' });
        if (error) throw error;
        return apiSuccess({ ok: true }, { message: 'Equipe atualizada.' });
      }

      case 'remover_equipe': {
        if (!permissoes.podeDesignarEquipe) {
          return apiError('FORBIDDEN', 403, 'Só o Conselho (pastor, presbíteros ou administração) designa a equipe.');
        }
        const id = texto(body.id, 40);
        const { error } = await supabaseAdmin.from('fin_equipe').delete().eq('id', id || '').eq('igreja_id', igrejaId);
        if (error) throw error;
        return apiSuccess({ ok: true }, { message: 'Removido da equipe.' });
      }

      default:
        return apiError('ACTION_INVALID', 400, 'Ação inválida.');
    }
  } catch (error: any) {
    console.error('Erro na configuração financeira:', error);
    return apiError('FINANCE_CONFIG_FAILED', 500, 'Não foi possível salvar a configuração.');
  }
}
