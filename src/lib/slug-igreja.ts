// Regras do endereço público da igreja (oikoshub.com/<slug>).
// O slug divide o espaço de URLs com as rotas do próprio sistema, por isso
// existe uma lista de nomes reservados.

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

// Rotas de primeiro nível do app e nomes que não devem virar igreja.
export const SLUGS_RESERVADOS = new Set([
  'admin', 'ajuda', 'api', 'app', 'auth', 'aceitar-convite', 'boletins-anteriores',
  'cadastro', 'canticos', 'cifra', 'comecar', 'completar', 'cultos', 'dashboard',
  'escala', 'escalas', 'letra', 'login', 'logout', 'oikos', 'pedidos',
  'pedidos-pastorais', 'perfil', 'privacidade', 'recursos', 'redefinir-senha', 'financas', 'tesouraria', 'sw', 'manifest',
  'favicon', 'icone', 'icons', 'static', 'public', 'www', 'suporte', 'contato',
  'termos', 'blog', 'precos', 'planos', 'igreja', 'igrejas', 'novo', 'nova',
  'teste', 'demo', 'root', 'sistema', 'oikoshub', 'hub', 'confissoes', 'biblia',
]);

// Palavras que não entram nas iniciais: "Igreja Presbiteriana da Ponta Negra" → "ippn".
const CONECTIVOS = new Set([
  'a', 'o', 'as', 'os', 'da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no',
  'nas', 'nos', 'para', 'por', 'la', 'el', 'los', 'las', 'del', 'y', 'en',
  'the', 'of', 'and', 'in', 'at',
]);

function semAcentos(valor: string) {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function slugSemLimite(valor: string) {
  return semAcentos(valor)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizarSlug(valor: string) {
  return slugSemLimite(valor).slice(0, SLUG_MAX).replace(/-+$/g, '');
}

export function iniciaisDoNome(nome: string) {
  return semAcentos(nome)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra && !CONECTIVOS.has(palavra))
    .map((palavra) => (/^\d+$/.test(palavra) ? palavra : palavra[0]))
    .join('');
}

export type MotivoSlugInvalido = 'curto' | 'longo' | 'formato' | 'reservado';

export function validarSlug(slug: string): MotivoSlugInvalido | null {
  if (slug.length < SLUG_MIN) return 'curto';
  if (slug.length > SLUG_MAX) return 'longo';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'formato';
  if (SLUGS_RESERVADOS.has(slug)) return 'reservado';
  return null;
}

/**
 * Gera candidatos em ordem de preferência a partir dos dados da igreja.
 * Ex.: "Igreja Presbiteriana da Ponta Negra", cidade "Manaus" →
 * ippn, ippn-manaus, igreja-presbiteriana-da-ponta-negra, ...
 */
export function sugerirSlugs(dados: { nome?: string | null; sigla?: string | null; cidade?: string | null }) {
  const nome = dados.nome?.trim() || '';
  const sigla = normalizarSlug(dados.sigla || '');
  const cidade = normalizarSlug(dados.cidade || '');
  const iniciais = iniciaisDoNome(nome);
  const nomeCompleto = slugSemLimite(nome);

  const candidatos: string[] = [];
  const add = (valor: string) => {
    // Candidato longo demais é descartado, não cortado no meio da palavra.
    const slug = slugSemLimite(valor);
    if (slug.length > SLUG_MAX) return;
    if (slug && !validarSlug(slug) && !candidatos.includes(slug)) candidatos.push(slug);
  };

  if (sigla) add(sigla);
  if (iniciais.length >= 2) add(iniciais);
  if (sigla && cidade) add(`${sigla}-${cidade}`);
  if (iniciais.length >= 2 && cidade) add(`${iniciais}-${cidade}`);
  add(nomeCompleto);
  if (cidade) add(`${nomeCompleto}-${cidade}`);

  const base = candidatos[0] || iniciais || nomeCompleto || 'igreja';
  for (let n = 2; candidatos.length < 8 && n < 20; n += 1) add(`${base}-${n}`);

  return candidatos;
}
