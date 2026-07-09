-- ============================================================
--  マップのバイオーム対応（002）※重複 worlds 対策込み・再実行可
--  Supabase SQL Editor で実行する
-- ============================================================

-- 1) biome 列を追加（既存行は aquarium 扱い）
alter table public.worlds add column if not exists biome text not null default 'aquarium';
update public.worlds set biome = 'aquarium' where biome is null;

-- 2) 同一 (user_id, biome) の重複 worlds を1つへ統合
--    残すのは最古の1行。重複側の placements は残す world に付け替える。
with keep as (
  select distinct on (user_id, biome) id as keep_id, user_id, biome
  from public.worlds
  order by user_id, biome, created_at, id
),
dups as (
  select w.id as dup_id, k.keep_id
  from public.worlds w
  join keep k on k.user_id = w.user_id and k.biome = w.biome
  where w.id <> k.keep_id
)
update public.placements p
set world_id = d.keep_id
from dups d
where p.world_id = d.dup_id;

-- 重複 worlds を削除（placements は上で退避済み）
with keep as (
  select distinct on (user_id, biome) id as keep_id, user_id, biome
  from public.worlds
  order by user_id, biome, created_at, id
)
delete from public.worlds w
using keep k
where w.user_id = k.user_id and w.biome = k.biome and w.id <> k.keep_id;

-- 3) これで一意になったので unique index を作成
create unique index if not exists worlds_user_biome_idx
  on public.worlds (user_id, biome);
