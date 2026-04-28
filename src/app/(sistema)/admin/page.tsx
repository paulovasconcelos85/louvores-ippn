'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  UserCog, 
  Calendar, 
  Music, 
  CalendarDays,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Library,
  MapPin,
  Star,
  Church,
  UserCheck,
  Globe,
  MessageSquareHeart,
  MessageSquareText
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/config';
import { getCargoLabel, getCargoCor } from '@/lib/permissions';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY, getStoredChurchId } from '@/lib/church-utils';
import { resolvePessoaIdForCurrentUser } from '@/lib/client-current-person';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveApiErrorMessage } from '@/lib/api-feedback';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface MinhaProximaEscala {
  escala_id: string;
  data: string;
  hora_inicio: string;
  funcao: string;
  tipo_culto: string;
  confirmado: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const locale = useLocale();
  const intlLocale = getIntlLocale(locale);
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
  const { user, loading: authLoading } = useAuth();
  const { usuarioPermitido, loading: permLoading, permissoes } = usePermissions();
  
  const [proximaEscala, setProximaEscala] = useState<MinhaProximaEscala | null>(null);
  const [igrejaAtual, setIgrejaAtual] = useState<IgrejaSelecionavel | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState({
    total: 0,
    pastoral: 0,
    escalas: 0,
  });

  const loading = authLoading || permLoading;

  const buscarProximaEscala = useCallback(async () => {
    if (!user) return;
    
    try {
      const pessoaId = await resolvePessoaIdForCurrentUser(user, {
        allowLegacyTemAcesso: false,
      });

      if (!pessoaId) {
        setProximaEscala(null);
        return;
      }

      const igrejaId = igrejaAtual?.id || getStoredChurchId();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataHoje = hoje.toISOString().split('T')[0];
      
      let query = supabase
        .from('escalas')
        .select(`
          id,
          data,
          hora_inicio,
          tipo_culto,
          escalas_funcoes!inner (
            confirmado,
            tags_funcoes (nome),
            pessoas!inner (id)
          )
        `)
        .eq('escalas_funcoes.pessoas.id', pessoaId)
        .gte('data', dataHoje)
        .eq('status', 'publicada')
        .order('data', { ascending: true })
        .limit(1);

      if (igrejaId) {
        query = query.eq('igreja_id', igrejaId);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const escala = data[0];
        const funcoes = escala.escalas_funcoes as unknown as any[];
        setProximaEscala({
          escala_id: escala.id,
          data: escala.data,
          hora_inicio: escala.hora_inicio,
          tipo_culto: escala.tipo_culto,
          funcao: funcoes[0]?.tags_funcoes?.nome || tr('Função', 'Función', 'Role'),
          confirmado: funcoes[0]?.confirmado || false
        });
      } else {
        setProximaEscala(null);
      }
    } catch (error) {
      console.error('Erro ao buscar próxima escala:', error);
      setProximaEscala(null);
    }
  }, [user, igrejaAtual?.id, tr]);

  const carregarResumoNotificacoes = useCallback(async () => {
    if (!user) return;

    try {
      const params = new URLSearchParams();
      const igrejaId = igrejaAtual?.id || getStoredChurchId();

      if (igrejaId) {
        params.set('igreja_id', igrejaId);
      }

      const response = await fetch(`/api/admin/notifications?${params.toString()}`, {
        headers: await buildAuthenticatedHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(locale, data, tr('Erro ao carregar notificações.', 'Error al cargar notificaciones.', 'Error loading notifications.'))
        );
      }

      setUnreadNotifications(data.unread || { total: 0, pastoral: 0, escalas: 0 });
    } catch (error) {
      console.error('Erro ao carregar resumo de notificações:', error);
      setUnreadNotifications({ total: 0, pastoral: 0, escalas: 0 });
    }
  }, [user, igrejaAtual?.id, locale, tr]);

  const getTipoCultoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      dominical_manha: tr('Dominical - Manhã', 'Dominical - Mañana', 'Sunday - Morning'),
      dominical_noite: tr('Dominical - Noite', 'Dominical - Noche', 'Sunday - Evening'),
      quarta: tr('Quarta-feira', 'Miércoles', 'Wednesday'),
      especial: tr('Culto Especial', 'Culto Especial', 'Special Service')
    };
    return labels[tipo] || tipo;
  };

  const getCargoDisplayLabel = (cargo: string) => {
    const labels: Record<string, string> = {
      membro: tr('Membro', 'Miembro', 'Member'),
      diacono: tr('Diácono', 'Diácono', 'Deacon'),
      presbitero: tr('Presbítero', 'Presbítero', 'Elder'),
      pastor: tr('Pastor', 'Pastor', 'Pastor'),
      seminarista: tr('Seminarista', 'Seminarista', 'Seminarian'),
      staff: tr('Staff', 'Staff', 'Staff'),
      musico: tr('Músico', 'Músico', 'Musician'),
      admin: tr('Admin', 'Admin', 'Admin'),
      superadmin: 'Super Admin',
    };

    return labels[cargo] || getCargoLabel(cargo as any);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !permissoes.podeAcessarAdmin) {
      router.push('/');
    }
  }, [user, loading, permissoes.podeAcessarAdmin, router]);

  useEffect(() => {
    if (user) {
      buscarProximaEscala();
    }
  }, [user, buscarProximaEscala]);

  useEffect(() => {
    if (user) {
      carregarResumoNotificacoes();
    }
  }, [user, carregarResumoNotificacoes]);

  useEffect(() => {
    let ativo = true;

    const carregarIgrejaAtual = async () => {
      try {
        const response = await fetch('/api/igrejas/selecionaveis', {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            resolveApiErrorMessage(locale, data, 'Erro ao carregar igrejas.')
          );
        }

        if (!ativo) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const igrejaPreferida =
          typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null;
        const prioridade = [igrejaUrl, igrejaPreferida, data.igrejaAtualId, lista[0]?.id || null].filter(
          Boolean
        ) as string[];
        const igrejaResolvida =
          prioridade
            .map((id) => lista.find((igreja) => igreja.id === id) || null)
            .find(Boolean) || null;

        setIgrejaAtual(igrejaResolvida);

        if (igrejaResolvida && typeof window !== 'undefined') {
          localStorage.setItem(CHURCH_STORAGE_KEY, igrejaResolvida.id);
        }
      } catch (error) {
        console.error('Erro ao carregar identidade da igreja:', error);
        if (ativo) {
          setIgrejaAtual(null);
        }
      }
    };

    carregarIgrejaAtual();

    return () => {
      ativo = false;
    };
  }, [locale]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">{tr('Carregando...', 'Cargando...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!user || !usuarioPermitido) {
    return null;
  }

  const podeAcessarMembros = permissoes.podePastorearMembros;
  const podeAcessarPedidosPastorais =
    permissoes.isSuperAdmin || ['pastor', 'seminarista'].includes(usuarioPermitido?.cargo || '');
  const nomeIgreja = igrejaAtual?.nome || tr('sua igreja', 'su iglesia', 'your church');
  const tituloHub = igrejaAtual?.sigla ? `OIKOS Hub • ${igrejaAtual.sigla}` : 'OIKOS Hub';

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-2xl p-8 text-white mb-8">
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Church className="w-8 h-8" />
            {tr('Bem-vindo ao', 'Bienvenido a', 'Welcome to')} {tituloHub}
          </h2>
          <p className="text-emerald-100 mb-4 text-sm sm:text-base">
            {tr('Painel administrativo de', 'Panel administrativo de', 'Administrative panel for')} {nomeIgreja}
          </p>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 text-emerald-100">
              <UserCheck className="w-4 h-4" />
              <span>{tr('Usuário:', 'Usuario:', 'User:')} <span className="font-semibold text-white">{usuarioPermitido?.nome || user.email}</span></span>
            </div>
            {usuarioPermitido?.cargo && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCargoCor(usuarioPermitido.cargo)}`}>
                {getCargoDisplayLabel(usuarioPermitido.cargo)}
              </span>
            )}
            {permissoes.isSuperAdmin && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-900 border-2 border-yellow-400 flex items-center gap-1">
                <Star className="w-3 h-3" />
                Super Admin
              </span>
            )}
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 inline-flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <p className="text-sm">
              {tr(
                'Gerencie cultos, músicas, escalas e membros',
                'Gestiona cultos, música, escalas y miembros',
                'Manage services, music, schedules, and members'
              )}
            </p>
          </div>
        </div>

        {/* Aviso de Próxima Escala */}
        {proximaEscala && (
          <div className={`${
            proximaEscala.confirmado 
              ? 'bg-green-50 border-green-300' 
              : 'bg-amber-50 border-amber-400'
          } border-2 rounded-xl p-5 mb-8 shadow-sm`}>
            <div className="flex items-start gap-4">
              {proximaEscala.confirmado ? (
                <CheckCircle2 className="w-10 h-10 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-10 h-10 text-amber-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <p className={`font-bold text-lg flex items-center gap-2 ${
                    proximaEscala.confirmado ? 'text-green-900' : 'text-amber-900'
                  }`}>
                    <Music className="w-5 h-5" />
                    {proximaEscala.confirmado 
                      ? tr('Você está escalado e confirmado!', '¡Estás asignado y confirmado!', 'You are scheduled and confirmed!')
                      : tr('Você está escalado - Confirme sua presença!', 'Estás asignado - ¡Confirma tu asistencia!', 'You are scheduled - Confirm your attendance!')}
                  </p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    proximaEscala.confirmado 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-amber-200 text-amber-900'
                  }`}>
                    {proximaEscala.confirmado ? tr('CONFIRMADO', 'CONFIRMADO', 'CONFIRMED') : tr('PENDENTE', 'PENDIENTE', 'PENDING')}
                  </span>
                </div>
                
                <div className={`${
                  proximaEscala.confirmado ? 'text-green-700' : 'text-amber-700'
                } mb-3`}>
                  <p className="font-semibold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    {new Date(proximaEscala.data + 'T00:00:00').toLocaleDateString(intlLocale, {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long'
                    })} {tr('às', 'a las', 'at')} {proximaEscala.hora_inicio}
                  </p>
                  <p className="text-sm mt-1 flex items-center gap-2">
                    <Church className="w-3.5 h-3.5" />
                    {getTipoCultoLabel(proximaEscala.tipo_culto)}
                    <span className="mx-1">•</span>
                    <Music className="w-3.5 h-3.5" />
                    <span className="font-semibold">{proximaEscala.funcao}</span>
                  </p>
                </div>

                {!proximaEscala.confirmado && (
                  <div className={`bg-amber-100 border border-amber-300 rounded-lg p-3 text-sm mb-3 ${
                    proximaEscala.confirmado ? 'text-green-800' : 'text-amber-800'
                  }`}>
                    <p className="font-semibold mb-1 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {tr('Por favor, confirme sua presença:', 'Por favor, confirma tu asistencia:', 'Please confirm your attendance:')}
                    </p>
                    <p>{tr(
                      'Entre em contato com o responsável pelas escalas ou acesse a página de escalas para confirmar.',
                      'Ponte en contacto con el responsable de las escalas o accede a la página de escalas para confirmar.',
                      'Contact the person responsible for schedules or open the schedule page to confirm.'
                    )}</p>
                  </div>
                )}

                <button
                  onClick={() => router.push(`/escala/${proximaEscala.escala_id}`)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    proximaEscala.confirmado
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {proximaEscala.confirmado ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {tr('Ver Detalhes da Escala', 'Ver detalles de la escala', 'View Schedule Details')}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {tr('Confirmar Presença', 'Confirmar asistencia', 'Confirm Attendance')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {permissoes.podeGerenciarUsuarios && (
            <button
              onClick={() => router.push('/admin/usuarios')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-emerald-600 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Gerenciar Usuários', 'Gestionar Usuarios', 'Manage Users')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Controle quem pode acessar o sistema', 'Controla quién puede acceder al sistema', 'Control who can access the system')}
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {tr('Disponível', 'Disponible', 'Available')}
              </span>
            </button>
          )}

          {podeAcessarMembros && (
            <button
              onClick={() => router.push('/admin/membros')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-blue-600 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <UserCog className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Pastorear Membros', 'Pastorear Miembros', 'Member Care')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Acompanhamento e cuidado pastoral', 'Seguimiento y cuidado pastoral', 'Pastoral follow-up and care')}
              </p>
              <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {tr('Disponível', 'Disponible', 'Available')}
              </span>
            </button>
          )}

          {podeAcessarPedidosPastorais && (
            <button
              onClick={() => router.push('/admin/pedidos-pastorais')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-cyan-600 hover:shadow-lg transition-all text-left group"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="w-12 h-12 bg-cyan-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquareHeart className="w-6 h-6 text-white" />
                </div>
                {unreadNotifications.pastoral > 0 ? (
                  <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    {unreadNotifications.pastoral}
                  </span>
                ) : null}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Pedidos', 'Solicitudes', 'Requests')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr(
                  'Caixa de entrada para oração, aconselhamento e visitas',
                  'Bandeja de entrada para oración, consejería y visitas',
                  'Inbox for prayer, counseling, and visits'
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-cyan-700 font-semibold bg-cyan-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {tr('Disponível', 'Disponible', 'Available')}
                </span>
                {unreadNotifications.pastoral > 0 ? (
                  <span className="text-xs text-rose-700 font-semibold bg-rose-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {locale === 'es'
                      ? `${unreadNotifications.pastoral} nuevo${unreadNotifications.pastoral === 1 ? '' : 's'}`
                      : locale === 'en'
                        ? `${unreadNotifications.pastoral} new`
                        : `${unreadNotifications.pastoral} novo${unreadNotifications.pastoral === 1 ? '' : 's'}`}
                  </span>
                ) : null}
              </div>
            </button>
          )}

          {permissoes.podeGerenciarEscalas && (
            <button
              onClick={() => router.push('/admin/escalas')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-purple-600 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Gerenciar Escalas', 'Gestionar Escalas', 'Manage Schedules')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Crie e organize as escalas de músicos', 'Crea y organiza las escalas de músicos', 'Create and organize musician schedules')}
              </p>
              <span className="text-xs text-purple-700 font-semibold bg-purple-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {tr('Disponível', 'Disponible', 'Available')}
              </span>
            </button>
          )}

          {permissoes.isSuperAdmin && (
            <button
              onClick={() => router.push('/admin/oikos-leads')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-slate-900 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageSquareText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Leads OIKOS', 'Leads OIKOS', 'OIKOS Leads')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr(
                  'Acompanhe interessados na landing comercial',
                  'Acompaña interesados de la landing comercial',
                  'Track interested contacts from the sales landing page'
                )}
              </p>
              <span className="text-xs text-slate-800 font-semibold bg-slate-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <Star className="w-3 h-3" />
                Super Admin
              </span>
            </button>
          )}

          {permissoes.podeGerenciarCanticos && (
          <Link href="/canticos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <Music className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{tr('Músicas', 'Música', 'Music')}</h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Gerencie letras e cifras', 'Gestiona letras y cifras', 'Manage lyrics and chords')}
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                {tr('Acessar', 'Acceder', 'Access')}
              </span>
            </div>
          </Link>
          )}

          {permissoes.podeGerenciarCultos && (
          <Link href="/cultos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <CalendarDays className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{tr('Boletins', 'Boletines', 'Bulletins')}</h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Organize liturgias e o boletim do dia', 'Organiza liturgias y el boletín del día', 'Organize liturgies and the daily bulletin')}
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                {tr('Acessar', 'Acceder', 'Access')}
              </span>
            </div>
          </Link>
          )}

          <Link href="/dashboard" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Estatísticas', 'Estadísticas', 'Statistics')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Músicas mais cantadas, por mês, por posição', 'Música más cantada, por mes, por posición', 'Most-played songs by month and position')}
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                {tr('Acessar', 'Acceder', 'Access')}
              </span>
            </div>
          </Link>

          <Link href="/recursos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <Library className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Recursos', 'Recursos', 'Resources')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr('Cultos, EBD e estudos em video', 'Cultos, EBD y estudios en video', 'Services, Sunday school, and studies on video')}
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                {tr('Acessar', 'Acceder', 'Access')}
              </span>
            </div>
          </Link>

          {permissoes.isSuperAdmin && (
            <button
              onClick={() => router.push('/admin/igrejas')}
              className="bg-white rounded-xl p-6 shadow-sm border-2 border-amber-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {tr('Igrejas', 'Iglesias', 'Churches')}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {tr(
                  'Base inicial para gestão multi-igreja e expansão geográfica',
                  'Base inicial para gestión multiiglesia y expansión geográfica',
                  'Initial foundation for multi-church management and geographic expansion'
                )}
              </p>
              <span className="text-xs text-amber-800 font-semibold bg-amber-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <Star className="w-3 h-3" />
                Super Admin
              </span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
