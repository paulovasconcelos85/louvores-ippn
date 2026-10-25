import { GRUPOS_IPB, centavos, type GrupoIpb } from '@/lib/financas';

// Cálculo puro do resumo financeiro (sem banco), usado por balancetes,
// relatório da IPB e exame de contas.

export interface BaseFinanceira {
  contas: Array<{ id: string; nome: string; saldo_inicial: number; data_saldo_inicial: string }>;
  categorias: Array<{ id: string; nome: string; tipo: 'receita' | 'despesa'; grupo: string }>;
  lancamentos: Array<{
    tipo: string;
    data: string;
    valor: number;
    conta_id: string;
    conta_destino_id: string | null;
    categoria_id: string | null;
  }>;
}

export interface ResumoFinanceiro {
  inicio: string;
  fim: string;
  contas: Array<{ id: string; nome: string; saldoAnterior: number; entradas: number; saidas: number; saldoFinal: number }>;
  categorias: Array<{ id: string; nome: string; tipo: 'receita' | 'despesa'; grupo: GrupoIpb; total: number }>;
  grupos: Record<GrupoIpb, number>;
  totalReceitas: number;
  totalDespesas: number;
  saldoAnterior: number;
  saldoFinal: number;
  /** 10% dos dízimos e ofertas do período (base do dízimo ao SC). */
  dizimoScDevido: number;
  dizimoScPago: number;
}

export function resumirBase(base: BaseFinanceira, inicio: string, fim: string): ResumoFinanceiro {
  const { contas, categorias } = base;
  const lancamentos = base.lancamentos.filter((item) => item.data <= fim);

  const porConta = new Map(
    contas.map((conta) => [
      conta.id,
      {
        id: conta.id,
        nome: conta.nome,
        // Saldo de implantação conta sempre como saldo anterior, para valer
        // saldo anterior + receitas - despesas = saldo final também no 1º ano de uso.
        saldoAnterior: conta.data_saldo_inicial <= fim ? centavos(conta.saldo_inicial) : 0,
        entradas: 0,
        saidas: 0,
        saldoFinal: 0,
      },
    ])
  );
  const porCategoria = new Map<string, number>();

  for (const item of lancamentos) {
    const valor = centavos(item.valor);
    const noPeriodo = item.data >= inicio;
    const origem = porConta.get(item.conta_id);
    const destino = item.conta_destino_id ? porConta.get(item.conta_destino_id) : undefined;

    const mover = (conta: typeof origem, delta: number) => {
      if (!conta) return;
      if (!noPeriodo) conta.saldoAnterior += delta;
      else if (delta >= 0) conta.entradas += delta;
      else conta.saidas += -delta;
    };

    if (item.tipo === 'receita') mover(origem, valor);
    if (item.tipo === 'despesa') mover(origem, -valor);
    if (item.tipo === 'transferencia') {
      mover(origem, -valor);
      mover(destino, valor);
    }

    if (noPeriodo && item.categoria_id) {
      porCategoria.set(item.categoria_id, (porCategoria.get(item.categoria_id) || 0) + valor);
    }
  }

  const grupos = Object.fromEntries(Object.keys(GRUPOS_IPB).map((g) => [g, 0])) as Record<GrupoIpb, number>;
  const categoriasResumo = categorias.map((categoria) => {
    const total = porCategoria.get(categoria.id) || 0;
    grupos[categoria.grupo as GrupoIpb] += total;
    return { id: categoria.id, nome: categoria.nome, tipo: categoria.tipo, grupo: categoria.grupo as GrupoIpb, total };
  });

  const contasResumo = [...porConta.values()].map((conta) => ({
    ...conta,
    saldoFinal: conta.saldoAnterior + conta.entradas - conta.saidas,
  }));

  const totalReceitas = grupos.dizimos_ofertas + grupos.especificas_outras;
  const totalDespesas = Object.entries(grupos)
    .filter(([grupo]) => GRUPOS_IPB[grupo as GrupoIpb].tipo === 'despesa')
    .reduce((soma, [, valor]) => soma + valor, 0);
  const saldoAnterior = contasResumo.reduce((soma, conta) => soma + conta.saldoAnterior, 0);

  return {
    inicio,
    fim,
    contas: contasResumo,
    categorias: categoriasResumo,
    grupos,
    totalReceitas,
    totalDespesas,
    saldoAnterior,
    saldoFinal: contasResumo.reduce((soma, conta) => soma + conta.saldoFinal, 0),
    dizimoScDevido: Math.round(grupos.dizimos_ofertas / 10),
    dizimoScPago: grupos.dizimo_sc,
  };
}

