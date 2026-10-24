'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, Circle, Copy, ExternalLink, HelpCircle, PartyPopper, X } from 'lucide-react';
import { useLocale } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';

type Etapa = { id: string; feito: boolean };

type Conteudo = {
  titulo: [string, string, string];
  texto: [string, string, string];
  href: string;
  ajuda: string;
};

// Ordem = ordem recomendada de implantação.
const CONTEUDO: Record<string, Conteudo> = {
  identidade: {
    titulo: ['Envie o logo da igreja', 'Sube el logo de la iglesia', 'Upload the church logo'],
    texto: [
      'Aparece no boletim público e vira o ícone do app quando alguém instala no celular.',
      'Aparece en el boletín público y se convierte en el ícono de la app al instalarla en el móvil.',
      'Shown on the public bulletin and used as the app icon when installed on phones.',
    ],
    href: '/admin/igrejas',
    ajuda: '/ajuda#dados-da-igreja',
  },
  endereco: {
    titulo: ['Endereço e contatos', 'Dirección y contactos', 'Address and contacts'],
    texto: [
      'Endereço, WhatsApp e Instagram para visitantes encontrarem a igreja.',
      'Dirección, WhatsApp e Instagram para que los visitantes encuentren la iglesia.',
      'Address, WhatsApp and Instagram so visitors can find the church.',
    ],
    href: '/admin/igrejas',
    ajuda: '/ajuda#dados-da-igreja',
  },
  cultos: {
    titulo: ['Horários de culto', 'Horarios de culto', 'Service times'],
    texto: [
      'Cadastre todos os cultos e reuniões da semana.',
      'Registra todos los cultos y reuniones de la semana.',
      'Register every weekly service and meeting.',
    ],
    href: '/admin/igrejas',
    ajuda: '/ajuda#dados-da-igreja',
  },
  boletim: {
    titulo: ['Monte o primeiro boletim', 'Arma el primer boletín', 'Build the first bulletin'],
    texto: [
      'Liturgia, cânticos, leituras e avisos do próximo domingo. É o coração do sistema.',
      'Liturgia, cantos, lecturas y avisos del próximo domingo. Es el corazón del sistema.',
      "Liturgy, songs, readings and announcements for next Sunday. It's the heart of the system.",
    ],
    href: '/cultos',
    ajuda: '/ajuda#boletins',
  },
  equipe: {
    titulo: ['Cadastre sua equipe', 'Registra tu equipo', 'Add your team'],
    texto: [
      'Pastores, músicos e secretaria. Libere o acesso de quem vai ajudar no painel.',
      'Pastores, músicos y secretaría. Da acceso a quien ayudará en el panel.',
      'Pastors, musicians and office staff. Grant access to those who will help.',
    ],
    href: '/admin/usuarios',
    ajuda: '/ajuda#pessoas-e-acessos',
  },
  escala: {
    titulo: ['Crie a primeira escala', 'Crea el primer turno', 'Create the first schedule'],
    texto: [
      'Quem toca, canta e serve no domingo — e mande para o WhatsApp com um clique.',
      'Quién toca, canta y sirve el domingo — y envíalo a WhatsApp con un clic.',
      'Who plays, sings and serves on Sunday — and send it to WhatsApp in one click.',
    ],
    href: '/admin/escalas',
    ajuda: '/ajuda#escalas',
  },
};

function chaveOculto(igrejaId: string) {
  return `oikos:primeiros-passos-oculto:${igrejaId}`;
}

