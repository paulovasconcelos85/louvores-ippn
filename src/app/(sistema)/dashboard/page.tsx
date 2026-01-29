'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3,
  Music,
  TrendingUp,
  Award,
  Calendar,
  Globe,
  Trophy,
  Target,
  Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend
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
  diasAtras: number;
}

interface TomItem {
  tom: string;
  total: number;
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
  const [rankingTons, setRankingTons] = useState<TomItem[]>([]);
  const [totalExecucoes, setTotalExecucoes] = useState<number>(0);
  const [totalCanticos, setTotalCanticos] = useState<number>(0);
  const [totalCultos, setTotalCultos] = useState<number>(0);
  const [mediaPorMes, setMediaPorMes] = useState<number>(0);
  const [mediaPorCulto, setMediaPorCulto] = useState<number>(0);
  const [maisCantado, setMaisCantado] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Buscar anos disponíveis
  useEffect(() => {
    async function fetchAnos() {
      const { data } = await supabase
        .from('vw_execucoes_louvores')
        .select('ano')
        .order('ano', { ascending: false });

      const unicos = Array.from(new Set((data || []).map((d: { ano: number }) => d.ano)));
      setAnos(unicos);
    }
    fetchAnos();
  }, []);

  // Buscar dados principais
  useEffect(() => {
    async function fetchDados() {
      setLoading(true);

      // Construir query base
      let query = supabase
        .from('vw_execucoes_louvores')
        .select('cantico, ano, mes, data, culto_nr');

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
        setTotalCultos(0);
        setMaisCantado(null);
        setMediaPorMes(0);
        setMediaPorCulto(0);
        setLoading(false);
        return;
      }

      // Processar ranking - contar execuções por cântico
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

      // Contar cultos únicos
      const cultosUnicos = new Set(execucoes.map((e: any) => e.culto_nr));
      setTotalCultos(cultosUnicos.size);

      // Processar evolução mensal com ordenação cronológica
      const evolucaoComData = execucoes.reduce((acc: any, curr: any) => {
        const mesNome = new Date(curr.ano, curr.mes - 1).toLocaleDateString('pt-BR', { month: 'short' });
        const anoStr = curr.ano.toString().slice(-2);
        const key = ano ? mesNome : `${mesNome}/${anoStr}`;
        
        if (!acc[key]) {
          acc[key] = {
            mes: key,
            total: 0,
            anoNum: curr.ano,
            mesNum: curr.mes
          };
        }
        acc[key].total++;
        return acc;
      }, {});

      const evolucaoArray = Object.values(evolucaoComData)
        .sort((a: any, b: any) => {
          // Ordenar por ano e depois por mês (crescente)
          if (a.anoNum !== b.anoNum) {
            return a.anoNum - b.anoNum;
          }
          return a.mesNum - b.mesNum;
        })
        .map(({ mes, total }: any) => ({ mes, total }));

      setEvolucaoMensal(evolucaoArray);
      setMediaPorMes(evolucaoArray.length > 0 ? execucoes.length / evolucaoArray.length : 0);
      setMediaPorCulto(cultosUnicos.size > 0 ? execucoes.length / cultosUnicos.size : 0);

      // Buscar tons mais tocados
      let queryTons = supabase
        .from('louvor_itens')
        .select('tom');

      // Aplicar filtros de ano/mês através do JOIN com Louvores IPPN
      if (ano || mes) {
        const { data: cultosIds } = await supabase
          .from('Louvores IPPN')
          .select('"Culto nr."')
          .gte('Dia', ano ? `${ano}-01-01` : '1900-01-01')
          .lte('Dia', ano ? `${ano}-12-31` : '2100-12-31');

        if (cultosIds && cultosIds.length > 0) {
          const ids = cultosIds.map(c => c['Culto nr.']);
          queryTons = queryTons.in('culto_id', ids);
        }
      }

      const { data: tonsData } = await queryTons;

      if (tonsData && tonsData.length > 0) {
        // Filtrar apenas tons nulos e contar
        const contagemTons = tonsData
          .filter(t => t.tom !== null)
          .reduce((acc: any, curr: any) => {
            const tom = curr.tom;
            acc[tom] = (acc[tom] || 0) + 1;
            return acc;
          }, {});

        const rankingTonsArray = Object.entries(contagemTons)
          .map(([tom, total]) => ({
            tom,
            total: total as number
          }))
          .sort((a, b) => b.total - a.total);

        setRankingTons(rankingTonsArray);
      } else {
        setRankingTons([]);
      }

      setLoading(false);
    }

    fetchDados();
  }, [ano, mes]);

  // Buscar cânticos das últimas 4 semanas
  useEffect(() => {
    async function fetchCanticosRecentes() {
      const quatroSemanasAtras = new Date();
      quatroSemanasAtras.setDate(quatroSemanasAtras.getDate() - 28);
      
      const { data: execucoes, error } = await supabase
        .from('vw_execucoes_louvores')
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
      const hoje = new Date();
      const canticosUnicos = execucoes.reduce((acc: any, curr: any) => {
        if (!acc[curr.cantico]) {
          const dataExecucao = new Date(curr.data);
          const diasAtras = Math.floor((hoje.getTime() - dataExecucao.getTime()) / (1000 * 60 * 60 * 24));
          
          acc[curr.cantico] = {
            cantico: curr.cantico,
            ultimaData: curr.data,
            diasAtras: diasAtras
          };
        }
        return acc;
      }, {});

      const canticosArray = Object.values(canticosUnicos) as CanticoRecente[];
      canticosArray.sort((a, b) => a.cantico.localeCompare(b.cantico));

      setCanticosRecentes(canticosArray);
    }

    fetchCanticosRecentes();
  }, []);

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

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-emerald-600" />
          Dashboard de Louvores
        </h1>
        <p className="text-slate-600">Análise completa de execuções e tendências</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <h3 className="font-semibold text-slate-700 mb-3">Filtros</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Ano
            </label>
            <select
              value={ano || ''}
              onChange={e => setAno(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Todos os anos</option>
              {anos.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm text-slate-600 mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Mês
            </label>
            <select
              value={mes || ''}
              onChange={e => setMes(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Todos os meses</option>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-emerald-100 text-sm mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Total de Execuções
          </p>
          <p className="text-3xl font-bold">{totalExecucoes}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-blue-100 text-sm mb-1 flex items-center gap-2">
            <Music className="w-4 h-4" />
            Cânticos Únicos
          </p>
          <p className="text-3xl font-bold">{totalCanticos}</p>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-indigo-100 text-sm mb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Total de Cultos
          </p>
          <p className="text-3xl font-bold">{totalCultos}</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-purple-100 text-sm mb-1 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Média/Culto
          </p>
          <p className="text-3xl font-bold">{mediaPorCulto.toFixed(1)}</p>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-xl shadow-lg">
          <p className="text-orange-100 text-sm mb-1 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Mais Cantado
          </p>
          <p className="text-sm font-semibold truncate">{maisCantado || '-'}</p>
        </div>
      </div>

      {/* Cânticos do Último Mês */}
      <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Music className="w-6 h-6 text-emerald-600" />
            Cânticos das Últimas 4 Semanas
          </h2>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
            {canticosRecentes.length} cânticos
          </span>
        </div>
        
        {canticosRecentes.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Nenhum cântico encontrado nas últimas 4 semanas</p>
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
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 font-medium truncate">{item.cantico}</p>
                  <p className="text-xs text-slate-500">
                    {item.diasAtras === 0 ? 'Hoje' : 
                     item.diasAtras === 1 ? 'Ontem' : 
                     `${item.diasAtras} dias atrás`}
                  </p>
                </div>
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
            <h2 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Top 10 Cânticos Mais Cantados
            </h2>
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
            <h2 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Distribuição Top 5
            </h2>
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
            <h2 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Evolução Mensal
            </h2>
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

          {/* Gráfico de Barras - Tons Mais Tocados */}
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
              <Music className="w-5 h-5 text-purple-500" />
              Tons Mais Tocados
            </h2>
            {rankingTons.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-slate-400">
                Nenhum tom registrado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rankingTons.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="tom" 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabela de Ranking Completo */}
          <div className="bg-white rounded-xl p-6 shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-600" />
              Ranking Completo
            </h2>
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
                          <Trophy className={`w-5 h-5 ${
                            idx === 0 ? 'text-yellow-500' : 
                            idx === 1 ? 'text-gray-400' : 
                            'text-amber-600'
                          }`} />
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