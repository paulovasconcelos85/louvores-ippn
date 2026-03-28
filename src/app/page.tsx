'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Eye, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { EscalaIntegrada } from '@/components/EscalaIntegrada';

interface LouvorItem {
  id: string;
  ordem: number;
  tipo: string;
  tom: string | null;
  conteudo_publico: string | null;
  canticos: { nome: string } | null;
}

interface Culto {
  'Culto nr.': number;
  Dia: string;
  imagem_url: string | null;
  palavra_pastoral: string | null;
  palavra_pastoral_autor: string | null;
  louvor_itens: LouvorItem[];
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getItensOrdenados = (culto: Culto): LouvorItem[] => {
    if (!culto.louvor_itens) return [];
    return [...culto.louvor_itens].sort((a, b) => a.ordem - b.ordem);
  };

  const agruparItens = (itens: LouvorItem[]) => {
    const agrupados: {
      tipo: string;
      conteudo_publico: string | null;
      canticos: { nome: string; tom: string | null }[];
    }[] = [];

    for (const it of itens) {
      const ultimo = agrupados[agrupados.length - 1];
      if (ultimo && ultimo.tipo === it.tipo && ultimo.conteudo_publico === it.conteudo_publico) {
        if (it.canticos?.nome) {
          ultimo.canticos.push({ nome: it.canticos.nome, tom: it.tom });
        }
      } else {
        agrupados.push({
          tipo: it.tipo,
          conteudo_publico: it.conteudo_publico,
          canticos: it.canticos?.nome ? [{ nome: it.canticos.nome, tom: it.tom }] : [],
        });
      }
    }
    return agrupados;
  };

