import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Identification } from "./types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

// 識別結果のスキーマ（構造化出力）
export const IdentificationSchema = z.object({
  identified: z
    .boolean()
    .describe(
      "実在する生物として妥当に同定できたかどうか。断定できない場合や写真が不鮮明・小さすぎる場合は false。"
    ),
  commonNameJa: z.string().describe("生き物の和名（日本語の一般名）。同定できなければ空文字"),
  commonNameEn: z.string().describe("英語の一般名。同定できなければ空文字"),
  scientificName: z
    .string()
    .describe("実在する正式な学名（ラテン語二名法）。確信が持てなければ空文字。絶対に創作しない"),
  description: z.string().describe("この生き物の解説を日本語で2〜4文。生態・特徴・見どころ"),
  funFacts: z.array(z.string()).describe("面白い豆知識を日本語で2〜3個"),
  conservationStatus: z
    .string()
    .describe("IUCN 保全状況（例: 軽度懸念 / 危急 / 絶滅危惧 など）。不明なら『不明』"),
  confidence: z
    .number()
    .describe("種の同定にどれくらい自信があるか 0.0〜1.0"),
  category: z
    .string()
    .describe(
      "生き物の分類ラベル（日本語・簡潔に）。例: 哺乳類 / 鳥類 / 爬虫類 / 両生類 / 魚類 / 甲殻類 / 貝類 / 頭足類 / 昆虫 / クモ類 / 植物 など。同定できなければ空文字。"
    ),
  biome: z
    .enum(["savanna", "aquarium", "insect", "botanical"])
    .describe(
      "この生き物を展示するのに最も適したマップを1つ選ぶ。" +
        "savanna=陸上の動物（哺乳類・鳥類・爬虫類など）、" +
        "aquarium=水中/水辺の生き物（魚類・甲殻類・貝類・頭足類・海獣・両生類など）、" +
        "insect=昆虫や陸上の節足動物（クモ・ムカデなど）、" +
        "botanical=植物（花・木・多肉・シダなど）。" +
        "迷った場合は最も近いものを選ぶこと。"
    ),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * 画像（base64）から生き物を識別し、解説を生成する。
 */
export async function identifyCreature(
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"
): Promise<Identification> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text:
              "この写真に写っている生き物（動物・魚・鳥・昆虫など）を1種だけ同定してください。\n" +
              "【最重要ルール】\n" +
              "・必ず実在する生物のみを答えること。存在しない種名・学名を創作してはいけません。\n" +
              "・被写体が小さい/不鮮明/角度が悪いなどで確信を持って同定できない場合は、" +
              "無理に推測せず identified=false とし、名前の各フィールドは空文字にしてください。\n" +
              "・大まかな分類（例:『カモの一種』『甲殻類』）までしか分からない場合は、" +
              "その分類名を commonNameJa に入れ、scientificName は空文字、confidence を低めにしてください。\n" +
              "・人間・風景・器物しか写っていない場合も identified=false にしてください。\n" +
              "同定できた場合は指定スキーマで日本語の解説を作成し、" +
              "分類ラベル(category)と、展示に最も適したマップ(biome)も必ず選んでください。",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(IdentificationSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("識別結果を解析できませんでした");
  }
  return parsed;
}
