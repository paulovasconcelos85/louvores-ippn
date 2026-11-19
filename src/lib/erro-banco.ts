import * as Sentry from '@sentry/nextjs';
import type { Locale } from '@/i18n/config';
import { porIdioma } from '@/i18n/por-idioma';

type ErroComCodigo = Error & { code: string };

function ehErroBanco(erro: unknown): erro is ErroComCodigo {
  return erro instanceof Error && erro.name === 'PostgrestError' && typeof (erro as ErroComCodigo).code === 'string';
}

// Mensagem para o usuário quando um salvamento falha. Erros do banco vão para o
// Sentry (o usuário só vê o código, para repassar ao suporte); erros lançados
// pelo próprio app (validação, "selecione uma igreja") são mostrados como estão.
// Só vão para o Sentry o código e a mensagem do Postgres: o campo `details`
// pode trazer valores da linha (e-mail, telefone) e dado de membro não sai do app.
export function mensagemErroAoSalvar(erro: unknown, locale: Locale, operacao: string) {
  if (erro instanceof Error && !ehErroBanco(erro) && erro.name === 'Error') {
    return erro.message;
  }

  const codigo = ehErroBanco(erro) ? erro.code : undefined;
  const reportado = new Error(erro instanceof Error ? erro.message : String(erro));
  reportado.name = ehErroBanco(erro) ? `PostgrestError ${erro.code}` : erro instanceof Error ? erro.name : 'ErroDesconhecido';
  Sentry.captureException(reportado, { tags: { operacao, codigo_banco: codigo } });
  console.error(`Erro em ${operacao}:`, erro);

  const base = porIdioma(
    locale,
    'Não foi possível salvar. Tente novamente em instantes; se o erro continuar, avise o suporte.',
    'No se pudo guardar. Inténtalo de nuevo en unos instantes; si el error continúa, avisa al soporte.',
    'Could not save. Try again in a moment; if the error continues, contact support.'
  );
  return codigo ? `${base} (${porIdioma(locale, 'código', 'código', 'code')} ${codigo})` : base;
}
