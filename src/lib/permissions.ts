// lib/permissions.ts
import { ADMIN_EMAILS } from './admin-config';

export type CargoTipo = 'membro' | 'diacono' | 'presbitero' | 'pastor' | 'seminarista' | 'staff' | 'musico' | 'admin' | 'superadmin';

export interface UsuarioPermitido {
  id: string;
  email: string;
  nome: string | null;
  cargo: CargoTipo;
  ativo: boolean;
  telefone?: string | null;
  foto_url?: string | null;
  observacoes?: string | null;
}

// Cargos que podem acessar o painel administrativo
// ⚠️ NOTA: 'membro' NÃO está nesta lista - membros são apenas cadastros sem acesso ao sistema
export const CARGOS_ACESSO_ADMIN: CargoTipo[] = [
  'diacono',
  'presbitero',
  'pastor',
  'musico',
  'seminarista',
  'staff',
  'admin',
  'superadmin'
];

// Cargos que podem gerenciar usuários (cadastrar/editar/excluir)
export const CARGOS_GERENCIAR_USUARIOS: CargoTipo[] = [
  'admin',
  'superadmin'
];

// Cargos que podem criar/editar escalas
export const CARGOS_GERENCIAR_ESCALAS: CargoTipo[] = [
  'presbitero',
  'pastor',
  'staff',
  'admin',
  'superadmin'
];

// Cargos que podem gerenciar músicas/cultos
export const CARGOS_GERENCIAR_CONTEUDO: CargoTipo[] = [
  'diacono',
  'presbitero',
  'pastor',
  'musico',
  'seminarista',
  'staff',
  'admin',
  'superadmin'
];

/**
 * 🔐 Verifica se o email está na lista hardcoded de super-admins,
 * ou se o cargo é 'superadmin' no banco de dados.
 */
export function isSuperAdmin(email: string | null | undefined, cargo?: CargoTipo | null): boolean {
  if (cargo === 'superadmin') return true;
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Verifica se o cargo tem permissão para acessar o admin
 */
export function podeAcessarAdmin(cargo: CargoTipo | null): boolean {
  if (!cargo) return false;
  return CARGOS_ACESSO_ADMIN.includes(cargo);
}

/**
 * 👥 Verifica se pode gerenciar usuários
 * ORDEM DE VERIFICAÇÃO:
 * 1. Se está em ADMIN_EMAILS (super-admin) → SEMPRE PODE
 * 2. Se cargo é 'admin' no banco → PODE
 * 3. Caso contrário → NÃO PODE
 * 
 * @param cargo - Cargo do usuário no banco de dados
 * @param email - Email do usuário (opcional, usado para verificar super-admin)
 */
export function podeGerenciarUsuarios(cargo: CargoTipo | null, email?: string | null): boolean {
  // PRIORIDADE 1: Super-admins da lista hardcoded sempre podem
  if (email && isSuperAdmin(email)) {
    return true;
  }
  
  // PRIORIDADE 2: Cargo admin no banco de dados
  if (!cargo) return false;
  return CARGOS_GERENCIAR_USUARIOS.includes(cargo);
}

/**
 * Verifica se o cargo pode gerenciar escalas
 */
export function podeGerenciarEscalas(cargo: CargoTipo | null): boolean {
  if (!cargo) return false;
  return CARGOS_GERENCIAR_ESCALAS.includes(cargo);
}

/**
 * Verifica se o cargo pode gerenciar conteúdo (músicas/cultos)
 */
export function podeGerenciarConteudo(cargo: CargoTipo | null): boolean {
  if (!cargo) return false;
  return CARGOS_GERENCIAR_CONTEUDO.includes(cargo);
}

/**
 * Retorna label amigável para o cargo
 */
export function getCargoLabel(cargo: CargoTipo): string {
  const labels: Record<CargoTipo, string> = {
    membro: 'Membro',
    diacono: 'Diácono',
    presbitero: 'Presbítero',
    pastor: 'Pastor',
    seminarista: 'Seminarista',
    staff: 'Staff',
    musico: 'Músico',
    admin: 'Administrador',
    superadmin: 'Super Admin'
  };
  return labels[cargo];
}

/**
 * Retorna cor para o cargo (classes Tailwind)
 */
export function getCargoCor(cargo: CargoTipo): string {
  const cores: Record<CargoTipo, string> = {
    membro: 'bg-slate-100 text-slate-700',
    diacono: 'bg-teal-100 text-teal-800',
    presbitero: 'bg-indigo-100 text-indigo-800',
    pastor: 'bg-purple-100 text-purple-800',
    seminarista: 'bg-blue-100 text-blue-800',
    staff: 'bg-cyan-100 text-cyan-800',
    musico: 'bg-emerald-100 text-emerald-800',
    admin: 'bg-red-100 text-red-800',
    superadmin: 'bg-orange-100 text-orange-800'
  };
  return cores[cargo];
}

/**
 * Retorna ícone emoji para o cargo
 */
export function getCargoIcone(cargo: CargoTipo): string {
  const icones: Record<CargoTipo, string> = {
    membro: '👤',
    diacono: '🤝',
    presbitero: '👔',
    pastor: '📖',
    seminarista: '📚',
    staff: '🛠️',
    musico: '🎵',
    admin: '🔐',
    superadmin: '⭐'
  };
  return icones[cargo];
}