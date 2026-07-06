'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Library,
  MapPin,
  MessageCircle,
  Music,
  Phone,
  Printer,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Locale } from '@/i18n/config';
import { formatCountryByLocale, formatDateByLocale } from '@/i18n/format';
import { useLocale, useTranslations } from '@/i18n/provider';
import { buildAuthenticatedHeaders } from '@/lib/auth-headers';
import { resolveLocalizedText } from '@/lib/church-i18n';
import type { IgrejaSelecionavel } from '@/lib/church-utils';
import { formatIgrejaLocalizacao } from '@/lib/church-utils';

interface BoletimItem {
  id: string;
  secao_id: string | null;
  conteudo: string;
  imagem_url?: string | null;
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
  logo_url: string | null;
  horario_publicacao_boletim: string | null;
  dia_publicacao_boletim: number | null;
  timezone_boletim: string | null;
  apresentacao_titulo: string | null;
  apresentacao_texto: string | null;
  apresentacao_titulo_i18n?: Partial<Record<Locale, string>> | null;
  apresentacao_texto_i18n?: Partial<Record<Locale, string>> | null;
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

interface PublicBulletinClientProps {
  igrejaSlug: string;
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

export default function PublicBulletinClient({ igrejaSlug }: PublicBulletinClientProps) {
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
  const [loadingIgreja, setLoadingIgreja] = useState(true);
  const [loadingBoletim, setLoadingBoletim] = useState(true);
  const [canticoAbertoRef, setCanticoAbertoRef] = useState<CanticoAbertoRef | null>(null);
  const [canticoAberto, setCanticoAberto] = useState<CanticoModalData | null>(null);
  const [loadingCantico, setLoadingCantico] = useState(false);
  const [sobreIgrejaAberto, setSobreIgrejaAberto] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [cadaDiaCopiado, setCadaDiaCopiado] = useState(false);
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

  const apresentacaoTitulo = useMemo(
    () =>
      resolveLocalizedText(
        igrejaDetalhes?.apresentacao_titulo_i18n,
        locale,
        igrejaDetalhes?.apresentacao_titulo
      ),
    [igrejaDetalhes?.apresentacao_titulo_i18n, igrejaDetalhes?.apresentacao_titulo, locale]
  );
  const apresentacaoTexto = useMemo(
    () =>
      resolveLocalizedText(
        igrejaDetalhes?.apresentacao_texto_i18n,
        locale,
        igrejaDetalhes?.apresentacao_texto
      ),
    [igrejaDetalhes?.apresentacao_texto_i18n, igrejaDetalhes?.apresentacao_texto, locale]
  );
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

  const linkBoletim = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${igrejaSlug}`;
  }, [igrejaSlug]);

  const mensagemCompartilhamento = useMemo(() => {
    const nomeIgreja = igrejaDetalhes?.nome_completo || igrejaSelecionada?.nome || 'nossa igreja';

    return (
      `📖 *Paz do Senhor!* 🙏\n\n` +
      `Compartilho com você o boletim da *${nomeIgreja}*.\n\n` +
      `_"Como são formosos os pés dos que anunciam coisas boas!"_ (Romanos 10.15)\n\n` +
      `Que a Palavra de Deus edifique o seu coração nesta semana. Venha celebrar conosco a comunhão dos santos! 🕊️✨\n\n` +
      `👉 ${linkBoletim}`
    );
  }, [igrejaDetalhes?.nome_completo, igrejaSelecionada?.nome, linkBoletim]);

  const copiarParaAreaTransferencia = async (texto: string) => {
    // Clipboard API moderna (requer contexto seguro: HTTPS ou localhost).
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(texto);
        return true;
      } catch (error) {
        console.error('Falha na Clipboard API, tentando fallback:', error);
      }
    }

    // Fallback para contextos não seguros (ex.: acesso via HTTP em celular).
    try {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copiado = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copiado;
    } catch (error) {
      console.error('Erro ao copiar para a área de transferência:', error);
      return false;
    }
  };

  const copiarLinkBoletim = async () => {
    if (!igrejaSelecionada) return;

    const copiado = await copiarParaAreaTransferencia(mensagemCompartilhamento);

    if (copiado) {
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2500);
    }
  };

  const copiarCadaDia = async (texto: string) => {
    const copiado = await copiarParaAreaTransferencia(texto);

    if (copiado) {
      setCadaDiaCopiado(true);
      window.setTimeout(() => setCadaDiaCopiado(false), 2500);
    }
  };

  const compartilharBoletimWhatsApp = () => {
    if (!igrejaSelecionada) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagemCompartilhamento)}`, '_blank');
  };

