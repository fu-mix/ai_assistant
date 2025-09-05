/**
 * 共通型定義ファイル
 * モーダルコンポーネント間で共有される型を定義
 */

/**
 * LLM用 Messages (inlineData対応)
 */
export type Messages = {
  role: string
  parts: {
    text?: string
    inlineData?: {
      mimeType: string
      data: string
    }
  }[]
}

/**
 * ユーザー/AIメッセージ (表示用)
 */
export type Message = {
  type: 'user' | 'ai'
  content: string
  imagePath?: string // 画像ファイルへのパス
}

/**
 * APIの設定を表す型
 */
export type APITrigger = {
  type: 'keyword' | 'pattern'
  value: string
  description: string
}

export type APIConfig = {
  id: string
  name: string
  description?: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: Record<string, string>
  bodyTemplate?: string
  queryParamsTemplate?: string
  responseTemplate?: string
  authType?: 'none' | 'basic' | 'bearer' | 'apiKey'
  authConfig?: {
    username?: string
    password?: string
    token?: string
    keyName?: string
    keyValue?: string
    inHeader?: boolean
  }
  triggers: APITrigger[]
  parameterExtraction?: {
    paramName: string
    description: string
  }[]
  responseType?: 'text' | 'image'
  imageDataPath?: string
}

/**
 * アシスタント情報
 */
export type ChatInfo = {
  id: number
  customTitle: string
  systemPrompt: string
  messages: Message[]
  postMessages: Messages[]
  createdAt: string
  inputMessage: string
  agentFilePaths?: string[]
  assistantSummary?: string
  apiConfigs?: APIConfig[]
  enableAPICall?: boolean
}

/**
 * タイトル設定用の型定義
 */
export type TitleSegment = {
  text: string
  color: string
}

export type TitleSettings = {
  segments: TitleSegment[]
  fontFamily: string
  backgroundImagePath?: string
}

/**
 * オートアシスト状態
 */
export type AutoAssistState = 'idle' | 'awaitConfirm' | 'executing'

/**
 * オートアシスト: タスク分解結果
 */
export type SubtaskInfo = {
  task: string
  recommendedAssistant: string | null
}
