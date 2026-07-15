"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFrame } from "@/lib/frames";

type Props = {
  /** モーダルを表示するか。false の間もコンポーネントは残り、取得済みカメラを保持する */
  open: boolean;
  /** シャッターで撮れた写真（JPEG Blob）を親に渡す */
  onCapture: (blob: Blob) => void;
  /** ×ボタンで閉じる */
  onClose: () => void;
  /** 装飾枠テーマのキー（撮影画面外のメニューで選択。lib/frames.ts） */
  frameKey?: string;
};

const MAX_ZOOM = 4;

/**
 * アプリ内カメラ（背面カメラ固定）。OS のカメラアプリと違い、ライブ映像の上に基準枠を重ねられる。
 * - ピンチでデジタルズーム（枠は固定・映像だけ拡大）
 * - カメラ許可は一度取得したらページ内で使い回す（毎回聞かれない／通知が出ない）
 */
export default function CameraCapture({ open, onCapture, onClose, frameKey }: Props) {
  const frame = getFrame(frameKey);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zoomRef = useRef(1);

  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const attach = useCallback(async () => {
    const video = videoRef.current;
    if (video && streamRef.current) {
      if (video.srcObject !== streamRef.current) video.srcObject = streamRef.current;
      await video.play().catch(() => {});
    }
  }, []);

  // モーダルが開いている間だけカメラを準備する。
  // 既に生きたストリームがあれば取得し直さず使い回す（＝許可・通知を再発生させない）。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function ensure() {
      if (streamRef.current) {
        await attach();
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
        return;
      }
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("このブラウザではカメラを使えません。「写真をえらぶ」から選んでください。");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        await attach();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled)
          setError(
            "カメラを起動できませんでした。ブラウザのカメラ許可を確認するか、「写真をえらぶ」から選んでください。"
          );
      }
    }

    ensure();
    return () => {
      cancelled = true;
    };
  }, [open, attach]);

  // ページを離れる（アンマウント）ときだけ確実に停止する
  useEffect(() => stopStream, [stopStream]);

  // ピンチでデジタルズーム。映像だけ拡大し、枠・UI は固定のまま。
  // 併せてブラウザ自身のピンチ拡大を無効化する。
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let startDist = 0;
    let startZoom = 1;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startZoom = zoomRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const z = Math.min(MAX_ZOOM, Math.max(1, (startZoom * dist(e.touches)) / startDist));
        zoomRef.current = z;
        setZoom(z);
      }
    };
    const prevent = (e: Event) => e.preventDefault();

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("gesturestart", prevent as EventListener, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("gesturestart", prevent as EventListener);
    };
  }, []);

  function resetZoom() {
    zoomRef.current = 1;
    setZoom(1);
  }

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const z = zoomRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // ズーム分だけ中央を切り出す（プレビューの見た目と一致させる）
    const sw = vw / z;
    const sh = vh / z;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resetZoom();
          onCapture(blob); // ストリームは止めず次の撮影に備える
        }
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col bg-black ${open ? "" : "hidden"}`}>
      {/* ライブ映像＋オーバーレイ（ここでピンチを拾う） */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden" style={{ touchAction: "none" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
        />

        {/* 装飾外枠（画面の最外周を囲む・映像やシャッター操作は阻害しない） */}
        {!error && (
          <div className="pointer-events-none absolute inset-0 z-[2]">
            <div
              className="absolute inset-0"
              style={{
                border: `12px solid ${frame.border}`,
                boxShadow: `inset 0 0 0 3px ${frame.glow}, inset 0 0 22px ${frame.glow}`,
              }}
            />
            {/* 四隅の飾り */}
            {frame.corners[0] && (
              <span className="absolute left-1 top-1 text-2xl" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.7))" }}>
                {frame.corners[0]}
              </span>
            )}
            {frame.corners[1] && (
              <span className="absolute right-1 top-1 text-2xl" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.7))" }}>
                {frame.corners[1]}
              </span>
            )}
            {frame.corners[2] && (
              <span className="absolute bottom-1 left-1 text-2xl" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.7))" }}>
                {frame.corners[2]}
              </span>
            )}
            {frame.corners[3] && (
              <span className="absolute bottom-1 right-1 text-2xl" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.7))" }}>
                {frame.corners[3]}
              </span>
            )}
          </div>
        )}

        {/* 基準枠オーバーレイ（映像のズームとは独立して固定・テーマ連動） */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 z-[3] flex flex-col items-center justify-center">
            <div className="relative aspect-square w-[78vw] max-w-[340px]">
              {(
                [
                  "left-0 top-0 border-l-4 border-t-4",
                  "right-0 top-0 border-r-4 border-t-4",
                  "left-0 bottom-0 border-l-4 border-b-4",
                  "right-0 bottom-0 border-r-4 border-b-4",
                ] as const
              ).map((pos) => (
                <span
                  key={pos}
                  className={`absolute h-8 w-8 ${pos}`}
                  style={{ borderColor: frame.guide, filter: "drop-shadow(0 0 2px rgba(0,0,0,.8))" }}
                />
              ))}
            </div>
            <p
              className="mt-4 px-6 text-center font-pixel text-[12px] font-bold text-white"
              style={{ textShadow: "1px 1px 2px rgba(0,0,0,.9)" }}
            >
              {frame.caption}
            </p>
          </div>
        )}

        {/* ズーム倍率表示 */}
        {ready && !error && zoom > 1.02 && (
          <div
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 font-pixel text-[11px] font-bold text-white"
            style={{ textShadow: "1px 1px 2px rgba(0,0,0,.9)" }}
          >
            {zoom.toFixed(1)}×
          </div>
        )}

        {/* 起動中 */}
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <span className="inline-block h-6 w-6 animate-spin border-[3px] border-white border-t-transparent" />
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <p className="px max-w-xs bg-panel p-4 text-center text-sm font-bold text-ink">
              {error}
            </p>
          </div>
        )}

        {/* 閉じる（×）— カメラ映像の上でも確実に見えるよう高コントラストで固定 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="カメラを閉じる"
          className="absolute right-4 z-10 grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-black/55 text-xl font-bold leading-none text-white active:scale-95"
          style={{ top: "max(16px, env(safe-area-inset-top))" }}
        >
          ✕
        </button>
      </div>

      {/* 操作バー */}
      <div
        className="flex items-center justify-center bg-black px-4 py-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        {/* シャッター */}
        <button
          type="button"
          onClick={shoot}
          disabled={!ready || !!error}
          aria-label="撮影"
          className="grid h-[74px] w-[74px] place-items-center rounded-full border-4 border-white bg-white/20 active:scale-95 disabled:opacity-40"
        >
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}
