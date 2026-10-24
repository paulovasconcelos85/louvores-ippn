'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Church,
  Globe,
  HelpCircle,
  Loader2,
  LogIn,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/provider';
import { supabase } from '@/lib/supabase';
import { CHURCH_STORAGE_KEY } from '@/lib/church-utils';
import { normalizarSlug } from '@/lib/slug-igreja';

type Passo = 1 | 2 | 3;

type Disponibilidade = {
  slug: string;
  disponivel: boolean;
  motivo: 'curto' | 'longo' | 'formato' | 'reservado' | 'ocupado' | null;
  sugestoes: string[];
};

const PAISES = [
  { valor: 'BR', pt: 'Brasil', es: 'Brasil', en: 'Brazil' },
  { valor: 'PT', pt: 'Portugal', es: 'Portugal', en: 'Portugal' },
  { valor: 'AO', pt: 'Angola', es: 'Angola', en: 'Angola' },
  { valor: 'MZ', pt: 'Moçambique', es: 'Mozambique', en: 'Mozambique' },
  { valor: 'US', pt: 'Estados Unidos', es: 'Estados Unidos', en: 'United States' },
  { valor: 'CA', pt: 'Canadá', es: 'Canadá', en: 'Canada' },
  { valor: 'ES', pt: 'Espanha', es: 'España', en: 'Spain' },
  { valor: 'AR', pt: 'Argentina', es: 'Argentina', en: 'Argentina' },
  { valor: 'MX', pt: 'México', es: 'México', en: 'Mexico' },
  { valor: 'OUTRO', pt: 'Outro', es: 'Otro', en: 'Other' },
];

const DIAS = [
  { valor: 'domingo', pt: 'Domingo', es: 'Domingo', en: 'Sunday' },
  { valor: 'sabado', pt: 'Sábado', es: 'Sábado', en: 'Saturday' },
  { valor: 'quarta', pt: 'Quarta-feira', es: 'Miércoles', en: 'Wednesday' },
  { valor: 'quinta', pt: 'Quinta-feira', es: 'Jueves', en: 'Thursday' },
  { valor: 'sexta', pt: 'Sexta-feira', es: 'Viernes', en: 'Friday' },
];

