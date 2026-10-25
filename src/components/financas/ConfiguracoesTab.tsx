'use client';

import { FormEvent, useState } from 'react';
import { Landmark, Loader2, Pencil, Plus, Tags, Trash2, UsersRound, X } from 'lucide-react';
import {
  GRUPOS_DESPESA,
  GRUPOS_IPB,
  GRUPOS_RECEITA,
  PAPEIS_EQUIPE,
  centavos,
  lerValorDigitado,
  type FinCategoria,
  type FinConta,
  type GrupoIpb,
  type PapelEquipe,
} from '@/lib/financas';
import PessoaPicker from './PessoaPicker';
import { botaoPrimario, botaoSecundario, finApi, inputClass, labelClass, type ContextoFinancas } from './api';

export default function ConfiguracoesTab({
  igrejaId,
  contexto,
  moeda,
  onAlterado,
}: {
  igrejaId: string;
  contexto: ContextoFinancas;
  moeda: (centavos: number) => string;
  onAlterado: () => void;
}) {
  return (
    <div className="space-y-6">
      <Equipe igrejaId={igrejaId} contexto={contexto} onAlterado={onAlterado} />
      <Contas igrejaId={igrejaId} contexto={contexto} moeda={moeda} onAlterado={onAlterado} />
      <Categorias igrejaId={igrejaId} contexto={contexto} onAlterado={onAlterado} />
    </div>
  );
}

