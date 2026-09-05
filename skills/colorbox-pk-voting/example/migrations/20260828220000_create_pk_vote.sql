create extension if not exists pgcrypto;

create table public.pk_matches (
  id text primary key,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_matches_id_chk check (id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint pk_matches_status_chk check (status in ('draft', 'scheduled', 'live', 'ended')),
  constraint pk_matches_time_chk check (ends_at > starts_at)
);

create table public.pk_candidates (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.pk_matches(id) on delete cascade,
  side text not null,
  name text not null,
  description text not null default '',
  image_url text,
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_candidates_side_chk check (side in ('left', 'right')),
  constraint pk_candidates_vote_count_chk check (vote_count >= 0),
  constraint pk_candidates_match_side_uidx unique (match_id, side)
);

create table public.pk_votes (
  id uuid primary key default gen_random_uuid(),
  match_id text not null references public.pk_matches(id) on delete cascade,
  candidate_id uuid not null references public.pk_candidates(id) on delete cascade,
  side text not null,
  puid text not null,
  proof_url text,
  created_at timestamptz not null default now(),
  constraint pk_votes_side_chk check (side in ('left', 'right')),
  constraint pk_votes_proof_url_chk check (
    proof_url is null or (char_length(proof_url) <= 2048 and proof_url ~ '^https://')
  ),
  constraint pk_votes_match_puid_uidx unique (match_id, puid)
);

create index pk_matches_status_time_idx
  on public.pk_matches (status, starts_at, ends_at);
create index pk_votes_match_created_idx
  on public.pk_votes (match_id, created_at desc, id desc);
create index pk_votes_puid_match_idx
  on public.pk_votes (puid, match_id);

create or replace function public.submit_pk_vote(
  p_match_id text,
  p_side text,
  p_puid text,
  p_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_match public.pk_matches;
  selected_candidate public.pk_candidates;
  inserted_vote public.pk_votes;
  current_vote_count integer;
begin
  if p_match_id is null or p_match_id !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    return jsonb_build_object('error', 'INVALID_MATCH_ID');
  end if;
  if p_side is null or p_side not in ('left', 'right') then
    return jsonb_build_object('error', 'INVALID_SIDE');
  end if;
  if p_puid is null or btrim(p_puid) = '' or char_length(p_puid) > 128 then
    return jsonb_build_object('error', 'INVALID_IDENTITY');
  end if;
  if p_proof_url is not null and (
    char_length(p_proof_url) > 2048 or p_proof_url !~ '^https://'
  ) then
    return jsonb_build_object('error', 'INVALID_PROOF_URL');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_match_id || ':' || p_puid, 0));

  select * into selected_match
  from public.pk_matches
  where id = p_match_id;

  if not found then
    return jsonb_build_object('error', 'MATCH_NOT_FOUND');
  end if;
  if selected_match.status in ('draft', 'scheduled') or now() < selected_match.starts_at then
    return jsonb_build_object('error', 'MATCH_NOT_STARTED');
  end if;
  if selected_match.status = 'ended' or now() >= selected_match.ends_at then
    return jsonb_build_object('error', 'MATCH_ENDED');
  end if;
  if exists (
    select 1 from public.pk_votes where match_id = p_match_id and puid = p_puid
  ) then
    return jsonb_build_object('error', 'ALREADY_VOTED');
  end if;

  select * into selected_candidate
  from public.pk_candidates
  where match_id = p_match_id and side = p_side;

  if not found then
    return jsonb_build_object('error', 'CANDIDATE_NOT_FOUND');
  end if;

  insert into public.pk_votes (match_id, candidate_id, side, puid, proof_url)
  values (p_match_id, selected_candidate.id, p_side, p_puid, p_proof_url)
  returning * into inserted_vote;

  update public.pk_candidates
  set vote_count = vote_count + 1,
      updated_at = now()
  where id = selected_candidate.id
  returning vote_count into current_vote_count;

  return jsonb_build_object(
    'voteId', inserted_vote.id,
    'side', inserted_vote.side,
    'remaining', 0,
    'voteCount', current_vote_count,
    'createdAt', inserted_vote.created_at
  );
end;
$$;

insert into public.pk_matches (
  id, title, description, starts_at, ends_at, status
)
values (
  'plan-final',
  '你更支持哪一个方案？',
  '每个登录账号限投 1 票，截止时间以服务端配置为准。',
  now() - interval '1 day',
  now() + interval '30 days',
  'live'
)
on conflict (id) do nothing;

insert into public.pk_candidates (
  match_id, side, name, description, vote_count
)
values
  ('plan-final', 'left', '方案 A', '稳健推进，优先保证核心体验。', 0),
  ('plan-final', 'right', '方案 B', '快速突破，优先验证创新方向。', 0)
on conflict (match_id, side) do nothing;

alter table public.pk_matches disable row level security;
alter table public.pk_candidates disable row level security;
alter table public.pk_votes disable row level security;

grant usage on schema public to anon, authenticated, service_role, public;
grant select on table public.pk_matches, public.pk_candidates
  to anon, authenticated, service_role, public;
grant select on table public.pk_votes
  to authenticated, service_role, public;
grant insert, update, delete on table public.pk_matches, public.pk_candidates, public.pk_votes
  to service_role, public;
grant execute on function public.submit_pk_vote(text, text, text, text)
  to service_role, public;
