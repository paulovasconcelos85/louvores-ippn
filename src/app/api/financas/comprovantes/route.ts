import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { contextoFinanceiro } from '@/lib/financas-server';

const BUCKET = 'financas-comprovantes';
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// POST (multipart: igreja_id, arquivo) -> guarda o comprovante e devolve o caminho,
// que o formulário grava no lançamento.
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('INVALID_BODY', 400, 'Envie o arquivo.');
  }

  const igrejaId = formData.get('igreja_id');
  const ctx = await contextoFinanceiro(request, typeof igrejaId === 'string' ? igrejaId : null);
  if (ctx.error) return ctx.error;
  if (!ctx.permissoes.podeLancar) return apiError('FORBIDDEN', 403, 'Só a equipe da tesouraria envia comprovantes.');

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File)) return apiError('FILE_REQUIRED', 400, 'Envie o arquivo.');
  const extensao = EXTENSOES[arquivo.type];
  if (!extensao) return apiError('FILE_TYPE_INVALID', 400, 'Envie foto (JPG, PNG, WebP) ou PDF.');
  if (arquivo.size > TAMANHO_MAXIMO) return apiError('FILE_TOO_LARGE', 400, 'O arquivo passa de 10 MB.');

  try {
    const caminho = `${ctx.igrejaId}/${new Date().getFullYear()}/${crypto.randomUUID()}.${extensao}`;
    const { error } = await ctx.supabaseAdmin.storage
      .from(BUCKET)
      .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), { contentType: arquivo.type, upsert: false });
    if (error) throw error;

    return apiSuccess({ path: caminho });
  } catch (error: any) {
    console.error('Erro ao enviar comprovante:', error);
    return apiError('FILE_UPLOAD_FAILED', 500, 'Não foi possível enviar o comprovante. O bucket financas-comprovantes foi criado?');
  }
}

// GET ?igreja_id&path -> link temporário para abrir o comprovante.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ctx = await contextoFinanceiro(request, params.get('igreja_id'));
  if (ctx.error) return ctx.error;

  const caminho = params.get('path') || '';
  if (!caminho.startsWith(`${ctx.igrejaId}/`) || caminho.includes('..')) {
    return apiError('FILE_NOT_FOUND', 404, 'Comprovante não encontrado.');
  }

  try {
    if (!ctx.permissoes.podeVerNomes) {
      // Comprovante de dízimo nominal (PIX, envelope) mostra quem contribuiu.
      const { data: lancamento } = await ctx.supabaseAdmin
        .from('fin_lancamentos')
        .select('pessoa_id')
        .eq('igreja_id', ctx.igrejaId)
        .eq('comprovante_path', caminho)
        .maybeSingle();
      if (!lancamento) return apiError('FILE_NOT_FOUND', 404, 'Comprovante não encontrado.');
      if (lancamento.pessoa_id) {
        return apiError('FORBIDDEN', 403, 'Comprovante de contribuição nominal: só tesouraria e pastor veem.');
      }
    }

    const { data, error } = await ctx.supabaseAdmin.storage.from(BUCKET).createSignedUrl(caminho, 300);
    if (error) throw error;

    return apiSuccess({ url: data.signedUrl });
  } catch (error: any) {
    console.error('Erro ao abrir comprovante:', error);
    return apiError('FILE_OPEN_FAILED', 500, 'Não foi possível abrir o comprovante.');
  }
}
