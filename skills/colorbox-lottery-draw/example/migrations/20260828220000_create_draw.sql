create extension if not exists pgcrypto;

-- Reuse the platform demo table as the activity's card-pool configuration.
alter table public.demo_items rename to draw_pools;
truncate table public.draw_pools;

alter table public.draw_pools
  add column if not exists pool_id text,
  add column if not exists title text not null default '抽卡活动',
  add column if not exists description text not null default '',
  add column if not exists cover_url text not null default '',
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists ends_at timestamptz not null default now() + interval '30 days',
  add column if not exists draw_limit integer not null default 3,
  add column if not exists pity_threshold integer not null default 10,
  add column if not exists status text not null default 'active';

update public.draw_pools set pool_id = 'default' where pool_id is null;
alter table public.draw_pools alter column pool_id set not null;
create unique index if not exists draw_pools_pool_uidx on public.draw_pools (pool_id);
alter table public.draw_pools add constraint draw_pools_limit_chk check (draw_limit >= 0 and pity_threshold > 0);
alter table public.draw_pools add constraint draw_pools_status_chk check (status in ('draft', 'active', 'paused', 'ended'));

create table if not exists public.draw_prizes (
  id uuid primary key default gen_random_uuid(),
  pool_id text not null references public.draw_pools(pool_id) on delete cascade,
  prize_code text not null,
  prize_name text not null,
  rarity text not null default '普通',
  description text not null default '',
  weight integer not null default 0,
  total_count integer not null default 0,
  remaining_count integer not null default 0,
  is_pity boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draw_prizes_weight_chk check (weight >= 0),
  constraint draw_prizes_stock_chk check (total_count >= 0 and remaining_count >= 0 and remaining_count <= total_count),
  constraint draw_prizes_status_chk check (status in ('active', 'paused', 'exhausted'))
);
create unique index if not exists draw_prizes_code_uidx on public.draw_prizes (pool_id, prize_code);
create index if not exists draw_prizes_pool_status_idx on public.draw_prizes (pool_id, status, remaining_count);

create table if not exists public.draw_user_quota (
  id uuid primary key default gen_random_uuid(),
  pool_id text not null references public.draw_pools(pool_id) on delete cascade,
  puid text not null,
  total_count integer not null default 0,
  remaining_count integer not null default 0,
  pity_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draw_quota_count_chk check (total_count >= 0 and remaining_count >= 0 and remaining_count <= total_count),
  constraint draw_quota_pity_chk check (pity_count >= 0)
);
create unique index if not exists draw_quota_pool_puid_uidx on public.draw_user_quota (pool_id, puid);

create table if not exists public.draw_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  pool_id text not null references public.draw_pools(pool_id) on delete restrict,
  puid text not null,
  draw_count integer not null,
  proof_url text not null default '',
  created_at timestamptz not null default now(),
  constraint draw_sessions_count_chk check (draw_count between 1 and 10)
);
create unique index if not exists draw_sessions_request_uidx on public.draw_sessions (request_id);
create index if not exists draw_sessions_user_idx on public.draw_sessions (pool_id, puid, created_at desc);

create table if not exists public.draw_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.draw_sessions(id) on delete cascade,
  pool_id text not null references public.draw_pools(pool_id) on delete restrict,
  puid text not null,
  sequence_no integer not null,
  prize_code text not null,
  prize_name text not null,
  rarity text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint draw_records_sequence_chk check (sequence_no between 1 and 10)
);
create unique index if not exists draw_records_session_sequence_uidx on public.draw_records (session_id, sequence_no);
create index if not exists draw_records_user_idx on public.draw_records (pool_id, puid, created_at desc);
create index if not exists draw_records_public_idx on public.draw_records (pool_id, created_at desc);

insert into public.draw_pools (pool_id, title, description, cover_url, starts_at, ends_at, draw_limit, pity_threshold, status)
values ('default', '夏日惊喜卡池', '抽取活动积分与限定徽章', '', now() - interval '1 day', now() + interval '30 days', 3, 10, 'active')
on conflict (pool_id) do update set title = excluded.title, description = excluded.description, cover_url = excluded.cover_url, ends_at = excluded.ends_at, draw_limit = excluded.draw_limit, pity_threshold = excluded.pity_threshold, status = excluded.status;

insert into public.draw_prizes (pool_id, prize_code, prize_name, rarity, description, weight, total_count, remaining_count, is_pity, status)
values
  ('default', 'points-100', '100 积分', '普通', '活动积分', 70, 999, 999, false, 'active'),
  ('default', 'points-500', '500 积分', '稀有', '活动积分', 25, 100, 100, false, 'active'),
  ('default', 'badge', '限定徽章', '传说', '可在活动页展示', 5, 20, 20, true, 'active')
on conflict (pool_id, prize_code) do update set weight = excluded.weight, total_count = excluded.total_count, remaining_count = excluded.remaining_count, is_pity = excluded.is_pity, status = excluded.status;

alter table public.draw_pools disable row level security;
alter table public.draw_prizes disable row level security;
alter table public.draw_user_quota disable row level security;
alter table public.draw_sessions disable row level security;
alter table public.draw_records disable row level security;

