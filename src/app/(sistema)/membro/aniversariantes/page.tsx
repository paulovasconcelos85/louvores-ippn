'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Cake } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslations } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';

interface Aniversariante {
  nome: string;
  dia: number;
  mes: number;
}

export default function MembroAniversariantesPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
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
    if (!user?.id) return;

    let ativo = true;

    (async () => {
      try {
        const response = await fetch('/api/membro/aniversariantes', {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await response.json();
        if (ativo && response.ok) {
          setAniversariantes((data.aniversariantes || []) as Aniversariante[]);
        }
      } catch (error) {
        console.error('Erro ao carregar aniversariantes:', error);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [user?.id]);

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
          <h1 className="ml-2 text-lg font-bold text-slate-900">{t('memberArea.birthdays')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {carregando ? (
          <p className="text-slate-500">...</p>
        ) : aniversariantes.length === 0 ? (
          <p className="text-slate-500">{t('memberArea.birthdaysEmpty')}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white shadow-sm">
            {aniversariantes.map((pessoa, index) => (
              <li key={`${pessoa.nome}-${index}`} className="flex items-center gap-3 px-4 py-3">
                <Cake className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span className="flex-1 font-medium text-slate-900">{pessoa.nome}</span>
                <span className="text-sm text-slate-500">
                  {String(pessoa.dia).padStart(2, '0')}/{String(pessoa.mes).padStart(2, '0')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
