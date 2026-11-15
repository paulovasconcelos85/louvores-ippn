import { describe, expect, it, vi } from 'vitest';

vi.mock('./admin-config', () => ({
  ADMIN_EMAILS: ['dono@teste.invalid'],
}));

import {
  ehMembroComum,
  isCargoTipo,
  isSuperAdmin,
  podeAcessarAdmin,
  podeEditarLiturgiaCompleta,
  podeEditarLouvor,
  podeEditarRecursosMultimidia,
  podeGerenciarCanticos,
  podeGerenciarCultos,
  podeGerenciarEscalasComTags,
  podeGerenciarEventos,
  podeGerenciarUsuarios,
  podeGerenciarUsuariosComTags,
  podePastorearMembros,
  type TagPermissao,
} from '@/lib/permissions';

function tag(nome: string, categoria: string): TagPermissao {
  return { id: nome, nome, categoria };
}

const LIDER_LOUVOR = tag('Líder de Louvor', 'louvor_lideranca');
const VIOLAO = tag('Violão', 'louvor_instrumento');
const MESA_DE_SOM = tag('Mesa de Som', 'tecnico_audio');
const SECRETARIA = tag('Secretário(a)', 'secretaria');
const RECEPCAO = tag('Recepção', 'apoio_geral');

describe('isCargoTipo', () => {
  it('aceita só cargos do enum do banco', () => {
    expect(isCargoTipo('pastor')).toBe(true);
    expect(isCargoTipo('superadmin')).toBe(true);
    expect(isCargoTipo('papa')).toBe(false);
    expect(isCargoTipo(null)).toBe(false);
    expect(isCargoTipo(42)).toBe(false);
  });
});

