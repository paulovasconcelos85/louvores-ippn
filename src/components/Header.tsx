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
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';

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
        const response = await fetch('/api/igrejas/selecionaveis', {
          headers: await buildAuthenticatedHeaders(),
        });
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
  const boletimHref = igrejaAtual?.slug
    ? `/${igrejaAtual.slug}`
    : igrejaAtualId
      ? `/?igreja_id=${encodeURIComponent(igrejaAtualId)}`
      : '/';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b-[3px] border-double border-[#1e1208]/25 bg-[#f4efe5]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        
        {/* Esquerda: Voltar + Logo */}
        <div className="flex items-center gap-3">
          {mostrarVoltar && (
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-[#1e1208]/5 rounded-full text-base transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('header.back')}</span>
            </button>
          )}

          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push('/admin')}
          >
            <div className="w-10 h-10 rounded-full ring-1 ring-[#1e1208]/20 ring-offset-2 ring-offset-[#f4efe5] bg-emerald-600 flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="hidden md:block">
              <p className="font-fell text-lg leading-tight text-slate-950">OIKOS Hub</p>
              <p className="text-sm italic text-slate-500">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        {/* Direita: Boletim + Usuário */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(boletimHref)}
            className="flex items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-[#1e1208]/5 hover:text-rubrica rounded-full text-base transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Boletim</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 border border-[#1e1208]/20 hover:border-[#1e1208]/40 hover:bg-[#1e1208]/5 rounded-full transition-colors"
            >
              <span className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-fell text-base">
                {inicial}
              </span>
              <span className="hidden sm:block text-base text-slate-800">
                {usuarioPermitido?.nome?.split(' ')[0] || t('header.fallbackUser')}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${menuAberto ? 'rotate-180' : ''}`} />
            </button>

            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 mt-3 w-72 rounded-md border border-[#1e1208]/15 bg-white outline outline-1 outline-offset-[-6px] outline-[#1e1208]/10 shadow-[0_20px_44px_-22px_rgba(30,18,8,0.35)] z-20 overflow-hidden">
                  <div className="px-5 py-4 border-b border-dotted border-[#1e1208]/20">
                    <p className="font-fell text-lg leading-tight text-slate-950">
                      {usuarioPermitido?.nome || user.email}
                    </p>
                    <p className="text-sm italic text-slate-500 mt-0.5">{user.email}</p>
                    {igrejaAtual && (
                      <p className="text-sm text-rubrica mt-2">
                        {t('header.activeChurch')}: {igrejaAtual.sigla || igrejaAtual.nome}
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    {mostrarSeletorIgreja && (
                      <div className="px-5 py-3 border-b border-dotted border-[#1e1208]/20">
                        <label className="font-fell text-xs tracking-[0.25em] text-rubrica">
                          {t('header.activeChurch')}
                        </label>
                        <div className="mt-2 relative">
                          <Church className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <select
                            value={igrejaAtualId}
                            onChange={(e) => handleTrocarIgreja(e.target.value)}
                            className="w-full appearance-none rounded-md border border-slate-300 bg-white pl-9 pr-8 py-2 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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
                      className="w-full text-left px-5 py-2.5 text-base hover:bg-[#1e1208]/5 hover:text-rubrica flex items-center gap-3 text-slate-700 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      {t('header.profile')}
                    </button>

                    <button
                      onClick={() => {
                        setMenuAberto(false);
                        router.push('/recursos');
                      }}
                      className="w-full text-left px-5 py-2.5 text-base hover:bg-[#1e1208]/5 hover:text-rubrica flex items-center gap-3 text-slate-700 transition-colors"
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
                        className="w-full text-left px-5 py-2.5 text-base hover:bg-[#1e1208]/5 hover:text-rubrica flex items-center gap-3 text-slate-700 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        {t('header.admin')}
                      </button>
                    )}
                  </div>

                  <div className="border-t border-dotted border-[#1e1208]/20 py-1">
                    <button
                      onClick={async () => {
                        setMenuAberto(false);
                        await signOut();
                        router.push('/');
                      }}
                      className="w-full text-left px-5 py-2.5 text-base text-rubrica hover:bg-[#1e1208]/5 flex items-center gap-3 transition-colors"
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
