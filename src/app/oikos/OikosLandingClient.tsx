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
  LogIn,
  Mail,
  MapPin,
  Music,
  Send,
  UsersRound,
  X,
} from 'lucide-react';
import { useLocale } from '@/i18n/provider';

const IGREJAS_PARCEIRAS = [
  {
    nome: 'Igreja Presbiteriana da Ponta Negra',
    sigla: 'IPPN Manaus',
    local: 'Manaus, Brasil',
    slug: 'ippn-manaus',
    logo: '/oikos/igrejas/ippn-manaus.jpg',
    endereco: [
      'Av. Coronel Teixeira, 5982 – Ponta Negra',
      'Dulcila Festas e Convenções, salão Delta',
      'Manaus – AM, 69037-032',
    ],
  },
  {
    nome: 'Igreja Cristã Presbiteriana do Barreiro',
    sigla: 'ICPB',
    local: 'Barreiro, Portugal',
    slug: 'icpb',
    logo: '/oikos/igrejas/icpb.jpg',
    endereco: ['Rua Heliodoro Salgado, 25A – Verderena', '2830-311 Barreiro'],
  },
  {
    nome: 'Igreja Cristã Presbiteriana de Telheiras',
    sigla: 'ICPT',
    local: 'Telheiras, Portugal',
    slug: 'icpt',
    logo: '/oikos/igrejas/icpt.jpg',
    endereco: ['Rua Professor Fernando da Fonseca, 28A', '1600-673 Lisboa'],
  },
];

