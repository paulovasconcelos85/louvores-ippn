import type { Locale } from '@/i18n/config';
import { createEmptyLocalizedTextMap, normalizeLocalizedTextMap, resolveLocalizedText } from '@/lib/church-i18n';
import { TIPOS_LITURGICOS_PADRAO, BOLETIM_FALLBACK_TIPO_PREFIX, LITURGIA_META_TIPO, type LouvorItem, type ModeloLiturgiaConfig, type LiturgiaChurchConfig, type Culto, MESES_HISTORICO_CANTICOS } from './tipos';

// --- HELPERS ---
function isPrimeirosDomingo(data: Date): boolean {
  const d = new Date(data);
  return d.getDay() === 0 && d.getDate() <= 7;
}

export function isBoletimFallbackTipo(tipo: string | null | undefined): tipo is string {
  return typeof tipo === 'string' && tipo.startsWith(BOLETIM_FALLBACK_TIPO_PREFIX);
}

export function isLiturgiaMetaTipo(tipo: string | null | undefined) {
  return tipo === LITURGIA_META_TIPO;
}

export function extrairTipoBoletimFallback(tipo: string | null | undefined) {
  if (!isBoletimFallbackTipo(tipo)) return null;
  return tipo.slice(BOLETIM_FALLBACK_TIPO_PREFIX.length) || null;
}

export function getCultoNomeLiturgia(culto: Culto | null | undefined) {
  const nome = typeof culto?.nome_liturgia === 'string' ? culto.nome_liturgia.trim() : '';
  return nome || null;
}

export function getCultoTituloExibicao(culto: Culto | null | undefined, fallback: string) {
  return getCultoNomeLiturgia(culto) || fallback;
}

export function extractTiposLiturgicos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const row = item as Record<string, unknown>;
      const candidate = row.nome || row.label || row.tipo || row.titulo;
      return typeof candidate === 'string' ? candidate.trim() : '';
    })
    .filter(Boolean);
}

export function mergeLocalizedModelValue(
  primaryValue: unknown,
  secondaryValue: unknown,
  primaryFallback?: string,
  secondaryFallback?: string
) {
  const primary = normalizeLocalizedTextMap(primaryValue, primaryFallback);
  const secondary = normalizeLocalizedTextMap(secondaryValue, secondaryFallback);

  return {
    pt: primary.pt || secondary.pt,
    es: primary.es || secondary.es,
    en: primary.en || secondary.en,
  };
}

export function extractModeloLiturgicoPadrao(value: unknown, locale: Locale): ModeloLiturgiaConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const bloco = typeof row.bloco === 'string' ? row.bloco.trim() : '';
      const tipo = typeof row.tipo === 'string' ? row.tipo.trim() : '';
      const descricao_padrao =
        typeof row.descricao_padrao === 'string'
          ? row.descricao_padrao
          : typeof row.descricao === 'string'
            ? row.descricao
            : '';
      const conteudo_publico_padrao =
        typeof row.conteudo_publico_padrao === 'string'
          ? row.conteudo_publico_padrao
          : typeof row.conteudo_publico === 'string'
            ? row.conteudo_publico
            : '';
      const conteudo_publico_padrao_i18n = normalizeLocalizedTextMap(
        row.conteudo_publico_padrao_i18n,
        conteudo_publico_padrao
      );
      const descricao_interna_padrao =
        typeof row.descricao_interna_padrao === 'string'
          ? row.descricao_interna_padrao
          : descricao_padrao;
      const descricao_interna_padrao_i18n = normalizeLocalizedTextMap(
        row.descricao_interna_padrao_i18n,
        descricao_interna_padrao
      );

      if (!bloco && !tipo && !descricao_padrao && !conteudo_publico_padrao) return null;

      return {
        bloco,
        ordem: typeof row.ordem === 'number' ? row.ordem : index + 1,
        tipo,
        conteudo_publico_padrao: resolveLocalizedText(
          conteudo_publico_padrao_i18n,
          locale,
          conteudo_publico_padrao
        ),
        conteudo_publico_padrao_i18n,
        descricao_interna_padrao: resolveLocalizedText(
          descricao_interna_padrao_i18n,
          locale,
          descricao_interna_padrao
        ),
        descricao_interna_padrao_i18n,
        descricao_padrao,
        tem_cantico: row.tem_cantico === true,
      };
    })
    .filter(Boolean) as ModeloLiturgiaConfig[];
}

