import type { Metadata } from 'next';
import ComecarClient from './ComecarClient';

export const metadata: Metadata = {
  title: 'Criar minha igreja | OIKOS Hub',
  description:
    'Cadastre sua igreja no OIKOS Hub em poucos minutos: boletim público, cultos, escalas, louvores e membros em um só lugar.',
};

export default function ComecarPage() {
  return <ComecarClient />;
}
