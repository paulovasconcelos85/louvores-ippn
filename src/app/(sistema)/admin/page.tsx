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
  Clock,
  AlertCircle,
  MapPin,
  Star,
  Church,
  UserCheck
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getCargoLabel, getCargoCor } from '@/lib/permissions';
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
  const { user, loading: authLoading, signOut } = useAuth();
  const { usuarioPermitido, loading: permLoading, permissoes } = usePermissions();
  
  const [proximaEscala, setProximaEscala] = useState<MinhaProximaEscala | null>(null);

  const loading = authLoading || permLoading;

  const buscarProximaEscala = useCallback(async () => {
    if (!user) return;
    
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataHoje = hoje.toISOString().split('T')[0];
      
      const { data, error } = await supabase
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
        .eq('escalas_funcoes.pessoas.id', user.id)
        .gte('data', dataHoje)
        .in('status', ['publicada', 'rascunho'])
        .order('data', { ascending: true })
        .limit(1);

      if (!error && data && data.length > 0) {
        const escala = data[0];
        const funcoes = escala.escalas_funcoes as unknown as any[];
        setProximaEscala({
          escala_id: escala.id,
          data: escala.data,
          hora_inicio: escala.hora_inicio,
          tipo_culto: escala.tipo_culto,
          funcao: funcoes[0]?.tags_funcoes?.nome || 'Função',
          confirmado: funcoes[0]?.confirmado || false
        });
      }
    } catch (error) {
      console.error('Erro ao buscar próxima escala:', error);
    }
  }, [user]);

  const getTipoCultoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      dominical_manha: 'Dominical - Manhã',
      dominical_noite: 'Dominical - Noite',
      quarta: 'Quarta-feira',
      especial: 'Culto Especial'
    };
    return labels[tipo] || tipo;
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      buscarProximaEscala();
    }
  }, [user, buscarProximaEscala]);

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

  if (!user || !usuarioPermitido) {
    return null;
  }

  const podeAcessarMembros = permissoes.isSuperAdmin || 
    ['admin', 'pastor', 'presbitero', 'seminarista'].includes(usuarioPermitido?.cargo || '');

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-2xl p-8 text-white mb-8">
          <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Church className="w-8 h-8" />
            Bem-vindo ao OIKOS Hub - IPPN!
          </h2>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 text-emerald-100">
              <UserCheck className="w-4 h-4" />
              <span>Usuário: <span className="font-semibold text-white">{usuarioPermitido?.nome || user.email}</span></span>
            </div>
            {usuarioPermitido?.cargo && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCargoCor(usuarioPermitido.cargo)}`}>
                {getCargoLabel(usuarioPermitido.cargo)}
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
              Gerencie cultos, músicas, escalas e membros
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
                      ? 'Você está escalado e confirmado!' 
                      : 'Você está escalado - Confirme sua presença!'}
                  </p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    proximaEscala.confirmado 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-amber-200 text-amber-900'
                  }`}>
                    {proximaEscala.confirmado ? 'CONFIRMADO' : 'PENDENTE'}
                  </span>
                </div>
                
                <div className={`${
                  proximaEscala.confirmado ? 'text-green-700' : 'text-amber-700'
                } mb-3`}>
                  <p className="font-semibold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" />
                    {new Date(proximaEscala.data + 'T00:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: '2-digit',
                      month: 'long'
                    })} às {proximaEscala.hora_inicio}
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
                      Por favor, confirme sua presença:
                    </p>
                    <p>Entre em contato com o responsável pelas escalas ou acesse a página de escalas para confirmar.</p>
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
                      Ver Detalhes da Escala
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Presença
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
                Gerenciar Usuários
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Controle quem pode acessar o sistema
              </p>
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Disponível
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
                Pastorear Membros
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Acompanhamento e cuidado pastoral
              </p>
              <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Disponível
              </span>
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
                Gerenciar Escalas
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                Crie e organize as escalas de músicos
              </p>
              <span className="text-xs text-purple-700 font-semibold bg-purple-100 px-3 py-1 rounded-full inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Disponível
              </span>
            </button>
          )}

          <Link href="/canticos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <Music className="w-6 h-6 text-slate-600" />
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

          <Link href="/cultos" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <CalendarDays className="w-6 h-6 text-slate-600" />
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

          <Link href="/dashboard" className="block">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer h-full">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-slate-600" />
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