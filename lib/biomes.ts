// バイオーム（生態系マップ）定義。
// 背景は「論理ピクセル」の Canvas 2D コンテキストに描く（呼び出し側で拡大＝ドット絵化）。

export type BiomeKey = "savanna" | "aquarium" | "insect" | "botanical";

export type Biome = {
  key: BiomeKey;
  label: string;
  /** 生き物の遊泳範囲（アンカー中心からの振れ幅・論理px）とゆらぎ */
  wander: { rx: number; ry: number; sx: number; sy: number };
  /** 生き物が入れる下端（論理H比・これより下＝地面/砂）*/
  groundRatio: number;
  drawBackground: (o: CanvasRenderingContext2D, W: number, H: number) => void;
};

// ---- pixel helpers ------------------------------------------------
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
function ditherV(
  o: CanvasRenderingContext2D,
  x0: number, y0: number, w: number, h: number,
  cTop: string, cBot: string
) {
  for (let y = 0; y < h; y++) {
    const ratio = y / h;
    for (let x = 0; x < w; x++) {
      const thr = (BAYER[y & 3][x & 3] + 0.5) / 16;
      o.fillStyle = ratio > thr ? cBot : cTop;
      o.fillRect(x0 + x, y0 + y, 1, 1);
    }
  }
}
function disc(o: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) {
  o.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const xs = Math.floor(Math.sqrt(r * r - y * y) + 0.001);
    o.fillRect(cx - xs, cy + y, xs * 2 + 1, 1);
  }
}
function gradientBands(
  o: CanvasRenderingContext2D, W: number, top: number, bottom: number, colors: string[]
) {
  const seg = (bottom - top) / (colors.length - 1);
  for (let b = 0; b < colors.length - 1; b++)
    ditherV(o, 0, Math.round(top + b * seg), W, Math.ceil(seg) + 1, colors[b], colors[b + 1]);
}

