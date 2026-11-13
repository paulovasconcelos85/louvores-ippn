'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import TextoComPassagens from '@/components/TextoComPassagens';

interface DadosConfissaoDoDia {
  documento: { id: string; titulo: string };
  item: {
    ordem: number;
    secao: string | null;
    rotulo: string;
    pergunta: string | null;
    texto: string;
    referencias: string | null;
  };
}

// Textos longos (seções da Confissão, refutações de Dort) ficam resumidos no
// boletim, com link para o documento completo.
const LIMITE_CARACTERES = 700;

function dataLocal(data = new Date()) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function resumir(texto: string) {
  if (texto.length <= LIMITE_CARACTERES) return { texto, cortado: false };
  const corte = texto.lastIndexOf(' ', LIMITE_CARACTERES);
  return { texto: `${texto.slice(0, corte > 0 ? corte : LIMITE_CARACTERES).trimEnd()}…`, cortado: true };
}

interface ConfissaoDoDiaProps {
  locale: Locale;
  // Repassa o texto formatado pro bloco pai, pra compor o compartilhamento do boletim inteiro.
  onTextoPronto?: (texto: string | null) => void;
}

// Um item das confissões e catecismos por dia, em ciclo (ver src/lib/confissoes.ts).
export default function ConfissaoDoDia({ locale, onTextoPronto }: ConfissaoDoDiaProps) {
  const [dados, setDados] = useState<DadosConfissaoDoDia | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/confissoes/do-dia?data=${dataLocal()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((resultado) => ativo && setDados(resultado))
      .catch(() => ativo && setDados(null));
    return () => {
      ativo = false;
    };
  }, []);

  const compartilhamento = dados
    ? [
        `*${dados.documento.titulo} · ${dados.item.rotulo}*`,
        dados.item.secao ? `_${dados.item.secao}_` : null,
        dados.item.pergunta ? `*${dados.item.pergunta}*` : null,
        resumir(dados.item.texto).texto,
        resumir(dados.item.texto).cortado && typeof window !== 'undefined'
          ? `${window.location.origin}/confissoes/${dados.documento.id}#item-${dados.item.ordem}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : null;

  useEffect(() => {
    onTextoPronto?.(compartilhamento);
    // Ao desmontar (ex.: seção removida do boletim), limpa a parte deste bloco no texto combinado.
    return () => onTextoPronto?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compartilhamento]);

  if (!dados) return null;

  const { documento, item } = dados;
  const { texto, cortado } = resumir(item.texto);
  const linkCompleto = `/confissoes/${documento.id}#item-${item.ordem}`;
  // Nos Cânones de Dort as referências vêm entre parênteses dentro do texto.
  const referenciasNoTexto = documento.id === 'canones-dort';

  return (
    <div className="mb-6 border-b border-dotted border-[#1e1208]/25 pb-6">
      <div className="text-center">
        <p className="font-fell text-[1.15rem] tracking-[0.3em] text-[#8b2a1d]">CONFISSÃO DO DIA</p>
        <p className="mt-1 text-[18px] italic text-[#7a5c40]">
          {documento.titulo} · {item.rotulo}
        </p>
        {item.secao ? <p className="text-[17px] italic text-[#7a5c40]/80">{item.secao}</p> : null}
      </div>

      <div className="mx-auto mt-4 max-w-2xl space-y-3">
        {item.pergunta ? (
          <p className="text-[22px] font-semibold leading-snug text-[#1e1208] sm:text-[23px]">{item.pergunta}</p>
        ) : null}
        {texto.split('\n').map((paragrafo, i) =>
          referenciasNoTexto ? (
            <TextoComPassagens
              key={i}
              texto={paragrafo}
              locale={locale}
              continuacoes
              className="text-[21px] leading-[1.75] text-[#2a1a0e] sm:text-[22px]"
            />
          ) : (
            <p key={i} className="text-[21px] leading-[1.75] text-[#2a1a0e] sm:text-[22px]">
              {paragrafo}
            </p>
          )
        )}
        {item.referencias && !cortado ? (
          <div className="flex gap-2 text-[17px] leading-relaxed text-[#4a3020] sm:text-[18px]">
            <span className="font-fell tracking-wide text-[#7a5c40]">Ref.</span>
            <div className="min-w-0 flex-1">
              <TextoComPassagens texto={item.referencias} locale={locale} continuacoes />
            </div>
          </div>
        ) : null}
        <p className="text-right">
          <Link href={linkCompleto} className="text-[17px] italic text-[#8b2a1d] underline decoration-[#8b2a1d]/40 underline-offset-2">
            {cortado ? 'Continuar lendo no documento →' : 'Ver no documento completo →'}
          </Link>
        </p>
      </div>
    </div>
  );
}
