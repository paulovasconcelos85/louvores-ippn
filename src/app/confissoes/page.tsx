import type { Metadata } from 'next';
import Link from 'next/link';
import { listarDocumentos } from '@/lib/confissoes';
import { folha } from './estilos';

export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'Confissões e Catecismos',
  description:
    'Confissão de Fé de Westminster, Catecismo Maior, Breve Catecismo e Cânones de Dort, com as referências bíblicas.',
};

export default async function ConfissoesPage() {
  const documentos = await listarDocumentos();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="mx-auto max-w-2xl text-[21px] italic leading-relaxed text-[#4a3020] sm:text-[23px]">
          Os padrões de fé da tradição reformada, divididos em perguntas, capítulos e artigos, com as
          referências bíblicas para ler na Escritura.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {documentos.map((documento) => (
          <Link
            key={documento.id}
            href={`/confissoes/${documento.id}`}
            className={`${folha} block px-6 py-6 transition-transform hover:-translate-y-0.5 sm:px-8 sm:py-7`}
          >
            <p className="font-fell text-[1rem] tracking-[0.25em] text-[#8b2a1d]">{documento.ano}</p>
            <h2 className="mt-1 font-fell text-[1.7rem] leading-tight text-[#1e1208]">{documento.titulo}</h2>
            {documento.descricao ? (
              <p className="mt-3 text-[19px] leading-relaxed text-[#4a3020]">{documento.descricao}</p>
            ) : null}
            <p className="mt-4 text-[17px] italic text-[#8b2a1d]">Ler o documento →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
