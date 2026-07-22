import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyCreature } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Media = (typeof ALLOWED)[number];

// 画像1枚あたりの上限（デコード後バイト数）。巨大画像でのコスト増/タイムアウトを防ぐ。
// クライアントは 1024px JPEG(~数百KB)を送るので、6MB あれば十分な余裕。
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
// 1ユーザー1日あたりの識別回数上限。env で調整可。
const DAILY_LIMIT = Number(process.env.IDENTIFY_DAILY_LIMIT ?? 30);

export async function POST(request: Request) {
  // 認証チェック
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType || !ALLOWED.includes(mediaType as Media)) {
    return NextResponse.json(
      { error: "imageBase64 と mediaType(jpeg/png/webp/gif) が必要です" },
      { status: 400 }
    );
  }

  // 画像サイズの上限チェック（base64 長からデコード後バイト数を概算）。
  const approxBytes = Math.floor((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "画像が大きすぎます。もっと小さい画像でお試しください。" },
      { status: 413 }
    );
  }

  // レート制限（1ユーザー1日あたり）。DB 側で原子的にチェック＆加算。Claude を叩く直前に消費する。
  // migration 004 未実行など rpc 自体が失敗した場合は、アプリを壊さないよう
  // 制限を素通り（fail-open）させつつログに残す。004 を実行すれば制限が有効になる。
  const { data: allowed, error: quotaErr } = await supabase.rpc(
    "consume_identify_quota",
    { p_limit: DAILY_LIMIT }
  );
  if (quotaErr) {
    console.warn("quota check skipped (run migration 004?):", quotaErr.message);
  } else if (allowed === false) {
    return NextResponse.json(
      { error: `本日の識別回数の上限（${DAILY_LIMIT}回）に達しました。明日また試してください。` },
      { status: 429 }
    );
  }

  try {
    const result = await identifyCreature(imageBase64, mediaType as Media);
    return NextResponse.json({ identification: result });
  } catch (err) {
    console.error("identify error:", err);
    return NextResponse.json(
      { error: "識別に失敗しました。時間をおいて再度お試しください。" },
      { status: 502 }
    );
  }
}
