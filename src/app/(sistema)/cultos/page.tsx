'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// --- CONFIGURAÇÕES DE ACESSO ---
const CARGOS_LIDERANCA = ['seminarista', 'presbitero', 'pastor', 'admin'];
const TIPOS_LITURGIA_OPCOES = [
  'Prelúdio', 'Saudação e Acolhida', 'Cânticos Congregacionais', 
  'Confissão de Pecados', 'Dízimos e Ofertas', 'Cântico para as Ofertas', 
  'Oração pelas Crianças', 'Pregação da Palavra', 'Cântico Final', 'Lembretes', 'Oração'
];

interface Cantico { id: string; nome: string; }
interface MusicasNoBloco { cantico_id: string | null; tom: string | null; }
interface LouvorItem {
  id?: string; tipo: string; ordem: number; descricao: string | null;
  tem_cantico?: boolean; lista_musicas: MusicasNoBloco[];
}
interface Culto { 'Culto nr.': number; Dia: string; }

// --- COMPONENTE AUTOCOMPLETE ---
function CanticoAutocomplete({ value, onChange, canticos, onCreate, disabled }: any) {
  const [query, setQuery] = useState(value?.nome || '');
  const [open, setOpen] = useState(false);
  useEffect(() => { setQuery(value?.nome || ''); }, [value]);

  const filtrados = canticos.filter((c: any) => c.nome.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative w-full">
      <input
        value={query} disabled={disabled}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-600 outline-none bg-white disabled:bg-slate-50 transition-all"
        placeholder="Selecione o cântico..."
      />
      {open && query && !disabled && (
        <div className="absolute z-50 bg-white border-2 border-slate-200 rounded-xl mt-1 w-full max-h-48 overflow-auto shadow-xl">
          {filtrados.map((c: any) => (
            <div key={c.id} className="px-4 py-2 hover:bg-emerald-50 cursor-pointer text-sm" onClick={() => { onChange(c); setQuery(c.nome); setOpen(false); }}>
              {c.nome}
            </div>
          ))}
          {!canticos.some((c: any) => c.nome.toLowerCase() === query.toLowerCase()) && (
            <div className="px-4 py-2 text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer border-t text-sm" onClick={async () => { const n = await onCreate(query); onChange(n); setQuery(n.nome); setOpen(false); }}>
              + Cadastrar "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- ITEM DA LITURGIA ---
function ItemLiturgia({ item, index, canticos, onUpdate, onRemove, onMove, onCreate, userRole }: any) {
  const isLideranca = CARGOS_LIDERANCA.includes(userRole);
  const permiteMusica = item.tem_cantico === true || item.tipo.toLowerCase().includes('cântico') || item.tipo.toLowerCase().includes('prelúdio');

  return (
    <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 mb-4 shadow-sm print:border-none print:shadow-none print:p-0">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Item {index + 1}</span>
        {isLideranca && (
          <div className="flex gap-2">
            <button onClick={() => onMove('cima')} className="p-2 hover:bg-slate-100 rounded-lg">⬆️</button>
            <button onClick={() => onMove('baixo')} className="p-2 hover:bg-slate-100 rounded-lg">⬇️</button>
            <button onClick={onRemove} className="p-2 hover:bg-red-50 text-red-500 rounded-lg">🗑️</button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="print:flex print:gap-2 print:items-baseline">
            <span className="hidden print:inline font-bold">{index + 1}.</span>
            {isLideranca ? (
              <select 
                value={item.tipo}
                onChange={e => onUpdate({...item, tipo: e.target.value})}
                className="w-full border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-lg uppercase tracking-tighter outline-none focus:border-emerald-500 mb-2 bg-white print:hidden"
              >
                {!TIPOS_LITURGIA_OPCOES.includes(item.tipo) && <option value={item.tipo}>{item.tipo}</option>}
                {TIPOS_LITURGIA_OPCOES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : null}
            <h3 className={`font-black text-slate-800 text-xl uppercase tracking-tighter mb-1 ${isLideranca ? 'print:block hidden' : 'block'}`}>
              {item.tipo}
            </h3>
          </div>
          
          <textarea
            value={item.descricao || ''}
            onChange={e => onUpdate({ ...item, descricao: e.target.value })}
            disabled={!isLideranca}
            className="w-full border-2 border-slate-50 rounded-2xl p-4 text-sm text-slate-600 bg-slate-50/30 focus:bg-white focus:border-emerald-500 outline-none resize-none disabled:cursor-default transition-all print:border-none print:bg-transparent print:p-0 print:ml-6"
            rows={2}
          />
        </div>

        {permiteMusica && (
          <div className="space-y-3 pt-2 print:ml-6">
            {item.lista_musicas.map((m: MusicasNoBloco, mIdx: number) => {
              const nomeCantico = canticos.find((c: any) => c.id === m.cantico_id)?.nome;
              return (
                <div key={mIdx} className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 relative group print:p-0 print:bg-transparent print:border-none">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:block">
                    <div className="md:col-span-2">
                      <div className="print:hidden">
                        <CanticoAutocomplete 
                          value={canticos.find((c: any) => c.id === m.cantico_id)} 
                          onChange={(c: any) => {
                            const novaLista = [...item.lista_musicas];
                            novaLista[mIdx] = { ...novaLista[mIdx], cantico_id: c?.id || null };
                            onUpdate({ ...item, lista_musicas: novaLista });
                          }}
                          canticos={canticos} onCreate={onCreate} 
                        />
                      </div>
                      <span className="hidden print:inline font-bold text-slate-700">
                        🎵 {nomeCantico || "Música não definida"} {m.tom ? `(${m.tom})` : ''}
                      </span>
                    </div>
                    <div className="print:hidden">
                      <select 
                        value={m.tom || ''} 
                        onChange={e => {
                          const novaLista = [...item.lista_musicas];
                          novaLista[mIdx] = { ...novaLista[mIdx], tom: e.target.value };
                          onUpdate({ ...item, lista_musicas: novaLista });
                        }}
                        className="w-full border-2 border-emerald-100 rounded-xl p-3 bg-white text-sm outline-none focus:border-emerald-500"
                      >
                        <option value="">Tom</option>
                        {['C','G','D','A','E','B','F','Bb','Eb','Am','Em','Dm'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function CultosPage() {
  const [userRole, setUserRole] = useState('admin'); 
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [cultos, setCultos] = useState<any[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [cultoEditando, setCultoEditando] = useState<any>(null);
  const [dia, setDia] = useState('');
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [loading, setLoading] = useState(false);

  const isLideranca = CARGOS_LIDERANCA.includes(userRole);

  useEffect(() => { carregarDados(); }, []);

  const carregarDados = async () => {
    const { data: c } = await supabase.from('canticos').select('id, nome').order('nome');
    if (c) setCanticos(c);
    const { data: cu } = await supabase.from('Louvores IPPN').select('*').order('Dia', { ascending: false });
    if (cu) setCultos(cu || []);
  };

  // --- FUNÇÕES DE EXPORTAÇÃO ---
  const shareWhatsApp = async (culto: any) => {
    const { data } = await supabase.from('louvor_itens').select('*').eq('culto_id', culto['Culto nr.']).order('ordem');
    if (!data) return;

    let texto = `*LITURGIA IP PONTA NEGRA*\n${new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }).toUpperCase()}\n\n`;
    
    data.forEach((linha: any, idx: number) => {
      texto += `${idx + 1}. *${linha.tipo.toUpperCase()}*\n`;
      if (linha.descricao) texto += `   - ${linha.descricao}\n`;
      const nomeM = canticos.find(c => c.id === linha.cantico_id)?.nome;
      if (nomeM) texto += `   🎵 _${nomeM}_ ${linha.tom ? `(${linha.tom})` : ''}\n`;
      texto += `\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const sharePDF = async (culto: any) => {
    await iniciarEdicao(culto); // Carrega os dados na tela
    setTimeout(() => window.print(), 500); // Aguarda renderizar e abre impressão
  };

  const iniciarEdicao = async (culto: any) => {
    setLoading(true);
    const { data } = await supabase.from('louvor_itens').select('*').eq('culto_id', culto['Culto nr.']).order('ordem');
    if (data && data.length > 0) {
        const agrupados: LouvorItem[] = [];
        data.forEach((linha) => {
            const ultimo = agrupados[agrupados.length - 1];
            if (ultimo && ultimo.tipo === linha.tipo && ultimo.descricao === linha.descricao) {
                ultimo.lista_musicas.push({ cantico_id: linha.cantico_id, tom: linha.tom });
            } else {
                agrupados.push({
                    tipo: linha.tipo, ordem: linha.ordem, descricao: linha.descricao,
                    tem_cantico: !!linha.cantico_id, lista_musicas: [{ cantico_id: linha.cantico_id, tom: linha.tom }]
                });
            }
        });
        setItens(agrupados);
    }
    setCultoEditando(culto); setDia(culto.Dia); setModoEdicao(true); setLoading(false);
  };

  const criarCultoPadrao = async () => {
    const { data } = await supabase.from('modelo_culto_padrao').select('*').order('ordem');
    if (data) {
      setItens(data.map(m => ({
          tipo: m.tipo, ordem: m.ordem, descricao: m.descricao_padrao, tem_cantico: m.tem_cantico,
          lista_musicas: m.descricao_padrao?.includes('3 músicas') ? Array(3).fill({ cantico_id: null, tom: null }) : [{ cantico_id: null, tom: null }]
      })));
      setCultoEditando(null); setDia(new Date().toISOString().split('T')[0]); setModoEdicao(true);
    }
  };

  const salvar = async () => {
    if (!dia) return alert("Selecione a data!");
    setLoading(true);
    try {
      let cId = cultoEditando?.['Culto nr.'];
      if (!cId) {
        const { data } = await supabase.from('Louvores IPPN').insert({ Dia: dia }).select().single();
        cId = data['Culto nr.'];
      } else {
        await supabase.from('Louvores IPPN').update({ Dia: dia }).eq('"Culto nr."', cId);
        await supabase.from('louvor_itens').delete().eq('culto_id', cId);
      }
      const rows: any[] = []; let ord = 1;
      itens.forEach((it) => it.lista_musicas.forEach((m) => {
        rows.push({ culto_id: cId, ordem: ord++, tipo: it.tipo, descricao: it.descricao, cantico_id: m.cantico_id, tom: m.tom });
      }));
      await supabase.from('louvor_itens').insert(rows);
      setModoEdicao(false); carregarDados();
    } catch (e) { alert("Erro ao salvar!"); }
    setLoading(false);
  };

  if (modoEdicao) return (
    <div className="min-h-screen bg-slate-50 pb-32 print:bg-white print:pb-0">
      <header className="bg-white border-b-2 border-slate-200 p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm print:hidden">
        <button onClick={() => setModoEdicao(false)} className="text-emerald-700 font-bold px-4">← Sair</button>
        <h2 className="font-black text-slate-800 uppercase tracking-tighter">Edição de Liturgia</h2>
        <div className="w-10"></div>
      </header>
      <main className="p-4 max-w-2xl mx-auto print:max-w-none print:p-0">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 mb-6 print:border-none print:text-center">
          <h1 className="hidden print:block font-serif font-bold text-2xl uppercase tracking-widest mb-4">Liturgia IP Ponta Negra</h1>
          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest print:hidden">Data da Liturgia</label>
          <input type="date" value={dia} onChange={e => setDia(e.target.value)} disabled={!isLideranca} className="w-full text-2xl font-black text-emerald-800 border-none p-0 focus:ring-0 bg-transparent print:text-center print:text-lg" />
        </div>
        
        <div className="space-y-4">
          {itens.map((it, idx) => (
            <ItemLiturgia key={idx} item={it} index={idx} canticos={canticos} userRole={userRole}
              onUpdate={(u: any) => { const n = [...itens]; n[idx] = u; setItens(n); }}
              onRemove={() => setItens(itens.filter((_, i) => i !== idx))}
              onMove={(d: any) => {
                const n = [...itens]; const t = d === 'cima' ? idx - 1 : idx + 1;
                if (t >= 0 && t < n.length) { [n[idx], n[t]] = [n[t], n[idx]]; setItens(n); }
              }}
              onCreate={async (n: string) => { const { data }: any = await supabase.from('canticos').insert({ nome: n }).select().single(); setCanticos([...canticos, data]); return data; }}
            />
          ))}
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t-2 border-slate-200 z-40 print:hidden">
          <button onClick={salvar} disabled={loading} className="w-full max-w-2xl mx-auto block bg-emerald-700 text-white py-4 rounded-3xl font-bold text-lg shadow-xl active:scale-95 transition-all">
            {loading ? '⏳ Gravando...' : '✅ Salvar'}
          </button>
        </div>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto mt-8">
        <h1 className="text-4xl font-black text-slate-900 mb-8 tracking-tighter uppercase">Liturgias</h1>
        {isLideranca && (
          <button onClick={criarCultoPadrao} className="w-full bg-emerald-800 text-white py-5 rounded-3xl font-bold text-xl shadow-xl mb-8 active:scale-95 transition-all">+ Nova Liturgia Padrão</button>
        )}
        <div className="space-y-4">
          {cultos.map(c => (
            <div key={c['Culto nr.']} 
              className="bg-white border-2 border-slate-200 rounded-3xl p-6 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registro #{c['Culto nr.']}</p>
                <h2 className="text-xl font-bold text-slate-800">{new Date(c.Dia + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</h2>
              </div>
              
              <div className="flex gap-2">
                {/* ÍCONE WHATSAPP */}
                <button onClick={() => shareWhatsApp(c)} className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl hover:bg-emerald-100 transition-colors" title="Compartilhar WhatsApp">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.559 4.189 1.619 6.011L0 24l6.117-1.605a11.847 11.847 0 005.925 1.586h.005c6.635 0 12.032-5.396 12.035-12.032a11.76 11.76 0 00-3.528-8.485" /></svg>
                </button>
                {/* ÍCONE PDF */}
                <button onClick={() => sharePDF(c)} className="bg-slate-50 text-slate-600 p-4 rounded-2xl hover:bg-slate-100 transition-colors" title="Gerar PDF">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                {/* ÍCONE EDITAR */}
                <button onClick={() => iniciarEdicao(c)} className="bg-slate-50 text-slate-800 p-4 rounded-2xl hover:bg-slate-100 transition-colors" title="Editar">
                  <span className="text-xl">✏️</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}