import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Ajuda | OIKOS Hub',
  description:
    'Passo a passo de cada parte do OIKOS Hub: criar a igreja, montar o boletim, cânticos, escalas, pessoas, acessos e app no celular.',
};

type Bloco =
  | { tipo: 'p'; texto: string }
  | { tipo: 'passos'; itens: string[] }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'dica'; texto: string };

type Secao = {
  id: string;
  titulo: string;
  resumo: string;
  onde?: { rotulo: string; href: string };
  blocos: Bloco[];
};

// Cada id é âncora usada pelo roteiro de primeiros passos do painel.
const SECOES: Secao[] = [
  {
    id: 'comecar',
    titulo: 'Criar a igreja no OIKOS Hub',
    resumo: 'Quem cria a igreja vira o responsável por ela e já entra no painel.',
    onde: { rotulo: 'Criar minha igreja', href: '/comecar' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Na página inicial, clique em “Criar minha igreja”.',
          'Informe o nome da igreja, a sigla (opcional), a cidade e o horário do culto principal.',
          'Escolha o endereço público. O sistema sugere um a partir das iniciais — “Igreja Presbiteriana da Ponta Negra” vira “ippn” — e mostra na hora se está livre.',
          'Diga se você é pastor(a) ou da liderança/secretaria, informe nome, e-mail e uma senha.',
          'Pronto: você cai no painel com o roteiro de primeiros passos aberto.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Endereço curto é melhor: é o que a igreja vai digitar e compartilhar. Se as iniciais já estiverem em uso, acrescente a cidade (ex.: ippn-manaus).',
      },
      {
        tipo: 'p',
        texto:
          'Já tem conta no OIKOS Hub (por exemplo, como membro de outra igreja)? Entre primeiro e depois abra “Criar minha igreja”: a nova igreja é adicionada à sua conta e você alterna entre elas pelo seletor no topo do painel.',
      },
    ],
  },
  {
    id: 'dados-da-igreja',
    titulo: 'Dados da igreja: logo, endereço, cultos e liturgia',
    resumo: 'Tudo o que aparece na página pública e o modelo usado para montar cada boletim.',
    onde: { rotulo: 'Painel → Dados da igreja', href: '/admin/igrejas' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Nomes: o nome de exibição aparece em todo o sistema; o nome curto em menus e no ícone do app; o nome jurídico só se existir um nome oficial maior.',
          'Endereço do link (slug): pode ser trocado, mas quem já salvou o link antigo vai perdê-lo. Evite mudar depois de divulgar.',
          'Logo: clique em “Enviar imagem” e escolha um arquivo do computador ou uma foto do celular. Se a imagem não for quadrada, usamos o centro. Ela vira o ícone quando alguém instala o boletim no celular.',
          'Endereço, telefone, WhatsApp e redes sociais: aparecem para visitantes na página pública.',
          'Cultos: cadastre cada culto e reunião com dia e horário.',
          'Apresentação pública: título e texto do “Sobre a igreja”. Se o texto ficar vazio, o link não aparece.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Liturgia, em duas etapas: (1) em “Tipos disponíveis”, adicione as partes que a igreja usa (Prelúdio, Confissão, Pregação…); (2) em “Ordem padrão do culto”, organize a sequência e o texto padrão de cada parte. Toda igreja nova começa com um modelo reformado simples, que você ajusta à vontade.',
      },
      {
        tipo: 'dica',
        texto: 'Configure a liturgia antes do primeiro boletim: cada boletim novo já nasce com essa ordem preenchida.',
      },
    ],
  },
  {
    id: 'boletins',
    titulo: 'Boletins e liturgia do culto',
    resumo: 'O coração do sistema: a ordem do culto, os cânticos e os avisos que a igreja vê no celular.',
    onde: { rotulo: 'Painel → Boletins', href: '/cultos' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra “Boletins” e crie um novo. O sistema sugere o próximo domingo e avisa se a data for incomum.',
          'A liturgia já vem preenchida com o modelo da igreja. Ajuste o que precisar — os títulos dos itens podem ser digitados livremente.',
          'Nos itens com cântico, escolha as músicas e o tom. Ao lado de cada música aparece há quanto tempo ela não é cantada (recente, moderado, há tempo), para variar o repertório.',
          'Preencha o texto público dos itens que a igreja deve ler (leituras, confissão, credo).',
          'Adicione as seções do boletim: Avisos, Pedidos de oração, Agenda, Informativo ou Outros.',
          'Salve. O boletim aparece no endereço público da igreja.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Há duas camadas de texto: o “público”, que a igreja vê, e a anotação interna, que só a liderança vê (ex.: “chamar irmão para orar”).',
      },
      {
        tipo: 'p',
        texto:
          'Os boletins de semanas anteriores continuam acessíveis pela página pública, em “Boletins anteriores”.',
      },
    ],
  },
  {
    id: 'canticos',
    titulo: 'Cânticos e repertório',
    resumo: 'O acervo musical da igreja: letra, cifra e tom de cada cântico.',
    onde: { rotulo: 'Painel → Músicas', href: '/canticos' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Cadastre os cânticos que a igreja canta, com letra e cifra. Eles passam a aparecer na escolha de músicas do boletim.',
          'Igrejas que usam hinário podem escolhê-lo em Dados da igreja → Configurações; os hinos entram junto com os cânticos.',
          'A equipe de louvor abre letra e cifra direto do celular, a partir do boletim.',
        ],
      },
    ],
  },
  {
    id: 'escalas',
    titulo: 'Escalas de louvor e serviço',
    resumo: 'Quem toca, canta e serve em cada culto — e a confirmação de cada um.',
    onde: { rotulo: 'Painel → Escalas', href: '/admin/escalas' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abra “Escalas” e crie uma escala para a data do culto.',
          'Vincule a um boletim existente ou deixe o sistema criar um novo com a liturgia padrão.',
          'Adicione as pessoas e a função de cada uma (vocal, violão, som, projeção…). As funções vêm das habilitações cadastradas em Pessoas.',
          'Mude o status para “Publicada” quando estiver pronta — antes disso só a liderança vê.',
          'Use “Compartilhar no WhatsApp”: a escala sai formatada, pronta para colar no grupo.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Cada pessoa escalada que tem acesso ao sistema vê a escala no próprio painel e pode confirmar presença.',
      },
    ],
  },
  {
    id: 'pessoas-e-acessos',
    titulo: 'Pessoas, equipe e acessos',
    resumo: 'Cadastre a igreja e decida quem entra no painel e com qual cargo.',
    onde: { rotulo: 'Painel → Usuários', href: '/admin/usuarios' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Existem dois tipos de cadastro. “Pessoas” são registros da base da igreja, sem login. “Usuários” são pessoas com acesso ao painel. Todo usuário é uma pessoa; nem toda pessoa é usuária.',
      },
      {
        tipo: 'passos',
        itens: [
          'Cadastre a pessoa com nome, telefone e e-mail.',
          'Para dar acesso, use “Liberar acesso”. A pessoa precisa ter e-mail cadastrado.',
          'Escolha o cargo (veja a tabela abaixo) e, se for do louvor ou da técnica, marque as habilitações.',
          'Avise a pessoa: ela entra em “Entrar” com o mesmo e-mail — por senha (em “Primeiro acesso”), Google ou Microsoft.',
        ],
      },
      {
        tipo: 'dica',
        texto: 'Para bloquear alguém na hora, desative o acesso. O cadastro da pessoa continua guardado.',
      },
    ],
  },
  {
    id: 'cargos',
    titulo: 'O que cada cargo pode fazer',
    resumo: 'Permissões definidas pelo cargo da pessoa nesta igreja.',
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Membro: cadastro na base, sem acesso ao painel.',
          'Músico e diácono: boletins e cânticos.',
          'Staff: boletins, cânticos e escalas.',
          'Presbítero: tudo acima, mais membros, liturgia completa, recursos e liberação de acessos.',
          'Seminarista: boletins, cânticos, membros, liturgia completa, recursos e pedidos pastorais.',
          'Pastor: acesso completo à igreja, incluindo pedidos pastorais e dados da igreja.',
          'Administrador: acesso completo à gestão da igreja (dados, pessoas, escalas, boletins); pedidos pastorais ficam com o pastor.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Habilitações (tags) ampliam o acesso sem mudar o cargo: quem é do louvor gerencia cânticos e escalas; quem é da técnica cuida de boletins; quem é da secretaria ajuda no cadastro de pessoas.',
      },
    ],
  },
  {
    id: 'membros',
    titulo: 'Membros e cuidado pastoral',
    resumo: 'Rol de membros, famílias, aniversários e ficha de membresia.',
    onde: { rotulo: 'Painel → Membros', href: '/admin/membros' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Cadastro completo de cada membro: dados pessoais, família, classificação eclesiástica e histórico.',
          '“Pedir cadastro (WhatsApp)”: envia ao membro um link para ele mesmo conferir e completar os próprios dados (e os dos filhos).',
          'Lista de aniversariantes e relatórios em PDF, inclusive por família.',
          'Ficha de candidato à membresia com assinatura digital.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'O jeito mais rápido de montar o rol é pedir que cada família complete o próprio cadastro pelo link — você só confere.',
      },
    ],
  },
  {
    id: 'cadastro-publico',
    titulo: 'Cadastro público de visitantes e membros',
    resumo: 'Um link para qualquer pessoa se cadastrar na igreja sozinha.',
    blocos: [
      {
        tipo: 'p',
        texto:
          'Toda igreja tem um formulário público em /cadastro/<endereço-da-igreja>. Divulgue no culto, num QR code ou no Instagram. Quem se cadastra entra na base como pessoa da igreja, e a liderança decide depois se libera acesso ao painel.',
      },
    ],
  },
  {
    id: 'pedidos-pastorais',
    titulo: 'Pedidos pastorais e de oração',
    resumo: 'Canal reservado para a igreja falar com o pastor.',
    onde: { rotulo: 'Painel → Pedidos pastorais', href: '/admin/pedidos-pastorais' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Os membros enviam pedidos pela página pública /pedidos/<endereço-da-igreja>. Só pastores e seminaristas veem os pedidos, que podem ser copiados ou encaminhados pelo WhatsApp.',
      },
    ],
  },
  {
    id: 'recursos',
    titulo: 'Recursos em vídeo',
    resumo: 'Cultos, EBD e estudos gravados, organizados para a igreja.',
    onde: { rotulo: 'Painel → Recursos', href: '/recursos' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Cadastre os vídeos (YouTube) por categoria — culto, escola bíblica, estudo — com data e responsável. Pastores, presbíteros, seminaristas e líderes de ministério podem publicar.',
      },
    ],
  },
  {
    id: 'estatisticas',
    titulo: 'Estatísticas do repertório',
    resumo: 'Quais músicas a igreja mais canta, por mês e por posição no culto.',
    onde: { rotulo: 'Painel → Estatísticas', href: '/dashboard' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Os números saem dos boletins: quanto mais boletins a igreja registra, mais útil fica a visão do repertório — e mais fácil evitar repetição ou esquecer músicas boas.',
      },
    ],
  },
  {
    id: 'app-no-celular',
    titulo: 'Boletim como app no celular',
    resumo: 'O endereço público da igreja pode ser instalado como aplicativo, sem loja.',
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'iPhone (Safari): abra o endereço da igreja, toque em Compartilhar e depois em “Adicionar à Tela de Início”.',
          'Android (Chrome): abra o endereço da igreja, toque no menu ⋮ e em “Instalar app” ou “Adicionar à tela inicial”.',
          'O ícone usa o logo da igreja e o nome curto. Por isso vale cadastrar os dois em Dados da igreja.',
        ],
      },
    ],
  },
];

