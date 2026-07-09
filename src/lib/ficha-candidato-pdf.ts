import { jsPDF } from 'jspdf';

// Dados da pessoa necessários para preencher a "Ficha de Candidato à
// Membresia" da IPB/IPM. Mantido como um tipo próprio (em vez de importar o
// `Membro` de MembroDetalhe.tsx) para este módulo não depender de um
// componente React.
export interface FichaCandidatoPessoa {
  nome: string;
  apelido: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  data_nascimento: string | null;
  naturalidade_cidade: string | null;
  naturalidade_uf: string | null;
  sexo: 'M' | 'F' | null;
  nacionalidade: string | null;
  pais_origem: string | null;
  logradouro: string | null;
  endereco_completo: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  escolaridade: string | null;
  profissao: string | null;
  atividade_atual: string | null;
  estado_civil: string | null;
  uniao_estavel_tempo: string | null;
  conjuge_nome: string | null;
  conjuge_religiao: string | null;
  igreja_sede_congregacao: string | null;
  congregacao_nome: string | null;
  grupo_familiar_nome: string | null;
  grupo_familiar_lider: string | null;
  proposito_entrevista: string | null;
  transferido_ipb: boolean | null;
  transferencia_ipb_origem: string | null;
  transferido_outra_denominacao: string | null;
  transferencia_jurisdicao_sem_carta: string | null;
  transferencia_observacao: string | null;
  data_batismo: string | null;
  data_profissao_fe: string | null;
  cursos_discipulado: string[] | null;
  assinatura_ficha: string | null;
  assinatura_ficha_em: string | null;
}

export interface GerarFichaCandidatoOpts {
  tr: (pt: string, es: string, en: string) => string;
  intlLocale: string;
  igrejaNome?: string | null;
  /** Nome do pastor/responsável que confirma a ficha (quem assina, não o candidato). */
  assinanteNome?: string | null;
}

const COR_HEADER: [number, number, number] = [16, 60, 48];
const COR_BORDA: [number, number, number] = [100, 100, 100];
const COR_LABEL: [number, number, number] = [110, 110, 110];
const COR_TEXTO: [number, number, number] = [20, 20, 20];

