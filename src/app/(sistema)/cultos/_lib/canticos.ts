import type { Cantico, LiturgiaChurchConfig } from './tipos';

export const TONS_MUSICAIS_VALIDOS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
] as const;

export function normalizeTomMusicalForSave(value: string | null | undefined) {
  const tom = value?.trim();
  if (!tom) return null;

  return (TONS_MUSICAIS_VALIDOS as readonly string[]).includes(tom) ? tom : null;
}

export function mapHinarioNovoCanticoToCantico(
  item: {
    id: string | number;
    numero: string | null;
    titulo: string | null;
    letra?: string | null;
  }
): Cantico {
  return {
    id: String(item.id),
    numero: item.numero || null,
    nome: item.titulo?.trim() || 'Hino sem título',
    tipo: 'hinario',
    letra: item.letra ?? null,
  };
}

function normalizeCanticoSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCanticoDisplayLabel(cantico: Cantico | null | undefined) {
  if (!cantico) return '';
  return cantico.tipo === 'hinario' && cantico.numero
    ? `Hino ${cantico.numero} · ${cantico.nome}`
    : cantico.nome;
}

export function getCanticoInlineReference(cantico: Cantico) {
  if (cantico.tipo === 'hinario' && cantico.numero) {
    return `Hino ${cantico.nome} (${cantico.numero})`;
  }

  return `Cântico: ${cantico.nome}`;
}

export function getRepertorioTextos(canticos: Cantico[]) {
  const temHinos = canticos.some((cantico) => cantico.tipo === 'hinario');
  const temCanticos = canticos.some((cantico) => cantico.tipo !== 'hinario');

  if (temHinos && !temCanticos) {
    return {
      rotuloPlural: 'Hinos',
      rotuloSingular: 'hino',
      placeholderBusca: 'Buscar hino...',
      tituloBuscaNome: 'Buscar hino por nome',
      ajudaPublico:
        'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome ou <strong>#</strong> para buscar por número de hino. Se não precisar mostrar nada neste item, deixe em branco.',
      placeholderPublico:
        'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ ou # para inserir um hino',
      descricaoSecaoComCadastro:
        'Adicione aqui os hinos ligados a esta etapa. Você pode buscar um já disponível no hinário e, se precisar, informar o tom.',
      descricaoSecaoSemCadastro:
        'Adicione aqui os hinos ligados a esta etapa. Você pode buscar um já disponível no hinário e, se precisar, informar o tom.',
      acaoAdicionar: 'Adicionar hino',
      aceitaBuscaPorNumero: true,
    };
  }

  if (!temHinos && temCanticos) {
    return {
      rotuloPlural: 'Cânticos',
      rotuloSingular: 'cântico',
      placeholderBusca: 'Buscar cântico...',
      tituloBuscaNome: 'Buscar cântico por nome',
      ajudaPublico:
        'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome do cântico. Se não precisar mostrar nada neste item, deixe em branco.',
      placeholderPublico:
        'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ para inserir um cântico',
      descricaoSecaoComCadastro:
        'Adicione aqui os cânticos ligados a esta etapa. Você pode buscar um já cadastrado, criar um novo e, se precisar, informar o tom.',
      descricaoSecaoSemCadastro:
        'Adicione aqui os cânticos ligados a esta etapa. Você pode buscar um já cadastrado e, se precisar, informar o tom.',
      acaoAdicionar: 'Adicionar cântico',
      aceitaBuscaPorNumero: false,
    };
  }

  return {
    rotuloPlural: 'Repertório',
    rotuloSingular: 'item do repertório',
    placeholderBusca: 'Buscar item do repertório...',
    tituloBuscaNome: 'Buscar hino ou cântico por nome',
    ajudaPublico:
      'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome ou <strong>#</strong> para buscar por número de hino. Se não precisar mostrar nada neste item, deixe em branco.',
    placeholderPublico:
      'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ ou # para inserir um hino/cântico',
    descricaoSecaoComCadastro:
      'Adicione aqui os itens musicais ligados a esta etapa. Você pode buscar um já cadastrado, criar um novo e, se precisar, informar o tom.',
    descricaoSecaoSemCadastro:
      'Adicione aqui os itens musicais ligados a esta etapa. Você pode buscar um já cadastrado e, se precisar, informar o tom.',
    acaoAdicionar: 'Adicionar item musical',
    aceitaBuscaPorNumero: true,
  };
}

export function matchesCanticoQuery(cantico: Cantico, query: string) {
  const termo = normalizeCanticoSearchTerm(query);
  if (!termo) return true;

  const termoCompacto = termo.replace(/[^a-z0-9]/g, '');
  const numero = cantico.numero?.trim() || '';
  const numeroSemZeros = numero.replace(/^0+/, '') || numero;
  const candidatos = [
    cantico.nome,
    getCanticoDisplayLabel(cantico),
    numero,
    numeroSemZeros,
    numero ? `hino ${numero}` : '',
    numeroSemZeros ? `hino ${numeroSemZeros}` : '',
  ]
    .filter(Boolean)
    .map((valor) => normalizeCanticoSearchTerm(valor));

  return candidatos.some((valor) => {
    if (valor.includes(termo)) return true;
    return valor.replace(/[^a-z0-9]/g, '').includes(termoCompacto);
  });
}

export function normalizeModoRepertorio(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function filtrarCanticosPorConfiguracao(
  canticos: Cantico[],
  configuracao: Pick<LiturgiaChurchConfig, 'modoRepertorio' | 'permiteCadastroCanticos'> | null
) {
  const modoRepertorio = normalizeModoRepertorio(configuracao?.modoRepertorio);
  let lista = [...canticos];

  if (modoRepertorio === 'hinario') {
    // Hinos sem letra já vêm excluídos pela consulta (ver consultarHinario).
    lista = lista.filter((cantico) => cantico.tipo === 'hinario');
  } else if (modoRepertorio === 'livre' || modoRepertorio === 'canticos') {
    lista = lista.filter((cantico) => cantico.tipo !== 'hinario');
  }

  return lista;
}
