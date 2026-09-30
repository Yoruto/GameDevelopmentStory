-- The initial broad "all tables" grant also gave service_role DELETE/TRUNCATE.
-- Keep only the operations used by the cloud function.
revoke all on table public.game_saves from service_role;
grant select, insert, update on table public.game_saves to service_role;
