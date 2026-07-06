import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Identification } from "./types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

// 識別結果のスキーマ（構造化出力）
export const IdentificationSchema = z.object({
  commonNameJa: z.string().describe("生き物の和名（日本語の一般名）。不明なら空文字"),
  commonNameEn: z.string().describe("英語の一般名。不明なら空文字"),
  scientificName: z.string().describe("学名（ラテン語）。不明なら空文字"),
  description: z.string().describe("この生き物の解説を日本語で2〜4文。生態・特徴・見どころ"),
  funFacts: z.array(z.string()).describe("面白い豆知識を日本語で2〜3個"),
  conservationStatus: z
    .string()
    .describe("IUCN 保全状況（例: 軽度懸念 / 危急 / 絶滅危惧 など）。不明なら『不明』"),
  confidence: z
    .number()
    .describe("種の同定にどれくらい自信があるか 0.0〜1.0"),
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
              "この写真に写っている生き物（動物・魚・鳥・昆虫など）を1種だけ同定し、" +
              "指定のスキーマで日本語の解説を作成してください。" +
              "自信がない場合は最も可能性が高い候補を挙げ、confidence を低めにしてください。" +
              "人間・風景・器物しか写っていない場合は commonNameJa を空文字、confidence を 0 にしてください。",
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
