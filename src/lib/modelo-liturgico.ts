import type { Locale } from '@/i18n/config';

// Liturgia inicial de toda igreja nova (editável em Dados da igreja), no idioma
// de quem cadastra a igreja. Também é o modelo usado pelo editor de boletim
// quando a igreja não tem um modelo configurado.
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
