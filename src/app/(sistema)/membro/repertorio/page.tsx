'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Music, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslations } from '@/i18n/provider';
import { getStoredChurchId } from '@/lib/church-utils';
import { supabase } from '@/lib/supabase';

interface ItemRepertorio {
  nome: string;
  numero: string | null;
  referencia: string | null;
}

export default function MembroRepertorioPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  const [itens, setItens] = useState<ItemRepertorio[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [busca, setBusca] = useState('');

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
    const igrejaId = getStoredChurchId();
    if (!igrejaId) {
      setCarregandoLista(false);
      return;
    }

    let ativo = true;

    (async () => {
      const { data: igreja } = await supabase
        .from('igrejas')
        .select('modo_repertorio')
        .eq('id', igrejaId)
        .maybeSingle();

      const usaHinario = (igreja?.modo_repertorio || '').trim().toLowerCase() === 'hinario';

      if (usaHinario) {
        const { data } = await supabase
          .from('hinario_novo_cantico')
          .select('titulo, numero, referencia_biblica')
          .order('numero', { ascending: true });

        if (ativo) {
          setItens(
            (data || []).map((item) => ({
              nome: item.titulo?.trim() || 'Hino sem título',
              numero: item.numero,
              referencia: item.referencia_biblica,
            }))
          );
          setCarregandoLista(false);
        }
        return;
      }

      const { data } = await supabase
        .from('canticos')
        .select('nome, referencia')
        .eq('igreja_id', igrejaId)
        .order('nome', { ascending: true });

      if (ativo) {
        setItens((data || []).map((item) => ({ nome: item.nome, numero: null, referencia: item.referencia })));
        setCarregandoLista(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((item) => item.nome.toLowerCase().includes(termo));
  }, [itens, busca]);

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
          <h1 className="ml-2 text-lg font-bold text-slate-900">{t('memberArea.repertoire')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder={t('memberArea.repertoireSearchPlaceholder')}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {carregandoLista ? (
          <p className="text-slate-500">...</p>
        ) : itensFiltrados.length === 0 ? (
          <p className="text-slate-500">{t('memberArea.repertoireEmpty')}</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white shadow-sm">
            {itensFiltrados.map((item) => (
              <li key={item.nome}>
                <button
                  onClick={() => router.push(`/letra/${encodeURIComponent(item.nome)}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <Music className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span className="flex-1">
                    <span className="block font-medium text-slate-900">
                      {item.numero ? `${item.numero} — ` : ''}
                      {item.nome}
                    </span>
                    {item.referencia && <span className="block text-sm text-slate-500">{item.referencia}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
