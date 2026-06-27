-- 0001_init.sql
-- E2EE 가계부의 vaults / entries 스키마 + RLS 초기화.
-- Supabase Dashboard > SQL Editor 에 붙여넣고 Run 으로 실행.

create table vaults (
  user_id              uuid primary key references auth.users on delete cascade,
  wrapped_dek          bytea not null,
  dek_iv               bytea not null,
  kdf_salt             bytea not null,
  kdf_iterations       int   not null default 600000,
  recovery_wrapped_dek bytea,
  recovery_dek_iv      bytea,
  recovery_salt        bytea,
  version              int   not null default 1,
  created_at           timestamptz default now()
);

create table entries (
  user_id    uuid primary key references auth.users on delete cascade,
  ciphertext bytea not null,
  iv         bytea not null,
  updated_at timestamptz default now()
);

alter table vaults  enable row level security;
alter table entries enable row level security;

create policy "own vault"   on vaults  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entries" on entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
