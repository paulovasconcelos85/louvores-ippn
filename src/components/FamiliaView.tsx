'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatPhoneNumber } from '@/lib/phone-mask';
import { Users, Phone, ChevronDown, ChevronUp, Cake, Heart } from 'lucide-react';

type TipoRelacionamento =
  | 'conjuge' | 'pai' | 'mae' | 'filho' | 'filha'
  | 'irmao' | 'irma' | 'avo_paterno' | 'avo_paterna'
  | 'avo_materno' | 'avo_materna' | 'neto' | 'neta'
  | 'cunhado' | 'cunhada' | 'sogro' | 'sogra'
  | 'genro' | 'nora' | 'tio' | 'tia'
  | 'sobrinho' | 'sobrinha' | 'primo' | 'prima';

const TIPO_LABELS: Record<TipoRelacionamento, string> = {
  conjuge: 'Cônjuge',
  pai: 'Pai', mae: 'Mãe',
  filho: 'Filho', filha: 'Filha',
  irmao: 'Irmão', irma: 'Irmã',
  avo_paterno: 'Avô Paterno', avo_paterna: 'Avó Paterna',
  avo_materno: 'Avô Materno', avo_materna: 'Avó Materna',
  neto: 'Neto', neta: 'Neta',
  cunhado: 'Cunhado', cunhada: 'Cunhada',
  sogro: 'Sogro', sogra: 'Sogra',
  genro: 'Genro', nora: 'Nora',
  tio: 'Tio', tia: 'Tia',
  sobrinho: 'Sobrinho', sobrinha: 'Sobrinha',
  primo: 'Primo', prima: 'Prima',
};

interface MembroSimples {
  id: string;
  nome: string;
  telefone: string | null;
  data_nascimento: string | null;
  status_membro: string;
  cargo: string;
  situacao_saude: string | null;
}

interface MembroComRelacao extends MembroSimples {
  tipo_relacao: TipoRelacionamento;
}

interface Familia {
  chefe: MembroSimples;
  membros: MembroComRelacao[];
}

interface SemFamilia {
  semFamilia: MembroSimples[];
}

