import { NextResponse } from 'next/server';
import { buscarIgrejaPublicaPorSlug, nomeCompletoIgreja, nomeCurtoIgreja } from '@/lib/igreja-publica';

const COR_PERGAMINHO = '#f4efe5';

// Cada igreja instala como um app próprio: id e start_url pelo slug, ícone pela logo.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const igreja = await buscarIgrejaPublicaPorSlug(slug);

  if (!igreja) {
    return NextResponse.json({ error: 'Igreja não encontrada.' }, { status: 404 });
  }

  const base = `/${igreja.slug}`;
  const manifest = {
    id: base,
    name: `${nomeCompletoIgreja(igreja)} · Boletim`,
    short_name: nomeCurtoIgreja(igreja),
    description: `Boletim semanal de ${nomeCompletoIgreja(igreja)}.`,
    lang: 'pt',
    start_url: base,
    // Escopo amplo para que pedidos de oração e boletins anteriores abram dentro do app.
    scope: '/',
    display: 'standalone',
    background_color: COR_PERGAMINHO,
    theme_color: COR_PERGAMINHO,
    icons: [
      { src: `${base}/icone/192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icone/512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icone/512?maskable=1`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