// ---- biomes -------------------------------------------------------
export const BIOMES: Biome[] = [
  {
    key: "savanna",
    label: "サバンナ",
    wander: { rx: 18, ry: 5, sx: 0.0011, sy: 0.004 },
    groundRatio: 0.7,
    drawBackground(o, W, H) {
      const g = Math.round(H * 0.7);
      gradientBands(o, W, 0, g + 2, ["#bfe6f5", "#d7eef2", "#eef3df"]);
      disc(o, W - 30, 16, 9, "#ffe9a8"); // sun
      disc(o, W - 30, 16, 6, "#fff4cf");
      // 遠景の丘
      for (let x = 0; x < W; x++) {
        const h1 = g - Math.round(6 + Math.sin(x * 0.03) * 5 + Math.sin(x * 0.011) * 4);
        o.fillStyle = "#a9d38a"; o.fillRect(x, h1, 1, g - h1);
      }
      // 地面
      for (let x = 0; x < W; x++) {
        o.fillStyle = "#84c063"; o.fillRect(x, g, 1, H - g);
        if ((x * 5) % 7 === 0) { o.fillStyle = "#6ba84e"; o.fillRect(x, g + 2 + ((x * 3) % 5), 1, 1); }
        o.fillStyle = "#9ad07a"; o.fillRect(x, g, 1, 1);
      }
      // 草
      for (let x = 4; x < W; x += 9) {
        o.fillStyle = "#5f9a44";
        o.fillRect(x, g - 2, 1, 3); o.fillRect(x + 1, g - 3, 1, 4); o.fillRect(x + 2, g - 1, 1, 2);
      }
      // アカシアの木（右寄り）
      const tx = Math.round(W * 0.7);
      o.fillStyle = "#7a5a3a"; o.fillRect(tx, g - 18, 3, 18);
      disc(o, tx + 1, g - 20, 8, "#6ba84e"); o.fillStyle = "#7fb85a"; o.fillRect(tx - 8, g - 22, 18, 3);
    },
  },
  {
    key: "aquarium",
    label: "すいぞくかん",
    wander: { rx: 24, ry: 15, sx: 0.0012, sy: 0.005 },
    groundRatio: 0.84,
    drawBackground(o, W, H) {
      gradientBands(o, W, 0, H, ["#c6ecef", "#9bdbe4", "#6fc3d6", "#4fabc8", "#3d95b8"]);
      // 光のカーテン
      o.globalAlpha = 0.16;
      for (const bx of [Math.round(W * 0.15), Math.round(W * 0.5), Math.round(W * 0.8)]) {
        for (let y = 0; y < H * 0.8; y++) { o.fillStyle = "#ffffff"; o.fillRect(bx + Math.floor(y * 0.4), y, 6, 1); }
      }
      o.globalAlpha = 1;
      const g = Math.round(H * 0.84);
      // 砂地
      for (let x = 0; x < W; x++) {
        const top = g + Math.round(Math.sin(x * 0.25) * 1.5 + Math.sin(x * 0.07) * 1.5);
        o.fillStyle = "#eed9a0"; o.fillRect(x, top, 1, H - top);
        if ((x * 7) % 5 === 0) { o.fillStyle = "#d3b877"; o.fillRect(x, top + 2 + ((x * 3) % 4), 1, 1); }
        o.fillStyle = "#c2a75f"; o.fillRect(x, top, 1, 1);
      }
      // 岩・サンゴ・海藻
      for (const rx of [Math.round(W * 0.08), Math.round(W * 0.55), Math.round(W * 0.9)]) {
        disc(o, rx, g + 2, 6, "#8a8f9e"); o.fillStyle = "#6a6f7d"; o.fillRect(rx - 6, g + 2, 12, 2);
      }
      for (const c of [[Math.round(W * 0.2), "#e2757b"], [Math.round(W * 0.3), "#a37fc0"], [Math.round(W * 0.72), "#e59ac2"]] as [number, string][]) {
        o.fillStyle = c[1];
        o.fillRect(c[0], g - 6, 2, 6); o.fillRect(c[0] - 2, g - 4, 2, 4); o.fillRect(c[0] + 2, g - 5, 2, 5);
      }
      for (const kx of [Math.round(W * 0.14), Math.round(W * 0.62), Math.round(W * 0.85)]) {
        for (let y = 0; y < 22; y++) { o.fillStyle = y % 4 < 2 ? "#3a8f6e" : "#276b50"; o.fillRect(kx + Math.round(Math.sin(y * 0.4) * 2), g - y, 2, 1); }
      }
    },
  },
  {
    key: "insect",
    label: "こんちゅうえん",
    wander: { rx: 15, ry: 6, sx: 0.0013, sy: 0.006 },
    groundRatio: 0.74,
    drawBackground(o, W, H) {
      const g = Math.round(H * 0.74);
      gradientBands(o, W, 0, g + 2, ["#d7ebac", "#b6da85", "#93c266"]);
      // 木漏れ日
      o.globalAlpha = 0.18;
      for (let i = 0; i < 30; i++) { o.fillStyle = "#fdffe0"; o.fillRect((i * 37) % W, (i * 23) % g, 2, 2); }
      o.globalAlpha = 1;
      // 幹
      for (const tx of [Math.round(W * 0.15), Math.round(W * 0.78)]) {
        o.fillStyle = "#6f4e2e"; o.fillRect(tx, 0, 6, g);
        o.fillStyle = "#5a3f24"; o.fillRect(tx + 4, 0, 1, g);
      }
      // 葉のかたまり
      for (const [lx, ly] of [[Math.round(W * 0.3), 10], [Math.round(W * 0.55), 6], [Math.round(W * 0.9), 12]] as [number, number][]) {
        disc(o, lx, ly, 8, "#5f9a44"); disc(o, lx + 6, ly + 3, 6, "#6ba84e");
      }
      // 地面（苔）
      for (let x = 0; x < W; x++) {
        o.fillStyle = "#5f8f43"; o.fillRect(x, g, 1, H - g);
        if ((x * 3) % 6 === 0) { o.fillStyle = "#7a5a3a"; o.fillRect(x, g + 3 + ((x * 2) % 4), 1, 1); }
        o.fillStyle = "#72a852"; o.fillRect(x, g, 1, 1);
      }
      // 倒木
      o.fillStyle = "#7a5a3a"; o.fillRect(Math.round(W * 0.4), g + 2, 26, 4);
      o.fillStyle = "#8a6a45"; o.fillRect(Math.round(W * 0.4), g + 2, 26, 1);
    },
  },
  {
    key: "botanical",
    label: "しょくぶつえん",
    wander: { rx: 12, ry: 4, sx: 0.001, sy: 0.004 },
    groundRatio: 0.76,
    drawBackground(o, W, H) {
      const g = Math.round(H * 0.76);
      gradientBands(o, W, 0, H, ["#eef4dc", "#e2eecb", "#d6e7bd"]);
      // 温室のガラス格子
      o.strokeStyle = "#bcd3a8"; o.lineWidth = 1;
      o.globalAlpha = 0.7;
      for (let x = 0; x <= W; x += 18) { o.beginPath(); o.moveTo(x + 0.5, 0); o.lineTo(x + 0.5, g); o.stroke(); }
      o.beginPath(); o.moveTo(0, 8.5); o.lineTo(W, 8.5); o.stroke();
      // 屋根の斜線
      for (let x = -H; x < W; x += 24) { o.beginPath(); o.moveTo(x, 8); o.lineTo(x + 8, 0); o.stroke(); }
      o.globalAlpha = 1;
      // 床（石畳の通路）
      for (let x = 0; x < W; x++) { o.fillStyle = "#cdbf9a"; o.fillRect(x, g, 1, H - g); }
      for (let x = 0; x < W; x += 8) { o.fillStyle = "#b7a982"; o.fillRect(x, g, 1, H - g); }
      o.fillStyle = "#bdae86"; o.fillRect(0, g, W, 1);
      // 植木鉢＋花
      const flowers = ["#e2757b", "#e6b64a", "#c274a0", "#e59ac2"];
      for (let i = 0; i < 6; i++) {
        const px = 12 + i * Math.round(W / 6);
        o.fillStyle = "#a8663f"; o.fillRect(px, g - 6, 8, 6); // 鉢
        o.fillStyle = "#5f9a44"; o.fillRect(px + 3, g - 12, 2, 6); // 茎
        disc(o, px + 4, g - 13, 3, flowers[i % flowers.length]); // 花
      }
    },
  },
];

export const BIOME_MAP: Record<BiomeKey, Biome> =
  Object.fromEntries(BIOMES.map((b) => [b.key, b])) as Record<BiomeKey, Biome>;
