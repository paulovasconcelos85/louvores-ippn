'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Church,
  ClipboardList,
  FileText,
  HeartHandshake,
  Loader2,
  Mail,
  Music,
  Send,
  UsersRound,
} from 'lucide-react';
import { useLocale } from '@/i18n/provider';

type Copy = {
  navCta: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  heroMetricA: string;
  heroMetricB: string;
  heroMetricC: string;
  problemTitle: string;
  problemText: string;
  problems: string[];
  valueTitle: string;
  valueText: string;
  featuresTitle: string;
  featuresText: string;
  features: Array<{ title: string; text: string }>;
  audienceTitle: string;
  audience: Array<{ title: string; text: string }>;
  beforeTitle: string;
  before: string[];
  after: string[];
  contactTitle: string;
  contactText: string;
  name: string;
  contact: string;
  contactPlaceholder: string;
  church: string;
  role: string;
  message: string;
  submit: string;
  sending: string;
  success: string;
  error: string;
  required: string;
};

const COPY: Record<'pt' | 'es' | 'en', Copy> = {
  pt: {
    navCta: 'Agendar conversa',
    eyebrow: 'OIKOS Hub para igrejas',
    title: 'A igreja organizada sem perder o cuidado pastoral.',
    subtitle:
      'Boletins, cultos, escalas, louvores, membros e comunicação em um só lugar. Simples para a equipe, claro para a igreja, útil para o pastor.',
    primaryCta: 'Quero ver uma demonstração',
    secondaryCta: 'Ver o que o sistema entrega',
    heroMetricA: 'Boletim público',
    heroMetricB: 'Cultos e escalas',
    heroMetricC: 'Cadastro pastoral',
    problemTitle: 'O problema não é falta de zelo. É trabalho espalhado.',
    problemText:
      'Toda semana alguém refaz boletim, confere escala, procura aviso, cobra voluntário e tenta manter tudo alinhado em grupos e planilhas.',
    problems: [
      'Informações importantes se perdem em conversas.',
      'Escalas e culto ficam separados da comunicação pública.',
      'A liderança gasta energia conferindo operação repetitiva.',
      'Visitantes e membros nem sempre encontram o que precisam.',
    ],
    valueTitle: 'Um centro operacional para a vida semanal da igreja.',
    valueText:
      'OIKOS Hub organiza o que a igreja já faz: culto, liturgia, louvores, escalas, avisos, aniversariantes, boletim e cadastro de pessoas.',
    featuresTitle: 'Funcionalidades que viram valor pastoral.',
    featuresText:
      'Não é mais um aplicativo para alimentar. É uma referência comum para a liderança enxergar a semana e cuidar melhor.',
    features: [
      { title: 'Cultos e liturgias', text: 'Ordem do culto, textos, hinos, responsáveis e conteúdo público conectados.' },
      { title: 'Louvores e repertório', text: 'Cânticos, hinos, tom, letra e organização para a equipe musical.' },
      { title: 'Escalas', text: 'Voluntários, funções, datas e compartilhamento com menos ruído.' },
      { title: 'Boletim público', text: 'Informação pronta para membros, visitantes e redes sociais.' },
      { title: 'Membros e visitantes', text: 'Cadastro público, vínculo com igreja, dados pastorais e histórico de cuidado.' },
      { title: 'Vida comunitária', text: 'Avisos, aniversariantes, agenda, pedidos pastorais e comunicação em fluxo único.' },
    ],
    audienceTitle: 'Por que isso vale para a igreja?',
    audience: [
      { title: 'Para o pastor', text: 'Mais visão da semana, menos cobrança manual e mais tempo para pessoas.' },
      { title: 'Para a liderança', text: 'Equipes coordenadas com informação confiável e menos dependência de mensagens soltas.' },
      { title: 'Para a igreja', text: 'Comunicação clara, acessível e consistente sobre a vida comunitária.' },
    ],
    beforeTitle: 'A mudança aparece na rotina.',
    before: ['Boletim manual', 'Escala em planilha', 'Avisos perdidos', 'Responsáveis sem visão única'],
    after: ['Boletim em fluxo único', 'Escalas conectadas ao culto', 'Informação compartilhável', 'Liderança com referência comum'],
    contactTitle: 'Vamos preparar uma demonstração com a realidade da sua igreja?',
    contactText:
      'Envie seus dados e uma breve mensagem. A ideia é mostrar o OIKOS Hub usando uma semana real: culto, boletim e escala.',
    name: 'Nome',
    contact: 'Contato',
    contactPlaceholder: 'WhatsApp ou email',
    church: 'Igreja',
    role: 'Função',
    message: 'Mensagem',
    submit: 'Enviar interesse',
    sending: 'Enviando...',
    success: 'Recebemos seu interesse. Agora esse contato ficou registrado para acompanhamento.',
    error: 'Não foi possível enviar agora. Tente novamente em instantes.',
    required: 'Preencha nome e contato para enviar.',
  },
  es: {
    navCta: 'Agendar conversación',
    eyebrow: 'OIKOS Hub para iglesias',
    title: 'La iglesia organizada sin perder el cuidado pastoral.',
    subtitle:
      'Boletines, cultos, turnos, alabanzas, miembros y comunicación en un solo lugar. Simple para el equipo, claro para la iglesia, útil para el pastor.',
    primaryCta: 'Quiero ver una demostración',
    secondaryCta: 'Ver lo que entrega',
    heroMetricA: 'Boletín público',
    heroMetricB: 'Cultos y turnos',
    heroMetricC: 'Registro pastoral',
    problemTitle: 'El problema no es falta de dedicación. Es trabajo disperso.',
    problemText:
      'Cada semana alguien rehace el boletín, revisa turnos, busca avisos, recuerda voluntarios y mantiene todo alineado entre grupos y hojas de cálculo.',
    problems: [
      'La información importante se pierde en conversaciones.',
      'Los turnos y el culto quedan separados de la comunicación pública.',
      'El liderazgo gasta energía revisando operación repetitiva.',
      'Visitantes y miembros no siempre encuentran lo que necesitan.',
    ],
    valueTitle: 'Un centro operativo para la vida semanal de la iglesia.',
    valueText:
      'OIKOS Hub organiza lo que la iglesia ya hace: culto, liturgia, alabanzas, turnos, avisos, cumpleaños, boletín y registro de personas.',
    featuresTitle: 'Funcionalidades que se vuelven valor pastoral.',
    featuresText:
      'No es otra app para alimentar. Es una referencia común para que el liderazgo vea la semana y cuide mejor.',
    features: [
      { title: 'Cultos y liturgias', text: 'Orden del culto, textos, himnos, responsables y contenido público conectados.' },
      { title: 'Alabanzas y repertorio', text: 'Canciones, himnos, tono, letra y organización para el equipo musical.' },
      { title: 'Turnos', text: 'Voluntarios, funciones, fechas y comunicación con menos ruido.' },
      { title: 'Boletín público', text: 'Información lista para miembros, visitantes y redes sociales.' },
      { title: 'Miembros y visitantes', text: 'Registro público, vínculo con iglesia, datos pastorales e historial de cuidado.' },
      { title: 'Vida comunitaria', text: 'Avisos, cumpleaños, agenda, pedidos pastorales y comunicación en un solo flujo.' },
    ],
    audienceTitle: '¿Por qué vale para la iglesia?',
    audience: [
      { title: 'Para el pastor', text: 'Más visión de la semana, menos cobro manual y más tiempo para personas.' },
      { title: 'Para el liderazgo', text: 'Equipos coordinados con información confiable y menos mensajes sueltos.' },
      { title: 'Para la iglesia', text: 'Comunicación clara, accesible y consistente sobre la vida comunitaria.' },
    ],
    beforeTitle: 'El cambio se nota en la rutina.',
    before: ['Boletín manual', 'Turnos en hojas separadas', 'Avisos perdidos', 'Responsables sin visión única'],
    after: ['Boletín en flujo único', 'Turnos conectados al culto', 'Información compartible', 'Liderazgo con referencia común'],
    contactTitle: '¿Preparamos una demostración con la realidad de tu iglesia?',
    contactText:
      'Envía tus datos y un breve mensaje. La idea es mostrar OIKOS Hub usando una semana real: culto, boletín y turnos.',
    name: 'Nombre',
    contact: 'Contacto',
    contactPlaceholder: 'WhatsApp o correo',
    church: 'Iglesia',
    role: 'Función',
    message: 'Mensaje',
    submit: 'Enviar interés',
    sending: 'Enviando...',
    success: 'Recibimos tu interés. Este contacto quedó registrado para seguimiento.',
    error: 'No fue posible enviar ahora. Inténtalo nuevamente en unos instantes.',
    required: 'Completa nombre y contacto para enviar.',
  },
  en: {
    navCta: 'Schedule a call',
    eyebrow: 'OIKOS Hub for churches',
    title: 'A more organized church without losing pastoral care.',
    subtitle:
      'Bulletins, services, schedules, songs, members, and communication in one place. Simple for teams, clear for the church, useful for pastors.',
    primaryCta: 'I want a demo',
    secondaryCta: 'See what it delivers',
    heroMetricA: 'Public bulletin',
    heroMetricB: 'Services and schedules',
    heroMetricC: 'Pastoral records',
    problemTitle: 'The problem is not lack of care. It is scattered work.',
    problemText:
      'Every week someone rebuilds the bulletin, checks schedules, finds announcements, reminds volunteers, and keeps everything aligned across chats and spreadsheets.',
    problems: [
      'Important information gets lost in conversations.',
      'Schedules and services are separated from public communication.',
      'Leaders spend energy checking repetitive operations.',
      'Visitors and members do not always find what they need.',
    ],
    valueTitle: 'An operations hub for weekly church life.',
    valueText:
      'OIKOS Hub organizes what the church already does: services, liturgy, songs, schedules, announcements, birthdays, bulletins, and people records.',
    featuresTitle: 'Features that become pastoral value.',
    featuresText:
      'It is not another app to feed. It is a shared reference for leaders to see the week and care better.',
    features: [
      { title: 'Services and liturgies', text: 'Order of worship, texts, hymns, owners, and public content connected.' },
      { title: 'Songs and repertoire', text: 'Songs, hymns, key, lyrics, and organization for the music team.' },
      { title: 'Schedules', text: 'Volunteers, roles, dates, and sharing with less noise.' },
      { title: 'Public bulletin', text: 'Information ready for members, visitors, and social channels.' },
      { title: 'Members and visitors', text: 'Public registration, church links, pastoral data, and care history.' },
      { title: 'Community life', text: 'Announcements, birthdays, agenda, pastoral requests, and communication in one flow.' },
    ],
    audienceTitle: 'Why does this matter for a church?',
    audience: [
      { title: 'For pastors', text: 'More weekly visibility, less manual chasing, and more time for people.' },
      { title: 'For leaders', text: 'Teams coordinated with reliable information and fewer loose messages.' },
      { title: 'For the church', text: 'Clear, accessible, consistent communication about community life.' },
    ],
    beforeTitle: 'The change shows up in the routine.',
    before: ['Manual bulletin', 'Schedules in spreadsheets', 'Lost announcements', 'No shared view'],
    after: ['Bulletin in one flow', 'Schedules connected to services', 'Shareable information', 'Leadership with one reference'],
    contactTitle: 'Should we prepare a demo with your church reality?',
    contactText:
      'Send your details and a short message. The idea is to show OIKOS Hub using a real week: service, bulletin, and schedule.',
    name: 'Name',
    contact: 'Contact',
    contactPlaceholder: 'WhatsApp or email',
    church: 'Church',
    role: 'Role',
    message: 'Message',
    submit: 'Send interest',
    sending: 'Sending...',
    success: 'We received your interest. This contact is now registered for follow-up.',
    error: 'We could not send it right now. Please try again shortly.',
    required: 'Fill in name and contact before sending.',
  },
};

