import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function AppBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 bg-accent text-accentink border-b-[3px] border-line">
      <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 h-12">
        <Link href="/" className="font-extrabold tracking-wide">
          ★ いきものコレクション
        </Link>
        <div className="flex-1" />
        {user && (
          <form action="/auth/signout" method="post">
            <button className="font-pixel text-xs opacity-90 hover:opacity-100">
              ログアウト
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
