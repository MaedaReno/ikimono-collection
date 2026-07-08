// Supabase セットアップ確認スクリプト
// 使い方: node --env-file=.env.local scripts/check-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ok(m) { console.log("  \x1b[32m✓\x1b[0m " + m); }
function ng(m) { console.log("  \x1b[31m✗\x1b[0m " + m); }

console.log("\n=== 環境変数 ===");
url ? ok("NEXT_PUBLIC_SUPABASE_URL: " + url) : ng("NEXT_PUBLIC_SUPABASE_URL が未設定");
anon ? ok("NEXT_PUBLIC_SUPABASE_ANON_KEY: 設定あり") : ng("NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定");
service ? ok("SUPABASE_SERVICE_ROLE_KEY: 設定あり") : ng("SUPABASE_SERVICE_ROLE_KEY が未設定");
if (!url || !anon || !service) {
  console.log("\n.env.local に値を記入してから再実行してください。\n");
  process.exit(1);
}

// service_role で RLS を無視してテーブル存在を確認
const admin = createClient(url, service, { auth: { persistSession: false } });

console.log("\n=== テーブル存在確認 ===");
let allOk = true;
for (const t of ["profiles", "captures", "worlds", "placements"]) {
  const { error } = await admin.from(t).select("*", { count: "exact", head: true });
  if (error) { ng(`${t}: ${error.message}`); allOk = false; }
  else ok(`${t}: OK`);
}

console.log("\n=== Storage バケット確認 ===");
const { data: buckets, error: bErr } = await admin.storage.listBuckets();
if (bErr) { ng("バケット一覧取得失敗: " + bErr.message); allOk = false; }
else {
  const cap = buckets.find((b) => b.id === "captures");
  cap ? ok(`captures バケット: OK (public=${cap.public})`) : (ng("captures バケットがありません"), allOk = false);
}

console.log("\n=== anon キーの RLS 確認（未ログインでは 0 件が正常） ===");
const pub = createClient(url, anon, { auth: { persistSession: false } });
const { data: rows, error: rErr } = await pub.from("captures").select("id").limit(1);
if (rErr) ok("captures は保護されています（" + rErr.message + "）");
else ok(`未ログイン select は ${rows.length} 件（RLS で自分の行のみ・0 件が正常）`);

console.log(allOk ? "\n\x1b[32m✅ Supabase セットアップ OK\x1b[0m\n" : "\n\x1b[31m⚠ 未完了の項目があります\x1b[0m\n");
process.exit(allOk ? 0 : 1);
