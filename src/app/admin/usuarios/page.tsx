'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface UsuarioPermitido {
  id: string;
  email: string;
  nome: string;
  cargo: 'admin' | 'musico' | 'membro';
  ativo: boolean;
  criado_em: string;
}

export default function GerenciarUsuarios() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioPermitido[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState<'admin' | 'musico' | 'membro'>('membro');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      carregarUsuarios();
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    router.push('/');
  };

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios_permitidos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setUsuarios(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error);
      setMensagem('Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const adicionarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .insert({
          email: novoEmail.toLowerCase().trim(),
          nome: novoNome.trim(),
          cargo: novoCargo,
          ativo: true,
        });

      if (error) throw error;

      setMensagem(`✅ ${novoEmail} adicionado com sucesso!`);
      setNovoEmail('');
      setNovoNome('');
      setNovoCargo('membro');
      carregarUsuarios();
    } catch (error: any) {
      if (error.code === '23505') {
        setMensagem('❌ Este email já está cadastrado');
      } else {
        setMensagem(`❌ Erro: ${error.message}`);
      }
    } finally {
      setSalvando(false);
    }
  };

  const alterarStatus = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;

      setMensagem(ativo ? '✅ Usuário ativado' : '⚠️ Usuário desativado');
      carregarUsuarios();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const removerUsuario = async (id: string, email: string) => {
    if (!confirm(`Tem certeza que deseja REMOVER ${email}?\n\nEle não poderá mais fazer login.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('usuarios_permitidos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMensagem('🗑️ Usuário removido');
      carregarUsuarios();
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const getBadgeCargo = (cargo: string) => {
    const cores = {
      admin: 'bg-red-100 text-red-800',
      musico: 'bg-blue-100 text-blue-800',
      membro: 'bg-gray-100 text-gray-800',
    };
    return cores[cargo as keyof typeof cores] || cores.membro;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="w-10 h-10 bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <span className="text-white font-bold text-lg">🎵</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Gerenciar Usuários
                </h1>
                <p className="text-sm text-slate-600">Controle de acesso ao sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium"
              >
                🏠 Home
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                ← Voltar
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Info do usuário logado */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-800">
              👤 Logado como: <span className="font-semibold">{user.email}</span>
            </p>
          </div>

          {/* Mensagem */}
          {mensagem && (
            <div className={`p-4 rounded-lg ${
              mensagem.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
              mensagem.includes('⚠️') ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {mensagem}
            </div>
          )}

          {/* Formulário Adicionar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span>➕</span>
              Adicionar Novo Usuário
            </h3>
            <form onSubmit={adicionarUsuario} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="usuario@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                    placeholder="Nome completo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cargo / Função *
                </label>
                <select
                  value={novoCargo}
                  onChange={(e) => setNovoCargo(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent outline-none"
                >
                  <option value="membro">Membro (apenas visualização)</option>
                  <option value="musico">Músico/Cantor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="w-full sm:w-auto bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {salvando ? 'Adicionando...' : 'Adicionar Usuário'}
              </button>
            </form>
          </div>

          {/* Lista de Usuários */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Usuários Permitidos ({usuarios.length})
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {usuarios.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    Nenhum usuário cadastrado ainda
                  </div>
                ) : (
                  usuarios.map((usuario) => (
                    <div
                      key={usuario.id}
                      className="p-6 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h4 className="text-lg font-medium text-slate-900">
                              {usuario.nome}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getBadgeCargo(usuario.cargo)}`}>
                              {usuario.cargo}
                            </span>
                            {!usuario.ativo && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">
                                Desativado
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 text-sm">{usuario.email}</p>
                          <p className="text-slate-400 text-xs mt-1">
                            Adicionado em {new Date(usuario.criado_em).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => alterarStatus(usuario.id, !usuario.ativo)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                              usuario.ativo
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                          >
                            {usuario.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => removerUsuario(usuario.id, usuario.email)}
                            className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-all"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Informações */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <span>ℹ️</span>
              Como Funciona
            </h4>
            <ul className="text-sm text-blue-800 space-y-1.5">
              <li>• Somente emails cadastrados aqui podem criar conta no sistema</li>
              <li>• Usuários desativados não podem fazer login</li>
              <li>• Ao remover um usuário, ele perde acesso imediatamente</li>
              <li>• Você pode reativar usuários desativados a qualquer momento</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}