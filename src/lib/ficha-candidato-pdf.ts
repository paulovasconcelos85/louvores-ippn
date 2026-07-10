import { jsPDF } from 'jspdf';
import { LOGO_IPM_DATA_URL, LOGO_IPM_ASPECT_RATIO } from '@/lib/logo-ipm';

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

// Pastor titular que confirma as fichas — usado como assinante padrão
// independentemente de quem estiver operando o sistema no momento.
export const NOME_PASTOR_PADRAO = 'Paulo Cesar Diniz de Araújo';

const COR_HEADER: [number, number, number] = [16, 60, 48];
const COR_BORDA: [number, number, number] = [90, 90, 90];
const COR_LABEL: [number, number, number] = [110, 110, 110];
const COR_TEXTO: [number, number, number] = [20, 20, 20];

function formatarDataPt(data: string | null): string {
  if (!data) return '';
  const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function gerarFichaCandidatoPdf(pessoa: FichaCandidatoPessoa, opts: GerarFichaCandidatoOpts) {
  const { tr } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const marginX = 8;
  const contentW = pw - marginX * 2;
  let y = 0;

  // ── Cabeçalho: barra verde com título + logo à direita (área branca) ────
  const headerH = 17;
  const logoAreaW = 44;
  doc.setFillColor(...COR_HEADER);
  doc.rect(0, 0, pw - logoAreaW, headerH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(tr('FICHA DE CANDIDATO À MEMBRESIA', 'FICHA DE CANDIDATO A MEMBRESÍA', 'MEMBERSHIP CANDIDATE FORM'), marginX, headerH / 2 + 2.7);
  doc.setTextColor(...COR_TEXTO);
  try {
    const logoH = 12;
    const logoW = logoH * LOGO_IPM_ASPECT_RATIO;
    const logoX = pw - logoAreaW + (logoAreaW - logoW) / 2;
    doc.addImage(LOGO_IPM_DATA_URL, 'PNG', logoX, (headerH - logoH) / 2, logoW, logoH);
  } catch {
    // Se a imagem não puder ser carregada, segue sem o logo.
  }
  y = headerH + 5;

  // ── Helpers de desenho ────────────────────────────────────────────────
  const sectionTitle = (numero: number, texto: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${numero} - ${texto}`, marginX, y);
    y += 4.5;
  };

  const proximaSecao = () => {
    y += 3;
  };

  // Célula com rótulo pequeno em cima e valor embaixo (campo "de escrever").
  const campo = (x: number, w: number, h: number, label: string, valor: string) => {
    doc.setDrawColor(...COR_BORDA);
    doc.rect(x, y, w, h);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...COR_LABEL);
    const labelLinhas = doc.splitTextToSize(label, w - 3) as string[];
    doc.text(labelLinhas, x + 1.8, y + 2.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COR_TEXTO);
    const valorY = y + 2.8 + labelLinhas.length * 3 + 1.8;
    const linhas = doc.splitTextToSize(valor || '', w - 3.5) as string[];
    doc.text(linhas.slice(0, Math.max(1, Math.floor((y + h - valorY) / 3.6) + 1)), x + 1.8, valorY);
  };

  const linhaCampos = (celulas: { w: number; label: string; valor: string }[], h = 8.5) => {
    let x = marginX;
    for (const c of celulas) {
      campo(x, c.w, h, c.label, c.valor);
      x += c.w;
    }
    y += h;
  };

  // Quadrado de checkbox + marca "✓" manual (sem depender de fonte com glifo unicode).
  const desenharCheckbox = (x: number, yCentro: number, marcado: boolean) => {
    const boxSize = 3.2;
    const boxY = yCentro - boxSize / 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(x, boxY, boxSize, boxSize);
    if (marcado) {
      doc.setLineWidth(0.55);
      doc.line(x + 0.5, boxY + 1.7, x + 1.3, boxY + boxSize - 0.3);
      doc.line(x + 1.3, boxY + boxSize - 0.3, x + boxSize - 0.3, boxY + 0.3);
      doc.setLineWidth(0.2);
    }
    return boxSize;
  };

  // Uma linha "mista": pode conter checkboxes e campos de texto sublinhados
  // (label + linha em branco), lado a lado, dentro de uma única caixa —
  // replica o padrão do formulário original (ex.: "[ ] Transferência... Qual? ______").
  // `linhaLargura`, quando informado, é a largura reservada SÓ para a linha em
  // branco após o rótulo (não inclui o próprio rótulo) — evita que o próximo
  // segmento comece por cima do texto do rótulo anterior.
  type Segmento =
    | { tipo: 'checkbox'; label: string; marcado: boolean }
    | { tipo: 'linha_texto'; label: string; valor: string; linhaLargura?: number };

  const linhaMista = (segmentos: Segmento[], h = 7) => {
    doc.setDrawColor(...COR_BORDA);
    doc.rect(marginX, y, contentW, h);
    let x = marginX + 2.2;
    const yCentro = y + h / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    for (const seg of segmentos) {
      if (seg.tipo === 'checkbox') {
        const boxSize = desenharCheckbox(x, yCentro + 0.3, seg.marcado);
        const textX = x + boxSize + 1.8;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor(...COR_TEXTO);
        doc.text(seg.label, textX, yCentro + 1.3);
        x = textX + doc.getTextWidth(seg.label) + 4.5;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.6);
        doc.setTextColor(...COR_TEXTO);
        if (seg.label) doc.text(seg.label, x, yCentro + 1.3);
        const labelW = seg.label ? doc.getTextWidth(seg.label) + 2 : 1;
        const lineStartX = x + labelW;
        const lineEndX = seg.linhaLargura ? lineStartX + seg.linhaLargura : marginX + contentW - 2.2;
        doc.setDrawColor(...COR_BORDA);
        doc.line(lineStartX, yCentro + 1.8, lineEndX, yCentro + 1.8);
        if (seg.valor) {
          const valorLinhas = doc.splitTextToSize(seg.valor, lineEndX - lineStartX - 1) as string[];
          doc.text(valorLinhas[0] || '', lineStartX + 1, yCentro + 0.7);
        }
        x = lineEndX + 4;
      }
    }
    y += h;
  };

  // ── 1. Dados Pessoais ─────────────────────────────────────────────────
  sectionTitle(1, tr('Dados Pessoais', 'Datos Personales', 'Personal Data'));

  linhaCampos([{ w: contentW, label: tr('Nome completo', 'Nombre completo', 'Full name'), valor: pessoa.nome + (pessoa.apelido ? ` "${pessoa.apelido}"` : '') }]);
  linhaCampos([{ w: contentW, label: tr('Nome do pai', 'Nombre del padre', "Father's name"), valor: pessoa.nome_pai || '' }]);
  linhaCampos([{ w: contentW, label: tr('Nome da mãe', 'Nombre de la madre', "Mother's name"), valor: pessoa.nome_mae || '' }]);
  linhaCampos([
    { w: contentW * 0.28, label: tr('Data de nascimento', 'Fecha de nacimiento', 'Birth date'), valor: formatarDataPt(pessoa.data_nascimento) },
    { w: contentW * 0.57, label: tr('Naturalidade', 'Ciudad de nacimiento', 'Birth city'), valor: pessoa.naturalidade_cidade || '' },
    { w: contentW * 0.15, label: 'UF', valor: pessoa.naturalidade_uf || '' },
  ]);

  const estrangeiro = !!pessoa.nacionalidade && pessoa.nacionalidade.trim().toLowerCase() !== 'brasileira';
  linhaMista([
    { tipo: 'checkbox', label: tr('Masculino', 'Masculino', 'Male'), marcado: pessoa.sexo === 'M' },
    { tipo: 'checkbox', label: tr('Feminino', 'Femenino', 'Female'), marcado: pessoa.sexo === 'F' },
    { tipo: 'checkbox', label: tr('Brasileira', 'Brasileña', 'Brazilian'), marcado: !estrangeiro },
    { tipo: 'checkbox', label: tr('Estrangeira', 'Extranjera', 'Foreign'), marcado: estrangeiro },
    { tipo: 'linha_texto', label: tr('País de origem', 'País de origen', 'Country of origin'), valor: estrangeiro ? (pessoa.pais_origem || pessoa.nacionalidade || '') : '' },
  ]);

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

  linhaMista([
    { tipo: 'checkbox', label: tr('Não alfabetizado', 'No alfabetizado', 'Not literate'), marcado: false },
    { tipo: 'checkbox', label: tr('Fundamental', 'Primaria', 'Elementary'), marcado: !!pessoa.escolaridade?.startsWith('fundamental') },
    { tipo: 'checkbox', label: tr('Médio', 'Secundaria', 'High school'), marcado: !!pessoa.escolaridade?.startsWith('medio') },
    { tipo: 'checkbox', label: tr('Superior', 'Universidad', 'College'), marcado: !!pessoa.escolaridade?.startsWith('superior') || pessoa.escolaridade === 'pos_graduacao' },
    { tipo: 'checkbox', label: tr('Mestrado', 'Maestría', "Master's"), marcado: pessoa.escolaridade === 'mestrado' },
    { tipo: 'checkbox', label: tr('Doutorado', 'Doctorado', 'Doctorate'), marcado: pessoa.escolaridade === 'doutorado' },
  ]);

  linhaCampos([
    { w: contentW * 0.5, label: tr('Profissão', 'Profesión', 'Profession'), valor: pessoa.profissao || '' },
    { w: contentW * 0.5, label: tr('Atividade atual', 'Actividad actual', 'Current activity'), valor: pessoa.atividade_atual || '' },
  ]);

  linhaMista([
    { tipo: 'checkbox', label: tr('Solteiro', 'Soltero', 'Single') + ':', marcado: false },
    { tipo: 'checkbox', label: tr('Sim', 'Sí', 'Yes'), marcado: pessoa.estado_civil === 'solteiro' },
    { tipo: 'checkbox', label: tr('Não', 'No', 'No'), marcado: !!pessoa.estado_civil && pessoa.estado_civil !== 'solteiro' },
    { tipo: 'checkbox', label: tr('Casado Civilmente', 'Casado Civilmente', 'Civilly Married') + ':', marcado: false },
    { tipo: 'checkbox', label: tr('Sim', 'Sí', 'Yes'), marcado: pessoa.estado_civil === 'casado' },
    { tipo: 'checkbox', label: tr('Não', 'No', 'No'), marcado: !!pessoa.estado_civil && pessoa.estado_civil !== 'casado' },
    {
      tipo: 'linha_texto',
      label: tr('Outros', 'Otros', 'Other'),
      valor: pessoa.estado_civil === 'divorciado'
        ? tr('Divorciado(a)', 'Divorciado(a)', 'Divorced')
        : pessoa.estado_civil === 'viuvo'
        ? tr('Viúvo(a)', 'Viudo(a)', 'Widowed')
        : '',
    },
  ]);

  linhaMista([
    { tipo: 'checkbox', label: tr('União Estável', 'Unión Estable', 'Civil Union') + ':', marcado: false },
    { tipo: 'checkbox', label: tr('Sim', 'Sí', 'Yes'), marcado: pessoa.estado_civil === 'uniao_estavel' },
    { tipo: 'checkbox', label: tr('Não', 'No', 'No'), marcado: !!pessoa.estado_civil && pessoa.estado_civil !== 'uniao_estavel' },
    { tipo: 'linha_texto', label: tr('Quanto tempo?', '¿Hace cuánto?', 'How long?'), valor: pessoa.estado_civil === 'uniao_estavel' ? (pessoa.uniao_estavel_tempo || '') : '' },
  ]);

  linhaCampos([
    { w: contentW * 0.5, label: tr('Nome completo do cônjuge', 'Nombre completo del cónyuge', 'Full spouse name'), valor: pessoa.conjuge_nome || '' },
    { w: contentW * 0.5, label: tr('Religião do cônjuge', 'Religión del cónyuge', "Spouse's religion"), valor: pessoa.conjuge_religiao || '' },
  ], 9.5);

  proximaSecao();

  // ── 2. Igreja Sede / Congregação / Grupo Familiar ────────────────────
  sectionTitle(2, tr('Igreja Sede / Congregação / Grupo Familiar', 'Iglesia Sede / Congregación / Grupo Familiar', 'Main Church / Congregation / Family Group'));
  linhaMista([
    { tipo: 'checkbox', label: tr('Igreja Sede (Central ou Pedras Vivas)', 'Iglesia Sede (Central o Pedras Vivas)', 'Main Church (Central or Pedras Vivas)'), marcado: pessoa.igreja_sede_congregacao === 'sede' },
    {
      tipo: 'linha_texto',
      label: tr('Congregação em Manaus. Qual?', 'Congregación en Manaus. ¿Cuál?', 'Congregation in Manaus. Which?'),
      valor: pessoa.igreja_sede_congregacao === 'congregacao_manaus' ? pessoa.congregacao_nome || '' : '',
    },
  ]);
  linhaMista([
    {
      tipo: 'linha_texto',
      label: tr('Congregação no Interior. Qual?', 'Congregación en el interior. ¿Cuál?', 'Congregation in the countryside. Which?'),
      valor: pessoa.igreja_sede_congregacao === 'congregacao_interior' ? pessoa.congregacao_nome || '' : '',
    },
  ]);
  linhaCampos([
    { w: contentW * 0.5, label: tr('Nome do Grupo familiar', 'Nombre del Grupo familiar', 'Family Group name'), valor: pessoa.grupo_familiar_nome || '' },
    { w: contentW * 0.5, label: tr('Nome do Líder', 'Nombre del Líder', "Leader's name"), valor: pessoa.grupo_familiar_lider || '' },
  ]);

  proximaSecao();

  // ── 3. Propósito da entrevista/exame ─────────────────────────────────
  sectionTitle(3, tr('Propósito da entrevista/exame', 'Propósito de la entrevista/examen', 'Purpose of the interview/exam'));
  linhaMista([
    { tipo: 'checkbox', label: tr('Batismo Infantil', 'Bautismo Infantil', 'Infant Baptism'), marcado: pessoa.proposito_entrevista === 'batismo_infantil' },
    { tipo: 'checkbox', label: tr('Profissão de Fé', 'Profesión de Fe', 'Profession of Faith'), marcado: pessoa.proposito_entrevista === 'profissao_fe' },
    { tipo: 'checkbox', label: tr('Profissão de Fé e Batismo', 'Profesión de Fe y Bautismo', 'Profession of Faith and Baptism'), marcado: pessoa.proposito_entrevista === 'profissao_fe_e_batismo' },
  ]);

  linhaMista([
    {
      tipo: 'checkbox',
      label: tr('Transferência entre Presbiterianas - IPB (com carta). Qual?', 'Transferencia entre Presbiterianas - IPB (con carta). ¿Cuál?', 'Transfer between Presbyterians - IPB (with letter). Which?'),
      marcado: !!pessoa.transferido_ipb,
    },
    { tipo: 'linha_texto', label: '', valor: pessoa.transferido_ipb ? pessoa.transferencia_ipb_origem || '' : '' },
  ]);
  linhaMista([
    { tipo: 'linha_texto', label: tr('Data do Batismo infantil', 'Fecha del Bautismo infantil', 'Infant Baptism date'), valor: formatarDataPt(pessoa.data_batismo), linhaLargura: 16 },
    { tipo: 'linha_texto', label: tr('Data da Profissão de Fé', 'Fecha de Profesión de Fe', 'Profession of Faith date'), valor: formatarDataPt(pessoa.data_profissao_fe), linhaLargura: 16 },
    {
      tipo: 'linha_texto',
      label: tr('Data da Profissão de Fé e Batismo', 'Fecha de Profesión de Fe y Bautismo', 'Profession of Faith and Baptism date'),
      valor: pessoa.proposito_entrevista === 'profissao_fe_e_batismo' ? formatarDataPt(pessoa.data_profissao_fe || pessoa.data_batismo) : '',
      linhaLargura: 16,
    },
  ], 6);

  linhaMista([
    {
      tipo: 'checkbox',
      label: tr('Transferência de outra denominação. Qual?', 'Transferencia de otra denominación. ¿Cuál?', 'Transfer from another denomination. Which?'),
      marcado: !!pessoa.transferido_outra_denominacao,
    },
    { tipo: 'linha_texto', label: '', valor: pessoa.transferido_outra_denominacao || '' },
  ]);
  linhaMista([
    { tipo: 'linha_texto', label: tr('Data do Batismo', 'Fecha del Bautismo', 'Baptism date'), valor: !pessoa.transferido_ipb ? formatarDataPt(pessoa.data_batismo) : '', linhaLargura: 16 },
    { tipo: 'linha_texto', label: tr('Observação', 'Observación', 'Note') + ':', valor: pessoa.transferido_outra_denominacao ? pessoa.transferencia_observacao || '' : '' },
  ], 6);

  linhaMista([
    {
      tipo: 'checkbox',
      label: tr('Transferência por jurisdição (sem carta). Qual a denominação?', 'Transferencia por jurisdicción (sin carta). ¿Cuál denominación?', 'Transfer by jurisdiction (no letter). Which denomination?'),
      marcado: !!pessoa.transferencia_jurisdicao_sem_carta,
    },
    { tipo: 'linha_texto', label: '', valor: pessoa.transferencia_jurisdicao_sem_carta || '' },
  ]);
  linhaMista([
    { tipo: 'linha_texto', label: tr('Data do Batismo', 'Fecha del Bautismo', 'Baptism date'), valor: '', linhaLargura: 16 },
    { tipo: 'linha_texto', label: tr('Observação', 'Observación', 'Note') + ':', valor: pessoa.transferencia_jurisdicao_sem_carta ? pessoa.transferencia_observacao || '' : '' },
  ], 6);

  proximaSecao();

  // ── 4. Programa de discipulado concluído ─────────────────────────────
  sectionTitle(4, tr('Programa de discipulado concluído', 'Programa de discipulado concluido', 'Completed discipleship program'));
  const cursos = pessoa.cursos_discipulado || [];
  linhaMista([
    { tipo: 'checkbox', label: tr('Conhecendo a Jesus - 01', 'Conociendo a Jesús - 01', 'Knowing Jesus - 01'), marcado: cursos.includes('apostila_01') },
    { tipo: 'checkbox', label: tr('Conhecendo a Nova Vida - 02', 'Conociendo la Nueva Vida - 02', 'Knowing the New Life - 02'), marcado: cursos.includes('apostila_02') },
    { tipo: 'checkbox', label: tr('Conhecendo a Nossa Fé - 03', 'Conociendo Nuestra Fe - 03', 'Knowing Our Faith - 03'), marcado: cursos.includes('apostila_03') },
  ], 8);

  proximaSecao();

  // ── 5. Exclusivo para o Conselho da Igreja ───────────────────────────
  // Preenchido automaticamente quando há assinatura digital do pastor
  // (a assinatura representa a confirmação do Conselho); em branco caso
  // contrário, para preenchimento manual.
  sectionTitle(5, tr('Exclusivo para o Conselho da Igreja', 'Exclusivo para el Consejo de la Iglesia', 'For Church Council use only'));
  const assinado = !!pessoa.assinatura_ficha;
  const assinanteNome = opts.assinanteNome?.trim() || NOME_PASTOR_PADRAO;

  const rowAprovadoH = 11;
  doc.setDrawColor(...COR_BORDA);
  doc.rect(marginX, y, contentW, rowAprovadoH);
  const col1W = 24;
  const col2W = contentW * 0.48;
  desenharCheckbox(marginX + 2.2, y + rowAprovadoH / 2, assinado);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(...COR_TEXTO);
  doc.text(tr('Aprovado', 'Aprobado', 'Approved'), marginX + 6.5, y + rowAprovadoH / 2 + 1.3);
  doc.line(marginX + col1W, y, marginX + col1W, y + rowAprovadoH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...COR_LABEL);
  doc.text(tr('Nome completo do pastor/presbítero', 'Nombre completo del pastor/presbítero', "Pastor/elder's full name"), marginX + col1W + 1.8, y + 2.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COR_TEXTO);
  doc.text(assinanteNome, marginX + col1W + 1.8, y + 7.5);
  doc.line(marginX + col1W + col2W, y, marginX + col1W + col2W, y + rowAprovadoH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...COR_LABEL);
  doc.text(tr('Assinatura:', 'Firma:', 'Signature:'), marginX + col1W + col2W + 1.8, y + 2.8);
  if (pessoa.assinatura_ficha) {
    try {
      doc.addImage(pessoa.assinatura_ficha, 'PNG', marginX + col1W + col2W + 1.8, y + 3.2, contentW - col1W - col2W - 4, rowAprovadoH - 5);
    } catch {
      // Assinatura em formato incompatível: deixa o campo em branco.
    }
  }
  y += rowAprovadoH;

  const rowAguardarH = 9.5;
  doc.setDrawColor(...COR_BORDA);
  doc.rect(marginX, y, contentW, rowAguardarH);
  desenharCheckbox(marginX + 2.2, y + rowAguardarH / 2, false);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(...COR_TEXTO);
  doc.text(tr('Aguardar', 'Esperar', 'Wait'), marginX + 6.5, y + rowAguardarH / 2 + 1.3);
  doc.line(marginX + col1W, y, marginX + col1W, y + rowAguardarH);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...COR_LABEL);
  doc.text(tr('Motivo:', 'Motivo:', 'Reason:'), marginX + col1W + 1.8, y + 2.8);
  y += rowAguardarH;

  linhaCampos([
    { w: contentW * 0.4, label: tr('Data desta entrevista', 'Fecha de esta entrevista', 'Date of this interview'), valor: assinado ? formatarDataPt(pessoa.assinatura_ficha_em?.slice(0, 10) || null) : '' },
    { w: contentW * 0.6, label: tr('Informações adicionais', 'Información adicional', 'Additional information'), valor: '' },
  ], 9.5);

  proximaSecao();

  // ── 6. Previsão para o recebimento ───────────────────────────────────
  sectionTitle(6, tr('Previsão para o recebimento', 'Previsión para la recepción', 'Expected reception'));
  linhaCampos([
    { w: contentW * 0.34, label: tr('Data', 'Fecha', 'Date'), valor: '' },
    { w: contentW * 0.33, label: tr('Horário', 'Horario', 'Time'), valor: '' },
    { w: contentW * 0.33, label: tr('Local', 'Lugar', 'Place'), valor: '' },
  ], 11);

  const nomeArquivo = `ficha-candidato-${pessoa.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
  doc.save(nomeArquivo);
}
