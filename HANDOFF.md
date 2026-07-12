# 引き継ぎ書（いきものコレクション）

> 次のセッションが文脈を素早く取り戻すためのメモ。最終更新: 2026-07-10。

## 1. これは何か / なぜ作るか
動物園・水族館で生き物を撮影 → **AI(Claude) が種を識別・解説** → **ドット絵化** → **バイオーム別の広いマップ（マイどうぶつえん）に配置・収集**する Web アプリ。「見るだけ」の来園体験に「集める・作る」楽しみを足し、飽き＝再訪動機を解決するのが狙い。ユーザーは千葉工大の学生、日本語でやり取り、コスト配慮を重視。公開先は GitHub + Vercel。

## 2. 技術スタック
- **Next.js 16 (App Router) + TypeScript + Tailwind v4**
- **Supabase**（認証 / Postgres / Storage）— `@supabase/ssr`
- **Claude API**（`@anthropic-ai/sdk`, マルチモーダル + 構造化出力）。モデルは env `CLAUDE_MODEL`（テストは `claude-haiku-4-5`、精度重視は `claude-sonnet-5`）
- 背景除去 `@imgly/background-removal`（ブラウザ内 WASM）＋ Canvas でドット絵化
- マップは **Canvas 直描画**（react-konva はマップでは不使用に変更。依存は残存）
- デプロイ Vercel。GitHub: https://github.com/MaedaReno/ikimono-collection

## 3. アーキテクチャ / データフロー
撮影/アップロード → `/api/identify`(サーバー, Claude 呼び出し, 構造化出力) → クライアントで背景除去＋ドット絵化 → 原画像/ドット絵を Supabase Storage(`captures` バケット) → `captures` 行を INSERT → 図鑑表示 / マップ配置。

## 4. DB スキーマ & マイグレーション（Supabase SQL Editor に貼って実行）
- `supabase/schema.sql` … 初期スキーマ。テーブル: `profiles / captures / worlds / placements`、**RLS 全テーブル有効（自分の行のみ）**、`captures` Storage バケット＋ポリシー。再実行可（policy は drop→create）。
- `supabase/migrations/002_biomes.sql` … `worlds.biome` 追加 + 重複 worlds 統合 + `unique(user_id,biome)`。**実行済み**。
- `supabase/migrations/003_tags.sql` … `captures.category`(表示用分類ラベル) + `captures.biome`(最適マップ) 追加。**要実行**（Supabase SQL Editor）。未実行だと保存時に列不在エラー。既存行は NULL=未分類（全マップ追加可）。識別スキーマ(`lib/claude.ts`)が category/biome を返し、マップ(`WorldMap.tsx`)は biome 一致（or 未分類）のみ追加可。
- 図鑑は `captures` を種でグルーピングして導出（専用テーブル無し）。
- マップ＝バイオーム別 `worlds`（biome: `savanna/aquarium/insect/botanical`）。`placements(world_id, capture_id, x, y, scale)`。

## 5. 主要ファイル
```
app/
  layout.tsx            AppBar + BottomTabs(認証時) + テーマ
  page.tsx              トップ
  login/page.tsx        メール+パスワード認証(クライアント)
  capture/page.tsx      撮影→識別→背景除去→ドット絵→保存。identified=false/低信頼は保存せず再撮影案内
  dex/page.tsx          図鑑(サーバー)。ピクセル窓枠タイル + 未発見「？？？」枠
  world/page.tsx        <WorldMap/> を描画
  api/identify/route.ts ★Claude 呼び出し(サーバー専用, 要認証)
  auth/signout/route.ts ログアウト
components/
  AppBar.tsx  BottomTabs.tsx  WorldMap.tsx(Canvasマップ本体)
lib/
  supabase/{client,server,middleware}.ts   @supabase/ssr
  claude.ts        Anthropic + 識別スキーマ(zod, output_config)
  pixelate.ts      背景除去 + Canvasドット絵化 + JPEG化
  facilities.ts    施設座標テーブル + 判定(Geolocation)
  biomes.ts        4バイオームの Canvas 背景描画 + 遊泳パラメータ
  types.ts
proxy.ts           セッション更新 + 保護ルート(/capture /dex /world)。※Next16 で middleware.ts から proxy.ts へ移行済み
supabase/schema.sql, supabase/migrations/002_biomes.sql
app/globals.css    ピクセルUIデザインシステム(トークン/.px/.pxbtn/pixelated, light/dark)
scripts/check-supabase.mjs, scripts/test-identify.mjs  検証用
```

