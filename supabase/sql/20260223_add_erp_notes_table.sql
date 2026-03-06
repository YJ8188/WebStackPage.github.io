-- 日常笔记模块（账号隔离）
-- 用于 ERP 日常笔记（富文本）数据存储

create table if not exists public.erp_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default '',
    content_html text not null default '',
    content_text text not null default '',
    is_pinned boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists erp_notes_user_updated_idx
    on public.erp_notes(user_id, is_pinned desc, updated_at desc);

-- 自动更新时间
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists tr_erp_notes_updated_at on public.erp_notes;
create trigger tr_erp_notes_updated_at
before update on public.erp_notes
for each row execute function public.set_updated_at_timestamp();

-- RLS：用户只能访问自己的笔记
alter table public.erp_notes enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'erp_notes'
          and policyname = 'erp_notes_owner_all'
    ) then
        create policy erp_notes_owner_all
            on public.erp_notes
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end
$$;

comment on table public.erp_notes is 'ERP 日常笔记（富文本，按账号隔离）';

create table if not exists public.erp_note_versions (
    id uuid primary key default gen_random_uuid(),
    note_id uuid not null references public.erp_notes(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null default '',
    content_html text not null default '',
    content_text text not null default '',
    is_pinned boolean not null default false,
    source text not null default 'manual',
    created_at timestamptz not null default now()
);

create index if not exists erp_note_versions_note_created_idx
    on public.erp_note_versions(note_id, created_at desc);

create index if not exists erp_note_versions_user_created_idx
    on public.erp_note_versions(user_id, created_at desc);

alter table public.erp_note_versions enable row level security;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'erp_note_versions'
          and policyname = 'erp_note_versions_owner_all'
    ) then
        create policy erp_note_versions_owner_all
            on public.erp_note_versions
            for all
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;
end
$$;

comment on table public.erp_note_versions is 'ERP 笔记历史版本（回滚用）';
