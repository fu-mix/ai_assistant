# DesAIn_Assistant プロジェクト概要

## プロジェクト構成

DesAIn_Assistantは、Electron-Viteを使用したデスクトップアプリケーションで、React、TypeScript、Chakra-UIを使用して構築されています。Google AI (Gemini)のAPIを活用したチャットアシスタント機能を提供します。

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
│   ├── preload/        - Electronプリロードスクリプト
│   └── renderer/       - フロントエンドコード
│       ├── src/        - Reactアプリケーション
│       │   ├── assets/ - 画像などのアセット
│       │   ├── components/ - Reactコンポーネント
│       │   │   ├── FinalRefinedElectronAppMockup.tsx - メインコンポーネント
│       │   │   ├── postChatAI.ts - Gemini API通信モジュール
│       │   │   ├── promptTemplate.ts - プロンプトテンプレート
│       │   │   └── Versions.tsx - バージョン表示コンポーネント
│       │   ├── App.tsx - アプリケーションルート
│       │   ├── main.css - スタイルシート
│       │   └── main.tsx - エントリーポイント
│       └── index.html  - HTMLテンプレート
├── .env                - 環境変数設定
├── electron-builder.yml - Electron Builder設定
├── electron.vite.config.ts - Electron Vite設定
├── package.json       - npm設定・依存関係
├── tsconfig.json      - TypeScript設定
└── README.md          - プロジェクト説明
```

## 主な機能

1. **チャットインターフェース**
   - ユーザーとAIアシスタントとの対話機能
   - マークダウン表示対応
   - メッセージのコピー、編集機能

2. **アシスタント管理**
   - 複数のアシスタント作成・管理
   - カスタムシステムプロンプト設定
   - アシスタントの並び替え（ドラッグ＆ドロップ）

3. **オートアシスト機能**
   - タスク分解と最適なアシスタント自動選択
   - 複数アシスタントの連携処理

4. **ファイル添付機能**
   - PDFやCSVなどのファイル添付・読み込み
   - ドラッグ＆ドロップ対応

5. **外部API連携**
   - トリガーワードによる外部API自動呼び出し
   - 画像生成API対応

6. **データ管理**
   - 会話履歴の保存・エクスポート・インポート
   - タイトル設定のカスタマイズ

## 技術スタック

- **フレームワーク**: Electron (electron-vite)
- **フロントエンド**: React, TypeScript
- **UIライブラリ**: Chakra-UI
- **主要ライブラリ**:
  - axios: APIリクエスト
  - react-markdown: マークダウンレンダリング
  - electron-store: データ永続化
  - electron-updater: アプリ更新

## 主要コンポーネント

### FinalRefinedElectronAppMockup.tsx

アプリケーションのメインコンポーネントで、以下の機能を提供します：

- チャットインターフェース
- アシスタント管理（作成・編集・削除）
- ファイル添付処理
- オートアシスト機能
- 外部API連携
- データのエクスポート/インポート

### postChatAI.ts

Google AI (Gemini)のAPIとの通信を担当するモジュールです。メッセージ配列とシステムプロンプトを受け取り、APIリクエストを生成して結果を返します。

### promptTemplate.ts

各種アシスタント用のプロンプトテンプレートを定義しています。「リサーチ」「AIm」「イシューツリー」などの特定用途向けテンプレートが含まれています。

## 環境変数

`.env`ファイルには以下の設定が含まれています：

- `VITE_AI_API_ENDPOINT`: Google AI APIのエンドポイント
- `VITE_ENABLE_EXTERNAL_API`: 外部API機能の有効/無効設定
- `VITE_EXPIRY_DATE`: アプリケーションの有効期限

## 実行方法

```bash
# 開発モード
npm run dev

# ビルド
npm run build

# Windows用パッケージング
npm run build:win

# Mac用パッケージング
npm run build:mac

# Linux用パッケージング
npm run build:linux
```

## API設定

アプリケーションは以下の方法でAPIキーを管理します：

1. アプリケーション内でAPIキーを設定
2. 永続化ストレージにAPIキーを保存
3. アプリケーション再起動時に自動的にロード

## 特記事項

- アプリケーションはユーザーデータディレクトリに会話履歴やファイル添付を保存します
- 外部API連携機能は環境変数で無効化できます
- アプリケーションには有効期限が設定されており、期限後は使用できなくなります

## 推奨IDE設定

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
