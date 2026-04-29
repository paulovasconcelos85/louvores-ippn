import type { Metadata } from 'next';
import PublicBulletinClient from '@/components/PublicBulletinClient';

interface ChurchBulletinPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: 'Boletim eletrônico | OIKOS Hub',
  description: 'Boletim eletrônico público da igreja.',
};

export default async function ChurchBulletinPage({ params }: ChurchBulletinPageProps) {
  const { slug } = await params;

  return <PublicBulletinClient igrejaSlug={slug} />;
}
