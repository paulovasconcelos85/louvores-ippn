import { ImageResponse } from 'next/og';
import { buscarIgrejaPublicaPorSlug, nomeCurtoIgreja } from '@/lib/igreja-publica';

const TAMANHOS = new Set([180, 192, 512]);
const COR_PERGAMINHO = '#f4efe5';
const COR_TINTA = '#1e1208';

// Ícone do app da igreja: a logo em círculo sobre pergaminho. A versão "maskable"
// deixa margem maior, porque o Android recorta o ícone no formato do aparelho.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; tamanho: string }> }
) {
  const { slug, tamanho: tamanhoRaw } = await params;
  const tamanho = Number(tamanhoRaw);

  if (!TAMANHOS.has(tamanho)) {
    return new Response('Tamanho inválido.', { status: 404 });
  }

  const igreja = await buscarIgrejaPublicaPorSlug(slug);
  if (!igreja) {
    return new Response('Igreja não encontrada.', { status: 404 });
  }

  const maskable = new URL(request.url).searchParams.get('maskable') === '1';
  const diametro = Math.round(tamanho * (maskable ? 0.62 : 0.84));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COR_PERGAMINHO,
        }}
      >
        {igreja.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={igreja.logo_url}
            alt=""
            width={diametro}
            height={diametro}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: diametro,
              height: diametro,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: `${Math.max(2, Math.round(tamanho / 96))}px solid ${COR_TINTA}`,
              color: COR_TINTA,
              fontSize: Math.round(diametro / 4),
            }}
          >
            {nomeCurtoIgreja(igreja).slice(0, 4)}
          </div>
        )}
      </div>
    ),
    {
      width: tamanho,
      height: tamanho,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
      },
    }
  );
}
