'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { encontrarReferenciasBiblicas, type ReferenciaBiblica } from '@/lib/biblia-referencias';

interface Segmento {
  versiculo: number | null;
  texto: string;
}

interface DadosPassagens {
  versao: { id: number; abreviacao: string; copyright: string | null };
  passagens: Array<{ id: string; referencia: string; blocos: Array<{ estilo: string; segmentos: Segmento[] }> }>;
}

const TEXTOS: Record<Locale, { carregando: string; erro: string; abrir: string; ler: string }> = {
  pt: { carregando: 'Carregando o texto…', erro: 'Não foi possível carregar o texto.', abrir: 'Ler no YouVersion', ler: 'Ler o texto de' },
  es: { carregando: 'Cargando el texto…', erro: 'No fue posible cargar el texto.', abrir: 'Leer en YouVersion', ler: 'Leer el texto de' },
  en: { carregando: 'Loading the text…', erro: 'Could not load the text.', abrir: 'Read on YouVersion', ler: 'Read the text of' },
};

// Cache por sessão: reabrir a mesma leitura não refaz a requisição.
const cache = new Map<string, Promise<DadosPassagens>>();

function carregarPassagens(passagens: string[], locale: Locale) {
  const chave = `${locale}:${passagens.join(',')}`;
  let promessa = cache.get(chave);
  if (!promessa) {
    const params = new URLSearchParams({ ids: passagens.join(','), locale });
    promessa = fetch(`/api/biblia/passagem?${params.toString()}`).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as DadosPassagens;
    });
    promessa.catch(() => cache.delete(chave));
    cache.set(chave, promessa);
  }
  return promessa;
}

const ESTILO_BLOCO: Record<string, string> = {
  q1: 'pl-0',
  q2: 'pl-6',
  q3: 'pl-10',
  d: 'italic text-[#7a5c40]',
  m: 'pl-0',
};

function PainelPassagem({ referencia, locale }: { referencia: ReferenciaBiblica; locale: Locale }) {
  const textos = TEXTOS[locale];
  const [dados, setDados] = useState<DadosPassagens | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;
    carregarPassagens(referencia.passagens, locale)
      .then((resultado) => ativo && setDados(resultado))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [referencia.passagens, locale]);

  return (
    <div className="mt-3 rounded-r-sm border-l-2 border-[#8b2a1d]/40 bg-[#8b2a1d]/[0.035] px-4 py-3 sm:px-5 sm:py-4">
      {erro ? (
        <p className="italic text-[19px] text-[#7a5c40]">{textos.erro}</p>
      ) : !dados ? (
        <p className="italic text-[19px] text-[#7a5c40]">{textos.carregando}</p>
      ) : (
        <div className="space-y-4">
          {dados.passagens.map((passagem) => (
            <div key={passagem.id} className="space-y-1">
              <p className="font-fell text-[1.25rem]/[1.4] tracking-wide text-[#8b2a1d]">{passagem.referencia}</p>
              {passagem.blocos.map((bloco, indice) => (
                <p
                  key={indice}
                  className={`font-garamond text-[21px] leading-[1.55] text-[#2a1a0e] sm:text-[22px] ${ESTILO_BLOCO[bloco.estilo] ?? ''}`}
                >
                  {bloco.segmentos.map((segmento, i) => (
                    <React.Fragment key={i}>
                      {segmento.versiculo ? (
                        <sup className="mr-1 text-[0.62em] font-semibold text-[#8b2a1d]">{segmento.versiculo}</sup>
                      ) : null}
                      {segmento.texto}
                    </React.Fragment>
                  ))}
                </p>
              ))}
            </div>
          ))}

          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-dotted border-[#1e1208]/20 pt-3">
            {dados.versao.copyright ? (
              <p className="whitespace-pre-line text-[14px] italic leading-snug text-[#7a5c40]">{dados.versao.copyright}</p>
            ) : null}
            <a
              href={`https://www.bible.com/bible/${dados.versao.id}/${referencia.passagens[0]}.${dados.versao.abreviacao}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[15px] text-[#8b2a1d] underline decoration-[#8b2a1d]/40 underline-offset-2 hover:decoration-[#8b2a1d]"
            >
              {textos.abrir}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

interface TextoComPassagensProps {
  texto: string;
  locale: Locale;
  className?: string;
  // Formatação do texto comum entre as referências (negrito, links...).
  renderTexto?: (texto: string) => React.ReactNode;
  // Listas de referências ("Is 60.21; 61.3"): entende continuações sem o livro.
  continuacoes?: boolean;
}

const textoSimples = (texto: string) => texto;

// Linha da liturgia com as referências bíblicas ("Salmo 23", "Rm 8.1-4")
// destacadas; cada uma abre o texto bíblico logo abaixo da linha.
export default function TextoComPassagens({
  texto,
  locale,
  className,
  renderTexto = textoSimples,
  continuacoes = false,
}: TextoComPassagensProps) {
  const referencias = useMemo(() => encontrarReferenciasBiblicas(texto, { continuacoes }), [texto, continuacoes]);
  const [abertas, setAbertas] = useState<Set<number>>(() => new Set());

  if (referencias.length === 0) {
    return <p className={className}>{renderTexto(texto)}</p>;
  }

  const alternar = (indice: number) =>
    setAbertas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(indice)) proximo.delete(indice);
      else proximo.add(indice);
      return proximo;
    });

  const partes: React.ReactNode[] = [];
  let posicao = 0;
  referencias.forEach((referencia, indice) => {
    if (referencia.inicio > posicao) {
      partes.push(<React.Fragment key={`t${indice}`}>{renderTexto(texto.slice(posicao, referencia.inicio))}</React.Fragment>);
    }
    const aberta = abertas.has(indice);
    partes.push(
      <button
        key={`r${indice}`}
        type="button"
        onClick={() => alternar(indice)}
        aria-expanded={aberta}
        title={`${TEXTOS[locale].ler} ${referencia.rotulo}`}
        className={`mx-[-0.15em] inline-flex items-baseline gap-1 rounded-sm px-[0.15em] text-[#8b2a1d] underline decoration-[#8b2a1d]/55 decoration-dotted underline-offset-[5px] transition-colors hover:bg-[#8b2a1d]/[0.07] ${
          aberta ? 'bg-[#8b2a1d]/[0.07]' : ''
        }`}
      >
        {/* Em listas de referências, só cor e sublinhado: ícones em cada uma poluem a linha. */}
        {continuacoes ? null : <BookOpen className="h-[0.8em] w-[0.8em] shrink-0 self-center" aria-hidden />}
        <span>{referencia.rotulo}</span>
        {continuacoes ? null : (
          <ChevronDown
            className={`h-[0.7em] w-[0.7em] shrink-0 self-center transition-transform ${aberta ? 'rotate-180' : ''}`}
            aria-hidden
          />
        )}
      </button>
    );
    posicao = referencia.fim;
  });
  if (posicao < texto.length) {
    partes.push(<React.Fragment key="fim">{renderTexto(texto.slice(posicao))}</React.Fragment>);
  }

  return (
    <div>
      <p className={className}>{partes}</p>
      {referencias.map((referencia, indice) =>
        abertas.has(indice) ? <PainelPassagem key={indice} referencia={referencia} locale={locale} /> : null
      )}
    </div>
  );
}
