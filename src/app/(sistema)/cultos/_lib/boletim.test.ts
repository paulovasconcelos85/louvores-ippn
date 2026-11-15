import { describe, expect, it } from 'vitest';
import {
  agruparItensLiturgia,
  buildBoletimFallbackRows,
  buildBoletimSecoesEstruturadasPorCulto,
  buildBoletimSecoesFromFallbackRows,
  buildLiturgiaMetaRow,
  parseAgendaConteudo,
  parseAvisoConteudo,
  parseInformativoConteudo,
  serializeAgendaConteudo,
  serializeAvisoConteudo,
  updateLocalizedDraftValue,
} from './boletim';
import { BOLETIM_FALLBACK_TIPO_PREFIX, LITURGIA_META_TIPO, type BoletimSecaoRascunho, type LouvorItemRow, type LouvorItemRowComCantico } from './tipos';

function mapa(pt: string, es = '', en = '') {
  return { pt, es, en };
}

describe('agenda', () => {
  it('lê e grava data, hora e descrição', () => {
    const item = parseAgendaConteudo('2026-12-24|19:30|Culto de Natal');
    expect(item).toMatchObject({ data: '2026-12-24', hora: '19:30', descricao: 'Culto de Natal', temHora: true });
    expect(serializeAgendaConteudo(item)).toBe('2026-12-24|19:30|Culto de Natal');
  });

  it('00:00 significa evento sem horário', () => {
    const item = parseAgendaConteudo('2026-12-31|00:00|Vigília');
    expect(item.temHora).toBe(false);
    expect(serializeAgendaConteudo(item)).toBe('2026-12-31|00:00|Vigília');
  });

  it('descrição pode conter a barra vertical', () => {
    const item = parseAgendaConteudo('2026-12-24|19:30|Ceia | Cantata');
    expect(item.descricao).toBe('Ceia | Cantata');
  });

  it('texto livre antigo vira descrição, com data e hora padrão', () => {
    const item = parseAgendaConteudo('Reunião de oração na quarta');
    expect(item.descricao).toBe('Reunião de oração na quarta');
    expect(item.hora).toBe('09:00');
    expect(item.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('avisos e informativos', () => {
  it('título e corpo separados por linha em branco', () => {
    const aviso = parseAvisoConteudo('Ceia do Senhor\n\nDomingo que vem.\nTragam visitantes.');
    expect(aviso.titulo).toBe('Ceia do Senhor');
    expect(aviso.corpo).toBe('Domingo que vem.\nTragam visitantes.');
    expect(parseAvisoConteudo(serializeAvisoConteudo(aviso))).toMatchObject({ titulo: aviso.titulo, corpo: aviso.corpo });
  });

  it('sem linha em branco, a primeira linha é o título', () => {
    const info = parseInformativoConteudo('Mudança de horário\nA EBD começa às 9h.');
    expect(info.titulo).toBe('Mudança de horário');
    expect(info.corpo).toBe('A EBD começa às 9h.');
  });

  it('texto vazio vira aviso vazio', () => {
    expect(parseAvisoConteudo('   ')).toMatchObject({ titulo: '', corpo: '' });
  });
});

describe('updateLocalizedDraftValue', () => {
  it('ao digitar em inglês sem texto em português, espelha no pt', () => {
    expect(updateLocalizedDraftValue(null, 'en', 'Welcome')).toEqual(mapa('Welcome', '', 'Welcome'));
  });

  it('não sobrescreve o português que já existe', () => {
    expect(updateLocalizedDraftValue(mapa('Bem-vindo'), 'en', 'Welcome')).toEqual(mapa('Bem-vindo', '', 'Welcome'));
  });
});

describe('boletim gravado em louvor_itens (formato legado)', () => {
  const secoes: BoletimSecaoRascunho[] = [
    {
      id: 's1',
      tipo: 'avisos',
      titulo: 'Avisos',
      titulo_i18n: mapa('Avisos', 'Avisos', 'Announcements'),
      icone: null,
      visivel: true,
      ordem: 0,
      itens: [
        { id: 'i1', conteudo: 'Ceia no domingo', conteudo_i18n: mapa('Ceia no domingo', '', 'Communion on Sunday'), destaque: true },
        { id: 'i2', conteudo: '   ', conteudo_i18n: mapa(''), destaque: false },
        { id: 'i3', conteudo: 'Bazar', conteudo_i18n: mapa('Bazar'), destaque: false, imagem_url: 'https://exemplo.invalid/bazar.png' },
      ],
    },
    {
      id: 's2',
      tipo: 'oracao',
      titulo: 'Pedidos de Oração',
      titulo_i18n: mapa('Pedidos de Oração'),
      icone: 'hands.sparkles',
      visivel: false,
      ordem: 1,
      itens: [{ id: 'i4', conteudo: 'Pela família Silva', conteudo_i18n: mapa('Pela família Silva'), destaque: false }],
    },
  ];

  function comoLinhasDoBanco(): LouvorItemRow[] {
    return buildBoletimFallbackRows(secoes, 10).map((row, index) => ({
      id: `row-${index}`,
      culto_id: 1,
      ordem: row.ordem,
      tipo: row.tipo,
      tom: null,
      cantico_id: null,
      conteudo_publico: row.conteudo_publico,
      conteudo_publico_i18n: row.conteudo_publico_i18n,
      descricao: row.descricao,
      horario: null,
    }));
  }

  it('gera uma linha por item preenchido, com ordem a partir da inicial', () => {
    const rows = buildBoletimFallbackRows(secoes, 10);
    expect(rows.map((r) => r.ordem)).toEqual([10, 11, 12]);
    expect(rows.map((r) => r.tipo)).toEqual([
      `${BOLETIM_FALLBACK_TIPO_PREFIX}avisos`,
      `${BOLETIM_FALLBACK_TIPO_PREFIX}avisos`,
      `${BOLETIM_FALLBACK_TIPO_PREFIX}oracao`,
    ]);
  });

  it('ida e volta preserva seções, itens, destaque, imagem e visibilidade', () => {
    const lidas = buildBoletimSecoesFromFallbackRows(comoLinhasDoBanco(), 'pt');

    expect(lidas.map((s) => [s.tipo, s.titulo, s.visivel])).toEqual([
      ['avisos', 'Avisos', true],
      ['oracao', 'Pedidos de Oração', false],
    ]);
    expect(lidas[0].itens.map((i) => [i.conteudo, i.destaque, i.imagem_url])).toEqual([
      ['Ceia no domingo', true, null],
      ['Bazar', false, 'https://exemplo.invalid/bazar.png'],
    ]);
  });

  it('ao ler em inglês usa a tradução e cai para o português quando falta', () => {
    const lidas = buildBoletimSecoesFromFallbackRows(comoLinhasDoBanco(), 'en');
    expect(lidas[0].titulo).toBe('Announcements');
    expect(lidas[0].itens.map((i) => i.conteudo)).toEqual(['Communion on Sunday', 'Bazar']);
    expect(lidas[1].titulo).toBe('Pedidos de Oração');
  });

  it('ignora linhas com metadados corrompidos', () => {
    const rows = comoLinhasDoBanco();
    rows[0] = { ...rows[0], descricao: '{não é json' };
    const lidas = buildBoletimSecoesFromFallbackRows(rows, 'pt');
    expect(lidas[0].itens.map((i) => i.conteudo)).toEqual(['Bazar']);
  });
});

describe('boletim estruturado (boletim_secoes / boletim_itens)', () => {
  it('agrupa por culto, ordena seções e itens e resolve o idioma', () => {
    const porCulto = buildBoletimSecoesEstruturadasPorCulto(
      [
        { id: 'b', igreja_id: 'x', culto_id: 7, tipo: 'agenda', titulo: 'Agenda', titulo_i18n: { pt: 'Agenda', en: 'Schedule' }, icone: null, ordem: 2, visivel: null },
        { id: 'a', igreja_id: 'x', culto_id: 7, tipo: 'avisos', titulo: 'Avisos', icone: null, ordem: 1, visivel: false },
        { id: 'c', igreja_id: 'x', culto_id: 8, tipo: 'outro', titulo: 'Outros', icone: null, ordem: 1, visivel: true },
        { id: 'orfa', igreja_id: 'x', culto_id: null, tipo: 'outro', titulo: 'Sem culto', icone: null, ordem: 1, visivel: true },
      ],
      [
        { id: 'a2', secao_id: 'a', conteudo: 'Segundo', destaque: null, ordem: 2 },
        { id: 'a1', secao_id: 'a', conteudo: 'Primeiro', destaque: true, ordem: 1 },
        { id: 'b1', secao_id: 'b', conteudo: 'Ensaio', conteudo_i18n: { en: 'Rehearsal' }, destaque: false, ordem: 1 },
      ],
      'en'
    );

    expect([...porCulto.keys()].sort()).toEqual([7, 8]);
    const culto7 = porCulto.get(7)!;
    expect(culto7.map((s) => [s.id, s.titulo, s.visivel, s.ordem])).toEqual([
      ['a', 'Avisos', false, 0],
      ['b', 'Schedule', true, 1],
    ]);
    expect(culto7[0].itens.map((i) => [i.conteudo, i.destaque])).toEqual([
      ['Primeiro', true],
      ['Segundo', false],
    ]);
    expect(culto7[1].itens[0].conteudo).toBe('Rehearsal');
  });
});

describe('liturgia', () => {
  it('nome da liturgia vazio não gera linha', () => {
    expect(buildLiturgiaMetaRow('   ', mapa(''))).toBeNull();
    expect(buildLiturgiaMetaRow('Culto Vespertino', mapa('Culto Vespertino'))).toMatchObject({
      tipo: LITURGIA_META_TIPO,
      conteudo_publico: 'Culto Vespertino',
      ordem: 0,
    });
  });

  it('junta cânticos seguidos do mesmo momento e ignora linhas internas', () => {
    function item(id: string, tipo: string, cantico: string | null, tom: string | null = null): LouvorItemRowComCantico {
      return {
        id,
        culto_id: 1,
        ordem: null,
        tipo,
        tom,
        cantico_id: null,
        conteudo_publico: null,
        descricao: null,
        horario: null,
        canticos: cantico ? { nome: cantico } : null,
      };
    }

    const agrupados = agruparItensLiturgia([
      item('m', LITURGIA_META_TIPO, null),
      item('1', 'Adoração', 'Santo, Santo, Santo', 'D'),
      item('2', 'Adoração', 'Castelo Forte', 'C'),
      item('3', `${BOLETIM_FALLBACK_TIPO_PREFIX}avisos`, null),
      item('4', 'Leitura', null),
      item('5', 'Adoração', 'Grandioso És Tu', 'G'),
    ]);

    expect(agrupados.map((g) => [g.tipo, g.canticos.map((c) => `${c.nome} (${c.tom})`)])).toEqual([
      ['Adoração', ['Santo, Santo, Santo (D)', 'Castelo Forte (C)']],
      ['Leitura', []],
      ['Adoração', ['Grandioso És Tu (G)']],
    ]);
  });
});
