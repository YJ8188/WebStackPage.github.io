-- 个人银行账单同步中心（个人用户）
-- 执行后可支持：连接管理、手动同步日志、账单明细留存

create table if not exists public.erp_bank_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    provider text not null default 'manual_statement',
    bank_name text not null,
    account_mask text,
    auth_status text not null default 'pending'
        check (auth_status in ('active', 'pending', 'expired')),
    consent_expires_at timestamptz,
    connector_ref text,
    auto_sync_enabled boolean not null default true,
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.erp_bank_sync_logs (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    connection_id uuid references public.erp_bank_connections(id) on delete set null,
    provider text,
    bank_name text not null default '',
    range_start date,
    range_end date,
    status text not null default 'failed'
        check (status in ('success', 'partial', 'failed')),
    inserted_count integer not null default 0,
    message text,
    created_at timestamptz not null default now()
);

create table if not exists public.erp_bank_statement_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    connection_id uuid references public.erp_bank_connections(id) on delete set null,
    provider text,
    bank_name text not null,
    account_mask text,
    statement_date timestamptz not null,
    statement_type text not null default 'credit'
        check (statement_type in ('credit', 'debit')),
    amount numeric(12, 2) not null default 0,
    currency text not null default 'CNY',
    description text,
    source_channel text not null default 'erp_ledger',
    external_ref text not null,
    ext_payload jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists erp_bank_statement_entries_user_ref_uidx
    on public.erp_bank_statement_entries(user_id, external_ref);

create index if not exists erp_bank_connections_user_idx
    on public.erp_bank_connections(user_id, created_at desc);

create index if not exists erp_bank_sync_logs_user_idx
    on public.erp_bank_sync_logs(user_id, created_at desc);

create index if not exists erp_bank_statement_entries_user_date_idx
    on public.erp_bank_statement_entries(user_id, statement_date desc);

-- 自动更新时间戳
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists tr_erp_bank_connections_updated_at on public.erp_bank_connections;
create trigger tr_erp_bank_connections_updated_at
before update on public.erp_bank_connections
for each row execute function public.set_updated_at_timestamp();

-- RLS：按登录用户隔离个人数据
alter table public.erp_bank_connections enable row level security;
alter table public.erp_bank_sync_logs enable row level security;
alter table public.erp_bank_statement_entries enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'erp_bank_connections'
          and policyname = 'erp_bank_connections_owner_all'
    ) then
        create policy erp_bank_connections_owner_all
            on public.erp_bank_connections
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'erp_bank_sync_logs'
          and policyname = 'erp_bank_sync_logs_owner_all'
    ) then
        create policy erp_bank_sync_logs_owner_all
            on public.erp_bank_sync_logs
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'erp_bank_statement_entries'
          and policyname = 'erp_bank_statement_entries_owner_all'
    ) then
        create policy erp_bank_statement_entries_owner_all
            on public.erp_bank_statement_entries
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end
$$;

comment on table public.erp_bank_connections is '个人银行账单连接（按用户授权）';
comment on table public.erp_bank_sync_logs is '个人账单同步日志';
comment on table public.erp_bank_statement_entries is '个人账单明细（接口或账本回填）';