const PERGUNTAS: Array<{ pergunta: string; resposta: string }> = [
  {
    pergunta: 'Esqueci minha senha. E agora?',
    resposta:
      'Na tela de entrar, digite seu e-mail e clique em “Esqueci minha senha”. Chega um link por e-mail para criar uma senha nova. Também dá para entrar pelo Google ou pela Microsoft com o mesmo e-mail.',
  },
  {
    pergunta: 'Uma pessoa diz que não consegue entrar.',
    resposta:
      'Confira em Usuários se o e-mail dela está correto e se o acesso está liberado e ativo. Ela precisa entrar com exatamente o mesmo e-mail cadastrado.',
  },
  {
    pergunta: 'Participo de duas igrejas. Preciso de duas contas?',
    resposta: 'Não. Uma conta serve para várias igrejas; troque de igreja pelo seletor no topo do painel.',
  },
  {
    pergunta: 'Posso trocar o endereço (slug) da igreja?',
    resposta:
      'Pode, em Dados da igreja. Mas o endereço antigo para de funcionar, inclusive nos apps já instalados. Troque só se for realmente necessário.',
  },
  {
    pergunta: 'O boletim não aparece na página pública.',
    resposta:
      'Confira se o boletim foi salvo com a data certa e se a igreja está marcada como visível ao público em Dados da igreja.',
  },
  {
    pergunta: 'Quero transferir a responsabilidade da igreja para outra pessoa.',
    resposta:
      'Cadastre a pessoa, libere o acesso com o cargo de pastor ou administrador e, se quiser, rebaixe ou desative o seu próprio acesso.',
  },
];

