'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Church, Globe, MapPinned, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

export default function AdminIgrejasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, isSuperAdmin } = usePermissions();

  const loading = authLoading || permLoading;

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      router.push('/admin');
    }
  }, [loading, user, isSuperAdmin, router]);

  if (loading || !user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Church className="w-8 h-8 text-emerald-700" />
              Igrejas no OIKOS Hub
            </h1>
            <p className="text-slate-600 mt-1">
              Base inicial para a gestão multi-igreja do sistema.
            </p>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">O que esta tela vai centralizar</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <Globe className="w-5 h-5 text-emerald-700 mb-2" />
              <p className="font-semibold text-emerald-900 mb-1">Cadastro global de igrejas</p>
              <p className="text-emerald-800">
                Nome, sigla, país, estado ou província, cidade, identidade visual e status operacional.
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <MapPinned className="w-5 h-5 text-blue-700 mb-2" />
              <p className="font-semibold text-blue-900 mb-1">Contexto geográfico flexível</p>
              <p className="text-blue-800">
                Preparado para Brasil e outros países, sem depender de campos fixos apenas para UF brasileira.
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <Shield className="w-5 h-5 text-amber-700 mb-2" />
              <p className="font-semibold text-amber-900 mb-1">Governança de acesso</p>
              <p className="text-amber-800">
                Superadmin gerenciando vínculos, cargos e visibilidade por igreja.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 text-slate-300 rounded-2xl p-6">
          <h2 className="text-white text-lg font-semibold mb-3">Próximos passos recomendados</h2>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Criar a listagem real de igrejas conectada à tabela `igrejas`.</li>
            <li>Adicionar formulário compatível com país, estado/província e cidade.</li>
            <li>Permitir que o superadmin selecione a igreja ativa no contexto do painel.</li>
            <li>Separar permissões globais de permissões por igreja.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
