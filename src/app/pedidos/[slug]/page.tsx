import { PublicPedidosPage } from '@/components/public-pedidos-page';

export default async function PedidosPorSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <PublicPedidosPage forcedSlug={slug} />;
}
