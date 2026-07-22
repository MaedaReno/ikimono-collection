-- 004_identify_quota.sql
-- 識別API(/api/identify)の 1ユーザー1日あたり回数制限。
-- 公開運用で「登録さえすれば Claude を無制限に叩けて課金される」のを防ぐ。
--
-- 仕組み:
--   identify_usage(user_id, day, count) に日次カウンタを持ち、
--   consume_identify_quota(p_limit) を security definer で用意する。
--   サーバー(route.ts)がユーザーのセッションで rpc を呼ぶと、
--   auth.uid() 本人の当日カウントを原子的に +1 し、上限内なら true を返す。
--   上限を超えていれば加算せず false（＝429 にする）。
-- ユーザーは自分の usage を read できるが、count の書き換えは function 経由のみ。
-- Supabase SQL Editor に貼って実行（再実行可）。

create table if not exists public.identify_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table public.identify_usage enable row level security;

-- 本人が自分の使用状況を参照できる（表示用途）。書き込みポリシーは作らない＝関数経由のみ。
drop policy if exists "own usage read" on public.identify_usage;
create policy "own usage read"
  on public.identify_usage for select
  using (auth.uid() = user_id);

-- 当日カウントを原子的に +1 し、上限内なら true を返す。
-- security definer なので RLS を跨いで安全に更新できる（呼び出し本人=auth.uid() のみ対象）。
create or replace function public.consume_identify_quota(p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then
    return false;               -- 未認証は不許可
  end if;

  insert into public.identify_usage (user_id, day, count)
    values (v_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = public.identify_usage.count + 1
    where public.identify_usage.count < p_limit
  returning count into v_count;

  -- 上限到達で update が where に弾かれると RETURNING は 0 行 → v_count が null。
  return v_count is not null;
end;
$$;

revoke all on function public.consume_identify_quota(int) from public;
grant execute on function public.consume_identify_quota(int) to authenticated;
