'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  Eye,
  Globe,
  MapPin,
  Music,
  Phone,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { formatIgrejaLocalizacao } from '@/lib/church-utils';

interface BoletimItem {
  id: string;
  secao_id: string | null;
  conteudo: string;
  destaque: boolean | null;
  ordem: number | null;
  criado_em: string | null;
}

interface BoletimSecao {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
  itens: BoletimItem[];
}

interface AgendaCulto {
  id: string;
  igreja_id: string;
  nome: string;
  dia_semana: string;
  horario: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number | null;
}

interface RedeSocial {
  id: string;
  igreja_id: string;
  tipo: string;
  url: string;
  ativo: boolean;
  ordem: number | null;
}

interface IgrejaDetalhes {
  id: string;
  nome: string;
  nome_abreviado: string | null;
  nome_completo: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  regiao: string | null;
  endereco_completo: string | null;
  logradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  instagram: string | null;
  youtube: string | null;
  whatsapp: string | null;
  horario_publicacao_boletim: string | null;
  dia_publicacao_boletim: number | null;
  timezone_boletim: string | null;
}

const STORAGE_KEY = 'oikos:selected-church-id';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string | null>(null);
  const [igrejaDetalhes, setIgrejaDetalhes] = useState<IgrejaDetalhes | null>(null);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecao[]>([]);
  const [agendaCultos, setAgendaCultos] = useState<AgendaCulto[]>([]);
  const [redesSociais, setRedesSociais] = useState<RedeSocial[]>([]);
  const [loadingIgrejas, setLoadingIgrejas] = useState(true);
  const [loadingBoletim, setLoadingBoletim] = useState(true);
  const [mensagemBoletim, setMensagemBoletim] = useState<string | null>(null);

  const igrejaSelecionada = useMemo(
    () => igrejas.find((igreja) => igreja.id === igrejaAtualId) || null,
    [igrejas, igrejaAtualId]
  );

  const localizacao = igrejaSelecionada
    ? formatIgrejaLocalizacao(igrejaSelecionada)
    : null;

  const horarioPublicacao = useMemo(() => {
    if (!igrejaDetalhes?.horario_publicacao_boletim) return null;

    return igrejaDetalhes.horario_publicacao_boletim.slice(0, 5);
  }, [igrejaDetalhes]);

  const diaPublicacao = useMemo(() => {
    const valor = igrejaDetalhes?.dia_publicacao_boletim;
    if (!valor || valor < 1 || valor > 7) return null;
    return DIAS_SEMANA[valor - 1];
  }, [igrejaDetalhes]);

  const enderecoFormatado = useMemo(() => {
    if (!igrejaDetalhes) return null;

    return (
      igrejaDetalhes.endereco_completo ||
      [igrejaDetalhes.logradouro, igrejaDetalhes.complemento, igrejaDetalhes.bairro]
        .filter(Boolean)
        .join(', ')
    );
  }, [igrejaDetalhes]);

  const compartilharWhatsApp = async () => {
    if (!igrejaSelecionada) return;

    let texto = `*BOLETIM ELETRONICO*\n`;
    texto += `⛪ ${igrejaDetalhes?.nome_completo || igrejaSelecionada.nome}\n`;

    if (localizacao) {
      texto += `📍 ${localizacao}\n`;
    }

    if (diaPublicacao || horarioPublicacao) {
      texto += `🗓️ Publicacao: ${[diaPublicacao, horarioPublicacao].filter(Boolean).join(' às ')}\n`;
    }

    texto += '\n';

    if (agendaCultos.length > 0) {
      texto += '*AGENDA DE CULTOS*\n';
      for (const culto of agendaCultos) {
        texto += `• ${culto.nome} — ${culto.dia_semana} às ${culto.horario.slice(0, 5)}\n`;
      }
      texto += '\n';
    }

    for (const [index, secao] of boletimSecoes.entries()) {
      texto += `*${index + 1}. ${secao.titulo}*\n`;
      for (const item of secao.itens) {
        texto += `${item.destaque ? '• ' : '- '}${item.conteudo}\n`;
      }
      texto += '\n';
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  useEffect(() => {
    let active = true;

    const carregarIgrejas = async () => {
      try {
        setLoadingIgrejas(true);
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar igrejas.');
        }

        if (!active) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        setIgrejas(lista);

        const igrejaPreferida =
          typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

        const prioridade = [igrejaPreferida, data.igrejaAtualId, lista[0]?.id || null].filter(Boolean) as string[];
        const primeiraValida =
          prioridade.find((id) => lista.some((igreja) => igreja.id === id)) || null;

        setIgrejaAtualId(primeiraValida);
      } catch (error) {
        console.error('Erro ao carregar igrejas:', error);
      } finally {
        if (active) {
          setLoadingIgrejas(false);
        }
      }
    };

    carregarIgrejas();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!igrejaAtualId) return;
    localStorage.setItem(STORAGE_KEY, igrejaAtualId);
  }, [igrejaAtualId]);

  useEffect(() => {
    if (authLoading || !igrejaAtualId) return;

    let active = true;

    const carregarBoletim = async () => {
      try {
        setLoadingBoletim(true);
        setMensagemBoletim(null);

        const params = new URLSearchParams({ igreja_id: igrejaAtualId });
        const response = await fetch(`/api/boletins-home?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar boletim.');
        }

        if (!active) return;

        setIgrejaDetalhes((data.igrejaDetalhes || null) as IgrejaDetalhes | null);
        setBoletimSecoes((data.boletimSecoes || []) as BoletimSecao[]);
        setAgendaCultos((data.agendaCultos || []) as AgendaCulto[]);
        setRedesSociais((data.redesSociais || []) as RedeSocial[]);
        setMensagemBoletim(data.message || null);
      } catch (error: any) {
        if (!active) return;
        console.error('Erro ao carregar boletim:', error);
        setIgrejaDetalhes(null);
        setBoletimSecoes([]);
        setAgendaCultos([]);
        setRedesSociais([]);
        setMensagemBoletim(error.message || 'Erro ao carregar boletim.');
      } finally {
        if (active) {
          setLoadingBoletim(false);
        }
      }
    };

    carregarBoletim();

    return () => {
      active = false;
    };
  }, [igrejaAtualId, authLoading]);

  const loading = loadingIgrejas || loadingBoletim;

  const isImageSection = (secao: BoletimSecao) => secao.tipo === 'imagem_tema';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-emerald-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-0.5">
              OIKOS Hub
            </p>
            <h1 className="text-xl font-bold text-white">Boletim Eletronico</h1>
            {igrejaSelecionada && (
              <p className="text-sm text-emerald-100 mt-1">{igrejaDetalhes?.nome_completo || igrejaSelecionada.nome}</p>
            )}
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
                  onClick={async () => {
                    await signOut();
                    window.location.reload();
                  }}
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-2">
              Boletim da Igreja
            </p>
            <p className="text-slate-700 text-sm leading-relaxed">
              A home agora e o boletim eletronico publico de cada igreja cadastrada no sistema, com agenda local, secoes do boletim e canais oficiais.
            </p>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-end">
            <div className="min-w-0">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Igreja
              </label>
              <select
                value={igrejaAtualId || ''}
                onChange={(e) => setIgrejaAtualId(e.target.value || null)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none text-slate-900"
              >
                {igrejas.map((igreja) => (
                  <option key={igreja.id} value={igreja.id}>
                    {igreja.sigla ? `${igreja.sigla} · ${igreja.nome}` : igreja.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1">
                  Localizacao
                </p>
                <p className="text-sm text-slate-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  {localizacao || 'Nao informada'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-1">
                  Publicacao
                </p>
                <p className="text-sm text-slate-700 flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                  {[diaPublicacao, horarioPublicacao].filter(Boolean).join(' às ') || 'Nao configurada'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {user && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Logado. O painel administrativo segue disponivel para gestao interna da igreja selecionada.
            </p>
          </div>
        )}

        {mensagemBoletim && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            {mensagemBoletim}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Carregando boletim...</p>
          </div>
        )}

        {!loading && (
          <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-6">
            <section className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1">
                    Edicao Atual
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">
                    {igrejaDetalhes?.nome_completo || igrejaSelecionada?.nome || 'Boletim'}
                  </h2>
                  {enderecoFormatado && (
                    <p className="text-sm text-slate-500 mt-1">{enderecoFormatado}</p>
                  )}
                </div>
                <button
                  onClick={compartilharWhatsApp}
                  disabled={!igrejaSelecionada}
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-slate-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Compartilhar
                </button>
              </div>

              {boletimSecoes.length === 0 ? (
                <div className="flex flex-col items-center py-24 gap-3 bg-white rounded-2xl border border-slate-200">
                  <Music className="w-10 h-10 text-slate-300" />
                  <p className="text-slate-400">Nenhuma secao de boletim publicada para esta igreja.</p>
                </div>
              ) : (
                boletimSecoes.map((secao, index) => (
                  <article
                    key={secao.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                  >
                    <div className="bg-emerald-900 px-6 py-5">
                      <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">
                        Secao {index + 1}
                      </p>
                      <h3 className="text-lg font-bold text-white">{secao.titulo}</h3>
                      <p className="text-sm text-emerald-100 mt-1">
                        {secao.tipo}
                      </p>
                    </div>

                    <div className="p-6">
                      {secao.itens.length === 0 ? (
                        <p className="text-sm text-slate-400">Sem itens publicados nesta secao.</p>
                      ) : (
                        <div className="space-y-3">
                          {secao.itens.map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-xl border px-4 py-3 ${
                                item.destaque
                                  ? 'border-emerald-200 bg-emerald-50'
                                  : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              {isImageSection(secao) ? (
                                <img
                                  src={item.conteudo}
                                  alt={secao.titulo}
                                  className="w-full max-h-[28rem] object-contain rounded-lg bg-white"
                                />
                              ) : (
                                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                  {item.conteudo}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>

            <aside className="space-y-4">
              <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">Agenda de Cultos</h3>
                </div>

                {agendaCultos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum culto configurado para esta igreja.</p>
                ) : (
                  <div className="space-y-3">
                    {agendaCultos.map((culto) => (
                      <div
                        key={culto.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">{culto.nome}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {culto.dia_semana} às {culto.horario.slice(0, 5)}
                        </p>
                        {culto.descricao && (
                          <p className="text-sm text-slate-500 mt-2">{culto.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">Canais da Igreja</h3>
                </div>

                <div className="space-y-3">
                  {igrejaDetalhes?.site && (
                    <a
                      href={igrejaDetalhes.site}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      <span>Site oficial</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {igrejaDetalhes?.email && (
                    <a
                      href={`mailto:${igrejaDetalhes.email}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      <span>{igrejaDetalhes.email}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {igrejaDetalhes?.telefone && (
                    <a
                      href={`tel:${igrejaDetalhes.telefone}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      <span>{igrejaDetalhes.telefone}</span>
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {redesSociais.map((rede) => (
                    <a
                      key={rede.id}
                      href={rede.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      <span className="capitalize">{rede.tipo}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ))}
                  {!igrejaDetalhes?.site &&
                    !igrejaDetalhes?.email &&
                    !igrejaDetalhes?.telefone &&
                    redesSociais.length === 0 && (
                      <p className="text-sm text-slate-400">Nenhum canal publico cadastrado.</p>
                    )}
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-100 mt-16 bg-white">
        <div className="max-w-6xl mx-auto px-5 py-6 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
            OIKOS Hub
            {igrejaSelecionada ? ` · ${igrejaSelecionada.nome}` : ''}
          </p>
        </div>
      </footer>
    </div>
  );
}