export function mergeModelosLiturgia(
  modelosTabela: ModeloLiturgiaConfig[],
  modelosFallback: ModeloLiturgiaConfig[]
): ModeloLiturgiaConfig[] {
  const merged = new Map<string, ModeloLiturgiaConfig>();

  modelosFallback.forEach((item, index) => {
    const key = `${item.ordem || index + 1}-${item.tipo}-${item.bloco}`;
    merged.set(key, {
      ...item,
      ordem: item.ordem || index + 1,
    });
  });

  modelosTabela.forEach((item, index) => {
    const key = `${item.ordem || index + 1}-${item.tipo}-${item.bloco}`;
    const fallback = merged.get(key);

    merged.set(key, {
      ...fallback,
      ...item,
      ordem: item.ordem || fallback?.ordem || index + 1,
      conteudo_publico_padrao_i18n: mergeLocalizedModelValue(
        item.conteudo_publico_padrao_i18n,
        fallback?.conteudo_publico_padrao_i18n,
        item.conteudo_publico_padrao,
        fallback?.conteudo_publico_padrao
      ),
      conteudo_publico_padrao:
        item.conteudo_publico_padrao || fallback?.conteudo_publico_padrao || '',
      descricao_interna_padrao_i18n: mergeLocalizedModelValue(
        item.descricao_interna_padrao_i18n,
        fallback?.descricao_interna_padrao_i18n,
        item.descricao_interna_padrao || item.descricao_padrao,
        fallback?.descricao_interna_padrao || fallback?.descricao_padrao
      ),
      descricao_interna_padrao:
        item.descricao_interna_padrao || fallback?.descricao_interna_padrao || item.descricao_padrao || '',
      descricao_padrao:
        item.descricao_padrao || fallback?.descricao_padrao || item.descricao_interna_padrao || '',
      tem_cantico: item.tem_cantico ?? fallback?.tem_cantico ?? false,
    });
  });

  return [...merged.values()].sort((a, b) => a.ordem - b.ordem);
}

export function resolveTiposLiturgicos(config?: LiturgiaChurchConfig | null) {
  return config?.tiposLiturgicos?.length ? config.tiposLiturgicos : TIPOS_LITURGICOS_PADRAO;
}

export function normalizarTiposLiturgicosDisponiveis(baseTipos: string[], itens: LouvorItem[]) {
  const vistos = new Set<string>();
  const tipos = [...baseTipos, ...itens.map((item) => item.tipo)];

  const resultado = tipos.filter((tipo) => {
    const valor = typeof tipo === 'string' ? tipo.trim() : '';
    if (!valor) return false;

    const chave = valor.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) return false;

    vistos.add(chave);
    return true;
  });

  return resultado.length > 0 ? resultado : TIPOS_LITURGICOS_PADRAO;
}

function modeloPadraoDaConfiguracao(config?: LiturgiaChurchConfig | null): LouvorItem[] {
  const modelos = [...(config?.modelosLiturgia || [])].sort((a, b) => a.ordem - b.ordem);

  return modelos.map((item, index) => {
    const tipo = item.tipo || item.bloco || `Item ${index + 1}`;

    return {
      tipo,
      ordem: index + 1,
      conteudo_publico: item.conteudo_publico_padrao || null,
      conteudo_publico_i18n: item.conteudo_publico_padrao_i18n || createEmptyLocalizedTextMap(),
      descricao: item.descricao_interna_padrao || item.descricao_padrao || null,
      horario: null,
      canticos_lista: item.tem_cantico ? [{ cantico_id: null, tom: null }] : [],
    };
  });
}