create or replace function public.perform_draw(
  p_puid text,
  p_pool_id text,
  p_draw_count integer,
  p_proof_url text,
  p_request_id uuid
)
returns table (
  session_id uuid,
  draw_id uuid,
  prize_code text,
  prize_name text,
  rarity text,
  description text,
  created_at timestamptz,
  remaining_count integer,
  pity_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pool_row public.draw_pools;
  quota_row public.draw_user_quota;
  session_row public.draw_sessions;
  existing_session public.draw_sessions;
  prize_row public.draw_prizes;
  total_weight bigint;
  random_target bigint;
  cumulative_weight bigint;
  next_pity integer;
  i integer;
begin
  if p_puid is null or length(trim(p_puid)) = 0 then raise exception using errcode = '22023', message = '请先登录'; end if;
  if p_draw_count is null or p_draw_count < 1 or p_draw_count > 10 then raise exception using errcode = '22023', message = '抽卡次数必须是 1 到 10'; end if;

  select * into existing_session from public.draw_sessions where request_id = p_request_id;
  if existing_session.id is not null then
    if existing_session.puid <> p_puid or existing_session.pool_id <> p_pool_id then raise exception using errcode = '23505', message = '请求 ID 已被使用'; end if;
    return query
      select s.id, r.id, r.prize_code, r.prize_name, r.rarity, r.description, r.created_at, q.remaining_count, q.pity_count
      from public.draw_sessions s join public.draw_records r on r.session_id = s.id join public.draw_user_quota q on q.pool_id = s.pool_id and q.puid = s.puid
      where s.id = existing_session.id order by r.sequence_no;
    return;
  end if;

  select * into pool_row from public.draw_pools where pool_id = p_pool_id and status = 'active' for update;
  if pool_row.pool_id is null then raise exception using errcode = '22023', message = '卡池不存在或未开放'; end if;
  if now() < pool_row.starts_at then raise exception using errcode = '22023', message = '活动尚未开始'; end if;
  if now() >= pool_row.ends_at then raise exception using errcode = '22023', message = '活动已结束'; end if;

  insert into public.draw_user_quota (pool_id, puid, total_count, remaining_count) values (p_pool_id, p_puid, pool_row.draw_limit, pool_row.draw_limit) on conflict (pool_id, puid) do nothing;
  select * into quota_row from public.draw_user_quota where pool_id = p_pool_id and puid = p_puid for update;
  if quota_row.remaining_count < p_draw_count then raise exception using errcode = '22023', message = '剩余次数不足'; end if;

  insert into public.draw_sessions (request_id, pool_id, puid, draw_count, proof_url) values (p_request_id, p_pool_id, p_puid, p_draw_count, coalesce(p_proof_url, '')) returning * into session_row;
  for i in 1..p_draw_count loop
    select coalesce(sum(weight), 0) into total_weight from public.draw_prizes where pool_id = p_pool_id and status = 'active' and remaining_count > 0;
    if total_weight <= 0 then raise exception using errcode = '22023', message = '卡池库存不足'; end if;
    next_pity := quota_row.pity_count + 1;
    if next_pity >= pool_row.pity_threshold then
      select * into prize_row from public.draw_prizes where pool_id = p_pool_id and status = 'active' and remaining_count > 0 and is_pity = true order by id limit 1;
    end if;
    if prize_row.id is null then
      -- gen_random_uuid() supplies fresh entropy; hashing it avoids exposing a seed to callers.
      random_target := mod(abs(hashtextextended(gen_random_uuid()::text, extract(epoch from clock_timestamp())::bigint)), total_weight);
      cumulative_weight := 0;
      for prize_row in select * from public.draw_prizes where pool_id = p_pool_id and status = 'active' and remaining_count > 0 order by id loop
        cumulative_weight := cumulative_weight + prize_row.weight;
        if cumulative_weight > random_target then exit; end if;
      end loop;
    end if;
    update public.draw_prizes set remaining_count = remaining_count - 1, status = case when remaining_count = 1 then 'exhausted' else status end, updated_at = now() where id = prize_row.id;
    insert into public.draw_records (session_id, pool_id, puid, sequence_no, prize_code, prize_name, rarity, description) values (session_row.id, p_pool_id, p_puid, i, prize_row.prize_code, prize_row.prize_name, prize_row.rarity, prize_row.description);
    quota_row.pity_count := case when prize_row.is_pity then 0 else next_pity end;
    prize_row := null;
  end loop;
  update public.draw_user_quota set remaining_count = remaining_count - p_draw_count, pity_count = quota_row.pity_count, updated_at = now() where id = quota_row.id returning * into quota_row;
  return query select session_row.id, r.id, r.prize_code, r.prize_name, r.rarity, r.description, r.created_at, quota_row.remaining_count, quota_row.pity_count from public.draw_records r where r.session_id = session_row.id order by r.sequence_no;
end;
$$;

grant all on table public.draw_pools, public.draw_prizes, public.draw_user_quota, public.draw_sessions, public.draw_records to public;
grant usage on schema public to anon, authenticated, service_role, public;
grant select on table public.draw_pools, public.draw_prizes, public.draw_records to anon, authenticated, service_role, public;
grant insert, update, delete on table public.draw_user_quota, public.draw_sessions, public.draw_records to authenticated, service_role, public;
grant execute on function public.perform_draw(text, text, integer, text, uuid) to public, anon, authenticated, service_role;
