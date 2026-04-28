'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Building2, 
  Home, 
  User, 
  Settings, 
  LogOut, 
  ArrowLeft,
  ChevronDown,
  Church,
  Library
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale, useTranslations } from '@/i18n/provider';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY } from '@/lib/church-utils';
import { resolveApiErrorMessage } from '@/lib/api-feedback';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();
  const { user, loading, signOut } = useAuth();
  const { usuarioPermitido, permissoes } = usePermissions();
  const [menuAberto, setMenuAberto] = useState(false);
  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string>('');

  useEffect(() => {
    if (!user?.id) {
      setIgrejas([]);
      setIgrejaAtualId('');
      return;
    }

    let ativo = true;

    const carregarIgrejas = async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            resolveApiErrorMessage(locale, data, t('header.loadChurchesError'))
          );
        }

        if (!ativo) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const igrejaPreferida =
          typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null;
        const prioridade = [igrejaUrl, igrejaPreferida, data.igrejaAtualId, lista[0]?.id || null].filter(
          Boolean
        ) as string[];
        const igrejaResolvida =
          prioridade.find((id) => lista.some((igreja) => igreja.id === id)) || '';

        setIgrejas(lista);
        setIgrejaAtualId(igrejaResolvida);
      } catch (error) {
        console.error('Erro ao carregar igrejas do header:', error);
        if (ativo) {
          setIgrejas([]);
          setIgrejaAtualId('');
        }
      }
    };

    carregarIgrejas();

    return () => {
      ativo = false;
    };
  }, [t, user?.id, locale]);

  const handleTrocarIgreja = (novoId: string) => {
    setIgrejaAtualId(novoId);
    localStorage.setItem(CHURCH_STORAGE_KEY, novoId);
    setMenuAberto(false);
    window.location.reload();
  };

  if (loading || !user) return null;

  const inicial = (usuarioPermitido?.nome || user.email || 'U')[0].toUpperCase();
  const mostrarVoltar = pathname !== '/admin';
  const mostrarSeletorIgreja = igrejas.length > 1;
  const igrejaAtual = igrejas.find((igreja) => igreja.id === igrejaAtualId) || null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        
        {/* Esquerda: Voltar + Logo */}
        <div className="flex items-center gap-3">
          {mostrarVoltar && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.back')}</span>
            </button>
          )}

          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/admin')}
          >
            <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="hidden md:block">
              <p className="font-bold leading-tight text-slate-900">OIKOS Hub</p>
              <p className="text-xs text-slate-500">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        {/* Direita: Home + Usuário */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">{t('header.home')}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <span className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {inicial}
              </span>
              <span className="hidden sm:block text-sm font-medium text-slate-700">
                {usuarioPermitido?.nome?.split(' ')[0] || t('header.fallbackUser')}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${menuAberto ? 'rotate-180' : ''}`} />
            </button>

            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-slate-50">
                    <p className="text-sm font-semibold text-slate-900">
                      {usuarioPermitido?.nome || user.email}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    {igrejaAtual && (
                      <p className="text-xs text-emerald-700 mt-2 font-medium">
                        {t('header.activeChurch')}: {igrejaAtual.sigla || igrejaAtual.nome}
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    {mostrarSeletorIgreja && (
                      <div className="px-4 py-3 border-b bg-white">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {t('header.activeChurch')}
                        </label>
                        <div className="mt-2 relative">
                          <Church className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={igrejaAtualId}
                            onChange={(e) => handleTrocarIgreja(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          >
                            {igrejas.map((igreja) => (
                              <option key={igreja.id} value={igreja.id}>
                                {igreja.sigla ? `${igreja.sigla} • ${igreja.nome}` : igreja.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setMenuAberto(false);
                        router.push('/perfil');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {t('header.profile')}
                    </button>

                    <button
                      onClick={() => {
                        setMenuAberto(false);
                        router.push('/recursos');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors"
                    >
                      <Library className="w-4 h-4" />
                      Recursos
                    </button>

                    {permissoes?.podeAcessarAdmin && (
                      <button
                        onClick={() => {
                          setMenuAberto(false);
                          router.push('/admin');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        {t('header.admin')}
                      </button>
                    )}
                  </div>

                  <div className="border-t py-1">
                    <button
                      onClick={async () => {
                        setMenuAberto(false);
                        await signOut();
                        router.push('/');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('header.signOut')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
