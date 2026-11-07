'use client';

import type { Locale } from '@/i18n/config';
import TextoComPassagens from '@/components/TextoComPassagens';

// Ponte para páginas do servidor: TextoComPassagens recebe funções, que não
// podem atravessar de componente do servidor para o cliente.
export default function ReferenciasConfissao({
  texto,
  locale,
  className,
}: {
  texto: string;
  locale: Locale;
  className?: string;
}) {
  return <TextoComPassagens texto={texto} locale={locale} className={className} continuacoes />;
}
