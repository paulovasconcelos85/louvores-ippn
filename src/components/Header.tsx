'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Building2, 
  Home, 
  User, 
  Settings, 
  LogOut, 
  ArrowLeft,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const { usuarioPermitido, permissoes } = usePermissions();
  const [menuAberto, setMenuAberto] = useState(false);

  if (loading || !user) return null;

  const inicial = (usuarioPermitido?.nome || user.email || 'U')[0].toUpperCase();
  const mostrarVoltar = pathname !== '/admin';

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
              <span className="hidden sm:inline">Voltar</span>
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
              <p className="font-bold leading-tight text-slate-900">OIKOS Hub - IPPN</p>
              <p className="text-xs text-slate-500">Gestão Integral da Igreja</p>
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
            <span className="hidden sm:inline">Home</span>
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
                {usuarioPermitido?.nome?.split(' ')[0] || 'Usuário'}
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
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setMenuAberto(false);
                        router.push('/perfil');
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      Meu Perfil
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
                        Administração
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
                      Sair
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