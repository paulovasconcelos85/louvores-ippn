import type { Metadata } from 'next';
import OikosLandingClient from './oikos/OikosLandingClient';

export const metadata: Metadata = {
  title: 'OIKOS Hub | A igreja organizada sem perder o cuidado pastoral',
  description:
    'Boletins, cultos, escalas, louvores e vida comunitária em um só lugar para igrejas locais.',
};

export default function HomePage() {
  return <OikosLandingClient />;
}
