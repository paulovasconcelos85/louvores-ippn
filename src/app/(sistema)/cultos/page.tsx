'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { jsPDF } from 'jspdf';

// --- CONFIGURAÇÕES DE ACESSO ---
const CARGOS_LIDERANCA = ['seminarista', 'presbitero', 'pastor', 'admin'];
const CARGOS_MUSICA = ['musico'];
const TIPOS_LITURGIA_OPCOES = [
  'Prelúdio', 'Leitura Inicial', 'Saudação e Acolhida à Igreja', 'Cânticos Congregacionais',
  'Confissão de Pecados', 'Dízimos e Ofertas', 'Cântico para as Ofertas',
  'Oração pelas Crianças', 'Pregação da Palavra', 'Cântico Final', 'Lembretes', 
  'Oração', 'Poslúdio', 'Amém Tríplice'
];

interface Cantico { 
  id: string; 
  nome: string;
  ultima_vez?: string | null;
}
interface MusicasNoBloco { cantico_id: string | null; tom: string | null; }
interface LouvorItem {
  id?: string; tipo: string; ordem: number; descricao: string | null;
  tem_cantico?: boolean; lista_musicas: MusicasNoBloco[];
}
interface Culto { 'Culto nr.': number; Dia: string; }

// --- FUNÇÃO PARA CALCULAR STATUS DA MÚSICA ---
function getStatusMusica(dataStr: string | null | undefined): {
  label: string;
  cor: string;
  corFundo: string;
  dias: number;
  dataFormatada: string;
} {
  if (!dataStr) {
    return {
      label: 'PRIMEIRA VEZ',
      cor: 'text-blue-700',
      corFundo: 'bg-blue-100 border-blue-200',
      dias: -1,
      dataFormatada: 'Nunca tocada'
    };
  }

  const data = new Date(dataStr + 'T00:00:00');
  const hoje = new Date();
  const diffTime = hoje.getTime() - data.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  const dataFormatada = data.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });

  if (diffDays < 30) {
    return {
      label: 'RECENTE',
      cor: 'text-emerald-700',
      corFundo: 'bg-emerald-100 border-emerald-200',
      dias: diffDays,
      dataFormatada
    };
  } else if (diffDays < 90) {
    return {
      label: 'MODERADO',
      cor: 'text-amber-700',
      corFundo: 'bg-amber-100 border-amber-200',
      dias: diffDays,
      dataFormatada
    };
  } else if (diffDays < 180) {
    return {
      label: 'HÁ TEMPO',
      cor: 'text-orange-700',
      corFundo: 'bg-orange-100 border-orange-200',
      dias: diffDays,
      dataFormatada
    };
  } else {
    return {
      label: 'HÁ MUITO TEMPO',
      cor: 'text-red-700',
      corFundo: 'bg-red-100 border-red-200',
      dias: diffDays,
      dataFormatada
    };
  }
}

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
        <div className="absolute z-50 bg-white border-2 border-slate-200 rounded-xl mt-1 w-full max-h-60 overflow-auto shadow-xl">
          {filtrados.map((c: any) => {
            const status = getStatusMusica(c.ultima_vez);
            return (
              <div 
                key={c.id} 
                className="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-0" 
                onClick={() => { onChange(c); setQuery(c.nome); setOpen(false); }}
              >
                <div className="text-sm font-medium text-slate-800 mb-1">{c.nome}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${status.corFundo} ${status.cor} border`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {status.dataFormatada}
                  </span>
                </div>
              </div>
            );
          })}
          {!canticos.some((c: any) => c.nome.toLowerCase() === query.toLowerCase()) && (
            <div className="px-4 py-3 text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer border-t-2 text-sm" onClick={async () => { const n = await onCreate(query); onChange(n); setQuery(n.nome); setOpen(false); }}>
              + Cadastrar "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- COMPONENTE SELETOR DE TIPO LITÚRGICO ---
function TipoLiturgiaSelector({ value, onChange, disabled }: any) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  
  useEffect(() => { setQuery(value || ''); }, [value]);

  const filtrados = TIPOS_LITURGIA_OPCOES.filter(t => 
    t.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full">
      <input
        value={query}
        disabled={disabled}
        onChange={e => { 
          const novoValor = e.target.value;
          setQuery(novoValor); 
          setOpen(true); 
          onChange(novoValor);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full border-2 border-slate-100 rounded-xl p-3 font-black text-slate-800 text-lg uppercase tracking-tighter outline-none focus:border-emerald-500 bg-white disabled:bg-slate-50 transition-all"
        placeholder="Tipo da liturgia..."
      />
      
      {open && query && !disabled && (
        <div className="absolute z-50 bg-white border-2 border-slate-200 rounded-xl mt-1 w-full max-h-60 overflow-auto shadow-xl">
          {filtrados.map((tipo, idx) => (
            <div 
              key={idx}
              className="px-4 py-3 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-0 font-bold text-slate-700"
              onClick={() => { 
                onChange(tipo); 
                setQuery(tipo); 
                setOpen(false); 
              }}
            >
              {tipo}
            </div>
          ))}
          
          {query && !TIPOS_LITURGIA_OPCOES.some(t => t.toLowerCase() === query.toLowerCase()) && (
            <div 
              className="px-4 py-3 text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer border-t-2 border-emerald-200"
              onClick={() => { 
                onChange(query); 
                setOpen(false); 
              }}
            >
              ✨ Usar "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- ITEM DA LITURGIA ---
function ItemLiturgia({ item, index, canticos, onUpdate, onRemove, onMove, onCreate, userRole }: any) {
  const isLideranca = userRole ? CARGOS_LIDERANCA.includes(userRole) : false;
  const isMusico = userRole ? CARGOS_MUSICA.includes(userRole) : false;
  const permiteMusica = item.tem_cantico === true || item.tipo.toLowerCase().includes('cântico') || item.tipo.toLowerCase().includes('prelúdio') || item.tipo.toLowerCase().includes('poslúdio');

  const adicionarMusica = () => {
    const novaLista = [...item.lista_musicas, { cantico_id: null, tom: null }];
    onUpdate({ ...item, lista_musicas: novaLista });
  };

  const removerMusica = (mIdx: number) => {
    if (item.lista_musicas.length <= 1) return;
    const novaLista = item.lista_musicas.filter((_: any, i: number) => i !== mIdx);
    onUpdate({ ...item, lista_musicas: novaLista });
  };

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
              <div className="print:hidden mb-2">
                <TipoLiturgiaSelector
                  value={item.tipo}
                  onChange={(novoTipo: string) => onUpdate({...item, tipo: novoTipo})}
                  disabled={false}
                />
              </div>
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
              const canticoSelecionado = canticos.find((c: any) => c.id === m.cantico_id);
              const nomeCantico = canticoSelecionado?.nome;
              const status = getStatusMusica(canticoSelecionado?.ultima_vez);
              
              return (
                <div key={mIdx} className="p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-100 relative group print:p-0 print:bg-transparent print:border-none">
                  {isLideranca && item.lista_musicas.length > 1 && (
                    <button
                      onClick={() => removerMusica(mIdx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg print:hidden"
                      title="Remover música"
                    >
                      ✕
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:block">
                    <div className="md:col-span-2 space-y-2">
                      <div className="print:hidden">
                        <CanticoAutocomplete 
                          value={canticoSelecionado} 
                          onChange={(c: any) => {
                            const novaLista = [...item.lista_musicas];
                            novaLista[mIdx] = { ...novaLista[mIdx], cantico_id: c?.id || null };
                            onUpdate({ ...item, lista_musicas: novaLista });
                          }}
                          canticos={canticos} onCreate={onCreate} disabled={!(isLideranca || isMusico)}
                        />
                        {canticoSelecionado && (
                          <div className={`inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg border-2 ${status.corFundo}`}>
                            <span className={`text-[10px] font-black ${status.cor} uppercase tracking-wider`}>
                              {status.label}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              📅 {status.dataFormatada}
                            </span>
                            {status.dias >= 0 && (
                              <span className="text-[10px] text-slate-500">
                                ({status.dias} dias)
                              </span>
                            )}
                          </div>
                        )}
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
                        disabled={!(isLideranca || isMusico)}
                        className="w-full border-2 border-emerald-100 rounded-xl p-3 bg-white text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50"
                      >
                        <option value="">Tom</option>
                        {['C','G','D','A','E','B','F','Bb','Eb','Am','Em','Dm'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isLideranca && (
              <button
                onClick={adicionarMusica}
                className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 transition-all font-bold text-sm flex items-center justify-center gap-2 group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🎵</span>
                <span>Adicionar cântico</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- FUNÇÃO PARA GERAR PDF ---
const gerarPDF = async (culto: any, itens: LouvorItem[], canticos: Cantico[]) => {
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // === CABEÇALHO COM FUNDO VERDE ===
  const headerHeight = 35;
  
  doc.setFillColor(16, 60, 48);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Texto do cabeçalho em branco
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('IGREJA PRESBITERIANA DA PONTA NEGRA', pageWidth / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Uma igreja da família de Deus', pageWidth / 2, 22, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Manaus - AM', pageWidth / 2, 29, { align: 'center' });

  let yPos = headerHeight + 15;

  // Resetar cor do texto para preto
  doc.setTextColor(0, 0, 0);

  // === TÍTULO ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('LITURGIA', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 10;
  
  // === DATA ===
  doc.setFontSize(14);
  const dataFormatada = new Date(culto.Dia + 'T00:00:00')
    .toLocaleDateString('pt-BR', { 
      weekday: 'long',
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    })
    .toUpperCase();
  doc.text(dataFormatada, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 12;

  // Linha decorativa
  doc.setDrawColor(16, 60, 48);
  doc.setLineWidth(0.8);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 12;

  // === ITENS LITÚRGICOS ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  let itemNumero = 1;

  for (const item of itens) {
    // Verificar se precisa de nova página
    if (yPos > pageHeight - 40) {
      doc.addPage();
      
      // Cabeçalho nas páginas seguintes
      doc.setFillColor(16, 60, 48);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('IGREJA PRESBITERIANA DA PONTA NEGRA', pageWidth / 2, 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Uma igreja da familia de Deus', pageWidth / 2, 22, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      yPos = headerHeight + 15;
    }

    // NÚMERO E TIPO (em negrito e maiúsculo)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${itemNumero}. ${item.tipo.toUpperCase()}`, margin, yPos);
    yPos += 7;

    // DESCRIÇÃO
    if (item.descricao && item.descricao.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const linhas = item.descricao.split('\n').filter(l => l.trim());
      
      for (const linha of linhas) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          doc.setFillColor(16, 60, 48);
          doc.rect(0, 0, pageWidth, headerHeight, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text('IGREJA PRESBITERIANA DA PONTA NEGRA', pageWidth / 2, 14, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('Uma igreja da familia de Deus', pageWidth / 2, 22, { align: 'center' });
          doc.setTextColor(0, 0, 0);
          yPos = headerHeight + 15;
        }
        
        // Substituir bullets por hífens
        const linhaLimpa = linha.trim().replace(/^●\s*/, '- ').replace(/^%I\s*/, '- ');
        const textoLinha = doc.splitTextToSize(linhaLimpa, pageWidth - 2 * margin - 10);
        for (const pedaco of textoLinha) {
          doc.text(`     ${pedaco}`, margin, yPos);
          yPos += 5.5;
        }
      }
    }

    // MÚSICAS
    const permiteMusica = item.tem_cantico || 
                         item.tipo.toLowerCase().includes('cântico') || 
                         item.tipo.toLowerCase().includes('prelúdio') ||
                         item.tipo.toLowerCase().includes('poslúdio');

    if (permiteMusica && item.lista_musicas && item.lista_musicas.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      for (const musica of item.lista_musicas) {
        if (musica.cantico_id) {
          const cantico = canticos.find(c => c.id === musica.cantico_id);
          if (cantico) {
            if (yPos > pageHeight - 30) {
              doc.addPage();
              doc.setFillColor(16, 60, 48);
              doc.rect(0, 0, pageWidth, headerHeight, 'F');
              doc.setTextColor(255, 255, 255);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(14);
              doc.text('IGREJA PRESBITERIANA DA PONTA NEGRA', pageWidth / 2, 14, { align: 'center' });
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              doc.text('Uma igreja da familia de Deus', pageWidth / 2, 22, { align: 'center' });
              doc.setTextColor(0, 0, 0);
              yPos = headerHeight + 15;
            }
            
            const textoMusica = `     - ${cantico.nome}${musica.tom ? ` (${musica.tom})` : ''}`;
            const linhasMusica = doc.splitTextToSize(textoMusica, pageWidth - 2 * margin - 10);
            
            for (const linha of linhasMusica) {
              doc.text(linha, margin, yPos);
              yPos += 5.5;
            }
          }
        }
      }
    }

    yPos += 8;
    itemNumero++;
  }

  // === RODAPÉ ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Salvar PDF
  const dataArquivo = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR').replace(/\//g, '.');
  const nomeArquivo = `LITURGIA_${dataArquivo}.pdf`;
  doc.save(nomeArquivo);
};

// --- COMPONENTE DE VISUALIZAÇÃO DE LITURGIA ---
function LiturgiaView({ culto, itens, canticos, onClose }: any) {
  return (
    <div className="mt-4 bg-slate-50 rounded-2xl p-6 border-2 border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-black text-slate-800">LITURGIA COMPLETA</h3>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 font-bold text-2xl"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-4">
        {itens.map((item: LouvorItem, idx: number) => {
          const permiteMusica = item.tem_cantico || 
                               item.tipo.toLowerCase().includes('cântico') || 
                               item.tipo.toLowerCase().includes('prelúdio') ||
                               item.tipo.toLowerCase().includes('poslúdio');
          
          return (
            <div key={idx} className="bg-white rounded-xl p-4 border border-slate-200">
              <h4 className="font-bold text-slate-800 mb-2 text-sm uppercase">
                {idx + 1}. {item.tipo}
              </h4>
              
              {item.descricao && (
                <p className="text-slate-600 text-sm mb-2 whitespace-pre-line">
                  {item.descricao}
                </p>
              )}
              
              {permiteMusica && item.lista_musicas && item.lista_musicas.length > 0 && (
                <div className="space-y-1 mt-2">
                  {item.lista_musicas.map((m, mIdx) => {
                    const cantico = canticos.find((c: any) => c.id === m.cantico_id);
                    if (!cantico) return null;
                    
                    return (
                      <div key={mIdx} className="text-sm text-emerald-700 font-medium">
                        🎵 {cantico.nome} {m.tom ? `(${m.tom})` : ''}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- PÁGINA PRINCIPAL ---
export default function CultosPage() {
  const [userRole, setUserRole] = useState<string | null>(null); 
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [cultos, setCultos] = useState<any[]>([]);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [cultoEditando, setCultoEditando] = useState<any>(null);
  const [dia, setDia] = useState('');
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cultoExpandido, setCultoExpandido] = useState<number | null>(null);
  const [liturgiasCarregadas, setLiturgiasCarregadas] = useState<{[key: number]: LouvorItem[]}>({});

  const isLideranca = CARGOS_LIDERANCA.includes(userRole);

  const carregarUsuario = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setUserRole('staff');
      return;
    }

    const { data, error } = await supabase
      .from('usuarios_permitidos')
      .select('cargo')
      .eq('id', user.id)
      .single();

    if (data?.cargo) {
      setUserRole(data.cargo);
    } else {
      setUserRole('staff');
    }
  };

  const carregarDados = async () => {
    const { data: todosCanticos } = await supabase
      .from('canticos')
      .select('id, nome')
      .order('nome');
    
    if (todosCanticos) {
      setCanticos(todosCanticos.map(c => ({ ...c, ultima_vez: null })));
    }

    const { data: cu } = await supabase
      .from('Louvores IPPN')
      .select('*')
      .order('Dia', { ascending: false });
    if (cu) setCultos(cu || []);

    if (todosCanticos) {
      buscarUltimasDatas(todosCanticos);
    }
  };

  const buscarUltimasDatas = async (canticosBase: any[]) => {
    const { data: todosItens } = await supabase
      .from('louvor_itens')
      .select('cantico_id, culto_id')
      .not('cantico_id', 'is', null);

    if (!todosItens) return;

    const { data: todosCultos } = await supabase
      .from('Louvores IPPN')
      .select('"Culto nr.", Dia');

    if (!todosCultos) return;

    const mapaCultos = new Map();
    todosCultos.forEach((c: any) => {
      mapaCultos.set(c['Culto nr.'], c.Dia);
    });

    const mapaUltimasDatas = new Map();
    
    todosItens.forEach((item: any) => {
      const dataDoculto = mapaCultos.get(item.culto_id);
      if (!dataDoculto) return;

      const dataAtual = mapaUltimasDatas.get(item.cantico_id);
      if (!dataAtual || dataDoculto > dataAtual) {
        mapaUltimasDatas.set(item.cantico_id, dataDoculto);
      }
    });

    const canticosAtualizados = canticosBase.map(c => ({
      ...c,
      ultima_vez: mapaUltimasDatas.get(c.id) || null
    }));

    setCanticos(canticosAtualizados);
  };

    useEffect(() => { 
    carregarUsuario();
    carregarDados(); 
  }, []);

  if (!userRole) {
    return (
      <div className="p-8 text-center font-bold text-slate-500">
        Carregando...
      </div>
    );
  }

  // --- EXPANDIR/CONTRAIR CULTO ---
  const toggleExpandirCulto = async (cultoNr: number) => {
    if (cultoExpandido === cultoNr) {
      setCultoExpandido(null);
      return;
    }

    // Se já carregou antes, só expande
    if (liturgiasCarregadas[cultoNr]) {
      setCultoExpandido(cultoNr);
      return;
    }

    // Carregar liturgia
    const { data, error } = await supabase
      .from('louvor_itens')
      .select('*')
      .eq('culto_id', cultoNr)
      .order('ordem');
    
    if (error || !data) {
      alert('Erro ao carregar liturgia!');
      return;
    }

    // Agrupar músicas
    const agrupados: LouvorItem[] = [];
    data.forEach((linha) => {
      const ultimo = agrupados[agrupados.length - 1];
      
      if (ultimo && 
          ultimo.tipo === linha.tipo && 
          ultimo.descricao === linha.descricao &&
          (linha.cantico_id !== null || ultimo.lista_musicas[0]?.cantico_id !== null)) {
        ultimo.lista_musicas.push({ 
          cantico_id: linha.cantico_id, 
          tom: linha.tom 
        });
      } else {
        agrupados.push({
          tipo: linha.tipo,
          ordem: linha.ordem,
          descricao: linha.descricao,
          tem_cantico: !!linha.cantico_id,
          lista_musicas: [{ 
            cantico_id: linha.cantico_id, 
            tom: linha.tom 
          }]
        });
      }
    });

    setLiturgiasCarregadas(prev => ({ ...prev, [cultoNr]: agrupados }));
    setCultoExpandido(cultoNr);
  };

  // --- FUNÇÕES DE EXPORTAÇÃO ---
  const shareWhatsApp = async (culto: any) => {
    const cultoNr = culto['Culto nr.'];
    let itensParaExportar = liturgiasCarregadas[cultoNr];
    
    if (!itensParaExportar) {
      const { data } = await supabase
        .from('louvor_itens')
        .select('*')
        .eq('culto_id', cultoNr)
        .order('ordem');
      
      if (!data) return;
      
      const agrupados: LouvorItem[] = [];
      data.forEach((linha) => {
        const ultimo = agrupados[agrupados.length - 1];
        if (ultimo && 
            ultimo.tipo === linha.tipo && 
            ultimo.descricao === linha.descricao &&
            (linha.cantico_id !== null || ultimo.lista_musicas[0]?.cantico_id !== null)) {
          ultimo.lista_musicas.push({ cantico_id: linha.cantico_id, tom: linha.tom });
        } else {
          agrupados.push({
            tipo: linha.tipo,
            ordem: linha.ordem,
            descricao: linha.descricao,
            tem_cantico: !!linha.cantico_id,
            lista_musicas: [{ cantico_id: linha.cantico_id, tom: linha.tom }]
          });
        }
      });
      itensParaExportar = agrupados;
    }

    const dataFormatada = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR');
    
    let texto = `LITURGIA DO CULTO DE *${dataFormatada}*\n\n`;

    let contadorMusica = 1;
    
    itensParaExportar.forEach((item: LouvorItem) => {
      const tipoUpper = item.tipo.toUpperCase();
      const permiteMusica = item.tem_cantico || 
                           item.tipo.toLowerCase().includes('cântico') || 
                           item.tipo.toLowerCase().includes('prelúdio') ||
                           item.tipo.toLowerCase().includes('poslúdio');
      
      texto += `*${tipoUpper}*\n`;
      
      // Descrição
      if (item.descricao && item.descricao.trim()) {
        const linhas = item.descricao.split('\n').filter(l => l.trim());
        linhas.forEach(linha => {
          const limpa = linha.trim().replace(/^●\s*/, '- ');
          texto += `   ${limpa}\n`;
        });
      }
      
      // Músicas
      if (permiteMusica && item.lista_musicas && item.lista_musicas.length > 0) {
        item.lista_musicas.forEach(m => {
          const cantico = canticos.find(c => c.id === m.cantico_id);
          if (cantico) {
            texto += `${contadorMusica}. ${cantico.nome}${m.tom ? ` (${m.tom})` : ''}\n`;
            contadorMusica++;
          }
        });
      }
      
      texto += `\n`;
    });

    // Buscar escala vinculada ao culto
    const { data: escala } = await supabase
      .from('escalas')
      .select('id')
      .eq('culto_id', cultoNr)
      .single();

    texto += `-----\n*ESCALA*\n`;

    if (escala) {
      const { data: funcoes } = await supabase
        .from('escalas_funcoes')
        .select(`
          ordem,
          tags_funcoes(nome),
          usuarios_permitidos(nome)
        `)
        .eq('escala_id', escala.id)
        .order('ordem');

      if (funcoes && funcoes.length > 0) {
        funcoes.forEach((f: any) => {
          texto += `- ${f.tags_funcoes.nome}: ${f.usuarios_permitidos.nome}\n`;
        });
      } else {
        // escala existe, mas está vazia
        texto += `- Ministracao: _A definir_\n`;
        texto += `- Violao: _A definir_\n`;
        texto += `- Voz 1: _A definir_\n`;
        texto += `- Voz 2: _A definir_\n`;
        texto += `- Voz 3: _A definir_\n`;
      }
    } else {
      // não existe escala para esse culto
      texto += `- Ministracao: _A definir_\n`;
      texto += `- Violao: _A definir_\n`;
      texto += `- Voz 1: _A definir_\n`;
      texto += `- Voz 2: _A definir_\n`;
      texto += `- Voz 3: _A definir_\n`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const sharePDF = async (culto: any) => {
    setLoading(true);
    
    const cultoNr = culto['Culto nr.'];
    let itensParaExportar = liturgiasCarregadas[cultoNr];
    
    if (!itensParaExportar) {
      const { data } = await supabase
        .from('louvor_itens')
        .select('*')
        .eq('culto_id', cultoNr)
        .order('ordem');
      
      if (!data) {
        setLoading(false);
        return;
      }
      
      const agrupados: LouvorItem[] = [];
      data.forEach((linha) => {
        const ultimo = agrupados[agrupados.length - 1];
        if (ultimo && 
            ultimo.tipo === linha.tipo && 
            ultimo.descricao === linha.descricao &&
            (linha.cantico_id !== null || ultimo.lista_musicas[0]?.cantico_id !== null)) {
          ultimo.lista_musicas.push({ cantico_id: linha.cantico_id, tom: linha.tom });
        } else {
          agrupados.push({
            tipo: linha.tipo,
            ordem: linha.ordem,
            descricao: linha.descricao,
            tem_cantico: !!linha.cantico_id,
            lista_musicas: [{ cantico_id: linha.cantico_id, tom: linha.tom }]
          });
        }
      });
      itensParaExportar = agrupados;
    }
    
    await gerarPDF(culto, itensParaExportar, canticos);
    setLoading(false);
  };

  const iniciarEdicao = async (culto: any) => {
    setLoading(true);
    
    const cultoNr = culto['Culto nr.'];
    let itensParaEditar = liturgiasCarregadas[cultoNr];
    
    if (!itensParaEditar) {
      const { data, error } = await supabase
        .from('louvor_itens')
        .select('*')
        .eq('culto_id', cultoNr)
        .order('ordem');
      
      if (error || !data) {
        alert('Erro ao carregar liturgia!');
        setLoading(false);
        return;
      }
      
      const agrupados: LouvorItem[] = [];
      data.forEach((linha) => {
        const ultimo = agrupados[agrupados.length - 1];
        if (ultimo && 
            ultimo.tipo === linha.tipo && 
            ultimo.descricao === linha.descricao &&
            (linha.cantico_id !== null || ultimo.lista_musicas[0]?.cantico_id !== null)) {
          ultimo.lista_musicas.push({ cantico_id: linha.cantico_id, tom: linha.tom });
        } else {
          agrupados.push({
            tipo: linha.tipo,
            ordem: linha.ordem,
            descricao: linha.descricao,
            tem_cantico: !!linha.cantico_id,
            lista_musicas: [{ cantico_id: linha.cantico_id, tom: linha.tom }]
          });
        }
      });
      itensParaEditar = agrupados;
    }
    
    setItens(itensParaEditar);
    setCultoEditando(culto);
    setDia(culto.Dia);
    setModoEdicao(true);
    setLoading(false);
  };

  const criarCultoPadrao = async () => {
    // Função para calcular próximo domingo
    const calcularProximoDomingo = (data: Date): Date => {
      const resultado = new Date(data);
      const diasAteProximoDomingo = (7 - resultado.getDay()) % 7 || 7;
      resultado.setDate(resultado.getDate() + diasAteProximoDomingo);
      return resultado;
    };

    // Buscar todos os cultos salvos
    const { data: cultosExistentes } = await supabase
      .from('Louvores IPPN')
      .select('Dia')
      .order('Dia', { ascending: false });

    // Encontrar próximo domingo sem liturgia
    let proximoDomingo = calcularProximoDomingo(new Date());
    const datasExistentes = new Set(cultosExistentes?.map(c => c.Dia) || []);
    
    while (datasExistentes.has(proximoDomingo.toISOString().split('T')[0])) {
      proximoDomingo = calcularProximoDomingo(new Date(proximoDomingo.getTime() + 24 * 60 * 60 * 1000));
    }

    const modeloPadrao: LouvorItem[] = [
      {
        tipo: 'Prelúdio',
        ordem: 1,
        descricao: null,
        tem_cantico: true,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Saudação e Acolhida à Igreja',
        ordem: 2,
        descricao: 'Salmo 138.1-2\nIgreja da Família de Deus\nLeitura Responsiva: Salmo ____ (_______)\nOração de Invocação e Entrega do Culto ao Senhor (_______)',
        tem_cantico: false,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Cânticos Congregacionais',
        ordem: 3,
        descricao: null,
        tem_cantico: true,
        lista_musicas: [
          { cantico_id: null, tom: null },
          { cantico_id: null, tom: null },
          { cantico_id: null, tom: null }
        ]
      },
      {
        tipo: 'Confissão de Pecados',
        ordem: 4,
        descricao: 'Leitura Não Responsiva e Oração: Salmo 40.1-3 (_______)\nDar minutos para os irmãos.\nOração pelos enfermos.',
        tem_cantico: false,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Dízimos e Ofertas',
        ordem: 5,
        descricao: 'Passagem de Dízimos e Ofertas. 1 Tm 6.17-19\nLembrar aos presentes colocar o código 0,09 no PIX;\nEnvelopes de Dízimo.',
        tem_cantico: false,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Cântico para as Ofertas',
        ordem: 6,
        descricao: 'Oração pelas ofertas e dízimo.',
        tem_cantico: true,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Pregação da Palavra',
        ordem: 7,
        descricao: null,
        tem_cantico: false,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Cântico Final',
        ordem: 8,
        descricao: 'Poslúdio',
        tem_cantico: true,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Oração - Bênção Apostólica',
        ordem: 9,
        descricao: 'Amém tríplice',
        tem_cantico: false,
        lista_musicas: [{ cantico_id: null, tom: null }]
      },
      {
        tipo: 'Lembretes - Liturgo',
        ordem: 10,
        descricao: 'Apresentação dos convidados\nAniversariantes / Casamento',
        tem_cantico: false,
        lista_musicas: [{ cantico_id: null, tom: null }]
      }
    ];
    
    setItens(modeloPadrao);
    setCultoEditando(null);
    setDia(proximoDomingo.toISOString().split('T')[0]);
    setModoEdicao(true);
  };

  const salvar = async () => {
    if (!dia) return alert("Selecione a data!");
    setLoading(true);
    
    try {
      let cId = cultoEditando?.['Culto nr.'];
      
      if (!cId) {
        const { data, error: errorCulto } = await supabase
          .from('Louvores IPPN')
          .insert({ Dia: dia })
          .select()
          .single();
        
        if (errorCulto) throw errorCulto;
        cId = data['Culto nr.'];
      } else {
        const { error: errorUpdate } = await supabase
          .from('Louvores IPPN')
          .update({ Dia: dia })
          .eq('"Culto nr."', cId);
        
        if (errorUpdate) throw errorUpdate;
        
        const { error: errorDelete } = await supabase
          .from('louvor_itens')
          .delete()
          .eq('culto_id', cId);
        
        if (errorDelete) throw errorDelete;
      }
      
      const rows: any[] = [];
      let ord = 1;
      
      itens.forEach((it) => {
        const permiteMusica = it.tem_cantico === true || 
                            it.tipo.toLowerCase().includes('cântico') || 
                            it.tipo.toLowerCase().includes('prelúdio') ||
                            it.tipo.toLowerCase().includes('poslúdio');
        
        if (permiteMusica && it.lista_musicas && it.lista_musicas.length > 0) {
          it.lista_musicas.forEach((m) => {
            rows.push({
              culto_id: cId,
              ordem: ord++,
              tipo: it.tipo,
              descricao: it.descricao || null,
              cantico_id: m.cantico_id || null,
              tom: m.tom || null
            });
          });
        } else {
          rows.push({
            culto_id: cId,
            ordem: ord++,
            tipo: it.tipo,
            descricao: it.descricao || null,
            cantico_id: null,
            tom: null
          });
        }
      });
      
      if (rows.length === 0) {
        alert('Adicione pelo menos um item litúrgico!');
        setLoading(false);
        return;
      }
      
      const { error: errorInsert } = await supabase
        .from('louvor_itens')
        .insert(rows);
      
      if (errorInsert) throw errorInsert;
      
      alert('Liturgia salva com sucesso! ✅');
      setModoEdicao(false);
      setLiturgiasCarregadas({});
      await carregarDados();
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message || 'Erro desconhecido'}`);
    }
    
    setLoading(false);
  };

  const adicionarItemEm = (posicao: number) => {
    const novoItem: LouvorItem = {
      tipo: posicao === 0 ? 'Prelúdio' : 'Cânticos Congregacionais',
      ordem: posicao,
      descricao: '',
      tem_cantico: posicao === 0 ? true : false,
      lista_musicas: [{ cantico_id: null, tom: null }]
    };

    const novosItens = [...itens];
    novosItens.splice(posicao, 0, novoItem);
    setItens(novosItens);
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
        {isLideranca && (
          <button
            onClick={() => adicionarItemEm(0)}
            className="w-full py-3 border-2 border-dashed border-emerald-300 rounded-2xl text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 transition-all font-bold text-sm flex items-center justify-center gap-2 group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
            <span>Adicionar item no início</span>
          </button>
        )}

        {itens.map((it, idx) => (
          <div key={idx}>
            <ItemLiturgia 
              item={it} 
              index={idx} 
              canticos={canticos} 
              userRole={userRole}
              onUpdate={(u: any) => { const n = [...itens]; n[idx] = u; setItens(n); }}
              onRemove={() => setItens(itens.filter((_, i) => i !== idx))}
              onMove={(d: any) => {
                const n = [...itens]; const t = d === 'cima' ? idx - 1 : idx + 1;
                if (t >= 0 && t < n.length) { [n[idx], n[t]] = [n[t], n[idx]]; setItens(n); }
              }}
              onCreate={async (n: string) => { 
                const { data }: any = await supabase.from('canticos').insert({ nome: n }).select().single(); 
                const novoCantico = { ...data, ultima_vez: null };
                setCanticos([...canticos, novoCantico]); 
                return novoCantico; 
              }}
            />
            
            {isLideranca && (
              <button
                onClick={() => adicionarItemEm(idx + 1)}
                className="w-full py-3 mt-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-700 transition-all font-bold text-sm flex items-center justify-center gap-2 group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
                <span>Adicionar item litúrgico</span>
              </button>
            )}
          </div>
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
          {cultos.map(c => {
            const cultoNr = c['Culto nr.'];
            const expandido = cultoExpandido === cultoNr;
            const liturgia = liturgiasCarregadas[cultoNr];
            
            return (
              <div key={cultoNr} className="bg-white border-2 border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div 
                  className="p-6 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpandirCulto(cultoNr)}
                >
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registro #{cultoNr}</p>
                    <h2 className="text-xl font-bold text-slate-800">
                      {new Date(c.Dia + 'T00:00:00').toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'long',
                        year: 'numeric'
                      })}
                    </h2>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); shareWhatsApp(c); }} 
                      className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl hover:bg-emerald-100 transition-colors" 
                      title="Compartilhar WhatsApp"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.559 4.189 1.619 6.011L0 24l6.117-1.605a11.847 11.847 0 005.925 1.586h.005c6.635 0 12.032-5.396 12.035-12.032a11.76 11.76 0 00-3.528-8.485" />
                      </svg>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); sharePDF(c); }} 
                      className="bg-slate-50 text-slate-600 p-4 rounded-2xl hover:bg-slate-100 transition-colors" 
                      title="Gerar PDF"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); iniciarEdicao(c); }} 
                      className="bg-slate-50 text-slate-800 p-4 rounded-2xl hover:bg-slate-100 transition-colors" 
                      title="Editar"
                    >
                      <span className="text-xl">✏️</span>
                    </button>
                    <span className={`text-2xl transition-transform ${expandido ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {expandido && liturgia && (
                  <LiturgiaView 
                    culto={c} 
                    itens={liturgia} 
                    canticos={canticos}
                    onClose={() => setCultoExpandido(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}