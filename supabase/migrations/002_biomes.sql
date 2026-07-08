-- ============================================================
--  マップのバイオーム対応（002）
--  Supabase SQL Editor で実行（再実行可）
--  worlds を「バイオーム別マップ」に拡張する
-- ============================================================

-- worlds に biome 列を追加（既存行は aquarium 扱い）
alter table public.worlds add column if not exists biome text not null default 'aquarium';
update public.worlds set biome = 'aquarium' where biome is null;

-- 1ユーザー×1バイオーム＝1マップ
create unique index if not exists worlds_user_biome_idx
  on public.worlds (user_id, biome);
