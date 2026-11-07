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
