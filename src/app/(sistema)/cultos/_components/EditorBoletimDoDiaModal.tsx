'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/i18n/provider';
import { compactLocalizedTextMap, createEmptyLocalizedTextMap, normalizeLocalizedTextMap, resolveLocalizedText, withPtFallback, type LocalizedTextMapForm } from '@/lib/church-i18n';
import { getStoredChurchId } from '@/lib/church-utils';
import type { BoletimSecaoRascunho, NoticiaMensal, Culto, LouvorItemRow } from '../_lib/tipos';
import { formatCultoDateLabel, getMesAnoReferencia, getCultoBoletimReferencia, erroBoletimEstruturadoIndisponivel } from '../_lib/liturgia';
import { getBoletimTipoConfig, updateLocalizedDraftValue, normalizarSecoesBoletim, buildBoletimSecoesFromFallbackRows } from '../_lib/boletim';
import { carregarBoletimSecoesEstruturadasPorCulto, carregarUltimasSecoesBoletimPorTipo, sincronizarBoletimFallbackLegado, uploadImagemTema } from '../_lib/dados';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { EscolherTipoSecaoModal } from './EscolherTipoSecaoModal';
import { EditorSecaoBoletimModal } from './EditorSecaoBoletimModal';
import { EditorNoticiaMensalModal } from './EditorNoticiaMensalModal';

