'use client';

import { useParams } from 'next/navigation';
import MembroDetalhe from '@/components/MembroDetalhe';

export default function MembroDetalhesPage() {
  const params = useParams();
  const membroId = params?.id as string;
  return <MembroDetalhe membroId={membroId} />;
}
