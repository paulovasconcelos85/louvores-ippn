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
sql/                           # Migrations e scripts datados
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

Os scripts SQL ficam em [`sql/`](sql/), nomeados por data (`YYYY-MM-DD_descricao.sql`). Eles cobrem o modelo multi-igreja, i18n de conteúdo, boletins, push e provisionamento.

Aplique no **SQL Editor do Supabase**, em ordem cronológica. Scripts de diagnóstico/reconciliação rodam dentro de transação com `rollback` — troque por `commit` só após revisar.

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
