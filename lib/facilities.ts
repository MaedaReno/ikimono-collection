/**
 * 施設判定（簡易版）。
 * 緯度経度が施設の矩形範囲に入っていれば施設名を返す。
 * MVP 用のハードコードリスト。必要に応じて追加していく。
 */
export type Facility = {
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const FACILITIES: Facility[] = [
  // 例。実際の来訪先に合わせて範囲を調整してください。
  { name: "上野動物園", minLat: 35.714, maxLat: 35.719, minLng: 139.769, maxLng: 139.775 },
  { name: "葛西臨海水族園", minLat: 35.638, maxLat: 35.642, minLng: 139.86, maxLng: 139.865 },
  { name: "サンシャイン水族館", minLat: 35.728, maxLat: 35.731, minLng: 139.717, maxLng: 139.721 },
  { name: "海遊館", minLat: 34.654, maxLat: 34.657, minLng: 135.427, maxLng: 135.431 },
  { name: "名古屋港水族館", minLat: 35.089, maxLat: 35.093, minLng: 136.874, maxLng: 136.879 },
  { name: "旭山動物園", minLat: 43.767, maxLat: 43.772, minLng: 142.478, maxLng: 142.483 },
];

/** 座標から施設名を判定。該当なしは null */
export function facilityForCoords(lat: number, lng: number): string | null {
  for (const f of FACILITIES) {
    if (lat >= f.minLat && lat <= f.maxLat && lng >= f.minLng && lng <= f.maxLng) {
      return f.name;
    }
  }
  return null;
}
