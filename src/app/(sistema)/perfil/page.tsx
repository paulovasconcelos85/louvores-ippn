'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';

export default function PerfilPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tags, setTags] = useState<any[]>([]);
  const [minhasTags, setMinhasTags] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) carregar();
  }, [user]);

  const carregar = async () => {
    const { data: usuario } = await supabase
      .from('usuarios_permitidos')
      .select('nome, telefone')
      .eq('id', user!.id)
      .single();

    if (usuario) {
      setNome(usuario.nome || '');
      setTelefone(usuario.telefone ? formatPhoneNumber(usuario.telefone) : '');
    }

    const { data: tagsData } = await supabase
      .from('tags_funcoes')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    setTags(tagsData || []);

    const { data: minhasTagsData } = await supabase
      .from('usuarios_tags')
      .select('tag_id')
      .eq('usuario_id', user!.id);
    setMinhasTags((minhasTagsData || []).map(t => t.tag_id));
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');

    try {
      await supabase
        .from('usuarios_permitidos')
        .update({
          nome: nome.trim(),
          telefone: telefone ? unformatPhoneNumber(telefone) : null,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', user!.id);

      setMensagem('✅ Perfil atualizado!');
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const toggleTag = async (tagId: string) => {
    const tem = minhasTags.includes(tagId);

    try {
      if (tem) {
        await supabase
          .from('usuarios_tags')
          .delete()
          .eq('usuario_id', user!.id)
          .eq('tag_id', tagId);
        setMinhasTags(prev => prev.filter(t => t !== tagId));
      } else {
        await supabase
          .from('usuarios_tags')
          .insert({ usuario_id: user!.id, tag_id: tagId, nivel_habilidade: 1 });
        setMinhasTags(prev => [...prev, tagId]);
      }
    } catch (error: any) {
      setMensagem(`❌ Erro: ${error.message}`);
    }
  };

  const tagsPorCategoria = tags.reduce((acc, tag) => {
    if (!acc[tag.categoria]) acc[tag.categoria] = [];
    acc[tag.categoria].push(tag);
    return acc;
  }, {} as Record<string, any[]>);

  const categoriaLabels: Record<string, string> = {
    lideranca: '📖 Liderança',
    instrumento: '🎸 Instrumentos',
    vocal: '🎤 Vozes',
    tecnica: '🎛️ Técnica',
    apoio: '👥 Apoio'
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Meu Perfil</h1>
          <div className="flex gap-3">
            <button onClick={() => router.push('/admin')} className="px-4 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg">
              🏠 Admin
            </button>
            <button onClick={() => signOut()} className="px-4 py-2 bg-slate-100 rounded-lg">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {mensagem && (
          <div className={`mb-6 p-4 rounded-lg ${mensagem.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {mensagem}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email (não editável)</label>
              <input type="email" value={user.email} disabled className="w-full px-4 py-2 border rounded-lg bg-slate-50" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nome *</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                disabled={salvando}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Telefone</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatPhoneNumber(e.target.value))}
                disabled={salvando}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="(92) 98139-4605"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salvando}
                className="bg-emerald-700 text-white px-6 py-2 rounded-lg hover:bg-emerald-800 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar Perfil'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/admin')}
                disabled={salvando}
                className="bg-slate-200 text-slate-800 px-6 py-2 rounded-lg hover:bg-slate-300"
              >
                Cancelar
              </button>
            </div>
          </form>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Minhas Habilidades</h3>
            <div className="space-y-4">
              {(Object.entries(tagsPorCategoria) as [string, any[]][]).map(([categoria, tagsCategoria]) => (
                <div key={categoria}>
                  <p className="text-sm font-semibold text-slate-700 mb-2">{categoriaLabels[categoria]}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tagsCategoria.map((tag: any) => (
                      <label
                        key={tag.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border-2 ${
                          minhasTags.includes(tag.id)
                            ? 'bg-emerald-100 border-emerald-600'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={minhasTags.includes(tag.id)}
                          onChange={() => toggleTag(tag.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{tag.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
