import Link from 'next/link';
import VoltarBoletim from '@/components/VoltarBoletim';

// Biblioteca pública das confissões e catecismos, no estilo do boletim.
export default function ConfissoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper min-h-screen overflow-x-clip font-garamond text-[#2a1a0e]">
      <header className="sticky top-0 z-40 border-b-[3px] border-double border-[#1e1208]/25 bg-[#f4efe5]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/confissoes" className="min-w-0">
            <p className="font-fell text-[0.95rem] tracking-[0.3em] text-[#8b2a1d]">BIBLIOTECA REFORMADA</p>
            <p className="font-fell text-[1.35rem] leading-tight text-[#1e1208]">Confissões e Catecismos</p>
          </Link>
          <VoltarBoletim />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-3 pb-16 pt-6 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}
