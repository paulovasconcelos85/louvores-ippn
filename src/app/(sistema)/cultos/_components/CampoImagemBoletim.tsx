"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/i18n/provider";
import { porIdioma } from "@/i18n/por-idioma";
import { getStoredChurchId } from "@/lib/church-utils";
import { enviarImagemBoletim, ErroEnvioImagem } from "../_lib/imagens-boletim";

// Imagem opcional de notícia, aviso ou informativo. A foto sobe assim que é
// escolhida (do computador, da galeria ou da câmera do celular) e o campo passa
// a guardar a URL pública. Colar um link continua possível para quem já tem a
// imagem hospedada em outro lugar.
export function CampoImagemBoletim({
  rotulo,
  valor,
  textoAlternativo,
  onChange,
  className = "",
}: {
  rotulo: string;
  valor: string;
  textoAlternativo: string;
  onChange: (url: string) => void;
  className?: string;
}) {
  const locale = useLocale();
  const tr = (pt: string, es: string, en: string) =>
    porIdioma(locale, pt, es, en);
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarLink, setMostrarLink] = useState(false);

  const url = valor.trim();

  const mensagemErro = (codigo: string) => {
    switch (codigo) {
      case "imagem-ilegivel":
        return tr(
          "Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG.",
          "No se pudo abrir esta imagen. Prueba una foto en JPG o PNG.",
          "Could not open this image. Try a JPG or PNG photo.",
        );
      case "imagem-grande":
        return tr(
          "A imagem passa de 5 MB mesmo depois de reduzida.",
          "La imagen supera 5 MB incluso después de reducirla.",
          "The image is over 5 MB even after resizing.",
        );
      case "sem-permissao":
        return tr(
          "Você não tem permissão para enviar imagens do boletim desta igreja.",
          "No tienes permiso para subir imágenes del boletín de esta iglesia.",
          "You are not allowed to upload bulletin images for this church.",
        );
      case "sem-igreja":
        return tr(
          "Selecione uma igreja antes de enviar a imagem.",
          "Selecciona una iglesia antes de subir la imagen.",
          "Select a church before uploading the image.",
        );
      default:
        return tr(
          "Não foi possível enviar a imagem agora. Tente de novo.",
          "No se pudo subir la imagen ahora. Inténtalo de nuevo.",
          "Could not upload the image right now. Please try again.",
        );
    }
  };

  const escolherArquivo = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    const igrejaId = getStoredChurchId();
    if (!igrejaId) {
      setErro(mensagemErro("sem-igreja"));
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      onChange(await enviarImagemBoletim(arquivo, igrejaId));
      setMostrarLink(false);
    } catch (error) {
      console.error("Erro ao enviar imagem do boletim:", error);
      setErro(
        mensagemErro(
          error instanceof ErroEnvioImagem ? error.codigo : "falha-envio",
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-700">{rotulo}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={escolherArquivo}
        className="hidden"
      />

      {url ? (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={textoAlternativo}
            className="max-h-48 w-full rounded-lg object-contain"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              {enviando
                ? tr("Enviando...", "Subiendo...", "Uploading...")
                : tr("Trocar imagem", "Cambiar imagen", "Change image")}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={enviando}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {tr("Remover imagem", "Quitar imagen", "Remove image")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 disabled:opacity-60"
        >
          <span>
            {enviando
              ? tr(
                  "Enviando imagem...",
                  "Subiendo imagen...",
                  "Uploading image...",
                )
              : tr(
                  "📷 Enviar foto do computador ou celular",
                  "📷 Subir foto desde la computadora o el celular",
                  "📷 Upload a photo from your computer or phone",
                )}
          </span>
          {!enviando ? (
            <span className="text-xs font-normal text-slate-400">
              {tr(
                "JPG, PNG ou WebP. Fotos grandes são reduzidas automaticamente.",
                "JPG, PNG o WebP. Las fotos grandes se reducen automáticamente.",
                "JPG, PNG or WebP. Large photos are resized automatically.",
              )}
            </span>
          ) : null}
        </button>
      )}

      {erro ? (
        <p className="mt-2 text-xs font-semibold text-red-600">{erro}</p>
      ) : null}

      {mostrarLink && !enviando ? (
        <input
          type="url"
          value={valor}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://..."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-400"
        />
      ) : !url && !enviando ? (
        <button
          type="button"
          onClick={() => setMostrarLink(true)}
          className="mt-2 text-xs font-semibold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          {tr(
            "ou colar o link de uma imagem",
            "o pegar el enlace de una imagen",
            "or paste an image link",
          )}
        </button>
      ) : null}
    </div>
  );
}
