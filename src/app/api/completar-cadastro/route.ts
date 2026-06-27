import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// Campos que o próprio membro pode preencher pelo link público.
// NÃO inclui cargo, status_membro, ativo, observações ou dados eclesiásticos
// — esses são responsabilidade da liderança.
const CAMPOS_PESSOA = [
  'nome', 'apelido', 'telefone', 'email', 'data_nascimento', 'sexo',
  'estado_civil', 'conjuge_nome', 'conjuge_religiao', 'data_casamento',
  'nome_pai', 'nome_mae', 'naturalidade_cidade', 'naturalidade_uf',
  'nacionalidade', 'profissao', 'escolaridade', 'logradouro', 'bairro',
  'cep', 'cidade', 'uf', 'latitude', 'longitude', 'google_place_id',
  'endereco_completo',
] as const;

const CAMPOS_FILHO = [
  'nome', 'sexo', 'data_nascimento', 'naturalidade_cidade',
  'naturalidade_uf', 'escolaridade',
] as const;

const SELECT_PESSOA = `id, foto_url, ${CAMPOS_PESSOA.join(', ')}`;
const SELECT_FILHO = `id, foto_url, ${CAMPOS_FILHO.join(', ')}`;

function camposFaltando(p: any): string[] {
  const faltando: string[] = [];
  if (!p.telefone) faltando.push('telefone');
  if (!p.email) faltando.push('email');
  if (!p.data_nascimento) faltando.push('nascimento');
  if (!p.sexo) faltando.push('sexo');
  if (!p.estado_civil) faltando.push('estado civil');
  if (!p.logradouro && !p.endereco_completo) faltando.push('endereço');
  if (!p.cidade) faltando.push('cidade');
  if (!p.uf) faltando.push('UF');
  return faltando;
}

function camposFaltandoFilho(p: any): string[] {
  const faltando: string[] = [];
  if (!p.sexo) faltando.push('sexo');
  if (!p.data_nascimento) faltando.push('nascimento');
  return faltando;
}

// Seleciona apenas os campos permitidos de um objeto enviado pelo cliente.
function filtrarCampos(origem: any, permitidos: readonly string[]) {
  const out: Record<string, unknown> = {};
  if (!origem || typeof origem !== 'object') return out;
  for (const campo of permitidos) {
    if (campo in origem) out[campo] = origem[campo];
  }
  return out;
}

function trim(v: unknown) {
  return typeof v === 'string' ? v.trim() : v;
}

async function carregarPorToken(token: string) {
  const { data: pessoa, error } = await supabaseAdmin
    .from('pessoas')
    .select(SELECT_PESSOA)
    .eq('cadastro_token', token)
    .maybeSingle<any>();

  if (error) throw error;
  return pessoa || null;
}

async function igrejaDaPessoa(pessoaId: string) {
  const { data: vinculo } = await supabaseAdmin
    .from('pessoas_igrejas')
    .select('igreja_id, ativo')
    .eq('pessoa_id', pessoaId)
    .order('ativo', { ascending: false })
    .limit(1)
    .maybeSingle();

  const igrejaId = vinculo?.igreja_id || null;
  if (!igrejaId) return { igrejaId: null, igreja: null };

  const { data: igreja } = await supabaseAdmin
    .from('igrejas')
    .select('id, nome, nome_abreviado, slug, cidade, uf')
    .eq('id', igrejaId)
    .maybeSingle();

  return { igrejaId, igreja: igreja || null };
}

async function idsFilhosVinculados(pessoaId: string) {
  const { data: rels, error } = await supabaseAdmin
    .from('relacionamentos')
    .select('pessoa_relacionada_id, tipo')
    .eq('pessoa_id', pessoaId)
    .in('tipo', ['filho', 'filha']);

  if (error) throw error;
  return (rels || []).map((r: any) => r.pessoa_relacionada_id as string);
}

