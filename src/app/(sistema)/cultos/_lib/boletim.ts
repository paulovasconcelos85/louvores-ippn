import type { Locale } from '@/i18n/config';
import { compactLocalizedTextMap, createEmptyLocalizedTextMap, normalizeLocalizedTextMap, resolveLocalizedText, withPtFallback, type LocalizedTextMapForm } from '@/lib/church-i18n';
import { TIPOS_SECOES_BOLETIM, BOLETIM_FALLBACK_TIPO_PREFIX, LITURGIA_META_TIPO, type BoletimItemRascunho, type AgendaItemRascunho, type AvisoItemRascunho, type InformativoItemRascunho, type BoletimSecaoRascunho, type LouvorItemRow, type LouvorItemRowComCantico, type BoletimFallbackMeta, type StructuredBoletimSecaoRow, type StructuredBoletimItemRow, type ItemAgrupado } from './tipos';
import { isBoletimFallbackTipo, isLiturgiaMetaTipo, extrairTipoBoletimFallback, createDraftId } from './liturgia';

export function getBoletimTipoConfig(tipo: string) {
  return TIPOS_SECOES_BOLETIM.find((item) => item.tipo === tipo) || TIPOS_SECOES_BOLETIM[TIPOS_SECOES_BOLETIM.length - 1];
}

export function createEmptyBoletimItem(): BoletimItemRascunho {
  return {
    id: createDraftId('boletim-item'),
    conteudo: '',
    conteudo_i18n: createEmptyLocalizedTextMap(),
    destaque: false,
  };
}

export function createEmptyAgendaItem(): AgendaItemRascunho {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return {
    id: createDraftId('agenda-item'),
    data: `${yyyy}-${mm}-${dd}`,
    hora: '09:00',
    descricao: '',
    temHora: true,
    conteudo_i18n: createEmptyLocalizedTextMap(),
  };
}

export function createEmptyAvisoItem(): AvisoItemRascunho {
  return {
    id: createDraftId('aviso-item'),
    titulo: '',
    corpo: '',
    destaque: false,
    imagem_url: '',
    conteudo_i18n: createEmptyLocalizedTextMap(),
  };
}

export function createEmptyInformativoItem(): InformativoItemRascunho {
  return {
    id: createDraftId('informativo-item'),
    titulo: '',
    corpo: '',
    destaque: false,
    imagem_url: '',
    conteudo_i18n: createEmptyLocalizedTextMap(),
  };
}

export function updateLocalizedDraftValue(
  current: LocalizedTextMapForm | null | undefined,
  locale: Locale,
  value: string
) {
  const next: LocalizedTextMapForm = {
    ...createEmptyLocalizedTextMap(),
    ...(current || {}),
    [locale]: value,
  };

  // A coluna legada plana (`conteudo`, `titulo`, ...) é sempre derivada do
  // slot `pt`. Se ainda não houver texto em PT, espelhamos o que o usuário
  // está digitando no locale atual para manter as duas colunas em sincronia
  // — caso contrário a coluna plana acabaria contendo texto em EN/ES.
  if (locale !== 'pt' && !next.pt.trim()) {
    next.pt = value;
  }

  return next;
}

export function replicateLocalizedDraftValue(value: string): LocalizedTextMapForm {
  return {
    pt: value,
    es: value,
    en: value,
  };
}

export function normalizarSecoesBoletim(secoes: BoletimSecaoRascunho[]) {
  return secoes.map((secao, index) => ({
    ...secao,
    ordem: index,
  }));
}

export function clonarSecoesBoletimRascunho(secoes: BoletimSecaoRascunho[]) {
  return normalizarSecoesBoletim(
    secoes.map((secao) => ({
      ...secao,
      id: createDraftId('secao-boletim'),
      itens: secao.itens.map((item) => ({
        ...item,
        id: createDraftId('boletim-item'),
      })),
    }))
  );
}

