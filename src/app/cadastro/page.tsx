'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { useLocale } from '@/i18n/provider';
import { resolveLocalizedText } from '@/lib/church-i18n';
import { formatPhoneNumber, unformatPhoneNumber } from '@/lib/phone-mask';
// Remove o componente EnderecoAutocomplete que está dentro do arquivo
// Adiciona no topo:
import EnderecoAutocomplete from '@/components/EnderecoAutocomplete';
import type { EnderecoGoogle } from '@/components/EnderecoAutocomplete';
import {
  User, MapPin, Heart, Church, BookOpen, Home,
  Briefcase, GraduationCap, Users, Check, ChevronRight,
  ChevronLeft, AlertCircle, Shield, Info, UserCheck,
} from 'lucide-react';

type IgrejaCadastro = {
  id: string;
  nome: string;
  nome_abreviado?: string | null;
  slug?: string | null;
  cidade?: string | null;
  uf?: string | null;
  apresentacao_titulo?: string | null;
  apresentacao_texto?: string | null;
  apresentacao_titulo_i18n?: Partial<Record<Locale, string>> | null;
  apresentacao_texto_i18n?: Partial<Record<Locale, string>> | null;
};

type StatusMembro = 'ativo' | 'congregado' | 'visitante';
type OpcaoCongregado = 'batizado_outra' | 'transferencia_ipb' | 'interesse_batismo' | '';

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

