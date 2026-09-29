-- =====================================================================
-- Louvor Videira — instalação completa do banco (cole tudo no SQL Editor
-- do Supabase e clique em "Run"). Gerado a partir de supabase/migrations/.
-- =====================================================================

-- =====================================================================
-- Louvor Videira — schema inicial (Supabase / PostgreSQL)
--
-- As colunas usam snake_case; o SupabaseProvider converte automaticamente
-- para camelCase (ex.: team_key ↔ teamKey). Todas as chaves são UUID.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'leader', 'member');
create type public.member_role as enum (
  'leader', 'vocal', 'backing_vocal', 'acoustic_guitar', 'electric_guitar',
  'bass', 'keys', 'drums', 'percussion', 'sound', 'media', 'other'
);
create type public.voice_type as enum ('soprano', 'mezzo', 'contralto', 'tenor', 'baritone', 'bass', 'none');
create type public.event_type as enum ('service', 'rehearsal', 'special', 'conference', 'vigil', 'communion', 'other');
create type public.repertoire_status as enum ('draft', 'published');
create type public.preparation_status as enum ('not_studied', 'studying', 'ready');
create type public.song_video_type as enum ('official', 'study', 'rehearsal', 'live', 'other');
create type public.song_link_type as enum ('youtube', 'spotify', 'apple_music', 'cifraclub', 'deezer', 'other');
create type public.notification_type as enum ('repertoire', 'key_change', 'rehearsal', 'schedule', 'song', 'system');

-- ---------------------------------------------------------------------
-- Integrantes e usuários
-- ---------------------------------------------------------------------
create table public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) >= 2),
  photo_url   text,
  roles       public.member_role[] not null default '{}',
  instrument  text not null default '',
  voice       public.voice_type not null default 'none',
  phone       text not null default '',
  email       text not null default '',
  notes       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  member_id     uuid references public.members (id) on delete set null,
  name          text not null,
  email         text not null unique,
  role          public.user_role not null default 'member',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Músicas
-- ---------------------------------------------------------------------
create table public.songs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  artist          text not null,
  album           text not null default '',
  composer        text not null default '',
  original_key    text not null,
  team_key        text not null,
  bpm             smallint check (bpm between 30 and 300),
  capo            smallint check (capo between 0 and 12),
  tuning          text not null default '',
  time_signature  text not null default '4/4',
  lyrics          text not null default '',
  chords          text not null default '',
  notes           text not null default '',
  cover_url       text,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.song_videos (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references public.songs (id) on delete cascade,
  type        public.song_video_type not null default 'other',
  title       text not null default '',
  url         text not null,
  created_at  timestamptz not null default now()
);

create table public.song_links (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references public.songs (id) on delete cascade,
  type        public.song_link_type not null default 'other',
  label       text not null default '',
  url         text not null,
  created_at  timestamptz not null default now()
);

create table public.song_notes (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references public.songs (id) on delete cascade,
  author_id   uuid references public.members (id) on delete set null,
  content     text not null check (char_length(content) >= 1),
  created_at  timestamptz not null default now()
);

create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, song_id)
);

create table public.song_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  viewed_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Eventos, repertórios, escalas e ensaios
-- ---------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  type         public.event_type not null default 'service',
  date         date not null,
  start_time   time not null,
  end_time     time,
  location     text not null default '',
  description  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Um repertório por evento
