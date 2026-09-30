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

Sem nenhuma configuração, `npm run dev` já funciona: a API usa um **PostgreSQL local** (PGlite, gravado em `.pglite/`), aplica as migrations e carrega os dados de exemplo. Para entrar localmente, defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no `.env.local` **antes** do primeiro `npm run dev` (o administrador é criado junto com os dados). Criar contas pelo site exige o envio de e-mails configurado (veja [Cadastro e confirmação de e-mail](#cadastro-e-confirmação-de-e-mail)).

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
│   ├── auth.ts       # Senhas (scrypt), sessões, cookie httpOnly e token de confirmação
│   ├── accounts.ts   # Cadastro, confirmação do e-mail, login, aprovação, recusa e suspensão
│   ├── email.ts      # Envio pelo Resend e modelos dos e-mails
│   ├── emailValidation.ts # Formato, domínios descartáveis e registros MX
│   ├── rateLimit.ts  # Limite de tentativas (guardado no banco)
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
| `/api/auth/session`, `signup`, `verify-email`, `resend-verification`, `change-email`, `login`, `logout`, `password` | GET, POST | Cadastro, confirmação do e-mail, login e senha |
| `/api/users/:id/approve`, `reject`, `suspend`, `reset-password` | POST | Aprovar, recusar, suspender e senha temporária (administrador) |
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
- Limite de tentativas (guardado no banco, vale entre as funções): login por IP e por e-mail, cadastros por IP, e-mails de confirmação por IP e por endereço (60 s entre envios, no máximo 5 por hora).
- Mensagens de erro nunca expõem detalhes do banco.
- Arquivos: tipo identificado pelo conteúdo (JPG, PNG, WEBP, GIF, PDF, MP3, M4A), limite de 4 MB, nome gerado pelo servidor. O binário vai para o Vercel Blob; o banco guarda só URL e metadados.
- A conexão usa o driver HTTP do Neon: cada requisição é independente, sem conexões persistentes abertas pelas funções.

## Cadastro e confirmação de e-mail

```
Criar conta → e-mail de confirmação → link confirmado → aguardando aprovação → administrador aprova → login
```

1. **Validação do endereço** (servidor): formato, bloqueio de e-mails temporários/descartáveis (`src/server/emailValidation.ts`) e checagem dos registros MX do domínio. Isso **não** confirma o e-mail; só evita endereços claramente inválidos.
2. **Confirmação real:** o sistema envia pelo **Resend** um link `/verify-email?token=…`. O token tem 256 bits, vale **24 horas**, é de **uso único** e o banco guarda só o **hash SHA-256** dele. Um novo envio invalida o link anterior.
3. **Só depois** da confirmação (`email_verified = true`) a conta passa para `PENDING_ADMIN_APPROVAL` e aparece em **Administração → Solicitações de acesso**, com aviso no sino dos administradores. O botão **Aprovar** fica desabilitado enquanto o e-mail não é confirmado (e o servidor também recusa).
4. **Aprovar** envia o e-mail "Seu acesso foi aprovado". **Recusar** permite informar o motivo e, opcionalmente, avisar por e-mail. **Suspender** encerra as sessões na hora.
5. **Login:** senha correta + e-mail confirmado + conta `APPROVED`. Caso contrário, a tela explica a situação (e-mail não confirmado, aguardando aprovação, recusado ou suspenso). A situação só é revelada para quem acertou a senha.
6. **Troca de e-mail:** antes da aprovação, a própria pessoa corrige o endereço na tela "Verifique seu e-mail" (com a senha). Se o administrador alterar o e-mail de alguém, o novo endereço precisa ser confirmado outra vez.

Status possíveis: `PENDING_EMAIL_VERIFICATION`, `PENDING_ADMIN_APPROVAL`, `APPROVED`, `REJECTED`, `SUSPENDED`. A **primeira conta** do sistema vira administrador assim que confirma o e-mail (use `ADMIN_EMAIL` para reservar esse primeiro acesso).

### Configurar o Resend
1. Crie uma conta em [resend.com](https://resend.com) → **Domains → Add Domain** e cadastre o domínio da igreja (ex.: `igrejavideira.com.br`). Adicione no DNS do domínio os registros que o Resend mostrar e espere ficar **Verified**.
2. **API Keys → Create API Key** (permissão *Sending access*) e copie a chave (`re_…`).
3. Na Vercel, em **Settings → Environment Variables**, crie `RESEND_API_KEY`, `EMAIL_FROM` (ex.: `Louvor Videira <nao-responda@igrejavideira.com.br>`) e `APP_URL` (o endereço do site, ex.: `https://louvor-videira.vercel.app`). Depois, faça um **Redeploy**.

> Sem domínio próprio, o Resend só permite enviar do endereço de testes `onboarding@resend.dev` e apenas para o e-mail da sua própria conta no Resend. Para a equipe receber os e-mails, é preciso verificar um domínio.

Sem essas variáveis, o cadastro responde "Envio de e-mails não configurado no servidor. Defina: …" e nada é gravado. O envio nunca é simulado.

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
As migrations ficam em `src/db/migrations/` e são aplicadas **manualmente**, nunca durante o deploy:

| Arquivo | Conteúdo |
| --- | --- |
| `0000_initial_schema.sql` | Tabelas iniciais |
| `0001_email_verification.sql` | Status da conta, confirmação de e-mail, aprovação/recusa e limite de tentativas. Contas que já tinham acesso continuam liberadas |

Se você aplica as migrations colando o SQL no **SQL Editor do Neon**, cole cada arquivo novo, em ordem, uma única vez. Ao alterar o schema:
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
7. Configure o envio de e-mails ([Configurar o Resend](#configurar-o-resend)).
8. Faça o deploy e abra o site. **Crie a sua conta e confirme o e-mail: a primeira conta vira administrador.**

Depois, a cada mudança no schema: `npm run db:generate` → revise o SQL → `npm run db:migrate` → deploy.

### Trazer a equipe
- **Cadastro:** a pessoa cria a conta no site e confirma o e-mail. A solicitação aparece em **Administração → Solicitações de acesso**; aprove e defina o nível de acesso.
- **Convite:** cadastre o integrante em **Equipe** com o e-mail dele e clique em **Administração → Convidar**. Quando a pessoa criar a conta com esse e-mail e confirmar o endereço, ela já chega com o nível e o vínculo definidos; é só aprovar.
- **Esqueceu a senha?** O administrador gera uma senha temporária em **⋯ → Gerar senha temporária** (só para quem já confirmou o e-mail; as sessões antigas são encerradas).

### Variáveis de ambiente

| Variável | Onde | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | Servidor | Sim (produção) | Conexão com o Neon, criada pela integração |
| `BLOB_READ_WRITE_TOKEN` | Servidor | Para upload | Criada ao conectar o Blob store |
| `RESEND_API_KEY` | Servidor | Sim (cadastro) | Chave da API do Resend |
| `EMAIL_FROM` | Servidor | Sim (cadastro) | Remetente com domínio verificado no Resend |
| `APP_URL` | Servidor | Sim (cadastro) | Endereço do site usado nos links dos e-mails |
| `ADMIN_EMAIL` | Servidor | Não | Restringe quem cria a primeira conta de administrador |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Local | Não | Administrador criado pelo seed de desenvolvimento |
| `VITE_DATA_PROVIDER` | Build | Não | `demo` gera a versão de demonstração sem banco |

## Modo demonstração

`npm run build:demo` gera um site estático sem banco: os dados fictícios ficam no `localStorage` do navegador, sem login, com troca de perfil em Configurações para testar os níveis de acesso. As datas são geradas em relação ao dia atual. Inclui `public/_redirects` para hospedagens estáticas.

## Testes

`npm run test` cobre:
- transposição de tons e acordes, leitura de cifras, links do YouTube/Vimeo, datas e cálculo de preparação;
- integridade dos dados de demonstração;
- **API contra um PostgreSQL real em memória** (mesmas migrations e seed): login, primeiro administrador, aprovação, permissões no servidor, tentativa de elevar o próprio nível de acesso, validação (400), conflitos (409), 404, CSRF, favoritos pessoais, senha temporária, logout e upload sem Blob configurado;
- **cadastro e confirmação de e-mail** (`accounts.server.test.ts`): formatos inválidos, descartáveis e domínio sem MX, e-mail já existente, conteúdo do e-mail, link, token expirado e reutilizado, reenvio e limites, login em cada situação, aprovação bloqueada sem confirmação, aprovação, recusa, suspensão, troca de e-mail e segurança dos tokens.
