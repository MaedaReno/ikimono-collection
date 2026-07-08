// Claude 識別の単体テスト（サーバー/認証を通さず直接呼ぶ）
// 使い方: node --env-file=.env.local scripts/test-identify.mjs <画像パス>
//   例:   node --env-file=.env.local scripts/test-identify.mjs ~/Pictures/penguin.jpg
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const path = process.argv[2];
if (!path) {
  console.error("画像パスを指定してください: node --env-file=.env.local scripts/test-identify.mjs <画像>");
  process.exit(1);
}

const ext = path.split(".").pop()?.toLowerCase();
const media =
  ext === "png" ? "image/png" :
  ext === "webp" ? "image/webp" :
  ext === "gif" ? "image/gif" : "image/jpeg";

const base64 = readFileSync(path).toString("base64");
const model = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

const Schema = z.object({
  identified: z.boolean().describe("実在種として妥当に同定できたか。不鮮明・小さすぎるなら false"),
  commonNameJa: z.string(),
  commonNameEn: z.string(),
  scientificName: z.string().describe("実在する正式な学名のみ。確信がなければ空文字。創作禁止"),
  description: z.string(),
  funFacts: z.array(z.string()),
  conservationStatus: z.string(),
  confidence: z.number(),
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log(`model=${model} で識別中… (${path})`);
const res = await client.messages.parse({
  model,
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: media, data: base64 } },
        {
          type: "text",
          text:
            "この写真の生き物を1種だけ同定してください。必ず実在する生物のみ。" +
            "確信を持って同定できなければ identified=false とし、名前は空文字に。創作は禁止。",
        },
      ],
    },
  ],
  output_config: { format: zodOutputFormat(Schema) },
});

console.log("\n=== 識別結果 ===");
console.dir(res.parsed_output, { depth: null });
console.log(`\nトークン: 入力 ${res.usage.input_tokens} / 出力 ${res.usage.output_tokens}`);
