import type { Database } from '@/lib/database.types';
import type { Locale } from '@/i18n/config';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/api-response';
import { isSuperAdmin, type CargoTipo } from '@/lib/permissions';
import { getAuthenticatedUserFromServerCookies } from '@/lib/server-church';

// Operações de servidor do autoatendimento: criar igreja pela landing e
// acompanhar os primeiros passos da igreja recém-criada.

export function getSupabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function slugsOcupados(candidatos: string[]) {
  const lista = [...new Set(candidatos.filter(Boolean))];
  if (lista.length === 0) return new Set<string>();

  const { data, error } = await getSupabaseAdmin()
    .from('igrejas')
    .select('slug')
    .in('slug', lista);

  if (error) throw error;
  return new Set((data || []).map((row) => String(row.slug).toLowerCase()));
}

// Cargos que administram a própria igreja (dados, cultos, logo, endereço).
export const CARGOS_GESTAO_IGREJA: CargoTipo[] = ['admin', 'pastor'];

/** Igrejas em que o usuário autenticado tem cargo de gestão. */
export async function igrejasGerenciadasPor(user: { id: string; email?: string | null }) {
  const supabaseAdmin = getSupabaseAdmin();
  const email = user.email?.trim().toLowerCase();

  let { data: acesso, error } = await supabaseAdmin
    .from('usuarios_acesso')
    .select('id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!acesso && email) {
    ({ data: acesso, error } = await supabaseAdmin
      .from('usuarios_acesso')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle());
    if (error) throw error;
  }

  if (!acesso) return [] as string[];

  const { data: vinculos, error: vinculosError } = await supabaseAdmin
    .from('usuarios_igrejas')
    .select('igreja_id, cargo')
    .eq('usuario_id', acesso.id)
    .eq('ativo', true)
    .in('cargo', CARGOS_GESTAO_IGREJA);

  if (vinculosError) throw vinculosError;
  return (vinculos || []).map((vinculo) => vinculo.igreja_id as string);
}

// Superadmin gerencia todas; pastor/admin da igreja gerencia só a própria.
export async function verificarGestorIgreja(request: Request, igrejaId: string) {
  const user = await getAuthenticatedUserFromServerCookies(request);

  if (!user?.id) {
    return { error: apiError('UNAUTHENTICATED', 401, 'Usuário não autenticado.') };
  }

  if (isSuperAdmin(user.email)) {
    return { user, superAdmin: true };
  }

  const gerenciadas = await igrejasGerenciadasPor(user);
  if (!gerenciadas.includes(igrejaId)) {
    return { error: apiError('FORBIDDEN', 403, 'Sem permissão para gerenciar igrejas.') };
  }

  return { user, superAdmin: false };
}

// Liturgia inicial de toda igreja nova (editável em Dados da igreja). Sem ele,
// o editor de boletim cai no modelo legado, que tem anotações de uma igreja específica.
// Criada no idioma de quem cadastra a igreja.
export const MODELO_LITURGICO_INICIAL = [
  { bloco: 'Adoração', ordem: 1, tipo: 'Prelúdio', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Adoração', ordem: 2, tipo: 'Saudação e Acolhida à Igreja', descricao_padrao: 'Leitura bíblica de abertura\nOração de invocação', tem_cantico: false },
  { bloco: 'Adoração', ordem: 3, tipo: 'Cânticos Congregacionais', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Confissão', ordem: 4, tipo: 'Confissão de Pecados', descricao_padrao: 'Leitura bíblica e oração', tem_cantico: false },
  { bloco: 'Gratidão', ordem: 5, tipo: 'Dízimos e Ofertas', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Palavra', ordem: 6, tipo: 'Pregação da Palavra', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Envio', ordem: 7, tipo: 'Cântico Final', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Envio', ordem: 8, tipo: 'Oração Final e Bênção Apostólica', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Envio', ordem: 9, tipo: 'Lembretes', descricao_padrao: 'Apresentação dos visitantes\nAniversariantes', tem_cantico: false },
];

const MODELO_LITURGICO_INICIAL_ES: typeof MODELO_LITURGICO_INICIAL = [
  { bloco: 'Adoración', ordem: 1, tipo: 'Preludio', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Adoración', ordem: 2, tipo: 'Saludo y bienvenida a la iglesia', descricao_padrao: 'Lectura bíblica de apertura\nOración de invocación', tem_cantico: false },
  { bloco: 'Adoración', ordem: 3, tipo: 'Cánticos congregacionales', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Confesión', ordem: 4, tipo: 'Confesión de pecados', descricao_padrao: 'Lectura bíblica y oración', tem_cantico: false },
  { bloco: 'Gratitud', ordem: 5, tipo: 'Diezmos y ofrendas', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Palabra', ordem: 6, tipo: 'Predicación de la Palabra', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Envío', ordem: 7, tipo: 'Cántico final', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Envío', ordem: 8, tipo: 'Oración final y bendición apostólica', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Envío', ordem: 9, tipo: 'Anuncios', descricao_padrao: 'Presentación de los visitantes\nCumpleaños', tem_cantico: false },
];

const MODELO_LITURGICO_INICIAL_EN: typeof MODELO_LITURGICO_INICIAL = [
  { bloco: 'Worship', ordem: 1, tipo: 'Prelude', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Worship', ordem: 2, tipo: 'Call to Worship and Welcome', descricao_padrao: 'Opening Scripture reading\nPrayer of invocation', tem_cantico: false },
  { bloco: 'Worship', ordem: 3, tipo: 'Congregational Singing', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Confession', ordem: 4, tipo: 'Confession of Sin', descricao_padrao: 'Scripture reading and prayer', tem_cantico: false },
  { bloco: 'Thanksgiving', ordem: 5, tipo: 'Tithes and Offerings', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Word', ordem: 6, tipo: 'Preaching of the Word', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Sending', ordem: 7, tipo: 'Closing Hymn', descricao_padrao: '', tem_cantico: true },
  { bloco: 'Sending', ordem: 8, tipo: 'Closing Prayer and Benediction', descricao_padrao: '', tem_cantico: false },
  { bloco: 'Sending', ordem: 9, tipo: 'Announcements', descricao_padrao: 'Welcome of visitors\nBirthdays', tem_cantico: false },
];

export function modeloLiturgicoInicial(locale: Locale) {
  if (locale === 'en') return MODELO_LITURGICO_INICIAL_EN;
  if (locale === 'es') return MODELO_LITURGICO_INICIAL_ES;
  return MODELO_LITURGICO_INICIAL;
}
