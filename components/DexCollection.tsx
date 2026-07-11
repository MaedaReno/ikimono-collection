"use client";

import { useEffect, useState } from "react";
import type { Capture } from "@/lib/types";

type Props = {
  /** 新しい順（created_at 降順）で渡す。番号は古いものが1・新しいものが最大 */
  captures: Capture[];
};

/**
 * 図鑑グリッド＋詳細モーダル。
 * タイルをタップすると画面いっぱいのウィンドウで解説を表示する（インライン展開はしない）。
 */
export default function DexCollection({ captures }: Props) {
  const [selected, setSelected] = useState<Capture | null>(null);

  // コレクション欲を煽る「未発見」枠（3の倍数に整えて +3）
  const lockedCount = captures.length === 0 ? 0 : ((3 - (captures.length % 3)) % 3) + 3;

  // 図鑑ナンバー：一番古いものが 1、新しいものほど大きい。
  // captures は新しい順なので、先頭(i=0)が最大番号 = 一覧の一番上。
  const numberOf = (i: number) => captures.length - i;

  // モーダル表示中は背景スクロールを止める
  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  // Esc で閉じる
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
        {captures.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c)}
            className="px !p-0 bg-panel text-left"
          >
            <div className="aspect-square bg-panel2 grid place-items-center">
              {c.pixel_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.pixel_url}
                  alt={c.common_name ?? "生き物"}
                  className="w-full h-full object-contain pixelated"
                />
              ) : (
                <span className="text-3xl">🐾</span>
              )}
            </div>
            <div className="px-2 py-2 border-t-2 border-line">
              <div className="font-pixel text-[10px] text-muted">
                #{String(numberOf(i)).padStart(3, "0")}
              </div>
              <div className="font-bold text-xs truncate">{c.common_name ?? "不明"}</div>
              {c.facility_name && (
                <div className="text-[10px] text-teal truncate">📍 {c.facility_name}</div>
              )}
            </div>
          </button>
        ))}

        {Array.from({ length: lockedCount }).map((_, i) => (
          <div key={`lock-${i}`} className="px bg-panel2 opacity-70">
            <div className="aspect-square grid place-items-center text-2xl text-muted">？</div>
            <div className="px-2 py-2 border-t-2 border-line">
              <div className="font-pixel text-[10px] text-muted">#---</div>
              <div className="font-bold text-xs text-muted">？？？</div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <DexModal
          capture={selected}
          number={numberOf(captures.indexOf(selected))}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function DexModal({
  capture: c,
  number,
  onClose,
}: {
  capture: Capture;
  number: number;
  onClose: () => void;
}) {
  const date = c.captured_at || c.created_at;
  const dateLabel = date ? date.slice(0, 10) : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col bg-screen sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:border-[3px] sm:border-line"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー（固定） */}
        <div className="flex items-center justify-between border-b-[3px] border-line bg-panel px-4 py-3">
          <div className="font-pixel text-sm font-bold text-muted">
            #{String(number).padStart(3, "0")}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-line bg-panel text-lg font-bold leading-none active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* 本文（スクロール） */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto max-w-sm">
            <div className="px !p-0 overflow-hidden bg-panel2">
              {c.pixel_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.pixel_url}
                  alt={c.common_name ?? "生き物"}
                  className="mx-auto aspect-square w-full max-w-[260px] object-contain pixelated"
                />
              ) : (
                <div className="grid aspect-square w-full place-items-center text-5xl">🐾</div>
              )}
            </div>

            <h2 className="mt-4 text-2xl font-extrabold">{c.common_name ?? "不明な生き物"}</h2>
            {c.scientific_name && (
              <p className="font-pixel text-xs italic text-muted">{c.scientific_name}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 font-pixel text-[10px]">
              {c.conservation_status && (
                <span className="border-2 border-line bg-gold px-2 py-1 text-ink">
                  保全: {c.conservation_status}
                </span>
              )}
              {typeof c.confidence === "number" && (
                <span className="border-2 border-line px-2 py-1">
                  自信度 {Math.round(c.confidence * 100)}%
                </span>
              )}
              {c.facility_name && (
                <span className="border-2 border-line bg-teal px-2 py-1 text-ink">
                  📍 {c.facility_name}
                </span>
              )}
              {dateLabel && (
                <span className="border-2 border-line px-2 py-1 text-muted">{dateLabel}</span>
              )}
            </div>

            {c.description && (
              <p className="mt-4 text-sm leading-relaxed">{c.description}</p>
            )}

            {c.fun_facts && c.fun_facts.length > 0 && (
              <div className="mt-4 border-2 border-dashed border-line bg-panel p-3">
                <div className="mb-1 font-pixel text-[10px] uppercase tracking-wider text-muted">
                  ◆ まめちしき
                </div>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {c.fun_facts.map((f, j) => (
                    <li key={j}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
