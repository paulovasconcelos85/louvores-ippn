'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

interface RankingItem {
  cantico: string;
  total: number;
}

interface EvolucaoMensal {
  mes: string;
  total: number;
}

interface CanticoRecente {
  cantico: string;
  ultimaData: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardPage() {
  const router = useRouter();
  const [anos, setAnos] = useState<number[]>([]);
  const [ano, setAno] = useState<number | null>(null);
  const [mes, setMes] = useState<number | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [evolucaoMensal, setEvolucaoMensal] = useState<EvolucaoMensal[]>([]);
  const [canticosRecentes, setCanticosRecentes] = useState<CanticoRecente[]>([]);
  const [totalExecucoes, setTotalExecucoes] = useState<number>(0);
  const [totalCanticos, setTotalCanticos] = useState<number>(0);
  const [mediaPorMes, setMediaPorMes] = useState<number>(0);
  const [maisCantado, setMaisCantado] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    async function fetchAnos() {
      const { data } = await supabase
        .from('vw_execucoes')
        .select('ano')
        .order('ano', { ascending: false });

      const unicos = Array.from(new Set((data || []).map((d: { ano: number }) => d.ano)));
      setAnos(unicos);
      // Não define ano inicial - deixa como "Todos os anos"
    }
    fetchAnos();
  }, []);

  useEffect(() => {
    async function fetchDados() {
      setLoading(true);

      // Construir query base
      let query = supabase
        .from('vw_execucoes')
        .select('cantico, ano, mes, data');

      // Aplicar filtros
      if (ano) {
        query = query.eq('ano', ano);
      }
      if (mes) {
        query = query.eq('mes', mes);
      }

      const { data: execucoes, error } = await query;

      if (error) {
        console.error('Erro ao buscar execuções:', error);
        setLoading(false);
        return;
      }

      if (!execucoes || execucoes.length === 0) {
        setRanking([]);
        setEvolucaoMensal([]);
        setTotalExecucoes(0);
        setTotalCanticos(0);
        setMaisCantado(null);
        setMediaPorMes(0);
        setLoading(false);
        return;
      }

      // Processar ranking - agrupar por cântico
      const contagemCanticos = execucoes.reduce((acc: any, curr: any) => {
        const cantico = curr.cantico;
        acc[cantico] = (acc[cantico] || 0) + 1;
        return acc;
      }, {});

      const rankingArray = Object.entries(contagemCanticos)
        .map(([cantico, total]) => ({
          cantico,
          total: total as number
        }))
        .sort((a, b) => b.total - a.total);

      setRanking(rankingArray);
      setTotalExecucoes(execucoes.length);
      setTotalCanticos(rankingArray.length);
      setMaisCantado(rankingArray[0]?.cantico || null);

      // Processar evolução mensal - agrupar por mês/ano
      const porMes = execucoes.reduce((acc: any, curr: any) => {
        const mesNome = new Date(curr.ano, curr.mes - 1).toLocaleDateString('pt-BR', { month: 'short' });
        const anoStr = curr.ano.toString().slice(-2); // Últimos 2 dígitos do ano
        const key = ano ? mesNome : `${mesNome}/${anoStr}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      // Ordenar por data
      const evolucaoArray = Object.entries(porMes)
        .map(([mes, total]) => ({
          mes,
          total: total as number
        }))
        .sort((a, b) => {
          // Se tiver ano no filtro, ordenar por mês
          if (ano) {
            const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            return meses.indexOf(a.mes.toLowerCase()) - meses.indexOf(b.mes.toLowerCase());
          }
          // Senão, ordenar por mês/ano
          return a.mes.localeCompare(b.mes);
        });

      setEvolucaoMensal(evolucaoArray);
      setMediaPorMes(evolucaoArray.length > 0 ? execucoes.length / evolucaoArray.length : 0);

      setLoading(false);
    }

    fetchDados();
  }, [ano, mes]);

  // Buscar cânticos das últimas 4 semanas (independente dos filtros)
  useEffect(() => {
    async function fetchCanticosRecentes() {
      const quatroSemanasAtras = new Date();
      quatroSemanasAtras.setDate(quatroSemanasAtras.getDate() - 28);
      
      const { data: execucoes, error } = await supabase
        .from('vw_execucoes')
        .select('cantico, data')
        .gte('data', quatroSemanasAtras.toISOString().split('T')[0])
        .order('data', { ascending: false });

      if (error) {
        console.error('Erro ao buscar cânticos recentes:', error);
        return;
      }

      if (!execucoes || execucoes.length === 0) {
        setCanticosRecentes([]);
        return;
      }

      // Agrupar por cântico único e pegar a última data
      const canticosUnicos = execucoes.reduce((acc: any, curr: any) => {
        if (!acc[curr.cantico]) {
          acc[curr.cantico] = {
            cantico: curr.cantico,
            ultimaData: curr.data
          };
        }
        return acc;
      }, {});

      const canticosArray = Object.values(canticosUnicos) as CanticoRecente[];
      
      // Ordenar alfabeticamente
      canticosArray.sort((a, b) => a.cantico.localeCompare(b.cantico));

      setCanticosRecentes(canticosArray);
    }

    fetchCanticosRecentes();
  }, []); // Executa apenas uma vez ao carregar

  if (authLoading) return null;
  if (!user) return null;

  const top5 = ranking.slice(0, 5);
  const percentualTop5 = top5.map(item => ({
    name: item.cantico,
    value: item.total,
    percent: totalExecucoes > 0 ? ((item.total / totalExecucoes) * 100).toFixed(1) : 0
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <header className="flex justify-between items-center mb-6">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-emerald-700 font-semibold hover:text-emerald-800 transition"
        >
          <span className="text-xl">←</span> Voltar
        </button>
        <button 
          onClick={() => router.push('/')} 
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          Home
        </button>
      </header>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">📊 Dashboard de Louvores</h1>
        <p className="text-slate-600">Análise completa de execuções e tendências</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <h3 className="font-semibold text-slate-700 mb-3">Filtros</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1">Ano</label>
            <select
              value={ano || ''}
              onChange={e => setAno(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">🌍 Todos os anos</option>
              {anos.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1">Mês</label>
            <select
              value={mes || ''}
              onChange={e => setMes(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">📅 Todos os meses</option>
              {[
                { v: 1, n: 'Janeiro' }, { v: 2, n: 'Fevereiro' }, { v: 3, n: 'Março' },
                { v: 4, n: 'Abril' }, { v: 5, n: 'Maio' }, { v: 6, n: 'Junho' },
                { v: 7, n: 'Julho' }, { v: 8, n: 'Agosto' }, { v: 9, n: 'Setembro' },
                { v: 10, n: 'Outubro' }, { v: 11, n: 'Novembro' }, { v: 12, n: 'Dezembro' }
              ].map(m => (
                <option key={m.v} value={m.v}>{m.n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-emerald-100 text-sm mb-1">Total de Execuções</p>
          <p className="text-3xl font-bold">{totalExecucoes}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-blue-100 text-sm mb-1">Cânticos Únicos</p>
          <p className="text-3xl font-bold">{totalCanticos}</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-purple-100 text-sm mb-1">Média/Mês</p>
          <p className="text-3xl font-bold">{mediaPorMes.toFixed(0)}</p>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-orange-100 text-sm mb-1">Mais Cantado</p>
          <p className="text-sm font-semibold truncate">{maisCantado || '-'}</p>
        </div>
      </div>

      {/* Cânticos do Último Mês */}
      <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span className="text-2xl">🎵</span>
            Cânticos do Último Mês
          </h2>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
            {canticosRecentes.length} cânticos
          </span>
        </div>
        
        {canticosRecentes.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Nenhum cântico encontrado no último mês</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {canticosRecentes.map((item, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-emerald-300 transition"
              >
                <span className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-semibold text-sm">
                  {idx + 1}
                </span>
                <span className="text-slate-700 font-medium">{item.cantico}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico de Barras - Top 10 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-slate-800">🏆 Top 10 Cânticos Mais Cantados</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ranking.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="cantico" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100} 
                  tick={{ fontSize: 11 }}
                />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Pizza - Top 5 */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-slate-800">🎯 Distribuição Top 5</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={percentualTop5}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.percent}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {percentualTop5.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  formatter={(value, entry: any) => entry.payload.name}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Linha - Evolução Mensal */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-slate-800">📈 Evolução Mensal</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Área - Tendência */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-slate-800">📊 Tendência de Execuções</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#8b5cf6" 
                  fill="#8b5cf6" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de Ranking Completo */}
          <div className="bg-white rounded-xl p-6 shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg mb-4 text-slate-800">📋 Ranking Completo</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">#</th>
                    <th className="text-left py-3 px-4 text-slate-600 font-semibold">Cântico</th>
                    <th className="text-right py-3 px-4 text-slate-600 font-semibold">Execuções</th>
                    <th className="text-right py-3 px-4 text-slate-600 font-semibold">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item, idx) => (
                    <tr 
                      key={idx} 
                      className="border-b border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="py-3 px-4">
                        {idx < 3 ? (
                          <span className="text-xl">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span className="text-slate-500">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{item.cantico}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {item.total}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {((item.total / totalExecucoes) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}