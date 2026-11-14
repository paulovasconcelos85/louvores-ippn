'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy, MapPin, Mail, Phone, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocale, useTranslations } from '@/i18n/provider';
import { getStoredChurchId } from '@/lib/church-utils';
import { resolveLocalizedText } from '@/lib/church-i18n';
import { buildPixPayload } from '@/lib/pix';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Igreja = Database['public']['Tables']['igrejas']['Row'];
type FormaContribuir = Database['public']['Tables']['igreja_formas_contribuir']['Row'];

export default function MembroIgrejaPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const { user, loading: authLoading } = useAuth();
  const { loading: permLoading, permissoes } = usePermissions();
  const loading = authLoading || permLoading;

  const [igreja, setIgreja] = useState<Igreja | null>(null);
  const [formasContribuir, setFormasContribuir] = useState<FormaContribuir[]>([]);
  const [carregandoIgreja, setCarregandoIgreja] = useState(true);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && !permissoes.ehMembroComum) {
      router.push(permissoes.podeAcessarAdmin ? '/admin' : '/');
    }
  }, [user, loading, permissoes.ehMembroComum, permissoes.podeAcessarAdmin, router]);

  useEffect(() => {
    const igrejaId = getStoredChurchId();
    if (!igrejaId) {
      setCarregandoIgreja(false);
      return;
    }

    let ativo = true;

    (async () => {
      const [{ data: igrejaData }, { data: formasData }] = await Promise.all([
        supabase.from('igrejas').select('*').eq('id', igrejaId).maybeSingle(),
        supabase
          .from('igreja_formas_contribuir')
          .select('*')
          .eq('igreja_id', igrejaId)
          .eq('ativo', true)
          .order('ordem', { ascending: true }),
      ]);

      if (ativo) {
        setIgreja(igrejaData);
        setFormasContribuir(formasData || []);
        setCarregandoIgreja(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  if (loading || !permissoes.ehMembroComum) return null;

  const endereco =
    igreja?.endereco_completo ||
    [igreja?.logradouro, igreja?.complemento, igreja?.bairro, igreja?.cidade, igreja?.uf]
      .filter(Boolean)
      .join(', ');

  const sobreTitulo = igreja ? resolveLocalizedText(igreja.apresentacao_titulo_i18n, locale, igreja.apresentacao_titulo) : '';
  const sobreTexto = igreja ? resolveLocalizedText(igreja.apresentacao_texto_i18n, locale, igreja.apresentacao_texto) : '';

  const copiar = async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      window.setTimeout(() => setCopiadoId((atual) => (atual === id ? null : atual)), 2500);
    } catch {
      setCopiadoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => router.push('/membro')}
            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('memberArea.back')}
          </button>
          <h1 className="ml-2 text-lg font-bold text-slate-900">{t('memberArea.churchInfo')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {carregandoIgreja ? (
          <p className="text-slate-500">...</p>
        ) : !igreja ? (
          <p className="text-slate-500">{t('header.loadChurchesError')}</p>
        ) : (
          <>
            <section className="space-y-3 rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">{igreja.nome_completo || igreja.nome}</h2>

              {endereco && (
                <p className="flex items-start gap-2 text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  {endereco}
                </p>
              )}
              {igreja.telefone && (
                <p className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  {igreja.telefone}
                </p>
              )}
              {igreja.email && (
                <p className="flex items-center gap-2 text-slate-700">
                  <Mail className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  {igreja.email}
                </p>
              )}
              {igreja.site && (
                <p className="flex items-center gap-2 text-slate-700">
                  <Globe className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  <a href={igreja.site} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                    {igreja.site}
                  </a>
                </p>
              )}
            </section>

            {sobreTexto && (
              <section className="space-y-2 rounded-xl border bg-white p-6 shadow-sm">
                {sobreTitulo && <h3 className="font-bold text-slate-900">{sobreTitulo}</h3>}
                <p className="whitespace-pre-line leading-relaxed text-slate-700">{sobreTexto}</p>
              </section>
            )}

            <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-900">{t('memberArea.contributionTitle')}</h3>
              {formasContribuir.length === 0 ? (
                <p className="text-slate-500">{t('memberArea.contributionEmpty')}</p>
              ) : (
                formasContribuir.map((forma) => {
                  const ehPix = forma.tipo === 'pix';
                  const textoParaCopiar = forma.valor;
                  const pixPayload = ehPix
                    ? buildPixPayload({
                        chave: forma.valor,
                        beneficiario: forma.beneficiario || igreja.nome,
                        cidade: igreja.cidade,
                      })
                    : '';

                  return (
                    <div
                      key={forma.id}
                      className="flex flex-col items-center gap-4 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start"
                    >
                      {ehPix && (
                        <div className="rounded-lg border bg-white p-3">
                          <QRCodeSVG value={pixPayload} size={160} />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <p className="text-sm text-slate-500">
                          {t(`memberArea.contributionType.${forma.tipo}`)}
                          {forma.label ? ` · ${forma.label}` : ''}
                        </p>
                        <p className="break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
                          {forma.valor}
                        </p>
                        <button
                          onClick={() => copiar(forma.id, ehPix ? pixPayload : textoParaCopiar)}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                        >
                          {copiadoId === forma.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiadoId === forma.id ? t('memberArea.pixCopied') : t('memberArea.pixCopy')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
