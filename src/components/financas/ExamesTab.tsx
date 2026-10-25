'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Download, Loader2, Lock, RotateCcw, Send, Undo2 } from 'lucide-react';
import { nomeDoPeriodo } from '@/lib/financas';
import type { ResumoFinanceiro } from '@/lib/financas-resumo';
import { botaoPrimario, botaoSecundario, finApi, inputClass, labelClass, type ContextoFinancas } from './api';

type Exame = {
  ano: number;
  periodo: number;
  inicio: string;
  fim: string;
  status: 'aberto' | 'enviado' | 'devolvido' | 'parecer' | 'aprovado';
  parecer: 'favoravel' | 'ressalvas' | 'desfavoravel' | null;
  observacoes: string | null;
  ata_conselho?: string | null;
};

const STATUS: Record<Exame['status'], { nome: string; cor: string }> = {
  aberto: { nome: 'Aberto', cor: 'bg-slate-100 text-slate-700' },
  enviado: { nome: 'Com a comissão', cor: 'bg-blue-100 text-blue-800' },
  devolvido: { nome: 'Devolvido para correção', cor: 'bg-amber-100 text-amber-900' },
  parecer: { nome: 'Parecer emitido', cor: 'bg-violet-100 text-violet-800' },
  aprovado: { nome: 'Aprovado pelo Conselho', cor: 'bg-emerald-100 text-emerald-800' },
};

const PARECERES = {
  favoravel: 'Favorável',
  ressalvas: 'Favorável com ressalvas',
  desfavoravel: 'Desfavorável',
};

export default function ExamesTab({
  igrejaId,
  contexto,
  moeda,
}: {
  igrejaId: string;
  contexto: ContextoFinancas;
  moeda: (centavos: number) => string;
}) {
  const { permissoes } = contexto;
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [exames, setExames] = useState<Exame[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await finApi<{ exames: Exame[] }>(`exames?igreja_id=${encodeURIComponent(igrejaId)}&ano=${ano}`);
      setExames(data.exames);
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [igrejaId, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const agir = async (exame: Exame, acao: string, extra: Record<string, unknown> = {}) => {
    try {
      await finApi('exames', { method: 'POST', json: { igreja_id: igrejaId, ano, periodo: exame.periodo, acao, ...extra } });
      carregar();
      return true;
    } catch (error: any) {
      alert(error.message);
      return false;
    }
  };

  const baixar = async (exame: Exame) => {
    try {
      const data = await finApi<{ resumo: ResumoFinanceiro }>(
        `relatorios?igreja_id=${encodeURIComponent(igrejaId)}&tipo=periodo&inicio=${exame.inicio}&fim=${exame.fim}`
      );
      const { gerarBalancetePdf } = await import('@/lib/financas-pdf');
      gerarBalancetePdf(data.resumo, `${nomeDoPeriodo(exame.periodo)} de ${ano}`, {
        igrejaNome: contexto.igreja?.nome || 'Igreja',
        moeda,
      }).save(`balancete-${ano}-${exame.periodo === 0 ? 'exercicio' : `t${exame.periodo}`}.pdf`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={labelClass}>Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className={inputClass}>
            {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Terminado o trimestre, o tesoureiro <strong>envia o balancete</strong>. A partir daí os lançamentos do período ficam travados.</li>
          <li>A Comissão de Exame de Contas confere livros e comprovantes e <strong>emite o parecer</strong> — ou devolve para correção.</li>
          <li>O Conselho toma conhecimento e <strong>aprova</strong>, registrando a ata.</li>
        </ol>
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

      {carregando ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {exames.map((exame) => (
            <CartaoExame
              key={exame.periodo}
              exame={exame}
              terminou={hoje > exame.fim}
              permissoes={permissoes}
              onBaixar={() => baixar(exame)}
              onAgir={(acao, extra) => agir(exame, acao, extra)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoExame({
  exame,
  terminou,
  permissoes,
  onBaixar,
  onAgir,
}: {
  exame: Exame;
  terminou: boolean;
  permissoes: ContextoFinancas['permissoes'];
  onBaixar: () => void;
  onAgir: (acao: string, extra?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [parecer, setParecer] = useState<keyof typeof PARECERES>('favoravel');
  const [observacoes, setObservacoes] = useState('');
  const [ata, setAta] = useState('');
  const status = STATUS[exame.status];
  const travado = ['enviado', 'parecer', 'aprovado'].includes(exame.status);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{nomeDoPeriodo(exame.periodo)}</h3>
          <p className="text-xs text-slate-500">
            {exame.inicio.split('-').reverse().join('/')} a {exame.fim.split('-').reverse().join('/')}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${status.cor}`}>
          {travado && <Lock className="h-3 w-3" />}
          {status.nome}
        </span>
      </div>

      {exame.parecer && (
        <p className="mt-3 text-sm text-slate-700">
          Parecer: <strong>{PARECERES[exame.parecer]}</strong>
        </p>
      )}
      {exame.observacoes && <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{exame.observacoes}</p>}
      {exame.ata_conselho && <p className="mt-2 text-xs text-slate-500">Ata do Conselho: {exame.ata_conselho}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onBaixar} className={botaoSecundario}>
          <Download className="h-4 w-4" />
          Balancete
        </button>

        {permissoes.podeLancar && (exame.status === 'aberto' || exame.status === 'devolvido') && (
          terminou ? (
            <button
              type="button"
              onClick={() => confirm('Enviar o balancete? Os lançamentos do período ficam travados.') && onAgir('enviar')}
              className={botaoPrimario}
            >
              <Send className="h-4 w-4" />
              Enviar à comissão
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" /> Envio liberado depois do último dia
            </span>
          )
        )}

        {permissoes.podeAprovar && exame.status === 'parecer' && (
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <input value={ata} onChange={(e) => setAta(e.target.value)} placeholder="Ata do Conselho (ex.: Ata nº 245, 12/04)" className={inputClass} />
            <button type="button" onClick={() => onAgir('aprovar', { ata })} className={botaoPrimario}>
              <CheckCircle2 className="h-4 w-4" />
              Aprovar
            </button>
          </div>
        )}

        {permissoes.podeAprovar && (exame.status === 'parecer' || exame.status === 'aprovado') && (
          <button
            type="button"
            onClick={() => {
              const motivo = prompt('Motivo para reabrir o período:');
              if (motivo) onAgir('reabrir', { observacoes: motivo });
            }}
            className={botaoSecundario}
          >
            <RotateCcw className="h-4 w-4" />
            Reabrir
          </button>
        )}
      </div>

      {permissoes.podeExaminar && exame.status === 'enviado' && (
        <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <p className="text-sm font-semibold text-slate-900">Parecer da Comissão de Exame de Contas</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(PARECERES) as Array<keyof typeof PARECERES>).map((valor) => (
              <label
                key={valor}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${parecer === valor ? 'border-emerald-400 bg-white font-semibold' : 'border-slate-200 bg-white/60'}`}
              >
                <input type="radio" className="sr-only" checked={parecer === valor} onChange={() => setParecer(valor)} />
                {PARECERES[valor]}
              </label>
            ))}
          </div>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Observações (obrigatório quando houver ressalvas)"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={async () => (await onAgir('parecer', { parecer, observacoes })) && setObservacoes('')} className={botaoPrimario}>
              Emitir parecer
            </button>
            <button type="button" onClick={async () => (await onAgir('devolver', { observacoes })) && setObservacoes('')} className={botaoSecundario}>
              <Undo2 className="h-4 w-4" />
              Devolver para correção
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
