# 数据库

业务数据**只用 PostgreSQL**（禁止 NoSQL / `app.database()`）。一环境一活动；表名用业务 snake_case（如 `records`），**不拼** activity id。业务表一律 `public` schema。

环境开通时平台已预置 demo 表 `demo_items`（含 `puid` 列与 GRANT，见下模板）；Agent 按业务改造列名或复用，不另建平行表，迁移 SQL 仍须本地留档。

## 选表

| 类型 | 何时 | `puid` |
|------|------|--------|
| 公共表 | 配置、列表、排行等只读数据 | 否 |
| 用户行为表 | 提交、报名、我的记录等 | **是** |

## 字段约定

- `id uuid primary key default gen_random_uuid()`（平台预置 demo 表与业务表统一主键规范；亦可兼容 `bigserial`）
- `created_at timestamptz not null default now()`
- 类型：`text` / `timestamptz`；命名 snake_case；约束进库；列表必须 limit

## 索引与写路径

- 所有 `WHERE` / `ORDER BY` / 关联字段必须建索引；复合索引按「等值 → 排序」：`create index on public.<table_name> (puid, created_at desc)`
- 唯一约束即索引；「一人一条」用 `unique (puid)`，同时满足幂等
- 禁止无索引过滤与 JSONB `field ->> 'x'` 逐行解析；需要查询的键拆成独立列并建索引
- **热点写**：禁止对同一行高频 `UPDATE`（行锁排队）；计数用明细插入 + `count()`，或分片计数
- **排行榜与个人名次查询规范**：
  - **严禁使用全表 `RANK() OVER` 窗口函数**：查询“我自己的排名”时，禁止用 `RANK() OVER (ORDER BY score DESC)` 全表计算，否则会导致全表内存排序（$O(N \log N)$ 复杂度）及 CPU 暴涨。
  - **高效个人名次计算 ($O(\log N)$)**：基于 `(score DESC, updated_at ASC)` 联合索引，只需统计比自己分高的行数 + 1：
    ```sql
    -- 个人排名高效查询 (配合 score DESC 索引)
    SELECT COUNT(*) + 1 AS rank 
    FROM public.<leaderboard_table> 
    WHERE score > (SELECT score FROM public.<leaderboard_table> WHERE puid = $1);
    ```
  - **读写解耦**：`POST /submit` 写接口完成后直接返回成功，严禁在写接口内部同步计算耗时全表名次。

## 表模板

**公共表**

```sql
create table public.<table_name> (
  id uuid primary key default gen_random_uuid(),
  -- 业务字段…
  created_at timestamptz not null default now()
);
```

**用户行为表**

```sql
create table public.<table_name> (
  id uuid primary key default gen_random_uuid(),
  puid text not null,
  -- 业务字段…
  created_at timestamptz not null default now()
);
create index on public.<table_name> (puid);
-- 一人一条：unique (puid)
```

`puid` 由网关注入，云函数从 `x-cloudbase-context` 读取后写入（见 [backend.md](backend.md)）。

## 完整示例（报名）

文件：`activity/migrations/20260804000001_create_registration_tables.sql`（`<14位时间戳>_<name>.sql`）

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  max_slots int,
  created_at timestamptz not null default now()
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  puid text not null,
  event_id uuid not null references public.events (id),
  display_name text,
  created_at timestamptz not null default now(),
  unique (puid, event_id)
);
create index on public.registrations (puid);

grant all on table public.events to public;
grant all on table public.registrations to public;
grant usage on schema public to anon, authenticated, service_role, public;
grant select on all tables in schema public to anon, authenticated, service_role, public;
grant insert, update, delete on all tables in schema public to authenticated, service_role, public;
grant usage, select on all sequences in schema public to authenticated, service_role, public;
```

> **重要权限与 RLS 提示**：
> 1. **GRANT 赋权**：PostgreSQL 对新建表必须在 DDL 结尾加上针对特定表的显式赋权语句（如 `grant all on table public.<table_name> to public;`），否则即使在 schema 级别有 GRANT，云函数/REST API 写入或查询新表时仍会抛出 `permission denied for table <table_name>` 错误。
> 2. **RLS 禁用/策略**：云开发 PostgreSQL 环境新建表默认开启行级安全（Row Level Security, RLS）。在未配置 Policy 的情况下，Client/云函数 `app.rdb()` 的读写会被静默阻断。须在 Migration DDL 或执行脚本中加入 `ALTER TABLE public.<table_name> DISABLE ROW LEVEL SECURITY;` 禁用 RLS，或配置明确的 RLS 策略。

GRANT 是给 `anon` / `authenticated` / `public`（REST 网关 / 云函数访问场景）准备的；详见 [backend.md](backend.md)。

## PostgreSQL 函数（RPC）

复杂原子逻辑（钱包初始化、扣款+记账、幂等领取）有时会在 Migration 里定义 **PostgreSQL 函数**。注意：

- **云函数 `app.rdb()` 没有 `.rpc()` 方法**；运行时须走 RDB REST `POST .../rpc/{name}`，完整写法见 [backend.md](backend.md)「调用 PostgreSQL 函数（RPC）」。
- **优先评估是否可用表操作替代**：`insert ... on conflict`、`upsert`、唯一约束 + 乐观锁往往足够，且与 demo 基线一致，无需额外 HTTP 封装。
- 若必须使用函数，Migration 末尾须 **GRANT EXECUTE**：

```sql
create or replace function public.ensure_user_wallet(p_puid text)
returns void
language plpgsql
as $$
begin
  insert into public.user_wallets (puid, balance)
  values (p_puid, 0)
  on conflict (puid) do nothing;
end;
$$;

grant execute on function public.ensure_user_wallet(text) to public, anon, authenticated, service_role;
```

- 函数参数建议带前缀（如 `p_puid`）避免与列名冲突；云函数调用 RPC 时 JSON 键名与参数名一致。
- 冒烟时除「无 Token → 401」外，必须用 **apiKey Bearer 闭环**验证函数被真实执行（用户表行数应增加），见 [deploy.md](deploy.md) §C。

表名与字段随业务计划变化；保持公共表 / 用户表划分与 `puid` 约定。

## 迁移文件

- **MCP 工具防错分工（必读）**：
  - **表与结构探查**：使用 `queryPgDatabase`（`action` 仅支持 `context` / `objects` / `metadata` / `schema` / `sql`）。
  - **Migration 迁移操作**：迁移应用与历史查询全部使用 `managePgDatabase`！查询已应用 Migration 列表**必须使用 `managePgDatabase(action="listMigrations")`**（严禁误传给 `queryPgDatabase`）。
- 路径：`activity/migrations/<14位时间戳>_<name>.sql`（本地留档，如 `20260804000001_create_registration_tables.sql`）
- 部署：使用 MCP `managePgDatabase(action="applyMigration", migrationName=<name>, migrationVersion=<14位时间戳>, sql=<文件内容>, confirm=true)` 执行 DDL（含 GRANT 段）。同一 `migrationVersion` 幂等，成功后会写入远端迁移历史并自动校验；**勿用** `execute` 跑建表 DDL（会绕过迁移历史）
- 每个含 DDL 的文件末尾加 **GRANT** 段与 **DISABLE RLS**（如 `ALTER TABLE public.<table_name> DISABLE ROW LEVEL SECURITY;`），避免访问新表报权限拒绝
- 验表：`queryPgDatabase(action="schema", objectName="public.<table>")` 确认列、主键、索引及 RLS 状态；用户表须有 `puid` 列
