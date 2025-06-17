# DesAIn_Assistant プロジェクト概要

## プロジェクト構成

DesAIn_Assistantは、Electron-Viteを使用したデスクトップアプリケーションで、React、TypeScript、Chakra-UI、Tailwind CSSを使用して構築されています。Google AI (Gemini)のAPIを活用したチャットアシスタント機能を提供します。

### i18n（国際化）システム

本アプリケーションは`react-i18next`を使用した完全な多言語対応を実装しています：

#### 実装の特徴
- **自動言語検出**: 初回起動時にシステムの言語設定を検出し、日本語環境では日本語、それ以外では英語を自動選択
- **動的言語切り替え**: アプリケーションの再起動不要で即座に言語変更
- **翻訳キーの階層構造**: ネストされたオブジェクト形式で翻訳を整理
- **変数補間対応**: `{{variable}}` 形式で動的な値を翻訳文に埋め込み可能
- **TypeScript型安全**: 翻訳キーの型定義により、存在しないキーの使用を防止
- **設定の永続化**: 選択した言語設定は自動的に保存され、次回起動時も維持される

#### 翻訳ファイルの構成
```
i18n/
├── index.ts         # i18next初期化と設定
└── locales/
    ├── ja.ts       # 日本語翻訳ファイル
    └── en.ts       # 英語翻訳ファイル
```

#### 使用方法
```typescript
// コンポーネント内での使用例
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
  const { t } = useTranslation()
  
  return <Button>{t('common.save')}</Button>
}
```

### 主要ディレクトリ・ファイル構成

```
DesAIn_Assistant/
├── .vscode/            - VSCode設定ファイル
├── build/              - ビルド関連ファイル
├── dist/               - ビルド出力ディレクトリ
├── node_modules/       - npm依存パッケージ
├── out/                - エレクトロン出力ディレクトリ
├── resources/          - リソースファイル
├── src/                - ソースコード
│   ├── main/           - Electronメインプロセス
│   │   ├── env.d.ts    - 環境変数型定義
│   │   └── index.ts    - メインプロセスエントリーポイント
│   ├── preload/        - Electronプリロードスクリプト
│   └── renderer/       - フロントエンドコード
│       ├── src/        - Reactアプリケーション
│       │   ├── assets/ - 画像などのアセット
│       │   ├── components/ - Reactコンポーネント
│       │   │   ├── modals/ - モーダルコンポーネント群
│       │   │   │   ├── APIConfigEditor.tsx - API設定エディター
│       │   │   │   ├── APISettingsModal.tsx - API設定モーダル
│       │   │   │   ├── AutoAssistSettingsModal.tsx - オートアシスト設定
│       │   │   │   ├── ExportModal.tsx - エクスポートモーダル
│       │   │   │   ├── ImportModeModal.tsx - インポートモーダル
│       │   │   │   ├── TitleEditModal.tsx - タイトル編集モーダル
│       │   │   │   ├── SettingsModal.tsx - 設定モーダル（言語設定、API設定等）
│       │   │   │   └── index.ts - モーダル群のインデックス
│       │   │   ├── panels/ - パネルコンポーネント群
│       │   │   ├── types/ - TypeScript型定義
│       │   │   ├── temp/ - 一時ファイル
│       │   │   ├── backup/ - バックアップファイル
│       │   │   ├── AttachmentList.tsx - ファイル添付リスト
│       │   │   ├── AutoAssistPanel.tsx - オートアシストパネル
│       │   │   ├── ChatHeader.tsx - チャットヘッダー
│       │   │   ├── ChatInputForm.tsx - チャット入力フォーム
│       │   │   ├── ChatSidebar.tsx - チャットサイドバー
│       │   │   ├── MessageItem.tsx - メッセージアイテム
│       │   │   ├── MessageList.tsx - メッセージリスト
│       │   │   ├── SettingsPanel.tsx - 設定パネル
│       │   │   ├── Main.tsx - メインコンポーネント
│       │   │   ├── Main_updated.tsx - 更新版メインコンポーネント
│       │   │   ├── postChatAI.ts - Gemini API通信モジュール
│       │   │   ├── promptTemplate.ts - プロンプトテンプレート
│       │   │   └── Versions.tsx - バージョン表示コンポーネント
│       │   ├── i18n/ - 国際化（i18n）設定
│       │   │   ├── index.ts - i18n初期化
│       │   │   └── locales/ - 言語ファイル
│       │   │       ├── ja.ts - 日本語翻訳
│       │   │       └── en.ts - 英語翻訳
│       │   ├── types/ - TypeScript型定義ファイル
│       │   ├── utils/ - ユーティリティ関数
│       │   ├── App.tsx - アプリケーションルート
│       │   ├── main.css - スタイルシート
│       │   ├── main.tsx - エントリーポイント
│       │   └── env.d.ts - 環境変数型定義
│       └── index.html  - HTMLテンプレート
├── .editorconfig      - エディター設定
├── .env                - 環境変数設定
├── .env.local         - ローカル環境変数
├── .eslintignore      - ESLint除外設定
├── .eslintrc.cjs      - ESLint設定
├── .gitignore         - Git除外設定
├── .npmrc             - npm設定
├── .prettierignore    - Prettier除外設定
├── .prettierrc.yaml   - Prettier設定
├── dev-app-update.yml - 開発用アップデート設定
├── electron-builder.yml - Electron Builder設定
├── electron.vite.config.ts - Electron Vite設定
├── package.json       - npm設定・依存関係
├── postcss.config.js  - PostCSS設定
├── tailwind.config.js - Tailwind CSS設定
├── tsconfig.json      - TypeScript設定
├── tsconfig.node.json - Node.js用TypeScript設定
├── tsconfig.web.json  - Web用TypeScript設定
└── README.md          - プロジェクト説明
```

