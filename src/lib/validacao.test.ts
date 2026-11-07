import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  dataOpcional,
  lerCorpo,
  listaDeTextos,
  numeroOpcional,
  textoObrigatorio,
  textoOpcional,
} from '@/lib/validacao';

const schema = z.object({
  nome: textoObrigatorio(5, 'Nome é obrigatório.'),
  obs: textoOpcional(3),
});

function req(body: string) {
  return new Request('http://localhost/api', { method: 'POST', body });
}

describe('lerCorpo', () => {
  it('apara, corta e converte vazio em null', async () => {
    const { data } = await lerCorpo(req(JSON.stringify({ nome: '  Paulo Vasconcelos ', obs: '   ' })), schema);
    expect(data).toEqual({ nome: 'Paulo', obs: null });
  });

  it('ignora tipos errados nos opcionais', async () => {
    const { data } = await lerCorpo(req(JSON.stringify({ nome: 'Ana', obs: 42 })), schema);
    expect(data).toEqual({ nome: 'Ana', obs: null });
  });

  it('responde 400 com a mensagem do schema', async () => {
    const { error } = await lerCorpo(req(JSON.stringify({ nome: '   ' })), schema);
    expect(error?.status).toBe(400);
    expect(await error?.json()).toEqual({ error: 'Nome é obrigatório.' });
  });

  it('responde 400 para JSON inválido', async () => {
    const { error } = await lerCorpo(req('{nao é json'), schema);
    expect(error?.status).toBe(400);
  });
});

describe('dataOpcional', () => {
  it.each([
    ['2026-02-28', '2026-02-28'],
    ['2024-02-29', '2024-02-29'],
    ['2026-02-30', null],
    ['2026-13-01', null],
    ['28/02/2026', null],
    ['', null],
    [42, null],
  ])('%s → %s', (entrada, esperado) => {
    expect(dataOpcional().parse(entrada)).toBe(esperado);
  });
});

describe('numeroOpcional', () => {
  it('aceita só número finito no intervalo', () => {
    const lat = numeroOpcional(-90, 90);
    expect(lat.parse(-3.1)).toBe(-3.1);
    expect(lat.parse(91)).toBeNull();
    expect(lat.parse('-3.1')).toBeNull();
    expect(lat.parse(Number.NaN)).toBeNull();
  });
});

describe('listaDeTextos', () => {
  it('filtra, apara e limita a lista', () => {
    const lista = listaDeTextos(2, 4);
    expect(lista.parse([' abcdef ', 3, '', 'x', 'y'])).toEqual(['abcd', 'x']);
    expect(lista.parse([])).toBeNull();
    expect(lista.parse('abc')).toBeNull();
  });
});
