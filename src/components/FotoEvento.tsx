// Foto de evento inteira, em qualquer formato (retrato, paisagem, quadrada):
// a imagem nunca é cortada. O espaço que sobra dos lados (retrato) ou em
// cima e embaixo é preenchido pela própria foto, desfocada.
export function FotoEvento({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative flex justify-center overflow-hidden bg-slate-900">
      <div
        aria-hidden
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-2xl"
        style={{ backgroundImage: `url("${src}")` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="relative block h-auto max-h-[32rem] w-auto max-w-full"
      />
    </div>
  );
}
