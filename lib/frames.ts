// カメラの装飾枠テーマ。撮影画面の最外周を囲む装飾枠と、内側の構図ガイド枠の
// デザイン/文言を環境別に切り替える。テーマ選択は撮影画面ではなく別メニューで行い、
// localStorage に保存する（キー: FRAME_STORAGE_KEY）。
// 画像アセットは使わず CSS + 絵文字で自己完結させる（CSP・オフラインに強い）。

export type FrameTheme = {
  key: string;
  label: string;
  /** 外枠のふち色（CSS color） */
  border: string;
  /** 外枠の内側に薄く重ねるアクセント色（グラデの縁取り） */
  glow: string;
  /** 四隅に飾る絵文字（左上・右上・左下・右下） */
  corners: [string, string, string, string];
  /** 内側の構図ガイド枠（四隅かぎ括弧）の色 */
  guide: string;
  /** ガイド下の案内文言 */
  caption: string;
};

export const FRAMES: FrameTheme[] = [
  {
    key: "plain",
    label: "シンプル",
    border: "rgba(255,255,255,.9)",
    glow: "rgba(255,255,255,.25)",
    corners: ["", "", "", ""],
    guide: "rgba(255,255,255,.95)",
    caption: "この枠にぴったり合うように撮ってください",
  },
  {
    key: "forest",
    label: "森",
    border: "#5f9a44",
    glow: "rgba(122,184,90,.45)",
    corners: ["🌿", "🍃", "🌱", "🍄"],
    guide: "#c8f0a0",
    caption: "森の生き物を枠にぴったり収めてね",
  },
  {
    key: "ocean",
    label: "海",
    border: "#3d95b8",
    glow: "rgba(111,195,214,.45)",
    corners: ["🌊", "🐚", "🫧", "⭐"],
    guide: "#bdeaf5",
    caption: "海の生き物を枠にぴったり収めてね",
  },
  {
    key: "sky",
    label: "空",
    border: "#e0b25e",
    glow: "rgba(255,233,168,.5)",
    corners: ["☁️", "☀️", "🌾", "🕊️"],
    guide: "#fff4cf",
    caption: "空・草原の生き物を枠にぴったり収めてね",
  },
  {
    key: "night",
    label: "夜",
    border: "#6a5aa0",
    glow: "rgba(150,130,220,.4)",
    corners: ["🌙", "✨", "🌿", "🦉"],
    guide: "#d8ccff",
    caption: "夜の生き物を枠にぴったり収めてね",
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
