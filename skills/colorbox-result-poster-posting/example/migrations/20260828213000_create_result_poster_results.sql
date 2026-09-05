-- Reuse the platform demo table as the activity result source.
alter table public.demo_items rename to result_poster_results;
truncate table public.result_poster_results;

alter table public.result_poster_results
  alter column puid set not null,
  add column if not exists nickname text not null default 'Hupu User',
  add column if not exists rank integer not null default 0,
  add column if not exists score integer not null default 0,
  add column if not exists percentile text not null default '前 0%',
  add column if not exists result_date text not null default '',
  add column if not exists share_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists result_poster_results_puid_uidx
  on public.result_poster_results (puid);
create index if not exists result_poster_results_updated_idx
  on public.result_poster_results (updated_at desc, id asc);

alter table public.result_poster_results disable row level security;

create or replace function public.save_result_poster_result(
  p_puid text,
  p_nickname text,
  p_rank integer,
  p_score integer,
  p_percentile text,
  p_result_date text
)
returns public.result_poster_results
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.result_poster_results;
begin
  insert into public.result_poster_results
    (puid, nickname, rank, score, percentile, result_date, created_at, updated_at)
  values
    (p_puid, p_nickname, p_rank, p_score, p_percentile, p_result_date, now(), now())
  on conflict (puid) do update
    set nickname = excluded.nickname,
        rank = excluded.rank,
        score = excluded.score,
        percentile = excluded.percentile,
        result_date = excluded.result_date,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant all on table public.result_poster_results to public;
grant usage on schema public to anon, authenticated, service_role, public;
grant select on table public.result_poster_results to anon, authenticated, service_role, public;
grant insert, update, delete on table public.result_poster_results to authenticated, service_role, public;
grant execute on function public.save_result_poster_result(text, text, integer, integer, text, text)
  to public, anon, authenticated, service_role;
