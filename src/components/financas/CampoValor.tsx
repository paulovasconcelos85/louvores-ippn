'use client';

import { lerValorDigitado, valorDaMascara } from '@/lib/financas';

// Campo de valor com máscara de moeda: os dígitos entram pela direita
// (1, 2, 3 → R$ 1,23), sem dúvida entre ponto e vírgula. Guarda o texto
// formatado, que lerValorDigitado converte de volta em centavos.

export default function CampoValor({
  valor,
  onChange,
  moeda,
  permitirNegativo = false,
  className,
  autoFocus,
  required,
}: {
  valor: string;
  onChange: (texto: string) => void;
  moeda: (centavos: number) => string;
  permitirNegativo?: boolean;
  className?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const exibido = valor.trim() ? moeda(lerValorDigitado(valor)) : '';

  return (
    <input
      inputMode={permitirNegativo ? 'text' : 'numeric'}
      value={exibido}
      onChange={(e) => {
        const centavos = valorDaMascara(exibido, e.target.value, permitirNegativo);
        onChange(centavos === null ? '' : moeda(centavos));
      }}
      onFocus={(e) => {
        const campo = e.currentTarget;
        requestAnimationFrame(() => campo.setSelectionRange(campo.value.length, campo.value.length));
      }}
      placeholder={moeda(0)}
      className={className}
      autoFocus={autoFocus}
      required={required}
    />
  );
}
