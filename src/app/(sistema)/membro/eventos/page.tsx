'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale, useTranslations } from '@/i18n/provider';
import { getStoredChurchId } from '@/lib/church-utils';

interface Evento {
  id: string;
  titulo: string;
  data: string;
  hora: string | null;
  local: string | null;
  descricao: string;
  imagemUrl: string | null;
}

function formatarData(data: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${data}T00:00:00`));
}

export default function MembroEventosPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && !permissoes.ehMembroComum) {
      router.push(permissoes.podeAcessarAdmin ? '/admin' : '/');
    }
  }, [user, loading, permissoes.ehMembroComum, permissoes.podeAcessarAdmin, router]);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const params = new URLSearchParams();
        const igrejaId = getStoredChurchId();
        if (igrejaId) params.set('igreja_id', igrejaId);

        const response = await fetch(`/api/eventos?${params.toString()}`);
        const data = await response.json();
        if (ativo && response.ok) {
          setEventos((data.eventos || []) as Evento[]);
        }
      } catch (error) {
        console.error('Erro ao carregar eventos:', error);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  if (loading || !permissoes.ehMembroComum) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.push('/membro')}
            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('memberArea.back')}
          </button>
          <h1 className="ml-2 text-lg font-bold text-slate-900">{t('memberArea.events')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {carregando ? (
          <p className="text-slate-500">...</p>
        ) : eventos.length === 0 ? (
          <p className="text-slate-500">{t('memberArea.eventsEmpty')}</p>
        ) : (
          eventos.map((evento) => (
            <article key={evento.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              {evento.imagemUrl ? (
                <div
                  className="aspect-video bg-slate-900"
                  style={{
                    backgroundImage: `url("${evento.imagemUrl}")`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                  }}
                />
              ) : null}
              <div className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {formatarData(evento.data, locale)}
                  </span>
                  {evento.hora ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-4 w-4" />
                      {evento.hora.slice(0, 5)}
                    </span>
                  ) : null}
                  {evento.local ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {evento.local}
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg font-bold text-slate-900">{evento.titulo}</h2>
                {evento.descricao ? <p className="text-slate-700">{evento.descricao}</p> : null}
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
