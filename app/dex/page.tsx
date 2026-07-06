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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">図鑑</h1>
        <div className="text-sm text-slate-500">
          {list.length} 匹 / {speciesCount} 種
        </div>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 text-center text-slate-500">
          <p>まだ登録がありません。</p>
          <Link
            href="/capture"
            className="mt-4 inline-block rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
          >
            最初の1匹を撮影する
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {list.map((c) => (
            <details
              key={c.id}
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <summary className="list-none cursor-pointer">
                <div className="aspect-square bg-slate-100 dark:bg-slate-800 grid place-items-center">
                  {c.pixel_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.pixel_url}
                      alt={c.common_name ?? "生き物"}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  ) : (
                    <span className="text-slate-400">🐾</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm truncate">
                    {c.common_name ?? "不明"}
                  </div>
                  {c.facility_name && (
                    <div className="text-xs text-emerald-600 truncate">
                      📍 {c.facility_name}
                    </div>
                  )}
                </div>
              </summary>
              <div className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                {c.scientific_name && (
                  <div className="italic text-slate-500">{c.scientific_name}</div>
                )}
                {c.description && <p>{c.description}</p>}
                {c.fun_facts && c.fun_facts.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5">
                    {c.fun_facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-1 pt-1">
                  {c.conservation_status && (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                      {c.conservation_status}
                    </span>
                  )}
                  {typeof c.confidence === "number" && (
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
                      自信度 {Math.round(c.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
