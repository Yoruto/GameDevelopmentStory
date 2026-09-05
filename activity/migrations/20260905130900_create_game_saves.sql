create table if not exists public.game_saves (
  id uuid primary key default gen_random_uuid(),
  puid text not null,
  company_name text not null default '喵扑studio',
  year int not null,
  month int not null,
  phase text not null default 'PLAYING',
  save_json text not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (puid)
);
create index if not exists game_saves_puid_idx on public.game_saves (puid);
create index if not exists game_saves_updated_at_idx on public.game_saves (updated_at desc);

alter table public.game_saves disable row level security;

grant all on table public.game_saves to public;
grant usage on schema public to anon, authenticated, service_role, public;
grant select on all tables in schema public to anon, authenticated, service_role, public;
grant insert, update, delete on all tables in schema public to authenticated, service_role, public;
grant usage, select on all sequences in schema public to authenticated, service_role, public;
