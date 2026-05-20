const CADA_DIA_SOURCE_URL = 'https://www.lpc.org.br/cadadia/site/';
const CADA_DIA_CREDIT =
  'Cada Dia: Devocionário mensal com mensagens cristãs para leitura diária e sugestões de leitura bíblica. Assine o Cada Dia e fortaleça sua vida espiritual. Clique no botão abaixo ou ligue 19 3741-3003 (Fone e WhatsApp).';

export interface CadaDiaDevocional {
  titulo: string;
  texto: string;
  fonteUrl: string;
  credito: string;
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();

    if (normalized[0] === '#') {
      const isHex = normalized[1] === 'x';
      const codePoint = Number.parseInt(normalized.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[normalized] || match;
  });
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|p|div|section|article|h[1-6]|li|blockquote)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readHtmlWithCharset(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const contentTypeCharset = contentType.match(/charset=([^;\s]+)/i)?.[1];
  const bytes = await response.arrayBuffer();
  const preview = new TextDecoder('windows-1252').decode(bytes.slice(0, 4096));
  const htmlCharset =
    preview.match(/<meta[^>]+charset=["']?([^"'\s/>]+)/i)?.[1] ||
    preview.match(/<meta[^>]+content=["'][^"']*charset=([^"'\s;]+)/i)?.[1];
  const charset = (contentTypeCharset || htmlCharset || 'windows-1252').trim().toLowerCase();

  const decode = (encoding: string) => {
    try {
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      return '';
    }
  };
  const candidates = [
    decode(charset),
    decode('utf-8'),
    decode('windows-1252'),
    decode('iso-8859-1'),
  ].filter(Boolean);

  return candidates.sort((a, b) => getMojibakeScore(a) - getMojibakeScore(b))[0] || '';
}

function getMojibakeScore(value: string) {
  let score = 0;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0xfffd) score += 5;
    if (code === 0x00c3 || code === 0x00c2) score += 1;
    if (code === 0x00e2 && value.charCodeAt(index + 1) === 0x0080) score += 1;
  }

  return score;
}

function repairMojibake(value: string) {
  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes[index] = code <= 255 ? code : 63;
  }

  const repaired = new TextDecoder('utf-8').decode(bytes);
  return getMojibakeScore(repaired) < getMojibakeScore(value) ? repaired : value;
}

function isolarPrimeiroBlockquoteAposAncora(html: string) {
  const ancora = html.search(/leia abaixo a mensagem de hoje/i);
  if (ancora < 0) return null;

  const trecho = html.slice(ancora);
  const match = trecho.match(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/i);

  return match?.[1] ?? null;
}

function extrairMensagemDeTextoBlockquote(textoBlockquote: string) {
  const linhas = textoBlockquote
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (linhas.length === 0) return null;

  const titulo = linhas[0];
  const corpo = linhas.slice(1).join('\n\n').trim();

  if (!titulo || !corpo) return null;

  const texto = `${titulo}\n\n${corpo}`;
  const textoCorrigido = repairMojibake(texto);
  const [tituloCorrigido, ...corpoCorrigido] = textoCorrigido.split('\n\n');

  return {
    titulo: tituloCorrigido.trim(),
    corpo: corpoCorrigido.join('\n\n').trim(),
  };
}

export async function buscarDevocionalCadaDia(): Promise<CadaDiaDevocional | null> {
  const response = await fetch(CADA_DIA_SOURCE_URL, {
    headers: {
      'User-Agent': 'OIKOS Hub boletim publico (+https://www.lpc.org.br/cadadia/site/)',
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar Cada Dia: HTTP ${response.status}`);
  }

  const html = await readHtmlWithCharset(response);
  const blockquoteHtml = isolarPrimeiroBlockquoteAposAncora(html);

  if (!blockquoteHtml) return null;

  const mensagem = extrairMensagemDeTextoBlockquote(htmlToText(blockquoteHtml));

  if (!mensagem) return null;

  return {
    titulo: mensagem.titulo,
    texto: `${mensagem.titulo}\n\n${mensagem.corpo}`,
    fonteUrl: CADA_DIA_SOURCE_URL,
    credito: CADA_DIA_CREDIT,
  };
}

export function formatarConteudoCadaDia(devocional: CadaDiaDevocional) {
  return `${devocional.texto}\n\nFonte: ${devocional.fonteUrl}\n\nCrédito: ${devocional.credito}`;
}
