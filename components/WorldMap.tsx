"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BIOMES, BIOME_MAP, type BiomeKey } from "@/lib/biomes";

const PX = 4;          // 論理px → CSS/デバイスpx 倍率（ドット感）
const MAPW = 350;      // 論理幅（CSS 1400px）
const MAPH = 75;       // 論理高（CSS 300px）
const BASE = 18;       // 生き物の基準の高さ（論理px）
const DRAG_THRESHOLD = 6; // これ未満の移動はタップ扱い（選択のみ・移動しない）

type Placed = {
  id: string;
  captureId: string;
  url: string;
  name: string;
  x: number;   // アンカー（論理座標）
  y: number;
  scale: number;
  ph: number;  // ゆらぎ位相
};

type CaptureLite = {
  id: string;
  pixel_url: string | null;
  common_name: string | null;
  biome: string | null;
};

function hashPhase(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return (h / 1000) * Math.PI * 2;
}

export default function WorldMap() {
  const supabase = createClient();
  const [biome, setBiome] = useState<BiomeKey>("aquarium");
  const [items, setItems] = useState<Placed[]>([]);
  const [captures, setCaptures] = useState<CaptureLite[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const itemsRef = useRef<Placed[]>([]);
  const selRef = useRef<string | null>(null);
  const worldIds = useRef<Partial<Record<BiomeKey, string>>>({});
  const drag = useRef<{
    mode: "none" | "pan" | "item";
    id?: string;
    startX?: number;      // pan: 開始時のポインタ clientX
    scrollLeft?: number;  // pan: 開始時の scrollLeft
    itemStartX?: number;  // item: 開始時のポインタ clientX（しきい値判定）
    itemStartY?: number;
    moved?: boolean;      // item: しきい値を超えて実際に動かしたか
  }>({ mode: "none" });
  const reduce = useRef(false);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { selRef.current = selectedId; }, [selectedId]);

  // 画像プリロード
  const ensureImg = useCallback((url: string) => {
    if (!url || imgCache.current.has(url)) return;
    const im = new window.Image();
    im.crossOrigin = "anonymous";
    im.src = url;
    imgCache.current.set(url, im);
  }, []);

  // world を取得/作成
  const ensureWorld = useCallback(
    async (b: BiomeKey): Promise<string | null> => {
      if (worldIds.current[b]) return worldIds.current[b]!;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: found } = await supabase
        .from("worlds").select("id").eq("user_id", user.id).eq("biome", b).limit(1);
      let id = found?.[0]?.id as string | undefined;
      if (!id) {
        const { data: created } = await supabase
          .from("worlds").insert({ user_id: user.id, biome: b, name: BIOME_MAP[b].label })
          .select("id").single();
        id = created?.id;
      }
      if (id) worldIds.current[b] = id;
      return id ?? null;
    },
    [supabase]
  );

  // バイオーム切替時に配置を読み込み
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setSelectedId(null);
      const wid = await ensureWorld(biome);
      if (!wid || !alive) { setLoading(false); return; }
      const { data } = await supabase
        .from("placements")
        .select("id, capture_id, x, y, scale, captures(pixel_url, common_name)")
        .eq("world_id", wid);
      const mapped: Placed[] = (data ?? [])
        .map((p) => {
          const cap = p.captures as unknown as { pixel_url: string | null; common_name: string | null } | null;
          if (!cap?.pixel_url) return null;
          ensureImg(cap.pixel_url);
          return {
            id: p.id as string, captureId: p.capture_id as string, url: cap.pixel_url,
            name: cap.common_name ?? "生き物", x: p.x as number, y: p.y as number,
            scale: (p.scale as number) ?? 1, ph: hashPhase(p.id as string),
          };
        })
        .filter(Boolean) as Placed[];
      if (!alive) return;
      setItems(mapped);
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biome]);

  // 全 capture（トレイ用）を初回ロード
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("captures").select("id, pixel_url, common_name, biome").order("created_at", { ascending: false });
      const caps = (data ?? []) as CaptureLite[];
      caps.forEach((c) => c.pixel_url && ensureImg(c.pixel_url));
      setCaptures(caps);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 背景キャッシュを再生成（バイオーム変更時）
  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = MAPW; off.height = MAPH;
    const o = off.getContext("2d")!;
    o.imageSmoothingEnabled = false;
    BIOME_MAP[biome].drawBackground(o, MAPW, MAPH);
    bgRef.current = off;
  }, [biome]);

  // 描画ループ
  useEffect(() => {
    reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current!;
    canvas.width = MAPW * PX; canvas.height = MAPH * PX;
    const g = canvas.getContext("2d")!;
    let raf = 0;

    function frame(t: number) {
      g.imageSmoothingEnabled = false;
      if (bgRef.current) g.drawImage(bgRef.current, 0, 0, MAPW, MAPH, 0, 0, MAPW * PX, MAPH * PX);
      const wz = BIOME_MAP[biome].wander;
      const groundY = MAPH * BIOME_MAP[biome].groundRatio;
      for (const p of itemsRef.current) {
        const img = imgCache.current.get(p.url);
        const isDragging = drag.current.mode === "item" && drag.current.id === p.id;
        const wob = reduce.current || isDragging
          ? { x: 0, y: 0, dir: 1 }
          : {
              x: Math.sin(t * wz.sx + p.ph) * wz.rx,
              y: Math.sin(t * wz.sy + p.ph) * wz.ry,
              dir: Math.cos(t * wz.sx + p.ph) >= 0 ? 1 : -1,
            };
        const dh = BASE * p.scale * PX;
        const ar = img && img.height ? img.width / img.height : 1;
        const dw = dh * ar;
        const cx = (p.x + wob.x) * PX;
        const cy = (p.y + wob.y) * PX;
        const dx = cx - dw / 2, dy = cy - dh / 2;
        if (img && img.complete && img.naturalWidth) {
          g.save();
          if (wob.dir < 0) { g.translate(cx + dw / 2, dy); g.scale(-1, 1); g.drawImage(img, 0, 0, dw, dh); }
          else g.drawImage(img, dx, dy, dw, dh);
          g.restore();
        } else {
          g.fillStyle = "#00000022"; g.fillRect(dx, dy, dw, dh);
        }
        if (selRef.current === p.id) {
          g.strokeStyle = "#ffe27a"; g.lineWidth = 2; g.setLineDash([6, 4]);
          g.strokeRect(dx - 3, dy - 3, dw + 6, dh + 6); g.setLineDash([]);
        }
      }
      // groundY は clamp 用（描画は背景に含む）
      void groundY;
      if (!reduce.current) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [biome]);

  // ---- ポインタ操作（ドラッグ配置 / パン） ----
  function toLogical(e: React.PointerEvent) {
    const el = containerRef.current!;
    const rect = el.getBoundingClientRect();
    const cssX = e.clientX - rect.left + el.scrollLeft;
    const cssY = e.clientY - rect.top;
    return { x: cssX / PX, y: cssY / PX };
  }

  function hitTest(lx: number, ly: number): Placed | null {
    const wz = BIOME_MAP[biome].wander;
    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const p = itemsRef.current[i];
      const hh = (BASE * p.scale) / 2 + wz.ry;
      const hw = (BASE * p.scale) / 2 + wz.rx;
      if (Math.abs(lx - p.x) <= hw && Math.abs(ly - p.y) <= hh) return p;
    }
    return null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const { x, y } = toLogical(e);
    const hit = hitTest(x, y);
    if (hit) {
      setSelectedId(hit.id);
      drag.current = {
        mode: "item",
        id: hit.id,
        itemStartX: e.clientX,
        itemStartY: e.clientY,
        moved: false,
      };
      containerRef.current!.setPointerCapture(e.pointerId);
    } else {
      setSelectedId(null);
      drag.current = { mode: "pan", startX: e.clientX, scrollLeft: containerRef.current!.scrollLeft };
      containerRef.current!.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.current.mode === "pan") {
      containerRef.current!.scrollLeft = drag.current.scrollLeft! - (e.clientX - drag.current.startX!);
    } else if (drag.current.mode === "item") {
      // しきい値を超えるまではタップ扱いで動かさない（誤操作防止）
      if (!drag.current.moved) {
        const dx = e.clientX - (drag.current.itemStartX ?? e.clientX);
        const dy = e.clientY - (drag.current.itemStartY ?? e.clientY);
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.current.moved = true;
      }
      const { x, y } = toLogical(e);
      const nx = Math.max(BASE / 2, Math.min(MAPW - BASE / 2, x));
      const ny = Math.max(8, Math.min(MAPH * BIOME_MAP[biome].groundRatio, y));
      setItems((prev) => prev.map((it) => (it.id === drag.current.id ? { ...it, x: nx, y: ny } : it)));
    }
  }

  async function onPointerUp() {
    // 実際に動かした場合のみ永続化（タップだけなら選択のままDB更新しない）
    if (drag.current.mode === "item" && drag.current.id && drag.current.moved) {
      const it = itemsRef.current.find((p) => p.id === drag.current!.id);
      if (it) await supabase.from("placements").update({ x: it.x, y: it.y }).eq("id", it.id);
    }
    drag.current = { mode: "none" };
  }

  async function addCreature(cap: CaptureLite) {
    if (!cap.pixel_url) return;
    // タグ付きは対応するマップにのみ追加できる（未分類=null はどこでも可）
    if (cap.biome && cap.biome !== biome) return;
    const wid = await ensureWorld(biome);
    if (!wid) return;
    const el = containerRef.current!;
    const centerLogical = (el.scrollLeft + el.clientWidth / 2) / PX;
    const x = Math.max(BASE / 2, Math.min(MAPW - BASE / 2, centerLogical));
    const y = MAPH * BIOME_MAP[biome].groundRatio - BASE / 2;
    const { data, error } = await supabase
      .from("placements").insert({ world_id: wid, capture_id: cap.id, x, y, scale: 1 })
      .select("id").single();
    if (error || !data) return;
    ensureImg(cap.pixel_url);
    setItems((prev) => [...prev, {
      id: data.id as string, captureId: cap.id, url: cap.pixel_url!,
      name: cap.common_name ?? "生き物", x, y, scale: 1, ph: hashPhase(data.id as string),
    }]);
  }

  async function removeSelected() {
    if (!selectedId) return;
    await supabase.from("placements").delete().eq("id", selectedId);
    setItems((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">マイマップ</h1>
        {selectedId && (
          <button onClick={removeSelected} className="pxbtn text-xs !px-3 !py-1.5 text-accent">
            選択中を削除
          </button>
        )}
      </div>

      {/* バイオーム切替 */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {BIOMES.map((b) => (
          <button
            key={b.key}
            onClick={() => setBiome(b.key)}
            className={`font-pixel text-xs font-bold border-[3px] border-line px-3 py-1.5 shrink-0 ${
              biome === b.key ? "bg-teal text-ink" : "bg-panel2 text-muted"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* 広いマップ（横スクロール／ドラッグ） */}
      <div className="relative mt-3">
        <span className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 font-pixel text-[10px] font-bold text-white bg-black/50 px-2 py-0.5">
          ◀ ドラッグで移動・配置 ▶
        </span>
        <div
          ref={containerRef}
          className="overflow-x-auto overflow-y-hidden border-[3px] border-line"
          style={{ touchAction: "none", cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas
            ref={canvasRef}
            className="pixelated block"
            style={{ width: MAPW * PX, height: MAPH * PX }}
          />
        </div>
      </div>

      {/* トレイ：コレクションから追加（このマップに合うタグの生き物だけ） */}
      <div className="mt-6 font-pixel text-[11px] uppercase tracking-wider text-muted">
        このマップに追加
      </div>
      <p className="mt-1 text-[11px] text-muted leading-relaxed">
        「{BIOME_MAP[biome].label}」に合う分類の生き物だけ表示しています（未分類はどのマップにも追加できます）。
      </p>
      {(() => {
        const addable = captures.filter((c) => c.pixel_url && (!c.biome || c.biome === biome));
        const hasAny = captures.some((c) => c.pixel_url);
        if (!loading && !hasAny) {
          return (
            <p className="mt-2 text-sm text-muted">
              まだ生き物がいません。
              <Link href="/capture" className="text-accent underline ml-1">つかまえる</Link>
            </p>
          );
        }
        if (!loading && hasAny && addable.length === 0) {
          return (
            <p className="mt-2 text-sm text-muted">
              このマップに合う生き物がまだいません。別のマップを選ぶか、新しく
              <Link href="/capture" className="text-accent underline mx-1">つかまえて</Link>
              みましょう。
            </p>
          );
        }
        return (
          <div className="mt-2 flex flex-wrap gap-2">
            {addable.map((c) => (
              <button
                key={c.id}
                onClick={() => addCreature(c)}
                title={`${c.common_name ?? "生き物"} を追加`}
                className="px !p-1 w-16 hover:!shadow-[2px_2px_0_var(--teal)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.pixel_url!} alt={c.common_name ?? "生き物"} className="w-full aspect-square object-contain pixelated" />
                <div className="text-[9px] truncate text-center mt-0.5">{c.common_name ?? "生き物"}</div>
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
