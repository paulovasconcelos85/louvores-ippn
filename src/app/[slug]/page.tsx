import type { Metadata, Viewport } from 'next';
import PublicBulletinClient from '@/components/PublicBulletinClient';
import { buscarIgrejaPublicaPorSlug, nomeCompletoIgreja, nomeCurtoIgreja } from '@/lib/igreja-publica';

interface ChurchBulletinPageProps {
  params: Promise<{ slug: string }>;
}

export const viewport: Viewport = {
  themeColor: '#f4efe5',
};

export async function generateMetadata({ params }: ChurchBulletinPageProps): Promise<Metadata> {
  const { slug } = await params;
  const igreja = await buscarIgrejaPublicaPorSlug(slug).catch(() => null);

  if (!igreja) {
    return {
      title: 'Boletim eletrônico | OIKOS Hub',
      description: 'Boletim eletrônico público da igreja.',
    };
  }

  const base = `/${igreja.slug}`;
  const nome = nomeCompletoIgreja(igreja);

  // Torna o boletim instalável como app da igreja (Android, desktop e iPhone).
  return {
    title: `${nome} · Boletim`,
    description: `Boletim semanal de ${nome}.`,
    manifest: `${base}/manifest.webmanifest`,
    icons: {
      icon: [{ url: `${base}/icone/192`, sizes: '192x192', type: 'image/png' }],
      apple: [{ url: `${base}/icone/180`, sizes: '180x180', type: 'image/png' }],
    },
    appleWebApp: {
      capable: true,
      title: nomeCurtoIgreja(igreja),
      statusBarStyle: 'default',
    },
  };
}

export default async function ChurchBulletinPage({ params }: ChurchBulletinPageProps) {
  const { slug } = await params;

  return <PublicBulletinClient igrejaSlug={slug} />;
}