  const compartilharWhatsApp = async (culto: Culto) => {
    const itens = agruparItens(getItensOrdenados(culto));
    const data = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR');
    let texto = `*BOLETIM ELETRONICO DO CULTO - ${data}*\n⛪ _Igreja Presbiteriana Ponta Negra_\n\n`;

    if (culto.palavra_pastoral) {
      texto += `✝️ *PALAVRA PASTORAL*\n_"${culto.palavra_pastoral}"_\n— ${culto.palavra_pastoral_autor || ''}\n\n`;
    }

    itens.forEach((it, idx) => {
      texto += `*${idx + 1}. ${it.tipo.toUpperCase()}*\n`;
      if (it.conteudo_publico) texto += `${it.conteudo_publico}\n`;
      it.canticos.forEach(c => {
        texto += `🎵 _${c.nome}${c.tom ? ` (${c.tom})` : ''}_\n`;
      });
      texto += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  useEffect(() => {
    if (authLoading) return;

    async function fetchCultos() {
      setLoading(true);
      const from = page * 10;
      const to = from + 9;

      const agora = new Date();
      const diaSemana = agora.getDay();
      const horaAtual = agora.getHours();
      let dataDeCorteFuturos: Date;

      if (user) {
        dataDeCorteFuturos = new Date();
        dataDeCorteFuturos.setDate(dataDeCorteFuturos.getDate() + 14);
      } else if (diaSemana === 6 && horaAtual >= 14) {
        dataDeCorteFuturos = new Date();
        dataDeCorteFuturos.setDate(dataDeCorteFuturos.getDate() + 1);
        dataDeCorteFuturos.setHours(23, 59, 59);
      } else if (diaSemana === 0) {
        dataDeCorteFuturos = new Date();
        dataDeCorteFuturos.setHours(23, 59, 59);
      } else {
        dataDeCorteFuturos = new Date();
        dataDeCorteFuturos.setHours(0, 0, 0, 0);
      }

      const { data, error } = await supabase
        .from('Louvores IPPN')
        .select(`
          "Culto nr.",
          Dia,
          imagem_url,
          palavra_pastoral,
          palavra_pastoral_autor,
          louvor_itens (
            id,
            ordem,
            tipo,
            tom,
            conteudo_publico,
            canticos ( nome )
          )
        `)
        .lte('Dia', dataDeCorteFuturos.toISOString())
        .order('"Culto nr."', { ascending: false })
        .range(from, to);

      if (!error) setCultos((data as any[]) || []);
      setLoading(false);
    }

    fetchCultos();
  }, [page, user, authLoading]);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-0.5">
              Igreja Presbiteriana Ponta Negra
            </p>
            <h1 className="text-xl font-bold text-white">
              Boletim Eletronico
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => router.push('/admin')}
                  className="text-sm font-medium text-emerald-200 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Painel
                </button>
                <button
                  onClick={async () => { await signOut(); window.location.reload(); }}
                  className="text-sm font-medium text-emerald-300/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl transition-colors"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-2">
            Boletim da Igreja
          </p>
          <p className="text-slate-700 text-sm leading-relaxed">
            Aqui reunimos a palavra pastoral, a imagem-tema do culto, a ordem da liturgia e, para quem estiver logado, a escala relacionada.
            A home deixa de ser apenas uma vitrine de liturgia e passa a ser o nosso boletim eletronico central.
          </p>
        </div>

        {/* Aviso logado */}
        {user && (
          <div className="mb-6 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Logado — visualizando boletins futuros (ate 14 dias a frente).
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Carregando cultos...</p>
          </div>
        )}

        {/* Sem cultos */}
        {!loading && cultos.length === 0 && (
            <div className="flex flex-col items-center py-24 gap-3 bg-white rounded-2xl border border-slate-200">
              <Music className="w-10 h-10 text-slate-300" />
            <p className="text-slate-400">Nenhum boletim publicado ainda.</p>
          </div>
        )}

        {/* Lista de cultos */}
        {!loading && cultos.length > 0 && (
          <div className="space-y-5">
            {cultos.map((culto) => {
              const itens = agruparItens(getItensOrdenados(culto));
              const isFuturo = new Date(culto.Dia + 'T00:00:00') >= new Date();

              return (
                <article
                  key={culto['Culto nr.']}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Cabeçalho verde */}
                  <div className="bg-emerald-900 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">
                          Boletim #{culto['Culto nr.']}
                        </p>
                        <h3 className="text-lg font-bold text-white capitalize">
                          {formatDate(culto.Dia)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                        {isFuturo && user && (
                          <span className="text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-300/20 px-3 py-1 rounded-full">
                            Próximo
                          </span>
                        )}
                        <button
                          onClick={() => compartilharWhatsApp(culto)}
                          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 active:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                          </svg>
                          <span className="hidden sm:inline">Compartilhar</span>
                        </button>
                      </div>
                    </div>

                    {/* Escala (só logado) */}
                    {user && (
                      <div className="mt-4">
                        <EscalaIntegrada
                          dataCulto={culto.Dia.split('T')[0]}
                          cultoConcluido={!isFuturo}
                        />
                      </div>
                    )}
                  </div>

                  {/* Corpo */}
                  <div className="p-6">

                    {/* Imagem */}
                    {culto.imagem_url && (
                      <div className="mb-6 rounded-xl overflow-hidden bg-slate-100">
                        <img
                          src={culto.imagem_url}
                          alt={`Tema do culto ${culto['Culto nr.']}`}
                          className="w-full object-contain max-h-72"
                        />
                      </div>
                    )}

                    {/* Palavra Pastoral */}
                    {culto.palavra_pastoral && (
                      <div className="mb-6 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">
                          ✝️ Palavra Pastoral
                        </p>
                        <p className="text-slate-700 text-sm leading-relaxed italic">
                          "{culto.palavra_pastoral}"
                        </p>
                        {culto.palavra_pastoral_autor && (
                          <p className="text-slate-400 text-xs mt-2 text-right">
                            — {culto.palavra_pastoral_autor}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Conteudo do boletim */}
                    <div className="divide-y divide-slate-50">
                      {itens.map((it, idx) => (
                        <div key={idx} className="py-3 flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">
                              {it.tipo}
                            </p>
                            {it.conteudo_publico && (
                              <p className="text-sm text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                                {it.conteudo_publico}
                              </p>
                            )}
                            {it.canticos.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {it.canticos.map((c, cidx) => (
                                  <p
                                    key={cidx}
                                    onClick={() => router.push(`/letra/${encodeURIComponent(c.nome)}`)}
                                    className="text-sm text-emerald-700 font-medium italic cursor-pointer hover:text-emerald-900 hover:underline transition-colors"
                                  >
                                    🎵 {c.nome}{c.tom ? ` (${c.tom})` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {!loading && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Anteriores
            </button>
            <span className="text-xs text-slate-400 font-medium">pág. {page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={cultos.length < 10}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Próximos <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </main>

      <footer className="border-t border-slate-100 mt-16 bg-white">
        <div className="max-w-4xl mx-auto px-5 py-6 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
            OIKOS Hub · Igreja Presbiteriana Ponta Negra · Manaus/AM
          </p>
        </div>
      </footer>

    </div>
  );
}
