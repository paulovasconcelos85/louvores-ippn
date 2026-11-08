'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import type { Cantico } from '../_lib/tipos';
import { getCanticoInlineReference, getRepertorioTextos, matchesCanticoQuery } from '../_lib/canticos';

export function PublicCanticoTextarea({
  value,
  onChange,
  canticos,
  disabled,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  canticos: Cantico[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textosRepertorio = getRepertorioTextos(canticos);
  const [triggerState, setTriggerState] = useState<{
    trigger: '@' | '#';
    query: string;
    start: number;
    end: number;
  } | null>(null);
  const [selecionadoIndex, setSelecionadoIndex] = useState(0);

  const ajustarAltura = () => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    ajustarAltura();
  }, [value]);

  const analisarTrigger = (texto: string, cursor: number) => {
    const cursorSeguro = Math.max(0, Math.min(cursor, texto.length));
    const trechoAnterior = texto.slice(0, cursorSeguro);
    const inicioLinha = trechoAnterior.lastIndexOf('\n') + 1;
    const linhaAtual = trechoAnterior.slice(inicioLinha);
    const match = linhaAtual.match(/(?:^|\s)([@#])([^\s@#]*)$/);

    if (!match) {
      setTriggerState(null);
      return;
    }

    const trigger = match[1] as '@' | '#';
    const query = match[2] || '';
    if (trigger === '#' && !textosRepertorio.aceitaBuscaPorNumero) {
      setTriggerState(null);
      return;
    }
    const token = `${trigger}${query}`;
    const tokenIndex = linhaAtual.lastIndexOf(token);

    if (tokenIndex < 0) {
      setTriggerState(null);
      return;
    }

    let end = cursorSeguro;

    while (end < texto.length && !/\s/.test(texto[end])) {
      end += 1;
    }

    setTriggerState({
      trigger,
      query,
      start: inicioLinha + tokenIndex,
      end,
    });
    setSelecionadoIndex(0);
  };

  const sugestoes = useMemo(() => {
    if (!triggerState) return [];

    if (triggerState.trigger === '#') {
      const termo = triggerState.query.trim();
      const termoCompacto = termo.replace(/\D/g, '');

      return canticos
        .filter((cantico) => cantico.tipo === 'hinario' && cantico.numero)
        .filter((cantico) => {
          if (!termoCompacto) return true;

          const numero = cantico.numero?.trim() || '';
          const numeroSemZeros = numero.replace(/^0+/, '') || numero;

          return (
            numero.includes(termoCompacto) ||
            numeroSemZeros.includes(termoCompacto)
          );
        })
        .slice(0, 8);
    }

    return canticos.filter((cantico) => matchesCanticoQuery(cantico, triggerState.query)).slice(0, 8);
  }, [canticos, triggerState]);

  const aplicarSugestao = (cantico: Cantico) => {
    if (!triggerState) return;

    const referencia = getCanticoInlineReference(cantico);
    const proximoValor = `${value.slice(0, triggerState.start)}${referencia}${value.slice(triggerState.end)}`;
    onChange(proximoValor);
    setTriggerState(null);
    setSelecionadoIndex(0);

    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      const novaPosicao = triggerState.start + referencia.length;
      element.focus();
      element.setSelectionRange(novaPosicao, novaPosicao);
      ajustarAltura();
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        style={{ overflow: 'hidden' }}
        className={className}
        onChange={(event) => {
          const proximoValor = event.target.value;
          onChange(proximoValor);
          ajustarAltura();
          analisarTrigger(proximoValor, event.target.selectionStart ?? proximoValor.length);
        }}
        onClick={(event) => {
          const element = event.currentTarget;
          analisarTrigger(element.value, element.selectionStart ?? element.value.length);
        }}
        onKeyUp={(event) => {
          const element = event.currentTarget;
          analisarTrigger(element.value, element.selectionStart ?? element.value.length);
        }}
        onBlur={() => {
          setTimeout(() => setTriggerState(null), 120);
        }}
        onKeyDown={(event) => {
          if (!triggerState || sugestoes.length === 0) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelecionadoIndex((atual) => (atual + 1) % sugestoes.length);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelecionadoIndex((atual) => (atual - 1 + sugestoes.length) % sugestoes.length);
            return;
          }

          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            aplicarSugestao(sugestoes[selecionadoIndex] || sugestoes[0]);
            return;
          }

          if (event.key === 'Escape') {
            setTriggerState(null);
          }
        }}
      />

      {triggerState && sugestoes.length > 0 && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl">
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            {triggerState.trigger === '#'
              ? 'Buscar hino por número'
              : textosRepertorio.tituloBuscaNome}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {sugestoes.map((cantico, index) => {
              const ativo = index === selecionadoIndex;
              return (
                <button
                  key={`${cantico.id}-${index}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => aplicarSugestao(cantico)}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    ativo ? 'bg-emerald-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {cantico.nome}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getCanticoInlineReference(cantico)}
                    </p>
                  </div>
                  {cantico.numero ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {cantico.numero}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
