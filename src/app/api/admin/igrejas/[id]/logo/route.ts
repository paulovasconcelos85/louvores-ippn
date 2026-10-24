import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getSupabaseAdmin, verificarGestorIgreja } from '@/lib/igreja-onboarding';

// Logo da igreja enviado como arquivo. O navegador já manda um PNG quadrado
// (ver LogoIgrejaUpload); aqui só validamos, guardamos e gravamos o logo_url.

const BUCKET = 'igrejas-logos';
const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const TIPOS_ACEITOS = ['image/png', 'image/jpeg'];

async function garantirBucket(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (data) return;

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: TAMANHO_MAXIMO,
    allowedMimeTypes: TIPOS_ACEITOS,
  });

  if (error && !/already exists/i.test(error.message)) throw error;
}

async function removerArquivosAntigos(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  igrejaId: string,
  manter?: string
) {
  const { data: arquivos } = await supabaseAdmin.storage.from(BUCKET).list(igrejaId);
  const antigos = (arquivos || [])
    .map((arquivo) => `${igrejaId}/${arquivo.name}`)
    .filter((caminho) => caminho !== manter);

  if (antigos.length > 0) {
    await supabaseAdmin.storage.from(BUCKET).remove(antigos);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verificarGestorIgreja(request, id);
  if (auth.error) return auth.error;

  let arquivo: File | null = null;
  try {
    const formData = await request.formData();
    const valor = formData.get('arquivo');
    arquivo = valor instanceof File ? valor : null;
  } catch {
    arquivo = null;
  }

  if (!arquivo) {
    return apiError('LOGO_FILE_REQUIRED', 400, 'Envie uma imagem.');
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return apiError('LOGO_INVALID_TYPE', 400, 'Formato de imagem não aceito. Use PNG ou JPG.');
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    return apiError('LOGO_TOO_LARGE', 400, 'A imagem passa de 2 MB.');
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    await garantirBucket(supabaseAdmin);

    // Nome novo a cada envio: o boletim e o ícone do app não ficam presos ao cache antigo.
    const extensao = arquivo.type === 'image/png' ? 'png' : 'jpg';
    const caminho = `${id}/logo-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), {
        contentType: arquivo.type,
        cacheControl: '31536000',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publico } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(caminho);

    const { error: updateError } = await supabaseAdmin
      .from('igrejas')
      .update({ logo_url: publico.publicUrl })
      .eq('id', id);
    if (updateError) throw updateError;

    await removerArquivosAntigos(supabaseAdmin, id, caminho);

    return apiSuccess({ logo_url: publico.publicUrl }, { message: 'Logo atualizado.', messageCode: 'LOGO_UPDATED' });
  } catch (error: any) {
    console.error('Erro ao enviar logo da igreja:', error);
    return apiError('LOGO_UPLOAD_FAILED', 500, 'Não foi possível enviar o logo agora.');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await verificarGestorIgreja(request, id);
  if (auth.error) return auth.error;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin.from('igrejas').update({ logo_url: null }).eq('id', id);
    if (error) throw error;

    await removerArquivosAntigos(supabaseAdmin, id);

    return apiSuccess({ logo_url: null }, { message: 'Logo removido.', messageCode: 'LOGO_REMOVED' });
  } catch (error: any) {
    console.error('Erro ao remover logo da igreja:', error);
    return apiError('LOGO_REMOVE_FAILED', 500, 'Não foi possível remover o logo agora.');
  }
}
