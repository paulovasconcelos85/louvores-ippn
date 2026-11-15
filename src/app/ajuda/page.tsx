import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, HelpCircle } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { getRequestLocale } from '@/i18n/server';
import { porIdioma } from '@/i18n/por-idioma';
import { PERGUNTAS_PT, SECOES_PT, type Bloco } from './conteudo-pt';
import { PERGUNTAS_EN, SECOES_EN } from './conteudo-en';
import { PERGUNTAS_ES, SECOES_ES } from './conteudo-es';

const CONTEUDO = {
  pt: { secoes: SECOES_PT, perguntas: PERGUNTAS_PT },
  es: { secoes: SECOES_ES, perguntas: PERGUNTAS_ES },
  en: { secoes: SECOES_EN, perguntas: PERGUNTAS_EN },
} satisfies Record<Locale, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: `${porIdioma(locale, 'Ajuda', 'Ayuda', 'Help')} | OIKOS Hub`,
    description: porIdioma(
      locale,
      'Passo a passo de cada parte do OIKOS Hub: criar a igreja, montar o boletim, cânticos, escalas, pessoas, acessos e app no celular.',
      'Paso a paso de cada parte de OIKOS Hub: crear la iglesia, armar el boletín, cánticos, turnos, personas, accesos y app en el celular.',
      'Step-by-step guide to every part of OIKOS Hub: setting up your church, building the bulletin, songs, schedules, people, access and the phone app.'
    ),
  };
}

function renderBloco(bloco: Bloco, index: number, rotuloDica: string) {
  switch (bloco.tipo) {
    case 'p':
      return (
        <p key={index} className="mt-4 text-base leading-7 text-slate-700">
          {bloco.texto}
        </p>
      );
    case 'passos':
      return (
        <ol key={index} className="mt-4 space-y-3">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-3 text-base leading-7 text-slate-700">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'lista':
      return (
        <ul key={index} className="mt-4 list-disc space-y-2 pl-5 text-base leading-7 text-slate-700 marker:text-emerald-600">
          {bloco.itens.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'dica':
      return (
        <p key={index} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <strong>{rotuloDica}: </strong>
          {bloco.texto}
        </p>
      );
  }
}

export default async function AjudaPage() {
  const locale = await getRequestLocale();
  const tr = (pt: string, es: string, en: string) => porIdioma(locale, pt, es, en);
  const { secoes: SECOES, perguntas: PERGUNTAS } = CONTEUDO[locale];
  const rotuloDica = tr('Dica', 'Consejo', 'Tip');

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-slate-950">O</span>
            <span className="text-sm font-semibold sm:text-base">OIKOS Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="inline-flex min-h-10 items-center rounded-full px-3 text-sm text-slate-600 hover:bg-slate-100">
              {tr('Painel', 'Panel', 'Dashboard')}
            </Link>
            <Link href="/comecar" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
              {tr('Criar minha igreja', 'Crear mi iglesia', 'Create my church')}
            </Link>
          </div>
        </div>
      </nav>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-emerald-700">
            <HelpCircle className="h-4 w-4" />
            {tr('Central de ajuda', 'Centro de ayuda', 'Help center')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {tr('Como usar o OIKOS Hub', 'Cómo usar OIKOS Hub', 'How to use OIKOS Hub')}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            {tr(
              'Cada parte do sistema explicada passo a passo. Se for a primeira vez, siga a ordem: criar a igreja, dados da igreja, primeiro boletim, equipe e escalas.',
              'Cada parte del sistema explicada paso a paso. Si es la primera vez, sigue el orden: crear la iglesia, datos de la iglesia, primer boletín, equipo y turnos.',
              "Every part of the system explained step by step. If it's your first time, follow this order: set up your church, church details, first bulletin, team and schedules."
            )}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('Nesta página', 'En esta página', 'On this page')}</p>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {SECOES.map((secao) => (
              <li key={secao.id}>
                <a href={`#${secao.id}`} className="block rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-white hover:text-emerald-800">
                  {secao.titulo}
                </a>
              </li>
            ))}
            <li>
              <a href="#perguntas" className="block rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-white hover:text-emerald-800">
                {tr('Perguntas frequentes', 'Preguntas frecuentes', 'FAQ')}
              </a>
            </li>
          </ul>
        </aside>

        <div className="min-w-0 space-y-6">
          {SECOES.map((secao) => (
            <section key={secao.id} id={secao.id} className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{secao.titulo}</h2>
              <p className="mt-1 text-sm text-slate-500">{secao.resumo}</p>
              {secao.blocos.map((bloco, index) => renderBloco(bloco, index, rotuloDica))}
              {secao.onde && (
                <Link
                  href={secao.onde.href}
                  className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  {secao.onde.rotulo}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </section>
          ))}

          <section id="perguntas" className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{tr('Perguntas frequentes', 'Preguntas frecuentes', 'Frequently asked questions')}</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {PERGUNTAS.map((item) => (
                <details key={item.pergunta} className="group py-3">
                  <summary className="cursor-pointer list-none text-base font-medium text-slate-900 marker:hidden">
                    <span className="mr-2 inline-block text-emerald-600 transition group-open:rotate-90">›</span>
                    {item.pergunta}
                  </summary>
                  <p className="mt-2 pl-5 text-base leading-7 text-slate-700">{item.resposta}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="text-center text-sm text-slate-500">
            {tr('Não encontrou o que procurava?', '¿No encontraste lo que buscabas?', "Didn't find what you were looking for?")}{' '}
            <Link href="/#contato" className="font-medium text-emerald-700 underline">
              {tr('Fale com a equipe OIKOS', 'Habla con el equipo OIKOS', 'Contact the OIKOS team')}
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
