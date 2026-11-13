'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Check, Copy, MessageCircle } from 'lucide-react';
import type { Locale } from '@/i18n/config';

interface DadosVersiculo {
  versao: { id: number; abreviacao: string; copyright: string | null };
  passagem: {
    id: string;
    referencia: string;
    blocos: Array<{ estilo: string; segmentos: Array<{ versiculo: number | null; texto: string }> }>;
  };
}

const TEXTOS: Record<Locale, { titulo: string; whatsapp: string; copiar: string; copiado: string }> = {
  pt: { titulo: 'Versículo do dia', whatsapp: 'WhatsApp', copiar: 'Copiar', copiado: 'Copiado' },
  es: { titulo: 'Versículo del día', whatsapp: 'WhatsApp', copiar: 'Copiar', copiado: 'Copiado' },
  en: { titulo: 'Verse of the day', whatsapp: 'WhatsApp', copiar: 'Copy', copiado: 'Copied' },
};

// Dia do ano (1–366) no fuso de quem está lendo.
function diaDoAno(data = new Date()) {
  const inicio = Date.UTC(data.getFullYear(), 0, 0);
  const hoje = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  return Math.floor((hoje - inicio) / 86_400_000);
}

function textoCorrido(dados: DadosVersiculo) {
  return dados.passagem.blocos
    .map((bloco) => bloco.segmentos.map((segmento) => segmento.texto).join('').trim())
    .filter(Boolean)
    .join('\n');
}

interface VersiculoDoDiaProps {
  locale: Locale;
  // boletim: estilo reformado do boletim público; painel: cartão do sistema.
  variante: 'boletim' | 'painel';
  // Repassa o texto formatado pro bloco pai, pra compor o compartilhamento do boletim inteiro.
  onTextoPronto?: (texto: string | null) => void;
}

export default function VersiculoDoDia({ locale, variante, onTextoPronto }: VersiculoDoDiaProps) {
  const textos = TEXTOS[locale];
  const [dados, setDados] = useState<DadosVersiculo | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const params = new URLSearchParams({ dia: String(diaDoAno()), locale });
    fetch(`/api/biblia/versiculo-do-dia?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((resultado) => ativo && setDados(resultado))
      .catch(() => ativo && setDados(null));
    return () => {
      ativo = false;
    };
  }, [locale]);

  const compartilhamentoParaBloco = dados
    ? `*${textos.titulo}*\n\n“${textoCorrido(dados)}”\n— ${dados.passagem.referencia} (${dados.versao.abreviacao})`
    : null;

  useEffect(() => {
    onTextoPronto?.(compartilhamentoParaBloco);
    // Ao desmontar (ex.: seção removida do boletim), limpa a parte deste bloco no texto combinado.
    return () => onTextoPronto?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compartilhamentoParaBloco]);

  // Sem versículo (falha na API): não ocupa espaço.
  if (!dados) return null;

  const texto = textoCorrido(dados);
  const referencia = `${dados.passagem.referencia} (${dados.versao.abreviacao})`;
  const compartilhamento = compartilhamentoParaBloco as string;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(compartilhamento);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };

  const abrirWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(compartilhamento)}`, '_blank');

  if (variante === 'boletim') {
    const botao =
      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[1.1rem] italic text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#8b2a1d]';

    return (
      <div className="mb-6 border-b border-dotted border-[#1e1208]/25 pb-6 text-center">
        <p className="font-fell text-[1.15rem] tracking-[0.3em] text-[#8b2a1d]">{textos.titulo.toUpperCase()}</p>
        <blockquote className="mx-auto mt-3 max-w-xl whitespace-pre-line font-garamond text-[24px] italic leading-[1.6] text-[#2a1a0e] sm:text-[27px]">
          “{texto}”
        </blockquote>
        <p className="mt-3 font-fell text-[1.25rem] text-[#8b2a1d]">— {referencia}</p>
        <div className="mt-3 flex items-center justify-center gap-1">
          <button type="button" onClick={abrirWhatsApp} className={botao}>
            <MessageCircle className="h-3.5 w-3.5" />
            {textos.whatsapp}
          </button>
          <button type="button" onClick={copiar} className={botao}>
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? textos.copiado : textos.copiar}
          </button>
        </div>
        {dados.versao.copyright ? (
          <p className="mx-auto mt-2 max-w-xl whitespace-pre-line text-[13px] italic leading-snug text-[#7a5c40]/80">
            {dados.versao.copyright}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="mb-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          <BookOpen className="h-4 w-4" />
          {textos.titulo}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={abrirWhatsApp}
            title={textos.whatsapp}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{textos.whatsapp}</span>
          </button>
          <button
            type="button"
            onClick={copiar}
            title={textos.copiar}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
          >
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiado ? textos.copiado : textos.copiar}</span>
          </button>
        </div>
      </div>
      <blockquote className="mt-3 whitespace-pre-line font-serif text-lg italic leading-relaxed text-slate-800 sm:text-xl">
        “{texto}”
      </blockquote>
      <p className="mt-2 text-sm font-semibold text-emerald-800">— {referencia}</p>
      {dados.versao.copyright ? (
        <p className="mt-3 whitespace-pre-line text-[11px] leading-snug text-slate-400">{dados.versao.copyright}</p>
      ) : null}
    </section>
  );
}
