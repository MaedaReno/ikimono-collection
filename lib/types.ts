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
