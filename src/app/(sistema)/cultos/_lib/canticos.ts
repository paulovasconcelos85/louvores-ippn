import type { Locale } from '@/i18n/config';
import { porIdioma } from '@/i18n/por-idioma';
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
  },
  locale: Locale = 'pt'
): Cantico {
  return {
    id: String(item.id),
    numero: item.numero || null,
    nome: item.titulo?.trim() || porIdioma(locale, 'Hino sem título', 'Himno sin título', 'Untitled hymn'),
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

export function getCanticoDisplayLabel(cantico: Cantico | null | undefined, locale: Locale = 'pt') {
  if (!cantico) return '';
  return cantico.tipo === 'hinario' && cantico.numero
    ? `${porIdioma(locale, 'Hino', 'Himno', 'Hymn')} ${cantico.numero} · ${cantico.nome}`
    : cantico.nome;
}

// Vai para o texto público do boletim, que reconhece esses prefixos nos três
// idiomas para abrir a letra (ver extrairCanticoLinha em PublicBulletinClient).
export function getCanticoInlineReference(cantico: Cantico, locale: Locale = 'pt') {
  if (cantico.tipo === 'hinario' && cantico.numero) {
    return `${porIdioma(locale, 'Hino', 'Himno', 'Hymn')} ${cantico.nome} (${cantico.numero})`;
  }

  return `${porIdioma(locale, 'Cântico', 'Cántico', 'Song')}: ${cantico.nome}`;
}

export function getRepertorioTextos(canticos: Cantico[], locale: Locale = 'pt') {
  const tr = (pt: string, es: string, en: string) => porIdioma(locale, pt, es, en);
  const temHinos = canticos.some((cantico) => cantico.tipo === 'hinario');
  const temCanticos = canticos.some((cantico) => cantico.tipo !== 'hinario');

  if (temHinos && !temCanticos) {
    return {
      rotuloPlural: tr('Hinos', 'Himnos', 'Hymns'),
      rotuloSingular: tr('hino', 'himno', 'hymn'),
      placeholderBusca: tr('Buscar hino...', 'Buscar himno...', 'Search hymns...'),
      tituloBuscaNome: tr('Buscar hino por nome', 'Buscar himno por nombre', 'Search hymn by title'),
      ajudaPublico: tr(
        'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome ou <strong>#</strong> para buscar por número de hino. Se não precisar mostrar nada neste item, deixe em branco.',
        'Escribe aquí solo lo que puede aparecer para la iglesia en el boletín o en la publicación. Escribe <strong>@</strong> para buscar por nombre o <strong>#</strong> para buscar por número de himno. Si no necesitas mostrar nada en este elemento, déjalo en blanco.',
        'Only write here what the church may see in the bulletin or post. Type <strong>@</strong> to search by title or <strong>#</strong> to search by hymn number. Leave blank if nothing needs to show for this item.'
      ),
      placeholderPublico: tr(
        'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ ou # para inserir um hino',
        'Ej.: Tema del mensaje, lectura bíblica, llamado a la iglesia... Usa @ o # para insertar un himno',
        'E.g. sermon theme, Scripture reading, call to the church... Use @ or # to insert a hymn'
      ),
      descricaoSecaoComCadastro: tr(
        'Adicione aqui os hinos ligados a esta etapa. Você pode buscar um já disponível no hinário e, se precisar, informar o tom.',
        'Agrega aquí los himnos de esta parte. Puedes buscar uno del himnario y, si hace falta, indicar el tono.',
        'Add the hymns for this part here. Search the hymnal and set the key if needed.'
      ),
      descricaoSecaoSemCadastro: tr(
        'Adicione aqui os hinos ligados a esta etapa. Você pode buscar um já disponível no hinário e, se precisar, informar o tom.',
        'Agrega aquí los himnos de esta parte. Puedes buscar uno del himnario y, si hace falta, indicar el tono.',
        'Add the hymns for this part here. Search the hymnal and set the key if needed.'
      ),
      acaoAdicionar: tr('Adicionar hino', 'Agregar himno', 'Add hymn'),
      aceitaBuscaPorNumero: true,
    };
  }

  if (!temHinos && temCanticos) {
    return {
      rotuloPlural: tr('Cânticos', 'Cánticos', 'Songs'),
      rotuloSingular: tr('cântico', 'cántico', 'song'),
      placeholderBusca: tr('Buscar cântico...', 'Buscar cántico...', 'Search songs...'),
      tituloBuscaNome: tr('Buscar cântico por nome', 'Buscar cántico por nombre', 'Search song by title'),
      ajudaPublico: tr(
        'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome do cântico. Se não precisar mostrar nada neste item, deixe em branco.',
        'Escribe aquí solo lo que puede aparecer para la iglesia en el boletín o en la publicación. Escribe <strong>@</strong> para buscar por nombre del cántico. Si no necesitas mostrar nada en este elemento, déjalo en blanco.',
        'Only write here what the church may see in the bulletin or post. Type <strong>@</strong> to search songs by title. Leave blank if nothing needs to show for this item.'
      ),
      placeholderPublico: tr(
        'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ para inserir um cântico',
        'Ej.: Tema del mensaje, lectura bíblica, llamado a la iglesia... Usa @ para insertar un cántico',
        'E.g. sermon theme, Scripture reading, call to the church... Use @ to insert a song'
      ),
      descricaoSecaoComCadastro: tr(
        'Adicione aqui os cânticos ligados a esta etapa. Você pode buscar um já cadastrado, criar um novo e, se precisar, informar o tom.',
        'Agrega aquí los cánticos de esta parte. Puedes buscar uno ya registrado, crear uno nuevo y, si hace falta, indicar el tono.',
        'Add the songs for this part here. Search existing songs or create a new one, and set the key if needed.'
      ),
      descricaoSecaoSemCadastro: tr(
        'Adicione aqui os cânticos ligados a esta etapa. Você pode buscar um já cadastrado e, se precisar, informar o tom.',
        'Agrega aquí los cánticos de esta parte. Puedes buscar uno ya registrado y, si hace falta, indicar el tono.',
        'Add the songs for this part here. Search existing songs and set the key if needed.'
      ),
      acaoAdicionar: tr('Adicionar cântico', 'Agregar cántico', 'Add song'),
      aceitaBuscaPorNumero: false,
    };
  }

  return {
    rotuloPlural: tr('Repertório', 'Repertorio', 'Songs'),
    rotuloSingular: tr('item do repertório', 'elemento del repertorio', 'song'),
    placeholderBusca: tr('Buscar item do repertório...', 'Buscar en el repertorio...', 'Search songs and hymns...'),
    tituloBuscaNome: tr('Buscar hino ou cântico por nome', 'Buscar himno o cántico por nombre', 'Search hymn or song by title'),
    ajudaPublico: tr(
      'Escreva aqui somente o que pode aparecer para a igreja no boletim ou na publicação. Digite <strong>@</strong> para buscar por nome ou <strong>#</strong> para buscar por número de hino. Se não precisar mostrar nada neste item, deixe em branco.',
      'Escribe aquí solo lo que puede aparecer para la iglesia en el boletín o en la publicación. Escribe <strong>@</strong> para buscar por nombre o <strong>#</strong> para buscar por número de himno. Si no necesitas mostrar nada en este elemento, déjalo en blanco.',
      'Only write here what the church may see in the bulletin or post. Type <strong>@</strong> to search by title or <strong>#</strong> to search by hymn number. Leave blank if nothing needs to show for this item.'
    ),
    placeholderPublico: tr(
      'Ex.: Tema da mensagem, leitura bíblica, chamada para a igreja... Use @ ou # para inserir um hino/cântico',
      'Ej.: Tema del mensaje, lectura bíblica, llamado a la iglesia... Usa @ o # para insertar un himno/cántico',
      'E.g. sermon theme, Scripture reading, call to the church... Use @ or # to insert a hymn or song'
    ),
    descricaoSecaoComCadastro: tr(
      'Adicione aqui os itens musicais ligados a esta etapa. Você pode buscar um já cadastrado, criar um novo e, se precisar, informar o tom.',
      'Agrega aquí la música de esta parte. Puedes buscar un elemento ya registrado, crear uno nuevo y, si hace falta, indicar el tono.',
      'Add the music for this part here. Search existing items or create a new one, and set the key if needed.'
    ),
    descricaoSecaoSemCadastro: tr(
      'Adicione aqui os itens musicais ligados a esta etapa. Você pode buscar um já cadastrado e, se precisar, informar o tom.',
      'Agrega aquí la música de esta parte. Puedes buscar un elemento ya registrado y, si hace falta, indicar el tono.',
      'Add the music for this part here. Search existing items and set the key if needed.'
    ),
    acaoAdicionar: tr('Adicionar item musical', 'Agregar música', 'Add music'),
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
