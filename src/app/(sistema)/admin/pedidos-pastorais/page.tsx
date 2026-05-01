'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookHeart,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Mail,
  MailPlus,
  MessageSquareHeart,
  Phone,
  RefreshCcw,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { CHURCH_STORAGE_KEY } from '@/lib/church-utils';
import { resolveApiErrorMessage, resolveApiSuccessMessage } from '@/lib/api-feedback';
import { getIntlLocale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';

type PedidoPastoral = {
  id: string;
  igreja_id: string;
  usuario_acesso_id: string | null;
  pessoa_id: string | null;
  nome_solicitante: string;
  email_solicitante: string | null;
  telefone_solicitante: string | null;
  categoria: 'oracao' | 'aconselhamento' | 'visita' | 'pregacao' | 'outro';
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

const STATUS_BADGES: Record<PedidoPastoral['status'], string> = {
  novo: 'bg-amber-100 text-amber-900 border border-amber-200',
  em_andamento: 'bg-blue-100 text-blue-900 border border-blue-200',
  concluido: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
};

function copiarTextoComFallback(texto: string) {
  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copiado = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copiado) {
    throw new Error('COPY_FALLBACK_FAILED');
  }
}

export default function AdminPedidosPastoraisPage() {
  const router = useRouter();
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, usuarioPermitido, isSuperAdmin } = usePermissions();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );

  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [igreja, setIgreja] = useState<IgrejaResumo>(null);
  const [pedidos, setPedidos] = useState<PedidoPastoral[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('novo');
  const [pedidoAtualizandoId, setPedidoAtualizandoId] = useState<string | null>(null);
  const [exportandoNovos, setExportandoNovos] = useState(false);
  const notificacoesMarcadasRef = useRef<Set<string>>(new Set());
  const [contadores, setContadores] = useState({
    total: 0,
    novo: 0,
    em_andamento: 0,
    concluido: 0,
  });

  const loading = authLoading || permLoading;
  const podeAcessarPedidos = isSuperAdmin || ['pastor', 'seminarista'].includes(usuarioPermitido?.cargo || '');
  const statusLabels: Record<StatusFiltro, string> = {
    todos: tr('Todos', 'Todos', 'All'),
    novo: tr('Novos', 'Nuevos', 'New'),
    em_andamento: tr('Em andamento', 'En progreso', 'In progress'),
    concluido: tr('Concluídos', 'Completados', 'Completed'),
  };
  const categoriaLabels: Record<PedidoPastoral['categoria'], string> = {
    oracao: tr('Oração', 'Oración', 'Prayer'),
    aconselhamento: tr('Aconselhamento', 'Consejería', 'Counseling'),
    visita: tr('Visita', 'Visita', 'Visit'),
    pregacao: tr('Sobre a pregação', 'Sobre lo predicado', 'About the preaching'),
    outro: tr('Outro', 'Otro', 'Other'),
  };
  const formatarData = useCallback((value: string) => {
    return new Date(value).toLocaleString(intlLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [intlLocale]);
  const formatarContato = useCallback(
    (pedido: PedidoPastoral) => {
      const contatos = [
        pedido.email_solicitante || pedido.pessoa?.email,
        pedido.telefone_solicitante || pedido.pessoa?.telefone,
      ].filter(Boolean);

      return contatos.length > 0
        ? contatos.join(' | ')
        : tr('Sem contato informado', 'Sin contacto informado', 'No contact provided');
    },
    [tr]
  );

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
        throw new Error(
          resolveApiErrorMessage(
            locale,
            data,
            tr(
              'Erro ao carregar pedidos.',
              'Error al cargar pedidos.',
              'Error loading requests.'
            )
          )
        );
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
      setErro(
        error.message ||
          tr(
            'Erro ao carregar pedidos.',
            'Error al cargar pedidos.',
            'Error loading requests.'
          )
      );
    } finally {
      setLoadingPedidos(false);
    }
  }, [user, podeAcessarPedidos, igrejaId, statusFiltro, tr, locale]);

  useEffect(() => {
    if (!loading && user && podeAcessarPedidos) {
      carregarPedidos();
    }
  }, [loading, user, podeAcessarPedidos, carregarPedidos]);

  const marcarResumoPastoralComoLido = useCallback(async () => {
    if (!user || !podeAcessarPedidos || !igrejaId || notificacoesMarcadasRef.current.has(igrejaId)) return;

    try {
      notificacoesMarcadasRef.current.add(igrejaId);

      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: await buildAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          igreja_id: igrejaId,
          tipos: ['pastoral.resumo_10min'],
        }),
      });
    } catch (error) {
      notificacoesMarcadasRef.current.delete(igrejaId);
      console.error('Erro ao marcar notificações pastorais como lidas:', error);
    }
  }, [user, podeAcessarPedidos, igrejaId]);

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
        throw new Error(
          resolveApiErrorMessage(
            locale,
            data,
            tr(
              'Erro ao atualizar pedido.',
              'Error al actualizar el pedido.',
              'Error updating request.'
            )
          )
        );
      }

      setMensagem(
        resolveApiSuccessMessage(
          locale,
          data,
          tr(
            'Status do pedido atualizado.',
            'Estado del pedido actualizado.',
            'Request status updated.'
          )
        )
      );
      await carregarPedidos();
    } catch (error: any) {
      setErro(
        error.message ||
          tr(
            'Erro ao atualizar pedido.',
            'Error al actualizar el pedido.',
            'Error updating request.'
          )
      );
    } finally {
      setPedidoAtualizandoId(null);
    }
  }

  async function carregarPedidosNovosParaTexto() {
    if (!user || !podeAcessarPedidos) return [];

    const params = new URLSearchParams();
    if (igrejaId) params.set('igreja_id', igrejaId);
    params.set('status', 'novo');

    const response = await fetch(`/api/admin/pedidos-pastorais?${params.toString()}`, {
      headers: await buildAuthenticatedHeaders(),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        resolveApiErrorMessage(
          locale,
          data,
          tr(
            'Erro ao carregar pedidos novos.',
            'Error al cargar solicitudes nuevas.',
            'Error loading new requests.'
          )
        )
      );
    }

    return (data.pedidos || []) as PedidoPastoral[];
  }

  function montarTextoPedidosNovos(pedidosNovos: PedidoPastoral[]) {
    const titulo = tr(
      `Pedidos pastorais novos - ${igrejaNome}`,
      `Solicitudes pastorales nuevas - ${igrejaNome}`,
      `New pastoral requests - ${igrejaNome}`
    );
    const geradoEm = tr('Gerado em', 'Generado el', 'Generated on');
    const linha = '----------------------------------------';

    return [
      `*${titulo}*`,
      `${geradoEm}: ${new Date().toLocaleString(intlLocale)}`,
      '',
      linha,
      '',
      ...pedidosNovos.flatMap((pedido, index) => [
        `*Pedido ${index + 1}*`,
        `${tr('Nome', 'Nombre', 'Name')}: ${pedido.nome_solicitante}`,
        `${tr('Contato', 'Contacto', 'Contact')}: ${formatarContato(pedido)}`,
        `${tr('Categoria', 'Categoría', 'Category')}: ${categoriaLabels[pedido.categoria]}`,
        pedido.assunto?.trim()
          ? `${tr('Assunto', 'Asunto', 'Subject')}: ${pedido.assunto.trim()}`
          : null,
        '',
        `${tr('Mensagem', 'Mensaje', 'Message')}:`,
        pedido.mensagem.trim(),
        '',
        linha,
        '',
      ].filter(Boolean) as string[]),
    ].join('\n');
  }

  async function copiarTexto(texto: string) {
    try {
      if (!navigator.clipboard?.writeText) {
        copiarTextoComFallback(texto);
        return;
      }

      await navigator.clipboard.writeText(texto);
    } catch {
      copiarTextoComFallback(texto);
    }
  }

  async function copiarTextoPedidosNovos() {
    try {
      setExportandoNovos(true);
      setMensagem(null);
      setErro(null);

      const pedidosNovos =
        statusFiltro === 'novo' && pedidos.length > 0
          ? pedidos
          : await carregarPedidosNovosParaTexto();

      if (pedidosNovos.length === 0) {
        setMensagem(tr('Não há pedidos novos para copiar.', 'No hay solicitudes nuevas para copiar.', 'There are no new requests to copy.'));
        return;
      }

      const texto = montarTextoPedidosNovos(pedidosNovos);
      await copiarTexto(texto);

      setMensagem(
        tr(
          'Texto dos pedidos novos copiado para enviar no WhatsApp.',
          'Texto de las solicitudes nuevas copiado para enviar por WhatsApp.',
          'New requests text copied for WhatsApp.'
        )
      );
    } catch (error: any) {
      setErro(
        error.message === 'COPY_FALLBACK_FAILED'
          ? tr(
              'Não foi possível copiar automaticamente neste navegador. Tente novamente na aba Novos ou use o botão de e-mail.',
              'No fue posible copiar automáticamente en este navegador. Intenta de nuevo en la pestaña Nuevos o usa el botón de correo.',
              'Could not copy automatically in this browser. Try again on the New tab or use the email button.'
            )
          : error.message || tr('Erro ao copiar pedidos.', 'Error al copiar solicitudes.', 'Error copying requests.')
      );
    } finally {
      setExportandoNovos(false);
    }
  }

  async function abrirEmailPedidosNovos() {
    try {
      setExportandoNovos(true);
      setMensagem(null);
      setErro(null);

      const pedidosNovos = await carregarPedidosNovosParaTexto();

      if (pedidosNovos.length === 0) {
        setMensagem(tr('Não há pedidos novos para enviar.', 'No hay solicitudes nuevas para enviar.', 'There are no new requests to send.'));
        return;
      }

      const subject = tr(
        `Pedidos pastorais novos - ${igrejaNome}`,
        `Solicitudes pastorales nuevas - ${igrejaNome}`,
        `New pastoral requests - ${igrejaNome}`
      );
      const body = montarTextoPedidosNovos(pedidosNovos);
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch (error: any) {
      setErro(error.message || tr('Erro ao preparar e-mail.', 'Error al preparar el correo.', 'Error preparing email.'));
    } finally {
      setExportandoNovos(false);
    }
  }

  const igrejaNome = useMemo(
    () =>
      igreja?.nome_abreviado ||
      igreja?.nome ||
      tr('igreja ativa', 'iglesia activa', 'active church'),
    [igreja, tr]
  );

  if (loading || !user || !podeAcessarPedidos) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-sky-900 via-sky-800 to-cyan-700 p-8 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold">
                <BookHeart className="h-8 w-8" />
                {tr('Pedidos', 'Pedidos', 'Requests')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-sky-100 sm:text-base">
                {tr(
                  'Caixa de entrada para acompanhar novos pedidos de oração, aconselhamento e visitas de ',
                  'Bandeja de entrada para seguir nuevos pedidos de oración, consejería y visitas de ',
                  'Inbox to track new prayer, counseling, and visit requests from '
                )}
                {igrejaNome}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copiarTextoPedidosNovos}
                disabled={exportandoNovos || contadores.novo === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-sky-900 shadow-sm hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/55"
              >
                <ClipboardCopy className="h-4 w-4" />
                {tr('Copiar novos', 'Copiar nuevas', 'Copy new')}
              </button>

              <button
                type="button"
                onClick={abrirEmailPedidosNovos}
                disabled={exportandoNovos || contadores.novo === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/55"
              >
                <MailPlus className="h-4 w-4" />
                {tr('Enviar por e-mail', 'Enviar por correo', 'Email text')}
              </button>

              <button
                type="button"
                onClick={() => carregarPedidos()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <RefreshCcw className="h-4 w-4" />
                {tr('Atualizar', 'Actualizar', 'Refresh')}
              </button>
            </div>
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
                  {statusLabels[status]}
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
            {tr('Carregando pedidos...', 'Cargando pedidos...', 'Loading requests...')}
          </div>
        ) : pedidos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <MessageSquareHeart className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-4 text-lg font-semibold text-slate-900">
              {tr('Nenhum pedido nesta fila', 'Ningún pedido en esta cola', 'No requests in this queue')}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {tr(
                'Quando chegarem novos pedidos para a igreja ativa, eles aparecerão aqui.',
                'Cuando lleguen nuevos pedidos para la iglesia activa, aparecerán aquí.',
                'When new requests arrive for the active church, they will appear here.'
              )}
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
                        {statusLabels[pedido.status]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {categoriaLabels[pedido.categoria]}
                      </span>
                      {pedido.deseja_retorno && (
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                          {tr('Deseja retorno', 'Desea respuesta', 'Wants a response')}
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {pedido.assunto?.trim() ||
                          tr(
                            `Pedido de ${categoriaLabels[pedido.categoria]}`,
                            `Pedido de ${categoriaLabels[pedido.categoria]}`,
                            `${categoriaLabels[pedido.categoria]} request`
                          )}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {tr('Recebido em', 'Recibido el', 'Received on')} {formatarData(pedido.criado_em)}
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                      <p className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        {pedido.nome_solicitante}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {pedido.email_solicitante || pedido.pessoa?.email || tr('Sem e-mail', 'Sin correo', 'No email')}
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {pedido.telefone_solicitante || pedido.pessoa?.telefone || tr('Sem telefone', 'Sin teléfono', 'No phone')}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-400" />
                        {tr('Atualizado em', 'Actualizado el', 'Updated on')} {formatarData(pedido.atualizado_em)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{pedido.mensagem}</p>
                    </div>
                  </div>

                  <div className="min-w-[230px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {tr('Andamento', 'Seguimiento', 'Progress')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {tr(
                        'Marque o estágio atual para organizar a caixa de entrada pastoral.',
                        'Marca la etapa actual para organizar la bandeja pastoral.',
                        'Mark the current stage to organize the pastoral inbox.'
                      )}
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
                          {statusLabels[status]}
                        </button>
                      ))}
                    </div>

                    {(pedido.pessoa?.id || pedido.usuario_acesso?.id) && (
                      <div className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
                        {pedido.pessoa?.id && (
                          <p>
                            {tr(
                              'Pessoa vinculada ao cadastro da igreja.',
                              'Persona vinculada al registro de la iglesia.',
                              'Person linked to the church record.'
                            )}
                          </p>
                        )}
                        {pedido.usuario_acesso?.id && (
                          <p>
                            {tr(
                              'Solicitante identificado com acesso ao sistema.',
                              'Solicitante identificado con acceso al sistema.',
                              'Requester identified with system access.'
                            )}
                          </p>
                        )}
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
