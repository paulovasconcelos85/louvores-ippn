'use client';

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
// Remove o componente EnderecoAutocomplete que está dentro do arquivo
// Adiciona no topo:
import EnderecoAutocomplete from '@/components/EnderecoAutocomplete';
import type { EnderecoGoogle } from '@/components/EnderecoAutocomplete';
import {
  User, Phone, MapPin, Heart, Church, BookOpen, Home,
  Briefcase, GraduationCap, Users, Check, ChevronRight,
  ChevronLeft, AlertCircle, Shield, Info, Search, X, UserCheck,
} from 'lucide-react';

type StatusMembro = 'ativo' | 'congregado' | 'visitante';
type OpcaoCongregado = 'batizado_outra' | 'transferencia_ipb' | 'interesse_batismo' | '';

const CURSOS = [
  { id: 'apostila_01', label: 'Apostila 01 — Conhecendo a Jesus' },
  { id: 'apostila_02', label: 'Apostila 02 — Conhecendo a Nova Vida' },
  { id: 'apostila_03', label: 'Apostila 03 — Conhecendo a Nossa Fé' },
];

const STATUS_OPTIONS = [
  {
    valor: 'ativo' as StatusMembro, emoji: '✝️', titulo: 'Membro Ativo',
    subtitulo: 'Já passei pelo batismo ou profissão de fé nesta igreja e estou em plena comunhão.',
    corBorda: 'border-emerald-600', corFundo: 'bg-emerald-50', corTexto: 'text-emerald-800', corPonto: 'bg-emerald-700',
  },
  {
    valor: 'congregado' as StatusMembro, emoji: '🤝', titulo: 'Congregado(a)',
    subtitulo: 'Frequento com regularidade e me sinto parte da comunidade, mas ainda não me oficializei como membro.',
    corBorda: 'border-blue-600', corFundo: 'bg-blue-50', corTexto: 'text-blue-800', corPonto: 'bg-blue-600',
  },
  {
    valor: 'visitante' as StatusMembro, emoji: '👋', titulo: 'Visitante',
    subtitulo: 'Estou conhecendo a igreja ou venho de forma esporádica. Quero que a liderança saiba da minha presença.',
    corBorda: 'border-amber-500', corFundo: 'bg-amber-50', corTexto: 'text-amber-800', corPonto: 'bg-amber-500',
  },
];

const inputCls = 'w-full px-4 py-3.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-colors text-slate-900 placeholder:text-slate-400 bg-white text-base';
const selectCls = 'w-full px-4 py-3.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-colors text-slate-900 bg-white text-base';
const textareaCls = 'w-full px-4 py-3.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-colors text-slate-900 placeholder:text-slate-400 bg-white resize-none text-base';

