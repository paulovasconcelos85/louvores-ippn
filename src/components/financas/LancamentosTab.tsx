'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  FORMAS_PAGAMENTO,
  TIPOS_DOCUMENTO,
  centavos,
  lerValorDigitado,
  type FinLancamento,
  type TipoLancamento,
} from '@/lib/financas';
import CampoValor from './CampoValor';
import PessoaPicker from './PessoaPicker';
import { botaoPrimario, botaoSecundario, finApi, inputClass, labelClass, type ContextoFinancas } from './api';

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fimDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(ano, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

type Rascunho = {
  id?: string;
  tipo: TipoLancamento;
  data: string;
  valorTexto: string;
  conta_id: string;
  conta_destino_id: string;
  categoria_id: string;
  pessoa: { id: string; nome: string } | null;
  descricao: string;
  forma_pagamento: string;
  documento_tipo: string;
  documento_numero: string;
  comprovante_path: string;
};

export default function LancamentosTab({
  igrejaId,
  contexto,
  moeda,
}: {
  igrejaId: string;
  contexto: ContextoFinancas;
  moeda: (centavos: number) => string;
}) {
  const { permissoes, contas, categorias } = contexto;
  const [mes, setMes] = useState(hojeIso().slice(0, 7));
  const [filtroConta, setFiltroConta] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [lancamentos, setLancamentos] = useState<FinLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  // Muda a cada "salvar e lançar outro" para remontar o formulário com o foco no valor.
  const [chaveFormulario, setChaveFormulario] = useState(0);

  const contasAtivas = contas.filter((c) => c.ativo);
  const nomeConta = useMemo(() => new Map(contas.map((c) => [c.id, c.nome])), [contas]);
  const categoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const params = new URLSearchParams({ igreja_id: igrejaId, inicio: `${mes}-01`, fim: fimDoMes(mes) });
      if (filtroConta) params.set('conta_id', filtroConta);
      if (filtroCategoria) params.set('categoria_id', filtroCategoria);
      const data = await finApi<{ lancamentos: FinLancamento[] }>(`lancamentos?${params.toString()}`);
      setLancamentos(data.lancamentos);
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }, [igrejaId, mes, filtroConta, filtroCategoria]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totais = useMemo(() => {
    let receitas = 0;
    let despesas = 0;
    for (const item of lancamentos) {
      if (item.tipo === 'receita') receitas += centavos(item.valor);
      if (item.tipo === 'despesa') despesas += centavos(item.valor);
    }
    return { receitas, despesas };
  }, [lancamentos]);

  const novoRascunho = (tipo: TipoLancamento = 'receita', base?: Partial<Rascunho>): Rascunho => ({
    tipo,
    data: base?.data || hojeIso(),
    valorTexto: '',
    conta_id: base?.conta_id || contasAtivas[0]?.id || '',
    conta_destino_id: '',
    categoria_id: base?.categoria_id || '',
    pessoa: null,
    descricao: '',
    forma_pagamento: base?.forma_pagamento || '',
    documento_tipo: '',
    documento_numero: '',
    comprovante_path: '',
  });

  const editar = (item: FinLancamento) =>
    setRascunho({
      id: item.id,
      tipo: item.tipo,
      data: item.data,
      valorTexto: String(item.valor.toFixed(2)).replace('.', ','),
      conta_id: item.conta_id,
      conta_destino_id: item.conta_destino_id || '',
      categoria_id: item.categoria_id || '',
      pessoa: item.pessoa_id && item.pessoa_nome ? { id: item.pessoa_id, nome: item.pessoa_nome } : null,
      descricao: item.descricao || '',
      forma_pagamento: item.forma_pagamento || '',
      documento_tipo: item.documento_tipo || '',
      documento_numero: item.documento_numero || '',
      comprovante_path: item.comprovante_path || '',
    });

  const excluir = async (item: FinLancamento) => {
    if (!confirm('Excluir este lançamento?')) return;
    try {
      await finApi(`lancamentos/${item.id}?igreja_id=${encodeURIComponent(igrejaId)}`, { method: 'DELETE' });
      carregar();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const abrirComprovante = async (caminho: string) => {
    try {
      const data = await finApi<{ url: string }>(
        `comprovantes?igreja_id=${encodeURIComponent(igrejaId)}&path=${encodeURIComponent(caminho)}`
      );
      window.open(data.url, '_blank', 'noopener');
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (contasAtivas.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">Antes do primeiro lançamento, cadastre as contas da igreja.</p>
        <p className="mt-1">
          Em <strong>Configurações</strong>, crie o caixa (dinheiro das ofertas) e cada conta bancária, com o saldo do dia em que vocês
          começarem a usar o sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={labelClass}>Mês</span>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className={inputClass} />
        </label>
        <label className="block min-w-40">
          <span className={labelClass}>Conta</span>
          <select value={filtroConta} onChange={(e) => setFiltroConta(e.target.value)} className={inputClass}>
            <option value="">Todas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-48">
          <span className={labelClass}>Categoria</span>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className={inputClass}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tipo === 'receita' ? '↓ ' : '↑ '}
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        {permissoes.podeLancar && (
          <button type="button" onClick={() => setRascunho(novoRascunho())} className={`${botaoPrimario} ml-auto`}>
            <Plus className="h-4 w-4" />
            Novo lançamento
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao rotulo="Entradas do mês" valor={moeda(totais.receitas)} cor="text-emerald-700" />
        <Cartao rotulo="Saídas do mês" valor={moeda(totais.despesas)} cor="text-rose-700" />
        <Cartao rotulo="Resultado do mês" valor={moeda(totais.receitas - totais.despesas)} cor="text-slate-900" />
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {carregando ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : lancamentos.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Nenhum lançamento neste mês.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lancamentos.map((item) => {
              const categoria = item.categoria_id ? categoriaPorId.get(item.categoria_id) : null;
              const Icone = item.tipo === 'receita' ? ArrowDownLeft : item.tipo === 'despesa' ? ArrowUpRight : ArrowRightLeft;
              const corValor = item.tipo === 'receita' ? 'text-emerald-700' : item.tipo === 'despesa' ? 'text-rose-700' : 'text-slate-600';
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 ${corValor}`}>
                    <Icone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.tipo === 'transferencia'
                        ? `${nomeConta.get(item.conta_id)} → ${nomeConta.get(item.conta_destino_id || '')}`
                        : categoria?.nome}
                      {item.pessoa_nome ? <span className="font-normal text-slate-500"> · {item.pessoa_nome}</span> : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {item.data.split('-').reverse().join('/')}
                      {item.tipo !== 'transferencia' ? ` · ${nomeConta.get(item.conta_id)}` : ''}
                      {item.descricao ? ` · ${item.descricao}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${corValor}`}>
                    {item.tipo === 'despesa' ? '−' : ''}
                    {moeda(centavos(item.valor))}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {item.comprovante_path && (
                      <button type="button" onClick={() => abrirComprovante(item.comprovante_path!)} title="Ver comprovante" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                        <Paperclip className="h-4 w-4" />
                      </button>
                    )}
                    {item.travado ? (
                      <span title="Período enviado à Comissão de Exame de Contas" className="p-2 text-slate-400">
                        <Lock className="h-4 w-4" />
                      </span>
                    ) : (
                      permissoes.podeLancar && (
                        <>
                          <button type="button" onClick={() => editar(item)} title="Editar" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => excluir(item)} title="Excluir" className="rounded-full p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {rascunho && (
        <FormularioLancamento
          key={chaveFormulario}
          igrejaId={igrejaId}
          contexto={contexto}
          moeda={moeda}
          inicial={rascunho}
          onFechar={() => setRascunho(null)}
          onSalvo={(continuar, ultimo) => {
            carregar();
            // "Salvar e lançar outro": mantém data, conta, categoria e forma, como na contagem de envelopes.
            setRascunho(continuar ? novoRascunho(ultimo.tipo, ultimo) : null);
            setChaveFormulario((chave) => chave + 1);
          }}
        />
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}

function FormularioLancamento({
  igrejaId,
  contexto,
  moeda,
  inicial,
  onFechar,
  onSalvo,
}: {
  igrejaId: string;
  contexto: ContextoFinancas;
  moeda: (centavos: number) => string;
  inicial: Rascunho;
  onFechar: () => void;
  onSalvo: (continuar: boolean, ultimo: Rascunho) => void;
}) {
  const [form, setForm] = useState<Rascunho>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [erro, setErro] = useState('');

  const contasAtivas = contexto.contas.filter((c) => c.ativo || c.id === form.conta_id || c.id === form.conta_destino_id);
  const categoriasDoTipo = contexto.categorias.filter(
    (c) => c.tipo === form.tipo && (c.ativo || c.id === form.categoria_id)
  );
  const categoria = contexto.categorias.find((c) => c.id === form.categoria_id);
  const atualizar = (campo: Partial<Rascunho>) => setForm((atual) => ({ ...atual, ...campo }));

  const enviarArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviandoArquivo(true);
    setErro('');
    try {
      const formData = new FormData();
      formData.append('igreja_id', igrejaId);
      formData.append('arquivo', arquivo);
      const data = await finApi<{ path: string }>('comprovantes', { method: 'POST', body: formData });
      atualizar({ comprovante_path: data.path });
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setEnviandoArquivo(false);
    }
  };

  const salvar = async (event: FormEvent, continuar = false) => {
    event.preventDefault();
    setErro('');
    const valorCentavos = lerValorDigitado(form.valorTexto);
    if (valorCentavos <= 0) {
      setErro('Informe o valor.');
      return;
    }

    setSalvando(true);
    try {
      const corpo = {
        igreja_id: igrejaId,
        tipo: form.tipo,
        data: form.data,
        valor: valorCentavos / 100,
        conta_id: form.conta_id,
        conta_destino_id: form.conta_destino_id || null,
        categoria_id: form.categoria_id || null,
        pessoa_id: form.pessoa?.id || null,
        descricao: form.descricao,
        forma_pagamento: form.forma_pagamento || null,
        documento_tipo: form.documento_tipo || null,
        documento_numero: form.documento_numero,
        comprovante_path: form.comprovante_path || null,
      };
      if (form.id) await finApi(`lancamentos/${form.id}`, { method: 'PATCH', json: corpo });
      else await finApi('lancamentos', { method: 'POST', json: corpo });
      onSalvo(continuar && !form.id, form);
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const tipos: Array<{ valor: TipoLancamento; nome: string }> = [
    { valor: 'receita', nome: 'Entrada' },
    { valor: 'despesa', nome: 'Saída' },
    { valor: 'transferencia', nome: 'Transferência' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={(e) => salvar(e)}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{form.id ? 'Editar lançamento' : 'Novo lançamento'}</h3>
          <button type="button" onClick={onFechar} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {tipos.map((t) => (
            <button
              key={t.valor}
              type="button"
              disabled={Boolean(form.id)}
              onClick={() => atualizar({ tipo: t.valor, categoria_id: '', pessoa: null })}
              className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                form.tipo === t.valor ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.nome}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Data *</span>
            <input type="date" value={form.data} onChange={(e) => atualizar({ data: e.target.value })} className={inputClass} required />
          </label>
          <label className="block">
            <span className={labelClass}>Valor *</span>
            <CampoValor
              valor={form.valorTexto}
              onChange={(valorTexto) => atualizar({ valorTexto })}
              moeda={moeda}
              className={`${inputClass} text-right font-semibold tabular-nums`}
              autoFocus
              required
            />
          </label>

          <label className="block">
            <span className={labelClass}>{form.tipo === 'transferencia' ? 'Da conta *' : 'Conta *'}</span>
            <select value={form.conta_id} onChange={(e) => atualizar({ conta_id: e.target.value })} className={inputClass} required>
              {contasAtivas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          {form.tipo === 'transferencia' ? (
            <label className="block">
              <span className={labelClass}>Para a conta *</span>
              <select value={form.conta_destino_id} onChange={(e) => atualizar({ conta_destino_id: e.target.value })} className={inputClass} required>
                <option value="">Escolha…</option>
                {contasAtivas
                  .filter((c) => c.id !== form.conta_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className={labelClass}>Categoria *</span>
              <select value={form.categoria_id} onChange={(e) => atualizar({ categoria_id: e.target.value, pessoa: null })} className={inputClass} required>
                <option value="">Escolha…</option>
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {form.tipo === 'transferencia' && (
          <p className="mt-2 text-xs text-slate-500">
            Use para depositar o dinheiro do caixa no banco ou mover entre contas. Não conta como entrada nem saída.
          </p>
        )}

        {categoria?.nominal && (
          <div className="mt-4">
            <span className={labelClass}>Contribuinte</span>
            <PessoaPicker igrejaId={igrejaId} valor={form.pessoa} onChange={(pessoa) => atualizar({ pessoa })} />
            <p className="mt-1 text-xs text-slate-500">
              Deixe em branco para dízimo não identificado. O nome só aparece para a tesouraria e o pastor.
            </p>
          </div>
        )}

        <label className="mt-4 block">
          <span className={labelClass}>Descrição</span>
          <input
            value={form.descricao}
            onChange={(e) => atualizar({ descricao: e.target.value })}
            placeholder={form.tipo === 'despesa' ? 'Ex.: Conta de luz de setembro' : 'Ex.: Culto de domingo à noite'}
            className={inputClass}
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>Forma</span>
            <select value={form.forma_pagamento} onChange={(e) => atualizar({ forma_pagamento: e.target.value })} className={inputClass}>
              <option value="">—</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          {form.tipo === 'despesa' && (
            <>
              <label className="block">
                <span className={labelClass}>Documento</span>
                <select value={form.documento_tipo} onChange={(e) => atualizar({ documento_tipo: e.target.value })} className={inputClass}>
                  <option value="">—</option>
                  {TIPOS_DOCUMENTO.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Número</span>
                <input value={form.documento_numero} onChange={(e) => atualizar({ documento_numero: e.target.value })} className={inputClass} />
              </label>
            </>
          )}
        </div>

        <div className="mt-4">
          <span className={labelClass}>Comprovante</span>
          {form.comprovante_path ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
              <span className="inline-flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Comprovante anexado
              </span>
              <button type="button" onClick={() => atualizar({ comprovante_path: '' })} className="text-xs underline">
                Remover
              </button>
            </div>
          ) : (
            <label className={`${botaoSecundario} w-full cursor-pointer`}>
              {enviandoArquivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {enviandoArquivo ? 'Enviando…' : 'Anexar foto ou PDF'}
              <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => enviarArquivo(e.target.files?.[0])} />
            </label>
          )}
          {form.tipo === 'despesa' && (
            <p className="mt-1 text-xs text-slate-500">
              Toda saída precisa de comprovante: nota fiscal, recibo ou RPA para serviço de pessoa física. A comissão de contas vai pedir.
            </p>
          )}
        </div>

        {erro && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!form.id && (
            <button type="button" disabled={salvando} onClick={(e) => salvar(e, true)} className={botaoSecundario}>
              Salvar e lançar outro
            </button>
          )}
          <button type="submit" disabled={salvando || enviandoArquivo} className={botaoPrimario}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
