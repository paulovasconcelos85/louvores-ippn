'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { user, signIn, signUp, signOut, signInWithGoogle, signInWithAzure } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modo, setModo] = useState<'entrar' | 'primeiro_acesso'>('entrar');
  const [sincronizandoAcesso, setSincronizandoAcesso] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const finalizarAcesso = async () => {
    const response = await fetch('/api/finalizar-acesso', {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Seu acesso ainda não foi liberado.');
    }

    return data;
  };

  /**
   * 🔄 Monitor de Sessão
   * Se o usuário já estiver logado (ou se acabar de voltar do Google/Azure),
   * ele é jogado automaticamente para o painel administrativo.
   */
  useEffect(() => {
    const erroUrl = new URLSearchParams(window.location.search).get('erro');
    if (erroUrl) {
      setError(erroUrl);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let ativo = true;

    const sincronizar = async () => {
      try {
        setSincronizandoAcesso(true);
        setError('');
        await finalizarAcesso();
        if (ativo) {
          router.push('/admin');
        }
      } catch (err: any) {
        await signOut();
        if (ativo) {
          setError(err.message || 'Seu acesso ainda não foi liberado.');
          setLoading(false);
          setSincronizandoAcesso(false);
        }
      }
    };

    sincronizar();

    return () => {
      ativo = false;
    };
  }, [user, router, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMensagemSucesso('');

    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) throw signInError;
      
      // Se não houver erro, o useEffect acima fará o redirecionamento
    } catch (err: any) {
      // Tradução amigável de erros comuns
      let mensagemErro = 'Erro ao fazer login';
      
      if (err.message === 'Invalid login credentials') {
        mensagemErro = 'E-mail ou senha incorretos.';
      } else if (err.message?.includes('Email not confirmed')) {
        mensagemErro = 'Por favor, confirme seu e-mail antes de acessar.';
      } else {
        mensagemErro = err.message;
      }
      
      setError(mensagemErro);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setMensagemSucesso('');
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) throw googleError;
      // No OAuth, a página será redirecionada pelo provedor
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login com Google');
      setLoading(false);
    }
  };

  const handleAzureLogin = async () => {
    setLoading(true);
    setError('');
    setMensagemSucesso('');
    try {
      const { error: azureError } = await signInWithAzure();
      if (azureError) throw azureError;
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login com Microsoft');
      setLoading(false);
    }
  };

  const handlePrimeiroAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMensagemSucesso('');

    try {
      if (password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres.');
      }

      if (password !== confirmPassword) {
        throw new Error('As senhas não conferem.');
      }

      const { data, error: signUpError } = await signUp(email, password);
      if (signUpError) throw signUpError;

      if (data.session) {
        await finalizarAcesso();
        router.push('/admin');
        return;
      }

      setMensagemSucesso('Conta criada. Se houver confirmação por e-mail ativa, conclua a confirmação e depois entre normalmente.');
      setModo('entrar');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar sua conta.');
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  if (sincronizandoAcesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-700 font-semibold">Preparando seu acesso...</p>
          <p className="text-sm text-slate-500 mt-2">Estamos validando seu cadastro e vinculando sua conta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 flex items-center justify-center p-4">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-700/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Nome da Igreja */}
        <div className="text-center mb-8">
          <div className="inline-block">
            <h1 className="text-4xl font-bold text-white mb-2">IPPN</h1>
            <div className="h-1 bg-gradient-to-r from-transparent via-amber-600 to-transparent"></div>
          </div>
          <p className="text-emerald-100 mt-3 text-sm">
            OIKOS Hub
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {modo === 'entrar' ? 'Bem-vindo de volta!' : 'Primeiro acesso'}
            </h2>
            <p className="text-slate-600 text-sm">
              {modo === 'entrar'
                ? 'Entre com suas credenciais'
                : 'Crie sua conta com o mesmo e-mail liberado pela administração'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          {mensagemSucesso && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <span>✅</span> {mensagemSucesso}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setModo('entrar');
                setError('');
                setMensagemSucesso('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                modo === 'entrar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setModo('primeiro_acesso');
                setError('');
                setMensagemSucesso('');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                modo === 'primeiro_acesso' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Primeiro acesso
            </button>
          </div>

          <form onSubmit={modo === 'entrar' ? handleSubmit : handlePrimeiroAcesso} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none transition-all text-slate-900"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none transition-all text-slate-900"
                placeholder="••••••••"
              />
            </div>

            {modo === 'primeiro_acesso' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none transition-all text-slate-900"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-700 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-emerald-800 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processando...
                </span>
              ) : (
                modo === 'entrar' ? 'Entrar' : 'Criar conta'
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">ou continue com</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-slate-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google</span>
            </button>

            <button
              onClick={handleAzureLogin}
              disabled={loading}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-slate-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M0 0h11v11H0z" />
                <path fill="#81bc06" d="M12 0h11v11H12z" />
                <path fill="#05a6f0" d="M0 12h11v11H0z" />
                <path fill="#ffba08" d="M12 12h11v11H12z" />
              </svg>
              <span>Microsoft</span>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">ou</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-all"
          >
            Voltar para a página inicial
          </button>

          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900">
              <span className="font-semibold">ℹ️ Primeiro acesso?</span> O administrador precisa liberar seu e-mail primeiro. Depois disso, você pode criar sua conta aqui ou entrar com Google/Microsoft usando o mesmo e-mail.
            </p>
          </div>
        </div>

        <p className="text-center text-emerald-100 text-sm mt-6">
          Igreja Presbiteriana Ponta Negra
        </p>
      </div>
    </div>
  );
}
