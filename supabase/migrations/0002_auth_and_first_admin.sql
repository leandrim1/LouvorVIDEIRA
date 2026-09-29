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
