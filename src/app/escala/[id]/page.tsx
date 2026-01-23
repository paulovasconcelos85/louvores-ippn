'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Escala {
  id: string;
  titulo: string;
  data: string;
  hora_inicio: string;
  hora_fim: string | null;
  tipo_culto: string;
  status: string;
}

interface Funcao {
  id: string;
  confirmado: boolean;
  tag: {
    nome: string;
    categoria: string;
  };
  usuario: {
    id: string;
    nome: string;
  };
}

export default function EscalaPublicaPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [escala, setEscala] = useState<Escala | null>(null);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);

    const { data: escalaData } = await supabase
      .from('escalas')
      .select('*')
      .eq('id', id)
      .single();

    const { data: funcoesData } = await supabase
      .from('escalas_funcoes')
      .select(`
        id,
        confirmado,
        tag:tags_funcoes (nome, categoria),
        usuario:usuarios_permitidos (id, nome)
      `)
      .eq('escala_id', id)
      .order('ordem');

    setEscala(escalaData);
    setFuncoes(funcoesData as any || []);
    setLoading(false);
  };

  const confirmar = async (funcaoId: string, atual: boolean) => {
    await supabase
      .from('escalas_funcoes')
      .update({ confirmado: !atual })
      .eq('id', funcaoId);

    carregar();
  };

  const categorias = Array.from(new Set(funcoes.map(f => f.tag.categoria)));

if (loading || !escala) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700 mx-auto"></div>
        <p className="mt-4 text-slate-600">Carregando escala...</p>
      </div>
    </div>
  );
}


  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow border overflow-hidden">

        <div className="bg-emerald-700 text-white p-4">
          <h1 className="text-xl font-bold">{escala.titulo}</h1>
          <p className="text-sm opacity-90">
            {new Date(escala.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {' · '}
            {escala.hora_inicio}{escala.hora_fim && ` - ${escala.hora_fim}`}
          </p>
          <span className="text-xs bg-white/20 px-2 py-1 rounded mt-2 inline-block">
            {escala.tipo_culto.replace('_', ' ')}
          </span>
        </div>

        <div className="p-4 space-y-6">
          {categorias.map(cat => (
            <div key={cat}>
              <h3 className="font-semibold text-slate-700 mb-2">{cat.toUpperCase()}</h3>

              <div className="space-y-2">
                {funcoes.filter(f => f.tag.categoria === cat).map(funcao => {
                  const souEu = user?.id === funcao.usuario.id;

                  return (
                    <div key={funcao.id} className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{funcao.usuario.nome}</p>
                        <p className="text-xs text-slate-500">{funcao.tag.nome}</p>
                      </div>

                      <button
                        disabled={!souEu}
                        onClick={() => confirmar(funcao.id, funcao.confirmado)}
                        className={`text-xs px-3 py-1 rounded-full font-semibold transition
                          ${funcao.confirmado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          ${souEu ? 'hover:opacity-80' : 'opacity-60 cursor-default'}
                        `}
                      >
                        {funcao.confirmado ? '✓ Confirmado' : 'Pendente'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4 text-center">
          <a
            target="_blank"
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `ESCALA – ${escala.titulo}\n${new Date(escala.data).toLocaleDateString('pt-BR')}\n\n` +
              funcoes.map(f => `• ${f.tag.nome}: ${f.usuario.nome}`).join('\n')
            )}`}
            className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            📲 Enviar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