function formatarNomeFallbackDaIgreja(slug: string | null, fallbackLabel: string) {
  if (!slug) return fallbackLabel;

  const valor = slug.trim();
  if (!valor) return fallbackLabel;

  if (/^[a-z0-9]{2,6}$/i.test(valor)) {
    return valor.toUpperCase();
  }

  return valor
    .split('-')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

function CadastroPublicoContent() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const tr = useCallback(
    (pt: string, es: string, en: string) =>
      locale === 'es' ? es : locale === 'en' ? en : pt,
    [locale]
  );
  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');
  const [nomeEnviado, setNomeEnviado] = useState('');
  const [igrejaSelecionada, setIgrejaSelecionada] = useState<IgrejaCadastro | null>(null);
  const [loadingIgreja, setLoadingIgreja] = useState(true);

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
    ? [
        tr('Identificação', 'Identificación', 'Identification'),
        tr('Vida na Igreja', 'Vida en la Iglesia', 'Church Life'),
      ]
    : [
        tr('Identificação', 'Identificación', 'Identification'),
        tr('Contato', 'Contacto', 'Contact'),
        tr('Família', 'Familia', 'Family'),
        tr('Vida na Igreja', 'Vida en la Iglesia', 'Church Life'),
        tr('Cuidado Pastoral', 'Cuidado Pastoral', 'Pastoral Care'),
      ];
  const etapaVisualIdx = ehVisitante ? (etapa === 1 ? 0 : 1) : etapa - 1;
  const isUltima = ehVisitante ? etapa === 4 : etapa === 5;
  const scroll = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const igrejaIdParam = searchParams.get('igreja_id');
  const igrejaSlugParam = searchParams.get('igreja_slug');
  const thisChurchLabel = tr('esta igreja', 'esta iglesia', 'this church');
  const nomeIgreja =
    igrejaSelecionada?.nome_abreviado ||
    igrejaSelecionada?.nome ||
    formatarNomeFallbackDaIgreja(
      igrejaSlugParam,
      tr('Igreja Presbiteriana', 'Iglesia Presbiteriana', 'Presbyterian Church')
    );
  const apresentacaoTitulo = useMemo(
    () =>
      resolveLocalizedText(
        igrejaSelecionada?.apresentacao_titulo_i18n,
        locale,
        igrejaSelecionada?.apresentacao_titulo
      ),
    [igrejaSelecionada?.apresentacao_titulo_i18n, igrejaSelecionada?.apresentacao_titulo, locale]
  );
  const apresentacaoTexto = useMemo(
    () =>
      resolveLocalizedText(
        igrejaSelecionada?.apresentacao_texto_i18n,
        locale,
        igrejaSelecionada?.apresentacao_texto
      ),
    [igrejaSelecionada?.apresentacao_texto_i18n, igrejaSelecionada?.apresentacao_texto, locale]
  );
  const temApresentacaoIgreja = Boolean(apresentacaoTitulo || apresentacaoTexto);
  const paragrafosApresentacao = useMemo(
    () => apresentacaoTexto.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
    [apresentacaoTexto]
  );

  const statusOptions = useMemo(
    () => [
      {
        valor: 'ativo' as StatusMembro, emoji: '✝️',
        titulo: tr('Membro Ativo', 'Miembro activo', 'Active Member'),
        subtitulo: tr(
          'Já passei pelo batismo ou profissão de fé nesta igreja e estou em plena comunhão.',
          'Ya pasé por el bautismo o profesión de fe en esta iglesia y estoy en plena comunión.',
          'I have already gone through baptism or profession of faith in this church and I am in full communion.'
        ),
        corBorda: 'border-emerald-600', corFundo: 'bg-emerald-50', corTexto: 'text-emerald-800', corPonto: 'bg-emerald-700',
      },
      {
        valor: 'congregado' as StatusMembro, emoji: '🤝',
        titulo: tr('Congregado(a)', 'Congregante', 'Congregant'),
        subtitulo: tr(
          'Frequento com regularidade e me sinto parte da comunidade, mas ainda não me oficializei como membro.',
          'Asisto con regularidad y me siento parte de la comunidad, pero aún no me oficialicé como miembro.',
          'I attend regularly and feel part of the community, but I have not yet become an official member.'
        ),
        corBorda: 'border-blue-600', corFundo: 'bg-blue-50', corTexto: 'text-blue-800', corPonto: 'bg-blue-600',
      },
      {
        valor: 'visitante' as StatusMembro, emoji: '👋',
        titulo: tr('Visitante', 'Visitante', 'Visitor'),
        subtitulo: tr(
          'Estou conhecendo a igreja ou venho de forma esporádica. Quero que a liderança saiba da minha presença.',
          'Estoy conociendo la iglesia o asisto ocasionalmente. Quiero que el liderazgo sepa de mi presencia.',
          'I am getting to know the church or attend occasionally. I want the leadership to know I am here.'
        ),
        corBorda: 'border-amber-500', corFundo: 'bg-amber-50', corTexto: 'text-amber-800', corPonto: 'bg-amber-500',
      },
    ],
    [tr]
  );

  const cursos = useMemo(
    () => [
      { id: 'apostila_01', label: tr('Apostila 01 — Conhecendo a Jesus', 'Cuaderno 01 — Conociendo a Jesús', 'Booklet 01 — Knowing Jesus') },
      { id: 'apostila_02', label: tr('Apostila 02 — Conhecendo a Nova Vida', 'Cuaderno 02 — Conociendo la Nueva Vida', 'Booklet 02 — Knowing the New Life') },
      { id: 'apostila_03', label: tr('Apostila 03 — Conhecendo a Nossa Fé', 'Cuaderno 03 — Conociendo Nuestra Fe', 'Booklet 03 — Knowing Our Faith') },
    ],
    [tr]
  );

  useEffect(() => {
    let ativo = true;

    async function carregarIgreja() {
      try {
        setLoadingIgreja(true);
        const params = new URLSearchParams();

        if (igrejaIdParam) {
          params.set('igreja_id', igrejaIdParam);
        }

        if (!igrejaIdParam && igrejaSlugParam) {
          params.set('igreja_slug', igrejaSlugParam);
        }

        const response = await fetch(`/api/cadastro-publico?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              tr(
                'Não foi possível carregar a igreja do cadastro.',
                'No fue posible cargar la iglesia del registro.',
                'Could not load the church for this registration.'
              )
          );
        }

        if (!ativo) return;
        setIgrejaSelecionada((data.igreja || null) as IgrejaCadastro | null);
      } catch (error: any) {
        if (!ativo) return;
        setErro(
          error.message ||
            tr(
              'Não foi possível carregar a igreja do cadastro.',
              'No fue posible cargar la iglesia del registro.',
              'Could not load the church for this registration.'
            )
        );
        setIgrejaSelecionada(null);
      } finally {
        if (ativo) setLoadingIgreja(false);
      }
    }

    void carregarIgreja();

    return () => {
      ativo = false;
    };
  }, [igrejaIdParam, igrejaSlugParam, tr]);

  const avancar = () => {
    setErro('');
    if (etapa === 1) {
      if (!nome.trim()) {
        setErro(tr('Preencha seu nome completo.', 'Completa tu nombre completo.', 'Please fill in your full name.'));
        return;
      }
      if (!telefone || unformatPhoneNumber(telefone).length < 10) {
        setErro(
          tr(
            'Preencha um telefone válido com DDD.',
            'Completa un teléfono válido con código de área.',
            'Please provide a valid phone number with area code.'
          )
        );
        return;
      }
      if (!statusMembro) {
        setErro(
          tr(
            `Selecione como você frequenta ${igrejaSelecionada?.nome_abreviado || thisChurchLabel}.`,
            `Selecciona cómo asistes a ${igrejaSelecionada?.nome_abreviado || thisChurchLabel}.`,
            `Select how you attend ${igrejaSelecionada?.nome_abreviado || thisChurchLabel}.`
          )
        );
        return;
      }
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
      if (!igrejaSelecionada?.id) {
        throw new Error(
          tr(
            'Nenhuma igreja foi selecionada para este cadastro.',
            'No se seleccionó ninguna iglesia para este registro.',
            'No church was selected for this registration.'
          )
        );
      }

      const fone = unformatPhoneNumber(telefone);
      const batizado = statusMembro === 'ativo' || opcaoCongregado === 'batizado_outra' || opcaoCongregado === 'transferencia_ipb';
      const payload: Record<string, any> = {
        igreja_id: igrejaSelecionada.id,
        igreja_slug: !igrejaIdParam && igrejaSlugParam ? igrejaSlugParam : null,
        nome: nome.trim(), telefone: fone, sexo: sexo || null, status_membro: statusMembro,
        data_nascimento: dataNascimento || null, email: email.trim() || null,
        logradouro: endereco.logradouro || null, bairro: endereco.bairro || null,
        cep: endereco.cep || null, cidade: endereco.cidade || igrejaSelecionada.cidade || 'Manaus', uf: endereco.uf || igrejaSelecionada.uf || 'AM',
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
      const response = await fetch('/api/cadastro-publico', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw Object.assign(new Error(data.error || 'Erro ao enviar cadastro.'), {
          code: response.status,
        });
      }

      setNomeEnviado(nome.trim().split(' ')[0]); setSucesso(true); scroll();
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('telefone'))
        setErro(
          tr(
            'Este telefone já está cadastrado. Fale com a liderança para atualizá-lo.',
            'Este teléfono ya está registrado. Habla con el liderazgo para actualizarlo.',
            'This phone number is already registered. Please contact the leadership to update it.'
          )
        );
      else if (err.message?.includes('e-mail'))
        setErro(
          tr(
            'Já existe um cadastro com este e-mail. Tente com outro ou deixe em branco.',
            'Ya existe un registro con este correo. Intenta con otro o déjalo vacío.',
            'There is already a registration with this email. Try another one or leave it blank.'
          )
        );
      else {
        setErro(
          err.message ||
            tr(
              'Ocorreu um erro ao enviar. Tente novamente em instantes.',
              'Ocurrió un error al enviar. Inténtalo nuevamente en unos momentos.',
              'An error occurred while submitting. Please try again shortly.'
            )
        );
      }
    } finally { setSalvando(false); }
  };

  if (sucesso) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Check className="w-10 h-10 text-emerald-700" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {tr(`Obrigado, ${nomeEnviado}! 🙏`, `¡Gracias, ${nomeEnviado}! 🙏`, `Thank you, ${nomeEnviado}! 🙏`)}
        </h2>
        <p className="text-slate-600 leading-relaxed mb-5">
          {tr(
            `Seus dados foram recebidos com sucesso por ${nomeIgreja}.`,
            `Tus datos fueron recibidos con éxito por ${nomeIgreja}.`,
            `Your information was successfully received by ${nomeIgreja}.`
          )}
          <br />
          {tr(
            'Que o Senhor abençoe você e sua família!',
            '¡Que el Señor bendiga tu vida y tu familia!',
            'May the Lord bless you and your family!'
          )}
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left">
          <p className="text-sm text-emerald-900 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-700" />
            {tr(
              'Suas informações são sigilosas e acessadas apenas pela liderança pastoral da igreja selecionada.',
              'Tu información es confidencial y solo accede a ella el liderazgo pastoral de la iglesia seleccionada.',
              'Your information is confidential and only accessed by the pastoral leadership of the selected church.'
            )}
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
            <h1 className="text-sm font-bold text-white leading-tight">{nomeIgreja}</h1>
            <p className="text-xs text-emerald-300">{tr('Formulário de Cadastro', 'Formulario de registro', 'Registration Form')}</p>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {loadingIgreja && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600">{tr('Carregando dados da igreja...', 'Cargando datos de la iglesia...', 'Loading church data...')}</p>
          </div>
        )}

        {!loadingIgreja && igrejaSelecionada && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
            <p className="text-sm text-sky-900 leading-relaxed">
              <strong>{tr('Cadastro vinculado a:', 'Registro vinculado a:', 'Registration linked to:')}</strong> {nomeIgreja}
              {(igrejaSelecionada.cidade || igrejaSelecionada.uf) && (
                <> · {[igrejaSelecionada.cidade, igrejaSelecionada.uf].filter(Boolean).join(' / ')}</>
              )}
            </p>
          </div>
        )}

        {!loadingIgreja && igrejaSelecionada && temApresentacaoIgreja && (
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#f5fbf7_0%,#edf7f1_100%)] shadow-sm">
            <div className="border-b border-emerald-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                {tr('Conheça a igreja', 'Conoce la iglesia', 'Meet the church')}
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">
                {apresentacaoTitulo || nomeIgreja}
              </h2>
            </div>
            {paragrafosApresentacao.length > 0 && (
              <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-slate-700">
                {paragrafosApresentacao.map((paragrafo, index) => (
                  <p key={`${index}-${paragrafo.slice(0, 24)}`}>{paragrafo}</p>
                ))}
              </div>
            )}
          </section>
        )}

        {etapa === 1 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-900 leading-relaxed">
              👋 <strong>{tr('Olá!', '¡Hola!', 'Hello!')}</strong>{' '}
              {tr(
                'Preencha seus dados para que nossa liderança possa cuidar melhor de você. Leva apenas alguns minutos.',
                'Completa tus datos para que nuestro liderazgo pueda cuidarte mejor. Solo toma unos minutos.',
                'Fill in your information so our leadership can care for you better. It only takes a few minutes.'
              )}
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
            <strong className="text-slate-700">{etapasVisiveis[etapaVisualIdx]}</strong>{' '}· {tr('Etapa', 'Paso', 'Step')} {etapaVisualIdx + 1} {tr('de', 'de', 'of')} {etapasVisiveis.length}
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
                  {etapa === 1 && tr('Nome, telefone e vínculo', 'Nombre, teléfono y vínculo', 'Name, phone, and connection')}
                  {etapa === 2 && tr('Email e localização', 'Correo y ubicación', 'Email and location')}
                  {etapa === 3 && tr('Filiação, cônjuge e origem', 'Familia, cónyuge y origen', 'Family, spouse, and background')}
                  {etapa === 4 && (ehVisitante ? tr('Próximos passos na fé', 'Próximos pasos en la fe', 'Next steps in faith') : tr('Batismo, grupo e discipulado', 'Bautismo, grupo y discipulado', 'Baptism, group, and discipleship'))}
                  {etapa === 5 && tr('Saúde e observações pastorais', 'Salud y observaciones pastorales', 'Health and pastoral notes')}
                </p>
                <h2 className="text-white text-xl font-bold">{etapasVisiveis[etapaVisualIdx]}</h2>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">

            {/* ══ ETAPA 1 ══ */}
            {etapa === 1 && (<>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('Nome completo', 'Nombre completo', 'Full name')} <span className="text-red-500">*</span></label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder={tr('Seu nome completo', 'Tu nombre completo', 'Your full name')} autoFocus className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">📱 {tr('Telefone / WhatsApp', 'Teléfono / WhatsApp', 'Phone / WhatsApp')} <span className="text-red-500">*</span></label>
                <input 
                  type="tel" 
                  value={telefone} 
                  onChange={e => {
                    const formatado = formatPhoneNumber(e.target.value);
                    if (formatado.length <= 15) setTelefone(formatado);
                  }} 
                  placeholder={tr('(92) 99999-9999', '(92) 99999-9999', '(92) 99999-9999')} 
                  className={inputCls} 
                />
                <p className="mt-1.5 text-xs text-slate-400">{tr('Usado para contato pela liderança. Não compartilhamos com terceiros.', 'Se usa para contacto con el liderazgo. No lo compartimos con terceros.', 'Used for contact by the leadership. We do not share it with third parties.')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{tr('Como você frequenta', 'Cómo asistes a', 'How do you attend')} {igrejaSelecionada?.nome_abreviado || thisChurchLabel}? <span className="text-red-500">*</span></label>
                <p className="text-xs text-slate-400 mb-3">{tr('Isso ajuda a liderança a saber como cuidar de você da melhor forma.', 'Esto ayuda al liderazgo a saber cómo acompañarte mejor.', 'This helps the leadership understand how to care for you best.')}</p>
                <div className="space-y-2">
                  {statusOptions.map(op => (
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
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{tr('Dados adicionais', 'Datos adicionales', 'Additional data')}</p>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('Sexo', 'Sexo', 'Sex')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: '', l: tr('Não informar', 'Prefiero no informar', 'Prefer not to say') }, { v: 'M', l: tr('Masculino', 'Masculino', 'Male') }, { v: 'F', l: tr('Feminino', 'Femenino', 'Female') }].map(op => (
                        <button key={op.v} type="button" onClick={() => setSexo(op.v)}
                          className={`py-3 rounded-lg border-2 text-xs font-semibold transition-all ${sexo === op.v ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                          {op.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">🎂 {tr('Data de Nascimento', 'Fecha de nacimiento', 'Date of birth')}</label>
                    <input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
            </>)}

            {/* ══ ETAPA 2 ══ */}
            {etapa === 2 && (<>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">✉️ {tr('Email', 'Correo electrónico', 'Email')}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={tr('seu@email.com', 'tu@email.com', 'your@email.com')} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> {tr('Endereço', 'Dirección', 'Address')}
                </label>
                <p className="text-xs text-slate-400 mb-3">{tr('Digite e selecione na lista. Usamos para localizar sua residência no mapa da liderança.', 'Escribe y selecciona de la lista. La usamos para ubicar tu residencia en el mapa del liderazgo.', 'Type and select from the list. We use it to locate your home on the leadership map.')}</p>
                <EnderecoAutocomplete onSelect={setEndereco} />
                {endereco.google_place_id && (
                  <div className="mt-3">
                    <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder={tr('Complemento: apto, bloco, referência...', 'Complemento: apto, bloque, referencia...', 'Apartment, block, landmark...')} className={inputCls} />
                  </div>
                )}
              </div>
            </>)}

            {/* ══ ETAPA 3 ══ */}
            {etapa === 3 && (<>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('Nome do Pai', 'Nombre del padre', 'Father’s name')}</label>
                  <input type="text" value={nomePai} onChange={e => setNomePai(e.target.value)} placeholder={tr('Nome completo do pai', 'Nombre completo del padre', 'Father’s full name')} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('Nome da Mãe', 'Nombre de la madre', 'Mother’s name')}</label>
                  <input type="text" value={nomeMae} onChange={e => setNomeMae(e.target.value)} placeholder={tr('Nome completo da mãe', 'Nombre completo de la madre', 'Mother’s full name')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('Estado Civil', 'Estado civil', 'Marital status')}</label>
                <div className="space-y-2">
                  {[{ v: '', l: tr('Prefiro não informar', 'Prefiero no informar', 'Prefer not to say') }, { v: 'solteiro', l: tr('Solteiro(a)', 'Soltero(a)', 'Single') }, { v: 'casado', l: tr('💍 Casado(a)', '💍 Casado(a)', '💍 Married') }, { v: 'divorciado', l: tr('Divorciado(a)', 'Divorciado(a)', 'Divorced') }, { v: 'viuvo', l: tr('Viúvo(a)', 'Viudo(a)', 'Widowed') }, { v: 'uniao_estavel', l: tr('União Estável', 'Unión estable', 'Stable union') }].map(op => (
                    <button key={op.v} type="button" onClick={() => setEstadoCivil(op.v)}
                      className={`w-full text-left py-3.5 px-4 rounded-lg border-2 text-sm font-medium transition-all ${estadoCivil === op.v ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300'}`}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </div>
              {['casado', 'uniao_estavel'].includes(estadoCivil) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-emerald-800">{tr('Dados do(a) Cônjuge', 'Datos del cónyuge', 'Spouse information')}</p>
                  <input type="text" value={conjugeNome} onChange={e => setConjugeNome(e.target.value)} placeholder={tr('Nome do(a) cônjuge', 'Nombre del cónyuge', 'Spouse name')} className={inputCls} />
                  <input type="text" value={conjugeReligiao} onChange={e => setConjugeReligiao(e.target.value)} placeholder={tr('Religião do(a) cônjuge', 'Religión del cónyuge', 'Spouse religion')} className={inputCls} />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{tr('Data do casamento', 'Fecha de matrimonio', 'Wedding date')}</label>
                    <input type="date" value={dataCasamento} onChange={e => setDataCasamento(e.target.value)} className={inputCls} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{tr('Naturalidade', 'Lugar de nacimiento', 'Place of birth')}</label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <input type="text" value={naturalidadeCidade} onChange={e => setNaturalidadeCidade(e.target.value)} placeholder={tr('Cidade natal', 'Ciudad natal', 'Birth city')} className={inputCls} />
                  </div>
                  <input type="text" maxLength={2} value={naturalidadeUf} onChange={e => setNaturalidadeUf(e.target.value.toUpperCase())} placeholder={tr('UF', 'Estado', 'State')} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {tr('Profissão', 'Profesión', 'Profession')}</label>
                <input type="text" value={profissao} onChange={e => setProfissao(e.target.value)} placeholder={tr('Ex: Professor, Engenheiro...', 'Ej.: Profesor, Ingeniero...', 'Ex: Teacher, Engineer...')} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><GraduationCap className="w-4 h-4" /> {tr('Escolaridade', 'Nivel educativo', 'Education')}</label>
                <select value={escolaridade} onChange={e => setEscolaridade(e.target.value)} className={selectCls}>
                  <option value="">{tr('Não informada', 'No informado', 'Not informed')}</option>
                  <option value="fundamental_incompleto">{tr('Fund. Incompleto', 'Primaria incompleta', 'Elementary incomplete')}</option>
                  <option value="fundamental_completo">{tr('Fund. Completo', 'Primaria completa', 'Elementary complete')}</option>
                  <option value="medio_incompleto">{tr('Médio Incompleto', 'Secundaria incompleta', 'High school incomplete')}</option>
                  <option value="medio_completo">{tr('Médio Completo', 'Secundaria completa', 'High school complete')}</option>
                  <option value="superior_incompleto">{tr('Superior Incompleto', 'Universidad incompleta', 'College incomplete')}</option>
                  <option value="superior_completo">{tr('Superior Completo', 'Universidad completa', 'College complete')}</option>
                  <option value="pos_graduacao">{tr('Pós-Graduação', 'Posgrado', 'Postgraduate')}</option>
                  <option value="mestrado">{tr('Mestrado', 'Maestría', 'Master’s')}</option>
                  <option value="doutorado">{tr('Doutorado', 'Doctorado', 'Doctorate')}</option>
                </select>
              </div>
            </>)}

            {/* ══ ETAPA 4 ══ */}
            {etapa === 4 && (<>

              {/* VISITANTE */}
              {statusMembro === 'visitante' && (<>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-900">{tr('👋 Ficamos felizes com sua presença! Gostaríamos de saber um pouco mais sobre seus próximos passos.', '👋 ¡Nos alegra tu presencia! Queremos saber un poco más sobre tus próximos pasos.', '👋 We are glad you are here! We would like to know a little more about your next steps.')}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{tr('Você tem interesse em se batizar e fazer profissão de fé?', '¿Tienes interés en bautizarte y hacer profesión de fe?', 'Are you interested in being baptized and making a profession of faith?')}</label>
                  <p className="text-xs text-slate-400 mb-3">{tr('Sem compromisso — apenas queremos entender como podemos te ajudar.', 'Sin compromiso; solo queremos entender cómo ayudarte.', 'No pressure, we just want to understand how we can help you.')}</p>
                  <div className="space-y-2">
                    <CheckOption checked={interesseBatismo === true} onChange={() => setInteresseBatismo(true)}>
                      {tr('✅  Sim, tenho interesse em me batizar / fazer profissão de fé', '✅  Sí, tengo interés en bautizarme / hacer profesión de fe', '✅  Yes, I am interested in baptism / profession of faith')}
                    </CheckOption>
                    <CheckOption checked={interesseBatismo === false} onChange={() => setInteresseBatismo(false)}>
                      {tr('🙏  Não no momento, mas quero continuar frequentando', '🙏  No por ahora, pero quiero seguir asistiendo', '🙏  Not right now, but I want to keep attending')}
                    </CheckOption>
                  </div>
                </div>
              </>)}

              {/* MEMBRO ATIVO */}
              {statusMembro === 'ativo' && (<>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-sm text-emerald-900 flex items-start gap-2">
                    <UserCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-700" />
                    {tr('Como membro ativo, você já foi batizado(a). Preencha as datas para completarmos seu cadastro.', 'Como miembro activo, ya fuiste bautizado(a). Completa las fechas para finalizar tu registro.', 'As an active member, you have already been baptized. Fill in the dates so we can complete your registration.')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">✝️ {tr('Data do Batismo', 'Fecha de bautismo', 'Baptism date')}</label>
                  <input type="date" value={dataBatismo} onChange={e => setDataBatismo(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">🙏 {tr('Data de Profissão de Fé', 'Fecha de profesión de fe', 'Profession of faith date')}</label>
                  <input type="date" value={dataProfissaoFe} onChange={e => setDataProfissaoFe(e.target.value)} className={inputCls} />
                </div>
              </>)}

              {/* CONGREGADO */}
              {statusMembro === 'congregado' && (<>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                    {tr('Selecione a opção que melhor descreve sua situação. Isso ajuda a liderança a saber como te acompanhar.', 'Selecciona la opción que mejor describa tu situación. Esto ayuda al liderazgo a acompañarte.', 'Select the option that best describes your situation. This helps the leadership know how to walk with you.')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">{tr('Qual é sua situação eclesiástica?', '¿Cuál es tu situación eclesiástica?', 'What is your church situation?')}</label>
                  <div className="space-y-2">
                    {([
                      { v: 'batizado_outra' as OpcaoCongregado, titulo: tr('✝️  Fui batizado(a) em outra denominação', '✝️  Fui bautizado(a) en otra denominación', '✝️  I was baptized in another denomination'), sub: tr('Tenho batismo válido, mas ainda não transferi minha carta.', 'Tengo un bautismo válido, pero aún no trasladé mi carta.', 'I have a valid baptism, but I have not yet transferred my membership letter.') },
                      { v: 'transferencia_ipb' as OpcaoCongregado, titulo: tr('📋  Quero transferência de outra Igreja Presbiteriana', '📋  Quiero transferirme desde otra Iglesia Presbiteriana', '📋  I want to transfer from another Presbyterian church'), sub: tr(`Sou membro de outra IPB e quero transferir minha carta para ${igrejaSelecionada?.nome_abreviado || thisChurchLabel}.`, `Soy miembro de otra IPB y quiero transferir mi carta a ${igrejaSelecionada?.nome_abreviado || thisChurchLabel}.`, `I am a member of another IPB and want to transfer my letter to ${igrejaSelecionada?.nome_abreviado || thisChurchLabel}.`) },
                      { v: 'interesse_batismo' as OpcaoCongregado, titulo: tr('🌱  Tenho interesse em me batizar', '🌱  Tengo interés en bautizarme', '🌱  I am interested in being baptized'), sub: tr('Ainda não fui batizado(a) e gostaria de dar esse passo.', 'Todavía no fui bautizado(a) y me gustaría dar ese paso.', 'I have not been baptized yet and would like to take this step.') },
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
                      {opcaoCongregado === 'transferencia_ipb'
                        ? tr('Nome da Igreja Presbiteriana de origem', 'Nombre de la Iglesia Presbiteriana de origen', 'Name of your previous Presbyterian church')
                        : tr('Nome da denominação anterior', 'Nombre de la denominación anterior', 'Name of previous denomination')}
                    </label>
                    <input type="text" value={denominacaoAnterior} onChange={e => setDenominacaoAnterior(e.target.value)}
                      placeholder={opcaoCongregado === 'transferencia_ipb'
                        ? tr('Ex: IPB Flores, Manaus', 'Ej.: IPB Flores, Manaus', 'Ex: IPB Flores, Manaus')
                        : tr('Ex: Assembleia de Deus', 'Ej.: Asamblea de Dios', 'Ex: Assembly of God')} className={inputCls} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">✝️ {tr('Data do Batismo', 'Fecha de bautismo', 'Baptism date')}</label>
                      <input type="date" value={dataBatismo} onChange={e => setDataBatismo(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">🙏 {tr('Data de Profissão de Fé', 'Fecha de profesión de fe', 'Profession of faith date')}</label>
                      <input type="date" value={dataProfissaoFe} onChange={e => setDataProfissaoFe(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </>)}
              </>)}

              {/* Grupo + Cursos (compartilhado) */}
              <div className="pt-4 border-t border-slate-100 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Home className="w-4 h-4" /> {tr('Grupo Familiar', 'Grupo familiar', 'Family group')}</label>
                  <div className="space-y-3">
                    <input type="text" value={grupoFamiliarNome} onChange={e => setGrupoFamiliarNome(e.target.value)} placeholder={tr('Nome do grupo', 'Nombre del grupo', 'Group name')} className={inputCls} />
                    <input type="text" value={grupoFamiliarLider} onChange={e => setGrupoFamiliarLider(e.target.value)} placeholder={tr('Nome do líder', 'Nombre del líder', 'Leader name')} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {tr('Cursos de Discipulado concluídos', 'Cursos de discipulado completados', 'Completed discipleship courses')}</label>
                  <p className="text-xs text-slate-400 mb-3">{tr('Marque os que você já fez.', 'Marca los que ya hiciste.', 'Check the ones you have already completed.')}</p>
                  <div className="space-y-2">
                    {cursos.map(c => (
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
                    <p className="text-sm font-semibold text-amber-900 mb-1">{tr('Informações confidenciais', 'Información confidencial', 'Confidential information')}</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{tr('Esta seção é opcional. Os dados são sigilosos e acessados apenas pelo pastor e equipe pastoral.', 'Esta sección es opcional. Los datos son confidenciales y solo los ve el pastor y el equipo pastoral.', 'This section is optional. The data is confidential and only accessed by the pastor and pastoral team.')}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">❤️ {tr('Situação de Saúde', 'Situación de salud', 'Health situation')}</label>
                <p className="text-xs text-slate-400 mb-2">{tr('Condições relevantes para o cuidado pastoral', 'Condiciones relevantes para el cuidado pastoral', 'Relevant conditions for pastoral care')}</p>
                <textarea value={situacaoSaude} onChange={e => setSituacaoSaude(e.target.value)} placeholder={tr('Ex: hipertensão, dificuldade de locomoção...', 'Ej.: hipertensión, dificultad para movilizarse...', 'Ex: hypertension, mobility issues...')} rows={3} className={textareaCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">💬 {tr('Observações', 'Observaciones', 'Notes')}</label>
                <p className="text-xs text-slate-400 mb-2">{tr('Situação familiar ou qualquer coisa que queira compartilhar com a liderança', 'Situación familiar o cualquier cosa que quieras compartir con el liderazgo', 'Family situation or anything else you would like to share with the leadership')}</p>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder={tr('Escreva o que quiser que a liderança saiba...', 'Escribe lo que quieras que el liderazgo sepa...', 'Write anything you want the leadership to know...')} rows={4} className={textareaCls} />
              </div>
            </>)}
          </div>

          {/* Navegação */}
          <div className="px-5 pb-5 flex gap-3">
            {etapa > 1 && (
              <button type="button" onClick={voltar} className="flex items-center gap-2 px-5 py-3.5 border-2 border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4" /> {tr('Voltar', 'Volver', 'Back')}
              </button>
            )}
            {!isUltima ? (
              <button type="button" onClick={avancar} disabled={loadingIgreja || !igrejaSelecionada} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm text-base disabled:opacity-50">
                {tr('Continuar', 'Continuar', 'Continue')} <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button type="button" onClick={salvar} disabled={salvando || loadingIgreja || !igrejaSelecionada} className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-700 text-white rounded-lg font-bold hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm disabled:opacity-50 text-base">
                {salvando ? <><span className="animate-spin inline-block w-5 h-5 border-b-2 border-white rounded-full" /> {tr('Enviando...', 'Enviando...', 'Sending...')}</> : <><Check className="w-5 h-5" /> {tr('Enviar Cadastro', 'Enviar registro', 'Submit Registration')}</>}
              </button>
            )}
          </div>
        </div>

        {/* Mini resumo */}
        {nome && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{tr('Resumo', 'Resumen', 'Summary')}</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-emerald-700">{nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>
              </div>
              <span className="text-sm font-semibold text-slate-900">{nome}</span>
              {telefone && <span className="text-xs text-slate-400">· {telefone}</span>}
              {statusMembro && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMembro === 'ativo' ? 'bg-emerald-100 text-emerald-700' : statusMembro === 'congregado' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {statusOptions.find(s => s.valor === statusMembro)?.titulo}
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-6 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> {tr('Dados protegidos · Uso exclusivo para fins pastorais', 'Datos protegidos · Uso exclusivo para fines pastorales', 'Protected data · For pastoral use only')}
        </p>
      </div>
    </div>
  );
}

export default function CadastroPublicoPage() {
  return (
    <Suspense fallback={<CadastroPublicoFallback />}>
      <CadastroPublicoContent />
    </Suspense>
  );
}

function CadastroPublicoFallback() {
  const locale = useLocale();
  const texto =
    locale === 'es'
      ? 'Cargando formulario de registro...'
      : locale === 'en'
        ? 'Loading registration form...'
        : 'Carregando formulário de cadastro...';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-600">{texto}</p>
      </div>
    </div>
  );
}
