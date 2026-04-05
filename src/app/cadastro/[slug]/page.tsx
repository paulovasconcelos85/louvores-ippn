import { redirect } from 'next/navigation';

export default async function CadastroPorSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/cadastro?igreja_slug=${encodeURIComponent(slug)}`);
}
