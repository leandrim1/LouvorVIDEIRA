# Louvor Videira

Sistema de gerenciamento de repertórios para a equipe de louvor. Com ele, qualquer integrante abre o site no celular e sabe na hora:

- **O que vamos tocar hoje?** Próximo culto no topo do dashboard, com a ordem das músicas.
- **Qual o tom?** O tom aparece em destaque em todos os lugares, com transposição de cifra com `−` / `+`.
- **Qual vídeo devo estudar?** Player do YouTube/Vimeo incorporado em cada música.
- **Qual é a ordem?** Setlist numerada, com navegação *anterior / próxima* dentro do repertório.
- **Quem está escalado?** A escala por função aparece dentro de cada repertório.

## Tecnologias

**Frontend:** React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router 7 · Lucide React · dnd-kit (arrastar e soltar)

**Backend:** Vercel Functions · Drizzle ORM + Drizzle Kit · Neon PostgreSQL · Zod (validação) · Vercel Blob (arquivos)

**Qualidade:** Vitest (lógica e API contra um PostgreSQL real em memória) · oxlint

```
React (navegador)  →  /api (Vercel Functions)  →  Drizzle ORM  →  Neon PostgreSQL
                                               →  Vercel Blob (fotos, capas, PDFs)
```

O navegador **nunca** acessa o banco: a `DATABASE_URL` e os tokens existem só no servidor.

## Como rodar

Requer Node.js 20.12 ou superior.

```bash
npm install
npm run dev        # http://localhost:5173 (site + API)
```

Sem nenhuma configuração, `npm run dev` já funciona: a API usa um **PostgreSQL local** (PGlite, gravado em `.pglite/`), aplica as migrations e carrega os dados de exemplo. A primeira conta criada no site vira o **administrador**.