## 主な機能

1. **チャットインターフェース**
   - ユーザーとAIアシスタントとの対話機能
   - マークダウン表示対応
   - メッセージのコピー、編集機能
   - 画像生成・表示機能

2. **アシスタント管理**
   - 複数のアシスタント作成・管理
   - カスタムシステムプロンプト設定
   - アシスタントの並び替え（ドラッグ＆ドロップ）
   - アシスタント削除機能

3. **オートアシスト機能**
   - タスク分解と最適なアシスタント自動選択
   - 複数アシスタントの連携処理
   - エージェントモード（自動実行）
   - Yes/No確認機能

4. **ファイル添付機能**
   - PDFやCSVなどのファイル添付・読み込み
   - ドラッグ＆ドロップ対応
   - CSV→JSON自動変換
   - 画像ファイル対応

5. **外部API連携**
   - トリガーワードによる外部API自動呼び出し
   - 画像生成API対応
   - カスタムAPI設定機能
   - APIレスポンス統合

6. **データ管理**
   - 会話履歴の保存・エクスポート・インポート
   - タイトル設定のカスタマイズ
   - APIキーの暗号化保存
   - 画像ファイルの自動管理

7. **UI/UX機能**
   - レスポンシブサイドバー（リサイズ対応）
   - カスタマイズ可能なタイトル表示
   - 背景画像設定
   - ダークモード対応（Chakra-UI経由）

8. **多言語対応（i18n）**
   - 日本語・英語の切り替え機能
   - 設定画面から簡単に言語変更可能
   - 全UI要素の完全な翻訳対応
   - 言語設定の永続化（再起動後も維持）

## 技術スタック

- **フレームワーク**: Electron (electron-vite)
- **フロントエンド**: React, TypeScript
- **UIライブラリ**: 
  - Chakra-UI（メインUIコンポーネント）
  - Tailwind CSS（カスタムスタイリング）
- **アイコン**: React Icons, Lucide React
- **国際化**: react-i18next（多言語対応）
- **主要ライブラリ**:
  - axios: APIリクエスト
  - react-markdown: マークダウンレンダリング
  - remark-gfm: GitHub Flavored Markdown対応
  - electron-store: データ永続化
  - electron-updater: アプリ更新
  - framer-motion: アニメーション
  - mammoth: Wordファイル読み込み
  - adm-zip: ZIP圧縮解凍
  - https-proxy-agent: プロキシ対応

