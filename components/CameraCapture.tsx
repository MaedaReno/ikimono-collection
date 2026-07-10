"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FacingMode = "environment" | "user";

type Props = {
  /** シャッターを押して撮れた写真（JPEG Blob）を親に渡す */
  onCapture: (blob: Blob) => void;
  /** ×ボタン / 背景タップで閉じる */
  onClose: () => void;
};

/**
 * アプリ内カメラ。OS のカメラアプリと違い、ライブ映像の上に
 * 「この枠に生き物を収めてください」という基準枠を重ねて表示できる。
 */
export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // カメラ起動（facing 変更時に再起動）
  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("このブラウザではカメラを使えません。「写真をえらぶ」から選んでください。");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stop();
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          setReady(true);
        }
      } catch {
        if (!cancelled)
          setError(
            "カメラを起動できませんでした。ブラウザのカメラ許可を確認するか、「写真をえらぶ」から選んでください。"
          );
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [facing, stop]);

  // アンマウント時に確実に停止
  useEffect(() => stop, [stop]);

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // 前面カメラは鏡像なので左右反転して自然な向きに戻す
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stop();
          onCapture(blob);
        }
      },
      "image/jpeg",
      0.92
    );
  }

  function close() {
    stop();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* ライブ映像 */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
        />

        {/* 基準枠オーバーレイ */}
        {ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative aspect-square w-[78vw] max-w-[340px]">
              {/* 四隅のかぎ括弧（レトロ照準風） */}
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
                  className={`absolute h-8 w-8 border-white/95 ${pos}`}
                  style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,.8))" }}
                />
              ))}
            </div>
            <p
              className="mt-4 font-pixel text-[12px] font-bold text-white"
              style={{ textShadow: "1px 1px 2px rgba(0,0,0,.9)" }}
            >
              この枠に生き物を収めてください
            </p>
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

        {/* 閉じる */}
        <button
          type="button"
          onClick={close}
          aria-label="閉じる"
          className="pxbtn absolute right-3 top-3 !px-3 !py-2 text-sm"
        >
          ✕
        </button>
      </div>

      {/* 操作バー */}
      <div className="flex items-center justify-center gap-6 bg-black px-4 py-5">
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label="カメラを切り替え"
          disabled={!!error}
          className="pxbtn !px-3 !py-3 text-lg"
        >
          🔄
        </button>

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

        {/* レイアウト対称用のスペーサー */}
        <span className="h-[52px] w-[52px]" aria-hidden />
      </div>
    </div>
  );
}