// ============================================================================
// GET ?token=...  → dados atuais da pessoa + filhos vinculados + o que falta
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
    }

    const pessoa = await carregarPorToken(token);
    if (!pessoa) {
      return NextResponse.json(
        { error: 'Link inválido ou expirado. Fale com a liderança.' },
        { status: 404 }
      );
    }

    const { igreja } = await igrejaDaPessoa(pessoa.id);

    const childIds = await idsFilhosVinculados(pessoa.id);
    let filhos: any[] = [];
    if (childIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('pessoas')
        .select(SELECT_FILHO)
        .in('id', childIds);
      if (error) throw error;
      filhos = (data || []).map((f: any) => ({ ...f, faltando: camposFaltandoFilho(f) }));
    }

    return NextResponse.json({
      pessoa: { ...pessoa, faltando: camposFaltando(pessoa) },
      filhos,
      igreja,
    });
  } catch (error: any) {
    console.error('Erro ao carregar cadastro por token:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar seus dados. Tente novamente.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST { token, pessoa, filhos[], novosFilhos[] } → salva de forma segura
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = trim(body.token) as string;
    if (!token) {
      return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
    }

    const pessoa = await carregarPorToken(token);
    if (!pessoa) {
      return NextResponse.json(
        { error: 'Link inválido ou expirado. Fale com a liderança.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { igrejaId } = await igrejaDaPessoa(pessoa.id);

    // ── 1) Atualiza a própria pessoa (apenas campos permitidos) ──
    const dadosPessoa = filtrarCampos(body.pessoa, CAMPOS_PESSOA);
    if (typeof dadosPessoa.nome === 'string' && !dadosPessoa.nome.trim()) {
      return NextResponse.json({ error: 'Informe seu nome completo.' }, { status: 400 });
    }
    if (Object.keys(dadosPessoa).length > 0) {
      const { error } = await supabaseAdmin
        .from('pessoas')
        .update({ ...dadosPessoa, atualizado_em: now })
        .eq('id', pessoa.id);
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Este telefone ou e-mail já pertence a outro cadastro.' },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    // ── 2) Atualiza filhos já vinculados (somente os que são realmente filhos) ──
    const filhosEnviados: any[] = Array.isArray(body.filhos) ? body.filhos : [];
    if (filhosEnviados.length > 0) {
      const idsPermitidos = new Set(await idsFilhosVinculados(pessoa.id));
      for (const filho of filhosEnviados) {
        if (!filho?.id || !idsPermitidos.has(filho.id)) continue;
        const dados = filtrarCampos(filho, CAMPOS_FILHO);
        if (Object.keys(dados).length === 0) continue;
        const { error } = await supabaseAdmin
          .from('pessoas')
          .update({ ...dados, atualizado_em: now })
          .eq('id', filho.id);
        if (error) throw error;
      }
    }

    // ── 3) Cria novos filhos + vínculo correto na tabela relacionamentos ──
    const novosFilhos: any[] = Array.isArray(body.novosFilhos) ? body.novosFilhos : [];
    let criados = 0;
    for (const filho of novosFilhos) {
      const dados = filtrarCampos(filho, CAMPOS_FILHO) as any;
      const nome = typeof dados.nome === 'string' ? dados.nome.trim() : '';
      if (!nome) continue;

      const sexoFilho = dados.sexo === 'M' || dados.sexo === 'F' ? dados.sexo : null;
      const { data: criado, error: insertError } = await supabaseAdmin
        .from('pessoas')
        .insert({
          ...dados,
          nome,
          cargo: 'membro',
          status_membro: 'congregado',
          ativo: true,
          nome_pai: pessoa.sexo === 'M' ? pessoa.nome : null,
          nome_mae: pessoa.sexo === 'F' ? pessoa.nome : null,
          cidade: pessoa.cidade || null,
          uf: pessoa.uf || null,
          criado_em: now,
          atualizado_em: now,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      const filhoId = criado.id;

      // Vínculo pai/mãe ↔ filho(a) nos dois sentidos.
      const tipoParaFilho = sexoFilho === 'F' ? 'filha' : 'filho';
      const tipoParaPai = pessoa.sexo === 'F' ? 'mae' : 'pai';
      const relacionamentos: any[] = [
        { pessoa_id: pessoa.id, pessoa_relacionada_id: filhoId, tipo: tipoParaFilho },
      ];
      if (pessoa.sexo === 'M' || pessoa.sexo === 'F') {
        relacionamentos.push({ pessoa_id: filhoId, pessoa_relacionada_id: pessoa.id, tipo: tipoParaPai });
      }
      const { error: relError } = await supabaseAdmin
        .from('relacionamentos')
        .insert(relacionamentos);
      if (relError && relError.code !== '23505') throw relError;

      if (igrejaId) {
        await supabaseAdmin.from('pessoas_igrejas').upsert(
          {
            pessoa_id: filhoId,
            igreja_id: igrejaId,
            status_membro: 'congregado',
            cargo: 'membro',
            ativo: true,
            atualizado_em: now,
          },
          { onConflict: 'pessoa_id,igreja_id' }
        );
      }

      criados += 1;
    }

    // Invalida o token após confirmação bem-sucedida para evitar reutilização
    await supabaseAdmin
      .from('pessoas')
      .update({ cadastro_token: null })
      .eq('id', pessoa.id);

    return NextResponse.json({ success: true, filhos_criados: criados });
  } catch (error: any) {
    console.error('Erro ao salvar cadastro por token:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar. Tente novamente.' },
      { status: 500 }
    );
  }
}