## 主要コンポーネント

### Main.tsx

アプリケーションのメインコンポーネントで、以下の機能を提供します：

- チャットインターフェース（チャット履歴表示、メッセージ送信）
- アシスタント管理（作成・編集・削除・並び替え）
- オートアシスト機能（タスク分解・実行）
- ファイル添付処理（ドラッグ&ドロップ対応）
- 外部API連携（トリガー検知・実行）
- データのエクスポート/インポート
- リサイズ可能なサイドバー

### ChatInputForm.tsx

チャット入力用のフォームコンポーネント：
- メッセージ入力フィールド
- ファイル添付ボタン
- 送信ボタン
- エージェントファイル使用切り替え
- オートアシストモード切り替え

### MessageList.tsx & MessageItem.tsx

メッセージ表示用のコンポーネント群：
- メッセージの表示（ユーザー/AI別）
- マークダウンレンダリング
- メッセージコピー・編集機能
- 画像表示機能

### モーダルコンポーネント群 (modals/)

- **APISettingsModal.tsx**: 外部API設定用モーダル
- **AutoAssistSettingsModal.tsx**: オートアシスト設定用モーダル
- **ExportModal.tsx**: データエクスポート用モーダル
- **ImportModeModal.tsx**: データインポート用モーダル
- **TitleEditModal.tsx**: タイトル編集用モーダル
- **SettingsModal.tsx**: アプリケーション設定用モーダル（言語切り替え、API設定等）

### postChatAI.ts

Google AI (Gemini)のAPIとの通信を担当するモジュールです。メッセージ配列とシステムプロンプトを受け取り、APIリクエストを生成して結果を返します。

### promptTemplate.ts

各種アシスタント用のプロンプトテンプレートを定義しています。「リサーチ」「AIm」「イシューツリー」などの特定用途向けテンプレートが含まれています。

## 環境変数

`.env`ファイルには以下の設定が含まれています：

- `VITE_AI_API_ENDPOINT`: Google AI APIのエンドポイント
- `VITE_ENABLE_EXTERNAL_API`: 外部API機能の有効/無効設定
- `VITE_EXPIRY_DATE`: アプリケーションの有効期限
- `MAIN_VITE_PROXY`: プロキシ設定
- `MAIN_VITE_API_ENDPOINT`: メインプロセス用APIエンドポイント
- `MAIN_VITE_DEBUG`: デバッグモード設定

## 実行方法

```bash
# 依存関係のインストール
npm install

# 開発モード
npm run dev

# カスタム環境変数パスでの開発モード
npm run dev:custom

# TypeScriptチェック
npm run typecheck

# コードフォーマット
npm run format

# リンティング
npm run lint

# ビルド
npm run build

# 配布可能パッケージのビルド（展開版）
npm run build:unpack

# Windows用パッケージング
npm run build:win

# Mac用パッケージング
npm run build:mac

# Linux用パッケージング
npm run build:linux
```

## 設定機能

### 言語設定

アプリケーションは日本語と英語の2言語に対応しています：

1. **初回起動時の自動設定**: 
   - システムのロケール情報を自動検出
   - 日本語環境（ja-*）では日本語を自動選択
   - その他の環境では英語をデフォルトとして選択
   - 一度設定された言語は保存され、次回以降はその設定を使用

2. **言語切り替え**: ヘッダーの設定ボタンから設定モーダルを開き、「言語」タブで切り替え可能

3. **対応言語**:
   - 日本語（ja）
   - 英語（en）

4. **即時反映**: 言語を変更すると、すべてのUI要素が即座に新しい言語で表示

5. **設定の永続化**: 言語設定は `electron-store` を使用して安全に保存され、アプリケーション再起動後も維持