  const imprimirLiturgiaPdf = (card: LiturgiaCard) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const headerBottom = 30;
    const bottomY = ph - 10;
    const contentWidth = pw - marginX * 2;

    const drawHeader = () => {
      doc.setFillColor(16, 60, 48);
      doc.rect(0, 0, pw, headerBottom - 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(getTituloCardLiturgia(card.nome).toUpperCase(), pw / 2, 11, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        [nomeExibicaoIgreja, dataEdicao].filter(Boolean).join(' · '),
        pw / 2,
        18,
        { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(16, 60, 48);
      doc.line(marginX, headerBottom, pw - marginX, headerBottom);
    };

    let y = headerBottom + 6;
    drawHeader();

    const garantirEspaco = (altura: number) => {
      if (y + altura > bottomY) {
        doc.addPage();
        y = headerBottom + 6;
        drawHeader();
      }
    };

    card.grupos.forEach((grupo, index) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      const titulo = `${index + 1}. ${grupo.titulo.toUpperCase()}${grupo.horario ? ' / ' + grupo.horario : ''}`;
      const tituloLinhas = doc.splitTextToSize(titulo, contentWidth);
      garantirEspaco(tituloLinhas.length * 6);
      doc.setTextColor(0, 0, 0);
      doc.text(tituloLinhas, marginX, y);
      y += tituloLinhas.length * 6 + 1.5;

      grupo.publicos.forEach((publico) => {
        if (!publico.trim()) return;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(55, 55, 55);
        const linhas = doc.splitTextToSize(publico.trim(), contentWidth - 4);
        garantirEspaco(linhas.length * 5);
        doc.text(linhas, marginX + 3, y);
        y += linhas.length * 5;
      });

      y += 4.2;
    });

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let active = true;

    const carregarIgreja = async () => {
      try {
        setLoadingIgreja(true);
        const response = await fetch(`/api/igrejas/slug/${encodeURIComponent(igrejaSlug)}`);
        const data = await lerJsonSeguro(response);

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao carregar igreja.');
        }

        if (!active) return;

        const igreja = data.igreja as IgrejaSelecionavel | null;
        setIgrejas(igreja ? [igreja] : []);
        setIgrejaAtualId(igreja?.id || null);
      } catch (error: unknown) {
        console.error('Erro ao carregar igreja:', getMensagemErro(error, 'Erro ao carregar igreja.'));
        if (!active) return;
        setIgrejas([]);
        setIgrejaAtualId(null);
      } finally {
        if (active) {
          setLoadingIgreja(false);
        }
      }
    };

    carregarIgreja();

    return () => {
      active = false;
    };
  }, [igrejaSlug]);

  useEffect(() => {
    if (authLoading || !igrejaAtualId) return;

    let active = true;

    const carregarBoletim = async () => {
      try {
        setLoadingBoletim(true);

        const params = new URLSearchParams({ igreja_id: igrejaAtualId, locale });
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
  }, [igrejaAtualId, authLoading, locale]);

  useEffect(() => {
    if (loadingIgreja || igrejaAtualId) return;
    setLoadingBoletim(false);
    setIgrejaDetalhes(null);
    setBoletimSecoes([]);
    setAgendaCultos([]);
    setRedesSociais([]);
  }, [igrejaAtualId, loadingIgreja]);

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

  const loading = loadingIgreja || loadingBoletim;

  const isImageSection = (secao: BoletimSecao) => secao.tipo === 'imagem_tema';
  const isLiturgiaSection = (secao: BoletimSecao) => secao.tipo === 'liturgia';
  const isPastoralSection = (secao: BoletimSecao) => secao.tipo === 'palavra_pastoral';
  const isAgendaSection = (secao: BoletimSecao) => secao.tipo === 'agenda';
  const isAvisosSection = (secao: BoletimSecao) => secao.tipo === 'avisos';
  const isPedidosOracaoSection = (secao: BoletimSecao) =>
    /pedido[s]?\s*de\s*ora/i.test(secao.titulo);
  const isCadaDiaSection = (secao: BoletimSecao) =>
    secao.tipo === 'cada_dia' ||
    secao.id === 'cada-dia-devocional' ||
    secao.titulo.trim().toLowerCase() === 'cada dia';
  const nomeExibicaoIgreja =
    igrejaDetalhes?.nome_completo || igrejaSelecionada?.nome || 'Boletim';
  const logoIgrejaUrl = igrejaDetalhes?.logo_url?.trim() || null;

  const boletinsAnterioresHref = igrejaAtualId
    ? `/boletins-anteriores?igreja_id=${igrejaAtualId}`
    : '/boletins-anteriores';
  const recursosHref = igrejaAtualId
    ? `/recursos?igreja_id=${igrejaAtualId}`
    : '/recursos';
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

  const parseInlineLinks = (text: string): React.ReactNode => {
    const urlRegex = /(https?:\/\/[^\s,;]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      parts.push(
        <a
          key={match.index}
          href={match[1]}
          target="_blank"
          rel="noreferrer"
          className="text-[#365c4d] underline underline-offset-2 break-all hover:text-[#2a4a3d]"
        >
          {match[1]}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    if (parts.length === 0) return text;
    if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
    return <>{parts}</>;
  };

  const parseInlinePastoral = (text: string): React.ReactNode => {
    // Order matters: ** before *, __ before _
    const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(parseInlineLinks(text.slice(lastIndex, match.index)));
      if (match[1])      parts.push(<strong key={match.index} className="font-bold">{match[2]}</strong>);
      else if (match[3]) parts.push(<u key={match.index} className="underline underline-offset-2">{match[4]}</u>);
      else if (match[5]) parts.push(<em key={match.index} className="italic">{match[6]}</em>);
      else if (match[7]) parts.push(<em key={match.index} className="italic">{match[8]}</em>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) parts.push(parseInlineLinks(text.slice(lastIndex)));
    if (parts.length === 0) return parseInlineLinks(text);
    if (parts.length === 1) return parts[0];
    return <>{parts}</>;
  };

  const renderPastoralContent = (texto: string): React.ReactNode => {
    const blocos = texto.split('\n\n');
    const last = blocos[blocos.length - 1]?.trim() ?? '';
    const isAutor =
      blocos.length > 1 &&
      last.length <= 80 &&
      !last.includes('\n') &&
      !last.startsWith('#') &&
      !last.startsWith('>') &&
      !/\*\*/.test(last);

    const mainText = isAutor ? blocos.slice(0, -1).join('\n\n') : texto;
    const autor = isAutor ? last : '';

    const serifBase = "font-['Georgia','Times_New_Roman',serif]";

    return (
      <div className="space-y-3">
        {mainText.split('\n').map((linha, i) => {
          const v = linha.trim();

          if (!v) return <div key={i} className="h-2" />;

          if (v.startsWith('# ')) return (
            <h2 key={i} className={`${serifBase} font-bold text-[21px] sm:text-[23px] leading-snug tracking-tight text-[#1e1208]`}>
              {parseInlinePastoral(v.slice(2))}
            </h2>
          );
          if (v.startsWith('## ')) return (
            <h3 key={i} className={`${serifBase} font-bold text-[18px] sm:text-[20px] leading-snug text-[#2a1a0e]`}>
              {parseInlinePastoral(v.slice(3))}
            </h3>
          );
          if (v.startsWith('### ')) return (
            <h4 key={i} className={`${serifBase} font-semibold text-[16px] sm:text-[18px] leading-snug text-[#3a2a1e]`}>
              {parseInlinePastoral(v.slice(4))}
            </h4>
          );
          if (v.startsWith('> ')) return (
            <blockquote key={i} className="border-l-[3px] border-[#a07040] pl-4 py-0.5 my-1">
              <p className={`${serifBase} italic text-[17px] sm:text-[18px] leading-8 text-[#4a3020]`}>
                {parseInlinePastoral(v.slice(2))}
              </p>
            </blockquote>
          );

          return (
            <p key={i} className={`${serifBase} text-[17px] sm:text-[18px] leading-[1.9] text-[#2a1a0e] whitespace-pre-line`}>
              {parseInlinePastoral(v)}
            </p>
          );
        })}

        {autor && (
          <div className="mt-2 pt-3 border-t border-[#d5c8b0] flex items-center justify-end gap-2">
            <p className={`${serifBase} italic text-[14px] sm:text-[15px] text-[#7a5c40]`}>
              — {autor}
            </p>
          </div>
        )}
      </div>
    );
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
                className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl sm:rounded-full border border-[#d8d1c4] bg-[#faf7f0] px-3 py-1.5 text-left text-sm font-medium text-[#365c4d] transition-colors hover:border-[#365c4d] hover:bg-[#f4eee1]"
              >
                <span>{cantico.rotulo}:</span>
                <span className="underline underline-offset-2 break-words">{cantico.nome}</span>
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
                className={`${textoClassName} flex items-start gap-2 text-[15px] leading-7 sm:text-base break-words`}
              >
                <span className="pt-[0.12rem] text-[#365c4d]">•</span>
                <span className="flex-1 min-w-0 break-words">{parseInlineLinks(itemLista)}</span>
              </p>
            );
          }

          return (
            <p
              key={`${valor}-${index}`}
              className={`${textoClassName} text-[15px] whitespace-pre-line leading-7 sm:text-base break-words`}
            >
              {parseInlineLinks(valor)}
            </p>
          );
        })}
      </div>
    );
  };

  const renderCadaDiaConteudo = (conteudo: string) => {
    const fonteMatch = conteudo.match(/\n\nFonte:\s*(https?:\/\/\S+)/);
    const creditoMatch = conteudo.match(/\n\nCr(?:e|\u00e9|Ã©)dito:\s*([\s\S]+)$/i);
    const fonteUrl = fonteMatch?.[1] || 'https://www.lpc.org.br/cadadia/site/';
    const credito = creditoMatch?.[1]?.trim() || '';
    const texto = conteudo
      .replace(/\n\nFonte:\s*https?:\/\/\S+[\s\S]*$/i, '')
      .trim();
    const [titulo, ...corpoPartes] = texto.split('\n\n');
    const corpo = corpoPartes.join('\n\n').trim();
    const textoCompartilhamento = `*${titulo}*\n\n${corpo}\n\nFonte: ${fonteUrl}`;

    return (
      <div className="space-y-5">
        {renderBlocoTexto(texto)}
        <div className="rounded-[22px] border border-[#ece5d9] bg-[#faf7f0] px-3 sm:px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <a
              href={fonteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-[#365c4d] underline underline-offset-4 break-all"
            >
              <span className="break-all">Fonte: {fonteUrl}</span>
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
            </a>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(textoCompartilhamento)}`,
                    '_blank'
                  )
                }
                title="Compartilhar no WhatsApp"
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-1.5 py-1 text-[11px] text-slate-400 transition-colors hover:border-[#d8d1c4] hover:text-[#365c4d]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => copiarCadaDia(textoCompartilhamento)}
                title="Copiar para compartilhar no WhatsApp"
                className="inline-flex items-center gap-1 rounded-full border border-transparent px-1.5 py-1 text-[11px] text-slate-400 transition-colors hover:border-[#d8d1c4] hover:text-[#365c4d]"
              >
                {cadaDiaCopiado ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{cadaDiaCopiado ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
          {credito ? (
            <p className="mt-3 text-xs sm:text-sm leading-6 text-slate-600 break-words">{credito}</p>
          ) : null}
        </div>
      </div>
    );
  };

  const renderPedidosOracaoConteudo = (conteudo: string) => {
    const linhas = conteudo.split('\n');
    return (
      <div className="divide-y divide-[#e8e2d8]">
        {linhas.map((linha, index) => {
          const valor = linha.trim();
          if (!valor) return null;
          return (
            <div key={index} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-[0.35rem] h-2 w-2 flex-shrink-0 rounded-full bg-[#365c4d]" />
              <p className="text-[15px] leading-7 text-slate-700 sm:text-base break-words">
                {parseInlineLinks(valor)}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemConteudo = (
    secao: BoletimSecao,
    conteudo: string,
    imagemUrl?: string | null
  ) => {
    if (isCadaDiaSection(secao)) {
      return renderCadaDiaConteudo(conteudo);
    }

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
        const imagem = imagemUrl?.trim();
        return (
          <div className="space-y-2">
            <p className="text-[15px] font-semibold leading-6 text-slate-900 sm:text-base">
              {aviso.titulo}
            </p>
            {imagem ? (
              <Image
                src={imagem}
                alt={aviso.titulo}
                width={1200}
                height={900}
                unoptimized
                className="w-full max-h-96 rounded-[18px] border border-[#ece5d9] bg-white object-contain"
              />
            ) : null}
            <div>{renderBlocoTexto(aviso.corpo)}</div>
          </div>
        );
      }
    }

    if (isPastoralSection(secao)) {
      return renderPastoralContent(conteudo);
    }

    if (isPedidosOracaoSection(secao)) {
      return renderPedidosOracaoConteudo(conteudo);
    }

    if (!isLiturgiaSection(secao)) {
      return renderBlocoTexto(conteudo);
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
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4efe5_0%,#f7f3eb_42%,#f2eee5_100%)] text-slate-900">
      <header className="bg-[#17352b] text-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold text-white truncate">{t('home.bulletinTitle')}</h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {user ? (
              <>
                <button
                  onClick={() => router.push('/admin')}
                  className="text-xs sm:text-sm font-medium text-emerald-200 hover:text-white px-2 sm:px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t('home.panel')}
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    window.location.reload();
                  }}
                  className="text-xs sm:text-sm font-medium text-emerald-300/70 hover:text-white px-2 sm:px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t('home.signOut')}
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="text-xs sm:text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 sm:px-4 py-2 rounded-md transition-colors whitespace-nowrap"
              >
                {t('home.signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 pb-16 sm:px-6 sm:pt-8">
        <section className="-mx-3 sm:mx-0 rounded-none sm:rounded-[30px] border-b sm:border border-[#d8d1c4] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf7ef_100%)] px-4 py-5 shadow-[0_12px_40px_rgba(77,58,32,0.07)] sm:mt-6 sm:px-7 sm:py-8">
          <div className="space-y-4 sm:space-y-5">
            <div className="space-y-4 sm:space-y-5">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] sm:tracking-[0.28em] text-[#365c4d]">{t('home.publicEdition')}</p>
              <div className="flex items-center gap-3 sm:gap-4">
                {logoIgrejaUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={logoIgrejaUrl}
                    alt={`Logo ${nomeExibicaoIgreja}`}
                    className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-full object-cover border border-[#d8d1c4] bg-white shadow-sm"
                  />
                )}
                <div className="space-y-2 min-w-0">
                  <h2 className="font-['Georgia','Times_New_Roman',serif] text-2xl sm:text-3xl lg:text-4xl leading-tight font-semibold text-slate-900 break-words">
                    {nomeExibicaoIgreja}
                  </h2>
                  <p className="text-xs sm:text-sm uppercase tracking-[0.18em] sm:tracking-[0.22em] text-slate-500 break-words">
                    {dataEdicao ? t('home.editionOf', { date: dataEdicao }) : t('home.publicBulletin')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-slate-600">
                <span className="inline-flex items-start gap-2 rounded-2xl sm:rounded-full border border-[#ded7cb] bg-[#faf7f0] px-3 py-1.5 text-[#365c4d] break-words">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="break-words">{enderecoFormatado || localizacao || t('home.locationUnknown')}</span>
                </span>
              </div>
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                  <Link
                    href={pedidosPastoraisHref}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#365c4d] hover:bg-[#28463b] px-5 py-3 text-sm sm:text-base font-semibold text-white shadow-sm transition-colors text-center sm:min-w-[180px]"
                  >
                    <span className="truncate">Pedidos de oração</span>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" />
                  </Link>
                  {temApresentacaoIgreja ? (
                    <button
                      type="button"
                      onClick={() => setSobreIgrejaAberto((valorAtual) => !valorAtual)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#c79a67] bg-[#fff7ea] px-5 py-3 text-sm sm:text-base font-semibold text-[#7a5123] transition-colors hover:bg-[#fceede] text-center sm:min-w-[180px]"
                    >
                      <span className="truncate">{sobreIgrejaAberto ? 'Ocultar sobre a igreja' : 'Sobre a igreja'}</span>
                      <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${sobreIgrejaAberto ? 'rotate-90' : ''}`} />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-[13px]">
                  <button
                    onClick={compartilharBoletimWhatsApp}
                    disabled={!igrejaSelecionada}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-[#365c4d] disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{t('home.shareWhatsApp')}</span>
                  </button>
                  <button
                    onClick={copiarLinkBoletim}
                    disabled={!igrejaSelecionada}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-[#365c4d] disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {linkCopiado ? (
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                    )}
                    <span>{linkCopiado ? t('home.linkCopied') : t('home.copyLink')}</span>
                  </button>
                  <Link
                    href={boletinsAnterioresHref}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-[#365c4d] transition-colors"
                  >
                    <span>{t('home.pastBulletins')}</span>
                  </Link>
                  <Link
                    href={recursosHref}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-[#365c4d] transition-colors"
                  >
                    <Library className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{t('home.resources')}</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {user && (
          <div className="mt-3 sm:mt-5 -mx-3 sm:mx-0 flex items-start gap-3 border-y sm:border border-blue-200 bg-[#f8fbff] px-4 py-3 sm:rounded-xl">
            <Eye className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-blue-700">
              Logado. O painel administrativo segue disponivel para gestao interna da igreja selecionada.
            </p>
          </div>
        )}

        {!loading && temApresentacaoIgreja && sobreIgrejaAberto && (
          <section
            ref={sobreIgrejaRef}
            id="sobre-igreja"
            className="-mx-3 sm:mx-0 mt-4 sm:mt-8 overflow-hidden rounded-none sm:rounded-[32px] border-y sm:border border-[#dfd1bf] bg-[linear-gradient(135deg,#fffaf2_0%,#f7efe1_55%,#f2e6d2_100%)] shadow-[0_18px_48px_rgba(101,72,31,0.08)]"
          >
            <div className="grid gap-6 sm:gap-8 px-4 py-5 sm:px-7 sm:py-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
              <div className="space-y-4 sm:space-y-5 min-w-0">
                <div className="space-y-2">
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] sm:tracking-[0.28em] text-[#9a6a34]">
                    Sobre a igreja
                  </p>
                  <h3 className="font-['Georgia','Times_New_Roman',serif] text-2xl sm:text-3xl font-semibold leading-tight text-slate-900 break-words">
                    {apresentacaoTitulo || nomeExibicaoIgreja}
                  </h3>
                </div>

                <div className="space-y-4 text-[15px] leading-7 sm:leading-8 text-slate-700 sm:text-base break-words">
                  {paragrafosApresentacao.map((paragrafo, index) => (
                    <p key={`apresentacao-${index}`}>{paragrafo}</p>
                  ))}
                </div>
              </div>

              <div className="space-y-4 min-w-0">
                {galeriaApresentacao[0] ? (
                  <Image
                    src={galeriaApresentacao[0]}
                    alt={apresentacaoTitulo || nomeExibicaoIgreja}
                    width={1600}
                    height={1100}
                    unoptimized
                    className="h-56 sm:h-[22rem] w-full rounded-[22px] sm:rounded-[28px] border border-[#eadfce] object-cover shadow-[0_12px_30px_rgba(74,53,28,0.12)]"
                  />
                ) : null}

                {youtubeApresentacaoId ? (
                  <div className="overflow-hidden rounded-[22px] sm:rounded-[28px] border border-[#eadfce] bg-black shadow-[0_12px_30px_rgba(74,53,28,0.12)]">
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
              <div className="border-t border-[#e8dccb] px-4 py-4 sm:px-7 sm:py-6">
                <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                  {galeriaApresentacao.slice(1).map((foto, index) => (
                    <Image
                      key={`${foto}-${index}`}
                      src={foto}
                      alt={`${nomeExibicaoIgreja} ${index + 2}`}
                      width={1200}
                      height={800}
                      unoptimized
                      className="h-28 sm:h-40 w-full rounded-[18px] sm:rounded-[22px] border border-[#eadfce] object-cover shadow-[0_10px_24px_rgba(74,53,28,0.08)]"
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
          <div className="mt-5 sm:mt-8 grid gap-6 sm:gap-10 xl:grid-cols-[minmax(0,1.72fr)_300px] xl:items-start">
            <section className="space-y-8 sm:space-y-10 min-w-0">
              {boletimSecoes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[22px] sm:rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] py-16 sm:py-24 px-4 text-center">
                  <Music className="w-10 h-10 text-slate-300" />
                  <p className="text-sm text-slate-400">Nenhuma seção de boletim publicada para esta igreja.</p>
                </div>
              ) : (
                boletimSecoes.map((secao) => (
                  <article
                    key={secao.id}
                    className="space-y-4 sm:space-y-5"
                  >
                    {!isImageSection(secao) && (
                      <div className="space-y-2 border-b border-[#d8d1c4] pb-3">
                        <p className="text-[#365c4d] text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] sm:tracking-[0.28em] mb-1 sm:mb-2">
                          Seção {numeracaoSecoesVisiveis.get(secao.id)}
                        </p>
                        <h3 className="font-['Georgia','Times_New_Roman',serif] text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 break-words">
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
                            className="rounded-[22px] sm:rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] px-4 py-4 shadow-[0_10px_32px_rgba(77,58,32,0.05)] sm:px-6 sm:py-5"
                          >
                            <div className="space-y-0">
                              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#ece5d9] pb-4">
                                <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                                  {getTituloCardLiturgia(card.nome)}
                                </p>
                                <div className="flex flex-shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => imprimirLiturgiaPdf(card)}
                                    title="Imprimir PDF"
                                    className="inline-flex items-center gap-1 rounded-full border border-transparent px-1.5 py-1 text-[11px] text-slate-400 transition-colors hover:border-[#d8d1c4] hover:text-[#365c4d]"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">PDF</span>
                                  </button>
                                </div>
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
                        className={`rounded-[22px] sm:rounded-[28px] border ${
                          isPastoralSection(secao)
                            ? 'border-[#cfc4a8] bg-[linear-gradient(160deg,#fffef8_0%,#fdf5e0_60%,#f9edcc_100%)] shadow-[0_12px_36px_rgba(90,60,20,0.10)]'
                            : 'border-[#d8d1c4] bg-[#fffdf8] shadow-[0_10px_32px_rgba(77,58,32,0.05)]'
                        } ${isPastoralSection(secao) ? 'px-5 py-6 sm:px-8 sm:py-7' : 'px-4 py-4 sm:px-6 sm:py-5'}`}
                      >
                        <div className="space-y-0">
                          {secao.itens.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className={`${isPastoralSection(secao) ? 'py-0' : 'py-3 sm:py-4'} ${itemIndex > 0 ? 'border-t border-[#ece5d9]' : ''}`}
                            >
                              {isImageSection(secao) ? (
                                <Image
                                  src={item.conteudo}
                                  alt={secao.titulo}
                                  width={1600}
                                  height={1200}
                                  unoptimized
                                  className="w-full max-h-72 sm:max-h-[28rem] rounded-[18px] sm:rounded-[22px] object-contain border border-[#ece5d9] bg-white"
                                />
                              ) : (
                                renderItemConteudo(secao, item.conteudo, item.imagem_url)
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

            <aside className="space-y-5 sm:space-y-6 min-w-0 xl:sticky xl:top-6">
              <section className="rounded-[22px] sm:rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] p-4 shadow-[0_10px_28px_rgba(77,58,32,0.05)] sm:p-6">
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

              <section className="rounded-[22px] sm:rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] p-4 shadow-[0_10px_28px_rgba(77,58,32,0.05)] sm:p-6">
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
                      className="flex items-center justify-between gap-3 rounded-[18px] sm:rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span className="truncate">Site oficial</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  )}
                  {igrejaDetalhes?.email && (
                    <a
                      href={`mailto:${igrejaDetalhes.email}`}
                      className="flex items-center justify-between gap-3 rounded-[18px] sm:rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span className="truncate min-w-0">{igrejaDetalhes.email}</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  )}
                  {igrejaDetalhes?.telefone && (
                    <a
                      href={`tel:${igrejaDetalhes.telefone}`}
                      className="flex items-center justify-between gap-3 rounded-[18px] sm:rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span className="truncate min-w-0">{igrejaDetalhes.telefone}</span>
                      <Phone className="w-4 h-4 flex-shrink-0" />
                    </a>
                  )}
                  {redesSociais.map((rede) => (
                    <a
                      key={rede.id}
                      href={rede.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-[18px] sm:rounded-[20px] border border-[#ece5d9] bg-[#faf7f0] px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-700 transition-colors hover:border-[#365c4d] hover:text-[#365c4d]"
                    >
                      <span className="capitalize truncate min-w-0">{rede.tipo}</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
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

              <section className="rounded-[22px] sm:rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,#f6fdf9_0%,#eef8f1_100%)] p-4 shadow-[0_10px_28px_rgba(54,92,77,0.08)] sm:p-6">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] sm:tracking-[0.28em] text-emerald-700">
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

      <footer className="mt-12 sm:mt-16">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-8">
          <div className="text-center">
          <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-[0.18em] sm:tracking-[0.28em] font-medium break-words">
            OIKOS Hub
            {igrejaSelecionada ? ` · ${igrejaSelecionada.nome}` : ''}
          </p>
          </div>
        </div>
      </footer>

      {canticoAbertoRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex max-h-[95vh] sm:max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] sm:rounded-[28px] border border-[#d8d1c4] bg-[#fffdf8] shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-[#ece5d9] px-4 py-3 sm:px-6 sm:py-4">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.22em] sm:tracking-[0.28em] text-[#365c4d]">
                  {canticoAberto?.tipo === 'hinario' ? 'Hino' : 'Cântico'}
                </p>
                <h2 className="font-['Georgia','Times_New_Roman',serif] text-lg sm:text-2xl font-semibold text-slate-900 break-words">
                  {canticoAberto?.nome || canticoAbertoRef.nome}
                </h2>
                {canticoAberto?.referencia ? (
                  <p className="text-xs sm:text-sm text-slate-500 break-words">{canticoAberto.referencia}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setCanticoAbertoRef(null)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 flex-shrink-0"
                aria-label="Fechar letra"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6">
              {loadingCantico ? (
                <p className="text-sm text-slate-500">Carregando letra...</p>
              ) : !canticoAberto?.letra ? (
                <p className="text-sm text-slate-500">A letra deste cântico não está disponível no momento.</p>
              ) : (
                <div className="space-y-5 sm:space-y-6">
                  {(canticoAberto.autor_letra || canticoAberto.compositor) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
                      {canticoAberto.autor_letra ? <p>Letra: {canticoAberto.autor_letra}</p> : null}
                      {canticoAberto.compositor ? <p>Música: {canticoAberto.compositor}</p> : null}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words font-['Georgia','Times_New_Roman',serif] text-base leading-7 text-slate-800 sm:text-lg sm:leading-9 lg:text-[1.35rem]">
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