Para usar o banco Neon da Vercel no desenvolvimento, crie `.env.local` com a `DATABASE_URL` (veja [Banco de dados](#banco-de-dados-neon--drizzle)).

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Site + API em modo desenvolvimento |
| `npm run build` | Verificação de tipos (site, API e banco) + build de produção em `dist/` |
| `npm run build:demo` | Build de demonstração, sem banco (dados fictícios no navegador) |
| `npm run test` | Testes (lógica musical, datas, seed e API) |
| `npm run lint` | oxlint |
| `npm run db:generate` | Gera uma nova migration a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica as migrations pendentes |
| `npm run db:push` | Sincroniza o schema direto no banco, sem migration (apenas protótipos) |
| `npm run db:studio` | Abre o Drizzle Studio para ver e editar os dados |
| `npm run db:seed` | Carrega os dados de desenvolvimento (`-- --reset` apaga e recria) |

Os comandos `db:*` usam a `DATABASE_URL` do `.env.local`; sem ela, usam o banco local `.pglite/`. Pare o `npm run dev` antes de rodar `db:*` no banco local, pois ele só aceita um processo por vez.

> Letras, cifras, artistas, integrantes, e-mails (`@louvorvideira.example`) e telefones dos dados de exemplo são fictícios. Os vídeos de estudo são *pads* de ensaio públicos do YouTube.

## Funcionalidades

| Módulo | Destaques |
| --- | --- |
| **Dashboard** | Próximo culto (dia, data, horário, tipo, local, nº de músicas), repertório da semana com tom, vocal, instrumentação e status, sua preparação (%), sua escala, próximo ensaio e próximos eventos (tabela no desktop, cards no celular) |
| **Repertórios** | Abas Próximos / Esta semana / Este mês / Anteriores / Todos, filtros de semana, mês, ano, tipo e status (sincronizados com a URL), agrupamento por mês ou por evento, criação e edição com busca de músicas, **arrastar e soltar**, setas e teclado para reordenar, tom por música, vocal, instrumentação e observação, **Duplicar repertório** (data +7 dias), compartilhar como texto para WhatsApp, proteção contra perda de alterações |
| **Página do repertório** | Cabeçalho do culto, observações, ordem com botões *Ver música · Vídeo · Cifra · Letra*, preparação individual (status + checklist), escala e ensaios |
| **Músicas** | Biblioteca com busca, filtros (tom, artista, favoritas), ordenação (A–Z, recentes, mais usadas) e visualização em grade ou lista. Cadastro completo com capa (upload redimensionado ou URL), tons, BPM, capotraste, afinação, compasso, cifra com prévia, letra (gerada da cifra), vídeos e links |
| **Página da música** | Ações rápidas (assistir vídeo, ouvir, cifra, letra, acordes), seletor de tom `[−] G [+]` com transposição da cifra, "definir como tom da equipe" (atualiza os próximos repertórios e notifica), abas Cifra / Letra / Vídeos / Links / Observações, histórico de uso e navegação dentro do repertório |
| **Leitor de cifra/letra** | Acordes destacados e alinhados, fonte ajustável, **tela cheia** com tela sempre acesa (Wake Lock), rolagem automática com velocidade ajustável, leitura confortável no modo escuro |
| **Calendário** | Visões mensal, semanal e lista, filtro por tipo de evento; o evento abre um painel com repertório + escala e ações (criar repertório, montar escala, editar, excluir) |
| **Escalas** | Escala por culto com integrantes agrupados por função (cards), "minhas escalas", cópia em texto, notificação aos escalados |
| **Ensaios** | Data, horário, local, observações e repertório relacionado (nº de músicas) |
| **Equipe** | Integrantes com foto, funções, instrumento, vocal, contato (WhatsApp, telefone, e-mail), observações e próximas escalas |
| **Minhas músicas** | Favoritas, recentemente acessadas e mais utilizadas |
| **Busca global** | `Ctrl/⌘ + K` ou `/`: músicas, artistas, **tons** ("Tom C"), integrantes, repertórios e eventos, com a última utilização |
| **Notificações** | Novo repertório, mudança de tom, ensaio agendado, "você foi escalado" |
| **Administração** | Atalhos de criação, usuários e níveis de acesso (Administrador, Líder, Integrante) e matriz de permissões |
| **Configurações** | Tema claro, escuro ou do sistema, tamanho de leitura, troca de perfil de demonstração, exportar backup e restaurar a demonstração |

Estados de carregamento (skeleton), estados vazios, tratamento de erros, toasts, confirmação antes de excluir, validação de formulários, acessibilidade (foco visível, navegação por teclado, ARIA, *skip link*) e SEO básico (meta tags, Open Graph, manifest, títulos por página) estão em todas as telas.

### Níveis de acesso

| Perfil | Pode |
| --- | --- |
| **Administrador** | Tudo, inclusive alterar permissões |
| **Líder** | Músicas, repertórios, eventos, escalas, ensaios e integrantes |
| **Integrante** | Consultar repertórios, músicas e escalas; registrar preparação, favoritos e observações |

As permissões são verificadas **no servidor** a cada requisição (a interface apenas esconde o que a pessoa não pode fazer). No modo demonstração, troque de perfil em **Configurações → Perfil de acesso**.

## Arquitetura

```
api/
└── index.ts          # Vercel Function única: recebe /api/* (rewrite em vercel.json)
src/
├── db/
│   ├── schema.ts     # Tabelas, enums, índices e relacionamentos (Drizzle)
│   ├── index.ts      # Conexão com o Neon (driver HTTP, sem conexão persistente)
│   ├── migrations/   # SQL gerado pelo Drizzle Kit (versionado)
│   ├── migrate.ts    # npm run db:migrate
│   ├── seed.ts       # npm run db:seed (somente desenvolvimento)
│   └── local.ts      # PostgreSQL local (PGlite) para desenvolvimento e testes
├── server/
│   ├── router.ts     # Rotas da API, CRUD genérico, lote de leituras, exportação
│   ├── resources.ts  # Validação Zod e regras de permissão por tabela
│   ├── auth.ts       # Senhas (scrypt), sessões e cookie httpOnly
│   ├── files.ts      # Upload para o Vercel Blob
│   ├── http.ts       # Respostas e erros padronizados
│   └── dev.ts        # API no `npm run dev`
├── types/            # Tipos do domínio, derivados do schema do banco
├── lib/              # Lógica pura: tonalidades/cifras, vídeos, datas, validação, permissões
├── data/seed/        # Dados do modo demonstração
├── services/
│   ├── apiClient.ts  # fetch para /api (cookie de sessão, erros)
│   ├── db/           # Contrato DataProvider + ApiProvider (API) + LocalProvider (demonstração)
│   ├── relations.ts  # Montagem dos agregados (joins)
│   └── *Service.ts   # Regras de negócio por domínio (sem dependência de UI)
├── hooks/            # useQuery (cache + revalidação automática), useMutation, useForm, useUrlState…
├── contexts/         # Tema, login, sessão/permissões, toasts, confirmação
├── components/       # Design system, layout e componentes de cada módulo
├── pages/            # Uma página por rota (carregadas sob demanda)
└── routes/           # React Router + tela de erro
```

- **UI e dados separados.** As páginas usam hooks, os hooks chamam os *services*, e os *services* falam com um `DataProvider`. Com o banco, o `ApiProvider` chama a API; na demonstração, o `LocalProvider` usa o navegador.
- **Menos chamadas.** Leituras feitas ao mesmo tempo (ex.: o dashboard) viram uma única chamada a `/api/batch`.
- **Revalidação automática.** Cada escrita avisa quais tabelas mudaram e as telas que dependem delas recarregam. Ao voltar para o app, os dados são atualizados.

### API

| Rota | Métodos | Descrição |
| --- | --- | --- |
| `/api/songs`, `/api/song-videos`, `/api/song-links`, `/api/song-notes` | GET, POST, PATCH, DELETE | Músicas, vídeos, links e observações |
| `/api/repertoires`, `/api/repertoire-songs` | GET, POST, PATCH, DELETE | Repertórios e a ordem das músicas |
| `/api/members`, `/api/users` | GET, POST, PATCH, DELETE | Integrantes e usuários (níveis de acesso) |
| `/api/events`, `/api/rehearsals` | GET, POST, PATCH, DELETE | Eventos e ensaios |
| `/api/schedules`, `/api/schedule-members` | GET, POST, PATCH, DELETE | Escalas e escalados |
| `/api/notifications` | GET, POST, PATCH, DELETE | Notificações |
| `/api/favorites`, `/api/song-views` | GET, POST, DELETE | Favoritos e histórico (cada pessoa vê só os seus) |
| `/api/song-preparations` | GET, POST, PATCH, DELETE | Preparação individual |
| `/api/files` | GET, POST (multipart), DELETE | Arquivos no Vercel Blob |
| `/api/auth/session`, `signup`, `login`, `logout`, `password` | GET, POST | Login e senha |
| `/api/users/:id/reset-password` | POST | Senha temporária (administrador) |
| `/api/batch` | POST | Até 30 leituras em uma chamada |
| `/api/export` | GET | Backup em JSON (administrador) |
| `/api/health` | GET | Verifica a conexão com o banco |

Listagens aceitam filtros por coluna (`/api/songs?artist=…`, `?memberId=null`). Respostas de sucesso vêm em `{ "data": … }` e erros em `{ "error": { "code", "message", "details" } }`, com status 200, 201, 204, 400, 401, 403, 404, 409, 413, 500 ou 503.

### Segurança

- Toda operação no banco acontece no servidor; o frontend não conhece a `DATABASE_URL` nem os tokens.
- Todos os dados recebidos são validados com **Zod** (schemas derivados das tabelas); campos que o cliente não pode definir (senha, datas de criação, autor) são ignorados.
- As **permissões são verificadas no servidor** com base na sessão gravada no banco, nunca no que o navegador envia. Integrantes só alteram a própria preparação, favoritos, observações e leitura de notificações.
- Senhas com **scrypt**; a sessão é um token aleatório em cookie `httpOnly`/`SameSite=Lax` (`Secure` em HTTPS), e o banco guarda apenas o hash dele.
- Requisições que alteram dados precisam vir do próprio site (proteção contra CSRF).
- Mensagens de erro nunca expõem detalhes do banco.
- Arquivos: tipo identificado pelo conteúdo (JPG, PNG, WEBP, GIF, PDF, MP3, M4A), limite de 4 MB, nome gerado pelo servidor. O binário vai para o Vercel Blob; o banco guarda só URL e metadados.
- A conexão usa o driver HTTP do Neon: cada requisição é independente, sem conexões persistentes abertas pelas funções.

## Banco de dados (Neon + Drizzle)

### Tabelas

`users`, `sessions`, `members`, `songs`, `song_videos`, `song_links`, `song_notes`, `favorites`, `song_views`, `events`, `repertoires`, `repertoire_songs`, `schedules`, `schedule_members`, `rehearsals`, `song_preparations`, `notifications` e `files`, com chaves estrangeiras, exclusão em cascata onde faz sentido (ex.: excluir uma música remove vídeos, links e itens de repertório) e índices nas colunas de busca. O schema fica em [`src/db/schema.ts`](src/db/schema.ts).

### 1. Criar o banco pela Vercel
1. No painel da Vercel, abra o projeto → **Storage** → **Create Database** → **Neon** (Marketplace) → escolha a região mais próxima da equipe (ex.: *São Paulo*) e crie.
2. Conecte o banco ao projeto nos ambientes **Production**, **Preview** e **Development**. A Vercel cria a variável **`DATABASE_URL`** sozinha.

### 2. Usar a `DATABASE_URL` na sua máquina
```bash
npm i -g vercel
vercel link              # associa a pasta ao projeto da Vercel
vercel env pull .env.local
```
O arquivo `.env.local` fica fora do Git (veja `.gitignore`). Nunca coloque valores reais no `.env.example`.

### 3. Criar as tabelas (migrations)
```bash
npm run db:migrate
```
As migrations ficam em `src/db/migrations/` e são aplicadas **manualmente**, nunca durante o deploy. Ao alterar o schema:
```bash
npm run db:generate      # gera o SQL da mudança, revise antes de aplicar
npm run db:migrate
```

### 4. Dados de exemplo (opcional, só desenvolvimento)
```bash
npm run db:seed
```
Carrega 15 músicas, 8 integrantes, 5 eventos com repertório, 3 ensaios, 3 escalas e 10 notificações. O seed recusa rodar em produção (`VERCEL_ENV=production`) e em um banco que já tem dados (use `-- --reset` para apagar tudo e recriar). Para criar também um administrador, defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no `.env.local`.

### 5. Ver os dados
```bash
npm run db:studio        # Drizzle Studio em https://local.drizzle.studio
```
Também dá para usar o **SQL Editor** do Neon (painel da Vercel → Storage → o banco → *Open in Neon*).

## Deploy na Vercel

1. Importe o repositório na Vercel (**Add New… → Project**). O framework **Vite** é detectado; build `npm run build`, saída `dist`. O `vercel.json` já envia `/api/*` para a função da API e as demais rotas para o site.
2. Crie e conecte o banco Neon (passo 1 acima).
3. **Arquivos:** em **Storage → Create → Blob**, crie um *Blob store* com acesso **público** e conecte ao projeto. A Vercel cria `BLOB_READ_WRITE_TOKEN`. Sem ele, o site funciona, mas o envio de fotos e capas mostra "Armazenamento de arquivos não configurado".
4. Recomendado: em **Settings → Functions → Function Region**, escolha a mesma região do banco (ex.: São Paulo, `gru1`) para respostas mais rápidas.
5. Opcional: em **Settings → Environment Variables**, defina `ADMIN_EMAIL` com o seu e-mail para que só você possa criar a conta de administrador.
6. Na sua máquina, com a `DATABASE_URL` de produção no `.env.local`, rode `npm run db:migrate`.
7. Faça o deploy e abra o site. **Crie a sua conta: a primeira vira administrador.**

Depois, a cada mudança no schema: `npm run db:generate` → revise o SQL → `npm run db:migrate` → deploy.

### Trazer a equipe
- **Convite:** cadastre o integrante em **Equipe** com o e-mail dele, clique em **Administração → Convidar** e depois em **⋯ → Gerar senha temporária**. Envie a senha por um canal privado; a pessoa entra e troca a senha em **Configurações**.
- **Cadastro livre:** a pessoa cria conta no site e aparece em **Administração → Aguardando aprovação**. Aprove e defina o nível de acesso.
- **Esqueceu a senha?** O administrador gera uma senha temporária em **⋯ → Gerar senha temporária** (as sessões antigas da pessoa são encerradas).

### Variáveis de ambiente

| Variável | Onde | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | Servidor | Sim (produção) | Conexão com o Neon, criada pela integração |
| `BLOB_READ_WRITE_TOKEN` | Servidor | Para upload | Criada ao conectar o Blob store |
| `ADMIN_EMAIL` | Servidor | Não | Restringe quem cria a primeira conta de administrador |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Local | Não | Administrador criado pelo seed de desenvolvimento |
| `VITE_DATA_PROVIDER` | Build | Não | `demo` gera a versão de demonstração sem banco |

## Modo demonstração

`npm run build:demo` gera um site estático sem banco: os dados fictícios ficam no `localStorage` do navegador, sem login, com troca de perfil em Configurações para testar os níveis de acesso. As datas são geradas em relação ao dia atual. Inclui `public/_redirects` para hospedagens estáticas.

## Testes

`npm run test` cobre:
- transposição de tons e acordes, leitura de cifras, links do YouTube/Vimeo, datas e cálculo de preparação;
- integridade dos dados de demonstração;
- **API contra um PostgreSQL real em memória** (mesmas migrations e seed): login, primeiro administrador, aprovação, permissões no servidor, tentativa de elevar o próprio nível de acesso, validação (400), conflitos (409), 404, CSRF, favoritos pessoais, senha temporária, logout e upload sem Blob configurado.
