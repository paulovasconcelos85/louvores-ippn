'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/provider';
import { createEmptyLocalizedTextMap, normalizeLocalizedTextMap, resolveLocalizedText, type LocalizedTextMapForm } from '@/lib/church-i18n';
import type { BoletimItemRascunho, AgendaItemRascunho, AvisoItemRascunho, InformativoItemRascunho, BoletimSecaoRascunho } from '../_lib/tipos';
import { createDraftId } from '../_lib/liturgia';
import { getBoletimTipoConfig, createEmptyBoletimItem, createEmptyAgendaItem, createEmptyAvisoItem, createEmptyInformativoItem, updateLocalizedDraftValue, replicateLocalizedDraftValue, parseAgendaConteudo, serializeAgendaConteudo, parseAvisoConteudo, serializeAvisoConteudo, parseInformativoConteudo, serializeInformativoConteudo } from '../_lib/boletim';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export function EditorSecaoBoletimModal({
  aberto,
  tipo,
  secaoExistente,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  tipo: string | null;
  secaoExistente: BoletimSecaoRascunho | null;
  onFechar: () => void;
  onSalvar: (secao: BoletimSecaoRascunho) => void;
}) {
  const locale = useLocale();
  const [titulo, setTitulo] = useState('');
  const [tituloI18n, setTituloI18n] = useState<LocalizedTextMapForm>(createEmptyLocalizedTextMap());
  const [visivel, setVisivel] = useState(true);
  const [itens, setItens] = useState<BoletimItemRascunho[]>([]);
  const [agendaItens, setAgendaItens] = useState<AgendaItemRascunho[]>([]);
  const [avisoItens, setAvisoItens] = useState<AvisoItemRascunho[]>([]);
  const [informativoItens, setInformativoItens] = useState<InformativoItemRascunho[]>([]);

  useEffect(() => {
    if (!aberto || !tipo) return;

    const config = getBoletimTipoConfig(tipo);
    const itensExistentes = [...(secaoExistente?.itens || [])];

    const tituloAtualI18n = normalizeLocalizedTextMap(secaoExistente?.titulo_i18n, secaoExistente?.titulo || config.titulo);
    setTitulo(resolveLocalizedText(tituloAtualI18n, locale, secaoExistente?.titulo || config.titulo));
    setTituloI18n(tituloAtualI18n);
    setVisivel(secaoExistente?.visivel ?? true);

    if (tipo === 'agenda') {
      const agenda = itensExistentes.map((item) => {
        const conteudoI18n = normalizeLocalizedTextMap(item.conteudo_i18n, item.conteudo);
        return {
          ...parseAgendaConteudo(resolveLocalizedText(conteudoI18n, locale, item.conteudo)),
          id: item.id || createDraftId('agenda-item'),
          conteudo_i18n: conteudoI18n,
        };
      });
      setAgendaItens([...agenda, createEmptyAgendaItem()]);
      setItens([]);
      setAvisoItens([]);
      setInformativoItens([]);
      return;
    }

    if (tipo === 'avisos') {
      const avisos = itensExistentes.map((item) => {
        const conteudoI18n = normalizeLocalizedTextMap(item.conteudo_i18n, item.conteudo);
        const aviso = parseAvisoConteudo(resolveLocalizedText(conteudoI18n, locale, item.conteudo));
        return {
          ...aviso,
          id: item.id || aviso.id,
          destaque: item.destaque,
          imagem_url: item.imagem_url ?? '',
          conteudo_i18n: conteudoI18n,
        };
      });
      setAvisoItens([...avisos, createEmptyAvisoItem()]);
      setItens([]);
      setAgendaItens([]);
      setInformativoItens([]);
      return;
    }

    if (tipo === 'informativo') {
      const informativos = itensExistentes.map((item) => {
        const conteudoI18n = normalizeLocalizedTextMap(item.conteudo_i18n, item.conteudo);
        const informativo = parseInformativoConteudo(resolveLocalizedText(conteudoI18n, locale, item.conteudo));
        return {
          ...informativo,
          id: item.id || informativo.id,
          destaque: item.destaque,
          imagem_url: item.imagem_url ?? '',
          conteudo_i18n: conteudoI18n,
        };
      });
      setInformativoItens([...informativos, createEmptyInformativoItem()]);
      setItens([]);
      setAgendaItens([]);
      setAvisoItens([]);
      return;
    }

    setItens([
      ...itensExistentes.map((item) => ({
        id: item.id || createDraftId('boletim-item'),
        conteudo: resolveLocalizedText(item.conteudo_i18n, locale, item.conteudo),
        conteudo_i18n: normalizeLocalizedTextMap(item.conteudo_i18n, item.conteudo),
        destaque: item.destaque,
      })),
      createEmptyBoletimItem(),
    ]);
    setAgendaItens([]);
    setAvisoItens([]);
    setInformativoItens([]);
  }, [aberto, tipo, secaoExistente, locale]);

  if (!aberto || !tipo) return null;

  const config = getBoletimTipoConfig(tipo);
  const isAgenda = tipo === 'agenda';
  const isAvisos = tipo === 'avisos';
  const isInformativo = tipo === 'informativo';

  const garantirCampoTextoExtra = (lista: BoletimItemRascunho[]) => {
    const preenchidos = lista.filter((item) => item.conteudo.trim().length > 0);
    const ultimo = lista[lista.length - 1];
    const vazioFinal = ultimo && ultimo.conteudo.trim().length === 0 ? ultimo : createEmptyBoletimItem();
    return [...preenchidos, vazioFinal];
  };

  const garantirCampoAgendaExtra = (lista: AgendaItemRascunho[]) => {
    const preenchidos = lista.filter((item) => item.descricao.trim().length > 0);
    const ultimo = lista[lista.length - 1];
    const vazioFinal = ultimo && ultimo.descricao.trim().length === 0 ? ultimo : createEmptyAgendaItem();
    return [...preenchidos, vazioFinal];
  };

  const garantirCampoAvisoExtra = (lista: AvisoItemRascunho[]) => {
    const preenchidos = lista.filter(
      (item) => item.titulo.trim().length > 0 || item.corpo.trim().length > 0
    );
    const ultimo = lista[lista.length - 1];
    const vazioFinal =
      ultimo && ultimo.titulo.trim().length === 0 && ultimo.corpo.trim().length === 0
        ? ultimo
        : createEmptyAvisoItem();
    return [...preenchidos, vazioFinal];
  };

  const garantirCampoInformativoExtra = (lista: InformativoItemRascunho[]) => {
    const preenchidos = lista.filter(
      (item) => item.titulo.trim().length > 0 || item.corpo.trim().length > 0
    );
    const ultimo = lista[lista.length - 1];
    const vazioFinal =
      ultimo && ultimo.titulo.trim().length === 0 && ultimo.corpo.trim().length === 0
        ? ultimo
        : createEmptyInformativoItem();
    return [...preenchidos, vazioFinal];
  };

  const salvarSecao = () => {
    const tituloLocalized = updateLocalizedDraftValue(
      tituloI18n,
      locale,
      titulo.trim() || config.titulo
    );
    const base: BoletimSecaoRascunho = {
      id: secaoExistente?.id || createDraftId('secao-boletim'),
      tipo,
      titulo: tituloLocalized.pt || titulo.trim() || config.titulo,
      titulo_i18n: tituloLocalized,
      icone: config.icone,
      visivel,
      ordem: secaoExistente?.ordem || 0,
      itens: isAgenda
        ? agendaItens
            .filter((item) => item.descricao.trim().length > 0)
            .map((item) => {
              const conteudo = serializeAgendaConteudo(item);
              const conteudoI18n = replicateLocalizedDraftValue(conteudo);
              return {
                id: item.id,
                conteudo: conteudoI18n.pt || conteudo,
                conteudo_i18n: conteudoI18n,
                destaque: false,
              };
            })
        : isAvisos
          ? avisoItens
              .filter((item) => item.titulo.trim().length > 0 && item.corpo.trim().length > 0)
              .map((item) => {
                const conteudo = serializeAvisoConteudo(item);
                const conteudoI18n = replicateLocalizedDraftValue(conteudo);
                return {
                  id: item.id,
                  conteudo: conteudoI18n.pt || conteudo,
                  conteudo_i18n: conteudoI18n,
                  destaque: item.destaque,
                  imagem_url: item.imagem_url.trim() || null,
                };
              })
        : isInformativo
          ? informativoItens
              .filter((item) => item.titulo.trim().length > 0 && item.corpo.trim().length > 0)
              .map((item) => {
                const conteudo = serializeInformativoConteudo(item);
                const conteudoI18n = replicateLocalizedDraftValue(conteudo);
                return {
                  id: item.id,
                  conteudo: conteudoI18n.pt || conteudo,
                  conteudo_i18n: conteudoI18n,
                  destaque: item.destaque,
                  imagem_url: item.imagem_url.trim() || null,
                };
              })
        : itens
            .filter((item) => item.conteudo.trim().length > 0)
            .map((item) => {
              const conteudo = item.conteudo.trim();
              const conteudoI18n = replicateLocalizedDraftValue(conteudo);
              return {
                id: item.id,
                conteudo: conteudoI18n.pt || conteudo,
                conteudo_i18n: conteudoI18n,
                destaque: item.destaque,
              };
            }),
    };

    onSalvar(base);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">Boletim</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {secaoExistente ? `Editar ${config.titulo}` : `Nova ${config.titulo}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <label className="block text-xs font-black uppercase tracking-[0.22em] text-slate-400">Título</label>
            <p className="mt-2 text-sm text-slate-500">
              Editando o título público em {locale.toUpperCase()}.
            </p>
            <input
              value={titulo}
              onChange={(event) => {
                setTitulo(event.target.value);
                setTituloI18n((current) =>
                  updateLocalizedDraftValue(current, locale, event.target.value)
                );
              }}
              placeholder={config.titulo}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none transition-colors focus:border-emerald-400"
            />
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={visivel}
                onChange={(event) => setVisivel(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
              />
              Visível no boletim público
            </label>
          </div>

          {isAgenda ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Eventos</p>
                <p className="mt-2 text-sm text-slate-500">
                  Novos eventos aparecem automaticamente conforme você preenche.
                </p>
              </div>

              <div className="space-y-4">
                {agendaItens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                      <label className="block text-sm font-semibold text-slate-700">
                        Data
                        <input
                          type="date"
                          value={item.data}
                          onChange={(event) => {
                            const atualizados = agendaItens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, data: event.target.value } : entry
                            );
                            setAgendaItens(atualizados);
                          }}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                        />
                      </label>

                      <div className="space-y-3">
                        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={item.temHora}
                            onChange={(event) => {
                              const atualizados = agendaItens.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, temHora: event.target.checked } : entry
                              );
                              setAgendaItens(atualizados);
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                          />
                          Tem horário
                        </label>

                        {item.temHora ? (
                          <input
                            type="time"
                            value={item.hora}
                            onChange={(event) => {
                              const atualizados = agendaItens.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, hora: event.target.value } : entry
                              );
                              setAgendaItens(atualizados);
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                          />
                        ) : null}
                      </div>
                    </div>

                    <textarea
                      value={item.descricao}
                      onChange={(event) => {
                        const atualizados = agendaItens.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, descricao: event.target.value } : entry
                        );
                        setAgendaItens(garantirCampoAgendaExtra(atualizados));
                      }}
                      rows={3}
                      placeholder="Descrição do evento..."
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                    />

                    {(item.descricao.trim() || agendaItens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setAgendaItens(garantirCampoAgendaExtra(agendaItens.filter((entry) => entry.id !== item.id)))}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover evento
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : isAvisos ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Avisos</p>
                <p className="mt-2 text-sm text-slate-500">
                  Cada aviso precisa de um título e um corpo de texto. O boletim só publica avisos completos.
                </p>
              </div>

              <div className="space-y-4">
                {avisoItens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Título do aviso
                      <input
                        value={item.titulo}
                        onChange={(event) => {
                          const atualizados = avisoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, titulo: event.target.value } : entry
                          );
                          setAvisoItens(garantirCampoAvisoExtra(atualizados));
                        }}
                        placeholder="Ex.: Reunião de membros"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Corpo do aviso
                      <AutoResizeTextarea
                        value={item.corpo}
                        onChange={(event) => {
                          const atualizados = avisoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, corpo: event.target.value } : entry
                          );
                          setAvisoItens(garantirCampoAvisoExtra(atualizados));
                        }}
                        placeholder="Descreva aqui o aviso completo..."
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Imagem do aviso (opcional)
                      <input
                        type="url"
                        value={item.imagem_url}
                        onChange={(event) => {
                          const atualizados = avisoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, imagem_url: event.target.value } : entry
                          );
                          setAvisoItens(garantirCampoAvisoExtra(atualizados));
                        }}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    {item.imagem_url.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imagem_url.trim()}
                        alt={item.titulo.trim() || 'Pré-visualização do aviso'}
                        className="mt-3 max-h-48 w-full rounded-xl border border-slate-200 object-contain"
                      />
                    ) : null}

                    {(item.titulo.trim() && item.corpo.trim()) ? (
                      <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.destaque}
                          onChange={(event) => {
                            const atualizados = avisoItens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, destaque: event.target.checked } : entry
                            );
                            setAvisoItens(atualizados);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        />
                        Destacar este aviso
                      </label>
                    ) : null}

                    {(item.titulo.trim() || item.corpo.trim() || avisoItens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setAvisoItens(
                              garantirCampoAvisoExtra(avisoItens.filter((entry) => entry.id !== item.id))
                            )
                          }
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover aviso
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : isInformativo ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Informativo</p>
                <p className="mt-2 text-sm text-slate-500">
                  Cada item vira um bloco recolhível (dropdown) no boletim público. Título e corpo são obrigatórios; a imagem é opcional.
                </p>
              </div>

              <div className="space-y-4">
                {informativoItens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block text-sm font-semibold text-slate-700">
                      Título do informativo
                      <input
                        value={item.titulo}
                        onChange={(event) => {
                          const atualizados = informativoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, titulo: event.target.value } : entry
                          );
                          setInformativoItens(garantirCampoInformativoExtra(atualizados));
                        }}
                        placeholder="Ex.: Congresso Nacional de Jovens"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Corpo do informativo
                      <AutoResizeTextarea
                        value={item.corpo}
                        onChange={(event) => {
                          const atualizados = informativoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, corpo: event.target.value } : entry
                          );
                          setInformativoItens(garantirCampoInformativoExtra(atualizados));
                        }}
                        placeholder="Descreva aqui o informativo completo..."
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    <label className="mt-3 block text-sm font-semibold text-slate-700">
                      Imagem do informativo (opcional)
                      <input
                        type="url"
                        value={item.imagem_url}
                        onChange={(event) => {
                          const atualizados = informativoItens.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, imagem_url: event.target.value } : entry
                          );
                          setInformativoItens(garantirCampoInformativoExtra(atualizados));
                        }}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
                      />
                    </label>

                    {item.imagem_url.trim() ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imagem_url.trim()}
                        alt={item.titulo.trim() || 'Pré-visualização do informativo'}
                        className="mt-3 max-h-48 w-full rounded-xl border border-slate-200 object-contain"
                      />
                    ) : null}

                    {(item.titulo.trim() && item.corpo.trim()) ? (
                      <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.destaque}
                          onChange={(event) => {
                            const atualizados = informativoItens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, destaque: event.target.checked } : entry
                            );
                            setInformativoItens(atualizados);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        />
                        Destacar este informativo
                      </label>
                    ) : null}

                    {(item.titulo.trim() || item.corpo.trim() || informativoItens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setInformativoItens(
                              garantirCampoInformativoExtra(informativoItens.filter((entry) => entry.id !== item.id))
                            )
                          }
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover informativo
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Conteúdo</p>
                <p className="mt-2 text-sm text-slate-500">
                  Novos campos aparecem automaticamente conforme você digita.
                </p>
              </div>

              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">Formatação disponível</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-slate-500 font-mono">
                  <span><span className="text-slate-700">**texto**</span> → <strong>Negrito</strong></span>
                  <span><span className="text-slate-700">*texto*</span> → <em>Itálico</em></span>
                  <span><span className="text-slate-700">__texto__</span> → <u>Sublinhado</u></span>
                </div>
              </div>

              <div className="space-y-4">
                {itens.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <textarea
                      value={item.conteudo}
                      onChange={(event) => {
                        const atualizados = itens.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                conteudo: event.target.value,
                                conteudo_i18n: replicateLocalizedDraftValue(event.target.value),
                              }
                            : entry
                        );
                        setItens(garantirCampoTextoExtra(atualizados));
                      }}
                      rows={3}
                      placeholder="Digite aqui..."
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
                    />

                    {item.conteudo.trim() ? (
                      <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.destaque}
                          onChange={(event) => {
                            const atualizados = itens.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, destaque: event.target.checked } : entry
                            );
                            setItens(atualizados);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        />
                        Destaque
                      </label>
                    ) : null}

                    {(item.conteudo.trim() || itens.length > 1) ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setItens(garantirCampoTextoExtra(itens.filter((entry) => entry.id !== item.id)))}
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          Remover item
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <p className="max-w-md text-sm leading-6 text-slate-500">
            Aplicar seção guarda as mudanças neste editor. Para publicar no boletim e aparecer na home, ainda é preciso clicar em <strong>Salvar Liturgia</strong>.
          </p>
          <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvarSecao}
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
          >
            Aplicar seção
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