const featureIcons = [Church, Music, CalendarCheck, FileText, UsersRound, HeartHandshake];

export default function OikosLandingClient() {
  const locale = useLocale();
  const copy = COPY[locale] || COPY.pt;
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [igreja, setIgreja] = useState('');
  const [funcao, setFuncao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  const stats = useMemo(
    () => [copy.heroMetricA, copy.heroMetricB, copy.heroMetricC],
    [copy.heroMetricA, copy.heroMetricB, copy.heroMetricC]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nome.trim() || !contato.trim()) {
      setStatus('error');
      setFeedback(copy.required);
      return;
    }

    setStatus('loading');
    setFeedback('');

    try {
      const response = await fetch('/api/oikos-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          contato,
          igreja,
          funcao,
          mensagem,
          locale,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || copy.error);
      }

      setStatus('success');
      setFeedback(copy.success);
      setNome('');
      setContato('');
      setIgreja('');
      setFuncao('');
      setMensagem('');
    } catch (error: any) {
      setStatus('error');
      setFeedback(error.message || copy.error);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] pb-20 text-slate-950 sm:pb-0">
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-white/20 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
          <Link href="/oikos" className="flex items-center gap-2 text-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500 text-sm font-black text-slate-950 sm:h-9 sm:w-9">O</span>
            <span className="text-sm font-bold tracking-wide sm:text-base">OIKOS Hub</span>
          </Link>
          <a href="#contato" className="inline-flex max-w-[48vw] items-center justify-center gap-1.5 rounded bg-emerald-400 px-3 py-2 text-center text-xs font-bold leading-tight text-slate-950 transition hover:bg-emerald-300 sm:max-w-none sm:gap-2 sm:px-4 sm:text-sm">
            <span>{copy.navCta}</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-slate-950 pt-16 text-white sm:pt-20 lg:min-h-[92vh]">
        <Image
          src="/oikos/image-1-1.jpg"
          alt="Pastor conversando com membros da igreja"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_center] opacity-42 sm:opacity-45"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.96)_0%,rgba(2,6,23,0.88)_45%,rgba(2,6,23,0.76)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.75)_48%,rgba(2,6,23,0.25)_100%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10 lg:min-h-[calc(92vh-5rem)] lg:grid-cols-[1fr_0.85fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex max-w-full items-center gap-2 rounded border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100 sm:mb-5 sm:text-sm">
              <HeartHandshake className="h-4 w-4 shrink-0" />
              <span className="truncate">{copy.eyebrow}</span>
            </p>
            <h1 className="max-w-4xl text-[2.45rem] font-black leading-[1.03] sm:text-6xl lg:text-7xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:mt-6 sm:text-xl sm:leading-8">
              {copy.subtitle}
            </p>
            <div className="mt-7 grid gap-3 sm:mt-9 sm:flex sm:flex-row">
              <a href="#contato" className="inline-flex min-h-12 items-center justify-center gap-2 rounded bg-emerald-400 px-5 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-300 sm:px-6 sm:text-base">
                {copy.primaryCta}
                <Send className="h-4 w-4 shrink-0" />
              </a>
              <a href="#entrega" className="inline-flex min-h-12 items-center justify-center gap-2 rounded border border-white/25 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10 sm:px-6 sm:text-base">
                {copy.secondaryCta}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </a>
            </div>

            <div className="mt-6 grid gap-2 sm:hidden">
              {stats.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.08] p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-300/15 text-xs font-black text-emerald-200">
                    {index + 1}
                  </span>
                  <span className="min-w-0 text-sm font-semibold text-slate-100">{item}</span>
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-300" />
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="rounded border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
              <div className="rounded bg-slate-950/85 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-200">OIKOS Hub</p>
                    <p className="text-lg font-bold">Semana da igreja</p>
                  </div>
                  <ClipboardList className="h-6 w-6 text-emerald-300" />
                </div>
                <div className="space-y-3">
                  {stats.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded bg-white/[0.08] p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded bg-emerald-300/15 text-sm font-black text-emerald-200">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-slate-100">{item}</span>
                      <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:px-8">
          <div>
            <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.problemTitle}</h2>
            <p className="mt-3 text-base leading-7 text-slate-600 sm:mt-4 sm:text-lg sm:leading-8">{copy.problemText}</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            {copy.problems.map((item) => (
              <div key={item} className="rounded border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-600 sm:mb-4" />
                <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="entrega" className="bg-[#eef3ee] py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-end gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8">
            <div>
              <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.valueTitle}</h2>
              <p className="mt-3 text-base leading-7 text-slate-700 sm:mt-4 sm:text-lg sm:leading-8">{copy.valueText}</p>
            </div>
            <div className="relative min-h-[220px] overflow-hidden rounded border border-slate-200 bg-slate-900 sm:min-h-[280px]">
              <Image
                src="/oikos/image-3-1.jpg"
                alt="Aplicativo da igreja no celular"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="mt-10 sm:mt-12">
            <h3 className="text-2xl font-black leading-tight text-slate-950">{copy.featuresTitle}</h3>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{copy.featuresText}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:mt-8 lg:grid-cols-3 lg:gap-4">
              {copy.features.map((feature, index) => {
                const Icon = featureIcons[index] || CheckCircle2;
                return (
                  <article key={feature.title} className="rounded border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <Icon className="mb-4 h-6 w-6 text-emerald-700 sm:mb-5" />
                    <h4 className="text-lg font-black text-slate-950">{feature.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-12 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-3 lg:gap-10 lg:px-8">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-black leading-tight sm:text-4xl">{copy.audienceTitle}</h2>
          </div>
          <div className="grid gap-3 lg:col-span-2 lg:gap-4">
            {copy.audience.map((item) => (
              <div key={item.title} className="rounded border border-white/10 bg-white/[0.08] p-4 sm:p-5">
                <h3 className="text-lg font-black text-emerald-200 sm:text-xl">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-200 sm:text-base sm:leading-7">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.beforeTitle}</h2>
          <div className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-2 lg:gap-5">
            <div className="rounded border border-red-100 bg-red-50 p-4 sm:p-5">
              {copy.before.map((item) => (
                <p key={item} className="border-b border-red-100 py-2.5 text-sm font-bold text-red-950 last:border-b-0 sm:py-3">{item}</p>
              ))}
            </div>
            <div className="rounded border border-emerald-100 bg-emerald-50 p-4 sm:p-5">
              {copy.after.map((item) => (
                <p key={item} className="border-b border-emerald-100 py-2.5 text-sm font-bold text-emerald-950 last:border-b-0 sm:py-3">{item}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contato" className="bg-[#f7f8f4] py-12 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:px-8">
          <div>
            <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.contactTitle}</h2>
            <p className="mt-3 text-base leading-7 text-slate-700 sm:mt-4 sm:text-lg sm:leading-8">{copy.contactText}</p>
            <div className="mt-6 overflow-hidden rounded border border-slate-200 sm:mt-8">
              <Image
                src="/oikos/image-2-1.jpg"
                alt="Pastor revisando informações da semana"
                width={900}
                height={900}
                className="h-56 w-full object-cover sm:h-80"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{copy.name} *</span>
                <input value={nome} onChange={(event) => setNome(event.target.value)} className="min-h-12 w-full rounded border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{copy.contact} *</span>
                <input value={contato} onChange={(event) => setContato(event.target.value)} placeholder={copy.contactPlaceholder} className="min-h-12 w-full rounded border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{copy.church}</span>
                <input value={igreja} onChange={(event) => setIgreja(event.target.value)} className="min-h-12 w-full rounded border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">{copy.role}</span>
                <input value={funcao} onChange={(event) => setFuncao(event.target.value)} className="min-h-12 w-full rounded border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-700">{copy.message}</span>
              <textarea value={mensagem} onChange={(event) => setMensagem(event.target.value)} rows={4} className="w-full resize-none rounded border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 sm:rows-5" />
            </label>
            {feedback ? (
              <p className={`mt-4 rounded px-4 py-3 text-sm font-semibold ${status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {feedback}
              </p>
            ) : null}
            <button type="submit" disabled={status === 'loading'} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
              {status === 'loading' ? copy.sending : copy.submit}
            </button>
          </form>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden">
        <a href="#contato" className="flex min-h-12 items-center justify-center gap-2 rounded bg-emerald-500 px-4 py-3 text-center text-sm font-black text-slate-950">
          {copy.primaryCta}
          <ArrowRight className="h-4 w-4 shrink-0" />
        </a>
      </div>
    </main>
  );
}
