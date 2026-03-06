create table if not exists public.erp_mail_authorizations (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'qq_mail',
  email_address text not null,
  auth_cipher text not null,
  imap_host text not null default 'imap.qq.com',
  imap_port integer not null default 993,
  is_enabled boolean not null default true,
  last_sync_at timestamptz null,
  last_sync_status text null,
  last_sync_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.erp_mail_authorizations enable row level security;

comment on table public.erp_mail_authorizations is '用户邮箱授权配置（用于QQ邮箱账单自动同步）';
comment on column public.erp_mail_authorizations.auth_cipher is '使用服务端密钥加密后的IMAP授权码';
comment on column public.erp_mail_authorizations.last_sync_status is '最近同步状态：success/partial/failed';
