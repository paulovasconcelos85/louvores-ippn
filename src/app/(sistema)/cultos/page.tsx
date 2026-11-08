'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale } from '@/i18n/provider';
import { resolveLocalizedText } from '@/lib/church-i18n';
import { jsPDF } from 'jspdf';
import { getStoredChurchId } from '@/lib/church-utils';
import type { Cantico, LiturgiaChurchConfig, Culto, ItemAgrupado } from './_lib/tipos';
import { mapHinarioNovoCanticoToCantico, normalizeModoRepertorio, filtrarCanticosPorConfiguracao } from './_lib/canticos';
import { getCultoNomeLiturgia, extractTiposLiturgicos, mergeLocalizedModelValue, extractModeloLiturgicoPadrao, mergeModelosLiturgia, formatCultoDateLabel, getCultoDateKey, proximoDomingoSemBoletim, buildCultoDayGroups, getCultoBoletimReferencia, isUuid } from './_lib/liturgia';
import { buscarPastorPadrao, carregarLouvorItensComCanticos, LIMITE_CULTOS_RECENTES, recortarDiaIncompleto, anexarNomesLiturgia, consultarHinario, carregarUltimoUsoCanticos } from './_lib/dados';
import { agruparItensLiturgia } from './_lib/boletim';
import { EditorBoletimDoDiaModal } from './_components/EditorBoletimDoDiaModal';
import { EditorLiturgia } from './_components/EditorLiturgia';
import { CultoCard } from './_components/CultoCard';