export function parseAgendaConteudo(conteudo: string): AgendaItemRascunho {
  const partes = conteudo.split('|');
  const [dataRaw, horaRaw, ...descricaoPartes] = partes;
  const descricao = descricaoPartes.join('|').trim();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw || '') ? (dataRaw as string) : createEmptyAgendaItem().data;
  const hora = /^\d{2}:\d{2}$/.test(horaRaw || '') ? (horaRaw as string) : '09:00';

  return {
    id: createDraftId('agenda-item'),
    data,
    hora,
    descricao: descricao || conteudo.trim(),
    temHora: horaRaw !== '00:00',
    conteudo_i18n: createEmptyLocalizedTextMap(),
  };
}

export function serializeAgendaConteudo(item: AgendaItemRascunho) {
  return `${item.data}|${item.temHora ? item.hora : '00:00'}|${item.descricao.trim()}`;
}

export function parseAvisoConteudo(conteudo: string): AvisoItemRascunho {
  const texto = conteudo.trim();

  if (!texto) {
    return createEmptyAvisoItem();
  }

  const separadorDuplo = texto.indexOf('\n\n');

  if (separadorDuplo >= 0) {
    const titulo = texto.slice(0, separadorDuplo).trim();
    const corpo = texto.slice(separadorDuplo + 2).trim();

    return {
      id: createDraftId('aviso-item'),
      titulo,
      corpo,
      destaque: false,
      imagem_url: '',
      conteudo_i18n: createEmptyLocalizedTextMap(),
    };
  }

  const [titulo, ...restante] = texto.split('\n');

  return {
    id: createDraftId('aviso-item'),
    titulo: titulo.trim(),
    corpo: restante.join('\n').trim(),
    destaque: false,
    imagem_url: '',
    conteudo_i18n: createEmptyLocalizedTextMap(),
  };
}

export function serializeAvisoConteudo(item: AvisoItemRascunho) {
  return `${item.titulo.trim()}\n\n${item.corpo.trim()}`;
}

export function parseInformativoConteudo(conteudo: string): InformativoItemRascunho {
  const texto = conteudo.trim();

  if (!texto) {
    return createEmptyInformativoItem();
  }

  const separadorDuplo = texto.indexOf('\n\n');

  if (separadorDuplo >= 0) {
    const titulo = texto.slice(0, separadorDuplo).trim();
    const corpo = texto.slice(separadorDuplo + 2).trim();

    return {
      id: createDraftId('informativo-item'),
      titulo,
      corpo,
      destaque: false,
      imagem_url: '',
      conteudo_i18n: createEmptyLocalizedTextMap(),
    };
  }

  const [titulo, ...restante] = texto.split('\n');

  return {
    id: createDraftId('informativo-item'),
    titulo: titulo.trim(),
    corpo: restante.join('\n').trim(),
    destaque: false,
    imagem_url: '',
    conteudo_i18n: createEmptyLocalizedTextMap(),
  };
}

export function serializeInformativoConteudo(item: InformativoItemRascunho) {
  return `${item.titulo.trim()}\n\n${item.corpo.trim()}`;
}

function parseBoletimFallbackMeta(raw: string | null | undefined): BoletimFallbackMeta | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<BoletimFallbackMeta>;

    if (typeof parsed.secaoTitulo !== 'string') return null;
    if (typeof parsed.secaoOrdem !== 'number') return null;
    if (typeof parsed.itemOrdem !== 'number') return null;

    return {
      secaoTitulo: parsed.secaoTitulo,
      secaoTituloI18n:
        parsed.secaoTituloI18n &&
        typeof parsed.secaoTituloI18n === 'object' &&
        !Array.isArray(parsed.secaoTituloI18n)
          ? (parsed.secaoTituloI18n as Partial<Record<Locale, string>>)
          : null,
      secaoIcone: typeof parsed.secaoIcone === 'string' ? parsed.secaoIcone : null,
      secaoVisivel: parsed.secaoVisivel !== false,
      secaoOrdem: parsed.secaoOrdem,
      itemDestaque: parsed.itemDestaque === true,
      itemOrdem: parsed.itemOrdem,
      itemImagemUrl: typeof parsed.itemImagemUrl === 'string' ? parsed.itemImagemUrl : null,
    };
  } catch {
    return null;
  }
}

