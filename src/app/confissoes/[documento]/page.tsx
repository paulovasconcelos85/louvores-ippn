import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRequestLocale } from '@/i18n/server';
import { buscarDocumento, type ItemConfessional } from '@/lib/confissoes';
import ReferenciasConfissao from '@/components/ReferenciasConfissao';
import { folha } from '../estilos';

export const revalidate = 86400;

interface DocumentoPageProps {
  params: Promise<{ documento: string }>;
}

export async function generateMetadata({ params }: DocumentoPageProps): Promise<Metadata> {
  const { documento: id } = await params;
  const resultado = await buscarDocumento(id).catch(() => null);
  if (!resultado) return { title: 'Confissões e Catecismos' };
  return {
    title: resultado.documento.titulo,
    description: resultado.documento.descricao || undefined,
  };
}

// Agrupa itens consecutivos do mesmo capítulo/seção.
function agruparPorSecao(itens: ItemConfessional[]) {
  const grupos: Array<{ secao: string | null; itens: ItemConfessional[] }> = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.secao === item.secao) ultimo.itens.push(item);
    else grupos.push({ secao: item.secao, itens: [item] });
  }
  return grupos;
}

function ancoraSecao(indice: number) {
  return `secao-${indice + 1}`;
}

export default async function DocumentoConfessionalPage({ params }: DocumentoPageProps) {
  const { documento: id } = await params;
  const [resultado, locale] = await Promise.all([buscarDocumento(id), getRequestLocale()]);
  if (!resultado) notFound();

  const { documento, itens } = resultado;
  const grupos = agruparPorSecao(itens);
  const temSecoes = grupos.some((grupo) => grupo.secao);
  // Nos Cânones de Dort as referências vêm entre parênteses dentro do texto.
  const referenciasNoTexto = documento.id === 'canones-dort';

  return (
    <article className="space-y-6">
      <header className={`${folha} px-6 py-8 text-center sm:px-12 sm:py-10`}>
        <Link href="/confissoes" className="text-[17px] italic text-[#7a5c40] hover:text-[#8b2a1d]">
          ← Confissões e Catecismos
        </Link>
        <p className="mt-4 font-fell text-[1rem] tracking-[0.3em] text-[#8b2a1d]">{documento.ano}</p>
        <h1 className="mt-1 font-fell text-[2rem] leading-tight text-[#1e1208] sm:text-[2.5rem]">{documento.titulo}</h1>
        {documento.descricao ? (
          <p className="mx-auto mt-4 max-w-2xl text-[20px] italic leading-relaxed text-[#4a3020]">{documento.descricao}</p>
        ) : null}

        {temSecoes ? (
          <nav aria-label="Índice" className="mx-auto mt-6 max-w-2xl border-t border-dotted border-[#1e1208]/25 pt-5 text-left">
            <p className="mb-2 text-center font-fell text-[1rem] tracking-[0.25em] text-[#7a5c40]">ÍNDICE</p>
            <ol className="space-y-1 text-[18px] leading-snug">
              {grupos.map((grupo, indice) =>
                grupo.secao ? (
                  <li key={indice}>
                    <a href={`#${ancoraSecao(indice)}`} className="text-[#2a1a0e] hover:text-[#8b2a1d] hover:underline">
                      {grupo.secao}
                    </a>
                  </li>
                ) : null
              )}
            </ol>
          </nav>
        ) : null}
      </header>

      {grupos.map((grupo, indice) => (
        <section
          key={indice}
          id={ancoraSecao(indice)}
          className={`${folha} scroll-mt-24 px-6 py-6 sm:px-10 sm:py-8`}
        >
          {grupo.secao ? (
            <h2 className="mb-2 border-b border-[#1e1208]/15 pb-4 text-center font-fell text-[1.5rem] leading-snug text-[#1e1208] sm:text-[1.8rem]">
              {grupo.secao}
            </h2>
          ) : null}

          <div className="divide-y divide-dotted divide-[#1e1208]/20">
            {grupo.itens.map((item) => (
              <div key={item.id} id={`item-${item.ordem}`} className="scroll-mt-24 space-y-3 py-5">
                <p className="font-fell text-[1.05rem] tracking-[0.15em] text-[#8b2a1d]">{item.rotulo.toUpperCase()}</p>
                {item.pergunta ? (
                  <p className="text-[22px] font-semibold leading-snug text-[#1e1208] sm:text-[23px]">{item.pergunta}</p>
                ) : null}
                <div className="space-y-2">
                  {item.texto.split('\n').map((paragrafo, i) =>
                    referenciasNoTexto ? (
                      <ReferenciasConfissao
                        key={i}
                        texto={paragrafo}
                        locale={locale}
                        className="text-[21px] leading-[1.75] text-[#2a1a0e] sm:text-[22px]"
                      />
                    ) : (
                      <p key={i} className="text-[21px] leading-[1.75] text-[#2a1a0e] sm:text-[22px]">
                        {paragrafo}
                      </p>
                    )
                  )}
                </div>
                {item.referencias ? (
                  <div className="flex gap-2 text-[17px] leading-relaxed text-[#4a3020] sm:text-[18px]">
                    <span className="font-fell tracking-wide text-[#7a5c40]">Ref.</span>
                    <div className="min-w-0 flex-1">
                      <ReferenciasConfissao texto={item.referencias} locale={locale} />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-[16px] italic text-[#7a5c40]">
        Texto em português:{' '}
        <a href={documento.fonte_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          monergismo.com
        </a>
        . Textos bíblicos das referências pelo YouVersion.
      </p>
    </article>
  );
}
