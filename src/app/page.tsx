'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Culto {
  'Culto nr.': number;
  Dia: string;
  Prelúdio: string;
  'Cântico 2'?: string;
  'Cântico 3'?: string;
  'Cântico 4'?: string;
  'Cântico 5'?: string;
  'Cântico 6'?: string;
  'Cântico 7'?: string;
  'Cântico 8'?: string;
  'Cântico 9'?: string;
  'Cântico 10'?: string;
}

export default function Home() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const handleLogout = async () => {
    await signOut();
    window.location.reload();
  };

  useEffect(() => {
    async function fetchCultos() {
      setLoading(true);

      const from = page * 10;
      const to = from + 9;

      const { data, error } = await supabase
        .from('Louvores IPPN')
        .select('*')
        .order('"Culto nr."', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('❌ Erro detalhado:', error);
      } else {
        setCultos(data || []);
      }

      setLoading(false);
    }

    fetchCultos();
  }, [page]);



  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data não informada';
    
    // Fix: Forçar timezone local
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getMusicas = (culto: Culto) => {
    const musicas = [];
    if (culto.Prelúdio) musicas.push({ tipo: 'Prelúdio', nome: culto.Prelúdio });
    for (let i = 2; i <= 10; i++) {
      const key = `Cântico ${i}` as keyof Culto;
      if (culto[key]) {
        musicas.push({ tipo: `Cântico ${i}`, nome: culto[key] as string });
      }
    }
    return musicas;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <span className="text-2xl">🎵</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  Sistema de Louvores IPPN
                </h1>
                <p className="text-emerald-100 text-sm mt-1">
                  Igreja Presbiteriana Ponta Negra
                </p>
              </div>
            </div>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-emerald-100 text-sm hidden sm:block">
                  {user.email}
                </span>
                <button
                  onClick={() => router.push('/admin')}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all font-medium"
                >
                  Meu Painel
                </button>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all font-medium"
                >
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all font-medium"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-transparent via-amber-600 to-transparent"></div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Título da seção */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Programação Musical
          </h2>
          <p className="text-slate-600">
            Confira as músicas dos últimos cultos
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
            <p className="mt-4 text-slate-600">Carregando cultos...</p>
          </div>
        )}

        {/* Lista de Cultos */}
        {!loading && cultos.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
            <span className="text-6xl mb-4 block">🎵</span>
            <p className="text-slate-600">Nenhum culto cadastrado ainda</p>
          </div>
        )}

        <div className="grid gap-6">
          {cultos.map((culto, index) => (
            <div
              key={culto['Culto nr.']}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all"
              style={{
                animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              {/* Header do Card */}
              <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Culto #{culto['Culto nr.']}
                    </h3>
                    <p className="text-emerald-100 text-sm mt-1">
                      {formatDate(culto.Dia)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🎶</span>
                  </div>
                </div>
              </div>

              {/* Músicas */}
              <div className="p-6">
                <div className="grid sm:grid-cols-2 gap-3">
                  {getMusicas(culto).map((musica, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-600 mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">
                          {musica.tipo}
                        </p>
                        <p
                          className="text-slate-900 font-medium truncate cursor-pointer text-emerald-800 hover:underline"
                          onClick={() => router.push(`/letra/${encodeURIComponent(musica.nome)}`)}
                        >
                          {musica.nome}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 0))}
            className="px-4 py-2 bg-emerald-700 text-white rounded"
          >
            ← Anteriores
          </button>

          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 bg-emerald-700 text-white rounded"
          >
            Próximos →
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-emerald-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-emerald-100 text-sm">
              Sistema de Louvores - Igreja Presbiteriana Ponta Negra
            </p>
            <p className="text-emerald-200/60 text-xs mt-2">
              Manaus, Amazonas
            </p>
          </div>
        </div>
      </footer>

      {/* Animação */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}