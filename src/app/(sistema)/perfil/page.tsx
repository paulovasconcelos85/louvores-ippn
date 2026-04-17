'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTranslations } from '@/i18n/provider';
import { resolvePessoaIdForCurrentUser } from '@/lib/client-current-person';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import { supabase } from '@/lib/supabase';

interface TagFuncao {
  id: string;
  nome: string;
  categoria: string;
}

type FeedbackState = {
  type: 'success' | 'error';
  text: string;
} | null;

export default function PerfilPage() {
  const router = useRouter();
  const t = useTranslations();
  const { user, loading: authLoading, signOut } = useAuth();

  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tags, setTags] = useState<TagFuncao[]>([]);
  const [minhasTags, setMinhasTags] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const carregar = useCallback(async () => {
    try {
      const pessoaIdAtual = await resolvePessoaIdForCurrentUser(user);

      if (!pessoaIdAtual) {
        setFeedback({
          type: 'error',
          text: t('profile.linkedPersonNotFound'),
        });
        return;
      }

      const { data: pessoa } = await supabase
        .from('pessoas')
        .select('id, nome, telefone')
        .eq('id', pessoaIdAtual)
        .eq('ativo', true)
        .maybeSingle();

      if (!pessoa) {
        setFeedback({
          type: 'error',
          text: t('profile.linkedPersonNotFound'),
        });
        return;
      }

      setPessoaId(pessoa.id);
      setNome(pessoa.nome || '');
      setTelefone(pessoa.telefone ? formatPhoneNumber(pessoa.telefone) : '');

      const { data: tagsData, error: tagsError } = await supabase
        .from('tags_funcoes')
        .select('id, nome, categoria')
        .eq('ativo', true)
        .order('ordem');

      if (tagsError) throw tagsError;

      const tagsRestritas = ['Pastor', 'Presbítero', 'Pregação', 'Diácono'];
      const tagsFiltradas = ((tagsData || []) as TagFuncao[]).filter(
        (tag) => !tagsRestritas.includes(tag.nome)
      );

      setTags(tagsFiltradas);

      const { data: minhasTagsData, error: minhasTagsError } = await supabase
        .from('usuarios_tags')
        .select('tag_id')
        .eq('pessoa_id', pessoa.id);

      if (minhasTagsError) throw minhasTagsError;

      setMinhasTags((minhasTagsData || []).map((tag) => tag.tag_id));
      setFeedback(null);
    } catch (error: any) {
      setFeedback({
        type: 'error',
        text: t('profile.loadError', {
          message: error.message || t('profile.linkedPersonNotFound'),
        }),
      });
    }
  }, [t, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void carregar();
  }, [carregar, user]);

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    setFeedback(null);

    try {
      const pessoaIdAtual = await resolvePessoaIdForCurrentUser(user);
      if (!pessoaIdAtual) {
        throw new Error(t('profile.linkedPersonNotFound'));
      }

      const { error } = await supabase
        .from('pessoas')
        .update({
          nome: nome.trim(),
          telefone: telefone ? unformatPhoneNumber(telefone) : null,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', pessoaIdAtual);

      if (error) throw error;

      setFeedback({
        type: 'success',
        text: t('profile.updateSuccess'),
      });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        text: t('profile.saveError', {
          message: error.message || t('profile.linkedPersonNotFound'),
        }),
      });
    } finally {
      setSalvando(false);
    }
  };

  const toggleTag = async (tagId: string) => {
    if (!pessoaId) return;

    const temTag = minhasTags.includes(tagId);

    try {
      if (temTag) {
        const { error } = await supabase
          .from('usuarios_tags')
          .delete()
          .eq('pessoa_id', pessoaId)
          .eq('tag_id', tagId);

        if (error) throw error;

        setMinhasTags((prev) => prev.filter((currentTagId) => currentTagId !== tagId));
      } else {
        const { error } = await supabase
          .from('usuarios_tags')
          .insert({ pessoa_id: pessoaId, tag_id: tagId, nivel_habilidade: 1 });

        if (error) throw error;

        setMinhasTags((prev) => [...prev, tagId]);
      }

      setFeedback(null);
    } catch (error: any) {
      setFeedback({
        type: 'error',
        text: t('profile.tagError', {
          message: error.message || t('profile.linkedPersonNotFound'),
        }),
      });
    }
  };

  const tagsPorCategoria = useMemo(() => {
    return tags.reduce<Record<string, TagFuncao[]>>((acc, tag) => {
      if (!acc[tag.categoria]) acc[tag.categoria] = [];
      acc[tag.categoria].push(tag);
      return acc;
    }, {});
  }, [tags]);

  const categoriaLabels: Record<string, string> = useMemo(
    () => ({
      lideranca: t('profile.categories.lideranca'),
      instrumento: t('profile.categories.instrumento'),
      vocal: t('profile.categories.vocal'),
      tecnica: t('profile.categories.tecnica'),
      apoio: t('profile.categories.apoio'),
    }),
    [t]
  );

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">{t('profile.title')}</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="rounded-lg px-4 py-2 text-emerald-700 hover:bg-emerald-50"
            >
              {t('profile.admin')}
            </button>
            <button
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
              className="rounded-lg bg-slate-100 px-4 py-2"
            >
              {t('header.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {feedback && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              feedback.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">{t('profile.emailReadonly')}</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full rounded-lg border bg-slate-50 px-4 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {t('profile.name')} *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
                disabled={salvando}
                className="w-full rounded-lg border px-4 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">{t('profile.phone')}</label>
              <input
                type="tel"
                value={telefone}
                onChange={(event) => setTelefone(formatPhoneNumber(event.target.value))}
                disabled={salvando}
                className="w-full rounded-lg border px-4 py-2"
                placeholder={t('profile.phonePlaceholder')}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-emerald-700 px-6 py-2 text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {salvando ? t('profile.saving') : t('profile.save')}
              </button>

              <button
                type="button"
                onClick={() => router.push('/admin')}
                disabled={salvando}
                className="rounded-lg bg-slate-200 px-6 py-2 text-slate-800 hover:bg-slate-300"
              >
                {t('profile.cancel')}
              </button>
            </div>
          </form>

          <div className="border-t pt-6">
            <h3 className="mb-2 text-lg font-semibold">{t('profile.skillsTitle')}</h3>
            <p className="mb-4 text-sm text-slate-500">{t('profile.skillsDescription')}</p>
            <div className="space-y-4">
              {(Object.entries(tagsPorCategoria) as [string, TagFuncao[]][]).map(([categoria, tagsCategoria]) => (
                <div key={categoria}>
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    {categoriaLabels[categoria] || categoria}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {tagsCategoria.map((tag) => (
                      <label
                        key={tag.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2 ${
                          minhasTags.includes(tag.id)
                            ? 'border-emerald-600 bg-emerald-100'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={minhasTags.includes(tag.id)}
                          onChange={() => void toggleTag(tag.id)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{tag.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
