import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Capture } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DexPage() {
  const supabase = await createClient();
  const { data: captures } = await supabase
    .from("captures")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (captures ?? []) as Capture[];
  const speciesCount = new Set(
    list.map((c) => c.scientific_name || c.common_name).filter(Boolean)
  ).size;

  // コレクション欲を煽る「未発見」枠を数枠足す（3の倍数に整えて +3）
  const lockedCount = list.length === 0 ? 0 : (3 - (list.length % 3)) % 3 + 3;

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
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {list.map((c, i) => (
            <details
              key={c.id}
              className="group px !p-0 bg-panel"
              style={{ overflow: "hidden" }}
            >
              <summary className="list-none cursor-pointer">
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
                    #{String(i + 1).padStart(3, "0")}
                  </div>
                  <div className="font-bold text-xs truncate">
                    {c.common_name ?? "不明"}
                  </div>
                  {c.facility_name && (
                    <div className="text-[10px] text-teal truncate">
                      📍 {c.facility_name}
                    </div>
                  )}
                </div>
              </summary>
              <div className="px-3 pb-3 pt-2 text-xs text-muted space-y-2 border-t-2 border-line bg-panel">
                {c.scientific_name && (
                  <div className="italic">{c.scientific_name}</div>
                )}
                {c.description && <p className="text-ink leading-relaxed">{c.description}</p>}
                {c.fun_facts && c.fun_facts.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5">
                    {c.fun_facts.map((f, j) => (
                      <li key={j}>{f}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-1 pt-1 font-pixel text-[10px]">
                  {c.conservation_status && (
                    <span className="px !shadow-none !border-2 px-2 py-0.5 bg-gold text-ink">
                      {c.conservation_status}
                    </span>
                  )}
                  {typeof c.confidence === "number" && (
                    <span className="px !shadow-none !border-2 px-2 py-0.5">
                      自信度 {Math.round(c.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </details>
          ))}

          {Array.from({ length: lockedCount }).map((_, i) => (
            <div key={`lock-${i}`} className="px bg-panel2 opacity-70">
              <div className="aspect-square grid place-items-center text-2xl text-muted">
                ？
              </div>
              <div className="px-2 py-2 border-t-2 border-line">
                <div className="font-pixel text-[10px] text-muted">
                  #{String(list.length + i + 1).padStart(3, "0")}
                </div>
                <div className="font-bold text-xs text-muted">？？？</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