6. **完全な翻訳**: メニュー、ボタン、メッセージ、エラー表示等、すべてのテキストが翻訳対応

### API設定

アプリケーションは以下の方法でAPIキーを管理します：

1. **APIキー設定**: 設定モーダルの「API設定」タブからGoogle AI (Gemini) APIキーを設定
2. **暗号化保存**: APIキーは暗号化されてローカルに保存
3. **自動ロード**: アプリケーション再起動時に自動的にロード
4. **表示/非表示切り替え**: セキュリティのため表示切り替え可能
5. **外部API設定**: 設定モーダルの「API」タブから外部API連携の詳細設定が可能

## 外部API連携機能

- **トリガー設定**: キーワードやパターン（正規表現）でAPI呼び出しをトリガー
- **パラメータ抽出**: LLMを使用してユーザーメッセージからパラメータを自動抽出
- **レスポンス統合**: APIレスポンスをチャット内容に自動統合
- **画像生成対応**: 画像APIのレスポンスを画像として表示
- **エラーハンドリング**: API呼び出し失敗時の適切なエラー処理

## データ管理機能

### エクスポート機能
- **全データエクスポート**: 全アシスタント情報と会話履歴をJSONで出力
- **選択エクスポート**: 特定のアシスタントのみを選択してエクスポート
- **設定含める/含めない**: タイトル設定の出力可否を選択可能

### インポート機能
- **置き換えインポート**: 既存データを完全に置き換え
- **追加インポート**: 既存データに新しいデータを追加
- **競合解決**: 同名アシスタントがある場合の自動リネーム

## ファイル管理

- **ユーザーデータディレクトリ**: 会話履歴、添付ファイル、画像を保存
- **自動クリーンアップ**: アシスタント削除時の関連ファイル自動削除
- **ファイル形式対応**: PDF、CSV、TXT、PNG、JPG、GIF等に対応
- **画像表示**: 生成された画像や添付画像の直接表示

## 特記事項

- **有効期限機能**: アプリケーションには設定可能な有効期限があり、期限後は使用不可
- **リサイズ対応**: サイドバーは280px-600pxの範囲でリサイズ可能
- **ドラッグ&ドロップ**: アシスタントの順序変更、ファイル添付に対応
- **編集機能**: 過去のメッセージを編集して会話を分岐可能
- **自動スクロール**: 新しいメッセージが追加された際の自動スクロール

## 開発環境設定

### 推奨IDE
- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### コード品質管理
- **ESLint**: コード品質とスタイルの統一
- **Prettier**: コードフォーマットの自動化
- **TypeScript**: 型安全性の確保
- **EditorConfig**: エディター設定の統一

### ビルド設定
- **Electron Builder**: 各OS向けのパッケージング設定
- **Vite**: 高速な開発サーバーとビルド
- **PostCSS**: CSS処理とTailwind CSSの統合

## データ保存構造

アプリケーションは `electron-store` を使用して以下のようにデータを管理しています：

```
{app.getPath('userData')}/
├── history/
│   └── myhistory.json      # アシスタント情報と会話履歴
├── secure/
│   └── api-keys.json       # 暗号化されたAPIキー
├── config/
│   └── language-settings.json  # 言語設定
├── files/                  # アシスタントの添付ファイル
└── images/                 # 生成された画像ファイル
```

各ストアの特徴：
- **history**: アシスタントデータと会話履歴を保存
- **secure**: マシン固有の暗号化キーを使用してAPIキーを安全に保存
- **config**: アプリケーション設定（言語など）を保存

## セキュリティ

- **APIキー暗号化**: 保存されるAPIキーはマシン固有の情報（ホスト名＋ユーザー名）から生成された暗号化キーで保護
- **ファイル検証**: 添付ファイルの種類と内容の検証
- **プロキシ対応**: 企業環境でのプロキシ設定に対応
- **サンドボックス**: Electronのセキュリティベストプラクティスに準拠
- **データ分離**: APIキーなどの機密情報は、通常のアプリケーションデータとは別のストアに暗号化して保存
