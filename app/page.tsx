import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-balance">
        撮って、集めて、<br />
        <span className="text-accent">じぶんだけの動物園</span>
      </h1>
      <p className="mt-6 text-lg text-muted leading-relaxed">
        動物園や水族館で生き物を撮影すると、AI が種類を教えて解説してくれます。
        写真はドット絵になって、あなただけのデジタルワールドに並びます。
      </p>

      <div className="mt-10">
        <Link href={user ? "/capture" : "/login"} className="pxbtn accent text-lg">
          {user ? "さっそくつかまえる" : "はじめる（ログイン）"}
        </Link>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-3 text-left">
        {[
          ["📷 撮る", "生き物の写真を撮影・アップロード"],
          ["🔍 わかる", "AI が種名を判定し、生態や豆知識を解説"],
          ["▦ 集める", "ドット絵になってマップに配置・コレクション"],
        ].map(([t, d]) => (
          <div key={t} className="px p-5">
            <div className="text-lg font-extrabold">{t}</div>
            <p className="mt-2 text-sm text-muted leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
