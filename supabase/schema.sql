-- ============================================================
--  生き物コレクション アプリ  スキーマ
--  Supabase の SQL Editor に貼り付けて実行する（何度でも再実行可）
-- ============================================================

-- --- profiles: Auth ユーザーと 1:1 -----------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

-- 新規サインアップ時に profiles 行を自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- captures: 1撮影 = 1行 -------------------------------------
create table if not exists public.captures (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  common_name         text,
  scientific_name     text,
  description         text,
  fun_facts           text[],
  conservation_status text,
  confidence          real,
  category            text,
  biome               text,
  original_url        text,
  pixel_url           text,
  lat                 double precision,
  lng                 double precision,
  facility_name       text,
  captured_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index if not exists captures_user_idx on public.captures (user_id, created_at desc);

-- --- worlds: ユーザーの動物園 ----------------------------------
create table if not exists public.worlds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null default 'マイ動物園',
  created_at timestamptz not null default now()
);
create index if not exists worlds_user_idx on public.worlds (user_id);

-- --- placements: ワールド上の配置 ------------------------------
create table if not exists public.placements (
  id         uuid primary key default gen_random_uuid(),
  world_id   uuid not null references public.worlds (id) on delete cascade,
  capture_id uuid not null references public.captures (id) on delete cascade,
  x          double precision not null default 0,
  y          double precision not null default 0,
  scale      double precision not null default 1,
  z_index    integer not null default 0
);
create index if not exists placements_world_idx on public.placements (world_id);

-- ============================================================
--  Row Level Security: 自分の行だけ操作可
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.captures   enable row level security;
alter table public.worlds     enable row level security;
alter table public.placements enable row level security;

-- profiles
drop policy if exists "profiles are viewable by owner" on public.profiles;
create policy "profiles are viewable by owner"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles updatable by owner" on public.profiles;
create policy "profiles updatable by owner"
  on public.profiles for update using (auth.uid() = id);

-- captures
drop policy if exists "captures selectable by owner" on public.captures;
create policy "captures selectable by owner"
  on public.captures for select using (auth.uid() = user_id);
drop policy if exists "captures insertable by owner" on public.captures;
create policy "captures insertable by owner"
  on public.captures for insert with check (auth.uid() = user_id);
drop policy if exists "captures updatable by owner" on public.captures;
create policy "captures updatable by owner"
  on public.captures for update using (auth.uid() = user_id);
drop policy if exists "captures deletable by owner" on public.captures;
create policy "captures deletable by owner"
  on public.captures for delete using (auth.uid() = user_id);

-- worlds
drop policy if exists "worlds selectable by owner" on public.worlds;
create policy "worlds selectable by owner"
  on public.worlds for select using (auth.uid() = user_id);
drop policy if exists "worlds insertable by owner" on public.worlds;
create policy "worlds insertable by owner"
  on public.worlds for insert with check (auth.uid() = user_id);
drop policy if exists "worlds updatable by owner" on public.worlds;
create policy "worlds updatable by owner"
  on public.worlds for update using (auth.uid() = user_id);
drop policy if exists "worlds deletable by owner" on public.worlds;
create policy "worlds deletable by owner"
  on public.worlds for delete using (auth.uid() = user_id);

-- placements: 親 world の所有者だけ
drop policy if exists "placements selectable by world owner" on public.placements;
create policy "placements selectable by world owner"
  on public.placements for select using (
    exists (select 1 from public.worlds w where w.id = world_id and w.user_id = auth.uid())
  );
drop policy if exists "placements insertable by world owner" on public.placements;
create policy "placements insertable by world owner"
  on public.placements for insert with check (
    exists (select 1 from public.worlds w where w.id = world_id and w.user_id = auth.uid())
  );
drop policy if exists "placements updatable by world owner" on public.placements;
create policy "placements updatable by world owner"
  on public.placements for update using (
    exists (select 1 from public.worlds w where w.id = world_id and w.user_id = auth.uid())
  );
drop policy if exists "placements deletable by world owner" on public.placements;
create policy "placements deletable by world owner"
  on public.placements for delete using (
    exists (select 1 from public.worlds w where w.id = world_id and w.user_id = auth.uid())
  );

-- ============================================================
--  Storage: 画像バケット
-- ============================================================
insert into storage.buckets (id, name, public)
values ('captures', 'captures', true)
on conflict (id) do nothing;

-- 自分のフォルダ (captures/<uid>/...) にだけ書き込み可、閲覧は公開
drop policy if exists "capture images are publicly readable" on storage.objects;
create policy "capture images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'captures');

drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own images" on storage.objects;
create policy "users update own images"
  on storage.objects for update
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own images" on storage.objects;
create policy "users delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
