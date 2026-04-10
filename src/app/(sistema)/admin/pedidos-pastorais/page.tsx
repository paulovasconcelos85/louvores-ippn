'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookHeart,
  CheckCircle2,
  Clock3,
  Mail,
  MessageSquareHeart,
  Phone,
  RefreshCcw,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { CHURCH_STORAGE_KEY } from '@/lib/church-utils';

type PedidoPastoral = {
  id: string;
  igreja_id: string;
  usuario_acesso_id: string | null;
  pessoa_id: string | null;
  nome_solicitante: string;
  email_solicitante: string | null;
  telefone_solicitante: string | null;
  categoria: 'oracao' | 'aconselhamento' | 'visita' | 'outro';
  assunto: string | null;
  mensagem: string;
  deseja_retorno: boolean;
  status: 'novo' | 'em_andamento' | 'concluido';
  criado_em: string;
  atualizado_em: string;
  pessoa?: {
    id: string;
    nome: string | null;
    email: string | null;
    telefone: string | null;
  } | null;
  usuario_acesso?: {
    id: string;
    nome: string | null;
    email: string | null;
  } | null;
};

type IgrejaResumo = {
  id: string;
  nome?: string | null;
  nome_abreviado?: string | null;
  slug?: string | null;
} | null;

type StatusFiltro = 'todos' | 'novo' | 'em_andamento' | 'concluido';

const STATUS_LABELS: Record<StatusFiltro, string> = {
  todos: 'Todos',
  novo: 'Novos',
  em_andamento: 'Em andamento',
  concluido: 'Concluídos',
};

const CATEGORIA_LABELS: Record<PedidoPastoral['categoria'], string> = {
  oracao: 'Oração',
  aconselhamento: 'Aconselhamento',
  visita: 'Visita',
  outro: 'Outro',
};

const STATUS_BADGES: Record<PedidoPastoral['status'], string> = {
  novo: 'bg-amber-100 text-amber-900 border border-amber-200',
  em_andamento: 'bg-blue-100 text-blue-900 border border-blue-200',
  concluido: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
};

