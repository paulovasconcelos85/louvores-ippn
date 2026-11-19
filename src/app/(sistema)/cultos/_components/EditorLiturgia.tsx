'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/i18n/provider';
import { porIdioma } from '@/i18n/por-idioma';
import { compactLocalizedTextMap, createEmptyLocalizedTextMap, normalizeLocalizedTextMap, resolveLocalizedText, type LocalizedTextMapForm } from '@/lib/church-i18n';
import { getStoredChurchId } from '@/lib/church-utils';
import { mensagemErroAoSalvar } from '@/lib/erro-banco';
import { TIPOS_LITURGICOS_PADRAO, HABILITAR_BOLETIM_SECOES_NEXT, BOLETIM_FALLBACK_TIPO_PREFIX, type Cantico, type LouvorItem, type BoletimSecaoRascunho, type Culto, type LouvorItemRow } from '../_lib/tipos';
import { normalizeTomMusicalForSave } from '../_lib/canticos';
import { isBoletimFallbackTipo, isLiturgiaMetaTipo, getCultoNomeLiturgia, getCultoTituloExibicao, resolveTiposLiturgicos, normalizarTiposLiturgicosDisponiveis, modeloPadrao, formatCultoDateLabel, getCultoDateKey, isDomingoDate, avisosDataBoletim, getCultoBoletimReferencia, erroColunaNaoEncontrada } from '../_lib/liturgia';
import { updateLocalizedDraftValue, normalizarSecoesBoletim, buildBoletimSecoesFromFallbackRows, buildLiturgiaMetaRow } from '../_lib/boletim';
import { carregarBoletimSecoesEstruturadasPorCulto, carregarUltimasSecoesBoletimPorTipo, carregarLouvorItensComCanticos, inserirLouvorItensComCompatibilidadeI18n, sincronizarBoletimFallbackLegado, uploadImagemTema } from '../_lib/dados';
import { ItemLiturgia } from './ItemLiturgia';

