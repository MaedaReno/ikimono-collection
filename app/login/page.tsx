"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg(error.message);
      } else {
        // メール確認が無効なら即ログイン状態。有効なら確認メール案内。
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.push("/capture");
          router.refresh();
        } else {
          setMsg("確認メールを送信しました。メール内のリンクを開いてください。");
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
      } else {
        router.push("/capture");
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold text-center">
        {mode === "signin" ? "ログイン" : "新規登録"}
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <input
          type="email"
          required
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border-[3px] border-line bg-panel px-3 py-2 font-bold"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="パスワード（6文字以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border-[3px] border-line bg-panel px-3 py-2 font-bold"
        />
        <button type="submit" disabled={loading} className="pxbtn accent w-full">
          {loading ? "処理中…" : mode === "signin" ? "ログイン" : "登録する"}
        </button>
      </form>

      {msg && (
        <p className="px mt-4 p-3 text-sm text-center text-gold font-bold bg-panel">
          {msg}
        </p>
      )}

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMsg(null);
        }}
        className="mt-6 w-full text-sm text-muted hover:text-accent"
      >
        {mode === "signin"
          ? "アカウントがない方はこちら（新規登録）"
          : "すでにアカウントをお持ちの方（ログイン）"}
      </button>
    </div>
  );
}