function renderBloco(bloco: Bloco, index: number) {
  switch (bloco.tipo) {
    case 'p':
      return (
        <p key={index} className="mt-4 text-base leading-7 text-slate-700">
          {bloco.texto}
        </p>
      );
    case 'passos':
      return (
        <ol key={index} className="mt-4 space-y-3">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex gap-3 text-base leading-7 text-slate-700">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case 'lista':
      return (
        <ul key={index} className="mt-4 list-disc space-y-2 pl-5 text-base leading-7 text-slate-700 marker:text-emerald-600">
          {bloco.itens.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'dica':
      return (
        <p key={index} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <strong>Dica: </strong>
          {bloco.texto}
        </p>
      );
  }
}

export default function AjudaPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-slate-950">O</span>
            <span className="text-sm font-semibold sm:text-base">OIKOS Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="inline-flex min-h-10 items-center rounded-full px-3 text-sm text-slate-600 hover:bg-slate-100">
              Painel
            </Link>
            <Link href="/comecar" className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400">
              Criar minha igreja
            </Link>
          </div>
        </div>
      </nav>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-emerald-700">
            <HelpCircle className="h-4 w-4" />
            Central de ajuda
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Como usar o OIKOS Hub</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Cada parte do sistema explicada passo a passo. Se for a primeira vez, siga a ordem: criar a igreja, dados da igreja,
            primeiro boletim, equipe e escalas.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nesta página</p>
          <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {SECOES.map((secao) => (
              <li key={secao.id}>
                <a href={`#${secao.id}`} className="block rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-white hover:text-emerald-800">
                  {secao.titulo}
                </a>
              </li>
            ))}
            <li>
              <a href="#perguntas" className="block rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-white hover:text-emerald-800">
                Perguntas frequentes
              </a>
            </li>
          </ul>
        </aside>

        <div className="min-w-0 space-y-6">
          {SECOES.map((secao) => (
            <section key={secao.id} id={secao.id} className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{secao.titulo}</h2>
              <p className="mt-1 text-sm text-slate-500">{secao.resumo}</p>
              {secao.blocos.map(renderBloco)}
              {secao.onde && (
                <Link
                  href={secao.onde.href}
                  className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  {secao.onde.rotulo}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </section>
          ))}

          <section id="perguntas" className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Perguntas frequentes</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {PERGUNTAS.map((item) => (
                <details key={item.pergunta} className="group py-3">
                  <summary className="cursor-pointer list-none text-base font-medium text-slate-900 marker:hidden">
                    <span className="mr-2 inline-block text-emerald-600 transition group-open:rotate-90">›</span>
                    {item.pergunta}
                  </summary>
                  <p className="mt-2 pl-5 text-base leading-7 text-slate-700">{item.resposta}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="text-center text-sm text-slate-500">
            Não encontrou o que procurava?{' '}
            <Link href="/#contato" className="font-medium text-emerald-700 underline">
              Fale com a equipe OIKOS
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
