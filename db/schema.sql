-- War Grid: progresso do jogador no Neon (Data API + Neon Auth). Rode no SQL Editor do console Neon.
-- Uma linha por jogador; RLS garante que cada conta só lê e grava a própria linha.
create table if not exists profiles(
  user_id text primary key default (auth.user_id()),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all to authenticated
  using (auth.user_id() = user_id) with check (auth.user_id() = user_id);
grant select, insert, update on profiles to authenticated;
