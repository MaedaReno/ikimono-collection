# 🐾 いきものコレクション

動物園・水族館で撮った生き物を **AI（Claude）が識別・解説** し、**ドット絵化** して
自分だけのデジタル動物園に配置・収集できる Web アプリ。

- 📷 撮影/アップロード → 🔍 種を識別＋解説 → 🖼️ ドット絵化 → 🏰 マイ動物園に配置
- 撮影地の座標から施設名（例: 上野動物園）を自動記録
- 図鑑でコレクションを一覧

## 技術スタック
- **Next.js (App Router) + TypeScript** / Tailwind CSS
- **Supabase**（認証・Postgres・Storage）
- **Claude API**（マルチモーダル識別＋構造化出力）
- 背景除去 `@imgly/background-removal`（ブラウザ内）＋ Canvas でドット絵化
- **react-konva** でワールド編集
- **Vercel** にデプロイ

---

## セットアップ

### 1. Supabase プロジェクトを作る
1. https://supabase.com でプロジェクト作成
2. **SQL Editor** に `supabase/schema.sql` の内容を貼り付けて実行
   （テーブル・RLS ポリシー・`captures` Storage バケットが作られる）
3. **Settings → API** から以下を控える
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（サーバー専用）
4. **Authentication → Providers → Email** を有効化
   （動作確認を素早くするなら **Confirm email をオフ**にすると登録後すぐログインできる）

### 2. Claude API キー
https://console.anthropic.com/ で API キーを取得 → `ANTHROPIC_API_KEY`

### 3. 環境変数
`.env.example` を `.env.local` にコピーして値を記入：
```bash
cp .env.example .env.local
```
> コスト重視なら `CLAUDE_MODEL=claude-haiku-4-5` に変更可（画像対応・低価格）。

### 4. 開発サーバー
```bash
npm install
npm run dev
```
http://localhost:3000 を開く。

---

## Vercel へのデプロイ
1. このリポジトリを GitHub に push
2. https://vercel.com で **New Project** → GitHub リポジトリを Import
3. **Environment Variables** に `.env.local` と同じ 5 つを設定
   （`NEXT_PUBLIC_*` はビルド時にも必要）
4. Deploy。以降は push で自動デプロイ

> Supabase の **Authentication → URL Configuration** に Vercel の本番 URL を
> Site URL / Redirect URLs として追加しておく。

---

## ディレクトリ
```
app/
  page.tsx            トップ
  login/              ログイン/新規登録
  capture/            撮影→識別→ドット絵化→保存
  dex/                図鑑
  world/              マイ動物園（react-konva）
  api/identify/       Claude 呼び出し（サーバー専用）
  auth/signout/       ログアウト
lib/
  supabase/           ブラウザ/サーバー/proxy 用クライアント
  claude.ts           Anthropic + 識別スキーマ
  pixelate.ts         背景除去＋ドット絵化＋JPEG化
  facilities.ts       施設座標テーブル＋判定
  types.ts
components/
  NavBar.tsx  WorldCanvas.tsx
supabase/schema.sql   DB スキーマ＋RLS
proxy.ts              セッション更新＋保護ルート
```

## セキュリティ
- `ANTHROPIC_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用（`NEXT_PUBLIC_` を付けない）
- Supabase RLS で各テーブルとも「自分の行だけ」操作可
- Storage は `captures/<user_id>/...` に本人のみ書き込み可