export function EditorBoletimDoDiaModal({
  aberto,
  dia,
  cultos,
  onFechar,
  onSalvo,
  inline = false,
}: {
  aberto: boolean;
  dia: string;
  cultos: Culto[];
  onFechar: () => void;
  onSalvo: () => void;
  inline?: boolean;
}) {
  const locale = useLocale();
  const [palavraPastoral, setPalavraPastoral] = useState('');
  const [palavraPastoralI18n, setPalavraPastoralI18n] = useState<LocalizedTextMapForm>(
    createEmptyLocalizedTextMap()
  );
  const [palavraPastoralAutor, setPalavraPastoralAutor] = useState('');
  const [imagemUpload, setImagemUpload] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [importando, setImportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [boletimSecoes, setBoletimSecoes] = useState<BoletimSecaoRascunho[]>([]);
  const [loadingBoletim, setLoadingBoletim] = useState(false);
  const [showEscolherTipo, setShowEscolherTipo] = useState(false);
  const [tipoNovaSecao, setTipoNovaSecao] = useState<string | null>(null);
  const [secaoEditandoIndex, setSecaoEditandoIndex] = useState<number | null>(null);
  const [secoesReaproveitadasDe, setSecoesReaproveitadasDe] = useState<string | null>(null);
  const [noticiasMensais, setNoticiasMensais] = useState<NoticiaMensal[]>([]);
  const [loadingNoticias, setLoadingNoticias] = useState(false);
  const [showNoticiaEditor, setShowNoticiaEditor] = useState(false);
  const [noticiaEditando, setNoticiaEditando] = useState<NoticiaMensal | null>(null);

  const referencia = useMemo(() => getCultoBoletimReferencia(cultos), [cultos]);
  const cultoIds = useMemo(() => cultos.map((culto) => culto['Culto nr.']), [cultos]);
  const secaoEditando =
    secaoEditandoIndex !== null ? boletimSecoes[secaoEditandoIndex] || null : null;
  const mesAnoReferencia = useMemo(() => getMesAnoReferencia(dia), [dia]);

  const carregarNoticiasMensais = useCallback(async () => {
    const igrejaId = getStoredChurchId();
    if (!igrejaId || !mesAnoReferencia) {
      setNoticiasMensais([]);
      return;
    }

    setLoadingNoticias(true);
    try {
      const { data, error } = await supabase
        .from('noticias_mensais')
        .select('*')
        .eq('igreja_id', igrejaId)
        .eq('mes_referencia', mesAnoReferencia.mes)
        .eq('ano_referencia', mesAnoReferencia.ano)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setNoticiasMensais((data || []) as NoticiaMensal[]);
    } catch (error) {
      console.error('Erro ao carregar notícias do mês:', error);
    } finally {
      setLoadingNoticias(false);
    }
  }, [mesAnoReferencia]);

  useEffect(() => {
    if (!aberto) return;
    carregarNoticiasMensais();
  }, [aberto, carregarNoticiasMensais]);

  const excluirNoticiaMensal = async (noticia: NoticiaMensal) => {
    if (!confirm(`Remover a notícia "${noticia.titulo}"?`)) return;

    try {
      const { error } = await supabase.from('noticias_mensais').delete().eq('id', noticia.id);
      if (error) throw error;
      await carregarNoticiasMensais();
    } catch (error) {
      console.error('Erro ao remover notícia do mês:', error);
      alert('❌ Erro ao remover notícia.');
    }
  };

  const alternarAtivoNoticiaMensal = async (noticia: NoticiaMensal) => {
    try {
      const { error } = await supabase
        .from('noticias_mensais')
        .update({ ativo: !noticia.ativo })
        .eq('id', noticia.id);
      if (error) throw error;
      await carregarNoticiasMensais();
    } catch (error) {
      console.error('Erro ao atualizar notícia do mês:', error);
      alert('❌ Erro ao atualizar notícia.');
    }
  };

  const moverNoticiaMensal = async (index: number, direcao: -1 | 1) => {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= noticiasMensais.length) return;

    const atual = noticiasMensais[index];
    const vizinho = noticiasMensais[alvo];

    try {
      const { error: erroAtual } = await supabase
        .from('noticias_mensais')
        .update({ ordem: vizinho.ordem })
        .eq('id', atual.id);
      if (erroAtual) throw erroAtual;

      const { error: erroVizinho } = await supabase
        .from('noticias_mensais')
        .update({ ordem: atual.ordem })
        .eq('id', vizinho.id);
      if (erroVizinho) throw erroVizinho;

      await carregarNoticiasMensais();
    } catch (error) {
      console.error('Erro ao reordenar notícias do mês:', error);
      alert('❌ Erro ao reordenar notícias.');
    }
  };

  useEffect(() => {
    if (!aberto) return;

    const palavraPastoralAtualI18n = normalizeLocalizedTextMap(
      referencia?.palavra_pastoral_i18n,
      referencia?.palavra_pastoral || ''
    );
    setPalavraPastoral(
      resolveLocalizedText(palavraPastoralAtualI18n, locale, referencia?.palavra_pastoral || '')
    );
    setPalavraPastoralI18n(palavraPastoralAtualI18n);
    setPalavraPastoralAutor(referencia?.palavra_pastoral_autor || '');
    setImagemPreview(referencia?.imagem_url || null);
    setImagemUpload(null);
    setInstagramUrl('');
    setSecoesReaproveitadasDe(null);

    const carregar = async () => {
      if (cultoIds.length === 0) {
        setBoletimSecoes([]);
        return;
      }

      setLoadingBoletim(true);
      try {
        let secoes: BoletimSecaoRascunho[] = [];

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
              secoes = secoesDoCulto;
              break;
            }
          }
        }

        if (secoes.length === 0) {
          const { data, error } = await supabase
            .from('louvor_itens')
            .select('id, culto_id, ordem, tipo, tom, cantico_id, conteudo_publico, conteudo_publico_i18n, descricao, horario')
            .in('culto_id', cultoIds)
            .order('ordem', { ascending: true });

          if (error) throw error;

          const rows = (data || []) as LouvorItemRow[];

          for (const cultoId of cultoIds) {
            const rowsDoCulto = rows.filter((row) => row.culto_id === cultoId);
            const secoesDoCulto = buildBoletimSecoesFromFallbackRows(rowsDoCulto, locale);
            if (secoesDoCulto.length > 0) {
              secoes = secoesDoCulto;
              break;
            }
          }
        }

        const secoesAtuais = normalizarSecoesBoletim(secoes);

        // Boletim já salvo: respeita o que está lá, inclusive seções apagadas de propósito.
        // Só um boletim ainda vazio é preenchido com o da semana anterior.
        if (!igrejaId || secoes.length > 0) {
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
        setSecoesReaproveitadasDe(origemDia);
      } catch (error) {
        console.warn('Falha ao carregar boletim do dia:', error);
        setBoletimSecoes([]);
        setSecoesReaproveitadasDe(null);
      } finally {
        setLoadingBoletim(false);
      }
    };

    carregar();
  }, [aberto, referencia, cultoIds, dia, locale]);

  if (!aberto) return null;

  const containerClassName = inline
    ? 'rounded-[28px] border border-emerald-200 bg-white shadow-sm'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm';

  const surfaceClassName = inline
    ? 'w-full'
    : 'max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[30px] bg-white shadow-2xl';

  const headerClassName = inline
    ? 'flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5'
    : 'sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5';

  const footerClassName = inline
    ? 'flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4'
    : 'sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4';

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagemUpload(file);
    const reader = new FileReader();
    reader.onload = event => setImagemPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const importarInstagram = async () => {
    if (!instagramUrl.trim()) return;
    setImportando(true);
    try {
      const postId = instagramUrl.match(/\/p\/([^\/]+)/)?.[1] || instagramUrl.match(/\/reel\/([^\/]+)/)?.[1];
      if (!postId) { alert('URL inválida'); return; }
      const response = await fetch('/api/instagram-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl: instagramUrl }),
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const file = new File([blob], `instagram-${postId}.jpg`, { type: 'image/jpeg' });
      setImagemUpload(file);
      const reader = new FileReader();
      reader.onload = event => setImagemPreview(event.target?.result as string);
      reader.readAsDataURL(file);
      setInstagramUrl('');
      alert('✅ Imagem importada!');
    } catch {
      alert('❌ Erro ao importar');
    } finally {
      setImportando(false);
    }
  };

  const salvarBoletim = async () => {
    if (cultoIds.length === 0) {
      alert('Crie pelo menos uma liturgia neste dia antes de editar o boletim.');
      return;
    }

    setSalvando(true);
    try {
      const igrejaId = getStoredChurchId();
      if (!igrejaId) throw new Error('Selecione uma igreja antes de salvar o boletim.');

      let imagemUrlFinal =
        imagemPreview === null && !imagemUpload
          ? null
          : referencia?.imagem_url || null;

      if (imagemUpload) {
        imagemUrlFinal = await uploadImagemTema(imagemUpload, cultoIds[0]);
      } else if (typeof imagemPreview === 'string' && !imagemPreview.startsWith('data:')) {
        imagemUrlFinal = imagemPreview;
      }

      const { error: syncBoletimError } = await supabase
        .from('Louvores IPPN')
        .update({
          palavra_pastoral: palavraPastoralI18n.pt || palavraPastoral || null,
          palavra_pastoral_i18n: compactLocalizedTextMap(
            updateLocalizedDraftValue(palavraPastoralI18n, locale, palavraPastoral)
          ),
          palavra_pastoral_autor: palavraPastoralAutor || null,
          imagem_url: imagemUrlFinal,
        })
        .in('"Culto nr."', cultoIds)
        .eq('igreja_id', igrejaId);

      if (syncBoletimError) throw syncBoletimError;

      const secoesNormalizadas = normalizarSecoesBoletim(boletimSecoes);

      try {
        const { data: secoesExistentesRaw, error: secoesExistentesError } = await supabase
          .from('boletim_secoes')
          .select('id')
          .eq('igreja_id', igrejaId)
          .in('culto_id', cultoIds);

        if (secoesExistentesError) throw secoesExistentesError;

        const secaoIdsExistentes = (secoesExistentesRaw || [])
          .map((item) => item.id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0);

        const secoesEstruturadasPayload: Array<{
          id: string;
          igreja_id: string;
          culto_id: number;
          tipo: string;
          titulo: string;
          titulo_i18n: ReturnType<typeof compactLocalizedTextMap>;
          icone: string | null;
          ordem: number;
          visivel: boolean;
        }> = [];
        const itensEstruturadosPayload: Array<{
          id: string;
          secao_id: string;
          conteudo: string;
          conteudo_i18n: ReturnType<typeof compactLocalizedTextMap>;
          destaque: boolean;
          ordem: number;
          imagem_url?: string;
        }> = [];

        for (const cultoId of cultoIds) {
          secoesNormalizadas.forEach((secao, secaoIndex) => {
            const config = getBoletimTipoConfig(secao.tipo);
            const secaoId = crypto.randomUUID();
            const tituloI18n = compactLocalizedTextMap(secao.titulo_i18n);

            secoesEstruturadasPayload.push({
              id: secaoId,
              igreja_id: igrejaId,
              culto_id: cultoId,
              tipo: secao.tipo,
              titulo: secao.titulo_i18n.pt || secao.titulo.trim() || config.titulo,
              titulo_i18n: tituloI18n,
              icone: secao.icone || config.icone,
              ordem: secaoIndex,
              visivel: secao.visivel,
            });

            secao.itens
              .map((item, itemIndex) => ({ item, itemIndex }))
              .filter(({ item }) => item.conteudo.trim().length > 0)
              .forEach(({ item, itemIndex }) => {
                const imagemUrl = item.imagem_url ?? null;
                const conteudoComPt = withPtFallback(item.conteudo_i18n, item.conteudo.trim());
                itensEstruturadosPayload.push({
                  id: crypto.randomUUID(),
                  secao_id: secaoId,
                  conteudo: conteudoComPt.pt || item.conteudo.trim(),
                  conteudo_i18n: compactLocalizedTextMap(conteudoComPt),
                  destaque: item.destaque,
                  ordem: itemIndex,
                  ...(imagemUrl !== null ? { imagem_url: imagemUrl } : {}),
                });
              });
          });
        }

        if (secoesEstruturadasPayload.length > 0) {
          const { error: insertSecoesEstruturadasError } = await supabase
            .from('boletim_secoes')
            .insert(secoesEstruturadasPayload);

          if (insertSecoesEstruturadasError) throw insertSecoesEstruturadasError;
        }

        if (itensEstruturadosPayload.length > 0) {
          const { error: insertItensEstruturadosError } = await supabase
            .from('boletim_itens')
            .insert(itensEstruturadosPayload);

          if (insertItensEstruturadosError) throw insertItensEstruturadosError;
        }

        if (secaoIdsExistentes.length > 0) {
          const { error: deleteItensEstruturadosError } = await supabase
            .from('boletim_itens')
            .delete()
            .in('secao_id', secaoIdsExistentes);

          if (deleteItensEstruturadosError) throw deleteItensEstruturadosError;
        }

        const secoesEstruturadasIds = secoesEstruturadasPayload.map((secao) => secao.id);
        const deleteSecoesQuery = supabase
          .from('boletim_secoes')
          .delete()
          .eq('igreja_id', igrejaId)
          .in('culto_id', cultoIds);

        const { error: deleteSecoesEstruturadasError } = secoesEstruturadasIds.length > 0
          ? await deleteSecoesQuery.not('id', 'in', `(${secoesEstruturadasIds.join(',')})`)
          : await deleteSecoesQuery;

        if (deleteSecoesEstruturadasError) throw deleteSecoesEstruturadasError;
      } catch (structuredError) {
        if (!erroBoletimEstruturadoIndisponivel(structuredError)) {
          throw structuredError;
        }

        console.warn(
          'Boletim estruturado indisponivel; salvando apenas no fallback legado.',
          structuredError
        );
      }

      await sincronizarBoletimFallbackLegado(cultoIds, secoesNormalizadas);

      alert('✅ Boletim do dia salvo com sucesso!');
      onSalvo();
    } catch (error: any) {
      alert(`Erro: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className={containerClassName}>
      <div className={surfaceClassName}>
        <div className={headerClassName}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Boletim do dia</p>
            <h3 className="mt-1 text-2xl font-black text-slate-900">{formatCultoDateLabel(dia)}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Este conteúdo é compartilhado entre todas as liturgias deste dia.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {inline ? 'Fechar editor' : 'Fechar'}
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          {inline ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-sm leading-6 text-emerald-950/80">
              Aqui voce edita o boletim compartilhado deste domingo sem precisar entrar em uma liturgia especifica.
            </div>
          ) : null}

          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Palavra Pastoral</p>
            <p className="mt-2 text-sm leading-7 text-emerald-950/75">
              Mensagem pastoral, estudo, editorial ou reflexão do boletim deste dia.
            </p>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/70 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 mb-2">Formatação disponível</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-slate-500 font-mono">
                <span><span className="text-emerald-700"># Título</span> → Título grande</span>
                <span><span className="text-emerald-700">## Subtítulo</span> → Subtítulo</span>
                <span><span className="text-emerald-700">### Menor</span> → Título menor</span>
                <span><span className="text-emerald-700">&gt; Texto</span> → Citação/versículo</span>
                <span><span className="text-emerald-700">**texto**</span> → <strong>Negrito</strong></span>
                <span><span className="text-emerald-700">*texto*</span> → <em>Itálico</em></span>
                <span><span className="text-emerald-700">__texto__</span> → <u>Sublinhado</u></span>
                <span className="text-slate-400">Linha em branco = parágrafo</span>
              </div>
            </div>

            <AutoResizeTextarea
              value={palavraPastoral}
              onChange={e => {
                setPalavraPastoral(e.target.value);
                setPalavraPastoralI18n((current) =>
                  updateLocalizedDraftValue(current, locale, e.target.value)
                );
              }}
              placeholder="Escreva aqui a palavra pastoral do boletim..."
              className="mt-4 w-full rounded-[24px] border border-emerald-200 bg-white px-5 py-4 text-[17px] leading-8 text-slate-700 outline-none transition-colors focus:border-emerald-400 resize-none placeholder:text-slate-300"
            />
            <input
              value={palavraPastoralAutor}
              onChange={e => setPalavraPastoralAutor(e.target.value)}
              placeholder="Autor da palavra"
              className="mt-4 w-full max-w-xl rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base italic text-slate-600 outline-none transition-colors focus:border-emerald-400"
            />
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Imagem do tema</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Essa imagem também é compartilhada entre todas as liturgias do dia.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <label className="block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Importar do Instagram
                </label>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    placeholder="URL do post do Instagram..."
                    value={instagramUrl}
                    onChange={e => setInstagramUrl(e.target.value)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-purple-400"
                  />
                  <button
                    onClick={importarInstagram}
                    disabled={importando}
                    className="rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {importando ? 'Importando...' : 'Importar imagem'}
                  </button>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImagemChange}
                  className="mt-4 w-full cursor-pointer text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-200 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-300"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Pré-visualização</p>
                {imagemPreview ? (
                  <div className="relative mt-4 group">
                    <img src={imagemPreview} alt="Preview" className="h-72 w-full rounded-2xl object-cover" />
                    <button
                      onClick={() => { setImagemPreview(null); setImagemUpload(null); }}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center text-sm leading-6 text-slate-400">
                    Nenhuma imagem selecionada para este boletim.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Notícias do mês
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Matérias grandes (ex.: jornal Brasil Presbiteriano) que aparecem em <strong>todos</strong> os
                  boletins {mesAnoReferencia ? `de ${String(mesAnoReferencia.mes).padStart(2, '0')}/${mesAnoReferencia.ano}` : 'deste mês'},
                  sem precisar recadastrar a cada culto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNoticiaEditando(null);
                  setShowNoticiaEditor(true);
                }}
                disabled={!mesAnoReferencia}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
              >
                + Nova notícia
              </button>
            </div>

            {loadingNoticias ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Carregando notícias do mês...
              </div>
            ) : noticiasMensais.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm leading-6 text-slate-500">
                Nenhuma notícia recorrente cadastrada para este mês.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {noticiasMensais.map((noticia, index) => (
                  <div key={noticia.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{noticia.titulo}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {noticia.ativo ? 'Ativa' : 'Oculta'}
                          {noticia.imagem_url ? ' · com imagem' : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!noticia.ativo ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            Oculta
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => alternarAtivoNoticiaMensal(noticia)}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                        >
                          {noticia.ativo ? 'Ocultar' : 'Publicar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoticiaEditando(noticia);
                            setShowNoticiaEditor(true);
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === 0) return;
                            moverNoticiaMensal(index, -1);
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white disabled:opacity-40"
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (index === noticiasMensais.length - 1) return;
                            moverNoticiaMensal(index, 1);
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white disabled:opacity-40"
                          disabled={index === noticiasMensais.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirNoticiaMensal(noticia)}
                          className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <EditorNoticiaMensalModal
            aberto={showNoticiaEditor}
            noticiaExistente={noticiaEditando}
            mesReferencia={mesAnoReferencia?.mes ?? null}
            anoReferencia={mesAnoReferencia?.ano ?? null}
            ordemPadrao={noticiasMensais.length}
            onFechar={() => setShowNoticiaEditor(false)}
            onSalvo={async () => {
              setShowNoticiaEditor(false);
              await carregarNoticiasMensais();
            }}
          />

          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h3 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Seções do boletim
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Avisos, pedidos de oração, agenda, informativo e outros blocos compartilhados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEscolherTipo(true)}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
              >
                + Nova seção
              </button>
            </div>

            {secoesReaproveitadasDe ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-950/80">
                As seções do boletim de {formatCultoDateLabel(secoesReaproveitadasDe)} foram carregadas
                automaticamente. Revise, retire o que saiu e acrescente o que entrou antes de salvar.
              </div>
            ) : null}

            {loadingBoletim ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Carregando seções do boletim...
              </div>
            ) : boletimSecoes.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm leading-6 text-slate-500">
                Nenhuma seção adicional cadastrada para este boletim.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {boletimSecoes.map((secao, index) => {
                  const config = getBoletimTipoConfig(secao.tipo);

                  return (
                    <div key={secao.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                            {config.emoji}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{secao.titulo || config.titulo}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {secao.itens.length} item(ns)
                              {secao.visivel ? ' publicado(s)' : ' em rascunho'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {!secao.visivel ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                              Oculto
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setBoletimSecoes(
                                normalizarSecoesBoletim(
                                  boletimSecoes.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, visivel: !item.visivel } : item
                                  )
                                )
                              )
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            {secao.visivel ? 'Ocultar' : 'Publicar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSecaoEditandoIndex(index)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index === 0) return;
                              const atualizadas = [...boletimSecoes];
                              [atualizadas[index - 1], atualizadas[index]] = [atualizadas[index], atualizadas[index - 1]];
                              setBoletimSecoes(normalizarSecoesBoletim(atualizadas));
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index === boletimSecoes.length - 1) return;
                              const atualizadas = [...boletimSecoes];
                              [atualizadas[index], atualizadas[index + 1]] = [atualizadas[index + 1], atualizadas[index]];
                              setBoletimSecoes(normalizarSecoesBoletim(atualizadas));
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBoletimSecoes(normalizarSecoesBoletim(boletimSecoes.filter((_, itemIndex) => itemIndex !== index)))
                            }
                            className="rounded-xl border border-red-100 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={footerClassName}>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvarBoletim}
            disabled={salvando}
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {salvando ? 'Salvando boletim...' : 'Salvar boletim do dia'}
          </button>
        </div>
      </div>

      <EscolherTipoSecaoModal
        aberto={showEscolherTipo}
        onFechar={() => setShowEscolherTipo(false)}
        onEscolher={(tipo) => {
          setShowEscolherTipo(false);
          setTipoNovaSecao(tipo);
        }}
      />

      <EditorSecaoBoletimModal
        aberto={Boolean(tipoNovaSecao || secaoEditando)}
        tipo={tipoNovaSecao || secaoEditando?.tipo || null}
        secaoExistente={tipoNovaSecao ? null : secaoEditando}
        onFechar={() => {
          setTipoNovaSecao(null);
          setSecaoEditandoIndex(null);
        }}
        onSalvar={(secao) => {
          if (secaoEditandoIndex !== null) {
            setBoletimSecoes(
              normalizarSecoesBoletim(
                boletimSecoes.map((item, index) => (index === secaoEditandoIndex ? { ...secao, ordem: item.ordem } : item))
              )
            );
          } else {
            setBoletimSecoes(normalizarSecoesBoletim([...boletimSecoes, secao]));
          }

          setTipoNovaSecao(null);
          setSecaoEditandoIndex(null);
        }}
      />
    </div>
  );
}
