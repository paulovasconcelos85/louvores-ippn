import { apiError } from '@/lib/api-response';
import { getUserPermissionContext } from '@/lib/server-church';
import { getSupabaseAdmin } from '@/lib/igreja-onboarding';
import { CATEGORIAS_PADRAO, trimestreDe, type FinPermissoes, type PapelEquipe } from '@/lib/financas';
import { resumirBase, type BaseFinanceira, type ResumoFinanceiro } from '@/lib/financas-resumo';

export { getSupabaseAdmin, resumirBase };
export type { ResumoFinanceiro };

const CARGOS_CONSELHO = ['pastor', 'presbitero', 'admin'];
const STATUS_TRAVADOS = ['enviado', 'parecer', 'aprovado'];

/**
 * Contexto de acesso às finanças de uma igreja. A equipe da tesouraria é
 * designada por igreja e por ano (fin_equipe); enquanto o Conselho não
 * designa a equipe do ano novo, vale a do ano anterior.
 */
export async function contextoFinanceiro(request: Request, igrejaId: string | null) {
  if (!igrejaId) {
    return { error: apiError('CHURCH_REQUIRED', 400, 'Informe a igreja.') };
  }

  const contexto = await getUserPermissionContext(igrejaId, request);
  if (!contexto?.user) {
    return { error: apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.') };
  }

  // getUserPermissionContext cai em outra igreja quando o usuário não tem vínculo com esta.
  if (!contexto.isSuperAdmin && contexto.igrejaId !== igrejaId) {
    return { error: apiError('FORBIDDEN', 403, 'Sem acesso às finanças desta igreja.') };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const pessoaId = contexto.acesso?.pessoa_id || null;
  const anoAtual = new Date().getFullYear();

  let papeis: PapelEquipe[] = [];
  if (pessoaId) {
    const [{ data: minhas }, { count: equipeDoAno }] = await Promise.all([
      supabaseAdmin
        .from('fin_equipe')
        .select('papel, ano')
        .eq('igreja_id', igrejaId)
        .eq('pessoa_id', pessoaId)
        .in('ano', [anoAtual, anoAtual - 1]),
      supabaseAdmin
        .from('fin_equipe')
        .select('*', { count: 'exact', head: true })
        .eq('igreja_id', igrejaId)
        .eq('ano', anoAtual),
    ]);
    const anoValido = (equipeDoAno || 0) > 0 ? anoAtual : anoAtual - 1;
    papeis = (minhas || []).filter((item) => item.ano === anoValido).map((item) => item.papel as PapelEquipe);
  }

  const cargo = contexto.cargo || '';
  const superAdmin = contexto.isSuperAdmin;
  const conselho = CARGOS_CONSELHO.includes(cargo);
  const podeLancar = superAdmin || papeis.includes('tesoureiro') || papeis.includes('auxiliar');
  const podeExaminar = superAdmin || papeis.includes('comissao');

  const permissoes: FinPermissoes = {
    podeLancar,
    podeVerNomes: podeLancar || cargo === 'pastor',
    podeExaminar,
    podeVer: podeLancar || conselho || podeExaminar,
    podeConfigurar: superAdmin || papeis.includes('tesoureiro') || cargo === 'pastor' || cargo === 'admin',
    podeDesignarEquipe: superAdmin || conselho,
    podeAprovar: superAdmin || conselho,
    papeis,
  };

  if (!permissoes.podeVer) {
    return { error: apiError('FORBIDDEN', 403, 'Sem acesso às finanças desta igreja.') };
  }

  return { user: contexto.user, pessoaId, igrejaId, permissoes, supabaseAdmin };
}

export async function garantirCategoriasPadrao(igrejaId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { count, error } = await supabaseAdmin
    .from('fin_categorias')
    .select('*', { count: 'exact', head: true })
    .eq('igreja_id', igrejaId);
  if (error) throw error;
  if ((count || 0) > 0) return;

  const { error: insertError } = await supabaseAdmin.from('fin_categorias').insert(
    CATEGORIAS_PADRAO.map((categoria, index) => ({
      igreja_id: igrejaId,
      nome: categoria.nome,
      tipo: categoria.tipo,
      grupo: categoria.grupo,
      nominal: categoria.nominal ?? false,
      ordem: index + 1,
    }))
  );
  if (insertError) throw insertError;
}

/** Períodos enviados à comissão ficam travados para edição (estatuto, art. 11). */
export async function periodosTravados(igrejaId: string, anos: number[]) {
  if (anos.length === 0) return new Set<string>();
  const { data, error } = await getSupabaseAdmin()
    .from('fin_exames')
    .select('ano, periodo, status')
    .eq('igreja_id', igrejaId)
    .in('ano', [...new Set(anos)])
    .in('status', STATUS_TRAVADOS);
  if (error) throw error;
  return new Set((data || []).map((item) => `${item.ano}-${item.periodo}`));
}

export function dataTravada(travados: Set<string>, data: string) {
  const ano = Number(data.slice(0, 4));
  return travados.has(`${ano}-${trimestreDe(data)}`) || travados.has(`${ano}-0`);
}

/** Contas, categorias e lançamentos até `ate`, carregados uma vez para vários resumos. */
export async function carregarBase(igrejaId: string, ate: string): Promise<BaseFinanceira> {
  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: contas, error: contasError }, { data: categorias, error: catError }, lancamentos] = await Promise.all([
    supabaseAdmin
      .from('fin_contas')
      .select('id, nome, saldo_inicial, data_saldo_inicial, ordem')
      .eq('igreja_id', igrejaId)
      .order('ordem'),
    supabaseAdmin.from('fin_categorias').select('id, nome, tipo, grupo, ordem').eq('igreja_id', igrejaId).order('ordem'),
    buscarTodosLancamentos(igrejaId, ate),
  ]);
  if (contasError) throw contasError;
  if (catError) throw catError;

  return { contas: contas || [], categorias: (categorias || []) as BaseFinanceira['categorias'], lancamentos };
}

/** Valores em centavos. Transferências mexem nas contas, mas não em receitas e despesas. */
export async function calcularResumo(igrejaId: string, inicio: string, fim: string): Promise<ResumoFinanceiro> {
  return resumirBase(await carregarBase(igrejaId, fim), inicio, fim);
}

// O PostgREST devolve no máximo 1000 linhas por consulta; pagina até o fim.
async function buscarTodosLancamentos(igrejaId: string, ate: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const pagina = 1000;
  const todos: Array<{
    tipo: string;
    data: string;
    valor: number;
    conta_id: string;
    conta_destino_id: string | null;
    categoria_id: string | null;
  }> = [];

  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabaseAdmin
      .from('fin_lancamentos')
      .select('tipo, data, valor, conta_id, conta_destino_id, categoria_id')
      .eq('igreja_id', igrejaId)
      .lte('data', ate)
      .order('data')
      .order('id')
      .range(desde, desde + pagina - 1);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < pagina) break;
  }

  return todos;
}
