'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, HeartHandshake, Mail, MapPin, Phone, SendHorizonal } from 'lucide-react';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY, formatIgrejaLocalizacao } from '@/lib/church-utils';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { useAuth } from '@/hooks/useAuth';

type CategoriaPedido = 'oracao' | 'aconselhamento' | 'visita' | 'outro';

const CATEGORIAS: Array<{ value: CategoriaPedido; label: string }> = [
  { value: 'oracao', label: 'Oração' },
  { value: 'aconselhamento', label: 'Aconselhamento' },
  { value: 'visita', label: 'Visita' },
  { value: 'outro', label: 'Outro' },
];

async function lerJsonSeguro(response: Response) {
  const texto = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('Resposta inválida do servidor.');
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('Não foi possível ler a resposta do servidor.');
  }
}

export function PublicPedidosPage({ forcedSlug }: { forcedSlug?: string | null }) {
  const { user } = useAuth();
  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string>('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [categoria, setCategoria] = useState<CategoriaPedido>('oracao');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loadingIgrejas, setLoadingIgrejas] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const igrejaAtual = useMemo(
    () => igrejas.find((igreja) => igreja.id === igrejaAtualId) || null,
    [igrejas, igrejaAtualId]
  );

  useEffect(() => {
    if (user?.email) {
      setEmail((current) => current || user.email || '');
    }
  }, [user?.email]);

  useEffect(() => {
    let active = true;

    const carregarIgrejas = async () => {
      try {
        setLoadingIgrejas(true);
        setErro(null);
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar igrejas.');
        }

        if (!active) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        setIgrejas(lista);

        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const igrejaPreferida =
          typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null;

        const igrejaPorSlug =
          forcedSlug
            ? lista.find((igreja) => (igreja.slug || '').toLowerCase() === forcedSlug.toLowerCase()) || null
            : null;

        if (forcedSlug && !igrejaPorSlug) {
          setErro('Não encontramos uma igreja pública com esse link.');
          setIgrejaAtualId('');
          return;
        }

        const prioridade = [
          igrejaPorSlug?.id || null,
          igrejaUrl,
          igrejaPreferida,
          data.igrejaAtualId,
          lista[0]?.id || null,
        ].filter(Boolean) as string[];

        const igrejaResolvida =
          prioridade.find((id) => lista.some((igreja) => igreja.id === id)) || '';

        setIgrejaAtualId(igrejaResolvida);

        if (igrejaResolvida && typeof window !== 'undefined') {
          localStorage.setItem(CHURCH_STORAGE_KEY, igrejaResolvida);
        }
      } catch (error: any) {
        if (!active) return;
        setErro(error.message || 'Não foi possível carregar as igrejas.');
      } finally {
        if (active) setLoadingIgrejas(false);
      }
    };

    carregarIgrejas();

    return () => {
      active = false;
    };
  }, [forcedSlug]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setEnviando(true);
      setErro(null);
      setSucesso(null);

      const response = await fetch('/api/pedidos-pastorais', {
        method: 'POST',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          igreja_id: igrejaAtualId,
          nome_solicitante: nome,
          email_solicitante: email || null,
          telefone_solicitante: telefone || null,
          categoria,
          assunto: assunto || null,
          mensagem,
          deseja_retorno: true,
        }),
      });

      const data = await lerJsonSeguro(response);

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar pedido.');
      }

      setSucesso(
        `Pedido enviado com sucesso para ${data.igreja?.nome || 'a igreja selecionada'}. A equipe vai acompanhar com carinho.`
      );
      setAssunto('');
      setMensagem('');
      setCategoria('oracao');
    } catch (error: any) {
      setErro(error.message || 'Erro ao enviar pedido.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbf9_0%,#eef6f1_48%,#fbfbf8_100%)]">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="space-y-6">
          <Link
            href={igrejaAtualId ? `/?igreja_id=${igrejaAtualId}` : '/'}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao boletim
          </Link>

          <section className="rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,#0f3d31_0%,#195142_45%,#2b6c59_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(15,61,49,0.18)] sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/85">
              Atendimento
            </p>
            <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  <HeartHandshake className="h-8 w-8 text-amber-300" />
                  Pedidos
                </h1>
              </div>

              {igrejaAtual && (
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-emerald-50 backdrop-blur">
                  <p className="font-semibold">{igrejaAtual.sigla || igrejaAtual.nome}</p>
                  <p className="mt-1 flex items-center gap-2 text-emerald-100/80">
                    <MapPin className="h-4 w-4" />
                    {formatIgrejaLocalizacao(igrejaAtual) || igrejaAtual.nome}
                  </p>
                </div>
              )}
            </div>
          </section>

          <div className="mx-auto max-w-2xl">
            <section className="rounded-[24px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:rounded-[28px] sm:p-7">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Escreva seu pedido</h2>
              </div>

              {erro && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {erro}
                </div>
              )}

              {sucesso && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {sucesso}
                </div>
              )}

              {!loadingIgrejas && !igrejaAtualId && !erro && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Primeiro escolha a igreja pelo boletim público. Depois volte para enviar seu pedido.
                </div>
              )}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Seu nome</span>
                    <input
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Categoria</span>
                    <select
                      value={categoria}
                      onChange={(event) => setCategoria(event.target.value as CategoriaPedido)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      {CATEGORIAS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">E-mail</span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Telefone</span>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={telefone}
                        onChange={(event) => setTelefone(event.target.value)}
                        className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Assunto</span>
                  <input
                    value={assunto}
                    onChange={(event) => setAssunto(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Mensagem</span>
                  <textarea
                    value={mensagem}
                    onChange={(event) => setMensagem(event.target.value)}
                    rows={7}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    placeholder="Escreva aqui seu pedido..."
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={enviando || loadingIgrejas || !igrejaAtualId}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#365c4d] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#28463b] disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                >
                  <SendHorizonal className="h-4 w-4" />
                  {enviando ? 'Enviando...' : 'Enviar pedido'}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