function Secao({ icone: Icone, titulo, texto, children }: { icone: typeof Landmark; titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <Icone className="h-4 w-4 text-emerald-700" />
        {titulo}
      </h3>
      <p className="mt-1 text-sm text-slate-600">{texto}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Equipe({ igrejaId, contexto, onAlterado }: { igrejaId: string; contexto: ContextoFinancas; onAlterado: () => void }) {
  const anoAtual = new Date().getFullYear();
  const [pessoa, setPessoa] = useState<{ id: string; nome: string } | null>(null);
  const [papel, setPapel] = useState<PapelEquipe>('tesoureiro');
  const [salvando, setSalvando] = useState(false);
  const podeDesignar = contexto.permissoes.podeDesignarEquipe;
  const doAno = contexto.equipe.filter((m) => m.ano === anoAtual);
  const doAnoAnterior = contexto.equipe.filter((m) => m.ano === anoAtual - 1);

  const adicionar = async (alvo: { id: string } | null, papelAlvo: PapelEquipe) => {
    if (!alvo) return;
    setSalvando(true);
    try {
      await finApi('configuracao', {
        method: 'POST',
        json: { igreja_id: igrejaId, acao: 'adicionar_equipe', pessoa_id: alvo.id, papel: papelAlvo, ano: anoAtual },
      });
      setPessoa(null);
      onAlterado();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover esta pessoa da equipe?')) return;
    try {
      await finApi('configuracao', { method: 'POST', json: { igreja_id: igrejaId, acao: 'remover_equipe', id } });
      onAlterado();
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <Secao
      icone={UsersRound}
      titulo={`Equipe da tesouraria — ${anoAtual}`}
      texto="O Conselho elege o tesoureiro e nomeia a Comissão de Exame de Contas (3 pessoas) todo ano. A designação vale só para esta igreja."
    >
      {doAno.length === 0 && doAnoAnterior.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          A equipe de {anoAtual} ainda não foi designada; vale a de {anoAtual - 1}.
          {podeDesignar && (
            <button
              type="button"
              disabled={salvando}
              onClick={async () => {
                for (const membro of doAnoAnterior) await adicionar({ id: membro.pessoa_id }, membro.papel);
              }}
              className="ml-2 font-semibold underline"
            >
              Repetir a equipe de {anoAtual - 1}
            </button>
          )}
        </div>
      )}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {(doAno.length > 0 ? doAno : doAnoAnterior).map((membro) => (
          <li key={membro.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1 font-medium text-slate-900">{membro.nome}</span>
            <span className="text-slate-600">{PAPEIS_EQUIPE[membro.papel].nome}</span>
            {podeDesignar && membro.ano === anoAtual && (
              <button type="button" onClick={() => remover(membro.id)} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {doAno.length === 0 && doAnoAnterior.length === 0 && (
          <li className="px-4 py-4 text-sm text-slate-500">Ninguém designado ainda. Comece pelo tesoureiro.</li>
        )}
      </ul>

      {podeDesignar && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <PessoaPicker igrejaId={igrejaId} valor={pessoa} onChange={setPessoa} />
          <select value={papel} onChange={(e) => setPapel(e.target.value as PapelEquipe)} className={inputClass}>
            {(Object.keys(PAPEIS_EQUIPE) as PapelEquipe[]).map((p) => (
              <option key={p} value={p}>
                {PAPEIS_EQUIPE[p].nome}
              </option>
            ))}
          </select>
          <button type="button" disabled={!pessoa || salvando} onClick={() => adicionar(pessoa, papel)} className={botaoPrimario}>
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
          <p className="text-xs text-slate-500 sm:col-span-3">{PAPEIS_EQUIPE[papel].explicacao}</p>
        </div>
      )}
    </Secao>
  );
}

function Contas({
  igrejaId,
  contexto,
  moeda,
  onAlterado,
}: {
  igrejaId: string;
  contexto: ContextoFinancas;
  moeda: (centavos: number) => string;
  onAlterado: () => void;
}) {
  const [editando, setEditando] = useState<Partial<FinConta> & { saldoTexto?: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const podeEditar = contexto.permissoes.podeConfigurar;

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      await finApi('configuracao', {
        method: 'POST',
        json: {
          igreja_id: igrejaId,
          acao: 'salvar_conta',
          ...editando,
          saldo_inicial: lerValorDigitado(editando.saldoTexto || '0') / 100,
        },
      });
      setEditando(null);
      onAlterado();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Secao
      icone={Landmark}
      titulo="Contas"
      texto="O caixa (dinheiro das ofertas) e cada conta bancária ou aplicação. O saldo inicial é o saldo no dia em que a igreja começou a usar o sistema."
    >
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {contexto.contas.map((conta) => (
          <li key={conta.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${conta.ativo ? '' : 'opacity-50'}`}>
            <span className="flex-1">
              <span className="font-medium text-slate-900">{conta.nome}</span>
              <span className="block text-xs text-slate-500">
                {conta.tipo === 'caixa' ? 'Caixa' : conta.tipo === 'aplicacao' ? 'Aplicação' : [conta.banco, conta.agencia, conta.numero].filter(Boolean).join(' · ') || 'Banco'}
                {' · '}saldo inicial {moeda(centavos(conta.saldo_inicial))} em {conta.data_saldo_inicial.split('-').reverse().join('/')}
              </span>
            </span>
            {podeEditar && (
              <button
                type="button"
                onClick={() => setEditando({ ...conta, saldoTexto: Number(conta.saldo_inicial).toFixed(2).replace('.', ',') })}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {contexto.contas.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">Nenhuma conta ainda.</li>}
      </ul>

      {podeEditar && !editando && (
        <button
          type="button"
          onClick={() =>
            setEditando({
              tipo: contexto.contas.length === 0 ? 'caixa' : 'banco',
              nome: contexto.contas.length === 0 ? 'Caixa' : '',
              data_saldo_inicial: new Date().toISOString().slice(0, 10),
              saldoTexto: '',
              ativo: true,
            })
          }
          className={`${botaoSecundario} mt-4`}
        >
          <Plus className="h-4 w-4" />
          Nova conta
        </button>
      )}

      {editando && (
        <form onSubmit={salvar} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Nome *</span>
            <input value={editando.nome || ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} placeholder="Ex.: Banco do Brasil — conta corrente" className={inputClass} required />
          </label>
          <label className="block">
            <span className={labelClass}>Tipo</span>
            <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as FinConta['tipo'] })} className={inputClass}>
              <option value="caixa">Caixa (dinheiro)</option>
              <option value="banco">Conta bancária</option>
              <option value="aplicacao">Aplicação</option>
            </select>
          </label>
          {editando.tipo !== 'caixa' && (
            <>
              <label className="block">
                <span className={labelClass}>Banco</span>
                <input value={editando.banco || ''} onChange={(e) => setEditando({ ...editando, banco: e.target.value })} className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Agência</span>
                  <input value={editando.agencia || ''} onChange={(e) => setEditando({ ...editando, agencia: e.target.value })} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Conta</span>
                  <input value={editando.numero || ''} onChange={(e) => setEditando({ ...editando, numero: e.target.value })} className={inputClass} />
                </label>
              </div>
            </>
          )}
          <label className="block">
            <span className={labelClass}>Saldo inicial</span>
            <input inputMode="decimal" value={editando.saldoTexto || ''} onChange={(e) => setEditando({ ...editando, saldoTexto: e.target.value })} placeholder="0,00" className={`${inputClass} text-right`} />
          </label>
          <label className="block">
            <span className={labelClass}>Na data de *</span>
            <input type="date" value={editando.data_saldo_inicial || ''} onChange={(e) => setEditando({ ...editando, data_saldo_inicial: e.target.value })} className={inputClass} required />
          </label>
          {editando.id && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={editando.ativo !== false} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} />
              Conta em uso (desmarque para encerrar; o histórico continua)
            </label>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={salvando} className={botaoPrimario}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar conta
            </button>
            <button type="button" onClick={() => setEditando(null)} className={botaoSecundario}>
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Secao>
  );
}

function Categorias({ igrejaId, contexto, onAlterado }: { igrejaId: string; contexto: ContextoFinancas; onAlterado: () => void }) {
  const [editando, setEditando] = useState<Partial<FinCategoria> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const podeEditar = contexto.permissoes.podeConfigurar;

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      await finApi('configuracao', { method: 'POST', json: { igreja_id: igrejaId, acao: 'salvar_categoria', ...editando } });
      setEditando(null);
      onAlterado();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSalvando(false);
    }
  };

  const blocos: Array<{ titulo: string; grupos: GrupoIpb[] }> = [
    { titulo: 'Receitas', grupos: GRUPOS_RECEITA },
    { titulo: 'Despesas', grupos: GRUPOS_DESPESA },
  ];

  return (
    <Secao
      icone={Tags}
      titulo="Categorias"
      texto="Cada categoria pertence a um grupo do relatório estatístico da IPB; é assim que o relatório anual se monta sozinho. Renomeie e crie à vontade."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {blocos.map((bloco) => (
          <div key={bloco.titulo}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{bloco.titulo}</p>
            {bloco.grupos.map((grupo) => (
              <div key={grupo} className="mb-3">
                <p className="text-sm font-semibold text-slate-800" title={GRUPOS_IPB[grupo].explicacao}>
                  {GRUPOS_IPB[grupo].nome}
                </p>
                <ul className="mt-1">
                  {contexto.categorias
                    .filter((c) => c.grupo === grupo)
                    .map((c) => (
                      <li key={c.id} className={`flex items-center gap-2 py-0.5 text-sm ${c.ativo ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                        <span className="flex-1">
                          {c.nome}
                          {c.nominal && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">nominal</span>}
                        </span>
                        {podeEditar && (
                          <button type="button" onClick={() => setEditando(c)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>

      {podeEditar && !editando && (
        <button type="button" onClick={() => setEditando({ grupo: 'causas_locais', nome: '', ativo: true })} className={`${botaoSecundario} mt-2`}>
          <Plus className="h-4 w-4" />
          Nova categoria
        </button>
      )}

      {editando && (
        <form onSubmit={salvar} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Nome *</span>
            <input value={editando.nome || ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} className={inputClass} required />
          </label>
          <label className="block">
            <span className={labelClass}>Grupo no relatório da IPB *</span>
            <select value={editando.grupo} onChange={(e) => setEditando({ ...editando, grupo: e.target.value as GrupoIpb })} className={inputClass}>
              {[...GRUPOS_RECEITA, ...GRUPOS_DESPESA].map((g) => (
                <option key={g} value={g}>
                  {GRUPOS_IPB[g].tipo === 'receita' ? 'Receita · ' : 'Despesa · '}
                  {GRUPOS_IPB[g].nome}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">{editando.grupo ? GRUPOS_IPB[editando.grupo].explicacao : ''}</p>
          {editando.grupo && GRUPOS_IPB[editando.grupo].tipo === 'receita' && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={editando.nominal === true} onChange={(e) => setEditando({ ...editando, nominal: e.target.checked })} />
              Nominal — pede o nome de quem contribuiu (como o dízimo)
            </label>
          )}
          {editando.id && (
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={editando.ativo !== false} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} />
              Em uso (desmarque para esconder dos novos lançamentos)
            </label>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={salvando} className={botaoPrimario}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar categoria
            </button>
            <button type="button" onClick={() => setEditando(null)} className={botaoSecundario}>
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Secao>
  );
}
