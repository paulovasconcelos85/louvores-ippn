import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { lerCorpo, textoObrigatorio, textoOpcional } from '@/lib/validacao';

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
