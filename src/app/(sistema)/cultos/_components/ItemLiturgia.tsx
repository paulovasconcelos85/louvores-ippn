'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/provider';
import { TIPOS_LITURGICOS_PADRAO, HABILITAR_BOLETIM_SECOES_NEXT, type CanticoNoItem } from '../_lib/tipos';
import { getRepertorioTextos } from '../_lib/canticos';
import { updateLocalizedDraftValue } from '../_lib/boletim';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { PublicCanticoTextarea } from './PublicCanticoTextarea';
import { LinhaCantico } from './LinhaCantico';

// --- ITEM DA LITURGIA (linha) ---
export function ItemLiturgia({ item, index, canticos, onCreate, onUpdate, onRemove, onMove, isLideranca, podVerTom, canEditarMusica }: any) {
  const locale = useLocale();
  const [expandido, setExpandido] = useState(true);
  const tiposDisponiveis = item.tiposLiturgicosDisponiveis || TIPOS_LITURGICOS_PADRAO;
  const tipoInputId = `tipo-liturgico-${index}`;
  const tituloItem = item.tipo?.trim() || `Item ${index + 1}`;
  const textosRepertorio = getRepertorioTextos(canticos);
  const mostrarHorarioInterno = HABILITAR_BOLETIM_SECOES_NEXT && isLideranca;

  const adicionarCantico = () => {
    onUpdate({ ...item, canticos_lista: [...item.canticos_lista, { cantico_id: null, tom: null }] });
  };

  const atualizarCantico = (idx: number, nova: CanticoNoItem) => {
    const lista = [...item.canticos_lista];
    lista[idx] = nova;
    onUpdate({ ...item, canticos_lista: lista });
  };

  const removerCantico = (idx: number) => {
    onUpdate({ ...item, canticos_lista: item.canticos_lista.filter((_: any, i: number) => i !== idx) });
  };

  return (
    <div className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-[0_20px_50px_-30px_rgba(5,150,105,0.35)]">
      {/* Cabeçalho do item */}
      <div className="flex items-start gap-4 border-b border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-5 py-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700 shadow-inner">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
            Momento da liturgia
          </p>
          <h3 className="mt-1 truncate text-lg font-black text-slate-900">{tituloItem}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Edite abaixo o nome desta etapa, o texto que vai aparecer no boletim e as observações internas.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start">
          {isLideranca && (
            <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <button onClick={() => onMove('cima')} className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200">↑</button>
              <button onClick={() => onMove('baixo')} className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200">↓</button>
              <button onClick={onRemove} className="flex h-10 w-10 items-center justify-center rounded-xl text-base text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 active:bg-red-100">🗑</button>
            </div>
          )}

          <button onClick={() => setExpandido(!expandido)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:bg-slate-100">
          {expandido ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="space-y-5 px-5 py-5">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 shadow-sm">
                Comece aqui
              </span>
              <label className="mt-3 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                Nome da etapa
              </label>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Dê o nome deste momento do culto. Você pode digitar livremente ou aproveitar uma sugestão já usada pela igreja.
              </p>
              {isLideranca ? (
                <>
                  <input
                    list={tipoInputId}
                    value={item.tipo}
                    onChange={e => onUpdate({ ...item, tipo: e.target.value })}
                    onBlur={e => onUpdate({ ...item, tipo: e.target.value.trim() || `Item ${index + 1}` })}
                    placeholder="Ex.: Pregação da Palavra"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800 outline-none transition-colors focus:border-emerald-400"
                  />
                  <datalist id={tipoInputId}>
                    {tiposDisponiveis.map((t: string) => <option key={t} value={t} />)}
                  </datalist>
                </>
              ) : (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800">
                  {tituloItem}
                </div>
              )}
            </div>

            {mostrarHorarioInterno && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 shadow-sm">
                  Próxima etapa
                </span>
                <label className="mt-3 block text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Horário interno
                </label>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Esse campo ajuda a equipe a se organizar. Você pode usar formatos como <code>09:30</code> ou <code>9h30-9h40</code>.
                </p>
                <input
                  value={item.horario || ''}
                  onChange={e => onUpdate({ ...item, horario: e.target.value })}
                  placeholder="Ex.: 9h30-9h40"
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition-colors focus:border-emerald-400"
                />
              </div>
            )}
          </div>

          {/* Campo público */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 shadow-sm">
                Texto visível
              </span>
              <label className="mb-2 mt-3 flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase tracking-widest">
                <span>📢</span> Público
              </label>
              <p className="mb-3 text-sm leading-6 text-emerald-900/70">
                <span dangerouslySetInnerHTML={{ __html: textosRepertorio.ajudaPublico }} />
              </p>
            <PublicCanticoTextarea
              value={item.conteudo_publico || ''}
              onChange={(conteudo) =>
                onUpdate({
                  ...item,
                  conteudo_publico: conteudo,
                  conteudo_publico_i18n: updateLocalizedDraftValue(
                    item.conteudo_publico_i18n,
                    locale,
                    conteudo
                  ),
                })
              }
              canticos={canticos}
              disabled={!isLideranca}
              placeholder={textosRepertorio.placeholderPublico}
              className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base text-slate-700 outline-none transition-colors focus:border-emerald-400 resize-none disabled:cursor-default disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:py-0 placeholder:text-slate-300"
            />
          </div>

          {/* Campo interno */}
          {isLideranca && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 shadow-sm">
                Orientação da equipe
              </span>
              <label className="mb-2 mt-3 flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest">
                <span>🔒</span> Interno
              </label>
              <p className="mb-3 text-sm leading-6 text-slate-500">
                Use este espaço para instruções da equipe, lembretes, nomes de pessoas, observações de condução e tudo o que não deve ir para o público.
              </p>
              <AutoResizeTextarea
                value={item.descricao || ''}
                onChange={e => onUpdate({ ...item, descricao: e.target.value })}
                placeholder="Ex.: Quem conduz, qual salmo será lido, orientação para a equipe..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-600 outline-none transition-colors focus:border-slate-400 resize-none placeholder:text-slate-300"
              />
            </div>
          )}

          {/* Cânticos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm">
                Finalize aqui
              </span>
              <label className="mt-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400">
                <span>🎵</span> {textosRepertorio.rotuloPlural}
              </label>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {onCreate
                  ? textosRepertorio.descricaoSecaoComCadastro
                  : textosRepertorio.descricaoSecaoSemCadastro}
              </p>
            </div>
            {item.canticos_lista.map((m: CanticoNoItem, idx: number) => (
              <LinhaCantico
                key={idx}
                musica={m}
                canticos={canticos}
                onChange={(nova: CanticoNoItem) => atualizarCantico(idx, nova)}
                onRemove={() => removerCantico(idx)}
                podVerTom={podVerTom}
                onCreate={onCreate}
                canEditarMusica={canEditarMusica}
              />
            ))}
            {canEditarMusica && (
              <button
                onClick={adicionarCantico}
                className="mt-3 ml-2 text-emerald-600 hover:text-emerald-800 text-base font-bold flex items-center gap-2 hover:bg-emerald-50 px-3 py-2.5 rounded-xl transition-colors active:bg-emerald-100"
              >
                <span>🎵</span> {textosRepertorio.acaoAdicionar}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
