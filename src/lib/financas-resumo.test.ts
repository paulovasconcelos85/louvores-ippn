import { describe, expect, it } from 'vitest';
import { resumirBase, type BaseFinanceira } from '@/lib/financas-resumo';

const contas: BaseFinanceira['contas'] = [
  { id: 'caixa', nome: 'Caixa', saldo_inicial: 100, data_saldo_inicial: '2026-01-01' },
  { id: 'banco', nome: 'Banco', saldo_inicial: 1000, data_saldo_inicial: '2026-01-01' },
];

const categorias: BaseFinanceira['categorias'] = [
  { id: 'dizimos', nome: 'Dízimos', tipo: 'receita', grupo: 'dizimos_ofertas' },
  { id: 'ofertas', nome: 'Ofertas', tipo: 'receita', grupo: 'dizimos_ofertas' },
  { id: 'doacao', nome: 'Doação específica', tipo: 'receita', grupo: 'especificas_outras' },
  { id: 'energia', nome: 'Energia', tipo: 'despesa', grupo: 'causas_locais' },
  { id: 'sc', nome: 'Dízimo ao SC', tipo: 'despesa', grupo: 'dizimo_sc' },
];

type Lancamento = BaseFinanceira['lancamentos'][number];

function lanc(parcial: Partial<Lancamento> & Pick<Lancamento, 'tipo' | 'data' | 'valor'>): Lancamento {
  return { conta_id: 'banco', conta_destino_id: null, categoria_id: null, ...parcial };
}

const lancamentos: Lancamento[] = [
  // 1º trimestre
  lanc({ tipo: 'receita', data: '2026-02-01', valor: 500, categoria_id: 'dizimos' }),
  lanc({ tipo: 'despesa', data: '2026-03-10', valor: 80, categoria_id: 'energia' }),
  // 2º trimestre
  lanc({ tipo: 'receita', data: '2026-04-05', valor: 1000, categoria_id: 'dizimos' }),
  lanc({ tipo: 'receita', data: '2026-04-05', valor: 200.5, categoria_id: 'ofertas', conta_id: 'caixa' }),
  lanc({ tipo: 'receita', data: '2026-05-01', valor: 300, categoria_id: 'doacao' }),
  lanc({ tipo: 'despesa', data: '2026-05-20', valor: 150.25, categoria_id: 'energia' }),
  lanc({ tipo: 'despesa', data: '2026-06-30', valor: 120.05, categoria_id: 'sc' }),
  lanc({ tipo: 'transferencia', data: '2026-06-01', valor: 50, conta_id: 'caixa', conta_destino_id: 'banco' }),
  // 3º trimestre: fica fora do resumo do 2º
  lanc({ tipo: 'receita', data: '2026-07-01', valor: 9999, categoria_id: 'dizimos' }),
];

const base: BaseFinanceira = { contas, categorias, lancamentos };

describe('resumirBase', () => {
  const resumo = resumirBase(base, '2026-04-01', '2026-06-30');
  const conta = (id: string) => resumo.contas.find((c) => c.id === id)!;

  it('leva o movimento anterior ao período para o saldo anterior', () => {
    // Banco: 1000 + 500 - 80
    expect(conta('banco').saldoAnterior).toBe(142000);
    expect(conta('caixa').saldoAnterior).toBe(10000);
    expect(resumo.saldoAnterior).toBe(152000);
  });

  it('soma entradas e saídas por conta, com transferências', () => {
    expect(conta('banco').entradas).toBe(100000 + 30000 + 5000);
    expect(conta('banco').saidas).toBe(15025 + 12005);
    expect(conta('caixa').entradas).toBe(20050);
    expect(conta('caixa').saidas).toBe(5000);
  });

  it('ignora lançamentos depois do fim do período', () => {
    expect(resumo.categorias.find((c) => c.id === 'dizimos')!.total).toBe(100000);
  });

  it('transferência não conta como receita nem despesa', () => {
    expect(resumo.totalReceitas).toBe(100000 + 20050 + 30000);
    expect(resumo.totalDespesas).toBe(15025 + 12005);
  });

  it('fecha: saldo anterior + receitas - despesas = saldo final', () => {
    expect(resumo.saldoFinal).toBe(resumo.saldoAnterior + resumo.totalReceitas - resumo.totalDespesas);
    for (const c of resumo.contas) {
      expect(c.saldoFinal).toBe(c.saldoAnterior + c.entradas - c.saidas);
    }
  });

  it('dízimo ao SC devido é 10% só de dízimos e ofertas', () => {
    expect(resumo.grupos.dizimos_ofertas).toBe(120050);
    expect(resumo.dizimoScDevido).toBe(12005);
    expect(resumo.dizimoScPago).toBe(12005);
  });

  it('saldo de implantação entra como saldo anterior também no 1º período', () => {
    const primeiro = resumirBase(base, '2026-01-01', '2026-03-31');
    expect(primeiro.saldoAnterior).toBe(110000);
    expect(primeiro.saldoFinal).toBe(110000 + 50000 - 8000);
  });

  it('conta implantada depois do fim do período não tem saldo', () => {
    const resumoAntigo = resumirBase(
      { ...base, contas: [{ ...contas[0], data_saldo_inicial: '2027-01-01' }] },
      '2026-01-01',
      '2026-12-31'
    );
    expect(resumoAntigo.contas[0].saldoAnterior).toBe(0);
  });
});
