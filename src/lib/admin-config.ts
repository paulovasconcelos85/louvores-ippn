// Lista de emails com permissão de admin
export const ADMIN_EMAILS = [
  'paulovasconcelos85@gmail.com',
  // Adicione mais emails de admins aqui
];

export const isAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};