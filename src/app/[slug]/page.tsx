import type { Metadata, Viewport } from 'next';
import PublicBulletinClient from '@/components/PublicBulletinClient';
import { buscarIgrejaPublicaPorSlug, nomeCompletoIgreja, nomeCurtoIgreja } from '@/lib/igreja-publica';
import { getRequestLocale } from '@/i18n/server';
import { porIdioma } from '@/i18n/por-idioma';

interface ChurchBulletinPageProps {
  params: Promise<{ slug: string }>;
}

export const viewport: Viewport = {
  themeColor: '#f4efe5',
};

export async function generateMetadata({ params }: ChurchBulletinPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [igreja, locale] = await Promise.all([
    buscarIgrejaPublicaPorSlug(slug).catch(() => null),
    getRequestLocale(),
  ]);
  const tr = (pt: string, es: string, en: string) => porIdioma(locale, pt, es, en);

  if (!igreja) {
    return {
      title: `${tr('Boletim eletrônico', 'Boletín electrónico', 'Church bulletin')} | OIKOS Hub`,
      description: tr('Boletim eletrônico público da igreja.', 'Boletín electrónico público de la iglesia.', "The church's public bulletin."),
    };
  }

  const base = `/${igreja.slug}`;
  const nome = nomeCompletoIgreja(igreja);

  // Torna o boletim instalável como app da igreja (Android, desktop e iPhone).
  return {
    title: `${nome} · ${tr('Boletim', 'Boletín', 'Bulletin')}`,
    description: `${tr('Boletim semanal de', 'Boletín semanal de', 'Weekly bulletin of')} ${nome}.`,
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
