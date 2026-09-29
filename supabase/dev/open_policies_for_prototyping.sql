-- =====================================================================
-- ATENÇÃO: somente para PROTOTIPAGEM LOCAL. NÃO execute em produção.
--
-- Enquanto o login (Supabase Auth) não estiver integrado, o app acessa o
-- banco com a chave "anon". Estas políticas liberam leitura e escrita para
-- o papel anon, permitindo testar o SupabaseProvider e usar o botão
-- "Restaurar demonstração" em Configurações para popular as tabelas.
--
-- Para desfazer: drop policy "dev: acesso anon" on public.<tabela>;
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'members', 'users', 'songs', 'song_videos', 'song_links', 'song_notes', 'favorites', 'song_views',
    'events', 'repertoires', 'repertoire_songs', 'schedules', 'schedule_members', 'rehearsals',
    'song_preparations', 'notifications'
  ] loop
    execute format('create policy "dev: acesso anon" on public.%I for all to anon using (true) with check (true)', t);
  end loop;
end $$;
