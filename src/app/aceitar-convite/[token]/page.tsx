'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getCargoLabel, getCargoIcone, getCargoCor } from '@/lib/permissions';

interface ConviteInfo {
  email: string;
  nome: string;
  cargo: string;
  expira_em: string;
  pessoa_id: string | null;
}

export default function AceitarConvite() {
  const router = useRouter();
  const params = useParams();
  const { user, signInWithGoogle, signInWithAzure } = useAuth();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [erro, setErro] = useState('');
  const [aceitando, setAceitando] = useState(false);

  // 1. Verificar convite ao carregar
  useEffect(() => {
    verificarConvite();
  }, [token]);

  // 2. Se usuário já está logado, aceitar automaticamente
  useEffect(() => {
  if (user && convite && !aceitando) {
      aceitarConviteAutomatico();
  }
  
  // OU se usuário logou e tem token pendente no localStorage
  if (user && !convite && !aceitando) {
      const tokenPendente = localStorage.getItem('pending_invite_token');
      if (tokenPendente && tokenPendente === token) {
      verificarConvite(); // Re-verificar para pegar dados do convite
      }
    }
  }, [user, convite]);

  const verificarConvite = async () => {
    try {
      setLoading(true);
      setErro('');

      const response = await fetch(`/api/verificar-convite?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setErro('⏰ Este convite expirou');
        } else {
          setErro(data.error || 'Convite inválido');
        }
        return;
      }

      setConvite(data.convite);
    } catch (error: any) {
      console.error('Erro ao verificar convite:', error);
      setErro('Erro ao verificar convite');
    } finally {
      setLoading(false);
    }
  };

  const aceitarConviteAutomatico = async () => {
    if (!user || !convite || aceitando) return;

    setAceitando(true);
    setErro('');

    try {
      const response = await fetch('/api/aceitar-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          user_id: user.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao aceitar convite');
      }

      // Sucesso! Redirecionar para admin
      router.push(data.redirect || '/admin');
    } catch (error: any) {
      console.error('Erro ao aceitar convite:', error);
      setErro(`❌ ${error.message}`);
      setAceitando(false);
    }
  };

  const handleLoginGoogle = async () => {
    try {
        // Salvar token no localStorage para usar após redirect
        localStorage.setItem('pending_invite_token', token);
        
        // Redirecionar mantendo o token na URL
        const redirectUrl = `${window.location.origin}/aceitar-convite/${token}`;
        localStorage.setItem('redirect_after_login', redirectUrl);
        
        await signInWithGoogle();
    } catch (error: any) {
        console.error('Erro no login Google:', error);
        setErro('❌ Erro ao fazer login com Google');
    }
  };

  const handleLoginAzure = async () => {
    try {
      localStorage.setItem('pending_invite_token', token);
      
      await signInWithAzure();
    } catch (error: any) {
      console.error('Erro no login Azure:', error);
      setErro('❌ Erro ao fazer login com Azure');
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Verificando convite...</p>
        </div>
      </div>
    );
  }

  // Erro
  if (erro && !convite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Convite Inválido</h1>
            <p className="text-slate-600 mb-6">{erro}</p>
            <button
              onClick={() => router.push('/login')}
              className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium"
            >
              Voltar para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Convite válido - mostrar informações
  if (convite && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">📧</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Você foi convidado!</h1>
            <p className="text-slate-600">
              Igreja Presbiteriana Ponta Negra
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-6 mb-6 space-y-3">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Nome</p>
              <p className="text-lg font-semibold text-slate-900">{convite.nome}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Email</p>
              <p className="text-slate-700">{convite.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Função</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getCargoCor(convite.cargo as any)}`}>
                {getCargoIcone(convite.cargo as any)} {getCargoLabel(convite.cargo as any)}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Expira em</p>
              <p className="text-sm text-slate-600">
                {new Date(convite.expira_em).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-800">
              {erro}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm text-slate-600 text-center mb-4">
              Faça login para aceitar o convite:
            </p>

            <button
              onClick={handleLoginGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition-all font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar com Google
            </button>

            <button
              onClick={handleLoginAzure}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-300 text-slate-700 px-6 py-3 rounded-lg hover:bg-slate-50 transition-all font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              Continuar com Microsoft
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-6">
            Ao aceitar, você terá acesso ao sistema de louvores da IPPN
          </p>
        </div>
      </div>
    );
  }

  // Usuário logado - aceitando convite
  if (user && aceitando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-900 font-semibold">Ativando sua conta...</p>
          <p className="text-sm text-slate-600 mt-2">Aguarde enquanto configuramos seu acesso</p>
        </div>
      </div>
    );
  }

  return null;
}