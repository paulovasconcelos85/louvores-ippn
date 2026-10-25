import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro } from '@/lib/financas-server';
import { intervaloDoPeriodo } from '@/lib/financas';

// Exame de contas (modelo de estatuto da IPB, art. 11): o tesoureiro entrega o
// balancete de cada trimestre e do exercício; a comissão examina e dá parecer;
// o Conselho aprova. Enviado = período travado para edição.
//
// GET  ?igreja_id&ano                      -> situação dos 4 trimestres e do exercício
// POST { igreja_id, ano, periodo, acao, parecer?, observacoes?, ata? }
//      acao: enviar | parecer | devolver | aprovar | reabrir

type Status = 'aberto' | 'enviado' | 'devolvido' | 'parecer' | 'aprovado';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ctx = await contextoFinanceiro(request, params.get('igreja_id'));
  if (ctx.error) return ctx.error;
  const ano = Number(params.get('ano'));
  if (!ano) return apiError('YEAR_REQUIRED', 400, 'Informe o ano.');

  try {
    const { data, error } = await ctx.supabaseAdmin
      .from('fin_exames')
      .select('*')
      .eq('igreja_id', ctx.igrejaId)
      .eq('ano', ano);
    if (error) throw error;

    const porPeriodo = new Map((data || []).map((item) => [item.periodo, item]));
    const exames = [1, 2, 3, 4, 0].map((periodo) => ({
      ...(porPeriodo.get(periodo) || { status: 'aberto' as Status, parecer: null, observacoes: null }),
      ano,
      periodo,
      ...intervaloDoPeriodo(ano, periodo),
    }));

    return apiSuccess({ exames });
  } catch (error: any) {
    console.error('Erro ao carregar exames de contas:', error);
    return apiError('EXAMS_LOAD_FAILED', 500, 'Não foi possível carregar o exame de contas.');
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('INVALID_BODY', 400, 'Dados inválidos.');
  }

  const ctx = await contextoFinanceiro(request, typeof body.igreja_id === 'string' ? body.igreja_id : null);
  if (ctx.error) return ctx.error;
  const { permissoes, supabaseAdmin, igrejaId, user } = ctx;

  const ano = Number(body.ano);
  const periodo = Number(body.periodo);
  if (!ano || !Number.isInteger(periodo) || periodo < 0 || periodo > 4) {
    return apiError('PERIOD_INVALID', 400, 'Período inválido.');
  }

  const observacoes = typeof body.observacoes === 'string' ? body.observacoes.trim().slice(0, 2000) || null : null;
  const agora = new Date().toISOString();

  try {
    const { data: atual } = await supabaseAdmin
      .from('fin_exames')
      .select('status')
      .eq('igreja_id', igrejaId)
      .eq('ano', ano)
      .eq('periodo', periodo)
      .maybeSingle();
    const status: Status = (atual?.status as Status) || 'aberto';

    let mudanca: Record<string, unknown>;

    switch (body.acao) {
      case 'enviar': {
        if (!permissoes.podeLancar) return apiError('FORBIDDEN', 403, 'Só a tesouraria envia o balancete.');
        if (status !== 'aberto' && status !== 'devolvido') return apiError('EXAM_STATE', 409, 'Este balancete já foi enviado.');
        const { fim } = intervaloDoPeriodo(ano, periodo);
        if (new Date().toISOString().slice(0, 10) <= fim) {
          return apiError('PERIOD_NOT_ENDED', 409, 'O período ainda não terminou. Envie depois do último dia.');
        }
        mudanca = { status: 'enviado', enviado_em: agora, enviado_por: user.id, parecer: null, observacoes: null };
        break;
      }
      case 'parecer': {
        if (!permissoes.podeExaminar) return apiError('FORBIDDEN', 403, 'Só a Comissão de Exame de Contas emite parecer.');
        if (status !== 'enviado') return apiError('EXAM_STATE', 409, 'Não há balancete aguardando exame.');
        const parecer = String(body.parecer);
        if (!['favoravel', 'ressalvas', 'desfavoravel'].includes(parecer)) {
          return apiError('OPINION_INVALID', 400, 'Escolha o parecer.');
        }
        if (parecer !== 'favoravel' && !observacoes) {
          return apiError('OPINION_NOTES_REQUIRED', 400, 'Descreva as ressalvas ou os motivos do parecer.');
        }
        mudanca = { status: 'parecer', parecer, observacoes, examinado_em: agora, examinado_por: user.id };
        break;
      }
      case 'devolver': {
        if (!permissoes.podeExaminar) return apiError('FORBIDDEN', 403, 'Só a Comissão de Exame de Contas devolve o balancete.');
        if (status !== 'enviado') return apiError('EXAM_STATE', 409, 'Não há balancete aguardando exame.');
        if (!observacoes) return apiError('OPINION_NOTES_REQUIRED', 400, 'Diga o que precisa ser corrigido.');
        mudanca = { status: 'devolvido', observacoes, examinado_em: agora, examinado_por: user.id };
        break;
      }
      case 'aprovar': {
        if (!permissoes.podeAprovar) return apiError('FORBIDDEN', 403, 'Só o Conselho aprova o balancete.');
        if (status !== 'parecer') return apiError('EXAM_STATE', 409, 'O balancete precisa do parecer da comissão antes.');
        const ata = typeof body.ata === 'string' ? body.ata.trim().slice(0, 200) || null : null;
        mudanca = { status: 'aprovado', aprovado_em: agora, aprovado_por: user.id, ata_conselho: ata };
        break;
      }
      case 'reabrir': {
        if (!permissoes.podeAprovar) return apiError('FORBIDDEN', 403, 'Só o Conselho reabre um período.');
        if (status === 'aberto' || status === 'devolvido') return apiError('EXAM_STATE', 409, 'O período já está aberto.');
        mudanca = { status: 'aberto', parecer: null, aprovado_em: null, aprovado_por: null, observacoes };
        break;
      }
      default:
        return apiError('ACTION_INVALID', 400, 'Ação inválida.');
    }

    const { error } = await supabaseAdmin
      .from('fin_exames')
      .upsert({ igreja_id: igrejaId, ano, periodo, ...mudanca, atualizado_em: agora }, { onConflict: 'igreja_id,ano,periodo' });
    if (error) throw error;

    return apiSuccess({ ok: true }, { message: 'Exame de contas atualizado.' });
  } catch (error: any) {
    console.error('Erro no exame de contas:', error);
    return apiError('EXAM_SAVE_FAILED', 500, 'Não foi possível atualizar o exame de contas.');
  }
}
