import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Capture } from "@/lib/types";
import DexCollection from "@/components/DexCollection";

export const dynamic = "force-dynamic";

export default async function DexPage() {
  const supabase = await createClient();
  // 新しい順（＝ナンバーが大きい順）で並べる。番号付けと詳細モーダルはクライアント側で行う。
  const { data: captures } = await supabase
    .from("captures")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (captures ?? []) as Capture[];
  const speciesCount = new Set(
    list.map((c) => c.scientific_name || c.common_name).filter(Boolean)
  ).size;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-extrabold">いきもの図鑑</h1>
        <div className="font-pixel text-sm text-muted">
          {list.length} 匹 / {speciesCount} 種
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 text-center text-muted">
          <p className="text-5xl mb-4">🔍</p>
          <p>まだ登録がありません。</p>
          <Link
            href="/capture"
            className="pxbtn accent mt-6 text-sm"
          >
            最初の1匹をつかまえる
          </Link>
        </div>
      ) : (
        <DexCollection captures={list} />
      )}
    </div>
  );
}
