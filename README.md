# Louvor Videira

Sistema de gerenciamento de repertórios para a equipe de louvor. Com ele, qualquer integrante abre o site no celular e sabe na hora:

- **O que vamos tocar hoje?** Próximo culto no topo do dashboard, com a ordem das músicas.
- **Qual o tom?** O tom aparece em destaque em todos os lugares, com transposição de cifra com `−` / `+`.
- **Qual vídeo devo estudar?** Player do YouTube/Vimeo incorporado em cada música.
- **Qual é a ordem?** Setlist numerada, com navegação *anterior / próxima* dentro do repertório.
- **Quem está escalado?** A escala por função aparece dentro de cada repertório.

## Tecnologias

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router 7 · Lucide React · dnd-kit (arrastar e soltar) · Supabase (opcional) · Vitest

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de produção em dist/
npm run preview    # serve o build
npm run test       # testes unitários (Vitest)
npm run lint       # oxlint
```

Sem nenhuma configuração, o app roda em **modo demonstração**: os dados de demonstração (18 músicas, 12 integrantes, 7 repertórios, 5 ensaios, 14 eventos, escalas e notificações) ficam no `localStorage` do navegador. As datas são geradas **em relação ao dia atual**, então sempre há um "próximo culto" no domingo seguinte.

> Letras, cifras, artistas e integrantes são fictícios. Os vídeos de estudo são *pads* de ensaio públicos do YouTube, um por tonalidade.

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

No modo demonstração, troque de perfil em **Configurações → Perfil de acesso**.

## Arquitetura

```
src/
├── types/            # Modelo de domínio (espelha as tabelas do banco)
├── lib/              # Lógica pura: tonalidades/cifras, vídeos, datas, validação, permissões
├── data/seed/        # Dados de demonstração (datas relativas ao dia atual)
├── services/
│   ├── db/           # Contrato DataProvider + LocalProvider (localStorage) + SupabaseProvider
│   ├── relations.ts  # Montagem dos agregados (joins)
│   └── *Service.ts   # Regras de negócio por domínio (sem dependência de UI)
├── hooks/            # useQuery (cache + revalidação automática), useMutation, useForm, useUrlState…
├── contexts/         # Tema, sessão/permissões, toasts, confirmação
├── components/
│   ├── ui/           # Design system: Button, Modal, Drawer, Toast, Dropdown, Tabs, EmptyState…
│   ├── layout/       # Sidebar (desktop), BottomNav (celular), Topbar
│   └── songs|repertoires|events|members|schedules|rehearsals|calendar|search|notifications
├── pages/            # Uma página por rota (carregadas sob demanda)
└── routes/           # React Router + tela de erro
```

- **UI e lógica separadas.** As páginas usam hooks (`useRepertoire`, `useSongs`…), os hooks chamam os *services*, e os *services* falam com um `DataProvider`.
- **Revalidação automática.** Cada escrita emite quais tabelas mudaram. As consultas que dependem delas recarregam sozinhas, seja nesta aba, em outra aba ou via Supabase Realtime.
- **Componentes pedidos:** `SongCard`, `RepertoireCard`, `MemberCard`, `EventCard`, `SongPlayer`, `SongLyrics`, `SongChords`, `KeySelector`, `MusicStatus`, `ScheduleCard`, `Calendar`, `SearchBar`, `Modal`, `Drawer`, `Toast`, `Dropdown`, `Tabs`, `EmptyState`, `LoadingState`, `ConfirmationDialog`.

## Colocar no ar com login real (Supabase + Vercel)

Sem configuração, o app roda em **modo demonstração** (dados fictícios, sem login). Para a equipe usar de verdade, com login, dados compartilhados e um administrador real, siga os passos abaixo. Supabase e Vercel têm planos gratuitos.

### 1. Banco de dados e login (Supabase)
1. Crie uma conta em [supabase.com](https://supabase.com) → **New project** (região *South America (São Paulo)*). Guarde a senha do banco.
2. No menu do projeto, abra **SQL Editor** → **New query**, cole todo o conteúdo de [`supabase/setup.sql`](supabase/setup.sql) e clique em **Run**. Isso cria as tabelas, as permissões e a regra *"a primeira conta criada vira administrador"*.
3. Abra **Project Settings → API** e copie:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`)
   - chave **anon public**. Ela pode ficar no site; **nunca** use a chave `service_role` no app.

### 2. Hospedagem (Vercel)
1. Entre em [vercel.com](https://vercel.com) com sua conta do GitHub → **Add New… → Project** → importe o repositório `LouvorVIDEIRA`.
2. O framework **Vite** é detectado sozinho (build `npm run build`, saída `dist`).
3. Em **Environment Variables**, adicione:
   | Nome | Valor |
   | --- | --- |
   | `VITE_DATA_PROVIDER` | `supabase` |
   | `VITE_SUPABASE_URL` | a Project URL |
   | `VITE_SUPABASE_ANON_KEY` | a chave anon public |
4. Clique em **Deploy**. Ao final, a Vercel mostra o endereço do site (ex.: `https://louvor-videira.vercel.app`).

### 3. Ligar o site ao login
No Supabase, abra **Authentication → URL Configuration**:
- **Site URL**: o endereço da Vercel (ex.: `https://louvor-videira.vercel.app`)
- **Redirect URLs**: adicione `https://louvor-videira.vercel.app/**`

Sem isso, os links de confirmação de e-mail e de nova senha apontam para `localhost`.

### 4. Criar o administrador
1. Abra o site → **Criar conta** com seu nome, e-mail e senha.
2. Confirme o e-mail pelo link recebido e entre. **A primeira conta criada é automaticamente o Administrador.**
3. Pronto: o banco começa vazio, sem dados fictícios. Cadastre músicas, equipe e repertórios.

### 5. Trazer a equipe
- **Convite (recomendado):** cadastre o integrante em **Equipe** com o e-mail dele e clique em **Administração → Convidar**. Quando a pessoa criar conta com esse e-mail, o acesso é liberado sozinho.
- **Cadastro livre:** a pessoa cria conta no site e aparece em **Administração → Aguardando aprovação**. Aprove e defina o nível (Administrador, Líder ou Integrante).
- Em **Administração** também dá para revogar ou remover o acesso de alguém.

> O Supabase gratuito envia poucos e-mails por hora. Se a equipe for grande, cadastre as pessoas aos poucos ou configure um SMTP próprio em **Authentication → Emails**.

### Como funciona por dentro
- `supabase/setup.sql` = `migrations/0001_initial_schema.sql` (tabelas, índices, Realtime) + `migrations/0002_auth_and_first_admin.sql` (primeiro administrador, aprovação, RLS).
- As permissões são aplicadas **no banco** (Row Level Security): quem não está aprovado não lê nada, e só líderes e administradores alteram músicas, repertórios e escalas.
- As colunas usam `snake_case`; o `SupabaseProvider` converte para `camelCase`.
- `supabase/dev/open_policies_for_prototyping.sql` libera o acesso anônimo apenas para testes locais. **Não use em produção.**

## Deploy estático (modo demonstração)

É uma SPA estática (`dist/`). Inclui `vercel.json` e `public/_redirects` (Netlify) com fallback de rotas para `index.html`.

## Testes

`npm run test` cobre a lógica crítica:
- transposição de tons e acordes (G → G# → A → A# → B), com alinhamento preservado;
- leitura de cifras (seções, acordes sobre a letra, ChordPro inline);
- detecção de links do YouTube e Vimeo;
- datas e semanas;
- cálculo de preparação (ex.: 75%);
- integridade referencial dos dados de demonstração.
