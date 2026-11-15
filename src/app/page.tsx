import type { Metadata } from 'next';
import OikosLandingClient from './oikos/OikosLandingClient';
import { getRequestLocale } from '@/i18n/server';
import { porIdioma } from '@/i18n/por-idioma';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: porIdioma(
      locale,
      'OIKOS Hub | A igreja organizada sem perder o cuidado pastoral',
      'OIKOS Hub | La iglesia organizada sin perder el cuidado pastoral',
      'OIKOS Hub | An organized church without losing pastoral care'
    ),
    description: porIdioma(
      locale,
      'Boletins, cultos, escalas, louvores e vida comunitária em um só lugar para igrejas locais.',
      'Boletines, cultos, turnos, alabanza y vida comunitaria en un solo lugar para iglesias locales.',
      'Bulletins, services, volunteer schedules, worship songs and community life in one place for local churches.'
    ),
  };
}

export default function HomePage() {
  return <OikosLandingClient />;
}