export function buildBoletimSecoesFromFallbackRows(rows: LouvorItemRow[], locale: Locale) {
  const sections = new Map<string, BoletimSecaoRascunho>();
  const itemOrders = new Map<string, number>();

  rows.forEach((row) => {
    const tipo = extrairTipoBoletimFallback(row.tipo);
    const meta = parseBoletimFallbackMeta(row.descricao);
    const conteudoI18n = normalizeLocalizedTextMap(
      row.conteudo_publico_i18n,
      row.conteudo_publico || ''
    );
    const conteudo = resolveLocalizedText(conteudoI18n, locale, row.conteudo_publico || '');

    if (!tipo || !meta || !conteudo) return;

    const config = getBoletimTipoConfig(tipo);
    const tituloI18n = normalizeLocalizedTextMap(meta.secaoTituloI18n, meta.secaoTitulo || config.titulo);
    const titulo = resolveLocalizedText(tituloI18n, locale, meta.secaoTitulo || config.titulo);
    const key = `${meta.secaoOrdem}:${tipo}:${titulo}`;

    if (!sections.has(key)) {
      sections.set(key, {
        id: key,
        tipo,
        titulo,
        titulo_i18n: tituloI18n,
        icone: meta.secaoIcone || config.icone,
        visivel: meta.secaoVisivel,
        ordem: meta.secaoOrdem,
        itens: [],
      });
    }

    sections.get(key)?.itens.push({
      id: row.id,
      conteudo,
      conteudo_i18n: conteudoI18n,
      destaque: meta.itemDestaque,
      imagem_url: meta.itemImagemUrl ?? null,
    });
    itemOrders.set(row.id, meta.itemOrdem);
  });

  return [...sections.values()]
    .map((secao) => ({
      ...secao,
      itens: [...secao.itens].sort(
        (a, b) => (itemOrders.get(a.id) || 0) - (itemOrders.get(b.id) || 0)
      ),
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

export function buildBoletimSecoesEstruturadasPorCulto(
  secoesRaw: StructuredBoletimSecaoRow[],
  itensRaw: StructuredBoletimItemRow[],
  locale: Locale
) {
  const itensPorSecao = new Map<string, StructuredBoletimItemRow[]>();

  itensRaw.forEach((item) => {
    if (!item.secao_id) return;
    const atuais = itensPorSecao.get(item.secao_id) || [];
    atuais.push(item);
    itensPorSecao.set(item.secao_id, atuais);
  });

  const secoesPorCulto = new Map<number, BoletimSecaoRascunho[]>();

  [...secoesRaw]
    .sort((a, b) => {
      if ((a.culto_id || 0) !== (b.culto_id || 0)) {
        return (a.culto_id || 0) - (b.culto_id || 0);
      }

      return (a.ordem || 0) - (b.ordem || 0);
    })
    .forEach((secao) => {
      if (typeof secao.culto_id !== 'number') return;

      const config = getBoletimTipoConfig(secao.tipo);
      const tituloI18n = normalizeLocalizedTextMap(
        secao.titulo_i18n,
        secao.titulo || config.titulo
      );
      const titulo = resolveLocalizedText(
        tituloI18n,
        locale,
        secao.titulo || config.titulo
      );
      const itens = (itensPorSecao.get(secao.id) || [])
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((item) => {
          const conteudoI18n = normalizeLocalizedTextMap(
            item.conteudo_i18n,
            item.conteudo || ''
          );

          return {
            id: item.id,
            conteudo: resolveLocalizedText(conteudoI18n, locale, item.conteudo || ''),
            conteudo_i18n: conteudoI18n,
            destaque: item.destaque === true,
            imagem_url: item.imagem_url ?? null,
          };
        });

      const atuais = secoesPorCulto.get(secao.culto_id) || [];
      atuais.push({
        id: secao.id,
        tipo: secao.tipo,
        titulo,
        titulo_i18n: tituloI18n,
        icone: secao.icone || config.icone,
        visivel: secao.visivel !== false,
        ordem: secao.ordem || atuais.length,
        itens,
      });
      secoesPorCulto.set(secao.culto_id, atuais);
    });

  for (const [cultoId, secoes] of secoesPorCulto.entries()) {
    secoesPorCulto.set(cultoId, normalizarSecoesBoletim(secoes));
  }

  return secoesPorCulto;
}

export function buildBoletimFallbackRows(secoes: BoletimSecaoRascunho[], ordemInicial: number) {
  const rows: Array<{
    ordem: number;
    tipo: string;
    conteudo_publico: string | null;
    conteudo_publico_i18n: ReturnType<typeof compactLocalizedTextMap>;
    descricao: string | null;
    horario: string | null;
    cantico_id: null;
    tom: null;
  }> = [];

  let ordem = ordemInicial;

  normalizarSecoesBoletim(secoes).forEach((secao) => {
    const config = getBoletimTipoConfig(secao.tipo);

    secao.itens
      .map((item, index) => ({
        item,
        index,
      }))
      .filter(({ item }) => item.conteudo.trim().length > 0)
      .forEach(({ item, index }) => {
        const tituloI18n = compactLocalizedTextMap(secao.titulo_i18n);
        const conteudoComPt = withPtFallback(item.conteudo_i18n, item.conteudo.trim());
        const conteudoI18n = compactLocalizedTextMap(conteudoComPt);
        const meta: BoletimFallbackMeta = {
          secaoTitulo: secao.titulo_i18n.pt || secao.titulo.trim() || config.titulo,
          secaoTituloI18n: tituloI18n,
          secaoIcone: secao.icone || config.icone,
          secaoVisivel: secao.visivel,
          secaoOrdem: secao.ordem,
          itemDestaque: item.destaque,
          itemOrdem: index,
          ...(item.imagem_url ? { itemImagemUrl: item.imagem_url } : {}),
        };

        rows.push({
          ordem: ordem++,
          tipo: `${BOLETIM_FALLBACK_TIPO_PREFIX}${secao.tipo}`,
          conteudo_publico: conteudoComPt.pt || item.conteudo.trim(),
          conteudo_publico_i18n: conteudoI18n,
          descricao: JSON.stringify(meta),
          horario: null,
          cantico_id: null,
          tom: null,
        });
      });
  });

  return rows;
}

export function buildLiturgiaMetaRow(nomeLiturgia: string, nomeLiturgiaI18n: LocalizedTextMapForm) {
  const nome = nomeLiturgia.trim();
  if (!nome) return null;

  return {
    ordem: 0,
    tipo: LITURGIA_META_TIPO,
    conteudo_publico: nomeLiturgiaI18n.pt || nome,
    conteudo_publico_i18n: compactLocalizedTextMap(nomeLiturgiaI18n),
    descricao: null,
    horario: null,
    cantico_id: null,
    tom: null,
  };
}

export function agruparItensLiturgia(data: LouvorItemRowComCantico[]): ItemAgrupado[] {
  const agrupados: ItemAgrupado[] = [];

  for (const it of data) {
    if (isBoletimFallbackTipo(it.tipo) || isLiturgiaMetaTipo(it.tipo)) continue;

    const ultimo = agrupados[agrupados.length - 1];

    if (
      ultimo &&
      ultimo.tipo === (it.tipo || '') &&
      ultimo.horario === it.horario &&
      ultimo.conteudo_publico === it.conteudo_publico &&
      ultimo.descricao === it.descricao
    ) {
      if (it.canticos?.nome) {
        ultimo.canticos.push({ nome: it.canticos.nome, tom: it.tom });
      }
      continue;
    }

    agrupados.push({
      tipo: it.tipo || '',
      horario: it.horario,
      conteudo_publico: it.conteudo_publico,
      descricao: it.descricao,
      canticos: it.canticos?.nome ? [{ nome: it.canticos.nome, tom: it.tom }] : [],
    });
  }

  return agrupados;
}
