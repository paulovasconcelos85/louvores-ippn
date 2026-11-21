import { supabase } from '@/lib/supabase';

// Imagens de notícias, avisos e informativos do boletim, enviadas do computador
// ou do celular. Ficam em boletim-imagens/<igreja_id>/<uuid>.<ext>; o banco só
// aceita na pasta de uma igreja que o usuário edita (migração 20261120220000).

const BUCKET = 'boletim-imagens';
const LADO_MAXIMO_PX = 1600;
const TAMANHO_SEM_REDUZIR = 1.5 * 1024 * 1024;
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

async function abrirImagem(arquivo: Blob) {
  const url = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('imagem-ilegivel'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Foto de celular costuma vir com 4–12 MB e 4000 px: reduz para no máximo
// 1600 px em JPEG. Imagem pequena num formato aceito sobe como está, para não
// perder transparência (PNG) nem animação (GIF). HEIC do iPhone, quando o
// navegador consegue abrir, também sai em JPEG.
async function prepararImagem(arquivo: File): Promise<Blob> {
  const imagem = await abrirImagem(arquivo);
  const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);

  if (EXTENSOES[arquivo.type] && arquivo.size <= TAMANHO_SEM_REDUZIR && maiorLado <= LADO_MAXIMO_PX * 1.25) {
    return arquivo;
  }

  const escala = Math.min(1, LADO_MAXIMO_PX / maiorLado);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.naturalWidth * escala);
  canvas.height = Math.round(imagem.naturalHeight * escala);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('imagem-ilegivel');

  // JPEG não tem transparência: fundo branco no lugar do preto.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('imagem-ilegivel'))), 'image/jpeg', 0.85);
  });
}

export type ErroImagemBoletim = 'imagem-ilegivel' | 'imagem-grande' | 'sem-permissao' | 'falha-envio';

export class ErroEnvioImagem extends Error {
  constructor(public codigo: ErroImagemBoletim) {
    super(codigo);
  }
}

export async function enviarImagemBoletim(arquivo: File, igrejaId: string): Promise<string> {
  let blob: Blob;
  try {
    blob = await prepararImagem(arquivo);
  } catch {
    throw new ErroEnvioImagem('imagem-ilegivel');
  }

  if (blob.size > TAMANHO_MAXIMO) throw new ErroEnvioImagem('imagem-grande');

  const extensao = EXTENSOES[blob.type] || 'jpg';
  const caminho = `${igrejaId}/${crypto.randomUUID()}.${extensao}`;

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    const status = Number((error as { statusCode?: string | number }).statusCode);
    if (status === 403 || /row-level security|unauthorized/i.test(error.message)) {
      throw new ErroEnvioImagem('sem-permissao');
    }
    throw new ErroEnvioImagem('falha-envio');
  }

  return supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}
