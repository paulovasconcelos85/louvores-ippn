import { NextResponse } from 'next/server';
import { z } from 'zod';

// Validação de corpo de requisição com Zod, para as rotas de API.

/** Texto opcional: aparado, vazio vira null, cortado em `max` caracteres. */
export function textoOpcional(max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().slice(0, max) || null : null),
    z.string().nullable()
  );
}

/** Texto obrigatório: aparado e cortado em `max`; vazio ou ausente é erro. */
export function textoObrigatorio(max: number, mensagem: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().slice(0, max) : ''),
    z.string().min(1, mensagem)
  );
}

/** Data ISO (AAAA-MM-DD) válida; qualquer outra coisa vira null. */
export function dataOpcional() {
  return z.preprocess((value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const data = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(value) ? value : null;
  }, z.string().nullable());
}

/** Número finito dentro do intervalo; qualquer outra coisa vira null. */
export function numeroOpcional(min: number, max: number) {
  return z.preprocess(
    (value) => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null),
    z.number().nullable()
  );
}

/** Lista de textos não vazios (até `maxItens`, cada um até `max`); vazia vira null. */
export function listaDeTextos(maxItens: number, max: number) {
  return z.preprocess((value) => {
    if (!Array.isArray(value)) return null;
    const itens = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().slice(0, max))
      .filter(Boolean)
      .slice(0, maxItens);
    return itens.length ? itens : null;
  }, z.array(z.string()).nullable());
}

/**
 * Lê o JSON do corpo e valida com o schema. Em caso de erro devolve a resposta
 * 400 pronta, com a primeira mensagem do schema.
 */
export async function lerCorpo<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 }) };
  }

  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const mensagem = result.error.issues[0]?.message || 'Dados inválidos.';
    return { error: NextResponse.json({ error: mensagem }, { status: 400 }) };
  }

  return { data: result.data };
}