export default function CultosPage() {
  const router = useRouter();
  const locale = useLocale();
  const { loading: permLoading, permissoes } = usePermissions();
  const [canticos, setCanticos] = useState<Cantico[]>([]);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [configuracaoIgreja, setConfiguracaoIgreja] = useState<LiturgiaChurchConfig | null>(null);
  const [igrejaPublicSlug, setIgrejaPublicSlug] = useState<string | null>(null);
  const [editando, setEditando] = useState<Culto | null | 'novo'>(null);
  const [novoDiaInicial, setNovoDiaInicial] = useState('');
  const [boletimDiaEditando, setBoletimDiaEditando] = useState<{ dia: string; cultos: Culto[] } | null>(null);
  const [cultoExcluindoId, setCultoExcluindoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paginaAnteriores, setPaginaAnteriores] = useState(0);
  const [podeHaverAnteriores, setPodeHaverAnteriores] = useState(false);
  const [anterioresCarregados, setAnterioresCarregados] = useState(false);
  const [carregandoAnteriores, setCarregandoAnteriores] = useState(false);
  const isLideranca = permissoes.podeEditarLiturgiaCompleta;
  const totalLoading = loading || permLoading;
  const gruposCultos = useMemo(() => buildCultoDayGroups(cultos), [cultos]);

  const GRUPOS_RECENTES = 3;
  const GRUPOS_POR_PAGINA = 5;
  const gruposRecentes = gruposCultos.slice(0, GRUPOS_RECENTES);
  const gruposAnteriores = anterioresCarregados ? gruposCultos.slice(GRUPOS_RECENTES) : [];
  const totalPaginasAnteriores = Math.ceil(gruposAnteriores.length / GRUPOS_POR_PAGINA);
  const gruposAnterioresVisiveis = gruposAnteriores.slice(
    paginaAnteriores * GRUPOS_POR_PAGINA,
    (paginaAnteriores + 1) * GRUPOS_POR_PAGINA
  );

  useEffect(() => {
    if (!permLoading && !permissoes.podeGerenciarCultos) {
      router.push('/admin');
    }
  }, [permLoading, permissoes.podeGerenciarCultos, router]);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    try {
      const igrejaId = getStoredChurchId();

      if (!igrejaId) {
        setCanticos([]);
        setCultos([]);
        setConfiguracaoIgreja(null);
        setIgrejaPublicSlug(null);
        return;
      }

      const igrejaPromise = supabase
        .from('igrejas')
        .select('slug, tipos_liturgicos, modelo_liturgico_padrao, modo_repertorio, permite_cadastro_canticos')
        .eq('id', igrejaId)
        .maybeSingle();

      const [
        { data: canticosBaseRaw },
        { data: hinarioNovoCanticosRaw },
        { data: cultosData },
        { data: igrejaRaw },
        { data: modelosLiturgiaRaw },
        pastorPadrao,
      ] = await Promise.all([
        supabase
          .from('canticos')
          .select('id, nome, igreja_id')
          .eq('igreja_id', igrejaId)
          .order('nome'),
        igrejaPromise.then(({ data }) => consultarHinario(data?.modo_repertorio)),
        supabase
          .from('Louvores IPPN')
          .select('*')
          .eq('igreja_id', igrejaId)
          .order('Dia', { ascending: false })
          .limit(LIMITE_CULTOS_RECENTES),
        igrejaPromise,
        supabase
          .from('modelos_liturgia')
          .select(
            'bloco, ordem, tipo, descricao_padrao, tem_cantico, conteudo_publico_padrao_i18n, descricao_interna_padrao_i18n'
          )
          .eq('igreja_id', igrejaId)
          .order('ordem', { ascending: true }),
        isUuid(igrejaId) ? buscarPastorPadrao(igrejaId) : Promise.resolve(null),
      ]);

      setIgrejaPublicSlug(typeof igrejaRaw?.slug === 'string' && igrejaRaw.slug.trim() ? igrejaRaw.slug.trim() : null);
      const canticosBaseNormalizados = (
        (canticosBaseRaw || []) as Array<{ id: string; nome: string; igreja_id: string | null }>
      ).map((cantico) => ({
        ...cantico,
        tipo: 'cantico' as const,
        numero: null,
      }));
      const hinarioNovoCanticos = (
        (hinarioNovoCanticosRaw || []) as Array<{
          id: string | number;
          numero: string | null;
          titulo: string | null;
        }>
      ).map(mapHinarioNovoCanticoToCantico);
      const todosCanticos = [...canticosBaseNormalizados, ...hinarioNovoCanticos].sort((a, b) =>
        a.nome.localeCompare(b.nome, locale)
      );

      setCanticos(todosCanticos.map(c => ({ ...c, ultima_vez: null })));
      const cultosComNome = await anexarNomesLiturgia(
        recortarDiaIncompleto((cultosData || []) as Culto[], LIMITE_CULTOS_RECENTES),
        locale
      );
      setCultos(cultosComNome);
      setPodeHaverAnteriores((cultosData || []).length >= LIMITE_CULTOS_RECENTES || buildCultoDayGroups(cultosComNome).length > GRUPOS_RECENTES);
      setAnterioresCarregados(false);
      setPaginaAnteriores(0);
      const modelosFallback = extractModeloLiturgicoPadrao(
        igrejaRaw?.modelo_liturgico_padrao,
        locale
      );
      const fallbackPorChave = new Map(
        modelosFallback.map((item) => [`${item.ordem}-${item.tipo}-${item.bloco}`, item] as const)
      );
      const modelosTabela = (modelosLiturgiaRaw || []).map((item) => ({
        bloco: typeof item.bloco === 'string' ? item.bloco : '',
        ordem: typeof item.ordem === 'number' ? item.ordem : 0,
        tipo: typeof item.tipo === 'string' ? item.tipo : '',
        descricao_padrao: typeof item.descricao_padrao === 'string' ? item.descricao_padrao : '',
        conteudo_publico_padrao_i18n: mergeLocalizedModelValue(
          item.conteudo_publico_padrao_i18n,
          fallbackPorChave.get(
            `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
          )?.conteudo_publico_padrao_i18n,
          undefined,
          fallbackPorChave.get(
            `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
          )?.conteudo_publico_padrao
        ),
        conteudo_publico_padrao: resolveLocalizedText(
          item.conteudo_publico_padrao_i18n,
          locale,
          fallbackPorChave.get(
            `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
          )?.conteudo_publico_padrao || ''
        ),
        descricao_interna_padrao_i18n: mergeLocalizedModelValue(
          item.descricao_interna_padrao_i18n,
          fallbackPorChave.get(
            `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
          )?.descricao_interna_padrao_i18n,
          typeof item.descricao_padrao === 'string' ? item.descricao_padrao : '',
          fallbackPorChave.get(
            `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
          )?.descricao_interna_padrao ||
            fallbackPorChave.get(
              `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
            )?.descricao_padrao
        ),
        descricao_interna_padrao: resolveLocalizedText(
          item.descricao_interna_padrao_i18n,
          locale,
          fallbackPorChave.get(
            `${typeof item.ordem === 'number' ? item.ordem : 0}-${typeof item.tipo === 'string' ? item.tipo : ''}-${typeof item.bloco === 'string' ? item.bloco : ''}`
          )?.descricao_interna_padrao || (typeof item.descricao_padrao === 'string' ? item.descricao_padrao : '')
        ),
        tem_cantico: item.tem_cantico === true,
      }));
      const tiposDaIgreja = extractTiposLiturgicos(igrejaRaw?.tipos_liturgicos);
      const tiposDerivadosDoModelo = [...new Set(
        modelosTabela
          .map((item) => item.tipo.trim())
          .filter(Boolean)
      )];

      const modelosMesclados = mergeModelosLiturgia(modelosTabela, modelosFallback);

      const configuracaoCarregada = {
        tiposLiturgicos: tiposDaIgreja.length > 0 ? tiposDaIgreja : tiposDerivadosDoModelo,
        modelosLiturgia: modelosMesclados,
        pastorPadrao,
        modoRepertorio: normalizeModoRepertorio(igrejaRaw?.modo_repertorio) || null,
        permiteCadastroCanticos: igrejaRaw?.permite_cadastro_canticos ?? true,
      };

      setConfiguracaoIgreja(configuracaoCarregada);

      const canticosFiltrados = filtrarCanticosPorConfiguracao(
        (todosCanticos || []) as Cantico[],
        configuracaoCarregada
      );
      setCanticos(canticosFiltrados.map((cantico) => ({ ...cantico, ultima_vez: null })));

      // Em segundo plano: a página abre sem esperar o histórico dos cânticos.
      if (canticosFiltrados.length > 0) {
        carregarUltimoUsoCanticos(igrejaId)
          .then((ultimoUso) => {
            setCanticos(
              canticosFiltrados.map((cantico) => ({ ...cantico, ultima_vez: ultimoUso.get(String(cantico.id)) || null }))
            );
          })
          .catch((error) => console.warn('Falha ao carregar histórico dos cânticos:', error));
      }
    } catch (error) {
      console.error('Falha ao carregar a página de cultos:', error);
      setCanticos([]);
      setCultos([]);
      setConfiguracaoIgreja(null);
      setIgrejaPublicSlug(null);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const carregarAnteriores = useCallback(async () => {
    const igrejaId = getStoredChurchId();
    if (!igrejaId) return;

    setCarregandoAnteriores(true);
    try {
      const datasCarregadas = cultos.map((culto) => getCultoDateKey(culto.Dia)).sort();
      let query = supabase
        .from('Louvores IPPN')
        .select('*')
        .eq('igreja_id', igrejaId)
        .order('Dia', { ascending: false });

      if (datasCarregadas.length > 0) {
        query = query.lt('Dia', datasCarregadas[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const anteriores = await anexarNomesLiturgia((data || []) as Culto[], locale);
      setCultos((atuais) => {
        const idsAtuais = new Set(atuais.map((culto) => culto['Culto nr.']));
        return [...atuais, ...anteriores.filter((culto) => !idsAtuais.has(culto['Culto nr.']))];
      });
      setAnterioresCarregados(true);
      setPaginaAnteriores(0);
    } catch (error) {
      console.error('Falha ao carregar boletins anteriores:', error);
      alert('Não foi possível carregar os boletins anteriores.');
    } finally {
      setCarregandoAnteriores(false);
    }
  }, [cultos, locale]);

  const getPublicBulletinUrl = useCallback(() => {
    if (!igrejaPublicSlug) return null;

    const path = `/${encodeURIComponent(igrejaPublicSlug)}`;
    if (typeof window === 'undefined') return path;

    return new URL(path, window.location.origin).toString();
  }, [igrejaPublicSlug]);

  const abrirBoletimPublico = useCallback(() => {
    const url = getPublicBulletinUrl();

    if (!url) {
      alert('Esta igreja ainda não tem um slug público configurado.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }, [getPublicBulletinUrl]);

  const compartilharBoletimPublico = useCallback(async () => {
    const url = getPublicBulletinUrl();

    if (!url) {
      alert('Esta igreja ainda não tem um slug público configurado.');
      return;
    }

    const shareData = {
      title: 'Boletim da igreja',
      text: 'Boletim público da igreja',
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(url);
      alert('Link do boletim copiado.');
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return;

      try {
        await navigator.clipboard.writeText(url);
        alert('Link do boletim copiado.');
      } catch {
        prompt('Copie o link do boletim:', url);
      }
    }
  }, [getPublicBulletinUrl]);

  useEffect(() => {
    if (!permLoading && permissoes.podeGerenciarCultos) {
      carregarTudo();
    }
  }, [carregarTudo, permLoading, permissoes.podeGerenciarCultos]);

  const shareWhatsApp = async (culto: Culto) => {
    const igrejaId = getStoredChurchId();
    const cultoNr = culto['Culto nr.'];
    if (!igrejaId) return;
    const { data: cultoValido } = await supabase
      .from('Louvores IPPN')
      .select('"Culto nr."')
      .eq('"Culto nr."', cultoNr)
      .eq('igreja_id', igrejaId)
      .maybeSingle();
    if (!cultoValido) return;

    const data = await carregarLouvorItensComCanticos(cultoNr, canticos, igrejaId);
    if (!data) return;

    const agrupados = agruparItensLiturgia(data);

    const dataFmt = new Date(culto.Dia + 'T00:00:00').toLocaleDateString('pt-BR');
    const nomeLiturgia = getCultoNomeLiturgia(culto);
    let texto = `LITURGIA DO CULTO${nomeLiturgia ? ` *${nomeLiturgia.toUpperCase()}*` : ''} DE *${dataFmt}*\n\n`;

    if (culto.palavra_pastoral) {
      texto += `✝️ *PALAVRA PASTORAL*\n${culto.palavra_pastoral}\n— ${culto.palavra_pastoral_autor || ''}\n\n`;
    }

    agrupados.forEach((it, index) => {
      texto += `*${index + 1}. ${it.tipo.toUpperCase()}*`;
      if (it.horario) texto += ` _(${it.horario})_`;
      texto += '\n';
      if (it.conteudo_publico) texto += `${it.conteudo_publico.trim()}\n`;
      it.canticos.forEach((cantico) => {
        texto += `- ${cantico.nome}${cantico.tom ? ` (${cantico.tom})` : ''}\n`;
      });
      texto += '\n';
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const sharePDF = async (culto: Culto) => {
    const igrejaId = getStoredChurchId();
    const cultoNr = culto['Culto nr.'];
    if (!igrejaId) return;
    const { data: cultoValido } = await supabase
      .from('Louvores IPPN')
      .select('"Culto nr."')
      .eq('"Culto nr."', cultoNr)
      .eq('igreja_id', igrejaId)
      .maybeSingle();
    if (!cultoValido) return;

    const data = await carregarLouvorItensComCanticos(cultoNr, canticos, igrejaId);
    if (!data) return;
    const agrupados = agruparItensLiturgia(data);

    const dataFmt = new Date(culto.Dia + 'T00:00:00')
      .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
    const nomeLiturgia = getCultoNomeLiturgia(culto);

    const renderPdf = (scale: number) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const headerBottom = 30;
      const topY = headerBottom + 6;
      const bottomY = ph - 10;
      const titleSize = 13 * scale;
      const subtitleSize = 8.2 * scale;
      const metaSize = 7 * scale;
      const itemTitleSize = 11.8 * scale;
      const publicSize = 10.2 * scale;
      const internalSize = 8.3 * scale;
      const songSize = 10 * scale;
      const lineH = 5 * scale;
      const titleH = 6.1 * scale;
      const blockGap = 4.2 * scale;
      const innerIndent = 3;
      const contentWidth = pw - marginX * 2;
      const availableHeight = bottomY - topY;

      const drawHeader = () => {
        doc.setFillColor(16, 60, 48);
        doc.rect(0, 0, pw, headerBottom - 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(titleSize);
        doc.text(nomeLiturgia ? `LITURGIA - ${nomeLiturgia.toUpperCase()}` : 'LITURGIA DO CULTO', pw / 2, 11, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(subtitleSize);
        doc.text(dataFmt, pw / 2, 17, { align: 'center' });
        doc.setFontSize(metaSize);
        doc.text('Pagina 1 de 1', pw / 2, 23, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(16, 60, 48);
        doc.line(marginX, headerBottom, pw - marginX, headerBottom);
      };

      const calcPastoralHeight = () => {
        let h = titleH + blockGap;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(publicSize);
        h += doc.splitTextToSize(culto.palavra_pastoral || '', contentWidth - 4).length * lineH;
        if (culto.palavra_pastoral_autor) {
          h += lineH + 2;
        }
        return h + blockGap;
      };

      const calcItemHeight = (it: ItemAgrupado, num: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemTitleSize);
        const titulo = `${num}. ${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
        let h = doc.splitTextToSize(titulo, contentWidth).length * titleH + 1.5;

        if (it.conteudo_publico) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(publicSize);
          h += doc.splitTextToSize(it.conteudo_publico, contentWidth - 4).length * lineH;
        }

        if (it.descricao) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(internalSize);
          h += doc.splitTextToSize(it.descricao, contentWidth - 4).length * lineH;
        }

        for (const cantico of it.canticos) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(songSize);
          h += doc.splitTextToSize(`${cantico.nome}${cantico.tom ? ` (${cantico.tom})` : ''}`, contentWidth - 4).length * lineH;
        }

        return h + blockGap;
      };

      const renderPastoral = (x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemTitleSize);
        doc.setTextColor(0, 0, 0);
        doc.text('PALAVRA PASTORAL', x, y);
        y += titleH;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(publicSize);
        const palavraLinhas = doc.splitTextToSize(culto.palavra_pastoral || '', contentWidth - 4);
        doc.text(palavraLinhas, x, y);
        y += palavraLinhas.length * lineH;

        if (culto.palavra_pastoral_autor) {
          y += 1.5;
          doc.setFont('helvetica', 'italic');
          doc.text(`- ${culto.palavra_pastoral_autor}`, x + contentWidth, y, { align: 'right' });
        }
      };

      const renderItem = (it: ItemAgrupado, num: number, x: number, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(itemTitleSize);
        doc.setTextColor(0, 0, 0);
        const titulo = `${num}. ${it.tipo.toUpperCase()}${it.horario ? ' / ' + it.horario : ''}`;
        const tituloLinhas = doc.splitTextToSize(titulo, contentWidth);
        doc.text(tituloLinhas, x, y);
        y += tituloLinhas.length * titleH;

        if (it.conteudo_publico) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(publicSize);
          doc.setTextColor(55, 55, 55);
          const linhas = doc.splitTextToSize(it.conteudo_publico, contentWidth - 4);
          doc.text(linhas, x + innerIndent, y);
          y += linhas.length * lineH;
        }

        if (it.descricao) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(internalSize);
          doc.setTextColor(120, 120, 120);
          const linhas = doc.splitTextToSize(it.descricao, contentWidth - 4);
          doc.text(linhas, x + innerIndent, y);
          y += linhas.length * lineH;
        }

        for (const cantico of it.canticos) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(songSize);
          doc.setTextColor(16, 90, 60);
          const linhas = doc.splitTextToSize(
            `${cantico.nome}${cantico.tom ? ` (${cantico.tom})` : ''}`,
            contentWidth - 4
          );
          doc.text(linhas, x + innerIndent, y);
          y += linhas.length * lineH;
        }
      };

      const blocos: Array<
        | { kind: 'pastoral'; altura: number }
        | { kind: 'item'; altura: number; item: ItemAgrupado; numero: number }
      > = [];

      if (culto.palavra_pastoral) {
        blocos.push({ kind: 'pastoral', altura: calcPastoralHeight() });
      }

      agrupados.forEach((item, index) => {
        blocos.push({
          kind: 'item',
          item,
          numero: index + 1,
          altura: calcItemHeight(item, index + 1),
        });
      });

      const totalHeight = blocos.reduce((acc, bloco) => acc + bloco.altura, 0);

      if (totalHeight > availableHeight) {
        return null;
      }

      drawHeader();
      let y = topY;
      const x = marginX;

      blocos.forEach((bloco) => {
        if (bloco.kind === 'pastoral') {
          renderPastoral(x, y);
          y += bloco.altura;
          return;
        }

        renderItem(bloco.item, bloco.numero, x, y);
        y += bloco.altura;
      });

      return doc;
    };

    const minScale = 0.52;
    const maxScale = 1.18;
    let bestScale = minScale;
    let bestDoc = renderPdf(minScale);

    if (bestDoc) {
      let low = minScale;
      let high = maxScale;

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const mid = (low + high) / 2;
        const candidate = renderPdf(mid);

        if (candidate) {
          bestScale = mid;
          bestDoc = candidate;
          low = mid;
        } else {
          high = mid;
        }
      }
    }

    const doc = bestDoc || renderPdf(bestScale);

    if (!doc) {
      alert('Nao foi possivel montar o PDF em uma unica pagina. Revise a quantidade de texto desta liturgia.');
      return;
    }

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  const deletarCulto = async (culto: Culto) => {
    const igrejaId = getStoredChurchId();
    const cultoId = culto['Culto nr.'];

    if (!igrejaId) {
      alert('Selecione uma igreja antes de excluir a liturgia.');
      return;
    }

    const confirmar = window.confirm(
      `Excluir a liturgia de ${formatCultoDateLabel(culto.Dia)}? Esta ação remove a liturgia e todas as seções do boletim.`
    );

    if (!confirmar) return;

    setCultoExcluindoId(cultoId);

    try {
      const { data: secoesRaw, error: secoesError } = await supabase
        .from('boletim_secoes')
        .select('id')
        .eq('culto_id', cultoId)
        .eq('igreja_id', igrejaId);

      if (secoesError) throw secoesError;

      const secaoIds = (secoesRaw || [])
        .map((item) => item.id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      if (secaoIds.length > 0) {
        const { error: deleteItensError } = await supabase
          .from('boletim_itens')
          .delete()
          .in('secao_id', secaoIds);

        if (deleteItensError) throw deleteItensError;
      }

      const { error: deleteSecoesError } = await supabase
        .from('boletim_secoes')
        .delete()
        .eq('culto_id', cultoId)
        .eq('igreja_id', igrejaId);

      if (deleteSecoesError) throw deleteSecoesError;

      const { error: deleteLouvorItensError } = await supabase
        .from('louvor_itens')
        .delete()
        .eq('culto_id', cultoId);

      if (deleteLouvorItensError) throw deleteLouvorItensError;

      const { error: deleteCultoError } = await supabase
        .from('Louvores IPPN')
        .delete()
        .eq('"Culto nr."', cultoId)
        .eq('igreja_id', igrejaId);

      if (deleteCultoError) throw deleteCultoError;

      setCultos((atuais) => atuais.filter((item) => item['Culto nr.'] !== cultoId));
    } catch (error: any) {
      alert(`Erro ao excluir liturgia: ${error?.message || 'falha inesperada.'}`);
    } finally {
      setCultoExcluindoId(null);
    }
  };

  if (totalLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-base">Carregando...</p>
      </div>
    </div>
  );

  if (editando !== null) return (
    <EditorLiturgia
      key={editando === 'novo' ? `novo-${novoDiaInicial || 'sem-data'}` : `culto-${editando['Culto nr.']}`}
      culto={editando === 'novo' ? null : editando}
      diaInicial={editando === 'novo' ? novoDiaInicial : editando.Dia}
      todosCultos={cultos}
      onAbrirCulto={(culto: Culto) => setEditando(culto)}
      onNovaLiturgiaNoDia={(dia: string) => {
        setNovoDiaInicial(dia);
        setEditando('novo');
      }}
      canticos={canticos}
      setCanticos={setCanticos}
      configuracaoIgreja={configuracaoIgreja}
      podeEditarLiturgiaCompleta={permissoes.podeEditarLiturgiaCompleta}
      podeEditarLouvor={permissoes.podeEditarLouvor}
      onSalvo={() => { setEditando(null); setNovoDiaInicial(''); carregarTudo(); window.scrollTo({ top: 0 }); }}
      onCancelar={() => { setEditando(null); setNovoDiaInicial(''); }}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Liturgias</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              A interface já organiza os cultos por domingo/data. Assim fica mais natural trabalhar um boletim do domingo com uma ou várias liturgias dentro dele.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={abrirBoletimPublico}
              disabled={!igrejaPublicSlug}
              className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
            >
              Abrir boletim
            </button>
            <button
              type="button"
              onClick={compartilharBoletimPublico}
              disabled={!igrejaPublicSlug}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-100 active:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-400"
            >
              Compartilhar link
            </button>
            {isLideranca && (
              <button
                onClick={() => { setNovoDiaInicial(proximoDomingoSemBoletim(cultos)); setEditando('novo'); }}
                className="bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold text-base hover:bg-emerald-800 active:bg-emerald-900 transition-colors shadow-sm"
              >
                + Nova
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {cultos.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500">
              Nenhuma liturgia encontrada para a igreja selecionada.
            </div>
          )}
          {gruposRecentes.map((grupo) => (
            <section
              key={grupo.dia}
              className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
            >
              {(() => {
                const boletimReferencia = getCultoBoletimReferencia(grupo.cultos);

                return (
                  <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                    {grupo.isDomingo ? 'Boletim do domingo' : 'Grupo do dia'}
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                    {formatCultoDateLabel(grupo.dia)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {grupo.cultos.length === 1
                      ? '1 liturgia cadastrada neste dia.'
                      : `${grupo.cultos.length} liturgias cadastradas neste dia.`}
                  </p>
                </div>

                {isLideranca && (
                  <button
                    onClick={() => { setNovoDiaInicial(grupo.dia); setEditando('novo'); }}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    + Nova liturgia neste dia
                  </button>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <div className="overflow-hidden rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] shadow-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setBoletimDiaEditando((atual) =>
                        atual?.dia === grupo.dia ? null : { dia: grupo.dia, cultos: grupo.cultos }
                      )
                    }
                    className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-emerald-50/80"
                  >
                    <div className="max-w-3xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
                        Boletim compartilhado do dia
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Clique para abrir e editar a palavra pastoral, a imagem do tema, os avisos, a agenda, os pedidos de oração, os informativos e outros blocos deste domingo.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                          {boletimReferencia?.palavra_pastoral?.trim() ? 'Palavra pastoral preenchida' : 'Palavra pastoral vazia'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                          {boletimReferencia?.imagem_url ? 'Imagem definida' : 'Sem imagem do tema'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 shadow-sm">
                          {boletimDiaEditando?.dia === grupo.dia ? 'Editor aberto abaixo' : 'Editor fechado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className="hidden rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white lg:inline-flex">
                        {boletimDiaEditando?.dia === grupo.dia ? 'Fechar boletim' : 'Abrir boletim'}
                      </span>
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-emerald-700 shadow-sm transition-transform ${
                          boletimDiaEditando?.dia === grupo.dia ? 'rotate-180' : ''
                        }`}
                      >
                        ⌄
                      </span>
                    </div>
                  </button>

                  {boletimDiaEditando?.dia === grupo.dia ? (
                    <div className="border-t border-emerald-200 bg-white/90 p-4">
                      <EditorBoletimDoDiaModal
                        aberto
                        inline
                        dia={grupo.dia}
                        cultos={grupo.cultos}
                        onFechar={() => setBoletimDiaEditando(null)}
                        onSalvo={() => {
                          setBoletimDiaEditando(null);
                          carregarTudo();
                          window.scrollTo({ top: 0 });
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/65 p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                        Liturgias do dia
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Cada card abaixo representa uma liturgia especifica dentro deste mesmo domingo.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {grupo.cultos.map((culto, index) => (
                      <CultoCard
                        key={culto['Culto nr.']}
                        culto={culto}
                        tituloExibicao={
                          grupo.cultos.length > 1 ? `Liturgia ${index + 1}` : 'Liturgia única'
                        }
                        descricaoExibicao={
                          grupo.cultos.length > 1
                            ? 'Uma das liturgias deste mesmo domingo.'
                            : 'Liturgia deste domingo.'
                        }
                        esconderResumoBoletim
                        podeEditar={permissoes.podeEditarLouvor}
                        podeExcluir={isLideranca}
                        excluindo={cultoExcluindoId === culto['Culto nr.']}
                        onEditar={(item: Culto) => setEditando(item)}
                        onWhatsApp={shareWhatsApp}
                        onPDF={sharePDF}
                        onExcluir={deletarCulto}
                      />
                    ))}
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </section>
          ))}

          {!anterioresCarregados && podeHaverAnteriores && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={carregarAnteriores}
                disabled={carregandoAnteriores}
                className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm italic text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
              >
                {carregandoAnteriores ? 'Carregando boletins anteriores…' : 'Ver boletins anteriores'}
              </button>
            </div>
          )}

          {gruposAnteriores.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200" />
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Boletins anteriores
                </p>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              {gruposAnterioresVisiveis.map((grupo) => (
                <section
                  key={grupo.dia}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm opacity-90"
                >
                  {(() => {
                    const boletimReferencia = getCultoBoletimReferencia(grupo.cultos);

                    return (
                      <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                        {grupo.isDomingo ? 'Boletim do domingo' : 'Grupo do dia'}
                      </p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                        {formatCultoDateLabel(grupo.dia)}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {grupo.cultos.length === 1
                          ? '1 liturgia cadastrada neste dia.'
                          : `${grupo.cultos.length} liturgias cadastradas neste dia.`}
                      </p>
                    </div>

                    {isLideranca && (
                      <button
                        onClick={() => { setNovoDiaInicial(grupo.dia); setEditando('novo'); }}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        + Nova liturgia neste dia
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="overflow-hidden rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] shadow-sm">
                      <button
                        type="button"
                        onClick={() =>
                          setBoletimDiaEditando((atual) =>
                            atual?.dia === grupo.dia ? null : { dia: grupo.dia, cultos: grupo.cultos }
                          )
                        }
                        className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-emerald-50/80"
                      >
                        <div className="max-w-3xl">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
                            Boletim compartilhado do dia
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Clique para abrir e editar a palavra pastoral, a imagem do tema, os avisos, a agenda, os pedidos de oração, os informativos e outros blocos deste domingo.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                              {boletimReferencia?.palavra_pastoral?.trim() ? 'Palavra pastoral preenchida' : 'Palavra pastoral vazia'}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                              {boletimReferencia?.imagem_url ? 'Imagem definida' : 'Sem imagem do tema'}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 shadow-sm">
                              {boletimDiaEditando?.dia === grupo.dia ? 'Editor aberto abaixo' : 'Editor fechado'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-3">
                          <span className="hidden rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white lg:inline-flex">
                            {boletimDiaEditando?.dia === grupo.dia ? 'Fechar boletim' : 'Abrir boletim'}
                          </span>
                          <span
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-emerald-700 shadow-sm transition-transform ${
                              boletimDiaEditando?.dia === grupo.dia ? 'rotate-180' : ''
                            }`}
                          >
                            ⌄
                          </span>
                        </div>
                      </button>

                      {boletimDiaEditando?.dia === grupo.dia ? (
                        <div className="border-t border-emerald-200 bg-white/90 p-4">
                          <EditorBoletimDoDiaModal
                            aberto
                            inline
                            dia={grupo.dia}
                            cultos={grupo.cultos}
                            onFechar={() => setBoletimDiaEditando(null)}
                            onSalvo={() => {
                              setBoletimDiaEditando(null);
                              carregarTudo();
                              window.scrollTo({ top: 0 });
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/65 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                            Liturgias do dia
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            Cada card abaixo representa uma liturgia especifica dentro deste mesmo domingo.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {grupo.cultos.map((culto, index) => (
                          <CultoCard
                            key={culto['Culto nr.']}
                            culto={culto}
                            tituloExibicao={
                              grupo.cultos.length > 1 ? `Liturgia ${index + 1}` : 'Liturgia única'
                            }
                            descricaoExibicao={
                              grupo.cultos.length > 1
                                ? 'Uma das liturgias deste mesmo domingo.'
                                : 'Liturgia deste domingo.'
                            }
                            esconderResumoBoletim
                            podeEditar={permissoes.podeEditarLouvor}
                            podeExcluir={isLideranca}
                            excluindo={cultoExcluindoId === culto['Culto nr.']}
                            onEditar={(item: Culto) => setEditando(item)}
                            onWhatsApp={shareWhatsApp}
                            onPDF={sharePDF}
                            onExcluir={deletarCulto}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </section>
              ))}

              {totalPaginasAnteriores > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPaginaAnteriores((p) => Math.max(0, p - 1))}
                    disabled={paginaAnteriores === 0}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    ← Anterior
                  </button>
                  {Array.from({ length: totalPaginasAnteriores }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPaginaAnteriores(i)}
                      className={`h-10 w-10 rounded-2xl border text-sm font-bold transition-colors ${
                        paginaAnteriores === i
                          ? 'border-emerald-600 bg-emerald-700 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPaginaAnteriores((p) => Math.min(totalPaginasAnteriores - 1, p + 1))}
                    disabled={paginaAnteriores === totalPaginasAnteriores - 1}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    Próximo →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
