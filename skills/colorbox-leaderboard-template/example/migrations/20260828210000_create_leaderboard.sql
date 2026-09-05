-- Reuse the platform demo table as the activity leaderboard.
alter table public.demo_items rename to leaderboard_entries;
truncate table public.leaderboard_entries;

alter table public.leaderboard_entries
  alter column puid set not null,
  add column if not exists score integer not null default 0,
  add column if not exists display_name text not null default 'Hupu User',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists leaderboard_entries_puid_uidx
  on public.leaderboard_entries (puid);
create index if not exists leaderboard_entries_score_idx
  on public.leaderboard_entries (score desc, updated_at asc, id asc);

alter table public.leaderboard_entries disable row level security;

create or replace function public.submit_leaderboard_score(
  p_puid text,
  p_display_name text,
  p_score integer
)
returns public.leaderboard_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.leaderboard_entries;
begin
  insert into public.leaderboard_entries (puid, display_name, score, created_at, updated_at)
  values (p_puid, p_display_name, p_score, now(), now())
  on conflict (puid) do update
    set display_name = excluded.display_name,
        score = excluded.score,
        updated_at = now()
    where public.leaderboard_entries.score < excluded.score
  returning * into result;

  if result.id is null then
    select * into result
    from public.leaderboard_entries
    where puid = p_puid;
  end if;
  return result;
end;
$$;

grant all on table public.leaderboard_entries to public;
grant usage on schema public to anon, authenticated, service_role, public;
grant select on table public.leaderboard_entries to anon, authenticated, service_role, public;
grant insert, update, delete on table public.leaderboard_entries to authenticated, service_role, public;
grant execute on function public.submit_leaderboard_score(text, text, integer)
  to public, anon, authenticated, service_role;
