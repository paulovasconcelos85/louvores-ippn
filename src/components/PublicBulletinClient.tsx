'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Library,
  MapPin,
  Menu,
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

// Folha de papel com filete duplo, à maneira das páginas impressas em Genebra.
const folha =
  'relative rounded-md border border-[#1e1208]/15 bg-[#fffcf4] outline outline-1 outline-offset-[-7px] outline-[#1e1208]/10 shadow-[0_1px_2px_rgba(30,18,8,0.04),0_20px_44px_-22px_rgba(30,18,8,0.28)]';

// Capitular rubricada no primeiro parágrafo.
const capitular =
  'first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:font-fell first-letter:text-[4.81rem] first-letter:leading-[0.8] first-letter:text-[#8b2a1d]';

const linkCanal =
  'flex items-center justify-between gap-3 px-1 py-3 text-[22px] text-[#2a1a0e] transition-colors hover:text-[#8b2a1d]';

const botaoDiscreto =
  'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[1.219rem]/[1.44] italic text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#8b2a1d]';

function paraRomano(numero: number) {
  const tabela: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let resto = numero;
  let resultado = '';
  for (const [valor, simbolo] of tabela) {
    while (resto >= valor) {
      resultado += simbolo;
      resto -= valor;
    }
  }
  return resultado;
}

function Ornamento({ className = '', pequeno = false }: { className?: string; pequeno?: boolean }) {
  const filete = pequeno ? 'w-8' : 'w-14 sm:w-24';
  return (
    <div className={`flex items-center justify-center gap-3 text-[#8b2a1d] ${className}`} aria-hidden>
      <span className={`h-px ${filete} bg-gradient-to-r from-transparent to-[#1e1208]/35`} />
      <span className={pequeno ? 'text-[1.219rem]/[1.44] leading-none' : 'text-[1.625rem]/[1.4] leading-none'}>❦</span>
      <span className={`h-px ${filete} bg-gradient-to-l from-transparent to-[#1e1208]/35`} />
    </div>
  );
}