// --- EDITOR DE LITURGIA ---
export function EditorLiturgia({
  culto,
  diaInicial,
  todosCultos,
  onAbrirCulto,
  onNovaLiturgiaNoDia,
  onSalvo,
  onCancelar,
  canticos,
  setCanticos,
  podeEditarLiturgiaCompleta,
  podeEditarLouvor,
  configuracaoIgreja,
}: any) {
  const locale = useLocale();
  const tr = (pt: string, es: string, en: string) => porIdioma(locale, pt, es, en);
  const [dia, setDia] = useState<string>(culto?.Dia || diaInicial || '');
  const [nomeLiturgia, setNomeLiturgia] = useState<string>(culto?.nome_liturgia || '');
  const [nomeLiturgiaI18n, setNomeLiturgiaI18n] = useState<LocalizedTextMapForm>(
    createEmptyLocalizedTextMap()
  );
  const [itens, setItens] = useState<LouvorItem[]>([]);
  const [palavraPastoral, setPalavraPastoral] = useState(culto?.palavra_pastoral || '');
  const [palavraPastoralI18n, setPalavraPastoralI18n] = useState<LocalizedTextMapForm>(
    normalizeLocalizedTextMap(culto?.palavra_pastoral_i18n, culto?.palavra_pastoral || '')
  );
  const [palavraPastoralAutor, setPalavraPastoralAutor] = useState(
    culto?.palavra_pastoral_autor || configuracaoIgreja?.pastorPadrao || ''
  );
  const [imagemUpload, setImagemUpload] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(culto?.imagem_url || null);
  const [loading, setLoading] = useState(false);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecaoRascunho[]>([]);

  const isLideranca = podeEditarLiturgiaCompleta;
  const podVerTom = isLideranca || podeEditarLouvor;
  const canEditarMusica = isLideranca || podeEditarLouvor;
  const podeCadastrarCanticos =
    canEditarMusica && configuracaoIgreja?.permiteCadastroCanticos !== false;
  const tiposLiturgicos = normalizarTiposLiturgicosDisponiveis(
    resolveTiposLiturgicos(configuracaoIgreja, locale),
    itens
  );
  const temModeloDaIgreja = (configuracaoIgreja?.modelosLiturgia?.length || 0) > 0;
  const dataCultoFormatada = dia ? formatCultoDateLabel(dia, locale) : tr('Escolha a data do culto', 'Elige la fecha del culto', 'Choose the service date');
  const nomeLiturgiaAtual = nomeLiturgia.trim();
  const totalItensComTextoPublico = itens.filter((item) => item.conteudo_publico?.trim()).length;
  const tituloLiturgiaAtual = getCultoTituloExibicao(
    culto,
    nomeLiturgiaAtual || (culto ? tr('Editar Liturgia', 'Editar liturgia', 'Edit order of service') : tr('Nova Liturgia', 'Nueva liturgia', 'New order of service'))
  );
  const cultosDoMesmoDiaAtual = useMemo(
    () =>
      (todosCultos || []).filter(
        (item: Culto) => dia && getCultoDateKey(item.Dia) === getCultoDateKey(dia)
      ),
    [todosCultos, dia]
  );
  const criandoNovaLiturgiaNoMesmoBoletim = !culto && cultosDoMesmoDiaAtual.length > 0;
  const cultoAtualId = culto?.['Culto nr.'] || null;
  const cultoAtualNomeLiturgia = culto?.nome_liturgia || '';

  useEffect(() => {
    setNomeLiturgia(cultoAtualNomeLiturgia);
    setNomeLiturgiaI18n((current) =>
      updateLocalizedDraftValue(current, locale, cultoAtualNomeLiturgia)
    );
  }, [cultoAtualId, cultoAtualNomeLiturgia, locale]);

  useEffect(() => {
    if (culto) {
      carregarItens(culto['Culto nr.']);
    } else if (dia) {
      setItens(modeloPadrao(dia, configuracaoIgreja, locale));
    }
  }, [culto, dia, configuracaoIgreja]);

  useEffect(() => {
    if (!HABILITAR_BOLETIM_SECOES_NEXT) {
      setBoletimSecoes([]);
      return;
    }

    if (cultosDoMesmoDiaAtual.length > 0) {
      carregarSecoesBoletim(cultosDoMesmoDiaAtual.map((item: Culto) => item['Culto nr.']));
      return;
    }

    setBoletimSecoes([]);
  }, [culto, dia, todosCultos, locale]);

  useEffect(() => {
    if (culto?.palavra_pastoral_autor) return;
    if (!configuracaoIgreja?.pastorPadrao) return;

    setPalavraPastoralAutor((current: string) => (
      current.trim() ? current : configuracaoIgreja.pastorPadrao || ''
    ));
  }, [culto?.palavra_pastoral_autor, configuracaoIgreja]);

  useEffect(() => {
    if (!dia || cultosDoMesmoDiaAtual.length === 0) return;

    const referencia = getCultoBoletimReferencia(cultosDoMesmoDiaAtual);
    if (!referencia) return;

    const palavraAtualI18n = normalizeLocalizedTextMap(
      referencia.palavra_pastoral_i18n,
      referencia.palavra_pastoral || ''
    );
    setPalavraPastoral(
      resolveLocalizedText(palavraAtualI18n, locale, referencia.palavra_pastoral || '')
    );
    setPalavraPastoralI18n(palavraAtualI18n);
    setPalavraPastoralAutor(
      referencia.palavra_pastoral_autor || configuracaoIgreja?.pastorPadrao || ''
    );
    setImagemPreview(referencia.imagem_url || null);
    setImagemUpload(null);
  }, [dia, cultosDoMesmoDiaAtual, configuracaoIgreja?.pastorPadrao, locale]);

  const carregarItens = async (cultoNr: number) => {
    const data = await carregarLouvorItensComCanticos(cultoNr, canticos, getStoredChurchId());
    const metaNome = data.find((linha) => isLiturgiaMetaTipo(linha.tipo));
    const nomeI18n = normalizeLocalizedTextMap(
      metaNome?.conteudo_publico_i18n,
      metaNome?.conteudo_publico || ''
    );
    setNomeLiturgia(resolveLocalizedText(nomeI18n, locale, metaNome?.conteudo_publico || ''));
    setNomeLiturgiaI18n(nomeI18n);
    const itensLiturgia = data.filter(
      (linha) => !isBoletimFallbackTipo(linha.tipo) && !isLiturgiaMetaTipo(linha.tipo)
    );

    if (!itensLiturgia) return;

    // Agrupar linhas do mesmo item
    const agrupados: LouvorItem[] = [];
    itensLiturgia.forEach((linha: any) => {
      const conteudoPublicoI18n = normalizeLocalizedTextMap(
        linha.conteudo_publico_i18n,
        linha.conteudo_publico
      );
      const conteudoPublicoAtual = resolveLocalizedText(
        conteudoPublicoI18n,
        locale,
        linha.conteudo_publico
      );
      const ultimo = agrupados[agrupados.length - 1];
      if (
        ultimo &&
        ultimo.tipo === linha.tipo &&
        ultimo.conteudo_publico === conteudoPublicoAtual &&
        ultimo.descricao === linha.descricao &&
        ultimo.horario === linha.horario
      ) {
        ultimo.canticos_lista.push({ cantico_id: linha.cantico_id, tom: linha.tom });
      } else {
        agrupados.push({
          id: linha.id,
          tipo: linha.tipo,
          ordem: linha.ordem,
          conteudo_publico: conteudoPublicoAtual,
          conteudo_publico_i18n: conteudoPublicoI18n,
          descricao: linha.descricao,
          horario: linha.horario,
          canticos_lista: linha.cantico_id ? [{ cantico_id: linha.cantico_id, tom: linha.tom }] : [],
        });
      }
    });

    setItens(agrupados);
  };

  const carregarSecoesBoletim = async (cultoIds: number[]) => {
    if (!HABILITAR_BOLETIM_SECOES_NEXT) {
      setBoletimSecoes([]);
      return;
    }

    try {
      let secoesRascunho: BoletimSecaoRascunho[] = [];

      const igrejaId = getStoredChurchId();
      if (igrejaId) {
        const secoesEstruturadasPorCulto = await carregarBoletimSecoesEstruturadasPorCulto(
          igrejaId,
          cultoIds,
          locale
        );

        for (const cultoId of cultoIds) {
          const secoesDoCulto = secoesEstruturadasPorCulto.get(cultoId) || [];

          if (secoesDoCulto.length > 0) {
            secoesRascunho = secoesDoCulto;
            break;
          }
        }
      }

      if (secoesRascunho.length === 0) {
        const { data: itensRaw, error: itensError } = await supabase
          .from('louvor_itens')
          .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
          .in('culto_id', cultoIds)
          .order('ordem', { ascending: true });

        if (itensError) throw itensError;

        const rows = (itensRaw || []) as LouvorItemRow[];

        for (const cultoId of cultoIds) {
          const rowsDoCulto = rows.filter((row) => row.culto_id === cultoId);
          const secoesDoCulto = buildBoletimSecoesFromFallbackRows(rowsDoCulto, locale);

          if (secoesDoCulto.length > 0) {
            secoesRascunho = secoesDoCulto;
            break;
          }
        }
      }

      const secoesAtuais = normalizarSecoesBoletim(secoesRascunho);

      // Mesmo critério do editor do boletim: só um boletim ainda vazio herda o da semana anterior.
      if (!igrejaId || secoesRascunho.length > 0) {
        setBoletimSecoes(secoesAtuais);
        return;
      }

      const { secoes: secoesAnterior, origemDia } = await carregarUltimasSecoesBoletimPorTipo(
        igrejaId,
        dia,
        null,
        locale
      );

      if (secoesAnterior.length === 0 || !origemDia) {
        setBoletimSecoes(secoesAtuais);
        return;
      }

      setBoletimSecoes(normalizarSecoesBoletim(secoesAnterior));
    } catch (error) {
      console.warn('Falha ao carregar seções extras do boletim:', error);
      setBoletimSecoes([]);
    }
  };

  const adicionarItem = (posicao: number) => {
    const novo: LouvorItem = {
      tipo: tiposLiturgicos[0] || TIPOS_LITURGICOS_PADRAO[0],
      ordem: posicao + 1,
      conteudo_publico: null,
      conteudo_publico_i18n: createEmptyLocalizedTextMap(),
      descricao: null,
      horario: null,
      canticos_lista: [],
    };
    const novos = [...itens];
    novos.splice(posicao, 0, novo);
    setItens(novos.map((it, i) => ({ ...it, ordem: i + 1 })));
  };

  const aplicarModeloDaIgreja = () => {
    const baseDia = dia || new Date().toISOString().split('T')[0];
    setItens(modeloPadrao(baseDia, configuracaoIgreja, locale));
  };

  const salvar = async () => {
    if (!dia) return alert(tr('Selecione a data!', '¡Selecciona la fecha!', 'Select the date!'));
    // O campo de data aceita anos como 0206 quando o ano é digitado à mão.
    const anoDia = Number(dia.slice(0, 4));
    const anoAtual = new Date().getFullYear();
    if (anoDia < 2000 || anoDia > anoAtual + 2) {
      const dataDigitada = dia.split('-').reverse().join('/');
      return alert(
        tr(
          `A data ${dataDigitada} parece ter o ano errado. Confira o ano antes de salvar.`,
          `La fecha ${dataDigitada} parece tener el año equivocado. Revisa el año antes de guardar.`,
          `The date ${dataDigitada} seems to have the wrong year. Check the year before saving.`
        )
      );
    }
    const dataAlterada = !culto || getCultoDateKey(culto.Dia) !== getCultoDateKey(dia);
    const avisosData = dataAlterada ? avisosDataBoletim(dia, locale) : [];
    if (
      avisosData.length > 0 &&
      !confirm(
        `${tr('Confira a data do boletim:', 'Revisa la fecha del boletín:', 'Check the bulletin date:')}\n\n${formatCultoDateLabel(dia, locale)}\n\n${avisosData.join('\n')}\n\n${tr('Salvar mesmo assim?', '¿Guardar de todos modos?', 'Save anyway?')}`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) throw new Error(tr('Selecione uma igreja antes de salvar a liturgia', 'Selecciona una iglesia antes de guardar la liturgia', 'Select a church before saving the order of service'));
      const palavraPastoralAtualizadaI18n = compactLocalizedTextMap(
        updateLocalizedDraftValue(palavraPastoralI18n, locale, palavraPastoral)
      );
      const payloadCultoBase = (incluirI18n: boolean) => ({
        Dia: dia,
        igreja_id: igrejaId,
        palavra_pastoral: palavraPastoralI18n.pt || palavraPastoral || null,
        ...(incluirI18n ? { palavra_pastoral_i18n: palavraPastoralAtualizadaI18n } : {}),
        palavra_pastoral_autor: palavraPastoralAutor || null,
      });

      let cId = culto?.['Culto nr.'];
      let imagemUrl = culto?.imagem_url || null;

      if (!cId) {
        let insertResult = await supabase
          .from('Louvores IPPN')
          .insert(payloadCultoBase(true))
          .select()
          .single();

        if (insertResult.error && erroColunaNaoEncontrada(insertResult.error, 'palavra_pastoral_i18n')) {
          insertResult = await supabase
            .from('Louvores IPPN')
            .insert(payloadCultoBase(false))
            .select()
            .single();
        }

        if (insertResult.error) throw insertResult.error;
        cId = insertResult.data['Culto nr.'];
      } else {
        let updateResult = await supabase
          .from('Louvores IPPN')
          .update(payloadCultoBase(true))
          .eq('"Culto nr."', cId)
          .eq('igreja_id', igrejaId);

        if (updateResult.error && erroColunaNaoEncontrada(updateResult.error, 'palavra_pastoral_i18n')) {
          updateResult = await supabase
            .from('Louvores IPPN')
            .update(payloadCultoBase(false))
            .eq('"Culto nr."', cId)
            .eq('igreja_id', igrejaId);
        }

        if (updateResult.error) throw updateResult.error;
      }

      if (imagemUpload) {
        imagemUrl = await uploadImagemTema(imagemUpload, cId);
      }

      const cultoIdsMesmoDia = Array.from(
        new Set([...cultosDoMesmoDiaAtual.map((item: Culto) => item['Culto nr.']), cId])
      );
      const imagemUrlFinal =
        imagemPreview === null && !imagemUpload
          ? null
          : imagemUrl ||
            (typeof imagemPreview === 'string' && !imagemPreview.startsWith('data:') ? imagemPreview : null);

      if (cultoIdsMesmoDia.length > 0) {
        const payloadBoletimCompartilhado = (incluirI18n: boolean) => ({
          palavra_pastoral: palavraPastoralI18n.pt || palavraPastoral || null,
          ...(incluirI18n ? { palavra_pastoral_i18n: palavraPastoralAtualizadaI18n } : {}),
          palavra_pastoral_autor: palavraPastoralAutor || null,
          imagem_url: imagemUrlFinal,
        });

        let syncResult = await supabase
          .from('Louvores IPPN')
          .update(payloadBoletimCompartilhado(true))
          .in('"Culto nr."', cultoIdsMesmoDia)
          .eq('igreja_id', igrejaId);

        if (syncResult.error && erroColunaNaoEncontrada(syncResult.error, 'palavra_pastoral_i18n')) {
          syncResult = await supabase
            .from('Louvores IPPN')
            .update(payloadBoletimCompartilhado(false))
            .in('"Culto nr."', cultoIdsMesmoDia)
            .eq('igreja_id', igrejaId);
        }

        if (syncResult.error) throw syncResult.error;
      }

      const rows: any[] = [];
      const metaNomeLiturgia = buildLiturgiaMetaRow(
        nomeLiturgia,
        updateLocalizedDraftValue(nomeLiturgiaI18n, locale, nomeLiturgia)
      );

      if (metaNomeLiturgia) {
        rows.push({
          id: crypto.randomUUID(),
          culto_id: cId,
          ...metaNomeLiturgia,
        });
      }

      let ord = 1;
      itens.forEach(it => {
        if (it.canticos_lista.length > 0) {
          it.canticos_lista.forEach(m => {
            rows.push({
              id: crypto.randomUUID(),
              culto_id: cId, ordem: ord++, tipo: it.tipo,
              conteudo_publico: it.conteudo_publico || null,
              conteudo_publico_i18n: compactLocalizedTextMap(it.conteudo_publico_i18n),
              descricao: it.descricao || null,
              horario: it.horario || null,
              cantico_id: m.cantico_id || null,
              tom: normalizeTomMusicalForSave(m.tom),
            });
          });
        } else {
          rows.push({
            id: crypto.randomUUID(),
            culto_id: cId, ordem: ord++, tipo: it.tipo,
            conteudo_publico: it.conteudo_publico || null,
            conteudo_publico_i18n: compactLocalizedTextMap(it.conteudo_publico_i18n),
            descricao: it.descricao || null,
            horario: it.horario || null,
            cantico_id: null, tom: null,
          });
        }
      });

      if (rows.length > 0) {
        await inserirLouvorItensComCompatibilidadeI18n(rows);

        const rowIds = rows.map((row) => row.id).filter(Boolean);
        const deleteQuery = supabase
          .from('louvor_itens')
          .delete()
          .eq('culto_id', cId)
          .not('tipo', 'like', `${BOLETIM_FALLBACK_TIPO_PREFIX}%`);

        const { error } = rowIds.length > 0
          ? await deleteQuery.not('id', 'in', `(${rowIds.join(',')})`)
          : await deleteQuery;

        if (error) throw error;
      }

      if (HABILITAR_BOLETIM_SECOES_NEXT) {
        await sincronizarBoletimFallbackLegado(cultoIdsMesmoDia, boletimSecoes);
      }

      alert(tr('✅ Salvo com sucesso!', '✅ ¡Guardado!', '✅ Saved!'));
      onSalvo();
    } catch (e) {
      alert(mensagemErroAoSalvar(e, locale, 'salvar_liturgia'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.10),_transparent_28%),linear-gradient(180deg,#f4f7f6_0%,#eef3f1_100%)] pb-36">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
          <button onClick={onCancelar} className="rounded-2xl px-4 py-2.5 text-base font-bold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100">
            {tr('← Voltar', '← Volver', '← Back')}
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">{tr('Editor de liturgia', 'Editor de liturgia', 'Order of service editor')}</p>
            <h2 className="truncate text-base font-black uppercase tracking-wider text-slate-800">
              {tituloLiturgiaAtual}
            </h2>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              {tr('Boletim do dia:', 'Boletín del día:', 'Day\'s bulletin:')} {dataCultoFormatada}
            </p>
          </div>
          <div className="hidden min-w-[220px] justify-end text-right text-xs text-slate-500 lg:flex">
            {tr('Preencha com calma. Tudo foi pensado para parecer um editor simples e guiado.', 'Complétalo con calma. Todo está pensado para ser un editor simple y guiado.', 'Take your time. Everything is laid out as a simple, guided editor.')}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1800px] gap-6 px-4 pt-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-700">{tr('Como editar', 'Cómo editar', 'How to edit')}</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{tr('Uma folha simples para montar o culto', 'Una hoja simple para armar el culto', 'A simple sheet to plan the service')}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {tr('Pense nesta tela como um editor guiado da liturgia. O boletim do dia é único; aqui você mexe apenas na liturgia que faz parte dele.', 'Piensa en esta pantalla como un editor guiado de la liturgia. El boletín del día es único; aquí solo cambias la liturgia que forma parte de él.', 'Think of this screen as a guided editor for the order of service. There is one bulletin per day; here you only change the order of service inside it.')}
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">{tr('Resumo rápido', 'Resumen rápido', 'Quick summary')}</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{tr('Boletim do dia', 'Boletín del día', 'Day\'s bulletin')}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{dataCultoFormatada}</p>
              </div>
              {nomeLiturgiaAtual ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{tr('Liturgia em edição', 'Liturgia en edición', 'Order of service being edited')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{nomeLiturgiaAtual}</p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{tr('Itens da liturgia', 'Elementos de la liturgia', 'Service items')}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{itens.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{tr('Texto público preenchido', 'Texto público completado', 'Items with public text')}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{totalItensComTextoPublico}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">{tr('Dicas', 'Consejos', 'Tips')}</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>{tr('O campo', 'El campo', 'The')} <strong>{tr('Público', 'Público', 'Public')}</strong> {tr('é o que pode aparecer no boletim e nas saídas públicas.', 'es lo que puede aparecer en el boletín y en las publicaciones.', 'field is what can appear in the bulletin and public outputs.')}</p>
              <p>{tr('O campo', 'El campo', 'The')} <strong>{tr('Interno', 'Interno', 'Internal')}</strong> {tr('é só para orientar quem vai conduzir o culto.', 'es solo para orientar a quien dirigirá el culto.', 'field is only to guide whoever leads the service.')}</p>
              <p>{tr('Nos títulos dos itens, você pode digitar livremente. Não precisa cadastrar antes.', 'En los títulos de los elementos puedes escribir libremente. No hace falta registrarlos antes.', 'You can type item titles freely. No need to set them up first.')}</p>
              <p>{tr('Se a igreja já tem um modelo, você pode usá-lo como ponto de partida e depois ajustar tudo.', 'Si la iglesia ya tiene un modelo, puedes usarlo como punto de partida y luego ajustarlo todo.', 'If your church has a template, start from it and adjust everything afterwards.')}</p>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-[34px] border border-slate-200/90 bg-white/95 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-6 py-8 lg:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">{tr('Liturgia do boletim', 'Liturgia del boletín', 'Bulletin order of service')}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">
              {tituloLiturgiaAtual}
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              {tr('Este editor altera só a liturgia atual. Os campos compartilhados do boletim ficam fora daqui, no boletim único deste dia.', 'Este editor cambia solo la liturgia actual. Los campos compartidos del boletín están fuera de aquí, en el boletín único de este día.', 'This editor only changes the current order of service. Shared bulletin fields live outside, in this day\'s single bulletin.')}
            </p>
            <div className="mt-5 inline-flex rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              {tr('Boletim do dia:', 'Boletín del día:', 'Day\'s bulletin:')} {dataCultoFormatada}
            </div>
          </div>

          <div className="space-y-8 px-6 py-8 lg:px-10">
            {cultosDoMesmoDiaAtual.length > 0 ? (
              <div className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-700">
                      {tr('Domingo em conjunto', 'Domingo en conjunto', 'Shared Sunday')}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-slate-900">
                      {cultosDoMesmoDiaAtual.length === 1
                        ? tr('Este domingo tem 1 liturgia cadastrada', 'Este domingo tiene 1 liturgia registrada', 'This Sunday has 1 order of service')
                        : tr(
                            `Este domingo tem ${cultosDoMesmoDiaAtual.length} liturgias cadastradas`,
                            `Este domingo tiene ${cultosDoMesmoDiaAtual.length} liturgias registradas`,
                            `This Sunday has ${cultosDoMesmoDiaAtual.length} orders of service`
                          )}
                    </h3>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                      {tr('O boletim deste dia pode ter várias liturgias. Você pode alternar entre elas ou abrir uma nova sem sair desta tela.', 'El boletín de este día puede tener varias liturgias. Puedes alternar entre ellas o abrir una nueva sin salir de esta pantalla.', 'This day\'s bulletin can hold several orders of service. Switch between them or open a new one without leaving this screen.')}
                    </p>
                  </div>

                  {isLideranca && dia ? (
                    <button
                      type="button"
                      onClick={() => onNovaLiturgiaNoDia(dia)}
                      className="rounded-2xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-100"
                    >
                      {tr('+ Nova liturgia neste boletim', '+ Nueva liturgia en este boletín', '+ New order of service in this bulletin')}
                    </button>
                  ) : null}
                </div>

                {cultosDoMesmoDiaAtual.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {cultosDoMesmoDiaAtual.map((item: Culto, index: number) => {
                      const estaAberta = cultoAtualId !== null && item['Culto nr.'] === cultoAtualId;

                      return (
                        <button
                          key={item['Culto nr.']}
                          type="button"
                          onClick={() => onAbrirCulto(item)}
                          disabled={estaAberta}
                          className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                            estaAberta
                              ? 'border-sky-300 bg-sky-100 text-sky-900'
                              : 'border-sky-200 bg-white text-sky-800 hover:bg-sky-100'
                          }`}
                        >
                          {estaAberta ? tr('Editando agora: ', 'Editando ahora: ', 'Editing now: ') : ''}
                          {getCultoNomeLiturgia(item) || `${tr('Liturgia', 'Liturgia', 'Service')} ${index + 1}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700 shadow-sm">
                  {tr('Etapa 1', 'Paso 1', 'Step 1')}
                </span>
                <h3 className="mt-3 text-xl font-black text-slate-900">
                  {criandoNovaLiturgiaNoMesmoBoletim ? tr('Boletim já aberto', 'Boletín ya abierto', 'Bulletin already open') : tr('Data do boletim', 'Fecha del boletín', 'Bulletin date')}
                </h3>
                {criandoNovaLiturgiaNoMesmoBoletim ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {tr('Você está adicionando outra liturgia ao mesmo boletim. Por isso a data já fica presa a este boletim e os campos compartilhados não aparecem de novo aqui.', 'Estás agregando otra liturgia al mismo boletín. Por eso la fecha queda fija en este boletín y los campos compartidos no vuelven a aparecer aquí.', 'You are adding another order of service to the same bulletin, so the date is fixed to this bulletin and shared fields are not shown again here.')}
                    </p>
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-2xl font-black text-emerald-800">
                      {dataCultoFormatada}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {tr('Escolha o domingo ou o dia ao qual este boletim pertence. Depois você pode ter uma ou várias liturgias diferentes dentro dele.', 'Elige el domingo o el día al que pertenece este boletín. Después puedes tener una o varias liturgias dentro de él.', 'Choose the Sunday or day this bulletin belongs to. You can then have one or more orders of service inside it.')}
                    </p>
                    <input
                      type="date"
                      min="2000-01-01"
                      value={dia}
                      onChange={e => {
                        setDia(e.target.value);
                        if (!culto && e.target.value) setItens(modeloPadrao(e.target.value, configuracaoIgreja, locale));
                      }}
                      disabled={!isLideranca}
                      className="mt-4 w-full bg-transparent py-1 text-2xl font-black text-emerald-800 outline-none"
                    />
                    {dia && (
                      <p className={`mt-2 text-sm font-bold ${isDomingoDate(dia) ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {dataCultoFormatada}
                        {!isDomingoDate(dia) && tr(' — atenção: não é domingo', ' — atención: no es domingo', ' — note: not a Sunday')}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-sky-200 bg-sky-50/50 p-5">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700 shadow-sm">
                {tr('Etapa 2', 'Paso 2', 'Step 2')}
              </span>
              <h3 className="mt-3 text-xl font-black text-slate-900">{tr('Liturgia', 'Liturgia', 'Order of service')}</h3>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
                {tr('Os campos compartilhados do boletim não aparecem aqui para não duplicar o boletim. Aqui você edita somente esta liturgia.', 'Los campos compartidos del boletín no aparecen aquí para no duplicarlo. Aquí editas solo esta liturgia.', 'Shared bulletin fields are not shown here so the bulletin is not duplicated. Here you edit only this order of service.')}
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
                    {tr('Etapa 3', 'Paso 3', 'Step 3')}
                  </span>
                  <h3 className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-slate-400">{tr('Liturgia', 'Liturgia', 'Order of service')}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {tr('Aqui você edita uma liturgia específica dentro do boletim deste dia. É nesta parte que entram o nome da liturgia e os momentos da celebração.', 'Aquí editas una liturgia específica dentro del boletín de este día. En esta parte van el nombre de la liturgia y los momentos de la celebración.', 'Here you edit one order of service inside this day\'s bulletin: its name and each part of the service.')}
                  </p>
                  {isLideranca && temModeloDaIgreja && (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {tr('Se quiser acelerar, use o modelo da igreja e depois personalize cada item.', 'Para ir más rápido, usa el modelo de la iglesia y luego personaliza cada elemento.', 'To go faster, use your church\'s template and then customize each item.')}
                    </p>
                  )}
                </div>
                {isLideranca && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {temModeloDaIgreja && (
                      <button
                        onClick={aplicarModeloDaIgreja}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 active:bg-emerald-200"
                      >
                        {tr('Usar modelo da igreja', 'Usar modelo de la iglesia', 'Use church template')}
                      </button>
                    )}
                    <button
                      onClick={() => adicionarItem(0)}
                      className="rounded-2xl px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
                    >
                      {tr('+ item no início', '+ elemento al inicio', '+ item at the top')}
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{tr('Nome desta liturgia', 'Nombre de esta liturgia', 'Name of this order of service')}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {tr('Dê um nome livre para esta liturgia específica dentro do boletim, como Culto da Manhã, Culto da Noite, Culto de Ceia do Senhor ou Escola Bíblica Dominical.', 'Dale un nombre libre a esta liturgia dentro del boletín, como Culto de la mañana, Culto de la noche, Culto de Santa Cena o Escuela Dominical.', 'Give this order of service any name, like Morning Service, Evening Service, Lord\'s Supper Service or Sunday School.')}
                </p>
                <input
                  type="text"
                  value={nomeLiturgia}
                  onChange={(e) => {
                    setNomeLiturgia(e.target.value);
                    setNomeLiturgiaI18n((current) =>
                      updateLocalizedDraftValue(current, locale, e.target.value)
                    );
                  }}
                  disabled={!isLideranca}
                  placeholder={tr('Ex.: Culto da Manhã', 'Ej.: Culto de la mañana', 'E.g. Morning Service')}
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-2xl font-black text-slate-800 outline-none transition-colors focus:border-emerald-400 disabled:bg-slate-100"
                />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  {tr('Esse nome identifica apenas esta liturgia. O boletim do domingo continua sendo único.', 'Este nombre identifica solo esta liturgia. El boletín del domingo sigue siendo único.', 'This name identifies only this order of service. Sunday\'s bulletin stays a single bulletin.')}
                </p>
              </div>

              <div className="space-y-3">
                {itens.map((it, idx) => (
                  <div key={idx}>
                    <ItemLiturgia
                      item={{ ...it, tiposLiturgicosDisponiveis: tiposLiturgicos }}
                      index={idx}
                      canticos={canticos}
                      onCreate={podeCadastrarCanticos
                        ? async (nome: string) => {
                            const igrejaId = getStoredChurchId();
                            if (!igrejaId) {
                              throw new Error(tr('Selecione uma igreja antes de cadastrar um cântico.', 'Selecciona una iglesia antes de registrar un cántico.', 'Select a church before adding a song.'));
                            }

                            const payload = {
                              nome: nome.trim(),
                              letra: '',
                              referencia: '',
                              tags: [],
                              youtube_url: null,
                              spotify_url: null,
                              igreja_id: igrejaId,
                            };

                            const { data, error }: any = await supabase
                              .from('canticos')
                              .insert(payload)
                              .select('id, nome, igreja_id')
                              .single();

                            if (error) {
                              throw new Error(error.message || tr('Nao foi possivel criar o cântico.', 'No se pudo crear el cántico.', 'Could not create the song.'));
                            }

                            const novo = { ...data, ultima_vez: null };
                            setCanticos((prev: Cantico[]) => [...prev, novo]);
                            return novo;
                          }
                        : undefined}
                      onUpdate={(u: LouvorItem) => {
                        const novos = [...itens];
                        novos[idx] = u;
                        setItens(novos);
                      }}
                      onRemove={() => setItens(itens.filter((_, i) => i !== idx))}
                      onMove={(d: string) => {
                        const novos = [...itens];
                        const alvo = d === 'cima' ? idx - 1 : idx + 1;
                        if (alvo >= 0 && alvo < novos.length) {
                          [novos[idx], novos[alvo]] = [novos[alvo], novos[idx]];
                          setItens(novos);
                        }
                      }}
                      isLideranca={isLideranca}
                      podVerTom={podVerTom}
                      canEditarMusica={canEditarMusica}
                    />

                    {isLideranca && (
                      <button
                        onClick={() => adicionarItem(idx + 1)}
                        className="mt-2 w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100"
                      >
                        {tr('+ adicionar item aqui', '+ agregar elemento aquí', '+ add item here')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Botão salvar fixo */}
      {isLideranca && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
            <div className="text-sm leading-6 text-slate-500">
              {tr('Salve quando terminar. Este botão salva apenas a liturgia atual dentro do boletim deste dia.', 'Guarda cuando termines. Este botón guarda solo la liturgia actual dentro del boletín de este día.', 'Save when you\'re done. This button only saves the current order of service in this day\'s bulletin.')}
            </div>
            <button
              onClick={salvar}
              disabled={loading}
              className="block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading
                ? tr('⏳ Salvando...', '⏳ Guardando...', '⏳ Saving...')
                : criandoNovaLiturgiaNoMesmoBoletim
                  ? tr('✅ Salvar nova liturgia neste boletim', '✅ Guardar nueva liturgia en este boletín', '✅ Save new order of service in this bulletin')
                  : tr('✅ Salvar Liturgia', '✅ Guardar liturgia', '✅ Save order of service')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