function CheckOption({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-all active:scale-[0.99] text-left ${checked ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-emerald-700 border-emerald-700' : 'border-slate-300 bg-white'}`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className={`text-sm font-medium leading-snug ${checked ? 'text-emerald-800' : 'text-slate-700'}`}>{children}</span>
    </button>
  );
}

export default function CadastroPublicoPage() {
  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [nomeEnviado, setNomeEnviado] = useState('');

  // Etapa 1
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [statusMembro, setStatusMembro] = useState<StatusMembro | ''>('');
  const [sexo, setSexo] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  // Etapa 2
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState<EnderecoGoogle>({ logradouro: '', bairro: '', cep: '', cidade: '', uf: '', latitude: null, longitude: null, google_place_id: null, endereco_completo: '' });
  const [complemento, setComplemento] = useState('');

  // Etapa 3
  const [nomePai, setNomePai] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [conjugeReligiao, setConjugeReligiao] = useState('');
  const [dataCasamento, setDataCasamento] = useState('');
  const [naturalidadeCidade, setNaturalidadeCidade] = useState('');
  const [naturalidadeUf, setNaturalidadeUf] = useState('');
  const [profissao, setProfissao] = useState('');
  const [escolaridade, setEscolaridade] = useState('');

  // Etapa 4
  const [interesseBatismo, setInteresseBatismo] = useState<boolean | null>(null);
  const [dataBatismo, setDataBatismo] = useState('');
  const [dataProfissaoFe, setDataProfissaoFe] = useState('');
  const [opcaoCongregado, setOpcaoCongregado] = useState<OpcaoCongregado>('');
  const [denominacaoAnterior, setDenominacaoAnterior] = useState('');
  const [grupoFamiliarNome, setGrupoFamiliarNome] = useState('');
  const [grupoFamiliarLider, setGrupoFamiliarLider] = useState('');
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);

  // Etapa 5
  const [situacaoSaude, setSituacaoSaude] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const ehVisitante = statusMembro === 'visitante';
  const etapasVisiveis = ehVisitante
    ? ['Identificação', 'Vida na Igreja']
    : ['Identificação', 'Contato', 'Família', 'Vida na Igreja', 'Cuidado Pastoral'];
  const etapaVisualIdx = ehVisitante ? (etapa === 1 ? 0 : 1) : etapa - 1;
  const isUltima = ehVisitante ? etapa === 4 : etapa === 5;
  const scroll = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const avancar = () => {
    setErro('');
    if (etapa === 1) {
      if (!nome.trim()) { setErro('Preencha seu nome completo.'); return; }
      if (!telefone || unformatPhoneNumber(telefone).length < 10) { setErro('Preencha um telefone válido com DDD.'); return; }
      if (!statusMembro) { setErro('Selecione como você frequenta a IPPN.'); return; }
      if (ehVisitante) { setEtapa(4); scroll(); return; }
    }
    setEtapa(e => e + 1); scroll();
  };

  const voltar = () => {
    setErro('');
    if (etapa === 4 && ehVisitante) { setEtapa(1); scroll(); return; }
    setEtapa(e => e - 1); scroll();
  };

  const toggleCurso = (id: string) =>
    setCursosSelecionados(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const salvar = async () => {
    setSalvando(true); setErro('');
    try {
      const fone = unformatPhoneNumber(telefone);
      const batizado = statusMembro === 'ativo' || opcaoCongregado === 'batizado_outra' || opcaoCongregado === 'transferencia_ipb';
      const payload: Record<string, any> = {
        nome: nome.trim(), telefone: fone, sexo: sexo || null, status_membro: statusMembro,
        data_nascimento: dataNascimento || null, email: email.trim() || null,
        logradouro: endereco.logradouro || null, bairro: endereco.bairro || null,
        cep: endereco.cep || null, cidade: endereco.cidade || 'Manaus', uf: endereco.uf || 'AM',
        latitude: endereco.latitude, longitude: endereco.longitude, google_place_id: endereco.google_place_id,
        endereco_completo: complemento ? `${endereco.endereco_completo}, ${complemento}` : endereco.endereco_completo || null,
        nome_pai: nomePai.trim() || null, nome_mae: nomeMae.trim() || null,
        estado_civil: estadoCivil || null, conjuge_nome: conjugeNome.trim() || null,
        conjuge_religiao: conjugeReligiao.trim() || null, data_casamento: dataCasamento || null,
        naturalidade_cidade: naturalidadeCidade.trim() || null, naturalidade_uf: naturalidadeUf || null,
        profissao: profissao.trim() || null, escolaridade: escolaridade || null,
        batizado, data_batismo: dataBatismo || null, data_profissao_fe: dataProfissaoFe || null,
        transferido_ipb: opcaoCongregado === 'transferencia_ipb',
        transferido_outra_denominacao: denominacaoAnterior.trim() || null,
        cursos_discipulado: cursosSelecionados.length > 0 ? cursosSelecionados : null,
        grupo_familiar_nome: grupoFamiliarNome.trim() || null,
        grupo_familiar_lider: grupoFamiliarLider.trim() || null,
        situacao_saude: situacaoSaude.trim() || null, observacoes: observacoes.trim() || null,
        ativo: true, cargo: 'membro', atualizado_em: new Date().toISOString(),
      };
      let existente: { id: string } | null = null;
      const { data: porTel } = await supabase.from('pessoas').select('id').eq('telefone', fone).maybeSingle();
      if (porTel) existente = porTel;
      if (!existente) {
        const { data: porNome } = await supabase.from('pessoas').select('id').ilike('nome', nome.trim()).maybeSingle();
        if (porNome) existente = porNome;
      }
      console.log('Payload:', JSON.stringify(payload, null, 2));

      if (existente) {
        const { error } = await supabase.from('pessoas').update(payload).eq('id', existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pessoas').insert(payload);
        if (error) throw error;
      }
      setNomeEnviado(nome.trim().split(' ')[0]); setSucesso(true); scroll();
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505' && err.message?.includes('telefone'))
        setErro('Este telefone já está cadastrado. Fale com a liderança para atualizá-lo.');
      else if (err.code === '23505')
        setErro('Já existe um cadastro com este e-mail. Tente com outro ou deixe em branco.');
      else setErro('Ocorreu um erro ao enviar. Tente novamente em instantes.');
    } finally { setSalvando(false); }
  };

  if (sucesso) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check className="w-10 h-10 text-emerald-700" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Obrigado, {nomeEnviado}! 🙏</h2>
        <p className="text-slate-600 leading-relaxed mb-5">
          Seus dados foram recebidos com sucesso.<br />Que o Senhor abençoe você e sua família!
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left">
          <p className="text-sm text-emerald-900 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-700" />
            Suas informações são sigilosas e acessadas apenas pela liderança pastoral da IPPN.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-emerald-900 shadow-md">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Church className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Igreja Presbiteriana Ponta Negra</h1>
            <p className="text-xs text-emerald-300">Formulário de Cadastro</p>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {etapa === 1 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-900 leading-relaxed">
              👋 <strong>Olá!</strong> Preencha seus dados para que nossa liderança possa cuidar melhor de você. Leva apenas alguns minutos.
            </p>
          </div>
        )}

        {/* Progresso */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            {etapasVisiveis.map((t, i) => (
              <div key={t} className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${i < etapaVisualIdx ? 'bg-emerald-700 text-white' : i === etapaVisualIdx ? 'bg-emerald-700 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                  {i < etapaVisualIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < etapasVisiveis.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded-full transition-all ${i < etapaVisualIdx ? 'bg-emerald-700' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            <strong className="text-slate-700">{etapasVisiveis[etapaVisualIdx]}</strong>{' '}· Etapa {etapaVisualIdx + 1} de {etapasVisiveis.length}
          </p>
        </div>

        {erro && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{erro}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header verde */}
          <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                {etapa === 1 && <User className="w-5 h-5" />}
                {etapa === 2 && <MapPin className="w-5 h-5" />}
                {etapa === 3 && <Users className="w-5 h-5" />}
                {etapa === 4 && <Church className="w-5 h-5" />}
                {etapa === 5 && <Heart className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-emerald-300 text-xs">
                  {etapa === 1 && 'Nome, telefone e vínculo'}
                  {etapa === 2 && 'Email e localização'}
                  {etapa === 3 && 'Filiação, cônjuge e origem'}
                  {etapa === 4 && (ehVisitante ? 'Próximos passos na fé' : 'Batismo, grupo e discipulado')}
                  {etapa === 5 && 'Saúde e observações pastorais'}
                </p>
                <h2 className="text-white text-xl font-bold">{etapasVisiveis[etapaVisualIdx]}</h2>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">

            {/* ══ ETAPA 1 ══ */}
            {etapa === 1 && (<>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome completo <span className="text-red-500">*</span></label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" autoFocus className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">📱 Telefone / WhatsApp <span className="text-red-500">*</span></label>
                <input type="tel" value={telefone} onChange={e => setTelefone(formatPhoneNumber(e.target.value))} placeholder="(92) 99999-9999" className={inputCls} />
                <p className="mt-1.5 text-xs text-slate-400">Usado para contato pela liderança. Não compartilhamos com terceiros.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Como você frequenta a IPPN? <span className="text-red-500">*</span></label>
                <p className="text-xs text-slate-400 mb-3">Isso ajuda a liderança a saber como cuidar de você da melhor forma.</p>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(op => (
                    <button key={op.valor} type="button" onClick={() => setStatusMembro(op.valor)}
                      className={`w-full text-left rounded-xl border-2 px-4 py-4 transition-all active:scale-[0.99] ${statusMembro === op.valor ? `${op.corBorda} ${op.corFundo}` : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{op.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${statusMembro === op.valor ? op.corTexto : 'text-slate-800'}`}>{op.titulo}</p>
                          <p className={`text-xs mt-0.5 leading-snug ${statusMembro === op.valor ? op.corTexto : 'text-slate-500'}`}>{op.subtitulo}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${statusMembro === op.valor ? `${op.corBorda} ${op.corFundo}` : 'border-slate-300'}`}>
                          {statusMembro === op.valor && <div className={`w-2.5 h-2.5 rounded-full ${op.corPonto}`} />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {statusMembro && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Dados adicionais</p>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Sexo</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: '', l: 'Não informar' }, { v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }].map(op => (
                        <button key={op.v} type="button" onClick={() => setSexo(op.v)}
                          className={`py-3 rounded-lg border-2 text-xs font-semibold transition-all ${sexo === op.v ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                          {op.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">🎂 Data de Nascimento</label>
                    <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
            </>)}

            {/* ══ ETAPA 2 ══ */}
            {etapa === 2 && (<>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">✉️ Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Endereço
                </label>
                <p className="text-xs text-slate-400 mb-3">Digite e selecione na lista. Usamos para localizar sua residência no mapa da liderança.</p>
                <EnderecoAutocomplete onSelect={setEndereco} />
                {endereco.google_place_id && (
                  <div className="mt-3">
                    <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Complemento: apto, bloco, referência..." className={inputCls} />
                  </div>
                )}
              </div>
            </>)}

            {/* ══ ETAPA 3 ══ */}
            {etapa === 3 && (<>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Pai</label>
                  <input type="text" value={nomePai} onChange={e => setNomePai(e.target.value)} placeholder="Nome completo do pai" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nome da Mãe</label>
                  <input type="text" value={nomeMae} onChange={e => setNomeMae(e.target.value)} placeholder="Nome completo da mãe" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Estado Civil</label>
                <div className="space-y-2">
                  {[{ v: '', l: 'Prefiro não informar' }, { v: 'solteiro', l: 'Solteiro(a)' }, { v: 'casado', l: '💍 Casado(a)' }, { v: 'divorciado', l: 'Divorciado(a)' }, { v: 'viuvo', l: 'Viúvo(a)' }, { v: 'uniao_estavel', l: 'União Estável' }].map(op => (
                    <button key={op.v} type="button" onClick={() => setEstadoCivil(op.v)}
                      className={`w-full text-left py-3.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${estadoCivil === op.v ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </div>
              {['casado', 'uniao_estavel'].includes(estadoCivil) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-800">Dados do(a) Cônjuge</p>
                  <input type="text" value={conjugeNome} onChange={e => setConjugeNome(e.target.value)} placeholder="Nome do(a) cônjuge" className={inputCls} />
                  <input type="text" value={conjugeReligiao} onChange={e => setConjugeReligiao(e.target.value)} placeholder="Religião do(a) cônjuge" className={inputCls} />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Data do casamento</label>
                    <input type="date" value={dataCasamento} onChange={e => setDataCasamento(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Naturalidade</label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <input type="text" value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)} placeholder="Cidade natal" className={inputCls} />
                  </div>
                  <input type="text" maxLength={2} value={naturalidadeUf} onChange={e => setNaturalidadeUf(e.target.value.toUpperCase())} placeholder="UF" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> Profissão</label>
                <input type="text" value={profissao} onChange={e => setProfissao(e.target.value)} placeholder="Ex: Professor, Engenheiro..." className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><GraduationCap className="w-4 h-4" /> Escolaridade</label>
                <select value={escolaridade} onChange={e => setEscolaridade(e.target.value)} className={selectCls}>
                  <option value="">Não informada</option>
                  <option value="fundamental_incompleto">Fund. Incompleto</option>
                  <option value="fundamental_completo">Fund. Completo</option>
                  <option value="medio_incompleto">Médio Incompleto</option>
                  <option value="medio_completo">Médio Completo</option>
                  <option value="superior_incompleto">Superior Incompleto</option>
                  <option value="superior_completo">Superior Completo</option>
                  <option value="pos_graduacao">Pós-Graduação</option>
                  <option value="mestrado">Mestrado</option>
                  <option value="doutorado">Doutorado</option>
                </select>
              </div>
            </>)}

            {/* ══ ETAPA 4 ══ */}
            {etapa === 4 && (<>

              {/* VISITANTE */}
              {statusMembro === 'visitante' && (<>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-900">👋 Ficamos felizes com sua presença! Gostaríamos de saber um pouco mais sobre seus próximos passos.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Você tem interesse em se batizar e fazer profissão de fé?</label>
                  <p className="text-xs text-slate-400 mb-3">Sem compromisso — apenas queremos entender como podemos te ajudar.</p>
                  <div className="space-y-2">
                    <CheckOption checked={interesseBatismo === true} onChange={() => setInteresseBatismo(true)}>
                      ✅  Sim, tenho interesse em me batizar / fazer profissão de fé
                    </CheckOption>
                    <CheckOption checked={interesseBatismo === false} onChange={() => setInteresseBatismo(false)}>
                      🙏  Não no momento, mas quero continuar frequentando
                    </CheckOption>
                  </div>
                </div>
              </>)}

              {/* MEMBRO ATIVO */}
              {statusMembro === 'ativo' && (<>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-sm text-emerald-900 flex items-start gap-2">
                    <UserCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-700" />
                    Como membro ativo, você já foi batizado(a). Preencha as datas para completarmos seu cadastro.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">✝️ Data do Batismo</label>
                  <input type="date" value={dataBatismo} onChange={e => setDataBatismo(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">🙏 Data de Profissão de Fé</label>
                  <input type="date" value={dataProfissaoFe} onChange={e => setDataProfissaoFe(e.target.value)} className={inputCls} />
                </div>
              </>)}

              {/* CONGREGADO */}
              {statusMembro === 'congregado' && (<>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                    Selecione a opção que melhor descreve sua situação. Isso ajuda a liderança a saber como te acompanhar.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Qual é sua situação eclesiástica?</label>
                  <div className="space-y-2">
                    {([
                      { v: 'batizado_outra' as OpcaoCongregado, titulo: '✝️  Fui batizado(a) em outra denominação', sub: 'Tenho batismo válido, mas ainda não transferi minha carta.' },
                      { v: 'transferencia_ipb' as OpcaoCongregado, titulo: '📋  Quero transferência de outra Igreja Presbiteriana', sub: 'Sou membro de outra IPB e quero transferir minha carta para a IPPN.' },
                      { v: 'interesse_batismo' as OpcaoCongregado, titulo: '🌱  Tenho interesse em me batizar', sub: 'Ainda não fui batizado(a) e gostaria de dar esse passo.' },
                    ]).map(op => (
                      <button key={op.v} type="button" onClick={() => setOpcaoCongregado(op.v)}
                        className={`w-full text-left rounded-xl border-2 px-4 py-4 transition-all active:scale-[0.99] ${opcaoCongregado === op.v ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className={`text-sm font-bold ${opcaoCongregado === op.v ? 'text-blue-800' : 'text-slate-800'}`}>{op.titulo}</p>
                            <p className={`text-xs mt-0.5 leading-snug ${opcaoCongregado === op.v ? 'text-blue-700' : 'text-slate-500'}`}>{op.sub}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${opcaoCongregado === op.v ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}>
                            {opcaoCongregado === op.v && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {(opcaoCongregado === 'batizado_outra' || opcaoCongregado === 'transferencia_ipb') && (<>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {opcaoCongregado === 'transferencia_ipb' ? 'Nome da Igreja Presbiteriana de origem' : 'Nome da denominação anterior'}
                    </label>
                    <input type="text" value={denominacaoAnterior} onChange={e => setDenominacaoAnterior(e.target.value)}
                      placeholder={opcaoCongregado === 'transferencia_ipb' ? 'Ex: IPB Flores, Manaus' : 'Ex: Assembleia de Deus'} className={inputCls} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">✝️ Data do Batismo</label>
                      <input type="date" value={dataBatismo} onChange={e => setDataBatismo(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">🙏 Data de Profissão de Fé</label>
                      <input type="date" value={dataProfissaoFe} onChange={e => setDataProfissaoFe(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </>)}
              </>)}

              {/* Grupo + Cursos (compartilhado) */}
              <div className="pt-4 border-t border-slate-100 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Home className="w-4 h-4" /> Grupo Familiar</label>
                  <div className="space-y-3">
                    <input type="text" value={grupoFamiliarNome} onChange={e => setGrupoFamiliarNome(e.target.value)} placeholder="Nome do grupo" className={inputCls} />
                    <input type="text" value={grupoFamiliarLider} onChange={e => setGrupoFamiliarLider(e.target.value)} placeholder="Nome do líder" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Cursos de Discipulado concluídos</label>
                  <p className="text-xs text-slate-400 mb-3">Marque os que você já fez.</p>
                  <div className="space-y-2">
                    {CURSOS.map(c => (
                      <CheckOption key={c.id} checked={cursosSelecionados.includes(c.id)} onChange={() => toggleCurso(c.id)}>
                        {c.label}
                      </CheckOption>
                    ))}
                  </div>
                </div>
              </div>
            </>)}

            {/* ══ ETAPA 5 ══ */}
            {etapa === 5 && (<>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Informações confidenciais</p>
                    <p className="text-xs text-amber-800 leading-relaxed">Esta seção é <strong>opcional</strong>. Os dados são sigilosos e acessados apenas pelo pastor e equipe pastoral.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">❤️ Situação de Saúde</label>
                <p className="text-xs text-slate-400 mb-2">Condições relevantes para o cuidado pastoral</p>
                <textarea value={situacaoSaude} onChange={e => setSituacaoSaude(e.target.value)} placeholder="Ex: hipertensão, dificuldade de locomoção..." rows={3} className={textareaCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">💬 Observações</label>
                <p className="text-xs text-slate-400 mb-2">Situação familiar ou qualquer coisa que queira compartilhar com a liderança</p>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Escreva o que quiser que a liderança saiba..." rows={4} className={textareaCls} />
              </div>
            </>)}
          </div>

          {/* Navegação */}
          <div className="px-5 pb-5 flex gap-3">
            {etapa > 1 && (
              <button type="button" onClick={voltar} className="flex items-center gap-2 px-5 py-3.5 border-2 border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            )}
            {!isUltima ? (
              <button type="button" onClick={avancar} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm text-base">
                Continuar <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button type="button" onClick={salvar} disabled={salvando} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm disabled:opacity-50 text-base">
                {salvando ? <><span className="animate-spin inline-block w-5 h-5 border-b-2 border-white rounded-full" /> Enviando...</> : <><Check className="w-5 h-5" /> Enviar Cadastro</>}
              </button>
            )}
          </div>
        </div>

        {/* Mini resumo */}
        {nome && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Resumo</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-emerald-700">{nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">{nome}</span>
              {telefone && <span className="text-xs text-slate-400">· {telefone}</span>}
              {statusMembro && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMembro === 'ativo' ? 'bg-emerald-100 text-emerald-700' : statusMembro === 'congregado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {STATUS_OPTIONS.find(s => s.valor === statusMembro)?.titulo}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-6 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Dados protegidos · Uso exclusivo para fins pastorais
        </p>
      </div>
    </div>
  );
}