-- One save per user. Revision is advanced by the atomic function below.
alter table public.game_saves
  add column if not exists revision bigint not null default 0;

-- Old migration granted direct access to every database role. Saves must only
-- be reachable through the authenticated activity function.
revoke all on table public.game_saves from public, anon, authenticated;
grant select, insert, update on table public.game_saves to service_role;
alter table public.game_saves enable row level security;

create or replace function public.upsert_game_save(
  p_puid text,
  p_expected_revision bigint,
  p_company_name text,
  p_year integer,
  p_month integer,
  p_phase text,
  p_save_json text
)
returns table(revision bigint, updated_at timestamptz, conflicted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.game_saves%rowtype;
begin
  if p_expected_revision = 0 then
    insert into public.game_saves
      (puid, company_name, year, month, phase, save_json, revision, updated_at)
    values
      (p_puid, p_company_name, p_year, p_month, p_phase, p_save_json, 1, now())
    on conflict (puid) do nothing
    returning * into saved;
  else
    update public.game_saves as g
      set company_name = p_company_name,
          year = p_year,
          month = p_month,
          phase = p_phase,
          save_json = p_save_json,
          revision = g.revision + 1,
          updated_at = now()
      where g.puid = p_puid and g.revision = p_expected_revision
      returning * into saved;
  end if;

  if saved.id is null then
    return query select 0::bigint, null::timestamptz, true;
  else
    return query select saved.revision, saved.updated_at, false;
  end if;
end;
$$;

revoke all on function public.upsert_game_save(text, bigint, text, integer, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.upsert_game_save(text, bigint, text, integer, integer, text, text)
  to service_role;