// Florões nos cantos da folha.
function Cantoneiras() {
  const base = 'pointer-events-none absolute text-[17px] leading-none text-[#8b2a1d]/60';
  return (
    <>
      <span className={`${base} left-3 top-2.5`} aria-hidden>✥</span>
      <span className={`${base} right-3 top-2.5`} aria-hidden>✥</span>
      <span className={`${base} bottom-2.5 left-3`} aria-hidden>✥</span>
      <span className={`${base} bottom-2.5 right-3`} aria-hidden>✥</span>
    </>
  );
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
  const [menuSecoesAberto, setMenuSecoesAberto] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [cadaDiaCopiado, setCadaDiaCopiado] = useState(false);
  const [itemCopiadoId, setItemCopiadoId] = useState<string | null>(null);
  const [informativoAbertoId, setInformativoAbertoId] = useState<string | null>(null);
  const informativoRefs = useRef<Map<string, HTMLDetailsElement>>(new Map());
  const ancoraScrollRef = useRef<{ chave: string; topAntes: number } | null>(null);

  useLayoutEffect(() => {
    const ancora = ancoraScrollRef.current;
    ancoraScrollRef.current = null;
    if (!ancora) return;

    const elemento = informativoRefs.current.get(ancora.chave);
    if (!elemento) return;

    const topDepois = elemento.getBoundingClientRect().top;
    const delta = topDepois - ancora.topAntes;
    if (delta !== 0) {
      window.scrollBy(0, delta);
    }
  }, [informativoAbertoId]);
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
    setMenuSecoesAberto(false);
  }, [igrejaAtualId]);

  const irParaSecao = (secaoId: string) => {
    setMenuSecoesAberto(false);
    requestAnimationFrame(() => {
      document.getElementById(`secao-${secaoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

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

  const copiarItemCompartilhamento = async (itemId: string, texto: string) => {
    const copiado = await copiarParaAreaTransferencia(texto);

    if (copiado) {
      setItemCopiadoId(itemId);
      window.setTimeout(() => setItemCopiadoId((atual) => (atual === itemId ? null : atual)), 2500);
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
  const isInformativoSection = (secao: BoletimSecao) => secao.tipo === 'informativo';
  const isNoticiasMesSection = (secao: BoletimSecao) => secao.tipo === 'noticias_mes';
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
          className="text-[#365c4d] underline decoration-[#365c4d]/40 underline-offset-2 break-all hover:text-[#8b2a1d]"
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

    const serifBase = 'font-garamond';
    const linhasPrincipais = mainText.split('\n');
    const indicePrimeiroParagrafo = linhasPrincipais.findIndex((linha) => {
      const v = linha.trim();
      return v && !v.startsWith('#') && !v.startsWith('>');
    });

    return (
      <div className="space-y-3">
        {linhasPrincipais.map((linha, i) => {
          const v = linha.trim();

          if (!v) return <div key={i} className="h-2" />;

          if (v.startsWith('# ')) return (
            <h2 key={i} className="font-fell text-[31px] sm:text-[36px] leading-snug text-center text-[#1e1208]">
              {parseInlinePastoral(v.slice(2))}
            </h2>
          );
          if (v.startsWith('## ')) return (
            <h3 key={i} className="font-fell text-[26px] sm:text-[30px] leading-snug text-[#2a1a0e]">
              {parseInlinePastoral(v.slice(3))}
            </h3>
          );
          if (v.startsWith('### ')) return (
            <h4 key={i} className={`${serifBase} font-semibold text-[21px] sm:text-[23px] leading-snug text-[#3a2a1e]`}>
              {parseInlinePastoral(v.slice(4))}
            </h4>
          );
          if (v.startsWith('> ')) return (
            <blockquote key={i} className="border-l-2 border-[#8b2a1d]/50 pl-5 py-0.5 my-2">
              <p className={`${serifBase} italic text-[23px] sm:text-[26px] leading-[2.6rem] text-[#4a3020]`}>
                {parseInlinePastoral(v.slice(2))}
              </p>
            </blockquote>
          );

          return (
            <p key={i} className={`${serifBase} text-[23px] sm:text-[26px] leading-[1.85] text-[#2a1a0e] whitespace-pre-line ${i === indicePrimeiroParagrafo ? capitular : ''}`}>
              {parseInlinePastoral(v)}
            </p>
          );
        })}

        {autor && (
          <div className="mt-4 pt-4 border-t border-dotted border-[#1e1208]/25 flex items-center justify-end gap-2">
            <p className={`${serifBase} italic text-[21px] sm:text-[23px] text-[#7a5c40]`}>
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
        ? 'text-[#1e1208]'
        : tone === 'muted'
          ? 'text-[#7a5c40]'
          : 'text-[#2a1a0e]';

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
                className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded-full bg-[#365c4d]/[0.07] px-4 py-1 text-left text-[21px] sm:text-[22px] text-[#365c4d] transition-colors hover:bg-[#365c4d]/[0.13]"
              >
                <span className="font-fell">{cantico.rotulo}:</span>
                <span className="italic underline decoration-[#365c4d]/40 underline-offset-2 break-words">{cantico.nome}</span>
                {cantico.numero ? <span className="text-[#7a5c40]">({cantico.numero})</span> : null}
                {cantico.tom ? <span className="text-[#7a5c40]">({cantico.tom})</span> : null}
              </button>
            );
          }

          const itemLista = extrairTextoMarcadorLista(valor);
          if (itemLista) {
            return (
              <p
                key={`${itemLista}-${index}`}
                className={`${textoClassName} flex items-start gap-2.5 text-[22px] leading-[1.75] sm:text-[23px] break-words`}
              >
                <span className="text-[#8b2a1d]" aria-hidden>❧</span>
                <span className="flex-1 min-w-0 break-words">{parseInlinePastoral(itemLista)}</span>
              </p>
            );
          }

          return (
            <p
              key={`${valor}-${index}`}
              className={`${textoClassName} text-[22px] whitespace-pre-line leading-[1.75] sm:text-[23px] break-words`}
            >
              {parseInlinePastoral(valor)}
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
        <div className="border-t border-dotted border-[#1e1208]/25 pt-3">
          <div className="flex items-start justify-between gap-2">
            <a
              href={fonteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-wrap items-center gap-2 italic text-[20px] text-[#365c4d] underline decoration-[#365c4d]/40 underline-offset-4 break-all"
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
                className={botaoDiscreto}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => copiarCadaDia(textoCompartilhamento)}
                title="Copiar para compartilhar no WhatsApp"
                className={botaoDiscreto}
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
            <p className="mt-2 italic text-[20px] leading-[1.95rem] text-[#7a5c40] break-words">{credito}</p>
          ) : null}
        </div>
      </div>
    );
  };

  const renderPedidosOracaoConteudo = (conteudo: string) => {
    const linhas = conteudo.split('\n');
    return (
      <div className="divide-y divide-dotted divide-[#1e1208]/20">
        {linhas.map((linha, index) => {
          const valor = extrairTextoMarcadorLista(linha) ?? linha.trim();
          if (!valor) return null;
          return (
            <div key={index} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex-shrink-0 text-[#8b2a1d]" aria-hidden>✠</span>
              <p className="text-[22px] leading-[1.75] text-[#2a1a0e] sm:text-[23px] break-words">
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
    imagemUrl?: string | null,
    itemId?: string
  ) => {
    if (isCadaDiaSection(secao)) {
      return renderCadaDiaConteudo(conteudo);
    }

    if (isAgendaSection(secao)) {
      const agenda = parseAgendaBoletimItem(conteudo);

      if (agenda) {
        return (
          <div>
            <p className="font-fell text-[20px] sm:text-[1.381rem]/[1.553] tracking-[0.12em] text-[#8b2a1d]">
              {formatarDataAgenda(agenda.data, locale)}
              {agenda.temHora ? ` · ${agenda.hora}` : ''}
            </p>
            <p className="mt-1 text-[22px] leading-[1.75] text-[#2a1a0e] sm:text-[23px]">{agenda.descricao}</p>
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
            <p className="font-fell text-[26px] leading-snug text-[#1e1208] sm:text-[29px]">
              {aviso.titulo}
            </p>
            {imagem ? (
              <Image
                src={imagem}
                alt={aviso.titulo}
                width={1200}
                height={900}
                unoptimized
                className="w-full max-h-96 rounded-sm bg-white object-contain ring-1 ring-[#1e1208]/10"
              />
            ) : null}
            <div>{renderBlocoTexto(aviso.corpo)}</div>
          </div>
        );
      }
    }

    if (isInformativoSection(secao) || isNoticiasMesSection(secao)) {
      const item = parseAvisoBoletimItem(conteudo);

      if (item) {
        const imagem = imagemUrl?.trim();
        const chaveCopia = `${secao.id}-${itemId || item.titulo}`;
        const textoCompartilhamentoItem = `*${item.titulo}*\n\n${item.corpo}`;
        return (
          <details
            ref={(el) => {
              if (el) informativoRefs.current.set(chaveCopia, el);
              else informativoRefs.current.delete(chaveCopia);
            }}
            open={informativoAbertoId === chaveCopia}
            onToggle={(event) => {
              const aberto = (event.currentTarget as HTMLDetailsElement).open;
              setInformativoAbertoId(aberto ? chaveCopia : null);
            }}
            className="group rounded-sm border-b border-dotted border-[#1e1208]/20 last:border-b-0 open:bg-[#1e1208]/[0.025]"
          >
            <summary
              onClick={(event) => {
                ancoraScrollRef.current = {
                  chave: chaveCopia,
                  topAntes: event.currentTarget.getBoundingClientRect().top,
                };
              }}
              className="flex cursor-pointer list-none items-center gap-3 px-3 py-3.5 text-[23px] leading-snug text-[#1e1208] transition-colors hover:text-[#8b2a1d] sm:text-[25px] [&::-webkit-details-marker]:hidden"
            >
              <span className="text-[#8b2a1d]" aria-hidden>❧</span>
              <span className="min-w-0 flex-1 break-words">{item.titulo}</span>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(textoCompartilhamentoItem)}`,
                      '_blank'
                    );
                  }}
                  title="Compartilhar no WhatsApp"
                  className="inline-flex items-center rounded-full p-1.5 text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#8b2a1d]"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    copiarItemCompartilhamento(chaveCopia, textoCompartilhamentoItem);
                  }}
                  title="Copiar notícia"
                  className="inline-flex items-center rounded-full p-1.5 text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#8b2a1d]"
                >
                  {itemCopiadoId === chaveCopia ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#8b2a1d] transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-3 pb-5 pl-9">
              {imagem ? (
                <Image
                  src={imagem}
                  alt={item.titulo}
                  width={1200}
                  height={900}
                  unoptimized
                  className="w-full max-h-96 rounded-sm bg-white object-contain ring-1 ring-[#1e1208]/10"
                />
              ) : null}
              {renderBlocoTexto(item.corpo)}
            </div>
          </details>
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
        <p className="text-[22px] font-semibold text-[#1e1208] leading-snug sm:text-[1.544rem]/[1.474]">{titulo}</p>
        {corpo ? renderBlocoTexto(corpo) : null}
      </div>
    );
  };

  const getTituloSecao = (secao: BoletimSecao) => {
    if (!isLiturgiaSection(secao)) return secao.titulo;

    return secao.titulo.match(/(\d{4}-\d{2}-\d{2})/) ? 'Liturgia' : secao.titulo;
  };

  return (
    <div className="paper min-h-screen overflow-x-hidden font-garamond text-[#2a1a0e]">
      <header className="fixed top-0 inset-x-0 z-40 border-b-[3px] border-double border-[#1e1208]/25 bg-[#f4efe5]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {boletimSecoes.length > 0 && (
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuSecoesAberto((aberto) => !aberto)}
                  aria-expanded={menuSecoesAberto}
                  aria-label={menuSecoesAberto ? 'Fechar menu de seções' : 'Abrir menu de seções'}
                  className="p-2 rounded-full text-[#1e1208] hover:bg-[#1e1208]/5 transition-colors"
                >
                  {menuSecoesAberto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                {menuSecoesAberto && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuSecoesAberto(false)}
                    />
                    <div className={`absolute left-0 top-full mt-3 z-20 w-72 max-h-[70vh] overflow-y-auto py-3 ${folha}`}>
                      <p className="px-5 pb-2 font-fell text-[1.056rem]/[1.415] tracking-[0.3em] text-[#8b2a1d]">Índice</p>
                      {boletimSecoes
                        .filter((secao) => !isImageSection(secao))
                        .map((secao) => (
                          <button
                            key={secao.id}
                            type="button"
                            onClick={() => irParaSecao(secao.id)}
                            className="w-full text-left px-5 py-2 text-[22px] text-[#2a1a0e] hover:bg-[#1e1208]/[0.04] hover:text-[#8b2a1d] transition-colors flex items-baseline gap-3"
                          >
                            <span className="w-8 flex-shrink-0 text-right font-fell text-[1.219rem]/[1.44] text-[#8b2a1d]">
                              {paraRomano(numeracaoSecoesVisiveis.get(secao.id) ?? 0)}
                            </span>
                            <span className="truncate">{getTituloSecao(secao)}</span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-fell text-[14px] sm:text-[1.056rem]/[1.415] tracking-[0.25em] text-[#8b2a1d]">
                OIKOS Hub
              </p>
              <h1 className="font-fell text-[1.381rem]/[1.553] sm:text-[1.544rem]/[1.474] text-[#1e1208] truncate">
                {t('home.bulletinTitle')}
                {igrejaSelecionada && (
                  <span className="hidden sm:inline font-garamond italic text-[#7a5c40]"> · {nomeExibicaoIgreja}</span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {user ? (
              <>
                <button
                  onClick={() => router.push('/admin')}
                  className="text-[1.219rem]/[1.44] sm:text-[1.381rem]/[1.553] text-[#365c4d] hover:text-[#1e1208] px-3 sm:px-4 py-1.5 rounded-full hover:bg-[#1e1208]/5 transition-colors"
                >
                  {t('home.panel')}
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    window.location.reload();
                  }}
                  className="text-[1.219rem]/[1.44] sm:text-[1.381rem]/[1.553] text-[#7a5c40] hover:text-[#1e1208] px-3 sm:px-4 py-1.5 rounded-full hover:bg-[#1e1208]/5 transition-colors"
                >
                  {t('home.signOut')}
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/login')}
                className="text-[1.219rem]/[1.44] sm:text-[1.381rem]/[1.553] text-[#1e1208] border border-[#1e1208]/25 hover:border-[#1e1208]/50 hover:bg-[#1e1208]/5 px-4 sm:px-5 py-1.5 rounded-full transition-colors whitespace-nowrap"
              >
                {t('home.signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 pb-16 pt-[88px] sm:px-6 sm:pt-[100px]">
        <section className={`fade-up -mx-3 sm:mx-0 sm:mt-6 px-6 py-10 sm:px-14 sm:py-14 text-center ${folha}`}>
          <Cantoneiras />
          <p className="font-fell text-[1.056rem]/[1.415] sm:text-[1.219rem]/[1.44] tracking-[0.35em] text-[#8b2a1d]">
            Post Tenebras Lux
          </p>

          {logoIgrejaUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoIgrejaUrl}
              alt={`Logo ${nomeExibicaoIgreja}`}
              className="mx-auto mt-6 h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover bg-white ring-1 ring-[#1e1208]/20 ring-offset-4 ring-offset-[#fffcf4] shadow-[0_8px_24px_-10px_rgba(30,18,8,0.35)]"
            />
          )}

          <h2 className="mt-6 font-fell text-[2.6rem] sm:text-[3.9rem]/[1] lg:text-[4.55rem] leading-[1.1] text-[#1e1208] break-words">
            {nomeExibicaoIgreja}
          </h2>

          <Ornamento className="my-5 sm:my-6" />

          <p className="italic text-[1.544rem]/[1.474] sm:text-[1.625rem]/[1.4] text-[#5a4030] break-words">
            {dataEdicao ? t('home.editionOf', { date: dataEdicao }) : t('home.publicBulletin')}
          </p>
          <p className="mt-2 inline-flex items-start justify-center gap-1.5 text-[20px] sm:text-[1.381rem]/[1.553] text-[#7a5c40] break-words">
            <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
            <span className="break-words">{enderecoFormatado || localizacao || t('home.locationUnknown')}</span>
          </p>

          <div className="mt-8 grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
            <Link
              href={pedidosPastoraisHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#365c4d] hover:bg-[#28463b] px-6 py-2.5 text-[1.381rem]/[1.553] sm:text-[1.544rem]/[1.474] text-[#fffcf4] shadow-[0_10px_24px_-10px_rgba(54,92,77,0.6)] transition-all duration-200 hover:-translate-y-0.5 sm:min-w-[200px]"
            >
              <span className="truncate">Pedidos de oração</span>
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </Link>
            {temApresentacaoIgreja ? (
              <button
                type="button"
                onClick={() => setSobreIgrejaAberto((valorAtual) => !valorAtual)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#1e1208]/25 px-6 py-2.5 text-[1.381rem]/[1.553] sm:text-[1.544rem]/[1.474] text-[#1e1208] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1e1208]/50 hover:bg-[#1e1208]/[0.03] sm:min-w-[200px]"
              >
                <span className="truncate">{sobreIgrejaAberto ? 'Ocultar sobre a igreja' : 'Sobre a igreja'}</span>
                <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${sobreIgrejaAberto ? 'rotate-90' : ''}`} />
              </button>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[20px]">
            <button
              onClick={compartilharBoletimWhatsApp}
              disabled={!igrejaSelecionada}
              className="inline-flex items-center gap-1.5 italic text-[#7a5c40] hover:text-[#8b2a1d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('home.shareWhatsApp')}</span>
            </button>
            <button
              onClick={copiarLinkBoletim}
              disabled={!igrejaSelecionada}
              className="inline-flex items-center gap-1.5 italic text-[#7a5c40] hover:text-[#8b2a1d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              className="inline-flex items-center gap-1.5 italic text-[#7a5c40] hover:text-[#8b2a1d] transition-colors"
            >
              <span>{t('home.pastBulletins')}</span>
            </Link>
            <Link
              href={recursosHref}
              className="inline-flex items-center gap-1.5 italic text-[#7a5c40] hover:text-[#8b2a1d] transition-colors"
            >
              <Library className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('home.resources')}</span>
            </Link>
          </div>
        </section>

        {user && (
          <div className="mt-4 sm:mt-6 -mx-3 sm:mx-0 flex items-start gap-3 border-y sm:border border-[#1e1208]/10 bg-[#fffcf4]/70 px-4 py-3 sm:rounded-md">
            <Eye className="w-4 h-4 text-[#7a5c40] flex-shrink-0 mt-1" />
            <p className="italic text-[20px] text-[#5a4030]">
              Logado. O painel administrativo segue disponivel para gestao interna da igreja selecionada.
            </p>
          </div>
        )}

        {!loading && temApresentacaoIgreja && sobreIgrejaAberto && (
          <section
            ref={sobreIgrejaRef}
            id="sobre-igreja"
            className={`fade-up -mx-3 sm:mx-0 mt-6 sm:mt-10 overflow-hidden ${folha}`}
          >
            <div className="grid gap-6 sm:gap-10 px-5 py-8 sm:px-10 sm:py-12 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
              <div className="space-y-5 min-w-0">
                <div className="space-y-2">
                  <p className="font-fell text-[1.056rem]/[1.415] sm:text-[1.219rem]/[1.44] tracking-[0.3em] text-[#8b2a1d]">
                    Sobre a igreja
                  </p>
                  <h3 className="font-fell text-[2.438rem]/[1.2] sm:text-[2.925rem]/[1.111] leading-tight text-[#1e1208] break-words">
                    {apresentacaoTitulo || nomeExibicaoIgreja}
                  </h3>
                </div>

                <div className="space-y-4 text-[22px] sm:text-[23px] leading-[1.8] text-[#2a1a0e] break-words">
                  {paragrafosApresentacao.map((paragrafo, index) => (
                    <p key={`apresentacao-${index}`} className={index === 0 ? capitular : undefined}>{paragrafo}</p>
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
                    className="h-56 sm:h-[22rem] w-full rounded-sm object-cover ring-1 ring-[#1e1208]/15 ring-offset-4 ring-offset-[#fffcf4] sepia-[.15]"
                  />
                ) : null}

                {youtubeApresentacaoId ? (
                  <div className="overflow-hidden rounded-sm bg-black ring-1 ring-[#1e1208]/15 ring-offset-4 ring-offset-[#fffcf4]">
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
              <div className="border-t border-[#1e1208]/10 px-5 py-5 sm:px-10 sm:py-8">
                <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
                  {galeriaApresentacao.slice(1).map((foto, index) => (
                    <Image
                      key={`${foto}-${index}`}
                      src={foto}
                      alt={`${nomeExibicaoIgreja} ${index + 2}`}
                      width={1200}
                      height={800}
                      unoptimized
                      className="h-28 sm:h-40 w-full rounded-sm object-cover ring-1 ring-[#1e1208]/15 sepia-[.15]"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {loading && (
          <div className="flex flex-col items-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-[#8b2a1d] border-t-transparent rounded-full animate-spin" />
            <p className="italic text-[#7a5c40]">Carregando boletim...</p>
          </div>
        )}

        {!loading && (
          <div className="mt-10 sm:mt-14 grid gap-12 sm:gap-12 xl:grid-cols-[minmax(0,1.72fr)_300px] xl:items-start">
            <section className="space-y-12 sm:space-y-16 min-w-0">
              {boletimSecoes.length === 0 ? (
                <div className={`flex flex-col items-center gap-3 py-16 sm:py-24 px-4 text-center ${folha}`}>
                  <Music className="w-10 h-10 text-[#1e1208]/25" />
                  <p className="italic text-[#7a5c40]">Nenhuma seção de boletim publicada para esta igreja.</p>
                </div>
              ) : (
                boletimSecoes.map((secao) => (
                  <article
                    key={secao.id}
                    id={`secao-${secao.id}`}
                    className="fade-up space-y-5 sm:space-y-6 scroll-mt-28 sm:scroll-mt-32"
                  >
                    {!isImageSection(secao) && (
                      <div className="text-center px-2">
                        <p className="font-fell text-[1.219rem]/[1.44] sm:text-[1.381rem]/[1.553] tracking-[0.3em] text-[#8b2a1d]">
                          {paraRomano(numeracaoSecoesVisiveis.get(secao.id) ?? 0)}
                        </p>
                        <h3 className="mt-1 font-fell text-[2.21rem] sm:text-[2.73rem] leading-tight text-[#1e1208] break-words">
                          {getTituloSecao(secao)}
                        </h3>
                        <Ornamento className="mt-3" />
                      </div>
                    )}

                    {secao.itens.length === 0 ? (
                      <p className="text-center italic text-[#7a5c40]">Sem itens publicados nesta seção.</p>
                    ) : isLiturgiaSection(secao) ? (
                      <div className="space-y-6">
                        {agruparCardsLiturgia(secao.itens).map((card) => (
                          <div
                            key={card.id}
                            className={`px-6 py-6 sm:px-10 sm:py-9 ${folha}`}
                          >
                            <div className="space-y-0">
                              <div className="relative border-b border-[#1e1208]/15 pb-4 text-center">
                                <p className="font-fell text-[1.625rem]/[1.4] sm:text-[1.95rem]/[1.333] text-[#1e1208] px-12">
                                  {getTituloCardLiturgia(card.nome)}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => imprimirLiturgiaPdf(card)}
                                  title="Imprimir PDF"
                                  className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[1.219rem]/[1.44] italic text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#8b2a1d]"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">PDF</span>
                                </button>
                              </div>

                              {card.grupos.map((grupo, itemIndex) => (
                                <div
                                  key={grupo.id}
                                  className={`py-5 ${itemIndex > 0 ? 'border-t border-dotted border-[#1e1208]/20' : ''}`}
                                >
                                  <div className="space-y-3">
                                    <p className="flex items-baseline gap-2 text-[22px] sm:text-[1.544rem]/[1.474] font-semibold leading-snug text-[#1e1208]">
                                      <span className="text-[#8b2a1d] font-normal" aria-hidden>¶</span>
                                      {grupo.titulo}
                                    </p>

                                    {grupo.publicos.length > 0 ? (
                                      <div className="space-y-2 pl-5">
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
                                      <div className="ml-5 rounded-sm border-l-2 border-[#1e1208]/15 bg-[#1e1208]/[0.03] px-4 py-3">
                                        <div className="flex flex-wrap items-baseline gap-2">
                                          <p className="font-fell text-[1.056rem]/[1.415] tracking-[0.25em] text-[#7a5c40]">
                                            Interno
                                          </p>
                                          <p className="italic text-[1.219rem]/[1.44] text-[#7a5c40]/80">
                                            Visível só para quem está logado
                                          </p>
                                        </div>

                                        {grupo.horario ? (
                                          <p className="mt-2 text-[20px] text-[#7a5c40]">
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
                        className={`${folha} ${
                          isPastoralSection(secao)
                            ? 'px-6 py-8 sm:px-12 sm:py-12'
                            : isInformativoSection(secao) || isNoticiasMesSection(secao)
                              ? 'px-3 py-3 sm:px-5 sm:py-5'
                              : 'px-6 py-6 sm:px-10 sm:py-9'
                        }`}
                      >
                        {isPastoralSection(secao) ? <Cantoneiras /> : null}
                        <div
                          className={
                            isInformativoSection(secao) || isNoticiasMesSection(secao)
                              ? 'space-y-2'
                              : 'space-y-0'
                          }
                        >
                          {secao.itens.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className={
                                isInformativoSection(secao) || isNoticiasMesSection(secao)
                                  ? ''
                                  : `${isPastoralSection(secao) ? 'py-0' : 'py-4 sm:py-5'} ${itemIndex > 0 ? 'border-t border-dotted border-[#1e1208]/20' : ''}`
                              }
                            >
                              {isImageSection(secao) ? (
                                <Image
                                  src={item.conteudo}
                                  alt={secao.titulo}
                                  width={1600}
                                  height={1200}
                                  unoptimized
                                  className="h-auto w-full rounded-sm bg-white"
                                />
                              ) : (
                                renderItemConteudo(secao, item.conteudo, item.imagem_url, item.id)
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

            <aside className="fade-up space-y-6 min-w-0 xl:sticky xl:top-28">
              <section className={`p-6 sm:p-7 ${folha}`}>
                <div className="mb-4 text-center">
                  <h3 className="font-fell text-[1.625rem]/[1.4] text-[#1e1208]">Agenda</h3>
                  <Ornamento className="mt-2" pequeno />
                </div>

                {agendaCultos.length === 0 ? (
                  <p className="text-center italic text-[#7a5c40]">Nenhum culto configurado para esta igreja.</p>
                ) : (
                  <div className="space-y-1">
                    {agendaCultos.map((culto) => (
                      <div
                        key={culto.id}
                        className="border-t border-dotted border-[#1e1208]/20 px-1 py-3 first:border-t-0 first:pt-0"
                      >
                        <p className="text-[22px] font-semibold text-[#1e1208]">{culto.nome}</p>
                        <p className="italic text-[20px] text-[#8b2a1d] mt-0.5">
                          {culto.dia_semana} às {culto.horario.slice(0, 5)}
                        </p>
                        {culto.descricao && (
                          <p className="text-[20px] text-[#5a4030] mt-1.5">{culto.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={`p-6 sm:p-7 ${folha}`}>
                <div className="mb-4 text-center">
                  <h3 className="font-fell text-[1.625rem]/[1.4] text-[#1e1208]">Canais</h3>
                  <Ornamento className="mt-2" pequeno />
                </div>

                <div className="divide-y divide-dotted divide-[#1e1208]/20">
                  {igrejaDetalhes?.site && (
                    <a href={igrejaDetalhes.site} target="_blank" rel="noreferrer" className={linkCanal}>
                      <span className="truncate">Site oficial</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  )}
                  {igrejaDetalhes?.email && (
                    <a href={`mailto:${igrejaDetalhes.email}`} className={linkCanal}>
                      <span className="truncate min-w-0">{igrejaDetalhes.email}</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  )}
                  {igrejaDetalhes?.telefone && (
                    <a href={`tel:${igrejaDetalhes.telefone}`} className={linkCanal}>
                      <span className="truncate min-w-0">{igrejaDetalhes.telefone}</span>
                      <Phone className="w-4 h-4 flex-shrink-0" />
                    </a>
                  )}
                  {redesSociais.map((rede) => (
                    <a key={rede.id} href={rede.url} target="_blank" rel="noreferrer" className={linkCanal}>
                      <span className="capitalize truncate min-w-0">{rede.tipo}</span>
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  ))}
                  {!igrejaDetalhes?.site &&
                    !igrejaDetalhes?.email &&
                    !igrejaDetalhes?.telefone &&
                    redesSociais.length === 0 && (
                      <p className="text-center italic text-[#7a5c40]">Nenhum canal publico cadastrado.</p>
                    )}
                </div>
              </section>

              <section className={`p-6 sm:p-7 text-center ${folha}`}>
                <p className="font-fell text-[1.056rem]/[1.415] tracking-[0.3em] text-[#8b2a1d]">
                  Atendimento
                </p>
                <h3 className="mt-2 font-fell text-[1.625rem]/[1.4] text-[#1e1208]">
                  Quer compartilhar um pedido?
                </h3>
                <p className="mt-2 italic text-[20px] leading-[1.95rem] text-[#5a4030]">
                  Envie um pedido de oração, aconselhamento ou visita.
                </p>
                <Link
                  href={pedidosPastoraisHref}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#365c4d] px-5 py-2 text-[1.381rem]/[1.553] text-[#fffcf4] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#28463b]"
                >
                  Abrir pedidos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="mt-16 sm:mt-24">
        <div className="max-w-6xl mx-auto px-4 pb-10 sm:pb-14 text-center">
          <Ornamento />
          <p className="mt-4 font-fell text-[1.544rem]/[1.474] sm:text-[1.625rem]/[1.4] text-[#1e1208]">Soli Deo Gloria</p>
          <p className="mt-2 italic text-[1.219rem]/[1.44] text-[#7a5c40] break-words">
            OIKOS Hub
            {igrejaSelecionada ? ` · ${igrejaSelecionada.nome}` : ''}
          </p>
        </div>
      </footer>

      {canticoAbertoRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1e1208]/45 p-2 sm:p-4 backdrop-blur-sm">
          <div className={`flex max-h-[95vh] sm:max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden ${folha}`}>
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-[#1e1208]/15 px-5 py-4 sm:px-8 sm:py-5">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-fell text-[1.056rem]/[1.415] sm:text-[1.219rem]/[1.44] tracking-[0.3em] text-[#8b2a1d]">
                  {canticoAberto?.tipo === 'hinario' ? 'Hino' : 'Cântico'}
                </p>
                <h2 className="font-fell text-[1.95rem]/[1.333] sm:text-[2.438rem]/[1.2] text-[#1e1208] break-words">
                  {canticoAberto?.nome || canticoAbertoRef.nome}
                </h2>
                {canticoAberto?.referencia ? (
                  <p className="italic text-[20px] text-[#7a5c40] break-words">{canticoAberto.referencia}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setCanticoAbertoRef(null)}
                className="rounded-full p-2 text-[#7a5c40] transition-colors hover:bg-[#1e1208]/5 hover:text-[#1e1208] flex-shrink-0"
                aria-label="Fechar letra"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-8 sm:py-7">
              {loadingCantico ? (
                <p className="italic text-[#7a5c40]">Carregando letra...</p>
              ) : !canticoAberto?.letra ? (
                <p className="italic text-[#7a5c40]">A letra deste cântico não está disponível no momento.</p>
              ) : (
                <div className="space-y-5 sm:space-y-6">
                  {(canticoAberto.autor_letra || canticoAberto.compositor) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 italic text-[20px] text-[#7a5c40]">
                      {canticoAberto.autor_letra ? <p>Letra: {canticoAberto.autor_letra}</p> : null}
                      {canticoAberto.compositor ? <p>Música: {canticoAberto.compositor}</p> : null}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-[1.544rem]/[1.474] leading-[2.6rem] text-[#1e1208] sm:text-[1.625rem]/[1.4] sm:leading-[2.925rem] lg:text-[1.82rem]">
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
