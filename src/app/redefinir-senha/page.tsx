'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/provider';
import { supabase } from '@/lib/supabase';

// Destino do link de "Esqueci minha senha": o /auth/callback já abriu a
// sessão, aqui a pessoa só escolhe a senha nova.
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) => (locale === 'es' ? es : locale === 'en' ? en : pt),
    [locale]
  );
  const { user, loading } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro('');

    if (senha.length < 8) {
      setErro(tr('A senha precisa ter pelo menos 8 caracteres.', 'La contraseña debe tener al menos 8 caracteres.', 'Password must be at least 8 characters.'));
      return;
    }
    if (senha !== confirmacao) {
      setErro(tr('As senhas não conferem.', 'Las contraseñas no coinciden.', 'Passwords do not match.'));
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.push('/admin');
  }

  const inputClass =
    'min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-base outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {tr('Criar nova senha', 'Crear nueva contraseña', 'Create a new password')}
        </h1>

        {loading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-slate-400" />
        ) : !user ? (
          <p className="mt-4 text-base leading-7 text-slate-600">
            {tr('Este link expirou ou já foi usado.', 'Este enlace expiró o ya fue usado.', 'This link has expired or was already used.')}{' '}
            <Link href="/login" className="font-medium text-emerald-700 underline">
              {tr('Pedir um novo', 'Pedir uno nuevo', 'Request a new one')}
            </Link>
          </p>
        ) : (
          <form onSubmit={salvar} className="mt-6 grid gap-4">
            <p className="text-sm text-slate-600">{user.email}</p>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" placeholder={tr('Nova senha', 'Nueva contraseña', 'New password')} className={inputClass} autoFocus />
            <input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" placeholder={tr('Repita a senha', 'Repite la contraseña', 'Repeat password')} className={inputClass} />
            {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{erro}</p>}
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr('Salvar senha', 'Guardar contraseña', 'Save password')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
