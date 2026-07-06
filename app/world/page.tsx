"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PlacedItem } from "@/components/WorldCanvas";

// react-konva は window に依存するため SSR 無効で読み込む
const WorldCanvas = dynamic(() => import("@/components/WorldCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-xl border border-slate-200 dark:border-slate-800 grid place-items-center text-slate-400">
      読み込み中…
    </div>
  ),
});

type CaptureLite = { id: string; pixel_url: string | null; common_name: string | null };

export default function WorldPage() {
  const supabase = createClient();
  const [worldId, setWorldId] = useState<string | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [captures, setCaptures] = useState<CaptureLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 初期ロード：world 取得/作成、placements・captures 読み込み
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: worlds } = await supabase
        .from("worlds")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      let wid = worlds?.[0]?.id as string | undefined;
      if (!wid) {
        const { data: created } = await supabase
          .from("worlds")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        wid = created?.id;
      }
      if (!wid) return;
      setWorldId(wid);

      const [{ data: placements }, { data: caps }] = await Promise.all([
        supabase
          .from("placements")
          .select("id, capture_id, x, y, scale, captures(pixel_url, common_name)")
          .eq("world_id", wid),
        supabase
          .from("captures")
          .select("id, pixel_url, common_name")
          .order("created_at", { ascending: false }),
      ]);

      setCaptures((caps ?? []) as CaptureLite[]);

      const mapped: PlacedItem[] = (placements ?? [])
        .map((p) => {
          const cap = p.captures as unknown as {
            pixel_url: string | null;
            common_name: string | null;
          } | null;
          if (!cap?.pixel_url) return null;
          return {
            id: p.id as string,
            captureId: p.capture_id as string,
            url: cap.pixel_url,
            name: cap.common_name ?? "生き物",
            x: p.x as number,
            y: p.y as number,
            scale: (p.scale as number) ?? 1,
          };
        })
        .filter(Boolean) as PlacedItem[];
      setItems(mapped);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMove = useCallback(
    async (id: string, x: number, y: number) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x, y } : it)));
      await supabase.from("placements").update({ x, y }).eq("id", id);
    },
    [supabase]
  );

  async function addCreature(cap: CaptureLite) {
    if (!worldId || !cap.pixel_url) return;
    // 追加順に少しずつずらして配置（純粋な計算）
    const n = items.length;
    const x = 40 + (n % 6) * 110;
    const y = 210 + Math.floor(n / 6) * 100;
    const { data, error } = await supabase
      .from("placements")
      .insert({ world_id: worldId, capture_id: cap.id, x, y, scale: 1 })
      .select("id")
      .single();
    if (error || !data) return;
    setItems((prev) => [
      ...prev,
      {
        id: data.id as string,
        captureId: cap.id,
        url: cap.pixel_url!,
        name: cap.common_name ?? "生き物",
        x,
        y,
        scale: 1,
      },
    ]);
  }

  async function removeSelected() {
    if (!selectedId) return;
    await supabase.from("placements").delete().eq("id", selectedId);
    setItems((prev) => prev.filter((it) => it.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">マイ動物園</h1>
        {selectedId && (
          <button
            onClick={removeSelected}
            className="text-sm rounded-md border border-red-300 text-red-600 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950"
          >
            選択中を削除
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        生き物をドラッグして好きな場所に配置できます。配置は自動保存されます。
      </p>

      <div className="mt-4">
        <WorldCanvas
          items={items}
          onMove={handleMove}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold">コレクションから追加</h2>
      {!loading && captures.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">
          まだ生き物がいません。
          <Link href="/capture" className="text-emerald-600 underline ml-1">
            撮影する
          </Link>
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {captures
          .filter((c) => c.pixel_url)
          .map((c) => (
            <button
              key={c.id}
              onClick={() => addCreature(c)}
              title={`${c.common_name ?? "生き物"} を追加`}
              className="w-20 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 hover:ring-2 hover:ring-emerald-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.pixel_url!}
                alt={c.common_name ?? "生き物"}
                className="w-full aspect-square object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="text-[10px] truncate text-center mt-1">
                {c.common_name ?? "生き物"}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
