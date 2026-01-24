'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Cantico {
  id: string;
  nome: string;
  letra: string | null;
  cifra: string | null;
}

export default function CanticosPage() {
  const router = useRouter();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [form, setForm] = useState<{ nome: string; letra: string; cifra: string }>({
    nome: '',
    letra: '',
    cifra: '',
  });
  const [avisoSimilaridade, setAvisoSimilaridade] = useState<string[]>([]);

  useEffect(() => {
    fetchCanticos();
  }, []);

  const fetchCanticos = async () => {
    const { data } = await supabase
      .from('canticos')
      .select('id, nome, letra, cifra')
      .order('nome');

    if (data) setCanticos(data);
  };

  // Função para calcular similaridade entre strings (Levenshtein distance simplificado)
  const calcularSimilaridade = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    // Verifica se uma string contém a outra
    if (s1.includes(s2) || s2.includes(s1)) return 0.7;
    
    // Verifica palavras em comum
    const palavras1 = s1.split(/\s+/);
    const palavras2 = s2.split(/\s+/);
    const palavrasComuns = palavras1.filter(p => palavras2.includes(p)).length;
    const totalPalavras = Math.max(palavras1.length, palavras2.length);
    
    return palavrasComuns / totalPalavras;
  };

  // Verificar nomes similares ao digitar
  useEffect(() => {
    if (criandoNovo && form.nome.length > 2) {
      const similares = canticos
        .filter(c => {
          const similaridade = calcularSimilaridade(c.nome, form.nome);
          return similaridade > 0.6; // 60% de similaridade
        })
        .map(c => c.nome);

      setAvisoSimilaridade(similares);
    } else {
      setAvisoSimilaridade([]);
    }
  }, [form.nome, criandoNovo, canticos]);

  const iniciarEdicao = (c: Cantico) => {
    setCriandoNovo(false);
    setEditando(c.id);
    setForm({
      nome: c.nome,
      letra: c.letra || '',
      cifra: c.cifra || '',
    });
    setAvisoSimilaridade([]);
  };

  const iniciarNovo = () => {
    setCriandoNovo(true);
    setEditando(null);
    setForm({
      nome: '',
      letra: '',
      cifra: '',
    });
    setAvisoSimilaridade([]);
  };

  const cancelar = () => {
    setCriandoNovo(false);
    setEditando(null);
    setForm({ nome: '', letra: '', cifra: '' });
    setAvisoSimilaridade([]);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      alert('O nome do cântico é obrigatório!');
      return;
    }

    // Se estiver editando, apenas atualiza
    if (editando) {
      const { error } = await supabase
        .from('canticos')
        .update({
          nome: form.nome.trim(),
          letra: form.letra.trim(),
          cifra: form.cifra.trim(),
        })
        .eq('id', editando);

      if (!error) {
        await fetchCanticos();
        setEditando(null);
        setForm({ nome: '', letra: '', cifra: '' });
        alert('✅ Cântico atualizado com sucesso!');
      } else {
        console.error(error);
        alert('❌ Erro ao salvar.');
      }
      return;
    }

    // Se estiver criando novo, verifica duplicatas
    const nomeExato = canticos.find(
      c => c.nome.toLowerCase().trim() === form.nome.toLowerCase().trim()
    );

    if (nomeExato) {
      alert('❌ Já existe um cântico com este nome exato! Por favor, escolha outro nome.');
      return;
    }

    // Inserir novo cântico
    const { error } = await supabase
      .from('canticos')
      .insert({
        nome: form.nome.trim(),
        letra: form.letra.trim(),
        cifra: form.cifra.trim(),
      });

    if (!error) {
      await fetchCanticos();
      setCriandoNovo(false);
      setForm({ nome: '', letra: '', cifra: '' });
      setAvisoSimilaridade([]);
      alert('✅ Cântico criado com sucesso!');
    } else {
      console.error(error);
      alert('❌ Erro ao criar cântico.');
    }
  };

  // Busca melhorada: busca no nome E nas primeiras letras da letra
  const filtrados = canticos.filter(c => {
    const termoBusca = busca.toLowerCase().trim();
    if (!termoBusca) return true;

    // Busca no nome
    if (c.nome.toLowerCase().includes(termoBusca)) return true;

    // Busca nas primeiras linhas da letra (primeiras 200 caracteres)
    if (c.letra) {
      const primeirasLinhas = c.letra.substring(0, 200).toLowerCase();
      if (primeirasLinhas.includes(termoBusca)) return true;
    }

    return false;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b-2 border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation"
          >
            ← Voltar
          </button>

          <h1 className="text-xl font-bold text-slate-900">🎵 Cânticos</h1>

          <Link href="/" className="text-emerald-700 font-bold text-lg active:text-emerald-900 touch-manipulation">
            🏠
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="p-4 pb-24">
        {/* Botão Novo Cântico */}
        <button
          onClick={iniciarNovo}
          className="w-full bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white py-5 rounded-2xl font-bold text-xl shadow-lg mb-4 touch-manipulation"
        >
          ➕ Novo Cântico
        </button>

        {/* Formulário de Novo Cântico */}
        {criandoNovo && (
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-300 rounded-2xl p-5 shadow-lg mb-6">
            <h2 className="text-xl font-bold text-emerald-900 mb-4">
              ✨ Criar Novo Cântico
            </h2>

            <div className="space-y-4">
              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">
                  Nome do Cântico *
                </label>
                <input
                  className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-emerald-600 focus:outline-none"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Castelo Forte"
                  autoFocus
                />
                
                {/* Aviso de nomes similares */}
                {avisoSimilaridade.length > 0 && (
                  <div className="mt-2 bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                    <p className="text-sm font-bold text-amber-800 mb-2">
                      ⚠️ Encontramos cânticos com nomes parecidos:
                    </p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {avisoSimilaridade.map((nome, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="text-amber-600">•</span>
                          {nome}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-600 mt-2">
                      Verifique se não é um destes antes de continuar.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">
                  Letra
                </label>
                <textarea
                  className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[150px] focus:border-emerald-600 focus:outline-none"
                  value={form.letra}
                  onChange={e => setForm({ ...form, letra: e.target.value })}
                  placeholder="Cole ou digite a letra completa aqui"
                />
              </div>

              <div>
                <label className="font-bold text-sm text-slate-700 mb-2 block">
                  Cifra
                </label>
                <textarea
                  className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[150px] focus:border-emerald-600 focus:outline-none"
                  value={form.cifra}
                  onChange={e => setForm({ ...form, cifra: e.target.value })}
                  placeholder="Cole ou digite a cifra aqui"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={salvar}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg touch-manipulation"
                >
                  💾 Criar Cântico
                </button>
                <button
                  onClick={cancelar}
                  className="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 px-6 py-4 rounded-xl font-bold text-lg touch-manipulation"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Campo de Busca */}
        <input
          type="text"
          placeholder="🔍 Buscar por nome ou letra..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full border-2 border-slate-300 p-4 rounded-xl mb-4 text-base focus:border-emerald-600 focus:outline-none shadow-sm"
        />

        {/* Contador de resultados */}
        {busca && (
          <p className="text-sm text-slate-600 mb-3">
            📋 {filtrados.length} cântico{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Lista de Cânticos */}
        <div className="space-y-3">
          {filtrados.map(c => (
            <div key={c.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div
                className="font-semibold text-lg cursor-pointer text-emerald-800 active:text-emerald-900 flex items-center justify-between"
                onClick={() => iniciarEdicao(c)}
              >
                <span>{c.nome}</span>
                <span className="text-2xl">✏️</span>
              </div>

              {editando === c.id && (
                <div className="mt-4 space-y-4 pt-4 border-t-2 border-slate-200">
                  <div>
                    <label className="font-bold text-sm text-slate-700 mb-2 block">
                      Nome do Cântico
                    </label>
                    <input
                      className="w-full border-2 border-slate-300 p-3 rounded-xl focus:border-emerald-600 focus:outline-none"
                      value={form.nome}
                      onChange={e => setForm({ ...form, nome: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm text-slate-700 mb-2 block">
                      Letra
                    </label>
                    <textarea
                      className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[200px] focus:border-emerald-600 focus:outline-none font-mono text-sm"
                      value={form.letra}
                      onChange={e => setForm({ ...form, letra: e.target.value })}
                      placeholder="Cole ou digite a letra completa aqui"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-sm text-slate-700 mb-2 block">
                      Cifra
                    </label>
                    <textarea
                      className="w-full border-2 border-slate-300 p-3 rounded-xl min-h-[200px] focus:border-emerald-600 focus:outline-none font-mono text-sm"
                      value={form.cifra}
                      onChange={e => setForm({ ...form, cifra: e.target.value })}
                      placeholder="Cole ou digite a cifra aqui"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={salvar}
                      className="flex-1 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg touch-manipulation"
                    >
                      💾 Salvar
                    </button>
                    <button
                      onClick={cancelar}
                      className="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 px-6 py-4 rounded-xl font-bold text-lg touch-manipulation"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtrados.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border-2 border-slate-200">
              <span className="text-6xl mb-4 block">🎵</span>
              <p className="text-slate-600">
                {busca ? 'Nenhum cântico encontrado com este termo' : 'Nenhum cântico cadastrado'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}