// カメラの装飾枠テーマ。撮影画面の最外周を囲む装飾枠（ふち色＋四隅の SVG 飾り）と、
// 内側の構図ガイド枠のデザイン/文言を環境別に切り替える。
// テーマ選択は撮影画面ではなく別メニューで行い、localStorage に保存する。
// SVG はコード内蔵（画像アセット不要・CSP/オフラインに強い・拡大してもくっきり）。

export type FrameTheme = {
  key: string;
  label: string;
  /** 外枠のふち色（CSS color） */
  border: string;
  /** 外枠の内側に薄く重ねるアクセント色（内側グロー） */
  glow: string;
  /** 内側の構図ガイド枠（四隅かぎ括弧）の色 */
  guide: string;
  /** ガイド下の案内文言 */
  caption: string;
  /** 選択チップのプレビュー色 */
  swatch: string;
  /** 四隅に置く SVG 飾り（左上向きに描く。右上/右下/左下へは90°ずつ回転して配置） */
  cornerSvg: string;
  /** 飾りの1辺サイズ(px) */
  cornerSize: number;
};

// 左上コーナー用の SVG（viewBox 44x44、角が (0,0)）。回転して四隅に使う。
const CORNER = {
  plain: `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M4 22 V4 H22" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="square"/></svg>`,
  forest: `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M4 26 Q4 4 26 4" fill="none" stroke="#3f6b2b" stroke-width="3.5"/><path d="M8 12 Q16 4 24 8 Q18 18 8 12 Z" fill="#6ba84e"/><path d="M6 18 Q0 28 8 34 Q14 24 6 18 Z" fill="#7fb85a"/><circle cx="26" cy="4" r="2.6" fill="#e6b64a"/></svg>`,
  ocean: `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M2 14 q6 -7 11 0 t11 0" fill="none" stroke="#2f7a99" stroke-width="3.2"/><path d="M2 22 q6 -7 11 0 t11 0" fill="none" stroke="#6fc3d6" stroke-width="2.4"/><circle cx="30" cy="10" r="3" fill="none" stroke="#bdeaf5" stroke-width="2"/><circle cx="37" cy="17" r="1.8" fill="none" stroke="#bdeaf5" stroke-width="1.5"/></svg>`,
  sky: `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="6.5" fill="#ffe9a8"/><g stroke="#e0b25e" stroke-width="2" stroke-linecap="round"><path d="M11 1 V4"/><path d="M1 11 H4"/><path d="M4 4 L6 6"/><path d="M18 4 L16 6"/></g><path d="M20 26 q3 -7 10 -4 q7 -3 7 5 q3 0 3 3 H18 q-2 -4 2 -4 Z" fill="#ffffff"/></svg>`,
  night: `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><path d="M18 5 a9 9 0 1 0 7 16 a10 10 0 0 1 -7 -16 z" fill="#d8ccff"/><path d="M31 8 l1.2 3.4 l3.4 1.2 l-3.4 1.2 l-1.2 3.4 l-1.2 -3.4 l-3.4 -1.2 l3.4 -1.2 z" fill="#fff4cf"/><circle cx="37" cy="22" r="1.6" fill="#ffffff"/></svg>`,
};

export const FRAMES: FrameTheme[] = [
  {
    key: "plain",
    label: "シンプル",
    border: "rgba(255,255,255,.9)",
    glow: "rgba(255,255,255,.22)",
    guide: "rgba(255,255,255,.95)",
    caption: "この枠にぴったり合うように撮ってください",
    swatch: "#d7dad6",
    cornerSvg: CORNER.plain,
    cornerSize: 40,
  },
  {
    key: "forest",
    label: "森",
    border: "#3f6b2b",
    glow: "rgba(122,184,90,.45)",
    guide: "#c8f0a0",
    caption: "森の生き物を枠にぴったり収めてね",
    swatch: "#6ba84e",
    cornerSvg: CORNER.forest,
    cornerSize: 48,
  },
  {
    key: "ocean",
    label: "海",
    border: "#2f7a99",
    glow: "rgba(111,195,214,.45)",
    guide: "#bdeaf5",
    caption: "海の生き物を枠にぴったり収めてね",
    swatch: "#3d95b8",
    cornerSvg: CORNER.ocean,
    cornerSize: 48,
  },
  {
    key: "sky",
    label: "空",
    border: "#d9a24a",
    glow: "rgba(255,233,168,.5)",
    guide: "#fff4cf",
    caption: "空・草原の生き物を枠にぴったり収めてね",
    swatch: "#e6b64a",
    cornerSvg: CORNER.sky,
    cornerSize: 48,
  },
  {
    key: "night",
    label: "夜",
    border: "#4a3f7a",
    glow: "rgba(150,130,220,.4)",
    guide: "#d8ccff",
    caption: "夜の生き物を枠にぴったり収めてね",
    swatch: "#6a5aa0",
    cornerSvg: CORNER.night,
    cornerSize: 48,
  },
];

export const FRAME_MAP: Record<string, FrameTheme> = Object.fromEntries(
  FRAMES.map((f) => [f.key, f])
);

export const DEFAULT_FRAME_KEY = "plain";
export const FRAME_STORAGE_KEY = "ikimono.cameraFrame";

/** キーからテーマを引く（不明なら既定） */
export function getFrame(key: string | null | undefined): FrameTheme {
  return (key && FRAME_MAP[key]) || FRAME_MAP[DEFAULT_FRAME_KEY];
}
