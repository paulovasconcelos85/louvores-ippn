'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getCargoLabel, getCargoCor } from '@/lib/permissions';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { usuarioPermitido, loading: permLoading, permissoes } = usePermissions();
  
  const [menuAberto, setMenuAberto] = useState(false);

  const loading = authLoading || permLoading;

  useEffect(() => {
    // Se não está carregando e não tem usuário, redireciona para login
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Se terminou de carregar e não tem permissão, redireciona para home
    if (!loading && user && !permissoes.podeAcessarAdmin) {
      router.push('/');
    }
  }, [user, loading, permissoes.podeAcessarAdmin, router]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não tem usuário ou não tem permissão, não renderiza nada
  if (!user || !permissoes.podeAcessarAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-2xl p-8 text-white mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Bem-vindo ao Sistema de Louvores! 🎉
          </h2>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <p className="text-emerald-100">
              Usuário: <span className="font-semibold">{usuarioPermitido?.nome || user.email}</span>
            </p>
            {usuarioPermitido?.cargo && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCargoCor(usuarioPermitido.cargo)}`}>
                {getCargoLabel(usuarioPermitido.cargo)}
              </span>
            )}
            {permissoes.isSuperAdmin && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-900 border-2 border-yellow-400">
                ⭐ Super Admin
              </span>
            )}
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 inline-block">
            <p className="text-sm">
              ✨ Gerencie cultos, músicas, letras e cifras
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Usuários - APENAS PARA ADMINS E SUPER-ADMINS */}
          {permissoes.podeGerenciarUsuarios && (
            <button
              onClick={() => router.push('/admin/usuarios')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-emerald-600 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Gerenciar Usuários
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Controle quem pode acessar o sistema
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-100 px-3 py-1 rounded-full">
                ✓ Disponível
              </span>
            </button>
          )}

          {/* Escalas - Para Pastor, Presbítero, Staff, Admin */}
          {permissoes.podeGerenciarEscalas && (
            <button
              onClick={() => router.push('/admin/escalas')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-blue-600 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Gerenciar Escalas
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Crie e organize as escalas de músicos
              </p>
              <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-3 py-1 rounded-full">
                ✓ Disponível
              </span>
            </button>
          )}

          {/* Músicas */}
          <Link href="/canticos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🎵</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Músicas</h3>
              <p className="text-slate-600 text-sm mb-4">
                Gerencie letras e cifras
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                Acessar
              </span>
            </div>
          </Link>

          {/* Cultos */}
          <Link href="/cultos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📅</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Cultos</h3>
              <p className="text-slate-600 text-sm mb-4">
                Organize a programação musical
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                Acessar
              </span>
            </div>
          </Link>

          {/* Estatísticas */}
          <Link href="/dashboard" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                Estatísticas
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Músicas mais cantadas, por mês, por posição
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                Acessar
              </span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}