create table public.repertoires (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null unique references public.events (id) on delete cascade,
  name         text not null,
  description  text not null default '',
  notes        text not null default '',
  status       public.repertoire_status not null default 'draft',
  created_by   uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.repertoire_songs (
  id               uuid primary key default gen_random_uuid(),
  repertoire_id    uuid not null references public.repertoires (id) on delete cascade,
  song_id          uuid not null references public.songs (id) on delete cascade,
  position         smallint not null default 0,
  key              text not null,
  lead_vocal_id    uuid references public.members (id) on delete set null,
  instrumentation  text not null default '',
  notes            text not null default ''
);

-- Uma escala por evento
create table public.schedules (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null unique references public.events (id) on delete cascade,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.schedule_members (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules (id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  role         public.member_role not null,
  unique (schedule_id, member_id, role)
);

-- Ensaio = evento do tipo "rehearsal" + repertório a ensaiar
create table public.rehearsals (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null unique references public.events (id) on delete cascade,
  repertoire_id  uuid references public.repertoires (id) on delete set null,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Preparação individual de cada integrante por música do repertório
create table public.song_preparations (
  id                  uuid primary key default gen_random_uuid(),
  repertoire_song_id  uuid not null references public.repertoire_songs (id) on delete cascade,
  member_id           uuid not null references public.members (id) on delete cascade,
  video_watched       boolean not null default false,
  chords_studied      boolean not null default false,
  key_confirmed       boolean not null default false,
  rehearsed           boolean not null default false,
  status              public.preparation_status not null default 'not_studied',
  updated_at          timestamptz not null default now(),
  unique (repertoire_song_id, member_id)
);

-- ---------------------------------------------------------------------
-- Notificações (user_id nulo = toda a equipe)
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete cascade,
  type        public.notification_type not null default 'system',
  title       text not null,
  message     text not null,
  link        text,
  read_by     uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index on public.users (member_id);
create index on public.song_videos (song_id);
create index on public.song_links (song_id);
create index on public.song_notes (song_id);
create index on public.favorites (user_id);
create index on public.song_views (user_id, viewed_at desc);
create index on public.events (date, start_time);
create index on public.repertoire_songs (repertoire_id, position);
create index on public.repertoire_songs (song_id);
create index on public.schedule_members (schedule_id);
create index on public.schedule_members (member_id);
create index on public.rehearsals (repertoire_id);
create index on public.song_preparations (member_id);
create index on public.notifications (user_id, created_at desc);
create index on public.songs using gin (to_tsvector('portuguese', title || ' ' || artist));

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['members', 'users', 'songs', 'events', 'repertoires', 'schedules', 'rehearsals', 'song_preparations'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Permissões (RLS)
--   ADMINISTRADOR: tudo, inclusive alterar permissões
--   LÍDER: músicas, repertórios, eventos, escalas, ensaios e integrantes
--   INTEGRANTE: consulta + favoritos, histórico, observações e preparação próprios
-- ---------------------------------------------------------------------
create or replace function public.app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_user_id = auth.uid()
$$;

create or replace function public.app_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select member_id from public.users where auth_user_id = auth.uid()
$$;

create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where auth_user_id = auth.uid()
$$;

create or replace function public.is_leader() returns boolean
language sql stable as $$
  select coalesce(public.app_role() in ('admin', 'leader'), false)
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'members', 'users', 'songs', 'song_videos', 'song_links', 'song_notes', 'favorites', 'song_views',
    'events', 'repertoires', 'repertoire_songs', 'schedules', 'schedule_members', 'rehearsals',
    'song_preparations', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Toda a equipe autenticada pode consultar
    execute format('create policy "%s: leitura da equipe" on public.%I for select to authenticated using (true)', t, t);
  end loop;

  -- Conteúdo gerenciado por líderes e administradores
  foreach t in array array[
    'members', 'songs', 'song_videos', 'song_links', 'events', 'repertoires', 'repertoire_songs',
    'schedules', 'schedule_members', 'rehearsals'
  ] loop
    execute format('create policy "%s: escrita de líderes" on public.%I for all to authenticated using (public.is_leader()) with check (public.is_leader())', t, t);
  end loop;
end $$;

-- Usuários: apenas administradores alteram permissões
create policy "users: administradores" on public.users for all to authenticated
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- Favoritos e histórico: cada um gerencia os seus
create policy "favorites: próprios" on public.favorites for all to authenticated
  using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());
create policy "song_views: próprios" on public.song_views for all to authenticated
  using (user_id = public.app_user_id()) with check (user_id = public.app_user_id());

-- Observações: qualquer integrante publica; autor ou líder remove
create policy "song_notes: publicar" on public.song_notes for insert to authenticated
  with check (author_id is null or author_id = public.app_member_id() or public.is_leader());
create policy "song_notes: remover" on public.song_notes for delete to authenticated
  using (author_id = public.app_member_id() or public.is_leader());

-- Preparação: cada integrante registra a sua
create policy "song_preparations: próprias" on public.song_preparations for all to authenticated
  using (member_id = public.app_member_id() or public.is_leader())
  with check (member_id = public.app_member_id() or public.is_leader());

-- Notificações: criadas pelo app; qualquer um marca como lida as suas
create policy "notifications: criar" on public.notifications for insert to authenticated with check (true);
create policy "notifications: marcar lida" on public.notifications for update to authenticated
  using (user_id is null or user_id = public.app_user_id()) with check (user_id is null or user_id = public.app_user_id());
create policy "notifications: remover" on public.notifications for delete to authenticated using (public.is_leader());

-- ---------------------------------------------------------------------
-- Realtime: telas se atualizam quando outro integrante altera dados
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table
  public.members, public.users, public.songs, public.song_videos, public.song_links, public.song_notes,
  public.favorites, public.song_views, public.events, public.repertoires, public.repertoire_songs,
  public.schedules, public.schedule_members, public.rehearsals, public.song_preparations, public.notifications;


-- =====================================================================
-- Louvor Videira — login real (Supabase Auth)
--
-- • A PRIMEIRA pessoa que criar conta vira Administrador (já aprovada).
-- • As demais entram como Integrante e aguardam aprovação do administrador.
-- • Se o administrador já tiver cadastrado o e-mail da pessoa (convite),
--   a conta é vinculada e aprovada automaticamente.
-- • Somente usuários aprovados conseguem ler os dados da equipe.
-- =====================================================================

alter table public.users add column if not exists approved boolean not null default false;

-- ---------------------------------------------------------------------
-- Funções auxiliares (consideram apenas usuários aprovados)
-- ---------------------------------------------------------------------
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select approved from public.users where auth_user_id = auth.uid()), false)
$$;

create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where auth_user_id = auth.uid() and approved
$$;

create or replace function public.app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_user_id = auth.uid() and approved
$$;

create or replace function public.app_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select member_id from public.users where auth_user_id = auth.uid() and approved
$$;

-- ---------------------------------------------------------------------
-- Leitura: somente usuários aprovados
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'members', 'users', 'songs', 'song_videos', 'song_links', 'song_notes', 'favorites', 'song_views',
    'events', 'repertoires', 'repertoire_songs', 'schedules', 'schedule_members', 'rehearsals',
    'song_preparations', 'notifications'
  ] loop
    execute format('drop policy if exists "%s: leitura da equipe" on public.%I', t, t);
    execute format('create policy "%s: leitura da equipe" on public.%I for select to authenticated using (public.is_approved())', t, t);
  end loop;
end $$;

-- Quem aguarda aprovação ainda consegue ver o próprio cadastro
drop policy if exists "users: próprio cadastro" on public.users;
create policy "users: próprio cadastro" on public.users for select to authenticated
  using (auth_user_id = auth.uid());

-- Notificações só podem ser criadas por usuários aprovados
drop policy if exists "notifications: criar" on public.notifications;
create policy "notifications: criar" on public.notifications for insert to authenticated
  with check (public.is_approved());

-- ---------------------------------------------------------------------
-- Novo cadastro no Supabase Auth → cria integrante + usuário
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  display_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
  existing public.users%rowtype;
  new_member uuid;
  is_first boolean;
begin
  -- Serializa cadastros simultâneos para garantir um único "primeiro administrador"
  perform pg_advisory_xact_lock(hashtext('louvor-videira:first-admin'));

  select * into existing from public.users where lower(email) = lower(new.email) limit 1;
  if found then
    -- Convite feito pelo administrador: vincula a conta e libera o acesso
    update public.users
      set auth_user_id = new.id, approved = true, updated_at = now()
      where id = existing.id;
    return new;
  end if;

  select not exists (select 1 from public.users where role = 'admin' and approved) into is_first;

  insert into public.members (name, email, roles)
    values (display_name, new.email, case when is_first then array['leader']::public.member_role[] else '{}' end)
    returning id into new_member;

  insert into public.users (auth_user_id, member_id, name, email, role, approved)
    values (new.id, new_member, display_name, new.email,
            case when is_first then 'admin'::public.user_role else 'member'::public.user_role end,
            is_first);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
