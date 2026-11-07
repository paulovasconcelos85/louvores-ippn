import { describe, expect, it } from 'vitest';
import {
  centavos,
  criarFormatadorMoeda,
  intervaloDoPeriodo,
  lerValorDigitado,
  nomeDoPeriodo,
  trimestreDe,
  valorDaMascara,
} from '@/lib/financas';

describe('centavos', () => {
  it('arredonda reais para centavos', () => {
    expect(centavos(12.5)).toBe(1250);
    expect(centavos('0.1')).toBe(10);
    expect(centavos(0.1 + 0.2)).toBe(30);
  });

  it('trata vazio e inválido como zero', () => {
    expect(centavos(null)).toBe(0);
    expect(centavos(undefined)).toBe(0);
    expect(centavos('abc')).toBe(0);
  });
});

describe('lerValorDigitado', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 50', 5000],
    ['50,5', 5050],
    ['1234.56', 123456],
    ['1,234.56', 123456],
    ['12.50', 1250],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['1.234.567,89', 123456789],
    ['', 0],
    ['abc', 0],
  ])('"%s" → %i centavos', (texto, esperado) => {
    expect(lerValorDigitado(texto)).toBe(esperado);
  });
});

describe('trimestreDe', () => {
  it.each([
    ['2026-01-01', 1],
    ['2026-03-31', 1],
    ['2026-04-01', 2],
    ['2026-09-30', 3],
    ['2026-12-31', 4],
  ])('%s → %i', (data, trimestre) => {
    expect(trimestreDe(data)).toBe(trimestre);
  });
});

describe('intervaloDoPeriodo', () => {
  it('período 0 é o exercício inteiro', () => {
    expect(intervaloDoPeriodo(2026, 0)).toEqual({ inicio: '2026-01-01', fim: '2026-12-31' });
  });

  it('calcula o último dia de cada trimestre', () => {
    expect(intervaloDoPeriodo(2026, 1)).toEqual({ inicio: '2026-01-01', fim: '2026-03-31' });
    expect(intervaloDoPeriodo(2026, 2)).toEqual({ inicio: '2026-04-01', fim: '2026-06-30' });
    expect(intervaloDoPeriodo(2026, 3)).toEqual({ inicio: '2026-07-01', fim: '2026-09-30' });
    expect(intervaloDoPeriodo(2026, 4)).toEqual({ inicio: '2026-10-01', fim: '2026-12-31' });
  });

  it('nomeia o período', () => {
    expect(nomeDoPeriodo(0)).toBe('Exercício completo');
    expect(nomeDoPeriodo(3)).toBe('3º trimestre');
  });
});

describe('valorDaMascara', () => {
  const brl = criarFormatadorMoeda('BR');
  const eur = criarFormatadorMoeda('PT');

  /** Simula digitar tecla a tecla no fim do campo, como o CampoValor exibe. */
  function digitar(moeda: (c: number) => string, teclas: string[], permitirNegativo = false) {
    let exibido = '';
    for (const tecla of teclas) {
      const novo = tecla === '⌫' ? exibido.slice(0, -1) : exibido + tecla;
      const valor = valorDaMascara(exibido, novo, permitirNegativo);
      exibido = valor === null ? '' : moeda(valor);
    }
    return exibido ? lerValorDigitado(exibido) : null;
  }

  it('dígitos entram pela direita', () => {
    expect(digitar(brl, ['1'])).toBe(1);
    expect(digitar(brl, ['1', '2', '3', '4', '5'])).toBe(12345);
    expect(digitar(brl, ['1', '2', '3', '4', '5', '6', '7'])).toBe(1234567);
  });

  it('o texto formatado volta aos mesmos centavos em várias moedas', () => {
    for (const pais of ['BR', 'PT', 'ES', 'US', 'CA', 'AO', 'MZ', 'AR', 'MX']) {
      expect(digitar(criarFormatadorMoeda(pais), ['9', '8', '7', '6', '5', '4'])).toBe(987654);
      expect(digitar(criarFormatadorMoeda(pais), ['5', '0', '-'], true)).toBe(-50);
    }
  });

  it('apagar remove o último dígito, mesmo com o símbolo no fim (€)', () => {
    expect(digitar(brl, ['1', '2', '3', '⌫'])).toBe(12);
    expect(digitar(eur, ['1', '2', '3', '⌫'])).toBe(12);
    expect(digitar(brl, ['1', '⌫'])).toBeNull();
  });

  it('ignora letras e zeros à esquerda', () => {
    expect(digitar(brl, ['a', '0', '0', '5'])).toBe(5);
  });

  it('"-" alterna o sinal só quando permitido', () => {
    expect(digitar(brl, ['5', '0', '-'], true)).toBe(-50);
    expect(digitar(brl, ['5', '0', '-', '-'], true)).toBe(50);
    expect(digitar(brl, ['5', '-', '0'], true)).toBe(-50);
    expect(digitar(brl, ['5', '0', '-'])).toBe(50);
  });

  it('limita a 12 dígitos', () => {
    expect(digitar(brl, Array(15).fill('9'))).toBe(999999999999);
  });
});
