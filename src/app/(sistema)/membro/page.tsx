'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Music,
  ScrollText,
  Library,
  Calendar,
  CalendarDays,
  Cake,
  Users,
  Heart,
  History,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslations } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { CHURCH_STORAGE_KEY, type IgrejaSelecionavel } from '@/lib/church-utils';

export default function MembroPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { usuarioPermitido, loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  const [igreja, setIgreja] = useState<IgrejaSelecionavel | null>(null);

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
    if (!user?.id) return;

    let ativo = true;

    (async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis', {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await response.json();
        if (!ativo || !response.ok) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        const igrejaId = data.igrejaAtualId || lista[0]?.id || '';
        const atual = lista.find((item) => item.id === igrejaId) || lista[0] || null;

        setIgreja(atual);
        if (atual?.id) {
          window.localStorage.setItem(CHURCH_STORAGE_KEY, atual.id);
        }
      } catch (error) {
        console.error('Erro ao carregar igreja do membro:', error);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [user?.id]);

  if (loading || !permissoes.ehMembroComum) return null;

  const igrejaId = igreja?.id || '';
  const nome = usuarioPermitido?.nome?.split(' ')[0] || t('header.fallbackUser');

  const cards = [
    {
      icone: Building2,
      titulo: t('memberArea.churchInfo'),
      descricao: t('memberArea.churchInfoDescription'),
      onClick: () => router.push('/membro/igreja'),
    },
    {
      icone: Music,
      titulo: t('memberArea.repertoire'),
      descricao: t('memberArea.repertoireDescription'),
      onClick: () => router.push('/membro/repertorio'),
    },
    {
      icone: ScrollText,
      titulo: t('memberArea.confessions'),
      descricao: t('memberArea.confessionsDescription'),
      onClick: () => router.push('/confissoes'),
    },
    {
      icone: Library,
      titulo: t('memberArea.resources'),
      descricao: t('memberArea.resourcesDescription'),
      onClick: () => router.push(igrejaId ? `/recursos?igreja_id=${igrejaId}` : '/recursos'),
    },
    {
      icone: Calendar,
      titulo: t('memberArea.liturgicalYear'),
      descricao: t('memberArea.liturgicalYearDescription'),
      onClick: () => router.push('/membro/ano-liturgico'),
    },
    {
      icone: CalendarDays,
      titulo: t('memberArea.events'),
      descricao: t('memberArea.eventsDescription'),
      onClick: () => router.push('/membro/eventos'),
    },
    {
      icone: Cake,
      titulo: t('memberArea.birthdays'),
      descricao: t('memberArea.birthdaysDescription'),
      onClick: () => router.push('/membro/aniversariantes'),
    },
    {
      icone: Users,
      titulo: t('memberArea.leadership'),
      descricao: t('memberArea.leadershipDescription'),
      onClick: () => router.push('/membro/lideranca'),
    },
    {
      icone: Heart,
      titulo: t('memberArea.prayerRequests'),
      descricao: t('memberArea.prayerRequestsDescription'),
      onClick: () => router.push(igreja?.slug ? `/pedidos/${igreja.slug}` : '/pedidos-pastorais'),
    },
    {
      icone: History,
      titulo: t('memberArea.pastBulletins'),
      descricao: t('memberArea.pastBulletinsDescription'),
      onClick: () =>
        router.push(igrejaId ? `/boletins-anteriores?igreja_id=${igrejaId}` : '/boletins-anteriores'),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-xl font-bold text-slate-900">{t('memberArea.title')}</h1>
          <p className="mt-1 text-slate-600">{t('memberArea.welcome', { nome })}</p>
          <p className="text-sm text-slate-500">{t('memberArea.subtitle')}</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ icone: Icone, titulo, descricao, onClick }) => (
            <button
              key={titulo}
              onClick={onClick}
              className="flex items-start gap-4 rounded-xl border bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icone className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-slate-900">{titulo}</span>
                <span className="block text-sm text-slate-500">{descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
