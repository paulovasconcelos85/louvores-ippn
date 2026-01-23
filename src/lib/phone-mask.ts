// lib/phone-mask.ts

/**
 * Formata número de telefone automaticamente
 * Detecta Brasil ou EUA/Canadá baseado no padrão
 * 
 * Padrões suportados:
 * - Brasil: (92) 98139-4605 (11 dígitos)
 * - Brasil: (92) 3234-5678 (10 dígitos)
 * - EUA/CA: +1 (555) 123-4567 (11 dígitos com +1)
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return '';

  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');

  // Sem números, retorna vazio
  if (!numbers) return '';

  // Detecta padrão EUA/Canadá (começa com 1 e tem 11 dígitos)
  if (numbers.startsWith('1') && numbers.length === 11) {
    return formatUSPhone(numbers);
  }

  // Detecta padrão Brasil
  if (numbers.length <= 11 && !numbers.startsWith('1')) {
    return formatBRPhone(numbers);
  }

  // Se começar com 1 mas ainda não tem 11 dígitos, formata como US
  if (numbers.startsWith('1')) {
    return formatUSPhone(numbers);
  }

  // Padrão Brasil por padrão
  return formatBRPhone(numbers);
}

/**
 * Formata telefone brasileiro
 * (92) 98139-4605 ou (92) 3234-5678
 */
function formatBRPhone(numbers: string): string {
  if (numbers.length <= 2) {
    // (92
    return `(${numbers}`;
  }

  if (numbers.length <= 6) {
    // (92) 9813
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }

  if (numbers.length <= 10) {
    // (92) 3234-5678
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
  }

  // (92) 98139-4605
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

/**
 * Formata telefone EUA/Canadá
 * +1 (555) 123-4567
 */
function formatUSPhone(numbers: string): string {
  if (numbers.length <= 1) {
    // +1
    return `+${numbers}`;
  }

  if (numbers.length <= 4) {
    // +1 (555
    return `+${numbers.slice(0, 1)} (${numbers.slice(1)}`;
  }

  if (numbers.length <= 7) {
    // +1 (555) 123
    return `+${numbers.slice(0, 1)} (${numbers.slice(1, 4)}) ${numbers.slice(4)}`;
  }

  // +1 (555) 123-4567
  return `+${numbers.slice(0, 1)} (${numbers.slice(1, 4)}) ${numbers.slice(4, 7)}-${numbers.slice(7, 11)}`;
}

/**
 * Remove a máscara e retorna apenas números
 * Útil para salvar no banco
 */
export function unformatPhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valida se o telefone está completo
 */
export function isValidPhone(value: string): boolean {
  const numbers = unformatPhoneNumber(value);
  
  // Brasil: 10 ou 11 dígitos
  if (numbers.length === 10 || numbers.length === 11) {
    return !numbers.startsWith('1');
  }
  
  // EUA/Canadá: 11 dígitos começando com 1
  if (numbers.length === 11 && numbers.startsWith('1')) {
    return true;
  }
  
  return false;
}

/**
 * Detecta o país do telefone
 */
export function detectPhoneCountry(value: string): 'BR' | 'US' | 'unknown' {
  const numbers = unformatPhoneNumber(value);
  
  if (numbers.startsWith('1') && numbers.length === 11) {
    return 'US';
  }
  
  if ((numbers.length === 10 || numbers.length === 11) && !numbers.startsWith('1')) {
    return 'BR';
  }
  
  return 'unknown';
}