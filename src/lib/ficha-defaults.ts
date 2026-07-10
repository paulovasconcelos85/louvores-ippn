// Valores padrão da Ficha de Candidato à Membresia. Ficam num módulo leve
// (sem jsPDF) para poder ser importados também pelos formulários públicos
// sem inflar o bundle com a lib de geração de PDF.

// Pastor titular que confirma as fichas — usado como assinante padrão
// independentemente de quem estiver operando o sistema no momento.
export const NOME_PASTOR_PADRAO = 'Paulo Cesar Diniz de Araújo';

// Congregação padrão em Manaus para quem não especificar outra.
export const CONGREGACAO_MANAUS_PADRAO = 'Igreja Presbiteriana da Ponta Negra';

// A Ficha de Candidato à Membresia é um documento específico da IPB/IPM —
// só faz sentido (campos, PDF, assinatura) para a igreja IPPN. As demais
// igrejas do sistema (multi-tenant) não devem ver essa funcionalidade.
export const SLUG_IGREJA_FICHA_CANDIDATO = 'ippn';

export function podeUsarFichaCandidato(igrejaSlug: string | null | undefined): boolean {
  return igrejaSlug === SLUG_IGREJA_FICHA_CANDIDATO;
}
