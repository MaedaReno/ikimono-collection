/** DB の captures 行 */
export type Capture = {
  id: string;
  user_id: string;
  common_name: string | null;
  scientific_name: string | null;
  description: string | null;
  fun_facts: string[] | null;
  conservation_status: string | null;
  confidence: number | null;
  /** 表示用の分類ラベル（例: 魚類 / 哺乳類 / 昆虫 / 植物）。未分類は null */
  category: string | null;
  /** 最適なマップ（savanna/aquarium/insect/botanical）。未分類は null */
  biome: string | null;
  original_url: string | null;
  pixel_url: string | null;
  lat: number | null;
  lng: number | null;
  facility_name: string | null;
  captured_at: string;
  created_at: string;
};

/** 識別 API が返す種情報 */
export type Identification = {
  identified: boolean;
  commonNameJa: string;
  commonNameEn: string;
  scientificName: string;
  description: string;
  funFacts: string[];
  conservationStatus: string;
  confidence: number;
  /** 表示用の分類ラベル（例: 魚類 / 哺乳類 / 昆虫 / 植物）。同定できなければ空文字 */
  category: string;
  /** 最適なマップ */
  biome: "savanna" | "aquarium" | "insect" | "botanical";
};

export type Placement = {
  id: string;
  world_id: string;
  capture_id: string;
  x: number;
  y: number;
  scale: number;
  z_index: number;
};
