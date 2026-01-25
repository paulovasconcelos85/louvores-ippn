// src/lib/phone-mask.ts

/**
 * Formata número de telefone brasileiro
 * Aceita formatos: (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return '';
  
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Limita a 11 dígitos (DDD + 9 dígitos para celular)
  const limitedNumbers = numbers.slice(0, 11);
  
  // Aplica a máscara baseado na quantidade de dígitos
  if (limitedNumbers.length <= 2) {
    // Apenas DDD
    return limitedNumbers.replace(/(\d{0,2})/, '($1');
  } else if (limitedNumbers.length <= 6) {
    // DDD + primeiros dígitos
    return limitedNumbers.replace(/(\d{2})(\d{0,4})/, '($1) $2');
  } else if (limitedNumbers.length <= 10) {
    // Telefone fixo: (XX) XXXX-XXXX
    return limitedNumbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    // Celular: (XX) 9XXXX-XXXX
    return limitedNumbers.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }
}

/**
 * Remove a formatação do telefone, retornando apenas números
 */
export function unformatPhoneNumber(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Valida se o telefone está no formato correto
 * Aceita tanto fixo (10 dígitos) quanto celular (11 dígitos)
 */
export function isValidPhoneNumber(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  
  // Deve ter 10 (fixo) ou 11 (celular) dígitos
  if (numbers.length !== 10 && numbers.length !== 11) {
    return false;
  }
  
  // DDD deve ser válido (11 a 99)
  const ddd = parseInt(numbers.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return false;
  }
  
  // Se for celular (11 dígitos), o primeiro dígito após o DDD deve ser 9
  if (numbers.length === 11 && numbers[2] !== '9') {
    return false;
  }
  
  return true;
}

/**
 * Retorna uma mensagem de erro se o telefone for inválido
 */
export function getPhoneValidationError(value: string): string | null {
  if (!value) return null;
  
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length < 10) {
    return 'Telefone incompleto. Deve ter 10 ou 11 dígitos.';
  }
  
  if (numbers.length > 11) {
    return 'Telefone muito longo. Deve ter no máximo 11 dígitos.';
  }
  
  const ddd = parseInt(numbers.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return 'DDD inválido. Deve estar entre 11 e 99.';
  }
  
  if (numbers.length === 11 && numbers[2] !== '9') {
    return 'Celular deve começar com 9 após o DDD.';
  }
  
  return null;
}