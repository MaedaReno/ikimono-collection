"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toPixelArt, imageToJpegBase64 } from "@/lib/pixelate";
import { facilityForCoords } from "@/lib/facilities";
import type { Identification } from "@/lib/types";
import CameraCapture from "@/components/CameraCapture";

type Step =
  | "idle"
  | "identifying"
  | "uploading"
  | "pixelating"
  | "saving"
  | "done"
  | "unidentified"
  | "error";

const STEP_LABEL: Record<Step, string> = {
  idle: "",
  identifying: "AI が生き物を識別中…",
  uploading: "画像をアップロード中…",
  pixelating: "ドット絵を生成中…",
  saving: "図鑑に保存中…",
  done: "完了！",
  unidentified: "",
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
  const [cameraOpen, setCameraOpen] = useState(false);

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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // 同じファイルを再選択しても onChange が発火するようにリセット
    e.target.value = "";
  }

  function handleCameraCapture(blob: Blob) {
    setCameraOpen(false);
    processFile(blob);
  }

  async function processFile(file: File | Blob) {
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

      // 1) 先に識別（サーバー経由で Claude 呼び出し）
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

      // 同定できなかった / 自信が低すぎる場合は保存せず再挑戦を促す（架空種の登録を防ぐ）
      if (!identification.identified || (identification.confidence ?? 0) < 0.35) {
        setResult(null);
        setStep("unidentified");
        return;
      }
      setResult(identification);

      const id = crypto.randomUUID();

      // 2) 原画像をアップロード
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
      <h1 className="text-2xl font-extrabold">つかまえる</h1>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        カメラで撮るか、スマホの写真を選んでください。AI が種類を判定し、ドット絵にして図鑑に登録します。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={busy}
          className="pxbtn accent text-sm"
        >
          📷 カメラでとる
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="pxbtn text-sm"
        >
          🖼 写真をえらぶ
        </button>
        {/* 写真をえらぶ用（capture 指定なし＝ギャラリー/ファイルから選べる） */}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={busy}
          className="hidden"
        />
      </div>

      {cameraOpen && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setCameraOpen(false)} />
      )}

      {preview && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-muted mb-1">
              げんぞう
            </div>
            <div className="px !p-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="preview" className="w-full aspect-square object-cover" />
            </div>
          </div>
          <div>
            <div className="font-pixel text-[10px] uppercase tracking-wider text-muted mb-1">
              ドットえ
            </div>
            <div className="px !p-0 overflow-hidden bg-panel2">
              {pixelPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pixelPreview}
                  alt="pixel"
                  className="w-full aspect-square object-contain pixelated"
                />
              ) : (
                <div className="w-full aspect-square grid place-items-center text-muted text-xs">
                  生成待ち…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {busy && (
        <div className="mt-6 flex items-center gap-3 text-accent font-bold">
          <span className="inline-block h-4 w-4 animate-spin border-[3px] border-accent border-t-transparent" />
          {STEP_LABEL[step]}
        </div>
      )}

      {error && (
        <p className="px mt-6 bg-panel p-4 text-sm text-accent font-bold">{error}</p>
      )}

      {step === "unidentified" && (
        <div className="px mt-6 p-5 text-sm bg-panel">
          <p className="font-extrabold text-gold">🔍 はっきり識別できませんでした</p>
          <p className="mt-2 leading-relaxed">
            生き物が小さすぎる・ぼやけている・角度が分かりにくい可能性があります。
            なるべく大きく・正面から・ピントの合った写真で、もう一度お試しください。
          </p>
          <p className="mt-2 text-xs text-muted">
            （実在しない生き物を登録しないよう、確信が持てない場合は保存していません）
          </p>
        </div>
      )}

      {result && (
        <div className="px mt-6 p-5 bg-panel">
          {lowConfidence && (
            <div className="mb-3 font-pixel text-[11px] bg-gold text-ink px-3 py-2">
              ⚠ 自信度が低めです。あくまで候補としてご覧ください。
            </div>
          )}
          <h2 className="text-xl font-extrabold">
            {result.commonNameJa || result.commonNameEn || "不明な生き物"}
          </h2>
          {result.scientificName && (
            <p className="font-pixel text-xs italic text-muted">{result.scientificName}</p>
          )}
          <p className="mt-3 text-sm leading-relaxed">{result.description}</p>
          {result.funFacts?.length > 0 && (
            <div className="mt-3 border-2 border-dashed border-line bg-panel2 p-3">
              <div className="font-pixel text-[10px] uppercase tracking-wider text-muted mb-1">
                ◆ まめちしき
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.funFacts.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <span className="font-pixel text-[10px] uppercase text-muted">自信度</span>
            <span className="flex gap-[2px] flex-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className={`flex-1 h-3 border-2 border-line ${
                    i < Math.round((result.confidence ?? 0) * 10) ? "bg-teal" : "bg-panel"
                  }`}
                />
              ))}
            </span>
            <span className="font-pixel text-xs font-bold">
              {Math.round((result.confidence ?? 0) * 100)}%
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 font-pixel text-[10px]">
            {result.conservationStatus && (
              <span className="border-2 border-line bg-gold text-ink px-2 py-1">
                保全: {result.conservationStatus}
              </span>
            )}
            {facility && (
              <span className="border-2 border-line bg-teal text-ink px-2 py-1">
                📍 {facility}
              </span>
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 flex gap-3">
          <Link href="/dex" className="pxbtn accent text-sm">
            図鑑を見る
          </Link>
          <Link href="/world" className="pxbtn text-sm">
            マップに配置
          </Link>
        </div>
      )}
    </div>
  );
}