export default function ComecarClient() {
  const router = useRouter();
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) => (locale === 'es' ? es : locale === 'en' ? en : pt),
    [locale]
  );
  const { user, loading: authLoading } = useAuth();

  const [passo, setPasso] = useState<Passo>(1);
  const [nome, setNome] = useState('');
  const [sigla, setSigla] = useState('');
  const [cidade, setCidade] = useState('');
  const [regiao, setRegiao] = useState('');
  const [pais, setPais] = useState('BR');
  const [cultoDia, setCultoDia] = useState('domingo');
  const [cultoHorario, setCultoHorario] = useState('10:00');

  const [slug, setSlug] = useState('');
  const slugEditado = useRef(false);
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [verificando, setVerificando] = useState(false);

  const [responsavel, setResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState<'pastor' | 'admin'>('pastor');
  const [website, setWebsite] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroCodigo, setErroCodigo] = useState('');
  const [origem, setOrigem] = useState('');

  useEffect(() => {
    setOrigem(window.location.host);
  }, []);

  // Sugere e verifica o endereço enquanto a pessoa digita.
  useEffect(() => {
    if (!nome.trim() && !slug) {
      setDisp(null);
      return;
    }

    const timer = setTimeout(async () => {
      setVerificando(true);
      try {
        const params = new URLSearchParams({ nome, sigla, cidade });
        if (slugEditado.current && slug) params.set('slug', slug);
        const response = await fetch(`/api/igrejas/disponibilidade?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        if (!slugEditado.current) {
          const sugerido = data.sugestoes?.[0] || '';
          setSlug(sugerido);
          setDisp({
            slug: sugerido,
            disponivel: Boolean(sugerido),
            motivo: null,
            sugestoes: (data.sugestoes || []).slice(1),
          });
        } else {
          setDisp(data);
        }
      } catch {
        setDisp(null);
      } finally {
        setVerificando(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [nome, sigla, cidade, slug]);

  const motivoTexto = useMemo(() => {
    switch (disp?.motivo) {
      case 'curto':
        return tr('Use pelo menos 3 caracteres.', 'Usa al menos 3 caracteres.', 'Use at least 3 characters.');
      case 'longo':
        return tr('Use no máximo 40 caracteres.', 'Usa como máximo 40 caracteres.', 'Use at most 40 characters.');
      case 'formato':
        return tr('Só letras minúsculas, números e hífen.', 'Solo minúsculas, números y guion.', 'Only lowercase letters, numbers and hyphens.');
      case 'reservado':
        return tr('Este nome é reservado pelo sistema.', 'Este nombre está reservado por el sistema.', 'This name is reserved by the system.');
      case 'ocupado':
        return tr('Outra igreja já usa este endereço.', 'Otra iglesia ya usa esta dirección.', 'Another church already uses this address.');
      default:
        return '';
    }
  }, [disp?.motivo, tr]);

  const passo1Ok = nome.trim().length >= 4 && cidade.trim().length >= 2;
  const passo2Ok = Boolean(slug) && Boolean(disp?.disponivel) && !verificando;
  const passo3Ok = user
    ? true
    : responsavel.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && senha.length >= 8;

  async function criarIgreja(event: FormEvent) {
    event.preventDefault();
    if (!passo3Ok || enviando) return;

    setEnviando(true);
    setErro('');
    setErroCodigo('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/igrejas/criar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          nome,
          sigla,
          cidade,
          regiao,
          pais,
          slug,
          cargo,
          culto_dia: cultoDia,
          culto_horario: cultoHorario,
          responsavel_nome: responsavel,
          email: email.trim(),
          senha,
          website,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErroCodigo(data.code || '');
        if (data.code === 'SLUG_TAKEN') {
          slugEditado.current = true;
          setPasso(2);
        }
        throw new Error(data.error || tr('Não foi possível criar a igreja.', 'No fue posible crear la iglesia.', 'Could not create the church.'));
      }

      if (data.contaCriada) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (loginError) throw loginError;
      }

      const {
        data: { session: novaSessao },
      } = await supabase.auth.getSession();

      if (novaSessao?.access_token) {
        await fetch('/api/finalizar-acesso', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${novaSessao.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ igreja_id: data.igreja.id }),
        });
      }

      try {
        localStorage.setItem(CHURCH_STORAGE_KEY, data.igreja.id);
      } catch {
        // armazenamento indisponível: o painel resolve a igreja pelo vínculo
      }

      router.push(`/admin?boas-vindas=1&igreja_id=${encodeURIComponent(data.igreja.id)}`);
    } catch (error: any) {
      setErro(error.message || tr('Não foi possível criar a igreja.', 'No fue posible crear la iglesia.', 'Could not create the church.'));
      setEnviando(false);
    }
  }

  const inputClass =
    'min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100';
  const labelClass = 'mb-2 block text-sm font-medium text-slate-700';
  const dicaClass = 'mt-1.5 text-xs leading-5 text-slate-500';

  const passos = [
    { n: 1, titulo: tr('Sua igreja', 'Tu iglesia', 'Your church'), Icon: Church },
    { n: 2, titulo: tr('Endereço', 'Dirección', 'Address'), Icon: Globe },
    { n: 3, titulo: tr('Seu acesso', 'Tu acceso', 'Your access'), Icon: UserRound },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-slate-950">O</span>
            <span className="text-sm font-semibold sm:text-base">OIKOS Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/ajuda" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-slate-600 hover:bg-slate-100">
              <HelpCircle className="h-4 w-4" />
              {tr('Ajuda', 'Ayuda', 'Help')}
            </Link>
            {!user && (
              <Link href="/login" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-100">
                <LogIn className="h-4 w-4" />
                {tr('Entrar', 'Ingresar', 'Sign in')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          {tr('Comece agora — leva 3 minutos', 'Empieza ahora — toma 3 minutos', 'Start now — takes 3 minutes')}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {tr('Crie o espaço da sua igreja no OIKOS Hub', 'Crea el espacio de tu iglesia en OIKOS Hub', "Create your church's space on OIKOS Hub")}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          {tr(
            'Você sai daqui com o painel pronto e o endereço público do boletim. Depois, um roteiro de primeiros passos guia o resto.',
            'Sales de aquí con el panel listo y la dirección pública del boletín. Después, una guía de primeros pasos te acompaña.',
            'You leave with the dashboard ready and the public bulletin address. Then a first-steps guide walks you through the rest.'
          )}
        </p>

        <ol className="mt-8 grid grid-cols-3 gap-2">
          {passos.map(({ n, titulo, Icon }) => {
            const ativo = passo === n;
            const feito = passo > n;
            return (
              <li
                key={n}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm ${
                  ativo
                    ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900'
                    : feito
                      ? 'border-slate-200 bg-white text-slate-700'
                      : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {feito ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{titulo}</span>
              </li>
            );
          })}
        </ol>

        <form onSubmit={criarIgreja} className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {/* Campo invisível contra robôs */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          {passo === 1 && (
            <div className="grid gap-5">
              <label className="block">
                <span className={labelClass}>{tr('Nome da igreja *', 'Nombre de la iglesia *', 'Church name *')}</span>
                <input
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder={tr('Ex.: Igreja Presbiteriana da Ponta Negra', 'Ej.: Iglesia Presbiteriana Central', 'E.g. Grace Presbyterian Church')}
                  className={inputClass}
                  autoFocus
                />
                <p className={dicaClass}>{tr('Como aparece na fachada e nos documentos.', 'Como aparece en la fachada y en los documentos.', 'As it appears on the building and documents.')}</p>
              </label>

              <label className="block">
                <span className={labelClass}>{tr('Sigla ou nome curto', 'Sigla o nombre corto', 'Acronym or short name')}</span>
                <input
                  value={sigla}
                  onChange={(event) => setSigla(event.target.value)}
                  placeholder={tr('Ex.: IPPN', 'Ej.: IPC', 'E.g. GPC')}
                  className={inputClass}
                  maxLength={30}
                />
                <p className={dicaClass}>
                  {tr(
                    'Opcional. Se deixar em branco, usamos as iniciais do nome para sugerir o endereço.',
                    'Opcional. Si lo dejas vacío, usamos las iniciales del nombre para sugerir la dirección.',
                    'Optional. If empty, we use the name initials to suggest the address.'
                  )}
                </p>
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>{tr('Cidade *', 'Ciudad *', 'City *')}</span>
                  <input value={cidade} onChange={(event) => setCidade(event.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>{tr('Estado / região', 'Estado / región', 'State / region')}</span>
                  <input value={regiao} onChange={(event) => setRegiao(event.target.value)} placeholder={pais === 'BR' ? 'AM' : ''} className={inputClass} />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>{tr('País', 'País', 'Country')}</span>
                <select value={pais} onChange={(event) => setPais(event.target.value)} className={inputClass}>
                  {PAISES.map((item) => (
                    <option key={item.valor} value={item.valor}>
                      {tr(item.pt, item.es, item.en)}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className={labelClass}>{tr('Culto principal', 'Culto principal', 'Main service')}</span>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <select value={cultoDia} onChange={(event) => setCultoDia(event.target.value)} className={inputClass}>
                    {DIAS.map((dia) => (
                      <option key={dia.valor} value={dia.valor}>
                        {tr(dia.pt, dia.es, dia.en)}
                      </option>
                    ))}
                  </select>
                  <input type="time" value={cultoHorario} onChange={(event) => setCultoHorario(event.target.value)} className={`${inputClass} w-32`} />
                </div>
                <p className={dicaClass}>{tr('Aparece na página pública. Você pode adicionar outros cultos depois.', 'Aparece en la página pública. Puedes añadir otros cultos después.', 'Shown on the public page. You can add more services later.')}</p>
              </div>
            </div>
          )}

          {passo === 2 && (
            <div className="grid gap-5">
              <div>
                <span className={labelClass}>{tr('Endereço público da igreja', 'Dirección pública de la iglesia', 'Public church address')}</span>
                <div className="flex min-h-12 items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
                  <span className="shrink-0 pl-4 text-sm text-slate-400 sm:text-base">{origem || 'oikoshub'}/</span>
                  <input
                    value={slug}
                    onChange={(event) => {
                      slugEditado.current = true;
                      // Normalização completa só no blur, para o hífen digitado não sumir.
                      setSlug(
                        event.target.value
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(/[̀-ͯ]/g, '')
                          .replace(/[^a-z0-9-]+/g, '-')
                          .replace(/-{2,}/g, '-')
                          .replace(/^-/, '')
                          .slice(0, 40)
                      );
                    }}
                    onBlur={() => setSlug((atual) => normalizarSlug(atual))}
                    className="min-w-0 flex-1 bg-transparent px-1 py-3 text-base font-semibold text-slate-900 outline-none"
                    autoFocus
                  />
                  <span className="shrink-0 pr-4">
                    {verificando ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : disp?.disponivel ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : slug ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : null}
                  </span>
                </div>
                {!verificando && disp?.disponivel && (
                  <p className="mt-2 text-sm font-medium text-emerald-700">{tr('Disponível!', '¡Disponible!', 'Available!')}</p>
                )}
                {!verificando && motivoTexto && <p className="mt-2 text-sm font-medium text-red-600">{motivoTexto}</p>}
                <p className={dicaClass}>
                  {tr(
                    'É o link que você vai mandar para a igreja e para visitantes: abre o boletim da semana e pode ser instalado no celular como app. Curto é melhor — as iniciais costumam funcionar bem.',
                    'Es el enlace que enviarás a la iglesia y a los visitantes: abre el boletín de la semana y se puede instalar en el móvil como app. Corto es mejor — las iniciales suelen funcionar bien.',
                    'This is the link you share with the church and visitors: it opens the weekly bulletin and can be installed on phones as an app. Shorter is better — initials usually work well.'
                  )}
                </p>
              </div>

              {disp?.sugestoes && disp.sugestoes.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-slate-600">{tr('Outras opções livres:', 'Otras opciones libres:', 'Other available options:')}</p>
                  <div className="flex flex-wrap gap-2">
                    {disp.sugestoes.map((sugestao) => (
                      <button
                        key={sugestao}
                        type="button"
                        onClick={() => {
                          slugEditado.current = true;
                          setSlug(sugestao);
                        }}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        {sugestao}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {passo === 3 && (
            <div className="grid gap-5">
              {authLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : user ? (
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  {tr('Você já está conectado como', 'Ya estás conectado como', 'You are signed in as')} <strong>{user.email}</strong>.{' '}
                  {tr('A nova igreja será adicionada à sua conta.', 'La nueva iglesia se añadirá a tu cuenta.', 'The new church will be added to your account.')}
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className={labelClass}>{tr('Seu nome *', 'Tu nombre *', 'Your name *')}</span>
                    <input value={responsavel} onChange={(event) => setResponsavel(event.target.value)} autoComplete="name" className={inputClass} autoFocus />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{tr('Seu e-mail *', 'Tu correo *', 'Your email *')}</span>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={inputClass} />
                    <p className={dicaClass}>{tr('Você vai entrar no painel com este e-mail.', 'Entrarás al panel con este correo.', 'You will sign in to the dashboard with this email.')}</p>
                  </label>
                  <label className="block">
                    <span className={labelClass}>{tr('Crie uma senha *', 'Crea una contraseña *', 'Create a password *')}</span>
                    <input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} autoComplete="new-password" minLength={8} className={inputClass} />
                    <p className={dicaClass}>{tr('Mínimo de 8 caracteres.', 'Mínimo de 8 caracteres.', 'At least 8 characters.')}</p>
                  </label>
                </>
              )}

              <fieldset>
                <legend className={labelClass}>{tr('Qual é o seu papel na igreja?', '¿Cuál es tu papel en la iglesia?', 'What is your role in the church?')}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { valor: 'pastor' as const, titulo: tr('Sou pastor(a)', 'Soy pastor(a)', 'I am a pastor'), texto: tr('Acesso completo, incluindo pedidos pastorais.', 'Acceso completo, incluidos pedidos pastorales.', 'Full access, including pastoral requests.') },
                    { valor: 'admin' as const, titulo: tr('Liderança / secretaria', 'Liderazgo / secretaría', 'Leadership / office'), texto: tr('Administra a igreja e libera acessos da equipe.', 'Administra la iglesia y da acceso al equipo.', 'Manages the church and grants team access.') },
                  ].map((opcao) => (
                    <label
                      key={opcao.valor}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        cargo === opcao.valor ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input type="radio" name="cargo" value={opcao.valor} checked={cargo === opcao.valor} onChange={() => setCargo(opcao.valor)} className="sr-only" />
                      <span className="block text-sm font-semibold text-slate-900">{opcao.titulo}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{opcao.texto}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-800">{tr('Resumo', 'Resumen', 'Summary')}</p>
                <p>{nome}{sigla ? ` (${sigla})` : ''} — {cidade}</p>
                <p>
                  {tr('Endereço:', 'Dirección:', 'Address:')} <strong>{origem}/{slug}</strong>
                </p>
              </div>
            </div>
          )}

          {erro && (
            <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {erro}
              {erroCodigo === 'EMAIL_ALREADY_REGISTERED' && (
                <Link href="/login?next=/comecar" className="ml-1 underline">
                  {tr('Entrar agora', 'Ingresar ahora', 'Sign in now')}
                </Link>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            {passo > 1 ? (
              <button
                type="button"
                onClick={() => setPasso((atual) => (atual - 1) as Passo)}
                className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                {tr('Voltar', 'Volver', 'Back')}
              </button>
            ) : (
              <span />
            )}

            {passo < 3 ? (
              <button
                type="button"
                disabled={passo === 1 ? !passo1Ok : !passo2Ok}
                onClick={() => setPasso((atual) => (atual + 1) as Passo)}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tr('Continuar', 'Continuar', 'Continue')}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!passo3Ok || enviando}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {enviando ? tr('Criando...', 'Creando...', 'Creating...') : tr('Criar minha igreja', 'Crear mi iglesia', 'Create my church')}
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-500">
          {tr('Ao criar, você concorda com a', 'Al crear, aceptas la', 'By creating, you agree to the')}{' '}
          <Link href="/privacidade" className="underline">{tr('política de privacidade', 'política de privacidad', 'privacy policy')}</Link>.{' '}
          {tr('Dúvidas?', '¿Dudas?', 'Questions?')}{' '}
          <Link href="/ajuda" className="underline">{tr('Veja a Ajuda', 'Mira la Ayuda', 'See Help')}</Link>.
        </p>
      </div>
    </main>
  );
}