describe('isSuperAdmin (admin da plataforma)', () => {
  it('reconhece o e-mail da lista, sem diferenciar maiúsculas', () => {
    expect(isSuperAdmin('dono@teste.invalid')).toBe(true);
    expect(isSuperAdmin('DONO@Teste.Invalid')).toBe(true);
  });

  it('recusa outros e-mails e e-mail vazio', () => {
    expect(isSuperAdmin('pastor@teste.invalid')).toBe(false);
    expect(isSuperAdmin('')).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe('acesso ao painel', () => {
  it('membro sem tags vai para a área simplificada', () => {
    expect(podeAcessarAdmin('membro')).toBe(false);
    expect(ehMembroComum('membro')).toBe(true);
  });

  it('membro com tag de louvor, técnica ou secretaria entra no painel', () => {
    for (const t of [VIOLAO, MESA_DE_SOM, SECRETARIA]) {
      expect(podeAcessarAdmin('membro', [t])).toBe(true);
      expect(ehMembroComum('membro', [t])).toBe(false);
    }
  });

  it('tag de apoio (recepção) não abre o painel', () => {
    expect(podeAcessarAdmin('membro', [RECEPCAO])).toBe(false);
    expect(ehMembroComum('membro', [RECEPCAO])).toBe(true);
  });

  it('cargos de liderança entram no painel', () => {
    for (const cargo of ['pastor', 'presbitero', 'seminarista', 'diacono', 'superadmin'] as const) {
      expect(podeAcessarAdmin(cargo)).toBe(true);
    }
  });

  it('sem cargo e sem tags não entra', () => {
    expect(podeAcessarAdmin(null)).toBe(false);
    expect(ehMembroComum(null)).toBe(false);
  });

  it('categoria com maiúsculas ou espaços ainda é reconhecida', () => {
    expect(podeAcessarAdmin('membro', [tag('Violão', '  Louvor_Instrumento ')])).toBe(true);
  });
});

describe('cultos, cânticos e escalas', () => {
  it('líder de louvor gerencia cultos, cânticos e escalas', () => {
    expect(podeGerenciarCultos('membro', [LIDER_LOUVOR])).toBe(true);
    expect(podeGerenciarCanticos('membro', [LIDER_LOUVOR])).toBe(true);
    expect(podeGerenciarEscalasComTags('membro', [LIDER_LOUVOR])).toBe(true);
  });

  it('técnico de som mexe em cultos, mas não em cânticos nem escalas', () => {
    expect(podeGerenciarCultos('membro', [MESA_DE_SOM])).toBe(true);
    expect(podeGerenciarCanticos('membro', [MESA_DE_SOM])).toBe(false);
    expect(podeGerenciarEscalasComTags('membro', [MESA_DE_SOM])).toBe(false);
  });

  it('membro comum não gerencia nada disso', () => {
    expect(podeGerenciarCultos('membro')).toBe(false);
    expect(podeGerenciarCanticos('membro')).toBe(false);
    expect(podeGerenciarEscalasComTags('membro')).toBe(false);
  });

  it('pastor gerencia escalas sem precisar de tag', () => {
    expect(podeGerenciarEscalasComTags('pastor')).toBe(true);
  });
});

describe('liturgia', () => {
  it('liturgia completa é só da liderança pastoral', () => {
    expect(podeEditarLiturgiaCompleta('pastor')).toBe(true);
    expect(podeEditarLiturgiaCompleta('seminarista')).toBe(true);
    expect(podeEditarLiturgiaCompleta('musico')).toBe(false);
    expect(podeEditarLiturgiaCompleta('membro')).toBe(false);
    expect(podeEditarLiturgiaCompleta(null)).toBe(false);
  });

  it('a parte do louvor também fica com quem tem tag de louvor', () => {
    expect(podeEditarLouvor('membro', [VIOLAO])).toBe(true);
    expect(podeEditarLouvor('membro', [MESA_DE_SOM])).toBe(false);
  });

  it('recursos multimídia: liderança pastoral ou líder de ministério', () => {
    expect(podeEditarRecursosMultimidia('pastor')).toBe(true);
    expect(podeEditarRecursosMultimidia('membro', [LIDER_LOUVOR])).toBe(true);
    expect(podeEditarRecursosMultimidia('membro', [VIOLAO])).toBe(false);
  });
});

describe('membros e usuários', () => {
  it('pastorear membros é da liderança pastoral, não do diácono nem do músico', () => {
    expect(podePastorearMembros('pastor')).toBe(true);
    expect(podePastorearMembros('presbitero')).toBe(true);
    expect(podePastorearMembros('diacono')).toBe(false);
    expect(podePastorearMembros('musico')).toBe(false);
    expect(podePastorearMembros(null)).toBe(false);
  });

  it('gerenciar usuários: admin, superadmin ou o dono da plataforma', () => {
    expect(podeGerenciarUsuarios('admin')).toBe(true);
    expect(podeGerenciarUsuarios('superadmin')).toBe(true);
    expect(podeGerenciarUsuarios('pastor')).toBe(false);
    expect(podeGerenciarUsuarios('membro', 'dono@teste.invalid')).toBe(true);
    expect(podeGerenciarUsuarios(null, 'outro@teste.invalid')).toBe(false);
  });

  it('com tags: pastor, presbítero e secretaria também gerenciam', () => {
    expect(podeGerenciarUsuariosComTags('pastor')).toBe(true);
    expect(podeGerenciarUsuariosComTags('presbitero')).toBe(true);
    expect(podeGerenciarUsuariosComTags('membro', [SECRETARIA])).toBe(true);
    expect(podeGerenciarUsuariosComTags(null, [SECRETARIA])).toBe(true);
    expect(podeGerenciarUsuariosComTags('membro', [LIDER_LOUVOR])).toBe(false);
    expect(podeGerenciarUsuariosComTags('diacono')).toBe(false);
  });

  it('eventos: liderança ou secretaria', () => {
    expect(podeGerenciarEventos('pastor')).toBe(true);
    expect(podeGerenciarEventos('membro', [SECRETARIA])).toBe(true);
    expect(podeGerenciarEventos('membro', [LIDER_LOUVOR])).toBe(false);
  });
});
