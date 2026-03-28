export interface IgrejaSelecionavel {
  id: string;
  nome: string;
  sigla: string | null;
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  ativa: boolean;
}

type IgrejaRaw = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeIgreja(raw: IgrejaRaw): IgrejaSelecionavel | null {
  const id = asString(raw.id);
  if (!id) return null;

  return {
    id,
    nome:
      asString(raw.nome) ||
      asString(raw.razao_social) ||
      asString(raw.nome_fantasia) ||
      asString(raw.sigla) ||
      'Igreja sem nome',
    sigla: asString(raw.sigla),
    cidade: asString(raw.cidade) || asString(raw.municipio),
    regiao:
      asString(raw.uf) ||
      asString(raw.estado) ||
      asString(raw.provincia) ||
      asString(raw.regiao),
    pais: asString(raw.pais) || 'Brasil',
    ativa: asBoolean(raw.ativo, true),
  };
}

export function formatIgrejaLocalizacao(igreja: IgrejaSelecionavel) {
  return [igreja.cidade, igreja.regiao, igreja.pais].filter(Boolean).join(', ');
}
