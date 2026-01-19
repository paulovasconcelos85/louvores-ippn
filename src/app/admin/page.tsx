'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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

  if (!user) {
    return null;
  }

    return (
    <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">🎵</span>
                </div>
                <div>
                <h1 className="text-xl font-bold text-slate-900">
                    Sistema de Louvores IPPN
                </h1>
                <p className="text-sm text-slate-600">Painel Administrativo</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium"
                >
                🏠 Home
                </button>
                <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
                >
                Sair
                </button>
            </div>
            </div>
        </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-2xl p-8 text-white mb-8">
            <h2 className="text-3xl font-bold mb-2">
            Bem-vindo ao Sistema de Louvores! 🎉
            </h2>
            <p className="text-emerald-100 mb-4">
            Usuário: <span className="font-semibold">{user.email}</span>
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 inline-block">
            <p className="text-sm">
                ✨ Gerencie cultos, músicas, letras e cifras
            </p>
            </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Usuários */}
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
