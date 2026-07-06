import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        撮って、集めて、<span className="text-emerald-600">じぶんだけの動物園</span>
      </h1>
      <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
        動物園や水族館で生き物を撮影すると、AI が種類を教えて解説してくれます。
        写真はドット絵になって、あなただけのデジタル動物園に並びます。
      </p>

      <div className="mt-10">
        <Link
          href={user ? "/capture" : "/login"}
          className="inline-block rounded-lg bg-emerald-600 text-white px-6 py-3 text-lg font-semibold hover:bg-emerald-700"
        >
          {user ? "さっそく撮影する" : "はじめる（ログイン）"}
        </Link>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3 text-left">
        {[
          ["📷 撮る", "生き物の写真を撮影・アップロード"],
          ["🔍 わかる", "AI が種名を判定し、生態や豆知識を解説"],
          ["🏰 集める", "ドット絵になってマイ動物園に配置・コレクション"],
        ].map(([t, d]) => (
          <div
            key={t}
            className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900"
          >
            <div className="text-lg font-semibold">{t}</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
