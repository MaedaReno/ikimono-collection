"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toPixelArt, imageToJpegBase64 } from "@/lib/pixelate";
import { facilityForCoords } from "@/lib/facilities";
import type { Identification } from "@/lib/types";

type Step = "idle" | "uploading" | "identifying" | "pixelating" | "saving" | "done" | "error";

const STEP_LABEL: Record<Step, string> = {
  idle: "",
  uploading: "画像をアップロード中…",
  identifying: "AI が生き物を識別中…",
  pixelating: "ドット絵を生成中…",
  saving: "図鑑に保存中…",
  done: "完了！",
  error: "エラーが発生しました",
};

export default function CapturePage() {
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pixelPreview, setPixelPreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Identification | null>(null);
  const [facility, setFacility] = useState<string | null>(null);

  function getCoords(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setPixelPreview(null);
    setFacility(null);
    setPreview(URL.createObjectURL(file));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("ログインが必要です");
        setStep("error");
        return;
      }

      // 位置情報（任意・待ちすぎない）
      const coords = await getCoords();
      const facilityName = coords ? facilityForCoords(coords.lat, coords.lng) : null;
      setFacility(facilityName);

      const id = crypto.randomUUID();

      // 1) 原画像をアップロード
      setStep("uploading");
      const origPath = `${user.id}/${id}-orig.jpg`;
      const origJpegBase64 = await imageToJpegBase64(file, 1280);
      const origBlob = await (await fetch(`data:image/jpeg;base64,${origJpegBase64}`)).blob();
      const up1 = await supabase.storage
        .from("captures")
        .upload(origPath, origBlob, { contentType: "image/jpeg", upsert: true });
      if (up1.error) throw up1.error;
      const originalUrl = supabase.storage.from("captures").getPublicUrl(origPath)
        .data.publicUrl;

      // 2) 識別（サーバー経由で Claude 呼び出し）
      setStep("identifying");
      const apiBase64 = await imageToJpegBase64(file, 1024);
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: apiBase64, mediaType: "image/jpeg" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "識別に失敗しました");
      }
      const { identification } = (await res.json()) as { identification: Identification };
      setResult(identification);

      // 3) ドット絵化 → アップロード
      setStep("pixelating");
      const pixelBlob = await toPixelArt(file);
      setPixelPreview(URL.createObjectURL(pixelBlob));
      const pixelPath = `${user.id}/${id}-pixel.png`;
      const up2 = await supabase.storage
        .from("captures")
        .upload(pixelPath, pixelBlob, { contentType: "image/png", upsert: true });
      if (up2.error) throw up2.error;
      const pixelUrl = supabase.storage.from("captures").getPublicUrl(pixelPath)
        .data.publicUrl;

      // 4) DB 保存
      setStep("saving");
      const ins = await supabase.from("captures").insert({
        id,
        user_id: user.id,
        common_name: identification.commonNameJa || identification.commonNameEn || null,
        scientific_name: identification.scientificName || null,
        description: identification.description || null,
        fun_facts: identification.funFacts ?? [],
        conservation_status: identification.conservationStatus || null,
        confidence: identification.confidence ?? null,
        original_url: originalUrl,
        pixel_url: pixelUrl,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        facility_name: facilityName,
      });
      if (ins.error) throw ins.error;

      setStep("done");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "不明なエラー");
      setStep("error");
    }
  }

  const busy = ["uploading", "identifying", "pixelating", "saving"].includes(step);
  const lowConfidence = result && (result.confidence ?? 1) < 0.5;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">生き物を撮影・アップロード</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        カメラで撮るか、写真を選んでください。AI が種類を判定し、ドット絵にして図鑑に登録します。
      </p>

      <div className="mt-6">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          disabled={busy}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-white hover:file:bg-emerald-700"
        />
      </div>

      {preview && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">元の写真</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="preview" className="rounded-lg w-full object-cover" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">ドット絵</div>
            {pixelPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pixelPreview}
                alt="pixel"
                className="rounded-lg w-full object-contain bg-slate-100 dark:bg-slate-800"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <div className="rounded-lg w-full aspect-square bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-400 text-sm">
                生成待ち
              </div>
            )}
          </div>
        </div>
      )}

      {busy && (
        <div className="mt-6 flex items-center gap-3 text-emerald-600">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          {STEP_LABEL[step]}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 p-3 text-sm">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          {lowConfidence && (
            <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs">
              ⚠️ 自信度が低めです。あくまで候補としてご覧ください。
            </div>
          )}
          <h2 className="text-xl font-bold">
            {result.commonNameJa || result.commonNameEn || "不明な生き物"}
          </h2>
          {result.scientificName && (
            <p className="text-sm italic text-slate-500">{result.scientificName}</p>
          )}
          <p className="mt-3 text-sm">{result.description}</p>
          {result.funFacts?.length > 0 && (
            <ul className="mt-3 list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300">
              {result.funFacts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {result.conservationStatus && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1">
                保全状況: {result.conservationStatus}
              </span>
            )}
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1">
              自信度: {Math.round((result.confidence ?? 0) * 100)}%
            </span>
            {facility && (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-1">
                📍 {facility}
              </span>
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 flex gap-3">
          <Link
            href="/dex"
            className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700"
          >
            図鑑を見る
          </Link>
          <Link
            href="/world"
            className="rounded-md border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            マイ動物園に配置
          </Link>
        </div>
      )}
    </div>
  );
}
