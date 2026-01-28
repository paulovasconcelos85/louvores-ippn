'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Cantico {
  id: string;
  nome: string;
  letra: string | null;
  referencia: string | null;
  tags: string[] | null;
}

// Movido para fora para não ser recriado em cada render
const TAGS = [
  'Prelúdio', 'Poslúdio', 'Oferta', 'Ceia', 'Comunhão', 'Hino', 'Salmo',
  'Adoração', 'Confissão', 'Arrependimento', 'Edificação', 'Instrução',
  'Consagração', 'Doxologia', 'Bençãos', 'Gratidão'
];

export default function CanticosPage() {
  const router = useRouter();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [form, setForm] = useState<{ nome: string; letra: string; referencia: string; tags: string[] }>({
    nome: '',
    letra: '',
    referencia: '',
    tags: [],
  });
  
  const [avisoSimilaridade, setAvisoSimilaridade] = useState<string[]>([]);

  // --- FUNÇÕES MOVIDAS PARA CIMA (RESOLVE O ERRO DE HOISTING) ---

  const fetchCanticos = useCallback(async () => {
    const { data } = await supabase
      .from('canticos')
      .select('id, nome, letra, referencia, tags')
      .order('nome');

    if (data) setCanticos(data);
  }, []);

  const calcularSimilaridade = useCallback((str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.7;
    const palavras1 = s1.split(/\s+/);
    const palavras2 = s2.split(/\s+/);
    const palavrasComuns = palavras1.filter(p => palavras2.includes(p)).length;
    const totalPalavras = Math.max(palavras1.length, palavras2.length);
    return palavrasComuns / totalPalavras;
  }, []);

  // --- EFEITOS ---

  useEffect(() => {
    fetchCanticos();
  }, [fetchCanticos]);

  useEffect(() => {
    if (criandoNovo && form.nome.length > 2) {
      const similares = canticos
        .filter(c => calcularSimilaridade(c.nome, form.nome) > 0.6)
        .map(c => c.nome);
      setAvisoSimilaridade(similares);
    } else {
      setAvisoSimilaridade([]);
    }
  }, [form.nome, criandoNovo, canticos, calcularSimilaridade]);

  // --- HANDLERS ---

  const iniciarEdicao = (c: Cantico) => {
    setCriandoNovo(false);
    setEditando(c.id);
    setForm({
      nome: c.nome,
      letra: c.letra || '',
      referencia: c.referencia || '',
      tags: c.tags || [],
    });
    setAvisoSimilaridade([]);
  };

  const iniciarNovo = () => {
    setCriandoNovo(true);
    setEditando(null);
    setForm({ nome: '', letra: '', referencia: '', tags: [] });
    setAvisoSimilaridade([]);
  };

  const cancelar = () => {
    setCriandoNovo(false);
    setEditando(null);
    setForm({ nome: '', letra: '', referencia: '', tags: [] });
    setAvisoSimilaridade([]);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      alert('O nome do cântico é obrigatório!');
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      letra: form.letra.trim(),
      referencia: form.referencia.trim(),
      tags: form.tags,
    };

    if (editando) {
      const { error } = await supabase.from('canticos').update(payload).eq('id', editando);
      if (!error) {
        await fetchCanticos();
        setEditando(null);
        alert('✅ Cântico atualizado!');
      } else alert('❌ Erro ao salvar.');
      return;
    }

    const { error } = await supabase.from('canticos').insert(payload);
    if (!error) {
      await fetchCanticos();
      setCriandoNovo(false);
      alert('✅ Cântico criado!');
    } else alert('❌ Erro ao criar.');
  };

  const filtrados = canticos.filter(c => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return true;

    const noNome = c.nome.toLowerCase().includes(termo);
    const naReferencia = c.referencia?.toLowerCase().includes(termo);
    const naLetra = c.letra?.toLowerCase().substring(0, 300).includes(termo);

    return noNome || naReferencia || naLetra;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b-2 border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation">
            ← Voltar
          </button>
          <h1 className="text-xl font-bold text-slate-900">🎵 Cânticos</h1>
          <Link href="/" className="text-emerald-700 font-bold text-lg">🏠</Link>
        </div>
      </header>

      <main className="p-4 pb-24">
        <button onClick={iniciarNovo} className="w-full bg-emerald-800 text-white py-5 rounded-2xl font-bold text-xl shadow-lg mb-4">
          ➕ Novo Cântico
        </button>

        {criandoNovo && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-2xl p-5 shadow-lg mb-6">
            <h2 className="text-xl font-bold text-emerald-900 mb-4">✨ Criar Novo Cântico</h2>
            <div className="space-y-4">
              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">Nome do Cântico *</label>
                <input
                  className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-emerald-600 outline-none"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Castelo Forte"
                  autoFocus
                />
                {avisoSimilaridade.length > 0 && (
                  <div className="mt-2 bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-sm">
                    <p className="font-bold text-amber-800">⚠️ Já existem cânticos similares:</p>
                    <ul className="text-amber-700">{avisoSimilaridade.map((n, i) => <li key={i}>• {n}</li>)}</ul>
                  </div>
                )}
              </div>
              
              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">Tags Litúrgicas</label>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setForm(prev => ({
                        ...prev,
                        tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                      }))}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-semibold transition ${
                        form.tags.includes(tag) ? 'bg-emerald-100 border-emerald-500 text-emerald-800' : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">Letra</label>
                <textarea
                  className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[150px] focus:border-emerald-600 outline-none"
                  value={form.letra}
                  onChange={e => setForm({ ...form, letra: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">Referência Bíblica</label>
                <textarea
                  className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[100px] focus:border-emerald-600 outline-none"
                  value={form.referencia}
                  onChange={e => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Ex: Salmo 23, João 3:16..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={salvar} className="flex-1 bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold shadow-lg">💾 Criar Cântico</button>
                <button onClick={cancelar} className="bg-slate-200 text-slate-700 px-6 py-4 rounded-xl font-bold">❌ Cancelar</button>
              </div>
            </div>
          </div>
        )}

        <input
          type="text"
          placeholder="🔍 Buscar por nome, referência ou letra..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full border-2 border-slate-300 p-4 rounded-xl mb-4 text-base focus:border-emerald-600 outline-none shadow-sm"
        />

        <div className="space-y-3">
          {filtrados.map(c => (
            <div key={c.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="font-semibold text-lg cursor-pointer text-emerald-800 flex items-center justify-between" onClick={() => iniciarEdicao(c)}>
                <span>{c.nome}</span>
                <span className="text-2xl">✏️</span>
              </div>

              {editando === c.id && (
                <div className="mt-4 space-y-4 pt-4 border-t-2 border-slate-200">
                  <input className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-emerald-600 outline-none" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
                  
                  <div>
                    <label className="font-bold text-sm text-slate-700 mb-2 block text-xs uppercase">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setForm(prev => ({
                            ...prev,
                            tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                          }))}
                          className={`px-3 py-1 rounded-lg border text-xs font-semibold ${form.tags.includes(tag) ? 'bg-emerald-100 border-emerald-500' : 'bg-white border-slate-200'}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[150px] focus:border-emerald-600 outline-none font-mono text-sm" value={form.letra} onChange={e => setForm({ ...form, letra: e.target.value })} />
                  
                  <div>
                    <label className="font-bold text-sm text-slate-700 mb-2 block">Referência Bíblica</label>
                    <textarea className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[100px] focus:border-emerald-600 outline-none font-mono text-sm" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={salvar} className="flex-1 bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold">💾 Salvar</button>
                    <button onClick={cancelar} className="bg-slate-200 text-slate-700 px-6 py-4 rounded-xl font-bold">❌ Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}