export default function FamiliaView() {
  const router = useRouter();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [semFamilia, setSemFamilia] = useState<MembroSimples[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  useEffect(() => {
    carregarFamilias();
  }, []);

  const carregarFamilias = async () => {
    try {
      setLoading(true);

      // Carrega todos os relacionamentos com dados das pessoas
      const { data: relacionamentos, error: errRel } = await supabase
        .from('relacionamentos')
        .select(`
          pessoa_id,
          pessoa_relacionada_id,
          tipo,
          pessoa:pessoa_id ( id, nome, telefone, data_nascimento, status_membro, cargo, situacao_saude ),
          relacionada:pessoa_relacionada_id ( id, nome, telefone, data_nascimento, status_membro, cargo, situacao_saude )
        `);

      if (errRel) throw errRel;

      // Carrega todas as pessoas ativas
      const { data: todasPessoas, error: errPessoas } = await supabase
        .from('pessoas')
        .select('id, nome, telefone, data_nascimento, status_membro, cargo, situacao_saude')
        .eq('ativo', true)
        .order('nome');

      if (errPessoas) throw errPessoas;

      // Monta mapa de relacionamentos: pessoa_id → lista de relacionados
      const mapaRel = new Map<string, MembroComRelacao[]>();
      (relacionamentos || []).forEach((r: any) => {
        if (!mapaRel.has(r.pessoa_id)) mapaRel.set(r.pessoa_id, []);
        mapaRel.get(r.pessoa_id)!.push({
          ...r.relacionada,
          tipo_relacao: r.tipo as TipoRelacionamento,
        });
      });

      // Descobre quem tem relacionamentos
      const pessoasComRelacao = new Set<string>();
      (relacionamentos || []).forEach((r: any) => {
        pessoasComRelacao.add(r.pessoa_id);
        pessoasComRelacao.add(r.pessoa_relacionada_id);
      });

      // Identifica chefes de família: têm relacionamentos mas não são filho/neto/cônjuge de ninguém
      // Simplificado: quem não aparece como pessoa_relacionada_id com tipo pai/mae/conjuge
      const ehDependente = new Set<string>();
      (relacionamentos || []).forEach((r: any) => {
        if (['filho', 'filha', 'neto', 'neta'].includes(r.tipo)) {
          ehDependente.add(r.pessoa_relacionada_id);
        }
      });

// Para cônjuges, mantém apenas quem tem o ID "menor" como chefe (determinístico)
      const conjugesLadoB = new Set<string>();
      (relacionamentos || []).forEach((r: any) => {
        if (r.tipo === 'conjuge') {
          if (r.pessoa_id > r.pessoa_relacionada_id) {
            conjugesLadoB.add(r.pessoa_id);
          }
        }
      });

      // Chefes: têm relações, não são dependentes, e não são o "lado B" do cônjuge
      const chefesVistos = new Set<string>();
      const familiasMap = new Map<string, Familia>();

      ;(todasPessoas || []).forEach((p: MembroSimples) => {
        const temRelacao = pessoasComRelacao.has(p.id);
        const eDependente = ehDependente.has(p.id);
        const eLadoB = conjugesLadoB.has(p.id);

        if (temRelacao && !eDependente && !eLadoB && !chefesVistos.has(p.id)) {
          chefesVistos.add(p.id);
          familiasMap.set(p.id, {
            chefe: p,
            membros: mapaRel.get(p.id) || [],
          });
        }
      });

      // Pessoas sem nenhuma relação
      const semRel = (todasPessoas || []).filter(
        (p: MembroSimples) => !pessoasComRelacao.has(p.id)
      );

      setFamilias(Array.from(familiasMap.values()));
      setSemFamilia(semRel);

      // Abre todos por padrão
      const todosIds = new Set(Array.from(familiasMap.keys()));
      setAbertos(todosIds);
    } catch (err) {
      console.error('Erro ao carregar famílias:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFamilia = (id: string) => {
    setAbertos(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const getNomeFamilia = (chefe: MembroSimples): string => {
    const sobrenome = chefe.nome.trim().split(' ').slice(-1)[0];
    return `Família ${sobrenome}`;
  };

  const getStatusCor = (status: string) => {
    const cores: Record<string, string> = {
      ativo: 'bg-green-100 text-green-800',
      afastado: 'bg-yellow-100 text-yellow-800',
      falecido: 'bg-gray-100 text-gray-600',
      visitante: 'bg-blue-100 text-blue-800',
      congregado: 'bg-purple-100 text-purple-800',
    };
    return cores[status] || 'bg-slate-100 text-slate-700';
  };

  const ehAniversarioHoje = (data: string | null) => {
    if (!data) return false;
    const hoje = new Date();
    const nasc = new Date(data);
    return hoje.getMonth() === nasc.getMonth() && hoje.getDate() === nasc.getDate();
  };

  const calcularIdade = (data: string | null) => {
    if (!data) return null;
    const hoje = new Date();
    const nasc = new Date(data);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    if (hoje.getMonth() < nasc.getMonth() ||
      (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const abrirWhatsApp = (e: React.MouseEvent, telefone: string | null, nome: string) => {
    e.stopPropagation();
    if (!telefone) return;
    const num = telefone.replace(/\D/g, '');
    const msg = `Olá ${nome}! Que a paz do Senhor esteja contigo!`;
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const MembroRow = ({ membro, tipoRelacao }: { membro: MembroSimples; tipoRelacao?: TipoRelacionamento }) => (
    <div
      onClick={() => router.push(`/admin/membros/${membro.id}`)}
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:shadow-sm ${
        ehAniversarioHoje(membro.data_nascimento)
          ? 'bg-pink-50 border border-pink-200 hover:border-pink-400'
          : membro.situacao_saude
          ? 'bg-red-50/40 border border-red-100 hover:border-red-300'
          : 'bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
          {membro.nome.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 text-sm">{membro.nome}</span>
            {ehAniversarioHoje(membro.data_nascimento) && (
              <Cake className="w-4 h-4 text-pink-500 flex-shrink-0" />
            )}
            {membro.situacao_saude && (
              <Heart className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {tipoRelacao && (
              <span className="text-xs text-slate-500 font-medium">
                {TIPO_LABELS[tipoRelacao]}
              </span>
            )}
            {membro.data_nascimento && (
              <span className="text-xs text-slate-400">
                {calcularIdade(membro.data_nascimento)} anos
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusCor(membro.status_membro)}`}>
              {membro.status_membro.charAt(0).toUpperCase() + membro.status_membro.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {membro.telefone && (
        <button
          onClick={(e) => abrirWhatsApp(e, membro.telefone, membro.nome)}
          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex-shrink-0"
          title="Abrir WhatsApp"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-3 text-slate-500 text-sm">Carregando famílias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Famílias */}
      {familias.map((familia) => (
        <div
          key={familia.chefe.id}
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Header da família */}
          <button
            onClick={() => toggleFamilia(familia.chefe.id)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900">{getNomeFamilia(familia.chefe)}</p>
                <p className="text-xs text-slate-500">
                  {familia.membros.length + 1} pessoa{familia.membros.length + 1 !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {abertos.has(familia.chefe.id)
              ? <ChevronUp className="w-5 h-5 text-slate-400" />
              : <ChevronDown className="w-5 h-5 text-slate-400" />
            }
          </button>

          {/* Membros da família */}
          {abertos.has(familia.chefe.id) && (
            <div className="px-4 pb-4 space-y-2">
              {/* Chefe */}
              <MembroRow membro={familia.chefe} />
              {/* Relacionados */}
              {familia.membros.map((m) => (
                <MembroRow key={m.id} membro={m} tipoRelacao={m.tipo_relacao} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Sem família */}
      {semFamilia.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleFamilia('__sem_familia__')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-700">Sem relacionamentos cadastrados</p>
                <p className="text-xs text-slate-500">{semFamilia.length} pessoa{semFamilia.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {abertos.has('__sem_familia__')
              ? <ChevronUp className="w-5 h-5 text-slate-400" />
              : <ChevronDown className="w-5 h-5 text-slate-400" />
            }
          </button>

          {abertos.has('__sem_familia__') && (
            <div className="px-4 pb-4 space-y-2">
              {semFamilia.map((m) => (
                <MembroRow key={m.id} membro={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {familias.length === 0 && semFamilia.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>Nenhum membro encontrado</p>
        </div>
      )}
    </div>
  );
}