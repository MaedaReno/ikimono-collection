import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyCreature } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Media = (typeof ALLOWED)[number];

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
