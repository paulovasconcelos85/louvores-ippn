# OIKOS Hub

> A igreja organizada sem perder o cuidado pastoral.

Plataforma **multi-igreja** de gestão ministerial: boletins, cultos, escalas, repertório musical, cadastro de membros e cuidado pastoral — tudo em um só lugar, com páginas públicas por igreja e app iOS.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura multi-igreja](#arquitetura-multi-igreja)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Começando](#começando)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Autenticação e acesso](#autenticação-e-acesso)
- [Internacionalização](#internacionalização)
- [Deploy](#deploy)
- [App iOS](#app-ios)

---

## Funcionalidades

| Área | O que faz |
|------|-----------|
| **Boletim** | Edição estruturada, publicação pública e compartilhável, histórico de boletins anteriores |
| **Cultos** | Programação litúrgica, modelos de liturgia (incl. tons musicais maiores/menores) |
| **Escalas** | Montagem e visualização de escalas de equipe por culto |
| **Repertório** | Cânticos com cifra, letra e tom; repertório público por igreja |
| **Pessoas** | Cadastro de membros, cargos/funções, tags de habilidade, controle de acesso |
| **Cuidado pastoral** | Pedidos pastorais categorizados, com fluxo de acompanhamento |
| **Páginas públicas** | Apresentação institucional da igreja, cadastro público, pedidos via slug |
| **Multi-idioma** | Português, Espanhol e Inglês com detecção automática |
| **Push (iOS)** | Notificações via APNs |

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 3**
- **Supabase** — Postgres, Auth, Storage (`@supabase/ssr`)
- **jsPDF** (geração de PDF), **Recharts** (gráficos), **lucide-react** (ícones)
- Deploy em **Vercel**

## Arquitetura multi-igreja

O modelo de dados separa **pessoa** (cadastro ministerial) de **acesso** (login), e ambos se relacionam com **igrejas** via tabelas de vínculo. Esse é o coração do sistema:

```
auth.users ───┐
              │ (auth_user_id)
              ▼
        usuarios_acesso ──< usuarios_igrejas >── igrejas
              │ (pessoa_id)                         │
              ▼                                      │
          pessoas ─────────< pessoas_igrejas >──────┘
```

- `pessoas` — cadastro da pessoa (sem `igreja_id`; o vínculo é só via `pessoas_igrejas`)
- `pessoas_igrejas` — vínculo pessoa↔igreja (cargo, status, ativo)
- `usuarios_acesso` — espelho de acesso da pessoa (liga `auth_user_id`)
- `usuarios_igrejas` — vínculo de acesso↔igreja
- `igrejas` — igrejas, identificadas por `slug` (ex.: `ippn-manaus`)

**Triggers** no Postgres sincronizam automaticamente: ao criar/atualizar `pessoas`/`pessoas_igrejas`, o banco gera/atualiza `usuarios_acesso` e `usuarios_igrejas`. O campo `tem_acesso` **não é coluna** — é calculado na API a partir de `usuario_id`.

## Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/login/          # Login / primeiro acesso (signup aberto c/ seleção de igreja)
│   ├── (sistema)/             # Área autenticada: admin, boletim, cultos, cânticos, perfil…
│   ├── [slug]/                # Página pública da igreja
│   ├── cadastro/[slug]/       # Cadastro público por igreja
│   ├── pedidos/[slug]/        # Pedidos pastorais públicos
│   ├── oikos/                 # Landing institucional
│   ├── privacidade/           # Política de privacidade (pt/es/en)
│   └── api/                   # Route handlers (pessoas, finalizar-acesso, admin, …)
├── components/
├── hooks/
├── lib/                       # access-sync, permissions, supabase client, …
└── i18n/                      # Locale (pt/es/en), provider, messages
supabase/migrations/           # Migrations versionadas do banco
sql/historico/                 # Scripts antigos, aplicados à mão (só registro)
```

## Começando

Pré-requisitos: **Node 20+** e um projeto Supabase.

```bash
npm install
cp .env.local.example .env.local   # preencha as chaves (ver abaixo)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Scripts:

| Comando | Ação |
|---------|------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |

## Variáveis de ambiente

Obrigatórias:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Opcionais (por funcionalidade):

```env
# Mapas
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=

# Push iOS (APNs)
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=
APNS_PRIVATE_KEY=          # ou
APNS_PRIVATE_KEY_BASE=     # base64

# Jobs agendados
CRON_SECRET=
```

> `SUPABASE_SERVICE_ROLE_KEY` é secreta — nunca exponha no cliente.

## Banco de dados e migrations

O banco é versionado em [`supabase/migrations/`](supabase/migrations/). As três primeiras migrações (15/11/2026) reproduzem a produção inteira: o schema `public`, os objetos de `auth`/`storage` e as permissões (grants). Os scripts antigos, aplicados à mão, estão em [`sql/historico/`](sql/historico/) só como registro.

Pré-requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) e o [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start                      # sobe o Supabase local (Postgres em 127.0.0.1:54322)
supabase migration new descricao    # cria supabase/migrations/<data>_descricao.sql
supabase db reset                   # recria o banco local do zero com todas as migrações
supabase db push                    # aplica na produção as migrações que faltam
supabase stop                       # desliga os containers
```

Fluxo para mudar o banco: crie a migração, rode `supabase db reset` e `npm run test:db`, faça o commit e só então aplique na produção.

## Testes

```bash
npm test          # testes de código (vitest): finanças, validação, permissões, boletim
npm run test:db   # testes do banco (pgTAP), com o Supabase local rodando
```

Os testes do banco ficam em [`supabase/tests/database/`](supabase/tests/database/). O `rls_entre_igrejas.test.sql` cria duas igrejas fictícias com pastor, superadmin, líder de louvor e membro, e verifica o que cada um consegue ler e alterar: cultos, liturgia, cânticos, escalas, pessoas, notas pastorais, convites, Tesouraria e imagens. Toda mudança de RLS, grant ou trigger deve passar por eles; se a mudança for intencional, atualize o teste junto.

O Supabase local dá a `anon`/`authenticated` acesso a tudo o que é criado. Ao criar tabela ou função, escreva na própria migração os `revoke`/`grant` que ela deve ter.

## Autenticação e acesso

- **Métodos:** e-mail/senha, Google e Microsoft (OAuth)
- **Signup aberto:** no "Primeiro acesso" o usuário escolhe a igreja; a conta é criada e provisionada automaticamente (`src/lib/access-sync.ts`)
- **Sincronização:** `/api/finalizar-acesso` liga o usuário Auth às tabelas da aplicação após o login/cadastro
- **Cargos:** `membro`, `diacono`, `presbitero`, `pastor`, `seminarista`, `staff`, `musico`, `admin`, `superadmin`
- **Gestão de acesso:** admins ativam/inativam usuários em `/admin/usuarios`

> A função Postgres `email_permitido()` controla quem pode se cadastrar. Para signup totalmente aberto, ela retorna `true`.

## Internacionalização

Locales suportados: **pt** (padrão), **es**, **en**. Detecção via cookie `oikos-locale` → `accept-language`. Provider em `src/i18n/`, mensagens em `src/i18n/messages`. Páginas server-side usam `getRequestLocale()`.

## Deploy

Deploy contínuo na **Vercel**. Configure as variáveis de ambiente no projeto Vercel. `vercel.json` define ajustes de runtime/cron.

## App iOS

App nativo iOS (WebView/wrapper) em submissão na App Store. Push via **APNs**. Política de privacidade pública obrigatória: **`/privacidade`**.

---

<p align="center"><sub>OIKOS Hub — Gestão Integral Multi-igreja</sub></p>