function formatarData(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPedidosPastoraisPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, usuarioPermitido, isSuperAdmin } = usePermissions();

  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [igreja, setIgreja] = useState<IgrejaResumo>(null);
  const [pedidos, setPedidos] = useState<PedidoPastoral[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('novo');
  const [pedidoAtualizandoId, setPedidoAtualizandoId] = useState<string | null>(null);
  const [marcandoNotificacoes, setMarcandoNotificacoes] = useState(false);
  const [contadores, setContadores] = useState({
    total: 0,
    novo: 0,
    em_andamento: 0,
    concluido: 0,
  });

  const loading = authLoading || permLoading;
  const podeAcessarPedidos = isSuperAdmin || ['pastor', 'seminarista'].includes(usuarioPermitido?.cargo || '');

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!podeAcessarPedidos) {
      router.push('/admin');
    }
  }, [loading, user, podeAcessarPedidos, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIgrejaId(localStorage.getItem(CHURCH_STORAGE_KEY));
  }, []);

  const carregarPedidos = useCallback(async () => {
    if (!user || !podeAcessarPedidos) return;

    try {
      setLoadingPedidos(true);
      setErro(null);

      const params = new URLSearchParams();
      if (igrejaId) params.set('igreja_id', igrejaId);
      if (statusFiltro !== 'todos') params.set('status', statusFiltro);

      const response = await fetch(`/api/admin/pedidos-pastorais?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar pedidos.');
      }

      setPedidos(data.pedidos || []);
      setContadores(data.contadores || { total: 0, novo: 0, em_andamento: 0, concluido: 0 });
      setIgreja(data.igreja || null);
      if (data.igrejaAtualId) {
        setIgrejaId(data.igrejaAtualId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(CHURCH_STORAGE_KEY, data.igrejaAtualId);
        }
      }
    } catch (error: any) {
      setErro(error.message || 'Erro ao carregar pedidos.');
    } finally {
      setLoadingPedidos(false);
    }
  }, [user, podeAcessarPedidos, igrejaId, statusFiltro]);

  useEffect(() => {
    if (!loading && user && podeAcessarPedidos) {
      carregarPedidos();
    }
  }, [loading, user, podeAcessarPedidos, carregarPedidos]);

  const marcarResumoPastoralComoLido = useCallback(async () => {
    if (!user || !podeAcessarPedidos || !igrejaId || marcandoNotificacoes) return;

    try {
      setMarcandoNotificacoes(true);

      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          igreja_id: igrejaId,
          tipos: ['pastoral.resumo_10min'],
        }),
      });
    } catch (error) {
      console.error('Erro ao marcar notificações pastorais como lidas:', error);
    } finally {
      setMarcandoNotificacoes(false);
    }
  }, [user, podeAcessarPedidos, igrejaId, marcandoNotificacoes]);

  useEffect(() => {
    if (!loading && user && podeAcessarPedidos && igrejaId) {
      marcarResumoPastoralComoLido();
    }
  }, [loading, user, podeAcessarPedidos, igrejaId, marcarResumoPastoralComoLido]);

  async function atualizarStatus(pedidoId: string, novoStatus: PedidoPastoral['status']) {
    try {
      setPedidoAtualizandoId(pedidoId);
      setMensagem(null);
      setErro(null);

      const response = await fetch('/api/admin/pedidos-pastorais', {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: pedidoId,
          status: novoStatus,
          igreja_id: igrejaId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar pedido.');
      }

      setMensagem('Status do pedido atualizado.');
      await carregarPedidos();
    } catch (error: any) {
      setErro(error.message || 'Erro ao atualizar pedido.');
    } finally {
      setPedidoAtualizandoId(null);
    }
  }

  const igrejaNome = useMemo(() => igreja?.nome_abreviado || igreja?.nome || 'igreja ativa', [igreja]);

  if (loading || !user || !podeAcessarPedidos) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-sky-900 via-sky-800 to-cyan-700 p-8 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold">
                <BookHeart className="h-8 w-8" />
                Pedidos
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-sky-100 sm:text-base">
                Caixa de entrada para acompanhar novos pedidos de oração, aconselhamento e visitas de{' '}
                {igrejaNome}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => carregarPedidos()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(['novo', 'em_andamento', 'concluido', 'todos'] as StatusFiltro[]).map((status) => {
            const total =
              status === 'todos'
                ? contadores.total
                : status === 'novo'
                  ? contadores.novo
                  : status === 'em_andamento'
                    ? contadores.em_andamento
                    : contadores.concluido;

            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFiltro(status)}
                className={`rounded-2xl border p-4 text-left transition ${
                  statusFiltro === status
                    ? 'border-sky-700 bg-sky-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-sky-200'
                }`}
              >
                <p className={`text-sm font-semibold ${statusFiltro === status ? 'text-sky-100' : 'text-slate-600'}`}>
                  {STATUS_LABELS[status]}
                </p>
                <p className="mt-2 text-3xl font-bold">{total}</p>
              </button>
            );
          })}
        </div>

        {mensagem && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {mensagem}
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {loadingPedidos ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Carregando pedidos...
          </div>
        ) : pedidos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <MessageSquareHeart className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 text-lg font-semibold text-slate-900">Nenhum pedido nesta fila</p>
            <p className="mt-1 text-sm text-slate-500">
              Quando chegarem novos pedidos para a igreja ativa, eles aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos.map((pedido) => (
              <article key={pedido.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[pedido.status]}`}>
                        {STATUS_LABELS[pedido.status]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {CATEGORIA_LABELS[pedido.categoria]}
                      </span>
                      {pedido.deseja_retorno && (
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                          Deseja retorno
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {pedido.assunto?.trim() || `Pedido de ${CATEGORIA_LABELS[pedido.categoria]}`}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Recebido em {formatarData(pedido.criado_em)}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                      <p className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        {pedido.nome_solicitante}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {pedido.email_solicitante || pedido.pessoa?.email || 'Sem e-mail'}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {pedido.telefone_solicitante || pedido.pessoa?.telefone || 'Sem telefone'}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-400" />
                        Atualizado em {formatarData(pedido.atualizado_em)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{pedido.mensagem}</p>
                    </div>
                  </div>

                  <div className="min-w-[230px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Andamento</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Marque o estágio atual para organizar a caixa de entrada pastoral.
                    </p>

                    <div className="mt-4 space-y-2">
                      {(['novo', 'em_andamento', 'concluido'] as PedidoPastoral['status'][]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={pedidoAtualizandoId === pedido.id || pedido.status === status}
                          onClick={() => atualizarStatus(pedido.id, status)}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                            pedido.status === status
                              ? 'cursor-default bg-slate-900 text-white'
                              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-wait'
                          }`}
                        >
                          {status === 'concluido' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                          {STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>

                    {(pedido.pessoa?.id || pedido.usuario_acesso?.id) && (
                      <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
                        {pedido.pessoa?.id && <p>Pessoa vinculada ao cadastro da igreja.</p>}
                        {pedido.usuario_acesso?.id && <p>Solicitante identificado com acesso ao sistema.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
