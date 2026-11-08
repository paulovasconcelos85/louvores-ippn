'use client';

import { getCultoTituloExibicao, formatCultoDateLabel } from '../_lib/liturgia';

// --- CARD DE CULTO NA LISTAGEM ---
export function CultoCard({
  culto,
  tituloExibicao,
  descricaoExibicao,
  onEditar,
  onWhatsApp,
  onPDF,
  onExcluir,
  podeEditar,
  podeExcluir,
  excluindo,
  esconderResumoBoletim,
}: any) {
  const dataFormatada = formatCultoDateLabel(culto.Dia);
  const titulo = getCultoTituloExibicao(culto, tituloExibicao || dataFormatada);

  return (
    <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {culto.imagem_url ? (
            <img src={culto.imagem_url} alt="" className="h-20 w-20 rounded-2xl object-cover shadow-sm flex-shrink-0" />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400 shadow-sm">
              L
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Liturgia do dia</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">
              {titulo}
            </h3>
            {descricaoExibicao ? (
              <p className="mt-2 text-sm leading-6 text-slate-500">{descricaoExibicao}</p>
            ) : null}
            {!esconderResumoBoletim && culto.palavra_pastoral ? (
              <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                Palavra pastoral disponível
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:max-w-[360px] lg:justify-end">
          {podeEditar ? (
            <button
              onClick={() => onEditar(culto)}
              className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
              title="Editar liturgia"
            >
              Editar liturgia
            </button>
          ) : null}
          <button onClick={() => onWhatsApp(culto)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 active:bg-emerald-200" title="WhatsApp">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.559 4.189 1.619 6.011L0 24l6.117-1.605a11.847 11.847 0 005.925 1.586h.005c6.635 0 12.032-5.396 12.035-12.032a11.76 11.76 0 00-3.528-8.485" />
            </svg>
          </button>
          <button onClick={() => onPDF(culto)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200" title="PDF">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          {podeExcluir && (
            <button
              onClick={() => onExcluir(culto)}
              disabled={excluindo}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-lg text-red-600 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50"
              title="Excluir"
            >
              {excluindo ? '⏳' : '🗑️'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
