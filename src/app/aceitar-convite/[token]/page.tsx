'use client';

import { useRouter } from 'next/navigation';

export default function AceitarConvite() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">ℹ️</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Convites Desativados</h1>
        <p className="text-slate-600 mb-6">
          Este link não pode mais ser usado porque o fluxo de convites foi removido do sistema.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all font-medium"
        >
          Ir para o Login
        </button>
      </div>
    </div>
  );
}