function formatarDataPt(data: string | null): string {
  if (!data) return '';
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function gerarFichaCandidatoPdf(pessoa: FichaCandidatoPessoa, opts: GerarFichaCandidatoOpts) {
  const { tr, igrejaNome } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const contentW = pw - marginX * 2;
  let y = 0;

  // ── Cabeçalho ──────────────────────────────────────────────────────────
  const headerH = 16;
  doc.setFillColor(...COR_HEADER);
  doc.rect(0, 0, pw, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(tr('FICHA DE CANDIDATO À MEMBRESIA', 'FICHA DE CANDIDATO A MEMBRESÍA', 'MEMBERSHIP CANDIDATE FORM'), marginX, 10);
  if (igrejaNome) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(igrejaNome, pw - marginX, 10, { align: 'right' });
  }
  doc.setTextColor(...COR_TEXTO);
  y = headerH + 6;

  // ── Helpers de desenho ────────────────────────────────────────────────
  const sectionTitle = (numero: number, texto: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...COR_HEADER);
    doc.text(`${numero} - ${texto}`, marginX, y);
    doc.setTextColor(...COR_TEXTO);
    y += 4.5;
  };

  // Desenha uma "célula" com rótulo pequeno em cima e valor embaixo.
  const campo = (x: number, w: number, h: number, label: string, valor: string) => {
    doc.setDrawColor(...COR_BORDA);
    doc.rect(x, y, w, h);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COR_LABEL);
    doc.text(label, x + 1.5, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COR_TEXTO);
    const linhas = doc.splitTextToSize(valor || '', w - 3) as string[];
    doc.text(linhas.slice(0, Math.max(1, Math.floor((h - 4) / 4))), x + 1.5, y + 7.5);
  };

  // Uma linha só com várias células lado a lado, altura fixa.
  const linhaCampos = (celulas: { w: number; label: string; valor: string }[], h = 11) => {
    let x = marginX;
    for (const c of celulas) {
      campo(x, c.w, h, c.label, c.valor);
      x += c.w;
    }
    y += h;
  };

  // Linha de opções tipo checkbox (quadrado marcado/vazio + rótulo).
  const linhaOpcoes = (
    opcoes: { label: string; marcado: boolean }[],
    h = 6
  ) => {
    doc.setDrawColor(...COR_BORDA);
    doc.rect(marginX, y, contentW, h);
    let x = marginX + 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const opt of opcoes) {
      const boxSize = 3;
      const boxY = y + h / 2 - boxSize / 2;
      doc.rect(x, boxY, boxSize, boxSize);
      if (opt.marcado) {
        doc.setLineWidth(0.5);
        doc.line(x + 0.4, boxY + 1.5, x + 1.2, boxSize + boxY - 0.4);
        doc.line(x + 1.2, boxSize + boxY - 0.4, x + boxSize - 0.3, boxY + 0.3);
        doc.setLineWidth(0.2);
      }
      const textX = x + boxSize + 1.5;
      doc.setTextColor(...COR_TEXTO);
      doc.text(opt.label, textX, y + h / 2 + 1.2);
      x = textX + doc.getTextWidth(opt.label) + 6;
    }
    y += h;
  };

  const blankBox = (h: number, label: string) => {
    doc.setDrawColor(...COR_BORDA);
    doc.rect(marginX, y, contentW, h);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...COR_LABEL);
    doc.text(label, marginX + 1.5, y + 3.5);
    doc.setTextColor(...COR_TEXTO);
    y += h;
  };

  // ── 1. Dados Pessoais ─────────────────────────────────────────────────
  sectionTitle(1, tr('Dados Pessoais', 'Datos Personales', 'Personal Data'));

  linhaCampos([{ w: contentW, label: tr('Nome completo', 'Nombre completo', 'Full name'), valor: pessoa.nome + (pessoa.apelido ? ` "${pessoa.apelido}"` : '') }]);
  linhaCampos([{ w: contentW, label: tr('Nome do pai', 'Nombre del padre', "Father's name"), valor: pessoa.nome_pai || '' }]);
  linhaCampos([{ w: contentW, label: tr('Nome da mãe', 'Nombre de la madre', "Mother's name"), valor: pessoa.nome_mae || '' }]);
  linhaCampos([
    { w: contentW * 0.3, label: tr('Data de nascimento', 'Fecha de nacimiento', 'Birth date'), valor: formatarDataPt(pessoa.data_nascimento) },
    { w: contentW * 0.55, label: tr('Naturalidade', 'Ciudad de nacimiento', 'Birth city'), valor: pessoa.naturalidade_cidade || '' },
    { w: contentW * 0.15, label: 'UF', valor: pessoa.naturalidade_uf || '' },
  ]);

  linhaOpcoes([
    { label: tr('Masculino', 'Masculino', 'Male'), marcado: pessoa.sexo === 'M' },
    { label: tr('Feminino', 'Femenino', 'Female'), marcado: pessoa.sexo === 'F' },
  ]);
  const estrangeiro = !!pessoa.nacionalidade && pessoa.nacionalidade.trim().toLowerCase() !== 'brasileira';
  linhaOpcoes([
    { label: tr('Brasileira', 'Brasileña', 'Brazilian'), marcado: !estrangeiro },
    { label: tr('Estrangeira', 'Extranjera', 'Foreign'), marcado: estrangeiro },
  ]);
  if (estrangeiro) {
    linhaCampos([{ w: contentW, label: tr('País de origem', 'País de origen', 'Country of origin'), valor: pessoa.pais_origem || pessoa.nacionalidade || '' }]);
  }

  linhaCampos([{ w: contentW, label: tr('Endereço', 'Dirección', 'Address'), valor: pessoa.logradouro || pessoa.endereco_completo || '' }]);
  linhaCampos([
    { w: contentW * 0.4, label: tr('Bairro', 'Barrio', 'Neighborhood'), valor: pessoa.bairro || '' },
    { w: contentW * 0.15, label: 'UF', valor: pessoa.uf || '' },
    { w: contentW * 0.3, label: tr('Cidade', 'Ciudad', 'City'), valor: pessoa.cidade || '' },
    { w: contentW * 0.15, label: 'CEP', valor: pessoa.cep || '' },
  ]);
  linhaCampos([
    { w: contentW * 0.5, label: tr('Telefone', 'Teléfono', 'Phone'), valor: pessoa.telefone || '' },
    { w: contentW * 0.5, label: 'Email', valor: pessoa.email || '' },
  ]);

  const escolaridadeLabel: Record<string, string> = {
    fundamental_incompleto: tr('Fund. incompleto', 'Primaria incompleta', 'Elementary incomplete'),
    fundamental_completo: tr('Fundamental', 'Primaria', 'Elementary'),
    medio_incompleto: tr('Médio incompleto', 'Secundaria incompleta', 'High school incomplete'),
    medio_completo: tr('Médio', 'Secundaria', 'High school'),
    superior_incompleto: tr('Superior incompleto', 'Universidad incompleta', 'College incomplete'),
    superior_completo: tr('Superior', 'Universidad', 'College'),
    pos_graduacao: tr('Pós-graduação', 'Posgrado', 'Postgraduate'),
    mestrado: tr('Mestrado', 'Maestría', "Master's"),
    doutorado: tr('Doutorado', 'Doctorado', 'Doctorate'),
  };
  linhaOpcoes([
    { label: tr('Fundamental', 'Primaria', 'Elementary'), marcado: !!pessoa.escolaridade?.startsWith('fundamental') },
    { label: tr('Médio', 'Secundaria', 'High school'), marcado: !!pessoa.escolaridade?.startsWith('medio') },
    { label: tr('Superior', 'Universidad', 'College'), marcado: !!pessoa.escolaridade?.startsWith('superior') },
    { label: tr('Mestrado', 'Maestría', "Master's"), marcado: pessoa.escolaridade === 'mestrado' },
    { label: tr('Doutorado', 'Doctorado', 'Doctorate'), marcado: pessoa.escolaridade === 'doutorado' },
  ]);
  if (pessoa.escolaridade) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...COR_LABEL);
    doc.text(escolaridadeLabel[pessoa.escolaridade] || pessoa.escolaridade, marginX + 1.5, y + 3);
    doc.setTextColor(...COR_TEXTO);
    y += 4;
  }

  linhaCampos([
    { w: contentW * 0.5, label: tr('Profissão', 'Profesión', 'Profession'), valor: pessoa.profissao || '' },
    { w: contentW * 0.5, label: tr('Atividade atual', 'Actividad actual', 'Current activity'), valor: pessoa.atividade_atual || '' },
  ]);

  linhaOpcoes([
    { label: tr('Solteiro(a)', 'Soltero(a)', 'Single'), marcado: pessoa.estado_civil === 'solteiro' },
    { label: tr('Casado(a) civilmente', 'Casado(a) civilmente', 'Civilly married'), marcado: pessoa.estado_civil === 'casado' },
    { label: tr('União estável', 'Unión estable', 'Civil union'), marcado: pessoa.estado_civil === 'uniao_estavel' },
    {
      label:
        pessoa.estado_civil === 'divorciado' || pessoa.estado_civil === 'viuvo'
          ? tr('Outros:', 'Otros:', 'Other:') + ' ' + (pessoa.estado_civil === 'divorciado' ? tr('Divorciado(a)', 'Divorciado(a)', 'Divorced') : tr('Viúvo(a)', 'Viudo(a)', 'Widowed'))
          : tr('Outros', 'Otros', 'Other'),
      marcado: pessoa.estado_civil === 'divorciado' || pessoa.estado_civil === 'viuvo',
    },
  ]);
  if (pessoa.estado_civil === 'uniao_estavel' && pessoa.uniao_estavel_tempo) {
    linhaCampos([{ w: contentW, label: tr('União estável há quanto tempo?', '¿Hace cuánto tiempo?', 'How long?'), valor: pessoa.uniao_estavel_tempo }]);
  }
  if (pessoa.estado_civil === 'casado' || pessoa.estado_civil === 'uniao_estavel') {
    linhaCampos([
      { w: contentW * 0.6, label: tr('Nome completo do cônjuge', 'Nombre completo del cónyuge', 'Full spouse name'), valor: pessoa.conjuge_nome || '' },
      { w: contentW * 0.4, label: tr('Religião do cônjuge', 'Religión del cónyuge', "Spouse's religion"), valor: pessoa.conjuge_religiao || '' },
    ]);
  }

  y += 2;

  // ── 2. Igreja Sede / Congregação / Grupo Familiar ────────────────────
  sectionTitle(2, tr('Igreja Sede / Congregação / Grupo Familiar', 'Iglesia Sede / Congregación / Grupo Familiar', 'Main Church / Congregation / Family Group'));
  linhaOpcoes([
    { label: tr('Igreja Sede (Central ou Pedras Vivas)', 'Iglesia Sede (Central o Pedras Vivas)', 'Main Church (Central or Pedras Vivas)'), marcado: pessoa.igreja_sede_congregacao === 'sede' },
    { label: tr('Congregação em Manaus', 'Congregación en Manaus', 'Congregation in Manaus'), marcado: pessoa.igreja_sede_congregacao === 'congregacao_manaus' },
  ]);
  linhaOpcoes([
    { label: tr('Congregação no Interior', 'Congregación en el interior', 'Congregation in the countryside'), marcado: pessoa.igreja_sede_congregacao === 'congregacao_interior' },
  ]);
  if (pessoa.igreja_sede_congregacao && pessoa.igreja_sede_congregacao !== 'sede' && pessoa.congregacao_nome) {
    linhaCampos([{ w: contentW, label: tr('Qual?', '¿Cuál?', 'Which one?'), valor: pessoa.congregacao_nome }]);
  }
  linhaCampos([
    { w: contentW * 0.5, label: tr('Nome do Grupo familiar', 'Nombre del Grupo familiar', 'Family Group name'), valor: pessoa.grupo_familiar_nome || '' },
    { w: contentW * 0.5, label: tr('Nome do Líder', 'Nombre del Líder', "Leader's name"), valor: pessoa.grupo_familiar_lider || '' },
  ]);

  y += 2;

  // ── 3. Propósito da entrevista/exame ─────────────────────────────────
  sectionTitle(3, tr('Propósito da entrevista/exame', 'Propósito de la entrevista/examen', 'Purpose of the interview/exam'));
  linhaOpcoes([
    { label: tr('Batismo Infantil', 'Bautismo Infantil', 'Infant Baptism'), marcado: pessoa.proposito_entrevista === 'batismo_infantil' },
    { label: tr('Profissão de Fé', 'Profesión de Fe', 'Profession of Faith'), marcado: pessoa.proposito_entrevista === 'profissao_fe' },
    { label: tr('Profissão de Fé e Batismo', 'Profesión de Fe y Bautismo', 'Profession of Faith and Baptism'), marcado: pessoa.proposito_entrevista === 'profissao_fe_e_batismo' },
  ]);
  linhaOpcoes([
    {
      label: tr('Transferência entre Presbiterianas - IPB (com carta)', 'Transferencia entre Presbiterianas - IPB (con carta)', 'Transfer between Presbyterians - IPB (with letter)'),
      marcado: !!pessoa.transferido_ipb,
    },
  ]);
  if (pessoa.transferido_ipb && pessoa.transferencia_ipb_origem) {
    linhaCampos([{ w: contentW, label: tr('Qual?', '¿Cuál?', 'Which one?'), valor: pessoa.transferencia_ipb_origem }]);
  }
  linhaOpcoes([
    {
      label: tr('Transferência de outra denominação', 'Transferencia de otra denominación', 'Transfer from another denomination'),
      marcado: !!pessoa.transferido_outra_denominacao,
    },
  ]);
  if (pessoa.transferido_outra_denominacao) {
    linhaCampos([{ w: contentW, label: tr('Qual?', '¿Cuál?', 'Which one?'), valor: pessoa.transferido_outra_denominacao }]);
  }
  linhaOpcoes([
    {
      label: tr('Transferência por jurisdição (sem carta)', 'Transferencia por jurisdicción (sin carta)', 'Transfer by jurisdiction (no letter)'),
      marcado: !!pessoa.transferencia_jurisdicao_sem_carta,
    },
  ]);
  if (pessoa.transferencia_jurisdicao_sem_carta) {
    linhaCampos([{ w: contentW, label: tr('Qual a denominação?', '¿Cuál denominación?', 'Which denomination?'), valor: pessoa.transferencia_jurisdicao_sem_carta }]);
  }
  linhaCampos([
    { w: contentW * 0.33, label: tr('Data do Batismo', 'Fecha del Bautismo', 'Baptism date'), valor: formatarDataPt(pessoa.data_batismo) },
    { w: contentW * 0.34, label: tr('Data da Profissão de Fé', 'Fecha de Profesión de Fe', 'Profession of Faith date'), valor: formatarDataPt(pessoa.data_profissao_fe) },
    { w: contentW * 0.33, label: tr('Observação', 'Observación', 'Note'), valor: pessoa.transferencia_observacao || '' },
  ]);

  y += 2;

  // ── 4. Programa de discipulado concluído ─────────────────────────────
  sectionTitle(4, tr('Programa de discipulado concluído', 'Programa de discipulado concluido', 'Completed discipleship program'));
  const cursos = pessoa.cursos_discipulado || [];
  linhaOpcoes([
    { label: tr('Conhecendo a Jesus - 01', 'Conociendo a Jesús - 01', 'Knowing Jesus - 01'), marcado: cursos.includes('apostila_01') },
    { label: tr('Conhecendo a Nova Vida - 02', 'Conociendo la Nueva Vida - 02', 'Knowing the New Life - 02'), marcado: cursos.includes('apostila_02') },
    { label: tr('Conhecendo a Nossa Fé - 03', 'Conociendo Nuestra Fe - 03', 'Knowing Our Faith - 03'), marcado: cursos.includes('apostila_03') },
  ]);

  y += 2;

  // ── 5. Exclusivo para o Conselho da Igreja (em branco) ───────────────
  sectionTitle(5, tr('Exclusivo para o Conselho da Igreja', 'Exclusivo para el Consejo de la Iglesia', 'For Church Council use only'));
  linhaOpcoes([
    { label: tr('Aprovado', 'Aprobado', 'Approved'), marcado: false },
    { label: tr('Aguardar', 'Esperar', 'Wait'), marcado: false },
  ]);
  blankBox(9, tr('Nome completo do pastor/presbítero', 'Nombre completo del pastor/presbítero', "Pastor/elder's full name"));
  blankBox(9, tr('Assinatura', 'Firma', 'Signature'));
  linhaCampos([
    { w: contentW * 0.4, label: tr('Data desta entrevista', 'Fecha de esta entrevista', 'Date of this interview'), valor: '' },
    { w: contentW * 0.6, label: tr('Informações adicionais', 'Información adicional', 'Additional information'), valor: '' },
  ]);

  y += 2;

  // ── 6. Previsão para o recebimento (em branco) ───────────────────────
  sectionTitle(6, tr('Previsão para o recebimento', 'Previsión para la recepción', 'Expected reception'));
  linhaCampos([
    { w: contentW * 0.34, label: tr('Data', 'Fecha', 'Date'), valor: '' },
    { w: contentW * 0.33, label: tr('Horário', 'Horario', 'Time'), valor: '' },
    { w: contentW * 0.33, label: tr('Local', 'Lugar', 'Place'), valor: '' },
  ]);

  y += 4;

  // ── Declaração e assinatura do candidato (acréscimo nosso) ───────────
  const ph = doc.internal.pageSize.getHeight();
  if (y > ph - 45) {
    doc.addPage();
    y = 15;
  }
  doc.setDrawColor(...COR_BORDA);
  doc.line(marginX, y, pw - marginX, y);
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...COR_TEXTO);
  doc.text(
    tr(
      'Confirmo que as informações acima foram revisadas.',
      'Confirmo que la información anterior fue revisada.',
      'I confirm that the information above has been reviewed.'
    ),
    marginX,
    y
  );
  y += 6;

  const assinanteNome = opts.assinanteNome?.trim() || pessoa.nome;
  const assinaturaBoxH = 24;
  doc.setDrawColor(...COR_BORDA);
  doc.rect(marginX, y, contentW, assinaturaBoxH);
  if (pessoa.assinatura_ficha) {
    try {
      doc.addImage(pessoa.assinatura_ficha, 'PNG', marginX + 2, y + 2, 60, assinaturaBoxH - 8);
    } catch {
      // Se a imagem estiver corrompida/incompatível, apenas deixa a caixa em branco.
    }
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${assinanteNome} (${tr('Pastor/Presbítero', 'Pastor/Presbítero', 'Pastor/Elder')})`, marginX + 2, y + assinaturaBoxH - 2);
  if (pessoa.assinatura_ficha_em) {
    const dataAssinatura = new Date(pessoa.assinatura_ficha_em);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...COR_LABEL);
    doc.text(
      `${tr('Assinado digitalmente em', 'Firmado digitalmente el', 'Digitally signed on')} ${dataAssinatura.toLocaleString(opts.intlLocale)}`,
      pw - marginX - 2,
      y + assinaturaBoxH - 2,
      { align: 'right' }
    );
  }

  const nomeArquivo = `ficha-candidato-${pessoa.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
  doc.save(nomeArquivo);
}