## 6. 環境変数（`.env.local` / Vercel の両方に設定）
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（公開OK, ブラウザに出る）/ `SUPABASE_SERVICE_ROLE_KEY`（サーバー専用・現状コード未使用）/ `ANTHROPIC_API_KEY`（サーバー専用）/ `CLAUDE_MODEL`。
- Vercel は **5つ設定 → Redeploy** が必須（NEXT_PUBLIC はビルド時埋め込み）。未設定だと全ページ 500。
- `.env*` は gitignore（`.env.example` だけ許可）。git 履歴に鍵は無い。

## 7. ローカル実行 / デプロイ
- `npm run dev`（ポート3000）。ログイン → つかまえる → 図鑑 → マップ。
- Vercel は GitHub push で自動デプロイ。
- **自動プッシュ**: `.claude/settings.local.json`(gitignore) の **Stop フックが push のみ**実行（自動コミットはしない＝手動コミット分を毎ターン push）。`.claude` が無い状態で始めたセッションでは `/hooks` を一度開くか再起動で有効化。

## 8. ハマりどころ（重要）
- **`next dev` 実行中に `next build` を走らせると `.next` が混線**し、dev が古い内容を配信する。UI 変更が反映されない時は「dev 停止 → `rm -rf .next` → dev 再起動 → ブラウザをハードリロード(Ctrl+Shift+R)」。
- dev サーバーの多重起動/ポート衝突に注意（`next dev` は既存があると exit）。
- Supabase の変更は SQL Editor で手動実行（マイグレーション未実行だとマップが動かない/500ではなく機能不全）。
- 識別の捏造対策済み: スキーマに `identified`、プロンプトで「実在種のみ・創作禁止」、低信頼(<0.35)は保存しない。
- Claude 構造化出力は `client.messages.parse` + `zodOutputFormat`（SDK 0.110）。

## 9. 現在の状態（done）
- 認証/DB/Storage/RLS、識別+解説、ドット絵化、図鑑、施設判定、ピクセルUI（トップ/ログイン/図鑑/撮影/ナビ）、**マップ多バイオーム＋横スクロール＋生き物の遊泳＋ドラッグ配置**、GitHub 公開、Vercel 公開（環境変数設定済み・稼働確認済み）、自動プッシュ(push-only)。

## 10. 未対応 / 次にやる候補
公開運用の前に検討：
- **Anthropic の月額 spend limit 設定**（誰でも登録→識別で課金されるため）。
- **Supabase の Email 確認をオンに戻す**（テスト用にオフにしていた）。乱用/偽登録対策。
- 識別 API のレート制限（1ユーザーあたり回数制限など）。

改善アイデア（今後ユーザーが進めたい「UI/機能改善・バグ修正」）：
- 図鑑: レア度(IUCN 連動)・コンプ率・並べ替え/検索。
- マップ: サバンナ/昆虫/植物バイオームの背景の作り込み、ドット絵タイル化、ミニマップ、生き物の"きまぐれ"挙動。
- 撮影: 高解像度送信オプション、複数候補提示。
- ドット絵の品質調整（解像度/減色パレット）。
- モバイル操作の詰め（ドラッグとスクロールの両立、タップ判定）。

## 11. 動作検証の勘所
- `npx tsc --noEmit` / `npm run lint` / `NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build`（ダミー値でビルド可）。
- 識別だけCLIで: `node --env-file=.env.local scripts/test-identify.mjs <画像>`。
- Supabase 接続確認: `node --env-file=.env.local scripts/check-supabase.mjs`。
