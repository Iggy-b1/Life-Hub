-- Run once in Supabase > SQL Editor. One synced table keeps all six territories modular.
create table public.entities (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  territory text not null check (territory in ('faith','fitness','nutrition','vehicles','mind','lifestyle','system')),
  kind text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index on public.entities (user_id, updated_at);
create index on public.entities (user_id, territory, kind);
alter table public.entities enable row level security;
create policy "owner only" on public.entities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create function public.touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger entities_touch before insert or update on public.entities for each row execute function public.touch();
alter publication supabase_realtime add table public.entities;
-- Private bucket for photos/documents; each user only reaches their own folder.
insert into storage.buckets (id, name, public) values ('vault','vault',false) on conflict do nothing;
create policy "own files" on storage.objects for all
  using (bucket_id='vault' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id='vault' and (storage.foldername(name))[1] = auth.uid()::text);