type Copy = {
  navCta: string;
  loginCta: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  heroMetricA: string;
  heroMetricB: string;
  heroMetricC: string;
  churchesEyebrow: string;
  churchesTitle: string;
  churchesText: string;
  churchesCta: string;
  churchesMap: string;
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
    loginCta: 'Entrar',
    eyebrow: 'OIKOS Hub para igrejas',
    title: 'A igreja organizada sem perder o cuidado pastoral.',
    subtitle:
      'Boletins, cultos, escalas, louvores, membros e comunicação em um só lugar. Simples para a equipe, claro para a igreja, útil para o pastor.',
    primaryCta: 'Quero ver uma demonstração',
    secondaryCta: 'Ver o que o sistema entrega',
    heroMetricA: 'Boletim público',
    heroMetricB: 'Cultos e escalas',
    heroMetricC: 'Cadastro pastoral',
    churchesEyebrow: 'Já em uso',
    churchesTitle: 'Igrejas que já estão usando o OIKOS Hub.',
    churchesText:
      'Três igrejas, em dois países, já publicam o boletim semanal e organizam a vida da comunidade pelo OIKOS Hub. Escolha uma abaixo e veja o boletim ao vivo.',
    churchesCta: 'Ver boletim',
    churchesMap: 'Abrir no mapa',
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
    loginCta: 'Ingresar',
    eyebrow: 'OIKOS Hub para iglesias',
    title: 'La iglesia organizada sin perder el cuidado pastoral.',
    subtitle:
      'Boletines, cultos, turnos, alabanzas, miembros y comunicación en un solo lugar. Simple para el equipo, claro para la iglesia, útil para el pastor.',
    primaryCta: 'Quiero ver una demostración',
    secondaryCta: 'Ver lo que entrega',
    heroMetricA: 'Boletín público',
    heroMetricB: 'Cultos y turnos',
    heroMetricC: 'Registro pastoral',
    churchesEyebrow: 'Ya en uso',
    churchesTitle: 'Iglesias que ya están usando OIKOS Hub.',
    churchesText:
      'Tres iglesias, en dos países, ya publican el boletín semanal y organizan la vida de la comunidad con OIKOS Hub. Elige una abajo y mira el boletín en vivo.',
    churchesCta: 'Ver boletín',
    churchesMap: 'Abrir en el mapa',
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
    loginCta: 'Sign in',
    eyebrow: 'OIKOS Hub for churches',
    title: 'A more organized church without losing pastoral care.',
    subtitle:
      'Bulletins, services, schedules, songs, members, and communication in one place. Simple for teams, clear for the church, useful for pastors.',
    primaryCta: 'I want a demo',
    secondaryCta: 'See what it delivers',
    heroMetricA: 'Public bulletin',
    heroMetricB: 'Services and schedules',
    heroMetricC: 'Pastoral records',
    churchesEyebrow: 'Already in use',
    churchesTitle: 'Churches already using OIKOS Hub.',
    churchesText:
      'Three churches, in two countries, already publish their weekly bulletin and run community life through OIKOS Hub. Pick one below and see the live bulletin.',
    churchesCta: 'View bulletin',
    churchesMap: 'Open in maps',
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

  const inputClass =
    'min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-base outline-none transition duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100';
  const labelClass = 'mb-2 block text-sm font-medium text-slate-600';

  return (
    <main className="min-h-screen bg-slate-50 pb-24 text-slate-950 antialiased sm:pb-0">
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
          <Link href="/oikos" className="flex items-center gap-2.5 text-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 sm:h-9 sm:w-9">O</span>
            <span className="text-sm font-semibold tracking-wide sm:text-base">OIKOS Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-white/90 transition duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white sm:gap-2 sm:text-sm">
              <LogIn className="h-4 w-4 shrink-0" />
              <span>{copy.loginCta}</span>
            </Link>
            <a href="#contato" className="hidden min-h-10 items-center justify-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-center text-xs font-semibold leading-tight text-slate-950 transition duration-200 hover:bg-emerald-300 sm:inline-flex sm:gap-2 sm:px-5 sm:text-sm">
              <span>{copy.navCta}</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-slate-950 pt-16 text-white sm:pt-20 lg:min-h-[92vh]">
        <Image
          src="/oikos/image-1-1.jpg"
          alt="Pastor conversando com membros da igreja"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_center] opacity-50"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.9)_0%,rgba(2,6,23,0.8)_45%,rgba(2,6,23,0.7)_100%)] lg:bg-[linear-gradient(90deg,rgba(2,6,23,0.9)_0%,rgba(2,6,23,0.65)_50%,rgba(2,6,23,0.2)_100%)]" />
        <div className="pointer-events-none absolute -left-32 top-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-slate-950/40" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-12 lg:min-h-[calc(92vh-5rem)] lg:grid-cols-[1fr_0.8fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-1.5 text-xs font-medium text-emerald-100 backdrop-blur sm:mb-6 sm:text-sm">
              <HeartHandshake className="h-4 w-4 shrink-0" />
              <span className="truncate">{copy.eyebrow}</span>
            </p>
            <h1 className="max-w-4xl text-[2.35rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.25rem]">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-7 text-slate-300 sm:mt-7 sm:text-xl sm:leading-8">
              {copy.subtitle}
            </p>
            <div className="mt-8 grid gap-3 sm:mt-10 sm:flex sm:flex-row sm:flex-wrap">
              <a href="#contato" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-xl hover:shadow-emerald-500/30 sm:text-base">
                {copy.primaryCta}
                <Send className="h-4 w-4 shrink-0" />
              </a>
              <a href="#entrega" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-medium text-white backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10 sm:text-base">
                {copy.secondaryCta}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </a>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-center text-sm font-medium text-emerald-100 transition duration-200 hover:bg-white/5 hover:text-white sm:text-base">
                {copy.loginCta}
                <LogIn className="h-4 w-4 shrink-0" />
              </Link>
            </div>

            <div className="mt-8 grid gap-2 sm:hidden">
              {stats.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-xs font-semibold text-emerald-200">
                    {index + 1}
                  </span>
                  <span className="min-w-0 text-sm font-medium text-slate-100">{item}</span>
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-300" />
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="rounded-3xl bg-slate-950/70 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-200/80">OIKOS Hub</p>
                    <p className="mt-1 text-lg font-semibold">Semana da igreja</p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/10">
                    <ClipboardList className="h-5 w-5 text-emerald-300" />
                  </span>
                </div>
                <div className="space-y-2.5">
                  {stats.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3.5 transition duration-200 hover:bg-white/[0.09]">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-300/15 text-sm font-semibold text-emerald-200">
                        {index + 1}
                      </span>
                      <span className="font-medium text-slate-100">{item}</span>
                      <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-300" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="igrejas" className="scroll-mt-16 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-emerald-800 sm:text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {copy.churchesEyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            {copy.churchesTitle}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500 sm:mt-5 sm:text-lg sm:leading-8">
            {copy.churchesText}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:mt-10">
            {IGREJAS_PARCEIRAS.map((igreja) => (
              <article
                key={igreja.slug}
                className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-lg hover:shadow-slate-200/60 sm:p-6"
              >
                <Link href={`/${igreja.slug}`} className="group flex items-center gap-4">
                  <span className="relative flex h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white ring-4 ring-white shadow-md shadow-slate-200 sm:h-16 sm:w-16">
                    <Image src={igreja.logo} alt={igreja.nome} fill sizes="64px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-slate-950 sm:text-lg">{igreja.sigla}</span>
                    <span className="block truncate text-xs text-slate-500 sm:text-sm">{igreja.local}</span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 sm:text-sm">
                      {copy.churchesCta}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
                <address className="mt-4 flex flex-1 gap-2.5 border-t border-slate-200/70 pt-4 text-sm not-italic leading-6 text-slate-600">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="min-w-0">
                    {igreja.endereco.map((linha) => (
                      <span key={linha} className="block">{linha}</span>
                    ))}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${igreja.nome}, ${igreja.endereco.join(', ')}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 sm:text-sm"
                    >
                      {copy.churchesMap}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </span>
                </address>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.problemTitle}</h2>
            <p className="mt-4 text-base leading-7 text-slate-500 sm:mt-5 sm:text-lg sm:leading-8">{copy.problemText}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {copy.problems.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-slate-200/60 sm:p-6">
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </span>
                <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="entrega" className="scroll-mt-16 bg-emerald-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.valueTitle}</h2>
              <p className="mt-4 text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">{copy.valueText}</p>
            </div>
            <div className="relative min-h-[220px] overflow-hidden rounded-3xl bg-slate-900 shadow-xl shadow-slate-900/10 sm:min-h-[300px]">
              <Image
                src="/oikos/image-3-1.jpg"
                alt="Aplicativo da igreja no celular"
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="mt-14 sm:mt-20">
            <h3 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950">{copy.featuresTitle}</h3>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">{copy.featuresText}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:mt-10 lg:grid-cols-3 lg:gap-5">
              {copy.features.map((feature, index) => {
                const Icon = featureIcons[index] || CheckCircle2;
                return (
                  <article key={feature.title} className="group rounded-3xl border border-white bg-white/80 p-6 shadow-sm shadow-slate-200/50 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-slate-200/70 sm:p-7">
                    <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 transition duration-300 group-hover:bg-emerald-100">
                      <Icon className="h-6 w-6 text-emerald-700" />
                    </span>
                    <h4 className="text-lg font-semibold text-slate-950">{feature.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-slate-950 py-16 text-white sm:py-24">
        <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:gap-14 lg:px-8">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">{copy.audienceTitle}</h2>
          </div>
          <div className="grid gap-3 lg:col-span-2 lg:gap-4">
            {copy.audience.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 transition duration-300 hover:border-white/15 hover:bg-white/[0.07] sm:p-6">
                <h3 className="text-lg font-semibold text-emerald-200 sm:text-xl">{item.title}</h3>
                <p className="mt-2 text-sm font-light leading-6 text-slate-300 sm:text-base sm:leading-7">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.beforeTitle}</h2>
          <div className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-2 lg:gap-6">
            <div className="rounded-3xl bg-red-50/70 p-5 sm:p-7">
              {copy.before.map((item) => (
                <p key={item} className="flex items-center gap-3 border-b border-red-100/70 py-3 text-sm font-medium text-red-950/80 last:border-b-0 sm:py-3.5">
                  <X className="h-4 w-4 shrink-0 text-red-400" />
                  {item}
                </p>
              ))}
            </div>
            <div className="rounded-3xl bg-emerald-50/80 p-5 sm:p-7">
              {copy.after.map((item) => (
                <p key={item} className="flex items-center gap-3 border-b border-emerald-100/70 py-3 text-sm font-medium text-emerald-950 last:border-b-0 sm:py-3.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contato" className="scroll-mt-16 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">{copy.contactTitle}</h2>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:mt-5 sm:text-lg sm:leading-8">{copy.contactText}</p>
            <div className="mt-8 overflow-hidden rounded-3xl shadow-xl shadow-slate-900/10 sm:mt-10">
              <Image
                src="/oikos/image-2-1.jpg"
                alt="Pastor revisando informações da semana"
                width={900}
                height={900}
                className="h-56 w-full object-cover sm:h-80"
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="self-start rounded-3xl border border-white bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{copy.name} *</span>
                <input value={nome} onChange={(event) => setNome(event.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>{copy.contact} *</span>
                <input value={contato} onChange={(event) => setContato(event.target.value)} placeholder={copy.contactPlaceholder} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>{copy.church}</span>
                <input value={igreja} onChange={(event) => setIgreja(event.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>{copy.role}</span>
                <input value={funcao} onChange={(event) => setFuncao(event.target.value)} className={inputClass} />
              </label>
            </div>
            <label className="mt-4 block">
              <span className={labelClass}>{copy.message}</span>
              <textarea value={mensagem} onChange={(event) => setMensagem(event.target.value)} rows={4} className={`${inputClass} resize-none`} />
            </label>
            {feedback ? (
              <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                {feedback}
              </p>
            ) : null}
            <button type="submit" disabled={status === 'loading'} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-medium text-white shadow-lg shadow-slate-900/15 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {status === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
              {status === 'loading' ? copy.sending : copy.submit}
            </button>
          </form>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:hidden">
        <a href="#contato" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 shadow-xl shadow-emerald-900/25">
          {copy.primaryCta}
          <ArrowRight className="h-4 w-4 shrink-0" />
        </a>
      </div>
    </main>
  );
}
