'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Eye,
  Globe,
  MapPin,
  Music,
  Phone,
  Share2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Locale } from '@/i18n/config';
import { formatCountryByLocale, formatDateByLocale } from '@/i18n/format';
import { useLocale, useTranslations } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { CHURCH_STORAGE_KEY, formatIgrejaLocalizacao } from '@/lib/church-utils';

interface BoletimItem {
  id: string;
  secao_id: string | null;
  conteudo: string;
  destaque: boolean | null;
  ordem: number | null;
  criado_em: string | null;
  liturgia_nome?: string | null;
  liturgia_titulo?: string | null;
  liturgia_publico?: string | null;
  liturgia_interno?: string | null;
  liturgia_horario?: string | null;
}

interface BoletimSecao {
  id: string;
  igreja_id: string | null;
  culto_id: number | null;
  tipo: string;
  titulo: string;
  icone: string | null;
  ordem: number | null;
  visivel: boolean | null;
  criado_em: string | null;
  itens: BoletimItem[];
}

interface AgendaCulto {
  id: string;
  igreja_id: string;
  nome: string;
  dia_semana: string;
  horario: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number | null;
}

interface RedeSocial {
  id: string;
  igreja_id: string;
  tipo: string;
  url: string;
  ativo: boolean;
  ordem: number | null;
}

interface IgrejaDetalhes {
  id: string;
  nome: string;
  nome_abreviado: string | null;
  nome_completo: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  regiao: string | null;
  endereco_completo: string | null;
  logradouro: string | null;
  complemento: string | null;
  bairro: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  instagram: string | null;
  youtube: string | null;
  whatsapp: string | null;
  horario_publicacao_boletim: string | null;
  dia_publicacao_boletim: number | null;
  timezone_boletim: string | null;
  apresentacao_titulo: string | null;
  apresentacao_texto: string | null;
  apresentacao_imagem_url: string | null;
  apresentacao_youtube_url: string | null;
  apresentacao_galeria: string[] | null;
}

interface CanticoModalData {
  tipo: 'hinario' | 'cantico';
  numero: string | null;
  nome: string;
  letra: string | null;
  referencia: string | null;
  tags: string[] | null;
  autor_letra: string | null;
  compositor: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  audio_url: string | null;
}

interface CanticoAbertoRef {
  nome: string;
  numero: string | null;
  rotulo: 'Hino' | 'Cântico' | 'Cantico';
}

interface LiturgiaGrupo {
  id: string;
  titulo: string;
  horario: string | null;
  publicos: string[];
  internos: string[];
}

interface LiturgiaCard {
  id: string;
  nome: string | null;
  grupos: LiturgiaGrupo[];
}

const LITURGIA_META_TIPO = '__liturgia__:nome';
const LISTA_MARCADOR_REGEX = /^(?:\uF0D8|[\u2022\u2023\u2043\u2219\u25AA\u25CF\u25E6\u25B8\u25B6])\s*/;
const MAX_IGREJAS_EXIBIDAS = 24;

