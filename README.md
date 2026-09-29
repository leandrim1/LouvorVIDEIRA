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

Sem nenhuma configuração, o app roda em **modo local**: os dados de demonstração (18 músicas, 12 integrantes, 7 repertórios, 5 ensaios, 14 eventos, escalas e notificações) ficam no `localStorage` do navegador. As datas são geradas **em relação ao dia atual**, então sempre há um "próximo culto" no domingo seguinte.

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

## Integração com Supabase

A troca de backend não exige reescrever a aplicação, só configurar o provedor:

1. Crie um projeto no Supabase e execute `supabase/migrations/0001_initial_schema.sql` no SQL Editor. Ele cria as tabelas `users`, `members`, `songs`, `repertoires`, `repertoire_songs`, `events`, `schedules`, `schedule_members`, `song_videos`, `song_links`, `song_notes`, `rehearsals`, `favorites`, `song_views`, `song_preparations` e `notifications`, com chaves estrangeiras, índices, triggers, **RLS por nível de acesso** e Realtime.
2. Copie `.env.example` para `.env` e preencha:
   ```env
   VITE_DATA_PROVIDER=supabase
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   ```
3. Para testar antes de integrar o login, execute também `supabase/dev/open_policies_for_prototyping.sql` (libera o papel `anon`; **não use em produção**) e clique em **Configurações → Restaurar demonstração** para popular o banco.
4. Para produção, integre o Supabase Auth: vincule `users.auth_user_id` ao `auth.uid()` e resolva o usuário atual no `SessionProvider`. As políticas RLS já usam `auth.uid()`.

As colunas do banco usam `snake_case`. O `SupabaseProvider` converte para `camelCase` automaticamente. Os IDs de demonstração são UUIDs válidos.

## Deploy

É uma SPA estática (`dist/`). Já inclui `vercel.json` e `public/_redirects` (Netlify) com fallback de rotas para `index.html`.

## Testes

`npm run test` cobre a lógica crítica:
- transposição de tons e acordes (G → G# → A → A# → B), com alinhamento preservado;
- leitura de cifras (seções, acordes sobre a letra, ChordPro inline);
- detecção de links do YouTube e Vimeo;
- datas e semanas;
- cálculo de preparação (ex.: 75%);
- integridade referencial dos dados de demonstração.
