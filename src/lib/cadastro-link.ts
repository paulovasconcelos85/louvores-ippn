import { linkWhatsApp } from '@/lib/phone-mask';

// Helpers para o link público de "Completar cadastro" enviado a cada membro.

export function buildCompletarCadastroUrl(token: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/completar/${token}`;
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}

// Mensagem humilde pedindo que a pessoa complete o próprio cadastro.
// Sem emojis: texto plano transportado por WhatsApp/cópia degrada emojis
// para "�" em alguns clientes/encodings.
export function buildConviteCadastroMensagem(nome: string, token: string) {
  const url = buildCompletarCadastroUrl(token);
  return (
    `Paz do Senhor, ${primeiroNome(nome)}!\n\n` +
    `Estamos atualizando os cadastros da igreja. Quando puder, poderia, por gentileza, ` +
    `conferir e completar o seu cadastro (e o dos seus filhos, se for o caso)? É rapidinho:\n\n` +
    `${url}\n\n` +
    `Muito obrigado por colaborar!`
  );
}

// Abre o WhatsApp com a mensagem-convite pré-preenchida.
export function enviarConviteWhatsApp(
  nome: string,
  telefone: string | null,
  token: string,
  paisIgreja?: string | null
) {
  window.open(linkWhatsApp(telefone, paisIgreja, buildConviteCadastroMensagem(nome, token)), '_blank');
}
