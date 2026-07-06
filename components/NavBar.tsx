import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur sticky top-0 z-50">
      <nav className="mx-auto max-w-5xl flex items-center gap-4 px-4 h-14">
        <Link href="/" className="font-bold text-emerald-600 dark:text-emerald-400">
          🐾 いきものコレクション
        </Link>
        <div className="flex-1" />
        {user ? (
          <>
            <Link href="/capture" className="text-sm hover:text-emerald-600">
              撮影
            </Link>
            <Link href="/dex" className="text-sm hover:text-emerald-600">
              図鑑
            </Link>
            <Link href="/world" className="text-sm hover:text-emerald-600">
              マイ動物園
            </Link>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-slate-500 hover:text-red-500">
                ログアウト
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/login"
            className="text-sm rounded-md bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700"
          >
            ログイン
          </Link>
        )}
      </nav>
    </header>
  );
}
