// Calendário litúrgico ocidental: calcula a temporada atual a partir da Páscoa
// (algoritmo de Meeus/Jones/Butcher) e do primeiro domingo do Advento.
// Sem tabela no banco — tudo derivado por data.

export type TemporadaId =
  | 'advento'
  | 'natal'
  | 'epifania'
  | 'quaresma'
  | 'pascoa'
  | 'pentecostes'
  | 'tempoComum';

export const ORDEM_TEMPORADAS: TemporadaId[] = [
  'advento',
  'natal',
  'epifania',
  'quaresma',
  'pascoa',
  'pentecostes',
  'tempoComum',
];

// Aproximação visual das cores litúrgicas tradicionais (branco/dourado vira
// dourado aqui, pra aparecer num círculo de cor sobre fundo claro).
export const CORES_TEMPORADAS: Record<TemporadaId, string> = {
  advento: '#5b2d8e',
  natal: '#c9a227',
  epifania: '#1a7a3c',
  quaresma: '#5b2d8e',
  pascoa: '#c9a227',
  pentecostes: '#b3121b',
  tempoComum: '#1a7a3c',
};

function dataUtc(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data: Date, dias: number): Date {
  const resultado = new Date(data.getTime());
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

// Domingo de Páscoa (calendário gregoriano), algoritmo de Meeus/Jones/Butcher.
export function easterSunday(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return dataUtc(ano, mes, dia);
}

// Primeiro domingo do Advento: o domingo entre 27/nov e 3/dez.
export function firstSundayOfAdvent(ano: number): Date {
  const base = dataUtc(ano, 11, 27);
  for (let offset = 0; offset < 7; offset += 1) {
    const data = somarDias(base, offset);
    if (data.getUTCDay() === 0) return data;
  }
  throw new Error(`Não foi possível calcular o Advento de ${ano}`);
}

interface JanelaTemporada {
  id: TemporadaId;
  inicio: Date;
  fim: Date; // exclusivo
}

// O "ano litúrgico" começa no Advento (ano civil Y) e vai até a véspera do
// próximo Advento (já no ano civil Y+1) — por isso o cálculo é sempre feito
// a partir do Advento que já passou (ou está passando) em relação à data.
function anoDoAdventoVigente(data: Date): number {
  const ano = data.getUTCFullYear();
  return data.getTime() >= firstSundayOfAdvent(ano).getTime() ? ano : ano - 1;
}

function construirJanelas(anoAdvento: number): JanelaTemporada[] {
  const anoSeguinte = anoAdvento + 1;
  const pascoa = easterSunday(anoSeguinte);
  const quartaCinzas = somarDias(pascoa, -46);
  const pentecostes = somarDias(pascoa, 49);
  const natal = dataUtc(anoAdvento, 12, 25);
  const epifania = dataUtc(anoSeguinte, 1, 6);

  return [
    { id: 'advento', inicio: firstSundayOfAdvent(anoAdvento), fim: natal },
    { id: 'natal', inicio: natal, fim: epifania },
    { id: 'epifania', inicio: epifania, fim: quartaCinzas },
    { id: 'quaresma', inicio: quartaCinzas, fim: pascoa },
    { id: 'pascoa', inicio: pascoa, fim: pentecostes },
    { id: 'pentecostes', inicio: pentecostes, fim: somarDias(pentecostes, 1) },
    { id: 'tempoComum', inicio: somarDias(pentecostes, 1), fim: firstSundayOfAdvent(anoSeguinte) },
  ];
}

export interface TemporadaAtual {
  id: TemporadaId;
  inicio: Date;
  fim: Date;
}

export function obterTemporadaAtual(data: Date = new Date()): TemporadaAtual {
  const anoAdvento = anoDoAdventoVigente(data);
  const janelas = construirJanelas(anoAdvento);
  const atual = janelas.find(
    (janela) => data.getTime() >= janela.inicio.getTime() && data.getTime() < janela.fim.getTime()
  );
  return atual || janelas[janelas.length - 1];
}

export function obterTodasAsTemporadas(data: Date = new Date()): TemporadaAtual[] {
  const anoAdvento = anoDoAdventoVigente(data);
  return construirJanelas(anoAdvento);
}
