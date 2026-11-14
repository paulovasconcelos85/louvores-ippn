'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslations } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { getCargoCor, getCargoLabel, isCargoTipo } from '@/lib/permissions';

interface PessoaLideranca {
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  fotoUrl: string | null;
}

export default function MembroLiderancaPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  const [lideranca, setLideranca] = useState<PessoaLideranca[]>([]);
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
        const response = await fetch('/api/membro/lideranca', {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await response.json();
        if (ativo && response.ok) {
          setLideranca((data.lideranca || []) as PessoaLideranca[]);
        }
      } catch (error) {
        console.error('Erro ao carregar liderança:', error);
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
          <h1 className="ml-2 text-lg font-bold text-slate-900">{t('memberArea.leadership')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {carregando ? (
          <p className="text-slate-500">...</p>
        ) : lideranca.length === 0 ? (
          <p className="text-slate-500">{t('memberArea.leadershipEmpty')}</p>
        ) : (
          lideranca.map((pessoa, index) => (
            <article key={`${pessoa.nome}-${index}`} className="flex items-center gap-4 rounded-xl border bg-white p-5 shadow-sm">
              {pessoa.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pessoa.fotoUrl} alt={pessoa.nome} className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <UserRound className="h-6 w-6" />
                </span>
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{pessoa.nome}</p>
                {pessoa.cargo && isCargoTipo(pessoa.cargo) ? (
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getCargoCor(pessoa.cargo)}`}>
                    {getCargoLabel(pessoa.cargo)}
                  </span>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                  {pessoa.telefone ? (
                    <a href={`tel:${pessoa.telefone}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
                      <Phone className="h-3.5 w-3.5" />
                      {pessoa.telefone}
                    </a>
                  ) : null}
                  {pessoa.email ? (
                    <a href={`mailto:${pessoa.email}`} className="inline-flex items-center gap-1 hover:text-emerald-700">
                      <Mail className="h-3.5 w-3.5" />
                      {pessoa.email}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
