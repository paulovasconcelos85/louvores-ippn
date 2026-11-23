'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/i18n/provider';
import { porIdioma } from '@/i18n/por-idioma';
import { getStoredChurchId } from '@/lib/church-utils';
import type { NoticiaMensal } from '../_lib/tipos';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { CampoImagem } from '@/components/CampoImagem';

export function EditorNoticiaMensalModal({
  aberto,
  noticiaExistente,
  mesReferencia,
  anoReferencia,
  ordemPadrao,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  noticiaExistente: NoticiaMensal | null;
  mesReferencia: number | null;
  anoReferencia: number | null;
  ordemPadrao: number;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const locale = useLocale();
  const tr = (pt: string, es: string, en: string) => porIdioma(locale, pt, es, en);
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [imagemUrl, setImagemUrl] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(noticiaExistente?.titulo || '');
    setCorpo(noticiaExistente?.corpo || '');
    setImagemUrl(noticiaExistente?.imagem_url || '');
    setAtivo(noticiaExistente?.ativo ?? true);
  }, [aberto, noticiaExistente]);

  if (!aberto || !mesReferencia || !anoReferencia) return null;

  const salvar = async () => {
    const igrejaId = getStoredChurchId();
    if (!igrejaId) {
      alert(tr('Selecione uma igreja antes de cadastrar a notícia.', 'Selecciona una iglesia antes de registrar la noticia.', 'Select a church before adding the news item.'));
      return;
    }

    if (!titulo.trim() || !corpo.trim()) {
      alert(tr('Preencha título e corpo da notícia.', 'Completa el título y el texto de la noticia.', 'Fill in the title and body of the news item.'));
      return;
    }

    setSalvando(true);
    try {
      if (noticiaExistente) {
        const { error } = await supabase
          .from('noticias_mensais')
          .update({
            titulo: titulo.trim(),
            corpo: corpo.trim(),
            imagem_url: imagemUrl.trim() || null,
            ativo,
          })
          .eq('id', noticiaExistente.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('noticias_mensais').insert({
          igreja_id: igrejaId,
          titulo: titulo.trim(),
          corpo: corpo.trim(),
          imagem_url: imagemUrl.trim() || null,
          mes_referencia: mesReferencia,
          ano_referencia: anoReferencia,
          ordem: ordemPadrao,
          ativo,
        });

        if (error) throw error;
      }

      onSalvo();
    } catch (error) {
      console.error('Erro ao salvar notícia do mês:', error);
      alert(tr('❌ Erro ao salvar notícia.', '❌ Error al guardar la noticia.', '❌ Could not save the news item.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
              {tr('Notícias do mês ·', 'Noticias del mes ·', 'News of the month ·')} {String(mesReferencia).padStart(2, '0')}/{anoReferencia}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-900">
              {noticiaExistente ? tr('Editar notícia', 'Editar noticia', 'Edit news item') : tr('Nova notícia', 'Nueva noticia', 'New news item')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {tr('Cancelar', 'Cancelar', 'Cancel')}
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          <label className="block text-sm font-semibold text-slate-700">
            {tr('Título da notícia', 'Título de la noticia', 'News title')}
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder={tr('Ex.: Congresso Nacional de Jovens Presbiterianos', 'Ej.: Congreso Nacional de Jóvenes Presbiterianos', 'E.g. National Presbyterian Youth Conference')}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition-colors focus:border-emerald-400"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            {tr('Corpo da notícia', 'Texto de la noticia', 'News text')}
            <AutoResizeTextarea
              value={corpo}
              onChange={(event) => setCorpo(event.target.value)}
              placeholder={tr('Cole aqui a matéria completa...', 'Pega aquí el artículo completo...', 'Paste the full article here...')}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-emerald-400"
            />
          </label>

          <CampoImagem bucket="boletim-imagens"
            rotulo={tr('Imagem da notícia (opcional)', 'Imagen de la noticia (opcional)', 'News image (optional)')}
            valor={imagemUrl}
            textoAlternativo={titulo.trim() || tr('Pré-visualização da notícia', 'Vista previa de la noticia', 'News preview')}
            onChange={setImagemUrl}
          />

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
            />
            {tr('Publicar nos boletins deste mês', 'Publicar en los boletines de este mes', 'Publish in this month\'s bulletins')}
          </label>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {tr('Cancelar', 'Cancelar', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : tr('Salvar notícia', 'Guardar noticia', 'Save news item')}
          </button>
        </div>
      </div>
    </div>
  );
}
