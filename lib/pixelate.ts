"use client";

/**
 * 被写体の背景を除去し、ドット絵化した PNG Blob を返す（すべてブラウザ内で完結）。
 * 1) @imgly/background-removal で背景透過
 * 2) Canvas で 縮小→最近傍拡大＋減色 してドット絵に
 */

const PIXEL_SIZE = 80; // ドット絵の解像度（縦横の最大ドット数）。上げるほど精細、下げるほどレトロ
const PALETTE_STEPS = 8; // 1チャンネルあたりの階調数（減色）。8→8^3=512色相当で発色が豊かに

export async function toPixelArt(file: File | Blob): Promise<Blob> {
  // 1) 背景除去（動的 import：クライアントでのみ読み込む）
  const { removeBackground } = await import("@imgly/background-removal");
  const cutout = await removeBackground(file);

  // 2) 画像を読み込む
  const bitmap = await createImageBitmap(cutout);

  // アスペクト比を保ってドット解像度に縮小
  const scale = Math.min(PIXEL_SIZE / bitmap.width, PIXEL_SIZE / bitmap.height, 1);
  const smallW = Math.max(1, Math.round(bitmap.width * scale));
  const smallH = Math.max(1, Math.round(bitmap.height * scale));

  const small = document.createElement("canvas");
  small.width = smallW;
  small.height = smallH;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(bitmap, 0, 0, smallW, smallH);

  // 減色（ポスタライズ）
  const img = sctx.getImageData(0, 0, smallW, smallH);
  const d = img.data;
  const step = 255 / (PALETTE_STEPS - 1);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) {
      d[i + 3] = 0; // 半透明は透明に
      continue;
    }
    d[i] = Math.round(Math.round(d[i] / step) * step);
    d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
    d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    d[i + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);

  // 3) 最近傍で拡大してドットのエッジをくっきり
  const OUT = 512;
  const outScale = Math.min(OUT / smallW, OUT / smallH);
  const out = document.createElement("canvas");
  out.width = Math.round(smallW * outScale);
  out.height = Math.round(smallH * outScale);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(small, 0, 0, out.width, out.height);

  return await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
}

/** File を base64（data: プレフィックスなし）に変換 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * API 送信用に画像を最大 maxDim px の JPEG に縮小し、base64 を返す。
 * トークン節約 & 形式の互換性確保（HEIC 等も canvas 経由で JPEG 化）。
 */
export async function imageToJpegBase64(
  file: File | Blob,
  maxDim = 1024
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.9
    )
  );
  return await fileToBase64(blob);
}
