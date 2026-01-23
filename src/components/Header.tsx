'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium"
            >
              ← Voltar
            </button>
          )}

          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => router.push('/admin')}
          >
            <div className="w-10 h-10 bg-emerald-700 rounded-lg flex items-center justify-center text-white font-bold">
              🎵
            </div>
            <div>
              <p className="font-bold leading-tight">Sistema de Louvores IPPN</p>
              <p className="text-xs text-slate-500">Painel</p>
            </div>
          </div>
        </div>

        {/* Direita: Home + Usuário */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-3 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg text-sm font-medium"
          >
            🏠 Home
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              <span className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {inicial}
              </span>
              <span className="hidden sm:block text-sm">
                {usuarioPermitido?.nome?.split(' ')[0] || 'Usuário'}
              </span>
            </button>

            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-20">
                  <div className="px-4 py-3 border-b">
                    <p className="text-sm font-semibold">
                      {usuarioPermitido?.nome || user.email}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      setMenuAberto(false);
                      router.push('/perfil');
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    👤 Meu Perfil
                  </button>

                  {permissoes?.podeAcessarAdmin && (
                    <button
                      onClick={() => {
                        setMenuAberto(false);
                        router.push('/admin');
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                    >
                      ⚙️ Administração
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      setMenuAberto(false);
                      await signOut();
                      router.push('/');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t"
                  >
                    🚪 Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