function normalizarTextoBusca(valor: string | null | undefined) {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatarDataExtenso(valor: string, locale: Locale) {
  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, ano, mes, dia] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return formatDateByLocale(data, locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatarPais(valor: string | null, locale: Locale) {
  if (!valor) return null;
  return formatCountryByLocale(valor, locale);
}

function extrairYoutubeId(url: string | null) {
  if (!url) return null;

  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  return url.match(regex)?.[1] || null;
}

function parseAgendaBoletimItem(conteudo: string) {
  const partes = conteudo.split('|');
  if (partes.length < 3) return null;

  const [data, hora, ...descricaoPartes] = partes;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;

  return {
    data,
    hora: /^\d{2}:\d{2}$/.test(hora) ? hora : '00:00',
    descricao: descricaoPartes.join('|').trim(),
    temHora: hora !== '00:00',
  };
}

function parseAvisoBoletimItem(conteudo: string) {
  const texto = conteudo.trim();
  if (!texto) return null;

  const separadorDuplo = texto.indexOf('\n\n');
  if (separadorDuplo >= 0) {
    const titulo = texto.slice(0, separadorDuplo).trim();
    const corpo = texto.slice(separadorDuplo + 2).trim();

    if (!titulo || !corpo) return null;

    return { titulo, corpo };
  }

  const [titulo, ...restante] = texto.split('\n');
  const corpo = restante.join('\n').trim();

  if (!titulo.trim() || !corpo) return null;

  return {
    titulo: titulo.trim(),
    corpo,
  };
}

function formatarDataAgenda(valor: string, locale: Locale) {
  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return valor;

  const [, ano, mes, dia] = match;
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return formatDateByLocale(data, locale, {
    day: '2-digit',
    month: 'short',
  });
}

async function lerJsonSeguro(response: Response) {
  const texto = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('Resposta inválida do servidor.');
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('Não foi possível ler a resposta do servidor.');
  }
}

function getMensagemErro(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function extrairTextoMarcadorLista(linha: string) {
  const texto = linha.trim();
  const semMarcador = texto.replace(LISTA_MARCADOR_REGEX, '').trim();

  if (!semMarcador || semMarcador === texto) return null;

  return semMarcador;
}

function extrairPartesLiturgicas(conteudo: string) {
  const [titulo, ...restante] = conteudo.split('\n');

  return {
    titulo: titulo.trim(),
    corpo: restante.join('\n').trim(),
  };
}

function extrairNomeCardLiturgia(conteudo: string) {
  const { titulo, corpo } = extrairPartesLiturgicas(conteudo);
  if (titulo !== LITURGIA_META_TIPO) return null;
  return corpo || null;
}

function getTituloCardLiturgia(nome: string | null) {
  return nome ? `Liturgia - ${nome}` : 'Liturgia';
}

function agruparCardsLiturgia(itens: BoletimItem[]) {
  const cards: LiturgiaCard[] = [];
  let cardAtual: LiturgiaCard | null = null;

  for (const item of itens) {
    const nomeLiturgia = item.liturgia_nome ?? extrairNomeCardLiturgia(item.conteudo);

    if (nomeLiturgia !== null) {
      cardAtual = {
        id: `liturgia-${item.id}`,
        nome: nomeLiturgia,
        grupos: [],
      };
      cards.push(cardAtual);
      continue;
    }

    const possuiCamposLiturgicos =
      typeof item.liturgia_titulo === 'string' ||
      typeof item.liturgia_publico === 'string' ||
      typeof item.liturgia_interno === 'string' ||
      typeof item.liturgia_horario === 'string';
    const partes = extrairPartesLiturgicas(item.conteudo);
    const titulo = (item.liturgia_titulo || partes.titulo || 'Item liturgico').trim();
    const horario = item.liturgia_horario?.trim() || null;
    const publico = possuiCamposLiturgicos
      ? item.liturgia_publico?.trim() || ''
      : partes.corpo;
    const interno = possuiCamposLiturgicos ? item.liturgia_interno?.trim() || '' : '';

    if (!cardAtual) {
      cardAtual = {
        id: `liturgia-default-${item.id}`,
        nome: null,
        grupos: [],
      };
      cards.push(cardAtual);
    }

    const ultimoGrupo = cardAtual.grupos[cardAtual.grupos.length - 1];

    if (ultimoGrupo && ultimoGrupo.titulo === titulo && ultimoGrupo.horario === horario) {
      if (publico && !ultimoGrupo.publicos.includes(publico)) {
        ultimoGrupo.publicos.push(publico);
      }
      if (interno && !ultimoGrupo.internos.includes(interno)) {
        ultimoGrupo.internos.push(interno);
      }
      continue;
    }

    cardAtual.grupos.push({
      id: item.id,
      titulo,
      horario,
      publicos: publico ? [publico] : [],
      internos: interno ? [interno] : [],
    });
  }

  return cards.filter((card) => card.grupos.length > 0);
}

export default function Home() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { user, loading: authLoading, signOut } = useAuth();

  const [igrejas, setIgrejas] = useState<IgrejaSelecionavel[]>([]);
  const [igrejaAtualId, setIgrejaAtualId] = useState<string | null>(null);
  const [igrejaDetalhes, setIgrejaDetalhes] = useState<IgrejaDetalhes | null>(null);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecao[]>([]);
  const [agendaCultos, setAgendaCultos] = useState<AgendaCulto[]>([]);
  const [redesSociais, setRedesSociais] = useState<RedeSocial[]>([]);
  const [loadingIgrejas, setLoadingIgrejas] = useState(true);
  const [loadingBoletim, setLoadingBoletim] = useState(true);
  const [canticoAbertoRef, setCanticoAbertoRef] = useState<CanticoAbertoRef | null>(null);
  const [canticoAberto, setCanticoAberto] = useState<CanticoModalData | null>(null);
  const [loadingCantico, setLoadingCantico] = useState(false);
  const [buscaIgreja, setBuscaIgreja] = useState('');
  const [filtroPais, setFiltroPais] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [sobreIgrejaAberto, setSobreIgrejaAberto] = useState(false);
  const sobreIgrejaRef = useRef<HTMLElement | null>(null);

  const igrejaSelecionada = useMemo(
    () => igrejas.find((igreja) => igreja.id === igrejaAtualId) || null,
    [igrejas, igrejaAtualId]
  );

  const localizacao = igrejaSelecionada
    ? formatIgrejaLocalizacao(igrejaSelecionada)
    : null;

  const enderecoFormatado = useMemo(() => {
    if (!igrejaDetalhes) return null;

    const enderecoBase =
      igrejaDetalhes.endereco_completo ||
      [igrejaDetalhes.logradouro, igrejaDetalhes.complemento, igrejaDetalhes.bairro]
        .filter(Boolean)
        .join(', ');

    const localizacaoDetalhada = [
      igrejaDetalhes.cidade,
      igrejaDetalhes.uf,
      formatarPais(igrejaDetalhes.pais, locale),
    ]
      .filter(Boolean)
      .join(', ');

    if (enderecoBase && localizacaoDetalhada && !enderecoBase.includes(localizacaoDetalhada)) {
      return `${enderecoBase}, ${localizacaoDetalhada}`;
    }

    return enderecoBase || localizacaoDetalhada || null;
  }, [igrejaDetalhes, locale]);

  const dataEdicao = useMemo(() => {
    for (const secao of boletimSecoes) {
      if (secao.tipo !== 'liturgia') continue;

      const match = secao.titulo.match(/(\d{4}-\d{2}-\d{2})/);
      if (!match) continue;

      return formatarDataExtenso(match[1], locale);
    }

    return null;
  }, [boletimSecoes, locale]);

  const numeracaoSecoesVisiveis = useMemo(() => {
    let contador = 0;

    return new Map(
      boletimSecoes.map((secao) => [
        secao.id,
        secao.tipo === 'imagem_tema' ? null : ++contador,
      ])
    );
  }, [boletimSecoes]);

  const apresentacaoTitulo = igrejaDetalhes?.apresentacao_titulo?.trim() || '';
  const apresentacaoTexto = igrejaDetalhes?.apresentacao_texto?.trim() || '';
  const temApresentacaoIgreja = Boolean(apresentacaoTitulo || apresentacaoTexto);

  const galeriaApresentacao = useMemo(() => {
    const itens = [
      igrejaDetalhes?.apresentacao_imagem_url?.trim() || null,
      ...((igrejaDetalhes?.apresentacao_galeria || []).map((item) => item?.trim() || null)),
    ].filter(Boolean) as string[];

    return Array.from(new Set(itens));
  }, [igrejaDetalhes]);

  const youtubeApresentacaoId = useMemo(
    () => extrairYoutubeId(igrejaDetalhes?.apresentacao_youtube_url || null),
    [igrejaDetalhes]
  );

  const paragrafosApresentacao = useMemo(
    () => apresentacaoTexto.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
    [apresentacaoTexto]
  );

  useEffect(() => {
    if (!temApresentacaoIgreja) {
      setSobreIgrejaAberto(false);
    }
  }, [temApresentacaoIgreja]);

  useEffect(() => {
    setSobreIgrejaAberto(false);
  }, [igrejaAtualId]);

  useEffect(() => {
    if (!sobreIgrejaAberto) return;

    requestAnimationFrame(() => {
      sobreIgrejaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [sobreIgrejaAberto]);

  const paisesDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        igrejas
          .map((igreja) => formatarPais(igreja.pais, locale))
          .filter(Boolean)
      )
    )
      .sort((a, b) => a!.localeCompare(b!, locale)) as string[];
  }, [igrejas, locale]);

  const cidadesDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        igrejas
          .filter((igreja) => !filtroPais || formatarPais(igreja.pais, locale) === filtroPais)
          .map((igreja) => igreja.cidade?.trim())
          .filter(Boolean)
      )
    )
      .sort((a, b) => a!.localeCompare(b!, locale)) as string[];
  }, [igrejas, filtroPais, locale]);

  const igrejasFiltradas = useMemo(() => {
    const buscaNormalizada = normalizarTextoBusca(buscaIgreja);

    return igrejas
      .filter((igreja) => !filtroPais || formatarPais(igreja.pais, locale) === filtroPais)
      .filter((igreja) => !filtroCidade || igreja.cidade?.trim() === filtroCidade)
      .filter((igreja) => {
        if (!buscaNormalizada) return true;

        const textoIndexado = normalizarTextoBusca(
          [igreja.nome, igreja.sigla, igreja.cidade, igreja.regiao, formatarPais(igreja.pais, locale)]
            .filter(Boolean)
            .join(' ')
        );

        return textoIndexado.includes(buscaNormalizada);
      })
      .sort((a, b) => {
        if (a.id === igrejaAtualId) return -1;
        if (b.id === igrejaAtualId) return 1;
        return a.nome.localeCompare(b.nome, locale);
      });
  }, [igrejas, filtroPais, filtroCidade, buscaIgreja, igrejaAtualId, locale]);

  const igrejasExibidas = useMemo(
    () => igrejasFiltradas.slice(0, MAX_IGREJAS_EXIBIDAS),
    [igrejasFiltradas]
  );

  useEffect(() => {
    if (filtroCidade && !cidadesDisponiveis.includes(filtroCidade)) {
      setFiltroCidade('');
    }
  }, [filtroCidade, cidadesDisponiveis]);

  const compartilharWhatsApp = async () => {
    if (!igrejaSelecionada) return;

    let texto = `*BOLETIM ELETRONICO*\n`;
    texto += `⛪ ${igrejaDetalhes?.nome_completo || igrejaSelecionada.nome}\n`;

    if (localizacao) {
      texto += `📍 ${localizacao}\n`;
    }

    texto += '\n';

    if (agendaCultos.length > 0) {
      texto += '*AGENDA DE CULTOS*\n';
      for (const culto of agendaCultos) {
        texto += `• ${culto.nome} — ${culto.dia_semana} às ${culto.horario.slice(0, 5)}\n`;
      }
      texto += '\n';
    }

    for (const [index, secao] of boletimSecoes.entries()) {
      texto += `*${index + 1}. ${secao.titulo}*\n`;

      if (secao.tipo === 'liturgia') {
        const cards = agruparCardsLiturgia(secao.itens);

        for (const card of cards) {
          texto += `${getTituloCardLiturgia(card.nome)}\n`;

          for (const grupo of card.grupos) {
            texto += `${grupo.titulo}\n`;

            for (const corpo of grupo.publicos) {
              if (corpo) {
                texto += `${corpo}\n`;
              }
            }

            texto += '\n';
          }
        }

        texto += '\n';
        continue;
      }

      for (const item of secao.itens) {
        const agenda = secao.tipo === 'agenda' ? parseAgendaBoletimItem(item.conteudo) : null;
        const aviso = secao.tipo === 'avisos' ? parseAvisoBoletimItem(item.conteudo) : null;
        if (agenda) {
          texto += `- ${formatarDataAgenda(agenda.data, locale)}${agenda.temHora ? ` às ${agenda.hora}` : ''} — ${agenda.descricao}\n`;
          continue;
        }
        if (aviso) {
          texto += `${item.destaque ? '• ' : '- '}${aviso.titulo}\n${aviso.corpo}\n`;
          continue;
        }

        texto += `${item.destaque ? '• ' : '- '}${item.conteudo}\n`;
      }
      texto += '\n';
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  useEffect(() => {
    let active = true;

    const carregarIgrejas = async () => {
      try {
        setLoadingIgrejas(true);
        const response = await fetch('/api/igrejas/selecionaveis');
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar igrejas.');
        }

        if (!active) return;

        const lista = (data.igrejas || []) as IgrejaSelecionavel[];
        setIgrejas(lista);

        const igrejaUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('igreja_id')
            : null;
        const igrejaPreferida =
          typeof window !== 'undefined' ? localStorage.getItem(CHURCH_STORAGE_KEY) : null;

        const prioridade = [igrejaUrl, igrejaPreferida, data.igrejaAtualId, lista[0]?.id || null].filter(
          Boolean
        ) as string[];
        const primeiraValida =
          prioridade.find((id) => lista.some((igreja) => igreja.id === id)) || null;

        setIgrejaAtualId(primeiraValida);
      } catch (error: unknown) {
        console.error('Erro ao carregar igrejas:', getMensagemErro(error, 'Erro ao carregar igrejas.'));
      } finally {
        if (active) {
          setLoadingIgrejas(false);
        }
      }
    };

    carregarIgrejas();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!igrejaAtualId) return;
    localStorage.setItem(CHURCH_STORAGE_KEY, igrejaAtualId);
  }, [igrejaAtualId]);

  useEffect(() => {
    if (authLoading || !igrejaAtualId) return;

    let active = true;

    const carregarBoletim = async () => {
      try {
        setLoadingBoletim(true);

        const params = new URLSearchParams({ igreja_id: igrejaAtualId });
        const response = await fetch(`/api/boletins-home?${params.toString()}`, {
          headers: await buildAuthenticatedHeaders(),
        });
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar boletim.');
        }

        if (!active) return;

        setIgrejaDetalhes((data.igrejaDetalhes || null) as IgrejaDetalhes | null);
        setBoletimSecoes((data.boletimSecoes || []) as BoletimSecao[]);
        setAgendaCultos((data.agendaCultos || []) as AgendaCulto[]);
        setRedesSociais((data.redesSociais || []) as RedeSocial[]);
      } catch (error: unknown) {
        if (!active) return;
        console.error('Erro ao carregar boletim:', getMensagemErro(error, 'Erro ao carregar boletim.'));
        setIgrejaDetalhes(null);
        setBoletimSecoes([]);
        setAgendaCultos([]);
        setRedesSociais([]);
      } finally {
        if (active) {
          setLoadingBoletim(false);
        }
      }
    };

    carregarBoletim();

    return () => {
      active = false;
    };
  }, [igrejaAtualId, authLoading]);

  useEffect(() => {
    if (!canticoAbertoRef) {
      setCanticoAberto(null);
      return;
    }

    let active = true;

    const carregarCantico = async () => {
      try {
        setLoadingCantico(true);

        const params = new URLSearchParams({ nome: canticoAbertoRef.nome });
        if (canticoAbertoRef.numero) {
          params.set('numero', canticoAbertoRef.numero);
        }
        if (igrejaAtualId) {
          params.set('igreja_id', igrejaAtualId);
        }
        const response = await fetch(`/api/canticos-publicos?${params.toString()}`);
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar cântico.');
        }

        if (!active) return;
        setCanticoAberto((data.cantico || null) as CanticoModalData | null);
      } catch (error: unknown) {
        console.error('Erro ao carregar cântico:', getMensagemErro(error, 'Erro ao carregar cântico.'));
        if (!active) return;
        setCanticoAberto(null);
      } finally {
        if (active) {
          setLoadingCantico(false);
        }
      }
    };

    carregarCantico();

    return () => {
      active = false;
    };
  }, [canticoAbertoRef, igrejaAtualId]);

  const loading = loadingIgrejas || loadingBoletim;

  const isImageSection = (secao: BoletimSecao) => secao.tipo === 'imagem_tema';
  const isLiturgiaSection = (secao: BoletimSecao) => secao.tipo === 'liturgia';
  const isPastoralSection = (secao: BoletimSecao) => secao.tipo === 'palavra_pastoral';
  const isAgendaSection = (secao: BoletimSecao) => secao.tipo === 'agenda';
  const isAvisosSection = (secao: BoletimSecao) => secao.tipo === 'avisos';
  const nomeExibicaoIgreja =
    igrejaDetalhes?.nome_completo || igrejaSelecionada?.nome || 'Boletim';

  const boletinsAnterioresHref = igrejaAtualId
    ? `/boletins-anteriores?igreja_id=${igrejaAtualId}`
    : '/boletins-anteriores';
  const pedidosPastoraisHref = igrejaSelecionada?.slug
    ? `/pedidos/${igrejaSelecionada.slug}`
    : igrejaAtualId
      ? `/pedidos-pastorais?igreja_id=${igrejaAtualId}`
      : '/pedidos-pastorais';

  const extrairCanticoLinha = (linha: string) => {
    const match = linha.match(/^(C[âa]ntico|Cantico|Hino)(?:\s*[:\-]\s*|\s+)(.+)$/i);
    if (!match) return null;

    const nomeCompleto = match[2].trim();
    const sufixoMatch = nomeCompleto.match(/\(([^)]+)\)\s*$/);
    const nome = nomeCompleto.replace(/\s+\(([^)]+)\)\s*$/, '').trim();
    const sufixo = sufixoMatch ? sufixoMatch[1].trim() : null;
    const ehHino = /^hino$/i.test(match[1]);
    const numero = ehHino && sufixo && /^\d{1,3}$/.test(sufixo) ? sufixo.padStart(3, '0') : null;
    const tom = numero ? null : sufixo;

    return {
      rotulo: match[1] as 'Hino' | 'Cântico' | 'Cantico',
      nome,
      numero,
      tom,
    };
  };

  const renderBlocoTexto = (
    texto: string,
    tone: 'default' | 'emphasis' | 'muted' = 'default'
  ) => {
    const linhas = texto.split('\n');
    const textoClassName =
      tone === 'emphasis'
        ? 'text-slate-800'
        : tone === 'muted'
          ? 'text-slate-500'
          : 'text-slate-700';

    return (
      <div className="space-y-2">
        {linhas.map((linha, index) => {
          const valor = linha.trim();

          if (!valor) {
            return <div key={`vazia-${index}`} className="h-2" />;
          }

          const cantico = extrairCanticoLinha(valor);
          if (cantico) {
            return (
              <button
                key={`${cantico.nome}-${index}`}
                type="button"
                onClick={() =>
                  setCanticoAbertoRef({
                    nome: cantico.nome,
                    numero: cantico.numero,
                    rotulo: cantico.rotulo,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full border border-[#d8d1c4] bg-[#faf7f0] px-3 py-1.5 text-left text-sm font-medium text-[#365c4d] transition-colors hover:border-[#365c4d] hover:bg-[#f4eee1]"
              >
                <span>{cantico.rotulo}:</span>
                <span className="underline underline-offset-2">{cantico.nome}</span>
                {cantico.numero ? <span className="text-slate-500">({cantico.numero})</span> : null}
                {cantico.tom ? <span className="text-slate-500">({cantico.tom})</span> : null}
              </button>
            );
          }

          const itemLista = extrairTextoMarcadorLista(valor);
          if (itemLista) {
            return (
              <p
                key={`${itemLista}-${index}`}
                className={`${textoClassName} flex items-start gap-2 text-[15px] leading-7 sm:text-base`}
              >
                <span className="pt-[0.12rem] text-[#365c4d]">•</span>
                <span className="flex-1">{itemLista}</span>
              </p>
            );
          }

          return (
            <p
              key={`${valor}-${index}`}
              className={`${textoClassName} text-[15px] whitespace-pre-line leading-7 sm:text-base`}
            >
              {valor}
            </p>
          );
        })}
      </div>
    );
  };

  const renderItemConteudo = (secao: BoletimSecao, conteudo: string) => {
    if (isAgendaSection(secao)) {
      const agenda = parseAgendaBoletimItem(conteudo);

      if (agenda) {
        return (
          <div className="rounded-[22px] border border-[#ece5d9] bg-[#faf7f0] px-4 py-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#365c4d]">
              {formatarDataAgenda(agenda.data, locale)}
              {agenda.temHora ? ` · ${agenda.hora}` : ''}
            </p>
            <p className="mt-2 text-[15px] leading-7 text-slate-700 sm:text-base">{agenda.descricao}</p>
          </div>
        );
      }
    }

    if (isAvisosSection(secao)) {
      const aviso = parseAvisoBoletimItem(conteudo);

      if (aviso) {
        return (
          <div className="space-y-2">
            <p className="text-[15px] font-semibold leading-6 text-slate-900 sm:text-base">
              {aviso.titulo}
            </p>
            <div>{renderBlocoTexto(aviso.corpo)}</div>
          </div>
        );
      }
    }

    if (!isLiturgiaSection(secao)) {
      return renderBlocoTexto(
        conteudo,
        isPastoralSection(secao) ? 'emphasis' : 'default'
      );
    }

    const [titulo, ...restante] = conteudo.split('\n');
    const corpo = restante.join('\n').trim();

    return (
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-slate-900 leading-6 sm:text-base">{titulo}</p>
        {corpo ? renderBlocoTexto(corpo) : null}
      </div>
    );
  };

  const getTituloSecao = (secao: BoletimSecao) => {
    if (!isLiturgiaSection(secao)) return secao.titulo;

    return secao.titulo.match(/(\d{4}-\d{2}-\d{2})/) ? 'Liturgia' : secao.titulo;
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4efe5_0%,#f7f3eb_42%,#f2eee5_100%)] text-slate-900">
      <header className="bg-[#17352b] text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-emerald-200/80 text-[11px] font-semibold uppercase tracking-[0.28em] mb-1">
              OIKOS Hub
            </p>
            <h1 className="text-xl font-bold text-white">{t('home.bulletinTitle')}</h1>
            {igrejaSelecionada && (
              <p className="text-sm text-emerald-50/90 mt-1">{nomeExibicaoIgreja}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => router.push('/admin')}
                  className="text-sm font-medium text-emerald-200 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t('home.panel')}
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    window.location.reload();
                  }}
                  className="text-sm font-medium text-emerald-300/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t('home.signOut')}
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-md transition-colors"
              >
                {t('home.signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 sm:px-6 sm:pt-8 pb-16">
        <section className="rounded-[30px] border border-[#d8d1c4] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf7ef_100%)] px-5 py-6 shadow-[0_12px_40px_rgba(77,58,32,0.07)] sm:px-7 sm:py-8">
          <div className="space-y-5">
            <div className="space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#365c4d]">{t('home.publicEdition')}</p>
              <div className="space-y-2">
                <h2 className="font-['Georgia','Times_New_Roman',serif] text-3xl sm:text-4xl leading-tight font-semibold text-slate-900">
                  {nomeExibicaoIgreja}
                </h2>
                <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
                  {dataEdicao ? t('home.editionOf', { date: dataEdicao }) : t('home.publicBulletin')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#ded7cb] bg-[#faf7f0] px-3 py-1.5 text-[#365c4d]">
                  <MapPin className="w-3.5 h-3.5" />
                  {enderecoFormatado || localizacao || t('home.locationUnknown')}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  onClick={compartilharWhatsApp}
                  disabled={!igrejaSelecionada}
                  className="inline-flex items-center justify-center gap-2 min-w-[180px] rounded-full bg-[#365c4d] hover:bg-[#28463b] disabled:bg-slate-300 text-white text-sm font-semibold px-4 py-3 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  {t('home.shareBulletin')}
                </button>
                <Link
                  href={boletinsAnterioresHref}
                  className="inline-flex items-center justify-center gap-2 min-w-[180px] rounded-full border border-[#d8d1c4] bg-[#fffdf8] px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                >
                  {t('home.pastBulletins')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={pedidosPastoraisHref}
                  className="inline-flex items-center justify-center gap-2 min-w-[180px] rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:border-emerald-400 hover:bg-emerald-100"
                >
                  Pedidos
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {temApresentacaoIgreja ? (
                  <button
                    type="button"
                    onClick={() => setSobreIgrejaAberto((valorAtual) => !valorAtual)}
                    className="inline-flex items-center justify-center gap-2 min-w-[180px] rounded-full border border-[#d8d1c4] bg-[#fff7ea] px-4 py-3 text-sm font-semibold text-[#7a5123] transition-colors hover:border-[#c79a67] hover:text-[#8e5e29]"
                  >
                    {sobreIgrejaAberto ? 'Ocultar sobre a igreja' : 'Sobre a igreja'}
                    <ArrowRight className={`w-4 h-4 transition-transform ${sobreIgrejaAberto ? 'rotate-90' : ''}`} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {user && (
          <div className="mt-5 flex items-center gap-3 border border-blue-200 bg-[#f8fbff] px-4 py-3">
            <Eye className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Logado. O painel administrativo segue disponivel para gestao interna da igreja selecionada.
            </p>
          </div>
        )}

        {!loading && temApresentacaoIgreja && sobreIgrejaAberto && (
          <section
            ref={sobreIgrejaRef}
            id="sobre-igreja"
            className="mt-8 overflow-hidden rounded-[32px] border border-[#dfd1bf] bg-[linear-gradient(135deg,#fffaf2_0%,#f7efe1_55%,#f2e6d2_100%)] shadow-[0_18px_48px_rgba(101,72,31,0.08)]"
          >
            <div className="grid gap-8 px-5 py-6 sm:px-7 sm:py-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9a6a34]">
                    Sobre a igreja
                  </p>
                  <h3 className="font-['Georgia','Times_New_Roman',serif] text-3xl font-semibold leading-tight text-slate-900">
                    {apresentacaoTitulo || nomeExibicaoIgreja}
                  </h3>
                </div>

                <div className="space-y-4 text-[15px] leading-8 text-slate-700 sm:text-base">
                  {paragrafosApresentacao.map((paragrafo, index) => (
                    <p key={`apresentacao-${index}`}>{paragrafo}</p>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {galeriaApresentacao[0] ? (
                  <Image
                    src={galeriaApresentacao[0]}
                    alt={apresentacaoTitulo || nomeExibicaoIgreja}
                    width={1600}
                    height={1100}
                    unoptimized
                    className="h-[18rem] w-full rounded-[28px] border border-[#eadfce] object-cover shadow-[0_12px_30px_rgba(74,53,28,0.12)] sm:h-[22rem]"
                  />
                ) : null}

                {youtubeApresentacaoId ? (
                  <div className="overflow-hidden rounded-[28px] border border-[#eadfce] bg-black shadow-[0_12px_30px_rgba(74,53,28,0.12)]">
                    <div className="aspect-video">
                      <iframe
                        title={`Apresentação de ${nomeExibicaoIgreja}`}
                        src={`https://www.youtube.com/embed/${youtubeApresentacaoId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="h-full w-full border-0"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {galeriaApresentacao.length > 1 ? (
              <div className="border-t border-[#e8dccb] px-5 py-5 sm:px-7 sm:py-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {galeriaApresentacao.slice(1).map((foto, index) => (
                    <Image
                      key={`${foto}-${index}`}
                      src={foto}
                      alt={`${nomeExibicaoIgreja} ${index + 2}`}
                      width={1200}
                      height={800}
                      unoptimized
                      className="h-40 w-full rounded-[22px] border border-[#eadfce] object-cover shadow-[0_10px_24px_rgba(74,53,28,0.08)]"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {loading && (
          <div className="flex flex-col items-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Carregando boletim...</p>
          </div>
        )}

        {!loading && (
          <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1.72fr)_300px] xl:items-start">
            <section className="space-y-10">
              {boletimSecoes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] py-24">
                  <Music className="w-10 h-10 text-slate-300" />
                  <p className="text-slate-400">Nenhuma seção de boletim publicada para esta igreja.</p>
                </div>
              ) : (
                boletimSecoes.map((secao) => (
                  <article
                    key={secao.id}
                    className="space-y-5"
                  >
                    {!isImageSection(secao) && (
                      <div className="space-y-2 border-b border-[#d8d1c4] pb-3">
                        <p className="text-[#365c4d] text-[11px] font-semibold uppercase tracking-[0.28em] mb-2">
                          Seção {numeracaoSecoesVisiveis.get(secao.id)}
                        </p>
                        <h3 className="font-['Georgia','Times_New_Roman',serif] text-2xl font-semibold tracking-tight text-slate-900">
                          {getTituloSecao(secao)}
                        </h3>
                      </div>
                    )}

                    {secao.itens.length === 0 ? (
                      <p className="text-sm text-slate-400">Sem itens publicados nesta seção.</p>
                    ) : isLiturgiaSection(secao) ? (
                      <div className="space-y-4">
                        {agruparCardsLiturgia(secao.itens).map((card) => (
                          <div
                            key={card.id}
                            className="rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] px-5 py-4 shadow-[0_10px_32px_rgba(77,58,32,0.05)] sm:px-6 sm:py-5"
                          >
                            <div className="space-y-0">
                              <div className="border-b border-[#ece5d9] pb-4">
                                <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                                  {getTituloCardLiturgia(card.nome)}
                                </p>
                              </div>

                              {card.grupos.map((grupo, itemIndex) => (
                                <div
                                  key={grupo.id}
                                  className={`py-4 ${itemIndex > 0 ? 'border-t border-[#ece5d9]' : ''}`}
                                >
                                  <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-[15px] font-semibold text-slate-900 leading-6 sm:text-base">
                                        {grupo.titulo}
                                      </p>
                                    </div>

                                    {grupo.publicos.length > 0 ? (
                                      <div className="space-y-2">
                                        {grupo.publicos.map((corpo, corpoIndex) =>
                                          corpo ? (
                                            <div key={`${grupo.id}-publico-${corpoIndex}`}>
                                              {renderBlocoTexto(corpo)}
                                            </div>
                                          ) : null
                                        )}
                                      </div>
                                    ) : null}

                                    {user && (grupo.internos.length > 0 || grupo.horario) ? (
                                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                            Interno
                                          </p>
                                          <p className="text-xs text-slate-400">
                                            Visível só para quem está logado
                                          </p>
                                        </div>

                                        {grupo.horario ? (
                                          <p className="mt-2 text-sm font-medium text-slate-500">
                                            Horário: {grupo.horario}
                                          </p>
                                        ) : null}

                                        {grupo.internos.length > 0 ? (
                                          <div className="mt-3 space-y-2">
                                            {grupo.internos.map((corpo, corpoIndex) =>
                                              corpo ? (
                                                <div key={`${grupo.id}-interno-${corpoIndex}`}>
                                                  {renderBlocoTexto(corpo, 'muted')}
                                                </div>
                                              ) : null
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`rounded-[28px] border px-5 py-4 sm:px-6 sm:py-5 ${
                          isPastoralSection(secao)
                            ? 'border-[#d9d2c1] bg-[linear-gradient(180deg,#fffaf0_0%,#f8f0dc_100%)] shadow-[0_10px_30px_rgba(95,74,35,0.08)]'
                            : 'border-[#d8d1c4] bg-[#fffdf8] shadow-[0_10px_32px_rgba(77,58,32,0.05)]'
                        }`}
                      >
                        <div className="space-y-0">
                          {secao.itens.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className={`py-4 ${itemIndex > 0 ? 'border-t border-[#ece5d9]' : ''}`}
                            >
                              {isImageSection(secao) ? (
                                <Image
                                  src={item.conteudo}
                                  alt={secao.titulo}
                                  width={1600}
                                  height={1200}
                                  unoptimized
                                  className="w-full max-h-[28rem] rounded-[22px] object-contain border border-[#ece5d9] bg-white"
                                />
                              ) : (
                                renderItemConteudo(secao, item.conteudo)
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>

            <aside className="space-y-6 xl:sticky xl:top-6">
              <section className="rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] p-5 shadow-[0_10px_28px_rgba(77,58,32,0.05)] sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-4 h-4 text-[#365c4d]" />
                  <h3 className="font-['Georgia','Times_New_Roman',serif] text-lg font-semibold text-slate-900">Agenda</h3>
                </div>

                {agendaCultos.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum culto configurado para esta igreja.</p>
                ) : (
                  <div className="space-y-1">
                    {agendaCultos.map((culto) => (
                      <div
                        key={culto.id}
                        className="border-t border-[#ece5d9] px-1 py-3 first:border-t-0 first:pt-0"
                      >
                        <p className="text-sm font-semibold text-slate-900">{culto.nome}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {culto.dia_semana} às {culto.horario.slice(0, 5)}
                        </p>
                        {culto.descricao && (
                          <p className="text-sm text-slate-500 mt-2">{culto.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] p-5 shadow-[0_10px_28px_rgba(77,58,32,0.05)] sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-[#365c4d]" />
                  <h3 className="font-['Georgia','Times_New_Roman',serif] text-lg font-semibold text-slate-900">Canais</h3>
                </div>

                <div className="space-y-2.5">
                  {igrejaDetalhes?.site && (
                    <a
                      href={igrejaDetalhes.site}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-4 py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span>Site oficial</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {igrejaDetalhes?.email && (
                    <a
                      href={`mailto:${igrejaDetalhes.email}`}
                      className="flex items-center justify-between rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-4 py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span>{igrejaDetalhes.email}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {igrejaDetalhes?.telefone && (
                    <a
                      href={`tel:${igrejaDetalhes.telefone}`}
                      className="flex items-center justify-between rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-4 py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span>{igrejaDetalhes.telefone}</span>
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {redesSociais.map((rede) => (
                    <a
                      key={rede.id}
                      href={rede.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-4 py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span className="capitalize">{rede.tipo}</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ))}
                  {!igrejaDetalhes?.site &&
                    !igrejaDetalhes?.email &&
                    !igrejaDetalhes?.telefone &&
                    redesSociais.length === 0 && (
                      <p className="text-sm text-slate-400">Nenhum canal publico cadastrado.</p>
                    )}
                </div>
              </section>

              <section className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,#f6fdf9_0%,#eef8f1_100%)] p-5 shadow-[0_10px_28px_rgba(54,92,77,0.08)] sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">
                  Atendimento
                </p>
                <h3 className="mt-3 font-['Georgia','Times_New_Roman',serif] text-lg font-semibold text-slate-900">
                  Quer compartilhar um pedido?
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Envie um pedido de oração, aconselhamento ou visita.
                </p>
                <Link
                  href={pedidosPastoraisHref}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#365c4d] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#28463b]"
                >
                  Abrir pedidos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="mt-16">
        <div className="max-w-6xl mx-auto px-5 py-8 space-y-8">
          <section className="rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] px-5 py-5 shadow-[0_10px_28px_rgba(77,58,32,0.05)] sm:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Outras comunidades
                </p>
                <p className="text-sm leading-6 text-slate-600 max-w-xl">
                  Escolha outra igreja para ver o boletim publico correspondente.
                </p>
                {enderecoFormatado && (
                  <p className="text-sm leading-6 text-slate-500">{enderecoFormatado}</p>
                )}
              </div>

              <div className="w-full md:max-w-sm">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Comunidade
                  </label>

                  <input
                    type="search"
                    value={buscaIgreja}
                    onChange={(e) => setBuscaIgreja(e.target.value)}
                    placeholder="Buscar por nome, sigla ou local"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-700/20"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={filtroPais}
                      onChange={(e) => setFiltroPais(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-700/20"
                    >
                      <option value="">Todos os países</option>
                      {paisesDisponiveis.map((pais) => (
                        <option key={pais} value={pais}>
                          {pais}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filtroCidade}
                      onChange={(e) => setFiltroCidade(e.target.value)}
                      disabled={cidadesDisponiveis.length === 0}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-700/20"
                    >
                      <option value="">Todas as cidades</option>
                      {cidadesDisponiveis.map((cidade) => (
                        <option key={cidade} value={cidade}>
                          {cidade}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {igrejasFiltradas.length} comunidade{igrejasFiltradas.length === 1 ? '' : 's'} encontrada
                      {igrejasFiltradas.length === 1 ? '' : 's'}
                    </span>
                    {igrejasFiltradas.length > MAX_IGREJAS_EXIBIDAS ? (
                      <span>Mostrando {MAX_IGREJAS_EXIBIDAS} de {igrejasFiltradas.length}</span>
                    ) : null}
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {igrejasExibidas.map((igreja) => {
                      const selecionada = igreja.id === igrejaAtualId;
                      const local = formatIgrejaLocalizacao(igreja);

                      return (
                        <button
                          key={igreja.id}
                          type="button"
                          onClick={() => setIgrejaAtualId(igreja.id)}
                          className={`w-full rounded-[22px] border px-4 py-3 text-left transition-colors ${
                            selecionada
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-[#365c4d] hover:bg-[#faf7f0]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {igreja.sigla ? `${igreja.sigla} · ${igreja.nome}` : igreja.nome}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {local || 'Localização não informada'}
                              </p>
                            </div>
                            {selecionada ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                                Atual
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}

                    {igrejasFiltradas.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        Nenhuma comunidade encontrada com esses filtros.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="text-center">
          <p className="text-[11px] text-slate-400 uppercase tracking-[0.28em] font-medium">
            OIKOS Hub
            {igrejaSelecionada ? ` · ${igrejaSelecionada.nome}` : ''}
          </p>
          </div>
        </div>
      </footer>

      {canticoAbertoRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#ece5d9] px-5 py-4 sm:px-6">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#365c4d]">
                  {canticoAberto?.tipo === 'hinario' ? 'Hino' : 'Cântico'}
                </p>
                <h2 className="font-['Georgia','Times_New_Roman',serif] text-2xl font-semibold text-slate-900">
                  {canticoAberto?.nome || canticoAbertoRef.nome}
                </h2>
                {canticoAberto?.referencia ? (
                  <p className="text-sm text-slate-500">{canticoAberto.referencia}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setCanticoAbertoRef(null)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar letra"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {loadingCantico ? (
                <p className="text-sm text-slate-500">Carregando letra...</p>
              ) : !canticoAberto?.letra ? (
                <p className="text-sm text-slate-500">A letra deste cântico não está disponível no momento.</p>
              ) : (
                <div className="space-y-6">
                  {(canticoAberto.autor_letra || canticoAberto.compositor) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                      {canticoAberto.autor_letra ? <p>Letra: {canticoAberto.autor_letra}</p> : null}
                      {canticoAberto.compositor ? <p>Música: {canticoAberto.compositor}</p> : null}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap font-['Georgia','Times_New_Roman',serif] text-lg leading-9 text-slate-800 sm:text-[1.35rem]">
                    {canticoAberto.letra}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