export default function PrimeirosPassos({ igrejaId, boasVindas }: { igrejaId: string; boasVindas?: boolean }) {
  const locale = useLocale();
  const idx = locale === 'es' ? 1 : locale === 'en' ? 2 : 0;
  const tr = useCallback(
    (pt: string, es: string, en: string) => (locale === 'es' ? es : locale === 'en' ? en : pt),
    [locale]
  );

  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [oculto, setOculto] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try {
      setOculto(localStorage.getItem(chaveOculto(igrejaId)) === '1');
    } catch {
      setOculto(false);
    }

    let ativo = true;
    (async () => {
      try {
        const response = await fetch(`/api/igrejas/primeiros-passos?igreja_id=${encodeURIComponent(igrejaId)}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await response.json();
        if (!ativo || !response.ok || !data.podeGerenciar) return;
        setEtapas(data.etapas || []);
        setSlug(data.slug || null);
      } catch {
        // sem roteiro: o painel continua funcionando normalmente
      }
    })();

    return () => {
      ativo = false;
    };
  }, [igrejaId]);

  if (etapas.length === 0) return null;

  const feitas = etapas.filter((etapa) => etapa.feito).length;
  const total = etapas.length;
  const concluido = feitas === total;
  const linkPublico = slug && typeof window !== 'undefined' ? `${window.location.origin}/${slug}` : null;

  if (oculto && !boasVindas) return null;

  const ocultar = () => {
    try {
      localStorage.setItem(chaveOculto(igrejaId), '1');
    } catch {
      // ignora: só não lembra da preferência
    }
    setOculto(true);
  };

  const copiarLink = async () => {
    if (!linkPublico) return;
    try {
      await navigator.clipboard.writeText(linkPublico);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // navegador sem permissão de área de transferência
    }
  };

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      {boasVindas && (
        <div className="flex items-start gap-3 bg-emerald-600 px-5 py-4 text-white sm:px-6">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">{tr('Sua igreja está no ar!', '¡Tu iglesia está en línea!', 'Your church is live!')}</p>
            <p className="mt-0.5 text-sm text-emerald-50">
              {tr(
                'Siga o roteiro abaixo, na ordem. Cada passo leva poucos minutos e tem uma explicação na Ajuda.',
                'Sigue la guía de abajo, en orden. Cada paso toma pocos minutos y tiene su explicación en la Ayuda.',
                'Follow the steps below, in order. Each takes a few minutes and has an explanation in Help.'
              )}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800">
            {feitas}/{total}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-slate-900">
              {concluido
                ? tr('Implantação concluída', 'Implementación completada', 'Setup complete')
                : tr('Primeiros passos da sua igreja', 'Primeros pasos de tu iglesia', "Your church's first steps")}
            </span>
            <span className="mt-1 block h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(feitas / total) * 100}%` }} />
            </span>
          </span>
          <ChevronDown className={`ml-auto h-5 w-5 shrink-0 text-slate-400 transition ${aberto ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={ocultar}
          title={tr('Ocultar roteiro', 'Ocultar guía', 'Hide guide')}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {aberto && (
        <div className="border-t border-slate-100 px-3 pb-4 pt-2 sm:px-4">
          <ol className="divide-y divide-slate-100">
            {etapas.map((etapa) => {
              const conteudo = CONTEUDO[etapa.id];
              if (!conteudo) return null;
              return (
                <li key={etapa.id} className="flex items-start gap-3 px-2 py-3">
                  {etapa.feito ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${etapa.feito ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                      {conteudo.titulo[idx]}
                    </p>
                    {!etapa.feito && <p className="mt-0.5 text-sm leading-6 text-slate-600">{conteudo.texto[idx]}</p>}
                  </div>
                  {!etapa.feito && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Link href={conteudo.ajuda} title={tr('Como fazer', 'Cómo hacerlo', 'How to')} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <HelpCircle className="h-4 w-4" />
                      </Link>
                      <Link
                        href={conteudo.href}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        {tr('Fazer', 'Hacer', 'Do it')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {linkPublico && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-600">{tr('Link público da igreja:', 'Enlace público de la iglesia:', 'Public church link:')}</span>
              <a href={linkPublico} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
                {linkPublico.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button type="button" onClick={copiarLink} className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                <Copy className="h-3.5 w-3.5" />
                {copiado ? tr('Copiado!', '¡Copiado!', 'Copied!') : tr('Copiar', 'Copiar', 'Copy')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
