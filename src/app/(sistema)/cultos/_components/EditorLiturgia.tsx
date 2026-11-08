'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/i18n/provider';
import { compactLocalizedTextMap, createEmptyLocalizedTextMap, normalizeLocalizedTextMap, resolveLocalizedText, type LocalizedTextMapForm } from '@/lib/church-i18n';
import { getStoredChurchId } from '@/lib/church-utils';
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
    resolveTiposLiturgicos(configuracaoIgreja),
    itens
  );
  const temModeloDaIgreja = (configuracaoIgreja?.modelosLiturgia?.length || 0) > 0;
  const dataCultoFormatada = dia ? formatCultoDateLabel(dia) : 'Escolha a data do culto';
  const nomeLiturgiaAtual = nomeLiturgia.trim();
  const totalItensComTextoPublico = itens.filter((item) => item.conteudo_publico?.trim()).length;
  const tituloLiturgiaAtual = getCultoTituloExibicao(
    culto,
    nomeLiturgiaAtual || (culto ? 'Editar Liturgia' : 'Nova Liturgia')
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
      setItens(modeloPadrao(dia, configuracaoIgreja));
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
    setItens(modeloPadrao(baseDia, configuracaoIgreja));
  };

  const salvar = async () => {
    if (!dia) return alert('Selecione a data!');
    // O campo de data aceita anos como 0206 quando o ano é digitado à mão.
    const anoDia = Number(dia.slice(0, 4));
    const anoAtual = new Date().getFullYear();
    if (anoDia < 2000 || anoDia > anoAtual + 2) {
      return alert(`A data ${dia.split('-').reverse().join('/')} parece ter o ano errado. Confira o ano antes de salvar.`);
    }
    const dataAlterada = !culto || getCultoDateKey(culto.Dia) !== getCultoDateKey(dia);
    const avisosData = dataAlterada ? avisosDataBoletim(dia) : [];
    if (
      avisosData.length > 0 &&
      !confirm(
        `Confira a data do boletim:\n\n${formatCultoDateLabel(dia)}\n\n${avisosData.join('\n')}\n\nSalvar mesmo assim?`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) throw new Error('Selecione uma igreja antes de salvar a liturgia');
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

      alert('✅ Salvo com sucesso!');
      onSalvo();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
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
            ← Voltar
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Editor de liturgia</p>
            <h2 className="truncate text-base font-black uppercase tracking-wider text-slate-800">
              {tituloLiturgiaAtual}
            </h2>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              Boletim do dia: {dataCultoFormatada}
            </p>
          </div>
          <div className="hidden min-w-[220px] justify-end text-right text-xs text-slate-500 lg:flex">
            Preencha com calma. Tudo foi pensado para parecer um editor simples e guiado.
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1800px] gap-6 px-4 pt-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[28px] border border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))] p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-700">Como editar</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Uma folha simples para montar o culto</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Pense nesta tela como um editor guiado da liturgia. O boletim do dia é único; aqui você mexe apenas na liturgia que faz parte dele.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Resumo rápido</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Boletim do dia</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{dataCultoFormatada}</p>
              </div>
              {nomeLiturgiaAtual ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Liturgia em edição</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{nomeLiturgiaAtual}</p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Itens da liturgia</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{itens.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Texto público preenchido</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{totalItensComTextoPublico}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Dicas</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>O campo <strong>Público</strong> é o que pode aparecer no boletim e nas saídas públicas.</p>
              <p>O campo <strong>Interno</strong> é só para orientar quem vai conduzir o culto.</p>
              <p>Nos títulos dos itens, você pode digitar livremente. Não precisa cadastrar antes.</p>
              <p>Se a igreja já tem um modelo, você pode usá-lo como ponto de partida e depois ajustar tudo.</p>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-[34px] border border-slate-200/90 bg-white/95 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.96))] px-6 py-8 lg:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Liturgia do boletim</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">
              {tituloLiturgiaAtual}
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
              Este editor altera só a liturgia atual. Os campos compartilhados do boletim ficam fora daqui, no boletim único deste dia.
            </p>
            <div className="mt-5 inline-flex rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              Boletim do dia: {dataCultoFormatada}
            </div>
          </div>

          <div className="space-y-8 px-6 py-8 lg:px-10">
            {cultosDoMesmoDiaAtual.length > 0 ? (
              <div className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-700">
                      Domingo em conjunto
                    </p>
                    <h3 className="mt-2 text-xl font-black text-slate-900">
                      {cultosDoMesmoDiaAtual.length === 1
                        ? 'Este domingo tem 1 liturgia cadastrada'
                        : `Este domingo tem ${cultosDoMesmoDiaAtual.length} liturgias cadastradas`}
                    </h3>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                      O boletim deste dia pode ter várias liturgias. Você pode alternar entre elas ou abrir uma nova sem sair desta tela.
                    </p>
                  </div>

                  {isLideranca && dia ? (
                    <button
                      type="button"
                      onClick={() => onNovaLiturgiaNoDia(dia)}
                      className="rounded-2xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-100"
                    >
                      + Nova liturgia neste boletim
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
                          {estaAberta ? 'Editando agora: ' : ''}
                          {getCultoNomeLiturgia(item) || `Liturgia ${index + 1}`}
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
                  Etapa 1
                </span>
                <h3 className="mt-3 text-xl font-black text-slate-900">
                  {criandoNovaLiturgiaNoMesmoBoletim ? 'Boletim já aberto' : 'Data do boletim'}
                </h3>
                {criandoNovaLiturgiaNoMesmoBoletim ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Você está adicionando outra liturgia ao mesmo boletim. Por isso a data já fica presa a este boletim e os campos compartilhados não aparecem de novo aqui.
                    </p>
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4 text-2xl font-black text-emerald-800">
                      {dataCultoFormatada}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Escolha o domingo ou o dia ao qual este boletim pertence. Depois você pode ter uma ou várias liturgias diferentes dentro dele.
                    </p>
                    <input
                      type="date"
                      min="2000-01-01"
                      value={dia}
                      onChange={e => {
                        setDia(e.target.value);
                        if (!culto && e.target.value) setItens(modeloPadrao(e.target.value, configuracaoIgreja));
                      }}
                      disabled={!isLideranca}
                      className="mt-4 w-full bg-transparent py-1 text-2xl font-black text-emerald-800 outline-none"
                    />
                    {dia && (
                      <p className={`mt-2 text-sm font-bold ${isDomingoDate(dia) ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {dataCultoFormatada}
                        {!isDomingoDate(dia) && ' — atenção: não é domingo'}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-sky-200 bg-sky-50/50 p-5">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700 shadow-sm">
                Etapa 2
              </span>
              <h3 className="mt-3 text-xl font-black text-slate-900">Liturgia</h3>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
                Os campos compartilhados do boletim não aparecem aqui para não duplicar o boletim. Aqui você edita somente esta liturgia.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">
                    Etapa 3
                  </span>
                  <h3 className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-slate-400">Liturgia</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Aqui você edita uma liturgia específica dentro do boletim deste dia. É nesta parte que entram o nome da liturgia e os momentos da celebração.
                  </p>
                  {isLideranca && temModeloDaIgreja && (
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Se quiser acelerar, use o modelo da igreja e depois personalize cada item.
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
                        Usar modelo da igreja
                      </button>
                    )}
                    <button
                      onClick={() => adicionarItem(0)}
                      className="rounded-2xl px-4 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 active:bg-emerald-100"
                    >
                      + item no início
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Nome desta liturgia</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Dê um nome livre para esta liturgia específica dentro do boletim, como Culto da Manhã, Culto da Noite, Culto de Ceia do Senhor ou Escola Bíblica Dominical.
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
                  placeholder="Ex.: Culto da Manhã"
                  className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-2xl font-black text-slate-800 outline-none transition-colors focus:border-emerald-400 disabled:bg-slate-100"
                />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Esse nome identifica apenas esta liturgia. O boletim do domingo continua sendo único.
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
                              throw new Error('Selecione uma igreja antes de cadastrar um cântico.');
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
                              throw new Error(error.message || 'Nao foi possivel criar o cântico.');
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
                        + adicionar item aqui
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
              Salve quando terminar. Este botão salva apenas a liturgia atual dentro do boletim deste dia.
            </div>
            <button
              onClick={salvar}
              disabled={loading}
              className="block rounded-2xl bg-emerald-700 px-8 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading
                ? '⏳ Salvando...'
                : criandoNovaLiturgiaNoMesmoBoletim
                  ? '✅ Salvar nova liturgia neste boletim'
                  : '✅ Salvar Liturgia'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
