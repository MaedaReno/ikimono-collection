-- 003_tags.sql
-- captures に分類タグを追加する。
--   category : 表示用の分類ラベル（例: 魚類 / 哺乳類 / 昆虫 / 植物）
--   biome    : 展示に最適なマップ（savanna / aquarium / insect / botanical）
-- 既存行は NULL（＝未分類）のまま。未分類はどのマップにも追加できる運用。
-- Supabase SQL Editor に貼って実行（再実行可）。

alter table public.captures
  add column if not exists category text,
  add column if not exists biome text;
