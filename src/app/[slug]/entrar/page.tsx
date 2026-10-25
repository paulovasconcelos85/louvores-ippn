import { redirect } from 'next/navigation';

// Atalho para divulgar: oikoshub/<slug>/entrar abre o login já com a igreja escolhida.
export default async function EntrarNaIgrejaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/login?igreja=${encodeURIComponent(slug)}`);
}
