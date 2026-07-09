'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from '@/i18n/provider';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
import EnderecoAutocomplete, { EnderecoGoogle } from '@/components/EnderecoAutocomplete';
import {
  User, MapPin, Users, Check, AlertCircle, Plus, X, Heart, Loader2, Church, ClipboardList,
} from 'lucide-react';

type FilhoExistente = {
  id: string;
  nome: string;
  sexo: string;
  data_nascimento: string;
  naturalidade_cidade: string;
  naturalidade_uf: string;
  escolaridade: string;
};

type FilhoNovo = {
  key: string;
  nome: string;
  sexo: string;
  data_nascimento: string;
};

const ESCOLARIDADES = [
  'fundamental_incompleto', 'fundamental_completo', 'medio_incompleto',
  'medio_completo', 'superior_incompleto', 'superior_completo',
  'pos_graduacao', 'mestrado', 'doutorado',
];

export default function CompletarCadastroPage() {
  const params = useParams();
  const token = (params?.token as string) || '';
  const locale = useLocale();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );

  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [igrejaNome, setIgrejaNome] = useState('');
  const [faltandoInicial, setFaltandoInicial] = useState<string[]>([]);

  // Dados pessoais
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [sexo, setSexo] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [profissao, setProfissao] = useState('');
  const [escolaridade, setEscolaridade] = useState('');
  const [nomePai, setNomePai] = useState('');
  const [nomeMae, setNomeMae] = useState('');
  const [conjugeNome, setConjugeNome] = useState('');
  const [dataCasamento, setDataCasamento] = useState('');
  const [naturalidadeCidade, setNaturalidadeCidade] = useState('');
  const [naturalidadeUf, setNaturalidadeUf] = useState('');
  const [nacionalidade, setNacionalidade] = useState('Brasileira');
  const [paisOrigem, setPaisOrigem] = useState('');
  const [conjugeReligiao, setConjugeReligiao] = useState('');
  const [atividadeAtual, setAtividadeAtual] = useState('');
  const [uniaoEstavelTempo, setUniaoEstavelTempo] = useState('');

  // Ficha de Candidato à Membresia
  const [igrejaSedeCongregacao, setIgrejaSedeCongregacao] = useState('');
  const [congregacaoNome, setCongregacaoNome] = useState('');
  const [tipoTransferencia, setTipoTransferencia] = useState<'nenhuma' | 'ipb' | 'outra' | 'jurisdicao'>('nenhuma');
  const [transferenciaQual, setTransferenciaQual] = useState('');
  const [transferenciaObservacao, setTransferenciaObservacao] = useState('');
  const [propositoEntrevista, setPropositoEntrevista] = useState('');

  // Endereço
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [enderecoCompleto, setEnderecoCompleto] = useState('');

  // Filhos
  const [filhos, setFilhos] = useState<FilhoExistente[]>([]);
  const [novosFilhos, setNovosFilhos] = useState<FilhoNovo[]>([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/completar-cadastro?token=${encodeURIComponent(token)}`);
        const payload = await res.json();
        if (cancelado) return;
        if (!res.ok) {
          setErroCarga(payload?.error || tr('Não foi possível carregar.', 'No se pudo cargar.', 'Could not load.'));
          return;
        }
        const p = payload.pessoa;
        setNome(p.nome || '');
        setApelido(p.apelido || '');
        setTelefone(p.telefone ? formatPhoneNumber(p.telefone) : '');
        setEmail(p.email || '');
        setDataNascimento(p.data_nascimento || '');
        setSexo(p.sexo || '');
        setEstadoCivil(p.estado_civil || '');
        setProfissao(p.profissao || '');
        setEscolaridade(p.escolaridade || '');
        setNomePai(p.nome_pai || '');
        setNomeMae(p.nome_mae || '');
        setConjugeNome(p.conjuge_nome || '');
        setDataCasamento(p.data_casamento || '');
        setNaturalidadeCidade(p.naturalidade_cidade || '');
        setNaturalidadeUf(p.naturalidade_uf || '');
        setNacionalidade(p.nacionalidade || 'Brasileira');
        setPaisOrigem(p.pais_origem || '');
        setConjugeReligiao(p.conjuge_religiao || '');
        setAtividadeAtual(p.atividade_atual || '');
        setUniaoEstavelTempo(p.uniao_estavel_tempo || '');
        setIgrejaSedeCongregacao(p.igreja_sede_congregacao || '');
        setCongregacaoNome(p.congregacao_nome || '');
        setTransferenciaObservacao(p.transferencia_observacao || '');
        setPropositoEntrevista(p.proposito_entrevista || '');
        if (p.transferido_ipb) {
          setTipoTransferencia('ipb');
          setTransferenciaQual(p.transferencia_ipb_origem || '');
        } else if (p.transferido_outra_denominacao) {
          setTipoTransferencia('outra');
          setTransferenciaQual(p.transferido_outra_denominacao || '');
        } else if (p.transferencia_jurisdicao_sem_carta) {
          setTipoTransferencia('jurisdicao');
          setTransferenciaQual(p.transferencia_jurisdicao_sem_carta || '');
        } else {
          setTipoTransferencia('nenhuma');
          setTransferenciaQual('');
        }
        setLogradouro(p.logradouro || '');
        setBairro(p.bairro || '');
        setCep(p.cep || '');
        setCidade(p.cidade || '');
        setUf(p.uf || '');
        setLatitude(p.latitude ?? null);
        setLongitude(p.longitude ?? null);
        setGooglePlaceId(p.google_place_id ?? null);
        setEnderecoCompleto(p.endereco_completo || '');
        setFaltandoInicial(p.faltando || []);
        setIgrejaNome(payload.igreja?.nome_abreviado || payload.igreja?.nome || '');
        setFilhos(
          (payload.filhos || []).map((f: any) => ({
            id: f.id,
            nome: f.nome || '',
            sexo: f.sexo || '',
            data_nascimento: f.data_nascimento || '',
            naturalidade_cidade: f.naturalidade_cidade || '',
            naturalidade_uf: f.naturalidade_uf || '',
            escolaridade: f.escolaridade || '',
          }))
        );
      } catch {
        if (!cancelado) setErroCarga(tr('Erro de conexão.', 'Error de conexión.', 'Connection error.'));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, tr]);

  const aplicarEndereco = (e: EnderecoGoogle) => {
    setLogradouro(e.logradouro || '');
    setBairro(e.bairro || '');
    setCep(e.cep || '');
    setCidade(e.cidade || '');
    setUf(e.uf || '');
    setLatitude(e.latitude);
    setLongitude(e.longitude);
    setGooglePlaceId(e.google_place_id);
    setEnderecoCompleto(e.endereco_completo || '');
  };

  const atualizarFilho = (id: string, campo: keyof FilhoExistente, valor: string) =>
    setFilhos(prev => prev.map(f => (f.id === id ? { ...f, [campo]: valor } : f)));

  const atualizarNovoFilho = (key: string, campo: keyof FilhoNovo, valor: string) =>
    setNovosFilhos(prev => prev.map(f => (f.key === key ? { ...f, [campo]: valor } : f)));

  const adicionarFilho = () =>
    setNovosFilhos(prev => [...prev, { key: Math.random().toString(36).slice(2), nome: '', sexo: '', data_nascimento: '' }]);

  const removerNovoFilho = (key: string) =>
    setNovosFilhos(prev => prev.filter(f => f.key !== key));

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      if (!nome.trim()) {
        setErro(tr('Informe seu nome completo.', 'Indica tu nombre completo.', 'Enter your full name.'));
        setSalvando(false);
        return;
      }
      const body = {
        token,
        pessoa: {
          nome: nome.trim(),
          apelido: apelido.trim() || null,
          telefone: telefone ? unformatPhoneNumber(telefone) : null,
          email: email.trim().toLowerCase() || null,
          data_nascimento: dataNascimento || null,
          sexo: sexo || null,
          estado_civil: estadoCivil || null,
          profissao: profissao.trim() || null,
          escolaridade: escolaridade || null,
          nome_pai: nomePai.trim() || null,
          nome_mae: nomeMae.trim() || null,
          conjuge_nome: conjugeNome.trim() || null,
          data_casamento: dataCasamento || null,
          naturalidade_cidade: naturalidadeCidade.trim() || null,
          naturalidade_uf: naturalidadeUf.trim() || null,
          nacionalidade: nacionalidade.trim() || null,
          pais_origem: nacionalidade === 'Estrangeira' ? (paisOrigem.trim() || null) : null,
          conjuge_religiao: conjugeReligiao.trim() || null,
          atividade_atual: atividadeAtual.trim() || null,
          uniao_estavel_tempo: estadoCivil === 'uniao_estavel' ? (uniaoEstavelTempo.trim() || null) : null,
          igreja_sede_congregacao: igrejaSedeCongregacao || null,
          congregacao_nome: igrejaSedeCongregacao !== 'sede' ? (congregacaoNome.trim() || null) : null,
          transferido_ipb: tipoTransferencia === 'ipb',
          transferencia_ipb_origem: tipoTransferencia === 'ipb' ? (transferenciaQual.trim() || null) : null,
          transferido_outra_denominacao: tipoTransferencia === 'outra' ? (transferenciaQual.trim() || null) : null,
          transferencia_jurisdicao_sem_carta: tipoTransferencia === 'jurisdicao' ? (transferenciaQual.trim() || null) : null,
          transferencia_observacao: tipoTransferencia !== 'nenhuma' ? (transferenciaObservacao.trim() || null) : null,
          proposito_entrevista: propositoEntrevista || null,
          logradouro: logradouro.trim() || null,
          bairro: bairro.trim() || null,
          cep: cep.replace(/\D/g, '') || null,
          cidade: cidade.trim() || null,
          uf: uf.trim() || null,
          latitude,
          longitude,
          google_place_id: googlePlaceId,
          endereco_completo: enderecoCompleto || null,
        },
        filhos: filhos.map(f => ({
          id: f.id,
          nome: f.nome.trim(),
          sexo: f.sexo || null,
          data_nascimento: f.data_nascimento || null,
          naturalidade_cidade: f.naturalidade_cidade.trim() || null,
          naturalidade_uf: f.naturalidade_uf.trim() || null,
          escolaridade: f.escolaridade || null,
        })),
        novosFilhos: novosFilhos
          .filter(f => f.nome.trim())
          .map(f => ({ nome: f.nome.trim(), sexo: f.sexo || null, data_nascimento: f.data_nascimento || null })),
      };

      const res = await fetch('/api/completar-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setErro(payload?.error || tr('Erro ao salvar.', 'Error al guardar.', 'Error saving.'));
        return;
      }
      setSucesso(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErro(tr('Erro de conexão.', 'Error de conexión.', 'Connection error.'));
    } finally {
      setSalvando(false);
    }
  };

  const escolaridadeLabel = (v: string) =>
    ({
      fundamental_incompleto: tr('Fundamental incompleto', 'Primaria incompleta', 'Elementary incomplete'),
      fundamental_completo: tr('Fundamental completo', 'Primaria completa', 'Elementary complete'),
      medio_incompleto: tr('Médio incompleto', 'Secundaria incompleta', 'High school incomplete'),
      medio_completo: tr('Médio completo', 'Secundaria completa', 'High school complete'),
      superior_incompleto: tr('Superior incompleto', 'Universidad incompleta', 'College incomplete'),
      superior_completo: tr('Superior completo', 'Universidad completa', 'College complete'),
      pos_graduacao: tr('Pós-graduação', 'Posgrado', 'Postgraduate'),
      mestrado: tr('Mestrado', 'Maestría', "Master's"),
      doutorado: tr('Doutorado', 'Doctorado', 'Doctorate'),
    }[v] || v);

  const inputCls = 'w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 bg-white';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 mx-auto animate-spin" />
          <p className="mt-3 text-slate-600">{tr('Carregando seus dados...', 'Cargando tus datos...', 'Loading your data...')}</p>
        </div>
      </div>
    );
  }

  if (erroCarga) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-900 mb-1">{tr('Link indisponível', 'Enlace no disponible', 'Link unavailable')}</p>
          <p className="text-slate-600">{erroCarga}</p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-9 h-9 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{tr('Tudo certo!', '¡Todo listo!', 'All set!')}</h1>
          <p className="text-slate-600">
            {tr(
              'Seus dados foram atualizados. Muito obrigado por colaborar! 🙏',
              '¡Tus datos fueron actualizados. Muchas gracias por colaborar! 🙏',
              'Your data has been updated. Thank you so much! 🙏'
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {tr('Olá', 'Hola', 'Hi')}{nome ? `, ${nome.split(' ')[0]}` : ''}! 🙏
          </h1>
          <p className="text-slate-600 mt-2">
            {tr(
              `${igrejaNome ? `A ${igrejaNome} está` : 'Estamos'} atualizando os cadastros. Quando puder, confira e complete seus dados — e os dos seus filhos, se for o caso. Leva pouquinho!`,
              `${igrejaNome ? `${igrejaNome} está` : 'Estamos'} actualizando los registros. Cuando puedas, revisa y completa tus datos — y los de tus hijos, si aplica. ¡Toma poco tiempo!`,
              `${igrejaNome ? `${igrejaNome} is` : "We're"} updating our records. When you can, please review and complete your data — and your children's, if applicable. It only takes a moment!`
            )}
          </p>
        </div>

        {faltandoInicial.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">{tr('Faltam alguns dados:', 'Faltan algunos datos:', 'Some data is missing:')}</p>
              <p className="text-sm text-amber-800">{faltandoInicial.join(', ')}</p>
            </div>
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">{erro}</div>
        )}

        {/* Dados pessoais */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <User className="w-5 h-5 text-blue-600" /> {tr('Seus dados', 'Tus datos', 'Your data')}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{tr('Nome completo', 'Nombre completo', 'Full name')} *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Apelido', 'Apodo', 'Nickname')}</label>
              <input value={apelido} onChange={e => setApelido(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Telefone', 'Teléfono', 'Phone')}</label>
              <input value={telefone} onChange={e => setTelefone(formatPhoneNumber(e.target.value))} className={inputCls} inputMode="tel" />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} inputMode="email" />
            </div>
            <div>
              <label className={labelCls}>{tr('Data de nascimento', 'Fecha de nacimiento', 'Birth date')}</label>
              <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Sexo', 'Sexo', 'Sex')}</label>
              <select value={sexo} onChange={e => setSexo(e.target.value)} className={inputCls}>
                <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                <option value="M">{tr('Masculino', 'Masculino', 'Male')}</option>
                <option value="F">{tr('Feminino', 'Femenino', 'Female')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{tr('Estado civil', 'Estado civil', 'Marital status')}</label>
              <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className={inputCls}>
                <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                <option value="solteiro">{tr('Solteiro(a)', 'Soltero(a)', 'Single')}</option>
                <option value="casado">{tr('Casado(a)', 'Casado(a)', 'Married')}</option>
                <option value="divorciado">{tr('Divorciado(a)', 'Divorciado(a)', 'Divorced')}</option>
                <option value="viuvo">{tr('Viúvo(a)', 'Viudo(a)', 'Widowed')}</option>
                <option value="uniao_estavel">{tr('União estável', 'Unión estable', 'Civil union')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{tr('Profissão', 'Profesión', 'Profession')}</label>
              <input value={profissao} onChange={e => setProfissao(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Atividade atual', 'Actividad actual', 'Current activity')}</label>
              <input value={atividadeAtual} onChange={e => setAtividadeAtual(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Escolaridade', 'Escolaridad', 'Education')}</label>
              <select value={escolaridade} onChange={e => setEscolaridade(e.target.value)} className={inputCls}>
                <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                {ESCOLARIDADES.map(v => <option key={v} value={v}>{escolaridadeLabel(v)}</option>)}
              </select>
            </div>
            {(estadoCivil === 'casado' || estadoCivil === 'uniao_estavel') && (
              <>
                <div>
                  <label className={labelCls}>{tr('Nome do cônjuge', 'Nombre del cónyuge', 'Spouse name')}</label>
                  <input value={conjugeNome} onChange={e => setConjugeNome(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr('Religião do cônjuge', 'Religión del cónyuge', "Spouse's religion")}</label>
                  <input value={conjugeReligiao} onChange={e => setConjugeReligiao(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr('Data de casamento', 'Fecha de matrimonio', 'Marriage date')}</label>
                  <input type="date" value={dataCasamento} onChange={e => setDataCasamento(e.target.value)} className={inputCls} />
                </div>
              </>
            )}
            {estadoCivil === 'uniao_estavel' && (
              <div>
                <label className={labelCls}>{tr('União estável há quanto tempo?', '¿Hace cuánto tiempo?', 'How long?')}</label>
                <input value={uniaoEstavelTempo} onChange={e => setUniaoEstavelTempo(e.target.value)} className={inputCls} placeholder={tr('Ex.: 3 anos', 'Ej.: 3 años', 'E.g.: 3 years')} />
              </div>
            )}
            <div>
              <label className={labelCls}>{tr('Nome do pai', 'Nombre del padre', "Father's name")}</label>
              <input value={nomePai} onChange={e => setNomePai(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Nome da mãe', 'Nombre de la madre', "Mother's name")}</label>
              <input value={nomeMae} onChange={e => setNomeMae(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Naturalidade (cidade)', 'Ciudad de nacimiento', 'Birth city')}</label>
              <input value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Naturalidade (UF)', 'Provincia/estado', 'State')}</label>
              <input value={naturalidadeUf} onChange={e => setNaturalidadeUf(e.target.value)} maxLength={2} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Nacionalidade', 'Nacionalidad', 'Nationality')}</label>
              <div className="flex gap-2">
                {(['Brasileira', 'Estrangeira'] as const).map(opcao => (
                  <button
                    key={opcao}
                    type="button"
                    onClick={() => setNacionalidade(opcao)}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      nacionalidade === opcao
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opcao === 'Brasileira' ? tr('Brasileira', 'Brasileña', 'Brazilian') : tr('Estrangeira', 'Extranjera', 'Foreign')}
                  </button>
                ))}
              </div>
            </div>
            {nacionalidade === 'Estrangeira' && (
              <div>
                <label className={labelCls}>{tr('País de origem', 'País de origen', 'Country of origin')}</label>
                <input value={paisOrigem} onChange={e => setPaisOrigem(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
        </section>

        {/* Igreja / Congregação e transferência */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Church className="w-5 h-5 text-blue-600" /> {tr('Igreja e transferência', 'Iglesia y transferencia', 'Church and transfer')}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{tr('Onde você congrega?', '¿Dónde congrega?', 'Where do you attend?')}</label>
              <select value={igrejaSedeCongregacao} onChange={e => setIgrejaSedeCongregacao(e.target.value)} className={inputCls}>
                <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                <option value="sede">{tr('Igreja Sede (Central ou Pedras Vivas)', 'Iglesia Sede (Central o Pedras Vivas)', 'Main Church (Central or Pedras Vivas)')}</option>
                <option value="congregacao_manaus">{tr('Congregação em Manaus', 'Congregación en Manaus', 'Congregation in Manaus')}</option>
                <option value="congregacao_interior">{tr('Congregação no Interior', 'Congregación en el interior', 'Congregation in the countryside')}</option>
              </select>
            </div>
            {igrejaSedeCongregacao && igrejaSedeCongregacao !== 'sede' && (
              <div>
                <label className={labelCls}>{tr('Qual congregação?', '¿Cuál congregación?', 'Which congregation?')}</label>
                <input value={congregacaoNome} onChange={e => setCongregacaoNome(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className={labelCls}>{tr('Você está vindo por transferência de outra igreja?', '¿Viene por transferencia de otra iglesia?', 'Are you coming by transfer from another church?')}</label>
            <div className="grid sm:grid-cols-2 gap-2 mt-1">
              {([
                ['nenhuma', tr('Não', 'No', 'No')],
                ['ipb', tr('Sim, entre igrejas IPB (com carta)', 'Sí, entre iglesias IPB (con carta)', 'Yes, between IPB churches (with letter)')],
                ['outra', tr('Sim, de outra denominação', 'Sí, de otra denominación', 'Yes, from another denomination')],
                ['jurisdicao', tr('Sim, por jurisdição (sem carta)', 'Sí, por jurisdicción (sin carta)', 'Yes, by jurisdiction (no letter)')],
              ] as const).map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => { setTipoTransferencia(valor); if (valor === 'nenhuma') setTransferenciaQual(''); }}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-colors ${
                    tipoTransferencia === valor
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
            {tipoTransferencia !== 'nenhuma' && (
              <div className="grid sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className={labelCls}>
                    {tipoTransferencia === 'ipb'
                      ? tr('Qual igreja IPB?', '¿Cuál iglesia IPB?', 'Which IPB church?')
                      : tr('Qual denominação?', '¿Cuál denominación?', 'Which denomination?')}
                  </label>
                  <input value={transferenciaQual} onChange={e => setTransferenciaQual(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr('Observação (opcional)', 'Observación (opcional)', 'Note (optional)')}</label>
                  <input value={transferenciaObservacao} onChange={e => setTransferenciaObservacao(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Propósito da entrevista */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <ClipboardList className="w-5 h-5 text-blue-600" /> {tr('Propósito da entrevista', 'Propósito de la entrevista', 'Purpose of the interview')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-2">
            {([
              ['batismo_infantil', tr('Batismo Infantil', 'Bautismo Infantil', 'Infant Baptism')],
              ['profissao_fe', tr('Profissão de Fé', 'Profesión de Fe', 'Profession of Faith')],
              ['profissao_fe_e_batismo', tr('Profissão de Fé e Batismo', 'Profesión de Fe y Bautismo', 'Profession of Faith and Baptism')],
            ] as const).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setPropositoEntrevista(valor)}
                className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  propositoEntrevista === valor
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </section>

        {/* Endereço */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <MapPin className="w-5 h-5 text-blue-600" /> {tr('Endereço', 'Dirección', 'Address')}
          </h2>
          <div className="mb-4">
            <label className={labelCls}>{tr('Buscar endereço', 'Buscar dirección', 'Search address')}</label>
            <EnderecoAutocomplete onSelect={aplicarEndereco} initialValue={enderecoCompleto} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>{tr('Logradouro', 'Calle', 'Street')}</label>
              <input value={logradouro} onChange={e => setLogradouro(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{tr('Bairro', 'Barrio', 'Neighborhood')}</label>
              <input value={bairro} onChange={e => setBairro(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CEP</label>
              <input value={cep} onChange={e => setCep(e.target.value)} className={inputCls} inputMode="numeric" />
            </div>
            <div>
              <label className={labelCls}>{tr('Cidade', 'Ciudad', 'City')}</label>
              <input value={cidade} onChange={e => setCidade(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>UF</label>
              <input value={uf} onChange={e => setUf(e.target.value)} maxLength={2} className={inputCls} />
            </div>
          </div>
        </section>

        {/* Filhos */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Users className="w-5 h-5 text-blue-600" /> {tr('Seus filhos', 'Tus hijos', 'Your children')}
          </h2>

          {filhos.length === 0 && novosFilhos.length === 0 && (
            <p className="text-sm text-slate-500 mb-4">
              {tr('Nenhum filho cadastrado ainda.', 'Ningún hijo registrado aún.', 'No children registered yet.')}
            </p>
          )}

          {filhos.map(filho => (
            <div key={filho.id} className="border border-slate-200 rounded-xl p-4 mb-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>{tr('Nome', 'Nombre', 'Name')}</label>
                  <input value={filho.nome} onChange={e => atualizarFilho(filho.id, 'nome', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr('Sexo', 'Sexo', 'Sex')}</label>
                  <select value={filho.sexo} onChange={e => atualizarFilho(filho.id, 'sexo', e.target.value)} className={inputCls}>
                    <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                    <option value="M">{tr('Masculino', 'Masculino', 'Male')}</option>
                    <option value="F">{tr('Feminino', 'Femenino', 'Female')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{tr('Data de nascimento', 'Fecha de nacimiento', 'Birth date')}</label>
                  <input type="date" value={filho.data_nascimento} onChange={e => atualizarFilho(filho.id, 'data_nascimento', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr('Escolaridade', 'Escolaridad', 'Education')}</label>
                  <select value={filho.escolaridade} onChange={e => atualizarFilho(filho.id, 'escolaridade', e.target.value)} className={inputCls}>
                    <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                    {ESCOLARIDADES.map(v => <option key={v} value={v}>{escolaridadeLabel(v)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {novosFilhos.map(filho => (
            <div key={filho.key} className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-blue-800">{tr('Novo filho(a)', 'Nuevo hijo(a)', 'New child')}</span>
                <button onClick={() => removerNovoFilho(filho.key)} className="text-slate-400 hover:text-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>{tr('Nome', 'Nombre', 'Name')}</label>
                  <input value={filho.nome} onChange={e => atualizarNovoFilho(filho.key, 'nome', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{tr('Sexo', 'Sexo', 'Sex')}</label>
                  <select value={filho.sexo} onChange={e => atualizarNovoFilho(filho.key, 'sexo', e.target.value)} className={inputCls}>
                    <option value="">{tr('Selecione', 'Seleccione', 'Select')}</option>
                    <option value="M">{tr('Masculino', 'Masculino', 'Male')}</option>
                    <option value="F">{tr('Feminino', 'Femenino', 'Female')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{tr('Data de nascimento', 'Fecha de nacimiento', 'Birth date')}</label>
                  <input type="date" value={filho.data_nascimento} onChange={e => atualizarNovoFilho(filho.key, 'data_nascimento', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={adicionarFilho}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> {tr('Adicionar filho(a)', 'Agregar hijo(a)', 'Add child')}
          </button>
        </section>

        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-base shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {tr('Salvar meus dados', 'Guardar mis datos', 'Save my data')}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1">
          <Heart className="w-3 h-3" /> {tr('Obrigado por colaborar com a igreja.', 'Gracias por colaborar con la iglesia.', 'Thank you for helping the church.')}
        </p>
      </div>
    </div>
  );
}
