'use client';

import { ChangeEvent, useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useLocale } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage } from '@/lib/api-feedback';

const LADO_PX = 512;

// Recorta o centro da imagem num quadrado e exporta PNG. Assim qualquer foto
// que o navegador abra (JPG, PNG, WebP, HEIC no iPhone) serve para o boletim e
// para o ícone do app, que é gerado com o logo em círculo.
async function prepararLogo(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);

  try {
    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('imagem-ilegivel'));
      img.src = url;
    });

    const lado = Math.min(imagem.naturalWidth, imagem.naturalHeight);
    const destino = Math.min(LADO_PX, lado);
    const canvas = document.createElement('canvas');
    canvas.width = destino;
    canvas.height = destino;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('imagem-ilegivel');

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imagem,
      (imagem.naturalWidth - lado) / 2,
      (imagem.naturalHeight - lado) / 2,
      lado,
      lado,
      0,
      0,
      destino,
      destino
    );

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('imagem-ilegivel'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function LogoIgrejaUpload({
  igrejaId,
  logoUrl,
  onChange,
}: {
  igrejaId: string | null;
  logoUrl: string;
  onChange: (logoUrl: string) => void;
}) {
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) => (locale === 'es' ? es : locale === 'en' ? en : pt),
    [locale]
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!arquivo || !igrejaId) return;

    setErro('');
    setEnviando(true);

    try {
      let png: Blob;
      try {
        png = await prepararLogo(arquivo);
      } catch {
        throw new Error(
          tr(
            'Não conseguimos abrir esta imagem. Tente uma foto em JPG ou PNG.',
            'No pudimos abrir esta imagen. Prueba con una foto en JPG o PNG.',
            'We could not open this image. Try a JPG or PNG photo.'
          )
        );
      }

      const formData = new FormData();
      formData.append('arquivo', new File([png], 'logo.png', { type: 'image/png' }));

      const response = await fetch(`/api/admin/igrejas/${igrejaId}/logo`, {
        method: 'POST',
        headers: await buildAuthenticatedHeaders(),
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(resolveApiErrorMessage(locale, data, tr('Erro ao enviar o logo.', 'Error al subir el logo.', 'Error uploading the logo.')));
      }

      onChange(data.logo_url || '');
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (!igrejaId) return;
    if (!confirm(tr('Remover o logo da igreja?', '¿Quitar el logo de la iglesia?', 'Remove the church logo?'))) return;

    setErro('');
    setEnviando(true);

    try {
      const response = await fetch(`/api/admin/igrejas/${igrejaId}/logo`, {
        method: 'DELETE',
        headers: await buildAuthenticatedHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(resolveApiErrorMessage(locale, data, tr('Erro ao remover o logo.', 'Error al quitar el logo.', 'Error removing the logo.')));
      }

      onChange('');
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="block space-y-1 xl:col-span-2">
      <span className="text-sm font-medium text-slate-700">{tr('Logo da igreja', 'Logo de la iglesia', 'Church logo')}</span>
      <div className="flex items-center gap-4 rounded-xl border border-slate-300 bg-white p-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate-400" />
          )}
        </span>

        {igrejaId ? (
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={enviando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {logoUrl ? tr('Trocar imagem', 'Cambiar imagen', 'Change image') : tr('Enviar imagem', 'Subir imagen', 'Upload image')}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={remover}
                  disabled={enviando}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {tr('Remover', 'Quitar', 'Remove')}
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {tr(
                'Use uma imagem quadrada; se não for, usamos o centro. Salva na hora.',
                'Usa una imagen cuadrada; si no lo es, usamos el centro. Se guarda al instante.',
                'Use a square image; otherwise we use the center. Saved immediately.'
              )}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {tr('Salve a igreja primeiro para enviar o logo.', 'Guarda la iglesia primero para subir el logo.', 'Save the church first to upload the logo.')}
          </p>
        )}

        <input ref={inputRef} type="file" accept="image/*" onChange={enviar} className="hidden" />
      </div>
      {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
    </div>
  );
}
