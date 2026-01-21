'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface LouvorItem {
  id: string;
  ordem: number;
  tipo: string;
  tom: string | null;
  canticos: {
    nome: string;
  } | null;
}

interface Culto {
  'Culto nr.': number;
  Dia: string;
  louvor_itens: LouvorItem[];
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

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getMusicas = (culto: Culto) => {
    if (!culto.louvor_itens) return [];

    const itensOrdenados = culto.louvor_itens.sort((a, b) => a.ordem - b.ordem);
    
    return itensOrdenados.map(item => {
      let tipoExibicao = item.tipo;
      
      // Se for "Cântico", mostrar com a posição real (ordem)
      if (item.tipo === 'Cântico') {
        tipoExibicao = `Cântico ${item.ordem}`;
      }
      
      return {
        tipo: tipoExibicao,
        nome: item.canticos?.nome || '',
        tom: item.tom,
      };
    });
  };

  // Formata data curta para WhatsApp (dd/mm/yyyy)
  const formatDateShort = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  };

  // Gera mensagem para WhatsApp
  const gerarMensagemWhatsApp = (culto: Culto) => {
    const musicas = getMusicas(culto);
    const data = formatDateShort(culto.Dia);
    
    let mensagem = `CÂNTICOS DO CULTO DE *${data}*\n🎼🎵🎶\n\n`;
    
    let numeroSequencial = 1;
    
    // Prelúdio
    const preludio = musicas.find(m => m.tipo === 'Prelúdio');
    if (preludio) {
      mensagem += `🎹 *PRELÚDIO*\n`;
      mensagem += `${numeroSequencial}. ${preludio.nome}${preludio.tom ? ` (${preludio.tom})` : ''}\n\n`;
      numeroSequencial++;
    }
    
    // Salmo (Leitura)
    const salmo = musicas.find(m => m.tipo === 'Salmo');
    if (salmo) {
      mensagem += `📖 *LEITURA INICIAL*\n`;
      mensagem += `${numeroSequencial}. ${salmo.nome}${salmo.tom ? ` (${salmo.tom})` : ''}\n\n`;
      numeroSequencial++;
    }
    
    // Cânticos de Ministração
    const canticos = musicas.filter(m => m.tipo.startsWith('Cântico'));
    if (canticos.length > 0) {
      mensagem += `🎤 *MINISTRAÇÃO LOUVOR*\n`;
      canticos.forEach(c => {
        mensagem += `${numeroSequencial}. ${c.nome}${c.tom ? ` (${c.tom})` : ''}\n`;
        numeroSequencial++;
      });
      mensagem += '\n';
    }
    
    // Oferta
    const oferta = musicas.find(m => m.tipo === 'Oferta');
    if (oferta) {
      mensagem += `💰 *OFERTA*\n`;
      mensagem += `${numeroSequencial}. ${oferta.nome}${oferta.tom ? ` (${oferta.tom})` : ''}\n\n`;
      numeroSequencial++;
    }
    
    // Pregação
    const pregacao = musicas.find(m => m.tipo === 'Pregação');
    if (pregacao) {
      mensagem += `📖 *PREGAÇÃO*\n\n`;
    }
    
    // Ceia (se houver)
    const ceia = musicas.find(m => m.tipo === 'Ceia');
    if (ceia) {
      mensagem += `🥖 *CEIA*\n`;
      mensagem += `${numeroSequencial}. ${ceia.nome}${ceia.tom ? ` (${ceia.tom})` : ''}\n\n`;
      numeroSequencial++;
    }
    
    // Pósludio
    const posludio = musicas.find(m => m.tipo === 'Pósludio');
    if (posludio) {
      mensagem += `🎺 *PÓSLÚDIO*\n`;
      mensagem += `${numeroSequencial}. ${posludio.nome}${posludio.tom ? ` (${posludio.tom})` : ''}\n\n`;
    }
    
    mensagem += `🙏 *AMÉM TRÍPLICE*`;
    
    return mensagem;
  };

  const compartilharWhatsApp = (culto: Culto) => {
    const mensagem = gerarMensagemWhatsApp(culto);
    const mensagemEncoded = encodeURIComponent(mensagem.normalize('NFC'));
    window.open(`https://api.whatsapp.com/send?text=${mensagemEncoded}`, '_blank');
  };

  useEffect(() => {
    async function fetchCultos() {
      setLoading(true);

      const from = page * 10;
      const to = from + 9;

      const { data, error } = await supabase
        .from('Louvores IPPN')
        .select(`
          "Culto nr.",
          Dia,
          louvor_itens (
            id,
            ordem,
            tipo,
            tom,
            canticos (
              nome
            )
          )
        `)
        .order('"Culto nr."', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Erro ao buscar cultos:', error);
      } else {
        // Type assertion segura após validação
        setCultos((data as any[]) || []);
      }

      setLoading(false);
    }

    fetchCultos();
  }, [page]);

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
                  <div className="flex items-center gap-3">
                    {/* Botão WhatsApp */}
                    <button
                      onClick={() => compartilharWhatsApp(culto)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all font-medium shadow-lg"
                      title="Compartilhar no WhatsApp"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                      <span className="text-2xl">🎶</span>
                    </div>
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
                          className="text-slate-900 font-medium cursor-pointer text-emerald-800 hover:underline"
                          onClick={() => router.push(`/letra/${encodeURIComponent(musica.nome)}`)}
                        >
                          {musica.nome} {musica.tom && `(${musica.tom})`}
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
            className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-all font-medium shadow-sm disabled:opacity-50"
            disabled={page === 0}
          >
            ← Anteriores
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-all font-medium shadow-sm"
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