export function modeloPadrao(dia: string, config?: LiturgiaChurchConfig | null): LouvorItem[] {
  const modeloConfigurado = modeloPadraoDaConfiguracao(config);
  if (modeloConfigurado.length > 0) return modeloConfigurado;

  const data = new Date(dia + 'T00:00:00');
  const primeiroDomingo = isPrimeirosDomingo(data);

  const itens: LouvorItem[] = [
    { tipo: 'Prelúdio', ordem: 1, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: null, horario: '9h-9h05', canticos_lista: [] },
    { tipo: 'Saudação e Acolhida à Igreja', ordem: 2, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Salmo 138.1-2\nIgreja da Família de Deus\nLeitura Responsiva: Salmo ____ (_______)\nOração de Invocação e Entrega do Culto ao Senhor (_______)', horario: '9h05-9h10', canticos_lista: [] },
    { tipo: 'Cânticos Congregacionais', ordem: 3, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: null, horario: '9h10-9h25', canticos_lista: [{ cantico_id: null, tom: null }, { cantico_id: null, tom: null }, { cantico_id: null, tom: null }] },
    { tipo: 'Confissão de Pecados', ordem: 4, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Leitura Não Responsiva e Oração: Salmo 40.1-3 (_______)\nDar minutos para os irmãos.\nOração pelos enfermos.', horario: '9h25-9h30', canticos_lista: [] },
    { tipo: 'Dízimos e Ofertas', ordem: 5, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Passagem de Dízimos e Ofertas. 1 Tm 6.17-19\nLembrar aos presentes colocar o código 0,09 no PIX;\nEnvelopes de Dízimo.', horario: '9h30-9h35', canticos_lista: [] },
    { tipo: 'Cântico para as Ofertas e Dízimos', ordem: 6, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Oração pelas ofertas e dízimo.', horario: '9h35-9h40', canticos_lista: [{ cantico_id: null, tom: null }] },
    { tipo: 'Oração pelas Crianças', ordem: 7, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Chamar irmão (_______)', horario: '9h40-9h45', canticos_lista: [] },
    { tipo: 'Pregação da Palavra', ordem: 8, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: null, horario: '9h45-10h25', canticos_lista: [] },
  ];

  if (primeiroDomingo) {
    itens.push({ tipo: 'Santa Ceia', ordem: 9, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: null, horario: '10h25', canticos_lista: [] });
  }

  itens.push(
    { tipo: 'Cântico Final', ordem: itens.length + 1, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Poslúdio', horario: '10h25', canticos_lista: [{ cantico_id: null, tom: null }] },
    { tipo: 'Oração Final e Bênção Apostólica', ordem: itens.length + 2, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Amém tríplice', horario: '10h30', canticos_lista: [] },
    { tipo: 'Lembretes', ordem: itens.length + 3, conteudo_publico: null, conteudo_publico_i18n: createEmptyLocalizedTextMap(), descricao: 'Apresentação dos convidados\nAniversariantes / Casamento', horario: '10h35', canticos_lista: [] },
  );

  return itens.map((it, i) => ({ ...it, ordem: i + 1 }));
}

export function getStatusMusica(dataStr: string | null | undefined) {
  if (!dataStr) return { label: 'SEM USO RECENTE', cor: 'text-blue-600', bg: 'bg-blue-50', dias: -1, dataFormatada: `Não tocada nos últimos ${MESES_HISTORICO_CANTICOS} meses` };
  const data = new Date(dataStr + 'T00:00:00');
  const dias = Math.floor((Date.now() - data.getTime()) / 86400000);
  const fmt = data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  if (dias < 30) return { label: 'RECENTE', cor: 'text-emerald-600', bg: 'bg-emerald-50', dias, dataFormatada: fmt };
  if (dias < 90) return { label: 'MODERADO', cor: 'text-amber-600', bg: 'bg-amber-50', dias, dataFormatada: fmt };
  if (dias < 180) return { label: 'HÁ TEMPO', cor: 'text-orange-600', bg: 'bg-orange-50', dias, dataFormatada: fmt };
  return { label: 'HÁ MUITO', cor: 'text-red-600', bg: 'bg-red-50', dias, dataFormatada: fmt };
}

export function formatCultoDateLabel(dateValue: string) {
  const formatted = new Date(dateValue + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function getCultoDateKey(dateValue: string) {
  return String(dateValue).slice(0, 10);
}

export function getMesAnoReferencia(dateValue: string): { mes: number; ano: number } | null {
  const match = getCultoDateKey(dateValue).match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return null;

  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;

  return { mes, ano };
}

export function isDomingoDate(dateValue: string) {
  return new Date(`${getCultoDateKey(dateValue)}T00:00:00`).getDay() === 0;
}

function toLocalDateKey(date: Date) {
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
}

// Sugestão para "+ Nova": o próximo domingo (hoje, se for domingo) que ainda não tem boletim.
export function proximoDomingoSemBoletim(cultos: Culto[]) {
  const diasComBoletim = new Set(cultos.map((culto) => getCultoDateKey(culto.Dia)));
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() + ((7 - data.getDay()) % 7));

  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const chave = toLocalDateKey(data);
    if (!diasComBoletim.has(chave)) return chave;
    data.setDate(data.getDate() + 7);
  }

  return toLocalDateKey(data);
}

// Datas que costumam ser erro de digitação (mês ou dia trocado) e merecem confirmação.
export function avisosDataBoletim(dia: string) {
  const avisos: string[] = [];
  const data = new Date(`${getCultoDateKey(dia)}T00:00:00`);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasDeDistancia = Math.round((data.getTime() - hoje.getTime()) / 86400000);

  if (!isDomingoDate(dia)) avisos.push('Não é um domingo.');
  if (diasDeDistancia < -7) avisos.push(`Está ${-diasDeDistancia} dias no passado.`);
  if (diasDeDistancia > 21) avisos.push(`Está ${diasDeDistancia} dias à frente.`);

  return avisos;
}

export function buildCultoDayGroups(cultos: Culto[]) {
  const groups = new Map<string, { dia: string; cultos: Culto[] }>();

  cultos.forEach((culto) => {
    const key = getCultoDateKey(culto.Dia);
    const current = groups.get(key);

    if (current) {
      current.cultos.push(culto);
      return;
    }

    groups.set(key, {
      dia: key,
      cultos: [culto],
    });
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      isDomingo: isDomingoDate(group.dia),
      cultos: [...group.cultos].sort((a, b) => a['Culto nr.'] - b['Culto nr.']),
    }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

export function getCultoBoletimReferencia(cultos: Culto[]) {
  return (
    cultos.find((culto) => culto.palavra_pastoral?.trim() || culto.imagem_url) ||
    cultos[0] ||
    null
  );
}

export function isUuid(value: string | null | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function erroColunaNaoEncontrada(error: unknown, columnName: string) {
  return (
    typeof (error as { message?: unknown } | null)?.message === 'string' &&
    (error as { message: string }).message.includes(`Could not find the '${columnName}' column`)
  );
}

export function erroBoletimEstruturadoIndisponivel(error: unknown) {
  const typedError = error as { code?: unknown; message?: unknown; details?: unknown } | null;
  const text = [typedError?.message, typedError?.details]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  // Erros de coluna não encontrada indicam migration pendente — não devem ser silenciados
  if (/\bcolumn\b/i.test(text)) return false;

  return (
    typedError?.code === 'PGRST205' ||
    typedError?.code === '42P01' ||
    typedError?.code === '42501' && /boletim_(secoes|itens)/i.test(text) ||
    typedError?.code === '22P02' && /uuid/i.test(text) ||
    typedError?.code === '23502' && /notifications/i.test(text) ||
    typedError?.code === '23503' && /notifications/i.test(text) ||
    /boletim_(secoes|itens)/i.test(text) &&
      /(does not exist|schema cache|relation|row-level security)/i.test(text)
  );
}
