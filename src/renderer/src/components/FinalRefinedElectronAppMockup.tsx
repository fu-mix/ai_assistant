import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, memo } from 'react'
import {
  Box,
  Flex,
  Heading,
  Input,
  Textarea,
  Text,
  HStack,
  IconButton,
  useToast,
  List,
  ListItem,
  Button,
  Checkbox,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Switch,
  Tooltip,
  Select,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Radio,
  RadioGroup,
  VStack,
  FormHelperText,
  Divider,
  Badge,
  InputRightElement,
  InputGroup,
  Spinner,
  Image
} from '@chakra-ui/react'
import { MessageList } from './MessageList'
import { ChatInputForm } from './ChatInputForm'
import { AttachmentList } from './AttachmentList'
import { ChatSidebar, ChatHeader, AutoAssistPanel, SettingsPanel } from './panels'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { AiOutlineDelete } from 'react-icons/ai'
import { MdOutlineContentCopy } from 'react-icons/md'
import { FiEdit } from 'react-icons/fi'
import { HamburgerIcon, DownloadIcon } from '@chakra-ui/icons'

import {
  APIConfigEditor,
  APISettingsModal,
  AutoAssistSettingsModal,
  ExportModal,
  ImportModeModal,
  TitleEditModal
} from './modals'
/**
 * Electron API interface
 */
interface ElectronAPI {
  postChatAI: (message: Messages[], apiKey: string, systemPrompt: string) => Promise<any>
  loadAgents: () => Promise<ChatInfo[]>
  saveAgents: (agentsData: ChatInfo[]) => Promise<any>
  copyFileToUserData: (oldFilePath?: string) => Promise<string | null>
  readFileByPath: (filePath: string) => Promise<string | null>
  deleteFileInUserData: (filePath: string) => Promise<boolean>
  getAppVersion: () => Promise<string>

  loadTitleSettings?: () => Promise<TitleSettings | null>
  saveTitleSettings?: (settings: TitleSettings) => Promise<void>

  showSaveDialog?: (defaultFileName: string) => Promise<void>
  showOpenDialogAndRead?: () => Promise<string | null>
  replaceLocalHistoryConfig?: (newContent: string) => Promise<void>

  // 部分エクスポート・追加インポート用
  exportSelectedAgents?: (arg: { selectedIds: number[]; includeHistory: boolean }) => Promise<void>
  appendLocalHistoryConfig?: (newContent: string) => Promise<void>

  // 追加: 外部API呼び出し用の定義
  callExternalAPI?: (
    apiConfig: APIConfig,
    params: any
  ) => Promise<{
    success: boolean
    data?: any
    error?: string
    status?: number
  }>

  // 画像保存用の関数
  saveImageToFile: (base64Data: string) => Promise<string>

  // 画像読み込み用の関数
  loadImage: (imagePath: string) => Promise<string | null>

  directDeleteFile: (filePath: string) => Promise<boolean>
  // ユーザーデータパス取得用の関数を追加
  getUserDataPath: () => Promise<string>

  //APIキー保存用/読み込み
  saveApiKey: (apiKey: string) => Promise<boolean>
  loadApiKey: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

/**
 * タイトル設定用
 */
type TitleSegment = {
  text: string
  color: string
}
type TitleSettings = {
  segments: TitleSegment[]
  fontFamily: string
  backgroundImagePath?: string
}

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
type Message = {
  type: 'user' | 'ai'
  content: string
  imagePath?: string // 画像ファイルへのパス
}

/**
 * アシスタント情報
 */
type ChatInfo = {
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
 * オートアシスト状態
 */
type AutoAssistState = 'idle' | 'awaitConfirm' | 'executing'

/**
 * オートアシスト: タスク分解結果
 */
type SubtaskInfo = {
  task: string
  recommendedAssistant: string | null
}

/**
 * APIの設定を表す型
 */
type APITrigger = {
  type: 'keyword' | 'pattern'
  value: string
  description: string
}

type APIConfig = {
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

/* ------------------------------------------------
 * タイトル編集モーダル
 * ------------------------------------------------ */

/* ------------------------------------------------
 * オートアシスト設定モーダル
 * ------------------------------------------------ */

/* ------------------------------------------------
 * ExportModal: 一部 or 全部 のエクスポート
 *    ※「会話履歴を含める」チェックボックスを追加
 * ------------------------------------------------ */

/* ------------------------------------------------
 * ImportModeModal: "全部置き換え" or "追加" 選択
 * ------------------------------------------------ */
/* ------------------------------------------------
 * CSV→JSONの単純変換ユーティリティ
 * ------------------------------------------------ */
function csvToJson(csv: string): string {
  const lines = csv.split(/\r?\n/)
  if (lines.length <= 1) return '[]'
  const headers = lines[0].split(',')
  const result = []
  for (let i = 1; i < lines.length; i++) {
    const obj: any = {}
    const currentline = lines[i].split(',')
    if (currentline.length !== headers.length) {
      continue
    }
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentline[j]
    }
    // @ts-ignore
    result.push(obj)
  }

  return JSON.stringify(result, null, 2)
}

function buildUserParts(
  text: string,
  files: { name: string; data: string; mimeType: string }[]
): { text?: string; inlineData?: { mimeType: string; data: string } }[] {
  const parts: Messages['parts'] = [{ text }]
  for (const f of files) {
    // CSV → JSON 変換は AutoAssist と同じロジック
    if (f.mimeType === 'text/csv') {
      try {
        const csvStr = atob(f.data)
        const jsonStr = csvToJson(csvStr)
        parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
      } catch {
        parts[0].text += '\n(CSV→JSON失敗)'
      }
    }
    parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } })
  }

  return parts
}

/** agentFilePaths に保存されているファイルを tempFiles と同じ形に読み込む */
async function readAgentFiles(
  paths: string[]
): Promise<{ name: string; data: string; mimeType: string }[]> {
  const out: { name: string; data: string; mimeType: string }[] = []

  for (const p of paths) {
    // ユーザーデータ領域に置いたファイルを base64 で読む
    const base64 = await window.electronAPI.readFileByPath(p)
    if (!base64) continue

    // 拡張子→ MIME 判定（buildUserParts と同じノリ）
    const lower = p.toLowerCase()
    let mime = 'application/octet-stream'
    if (lower.endsWith('.pdf')) mime = 'application/pdf'
    else if (lower.endsWith('.txt')) mime = 'text/plain'
    else if (lower.endsWith('.png')) mime = 'image/png'
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg'
    else if (lower.endsWith('.gif')) mime = 'image/gif'
    else if (lower.endsWith('.csv')) mime = 'text/csv'

    // ファイル名だけ抽出
    const name = p.split(/[/\\]/).pop() || p

    out.push({ name, data: base64, mimeType: mime })
  }

  return out
}

// API検知関数 - ユーザーメッセージからトリガーされるAPIを検出
async function detectTriggeredAPIs(
  userMessage: string,
  apiConfigs: APIConfig[]
): Promise<APIConfig[]> {
  const triggeredAPIs: APIConfig[] = []

  for (const apiConfig of apiConfigs) {
    // トリガーが設定されていない場合はスキップ
    if (!apiConfig.triggers || apiConfig.triggers.length === 0) {
      continue
    }

    let isTriggered = false

    // 各トリガーをチェック
    for (const trigger of apiConfig.triggers) {
      if (trigger.type === 'keyword') {
        // キーワードタイプのトリガー
        const keywords = trigger.value.split(',').map((k) => k.trim())

        if (
          keywords.some((keyword) => {
            const found = userMessage.toLowerCase().includes(keyword.toLowerCase())

            return found
          })
        ) {
          isTriggered = true
          break
        }
      } else if (trigger.type === 'pattern') {
        // パターンタイプのトリガー
        try {
          const regex = new RegExp(trigger.value, 'i')
          const match = regex.test(userMessage)

          if (match) {
            isTriggered = true
            break
          }
        } catch (err) {
          console.error(`無効な正規表現パターン: ${trigger.value}`, err)
        }
      }
    }

    if (isTriggered) {
      triggeredAPIs.push(apiConfig)
    }
  }

  return triggeredAPIs
}

// API処理関数 - 検出されたAPIを実行し結果を統合
async function processAPITriggers(
  userMessage: string,
  apiConfigs: APIConfig[],
  apiKey: string,
  selectedChat?: ChatInfo | null
): Promise<{
  processedMessage: string
  imageResponse?: { base64Data: string; prompt: string } | null
  isImageOnly?: boolean // 追加
}> {
  const isExternalApiEnabled = import.meta.env.VITE_ENABLE_EXTERNAL_API !== 'false'

  // 外部API機能が無効の場合は処理しない
  if (!isExternalApiEnabled) {
    return { processedMessage: userMessage }
  }

  // トリガーされたAPIを検出
  const triggeredAPIs = await detectTriggeredAPIs(userMessage, apiConfigs)

  if (triggeredAPIs.length === 0) {
    return { processedMessage: userMessage } // APIトリガーなし
  }

  let processedMessage = userMessage
  let imageResponse = null
  let isImageOnly = false // デフォルトは画像のみではない

  for (const apiConfig of triggeredAPIs) {
    try {
      // パラメータ抽出 - ここでapiKeyを渡す
      const params = await extractParametersWithLLM(userMessage, apiConfig, apiKey)

      // 会話履歴がある場合は適切な形式に変換
      if (selectedChat && selectedChat.messages && selectedChat.messages.length > 0) {
        // OpenAI形式のフォーマット済み会話履歴
        const openAIFormattedHistory = selectedChat.messages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
        params.openAIFormattedHistory = openAIFormattedHistory
        params.openAIFormattedHistoryStr = JSON.stringify(openAIFormattedHistory).slice(1, -1) // 配列の [ ] を取り除く

        // Gemini形式のフォーマット済み会話履歴
        const geminiFormattedHistory = selectedChat.messages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))
        params.geminiFormattedHistory = geminiFormattedHistory
        params.geminiFormattedHistoryStr = JSON.stringify(geminiFormattedHistory).slice(1, -1) // 配列の [ ] を取り除く
      }

      // オリジナルの会話履歴も含める（必要に応じて）
      params.conversationHistory = selectedChat?.messages || []
      params.prompt = userMessage

      // callExternalAPIメソッドの存在確認
      if (!window.electronAPI.callExternalAPI) {
        console.error('callExternalAPI機能が実装されていません')
        processedMessage += `\n\n[補足情報: ${apiConfig.name}]\nAPI呼び出し機能が利用できません。`
        continue
      }

      // API呼び出し実行
      const apiResponse = await window.electronAPI.callExternalAPI(apiConfig, params)

      // 画像レスポンスの場合

      if (apiResponse.success && apiConfig.responseType === 'image' && apiResponse.data) {
        // @ts-ignore
        imageResponse = {
          base64Data: apiResponse.data,
          prompt: userMessage
        }

        // レスポンスタイプが「画像」のAPIの場合、そのトリガーに一致したかどうかで判断
        // 固定のキーワードリストではなく、APIの設定自体をチェック
        const isImageGenerationTrigger =
          // レスポンスタイプが明示的に「image」に設定されているかチェック
          apiConfig.responseType === 'image' &&
          // 現在のメッセージがこのAPIのトリガーのいずれかに一致したかを確認
          apiConfig.triggers.some((trigger) => {
            if (trigger.type === 'keyword') {
              // キーワードタイプのトリガー
              const keywords = trigger.value.split(',').map((k) => k.trim().toLowerCase())

              // ユーザーメッセージ内にいずれかのキーワードが含まれているか
              return keywords.some((keyword) =>
                userMessage.toLowerCase().includes(keyword.toLowerCase())
              )
            } else if (trigger.type === 'pattern') {
              // パターン（正規表現）タイプのトリガー
              try {
                const regex = new RegExp(trigger.value, 'i')

                return regex.test(userMessage)
              } catch (err) {
                console.error(`無効な正規表現パターン: ${trigger.value}`, err)

                return false
              }
            }

            return false
          })

        // 画像生成に特化したトリガーであれば、isImageOnlyをtrueに設定
        if (isImageGenerationTrigger) {
          isImageOnly = true
        }

        // 画像APIの場合は文字列追加しない（画像として処理するため）
        continue
      }

      // 結果テキスト生成
      let resultText = ''
      if (apiResponse.success) {
        resultText =
          typeof apiResponse.data === 'string'
            ? apiResponse.data
            : JSON.stringify(apiResponse.data, null, 2)
      } else {
        resultText = `エラー: ${apiResponse.error || '不明なエラー'}`
      }

      // メッセージに結果を追加（ノートとして）
      processedMessage += `\n\n[補足情報: ${apiConfig.name}]\n${resultText}`
    } catch (err) {
      console.error(`API呼び出し失敗: ${apiConfig.name}`, err)
      processedMessage += `\n\n[補足情報: ${apiConfig.name}]\nAPI呼び出し中にエラーが発生しました。`
    }
  }

  return { processedMessage, imageResponse, isImageOnly }
}

async function extractParametersWithLLM(
  userMessage: string,
  apiConfig: APIConfig,
  apiKey: string
): Promise<any> {
  // デフォルトパラメータの設定（最低限のフォールバック）
  const defaultParams: any = {}

  // トリガーがキーワードタイプの場合、promptパラメータを設定するが、キーワードは削除しない
  if (apiConfig.triggers && apiConfig.triggers.length > 0) {
    for (const trigger of apiConfig.triggers) {
      if (trigger.type === 'keyword') {
        const keywords = trigger.value.split(',').map((k) => k.trim())
        for (const keyword of keywords) {
          if (userMessage.toLowerCase().includes(keyword.toLowerCase())) {
            // キーワードを削除せず、元のメッセージをpromptパラメータとして設定
            defaultParams.prompt = userMessage
            // トークンがconfig経由で提供されている場合は使用
            if (apiConfig.authConfig?.token) {
              defaultParams.apiKey = apiConfig.authConfig.token
            }
            break
          }
        }
      }
    }
  }

  // パラメータ抽出設定がない場合はデフォルトパラメータを返す
  if (!apiConfig.parameterExtraction || apiConfig.parameterExtraction.length === 0) {
    return defaultParams
  }

  // パラメータ抽出設定がある場合はLLMを使用して抽出
  const extractionPrompt = `
あなたはパラメータ抽出エンジンです。
ユーザーのメッセージから必要なパラメータを抽出してください。

ユーザーメッセージ:
"${userMessage}"

抽出すべきパラメータ:
${apiConfig.parameterExtraction.map((p) => `- ${p.paramName}: ${p.description}`).join('\n')}

結果は以下のJSON形式で返してください:
{
  "パラメータ名": "抽出値"
}
余計な説明は不要です。JSONだけを返してください。
`

  try {
    const extractionResponse = await window.electronAPI.postChatAI(
      [{ role: 'user', parts: [{ text: extractionPrompt }] }],
      apiKey,
      'あなたはパラメータ抽出エンジンです。JSONだけを返してください。'
    )

    const jsonMatch = extractionResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return defaultParams
    }

    try {
      const extractedParams = JSON.parse(jsonMatch[0])

      // APIキーの追加
      if (apiConfig.authConfig?.token) {
        extractedParams.apiKey = apiConfig.authConfig.token
      }

      // オリジナルのメッセージを保持するためにoriginalMessageパラメータを追加
      extractedParams.originalMessage = userMessage

      return extractedParams
    } catch (parseError) {
      console.error('パラメータJSON解析エラー:', parseError)

      return defaultParams
    }
  } catch (err) {
    console.error('パラメータ抽出中にエラー:', err)

    return defaultParams
  }
}

// APIに渡すシステムプロンプトを強化する関数
function enhanceSystemPromptWithAPIContext(
  originalPrompt: string,
  apiConfigs: APIConfig[],
  apiResult?: { originalMessage?: string; processedMessage?: string; error?: string } | null
): string {
  if (!apiConfigs || apiConfigs.length === 0) {
    return originalPrompt
  }

  // API情報の説明テキスト
  const apiInfo = apiConfigs
    .map((api) => {
      return `
- API名: ${api.name}
  - 説明: ${api.description || 'なし'}
  - 提供する情報: ${api.triggers.map((t) => t.description).join(', ') || 'なし'}
  `
    })
    .join('\n')

  // API実行結果の情報を追加
  let apiResultInfo = ''
  if (apiResult) {
    if (apiResult.error) {
      apiResultInfo = `
注意: 直近のユーザーメッセージに対するAPI呼び出しに失敗しました。
エラー: ${apiResult.error}

これは内部エラーであり、ユーザーには通知されていません。
通常通り対応し、このエラーについては言及しないでください。
`
    } else if (
      apiResult.processedMessage &&
      apiResult.processedMessage !== apiResult.originalMessage
    ) {
      // APIが成功して追加情報が含まれている場合
      apiResultInfo = `
注意: 直近のユーザーメッセージに対して、API呼び出しが実行され、追加情報が含まれています。
オリジナルメッセージ: "${apiResult.originalMessage}"
APIから追加された情報も含むメッセージ: "${apiResult.processedMessage}"

この情報はユーザーに表示されません。ユーザーは追加された情報を認識していないため、
回答には自然に情報を織り込んでください。
`
    }
  }

  // システムプロンプトに追加
  return `
${originalPrompt}

あなたには様々な外部情報へのアクセス機能があります。ユーザーの質問やリクエストによっては、これらの情報源からデータが自動的に提供されます。以下は利用可能な情報源のリストです：

${apiInfo}
${apiResultInfo}

これらの情報源からのデータはユーザーの質問に含まれる場合があります。このデータを使って最適な回答を提供してください。

データが提供されている場合は、その情報を活用して回答してください。ユーザーには「このデータは〇〇APIから取得しました」などと説明する必要はありません。自然な回答に情報を組み込んでください。

データが提供されていない場合でも、一般的な知識に基づいて最善の回答を提供してください。
`
}

/* ------------------------------------------------
 * メインコンポーネント
 * ------------------------------------------------ */
export const FinalRefinedElectronAppMockup = () => {
  // 環境変数から外部API機能の有効/無効状態を確認
  const isExternalApiEnabled = import.meta.env.VITE_ENABLE_EXTERNAL_API !== 'false'

  const toast = useToast()

  // ▼ リサイズ用stateを追加（左カラム幅）
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(280)
  // ▼ リサイズ中かどうかのフラグ
  const [isResizing, setIsResizing] = useState<boolean>(false)

  // ▼ リサイズ時のマウス操作をハンドルするuseEffect
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isResizing) return
      // ドラッグ中の場合、マウスのX座標で左カラム幅を更新
      let newWidth = e.clientX
      // 最小/最大幅などを設定する場合は調整
      if (newWidth < 200) newWidth = 200
      if (newWidth > 600) newWidth = 600
      setLeftPaneWidth(newWidth)
    }

    function handleMouseUp() {
      if (isResizing) {
        setIsResizing(false)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // タイトル設定
  const [titleSettings, setTitleSettings] = useState<TitleSettings>({
    segments: [
      { text: 'D', color: '#ff6600' },
      { text: 'es', color: '#333333' },
      { text: 'AI', color: '#dd5588' },
      { text: 'n ', color: '#333333' },
      { text: 'A', color: '#ffd700' },
      { text: 'ssistant', color: '#333333' }
    ],
    fontFamily: 'Arial',
    backgroundImagePath: undefined
  })
  const [isTitleEditOpen, setIsTitleEditOpen] = useState(false)
  const [titleHovered, setTitleHovered] = useState(false)
  const [headerBgDataUri, setHeaderBgDataUri] = useState<string | undefined>(undefined)

  // オートアシスト関連
  const [autoAssistMessages, setAutoAssistMessages] = useState<Message[]>([])
  const [autoAssistState, setAutoAssistState] = useState<AutoAssistState>('idle')
  const [pendingSubtasks, setPendingSubtasks] = useState<SubtaskInfo[]>([])
  const [pendingEphemeralMsg, setPendingEphemeralMsg] = useState<Messages | null>(null)
  const AUTO_ASSIST_ID = 999999
  const [agentMode, setAgentMode] = useState<boolean>(false)

  // 全チャット関連
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null | 'autoAssist'>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [tempFiles, setTempFiles] = useState<{ name: string; data: string; mimeType: string }[]>([])

  // モーダル類
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalChatTitle, setModalChatTitle] = useState('')
  const [modalSystemPrompt, setModalSystemPrompt] = useState('')
  const [modalAgentFiles, setModalAgentFiles] = useState<{ name: string; path: string }[]>([])
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')
  const [editingAgentFiles, setEditingAgentFiles] = useState<{ name: string; path: string }[]>([])
  const [editingCustomTitle, setEditingCustomTitle] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isResetAutoAssistConfirm, setIsResetAutoAssistConfirm] = useState(false)

  const [useAgentFile, setUseAgentFile] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isAutoAssistSettingsOpen, setIsAutoAssistSettingsOpen] = useState(false)

  // エクスポート・インポート
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isImportModeModalOpen, setIsImportModeModalOpen] = useState(false)
  const [importedConfigRaw, setImportedConfigRaw] = useState<string | null>(null)

  // 参照
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 編集用Index
  const [editIndex, setEditIndex] = useState<number | null>(null)

  // バージョン
  const [appVersion, setAppVersion] = useState<string>('')

  // ドラッグ管理
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // for scroll
  const prevMessageCountRef = useRef<number>(0)

  // API設定関連の状態追加
  const [isAPISettingsOpen, setIsAPISettingsOpen] = useState(false)
  const [editingAPIConfigs, setEditingAPIConfigs] = useState<APIConfig[]>([])
  const [enableAPICall, setEnableAPICall] = useState(false)

  // メインコンポーネントの状態変数に追加
  const [modalEnableAPICall, setModalEnableAPICall] = useState(false)
  const [modalAPIConfigs, setModalAPIConfigs] = useState<APIConfig[]>([])
  const [isCreateAPISettingsOpen, setIsCreateAPISettingsOpen] = useState(false)

  const saveAutoAssistData = async (updatedChats: ChatInfo[]) => {
    try {
      // UIの状態を更新
      setChats(updatedChats)

      // オートアシストの状態も別途更新
      const autoAssist = updatedChats.find((c) => c.id === AUTO_ASSIST_ID)
      if (autoAssist) {
        setAutoAssistMessages(autoAssist.messages)
      }

      // 保存を実行して完了を待つ
      await window.electronAPI.saveAgents(updatedChats)

      // 念のため状態を再確認
      return true
    } catch (err) {
      console.error('Failed to save AutoAssist data:', err)

      return false
    }
  }

  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)

  // APIキー設定モーダル用のstate
  const [isApiKeySettingsOpen, setIsApiKeySettingsOpen] = useState(false)

  // --------------------------------
  // 初期ロード
  // --------------------------------
  useEffect(() => {
    // APIキーの読み込み
    const loadApiKey = async () => {
      try {
        setIsLoadingApiKey(true)
        const savedApiKey = await window.electronAPI.loadApiKey()
        if (savedApiKey) {
          setApiKey(savedApiKey)
        }
      } catch (err) {
        console.error('Failed to load API key:', err)
      } finally {
        setIsLoadingApiKey(false)
      }
    }

    loadApiKey()

    window.electronAPI.loadAgents().then((stored) => {
      if (Array.isArray(stored)) {
        const reformed = stored.map((c) => ({
          ...c,
          agentFilePaths: c.agentFilePaths || []
        }))
        const foundAuto = reformed.find((c) => c.id === AUTO_ASSIST_ID)
        if (!foundAuto) {
          const newAutoAssist: ChatInfo = {
            id: AUTO_ASSIST_ID,
            customTitle: 'AutoAssistSystem',
            systemPrompt: '',
            messages: [],
            postMessages: [],
            createdAt: new Date().toLocaleString(),
            inputMessage: '',
            agentFilePaths: []
          }
          // @ts-ignore
          reformed.push(newAutoAssist)
        }
        setChats(reformed)
        const auto = reformed.find((cc) => cc.id === AUTO_ASSIST_ID)
        if (auto) {
          setAutoAssistMessages(auto.messages)
        }
      }
    })

    window.electronAPI.getAppVersion().then((ver) => setAppVersion(ver))

    const expiryDate = new Date(import.meta.env.VITE_EXPIRY_DATE)
    if (new Date().getTime() > expiryDate.getTime()) {
      setIsExpired(true)
    }

    if (window.electronAPI.loadTitleSettings) {
      window.electronAPI
        .loadTitleSettings()
        .then((loaded) => {
          if (loaded) {
            setTitleSettings(loaded)
          }
        })
        .catch((err) => console.error('Failed to load TitleSettings:', err))
    }
  }, [])

  // チャット欄スクロール制御
  useLayoutEffect(() => {
    // 現在のメッセージ配列を特定
    const currentMessages =
      selectedChatId === 'autoAssist'
        ? autoAssistMessages
        : typeof selectedChatId === 'number'
          ? chats.find((c) => c.id === selectedChatId)?.messages || []
          : []

    // メッセージ配列の長さを取得
    const currentMsgCount = currentMessages.length

    // 新しいメッセージが追加された場合やチャットが切り替わった場合にスクロール
    if (chatHistoryRef.current) {
      // 現在のスクロール位置がほぼ最下部にあるか、新しいメッセージが追加された場合
      const isAtBottom =
        chatHistoryRef.current.scrollTop + chatHistoryRef.current.clientHeight >=
        chatHistoryRef.current.scrollHeight - 100

      if (isAtBottom || currentMsgCount > prevMessageCountRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
      }
    }

    prevMessageCountRef.current = currentMsgCount
  }, [selectedChatId, autoAssistMessages, chats])

  // ヘッダー背景画像の base64化
  useEffect(() => {
    async function loadHeaderBgIfNeeded() {
      const bgPath = titleSettings.backgroundImagePath
      if (!bgPath) {
        setHeaderBgDataUri(undefined)

        return
      }
      try {
        const fileBase64 = await window.electronAPI.readFileByPath(bgPath)
        if (!fileBase64) {
          setHeaderBgDataUri(undefined)

          return
        }
        const lower = bgPath.toLowerCase()
        let mime = 'image/png'
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg'
        else if (lower.endsWith('.gif')) mime = 'image/gif'
        else if (lower.endsWith('.webp')) mime = 'image/webp'

        setHeaderBgDataUri(`data:${mime};base64,${fileBase64}`)
      } catch (err) {
        console.error('Failed to load header background as base64:', err)
        setHeaderBgDataUri(undefined)
      }
    }
    loadHeaderBgIfNeeded()
  }, [titleSettings.backgroundImagePath])

  const handleUseAgentFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUseAgentFile(e.target.checked)
  }, [])

  const handleAgentModeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAgentMode(e.target.checked)
  }, [])

  const memoizedSendMessage = useMemo(() => {
    return () => sendMessage()
  }, [sendMessage])

  const deleteImageFiles = async (messages: Message[]): Promise<void> => {
    // 画像パスを持つメッセージを特定
    const imageMessages = messages.filter((msg) => msg.imagePath && msg.imagePath.trim() !== '')

    if (imageMessages.length === 0) {
      console.log('削除対象の画像ファイルはありません')

      return
    }

    console.log(`画像ファイル削除対象: ${imageMessages.length}件`)

    // 直接削除APIが利用可能か確認
    const hasDirectDeleteAPI = !!window.electronAPI.directDeleteFile

    if (!hasDirectDeleteAPI) {
      console.warn('directDeleteFile APIが利用できません。削除処理をスキップします。')

      return
    }

    // 画像ファイルを削除
    for (const msg of imageMessages) {
      if (msg.imagePath) {
        try {
          console.log(`処理対象画像パス: ${msg.imagePath}`)

          // 直接削除APIを使用
          const result = await window.electronAPI.directDeleteFile(msg.imagePath)

          if (result) {
            console.log(`✓ 画像ファイル削除成功: ${msg.imagePath}`)
          } else {
            console.warn(`✗ 画像ファイル削除失敗: ${msg.imagePath}`)
          }
        } catch (err) {
          console.error(`✗ 画像ファイル削除エラー: ${msg.imagePath}`, err)
        }
      }
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    const newFiles: { name: string; data: string; mimeType: string }[] = []
    let processed = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result) {
          const base64Data = reader.result.toString().split(',')[1]
          const lower = file.name.toLowerCase()

          let mime = 'application/octet-stream'
          if (lower.endsWith('.pdf')) mime = 'application/pdf'
          else if (lower.endsWith('.txt')) mime = 'text/plain'
          else if (lower.endsWith('.png')) mime = 'image/png'
          else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg'
          else if (lower.endsWith('.gif')) mime = 'image/gif'
          else if (lower.endsWith('.csv')) mime = 'text/csv'

          newFiles.push({
            name: file.name,
            data: base64Data,
            mimeType: mime
          })
        }
        processed++
        if (processed === files.length) {
          setTempFiles((prev) => [...prev, ...newFiles])
        }
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleTempFileDelete = useCallback((targetName: string) => {
    setTempFiles((prev) => prev.filter((f) => f.name !== targetName))
  }, [])

  // メッセージコピー処理のメモ化
  const handleMessageCopy = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(content)
      toast({
        title: 'コピーしました',
        status: 'success',
        duration: 1000,
        isClosable: true
      })
    },
    [toast]
  )

  // メッセージ編集処理のメモ化
  const handleMessageEdit = useCallback((index: number, content: string) => {
    setEditIndex(index)
    setInputMessage(content)
    chatInputRef.current?.focus()
  }, [])

  const handleFileSelection = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // --------------------------------
  // 入力フォーム
  // --------------------------------
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value
      setInputMessage(val)

      if (typeof selectedChatId === 'number') {
        setChats((prev) =>
          prev.map((chat) => (chat.id === selectedChatId ? { ...chat, inputMessage: val } : chat))
        )
      }
    },
    [selectedChatId]
  )

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!inputMessage.trim() || isLoading) {
          return
        }
        sendMessage()
      }
    },
    [inputMessage, isLoading, sendMessage]
  )

  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const target = chats.find((c) => c.id === id)
    if (target) {
      setInputMessage(target.inputMessage)
    }
  }

  // --------------------------------
  // ドラッグ&ドロップでアシスタントの順序変更 (オートアシスト除外)
  // --------------------------------
  function handleListDragOver(e: React.DragEvent<HTMLLIElement>, idx: number) {
    e.preventDefault()
    setDragOverIndex(idx)
  }
  // @ts-ignore
  function handleDragStart(e: React.DragEvent<HTMLLIElement>, index: number) {
    setDragStartIndex(index)
    setDragOverIndex(null)
  }

  function handleListDrop(e: React.DragEvent<HTMLLIElement>, dropIndex: number) {
    e.preventDefault()
    if (dragStartIndex == null || dragStartIndex === dropIndex) return

    const newChats = [...chats]
    // オートアシスト以外で構成された配列
    const filtered = newChats.filter((c) => c.id !== AUTO_ASSIST_ID)

    const dragItem = filtered[dragStartIndex]
    filtered.splice(dragStartIndex, 1)
    filtered.splice(dropIndex, 0, dragItem)

    // 後でオートアシスト再追加
    const autoAssistObj = newChats.find((c) => c.id === AUTO_ASSIST_ID)
    const finalChats = autoAssistObj ? [...filtered, autoAssistObj] : filtered

    setChats(finalChats)
    window.electronAPI.saveAgents(finalChats).catch(console.error)

    setDragStartIndex(null)
    setDragOverIndex(null)
  }

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const readers: Promise<{ name: string; data: string; mimeType: string }>[] = []
    for (const file of Array.from(files)) {
      readers.push(
        new Promise((res) => {
          const r = new FileReader()
          r.onload = () => {
            const base64 = r.result!.toString().split(',')[1]
            const mime = file.type || 'application/octet-stream'
            res({ name: file.name, data: base64, mimeType: mime })
          }
          r.readAsDataURL(file)
        })
      )
    }
    Promise.all(readers).then((newFiles) => setTempFiles((prev) => [...prev, ...newFiles]))
    // 選択し直せるように value をリセット
    e.target.value = ''
  }, [])

  // --------------------------------
  // オートアシストのタスク分割 & 実行
  // --------------------------------
  async function findAssistantsForEachTask(tasks: string[]): Promise<SubtaskInfo[]> {
    const output: SubtaskInfo[] = []
    const summaries = chats
      .map((c) => `アシスタント名:"${c.customTitle}"\n要約:"${c.assistantSummary || ''}"`)
      .join('\n')

    for (let i = 0; i < tasks.length; i++) {
      const rawTask = tasks[i]
      const cleanTask = rawTask.replace(/^タスク\d+\s*:\s*/, '')

      // タスクのコンテキスト情報を追加
      // 複数タスクの場合、前後のタスク内容も含める
      let taskContext = ''
      if (tasks.length > 1) {
        taskContext = `このタスクは全${tasks.length}ステップ中の${i + 1}番目のタスクです。\n`

        // 前のタスクがある場合は、それも参考として提示
        if (i > 0) {
          taskContext += `前のタスク: ${tasks[i - 1].replace(/^タスク\d+\s*:\s*/, '')}\n`
        }

        // 次のタスクがある場合は、それも参考として提示
        if (i < tasks.length - 1) {
          taskContext += `次のタスク: ${tasks[i + 1].replace(/^タスク\d+\s*:\s*/, '')}\n`
        }
      }

      const systemPrompt = `
  #タスクの内容が実施可能と考えられるもの、#アシスタント名の下の#要約から探し出し、そのアシスタント名を以下のフォーマットに従って表示してください。
  #フォーマット例:
  {
    "assistantTitle": "ReactAssistant"
  }
  #もし該当なしなら:
  {
    "assistantTitle": null
  }
  
  [アシスタント一覧]
  ${summaries}
  
  [タスク内容]
  ${cleanTask}
  
  [タスクコンテキスト]
  ${taskContext}
  `

      // タスク内容のみを送信
      const msgs: Messages[] = [{ role: 'user', parts: [{ text: cleanTask }] }]

      let recommended: string | null = null
      try {
        const resp = await window.electronAPI.postChatAI(msgs, apiKey, systemPrompt)
        const cleanResp = resp.replaceAll('```json', '').replaceAll('```', '').trim()
        const parsed = JSON.parse(cleanResp)
        recommended = parsed.assistantTitle ?? null
      } catch (err) {
        recommended = null
      }

      output.push({ task: cleanTask, recommendedAssistant: recommended })
    }

    return output
  }

  async function handleAutoAssistSend(skipAddingUserMessage: boolean = false) {
    setIsLoading(true)

    try {
      // 現在のチャット状態のコピーを取得（常に最新の状態を使う）
      const currentChats = [...chats]

      // ユーザーメッセージを作成
      const userMsg: Message = { type: 'user', content: inputMessage }

      // postMessages用のメッセージ形式を作成
      const postUserMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      // 安全のために自動アシストエントリを明示的に検索
      const autoAssistIndex = currentChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

      if (autoAssistIndex === -1) {
        console.error('AutoAssist entry not found!')
        toast({
          title: 'エラー',
          description: 'オートアシストが見つかりません',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        setIsLoading(false)

        return
      }

      if (!skipAddingUserMessage) {
        // 既存のオートアシストを取得し、ユーザーメッセージを追加
        const autoAssist = { ...currentChats[autoAssistIndex] }

        // 既存のメッセージを保持しながら、新しいメッセージを追加
        autoAssist.messages = [...autoAssist.messages, userMsg]
        autoAssist.postMessages = [...autoAssist.postMessages, postUserMsg]
        autoAssist.inputMessage = ''

        // 新しいチャット配列を作成（オートアシストを更新）
        const updatedChats = [...currentChats]
        updatedChats[autoAssistIndex] = autoAssist

        // UIに表示を先行
        setAutoAssistMessages(autoAssist.messages)

        // 保存を実行
        await saveAutoAssistData(updatedChats)

        // ユーザーメッセージを保存した後のチャット状態を再取得（Safety measure）
        const verifiedChats = await window.electronAPI.loadAgents()
        const verifiedAutoAssist = verifiedChats.find((c) => c.id === AUTO_ASSIST_ID)

        if (verifiedAutoAssist) {
          const userMsgExists = verifiedAutoAssist.messages.some(
            (m) => m.type === 'user' && m.content === inputMessage
          )

          if (!userMsgExists) {
            // 再度保存を試みる（直接APIを呼び出す）
            await window.electronAPI.saveAgents(updatedChats)
          } else {
            console.log('User message verified in saved data.')
          }
        }
      }

      // 入力メッセージの保存（ファイル添付用）
      const originalMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      // ファイル添付をオリジナルメッセージに追加
      for (const f of tempFiles) {
        if (f.mimeType === 'text/csv') {
          try {
            const csvString = window.atob(f.data)
            const jsonStr = csvToJson(csvString)
            originalMsg.parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
          } catch {
            originalMsg.parts[0].text += '\n(CSV→JSON失敗)'
          }
        }
        originalMsg.parts.push({
          inlineData: { mimeType: f.mimeType, data: f.data }
        })
      }

      // 入力フィールドクリア
      setInputMessage('')
      setTempFiles([])

      // タスク分解用のメッセージ（ファイル添付なし）
      const parseMsg: Messages = {
        role: 'user',
        parts: [{ text: originalMsg.parts[0].text || '' }]
      }

      // ファイル情報を含む元のメッセージを後で使用するため保存
      setPendingEphemeralMsg(originalMsg)

      // タスク分割のプロンプト
      const parseSystemPrompt = `
      ユーザー依頼をタスクに分割し、必ず JSON配列だけを返してください。
      以下の点に注意してタスクを分割してください：
      
      1. ユーザーの依頼内容が複数の処理を必要とする場合、論理的なステップに分割する。分割が必要無い場合は無理に分割しないこと
      2. 各タスクは明確で具体的な目標を持つようにする
      3. タスク間に依存関係がある場合（例：タスク2がタスク1の結果を必要とする）は、その順序を維持する
      4. 分割は2〜4個程度のタスクに抑え、細かすぎる分割は避ける
      5. タスクには簡潔かつ明確な名前をつける
      
      フォーマット：
      ["タスク1:添付ファイルを分析する", "タスク2:分析結果に基づいて要約を作成する"]
      
      各タスクが順番に実行され、前のタスクの結果が後続のタスクで利用可能になることを考慮してください。
      `

      // タスク分解リクエスト（ファイル添付なし）
      const parseResp = await window.electronAPI.postChatAI([parseMsg], apiKey, parseSystemPrompt)

      const splittedRaw = parseResp.replaceAll('```json', '').replaceAll('```', '').trim()
      let splitted: string[] = []
      try {
        splitted = JSON.parse(splittedRaw)
      } catch {
        splitted = [originalMsg.parts[0].text || '']
      }

      // アシスタント推奨事も同様にファイル添付しない
      const subtaskInfos = await findAssistantsForEachTask(splitted)
      setPendingSubtasks(subtaskInfos)

      const lines = subtaskInfos.map(
        (si, idx) =>
          `タスク${idx + 1} : ${si.task}\n→ 推奨アシスタント : ${si.recommendedAssistant}`
      )
      const summaryMsg = `以下のタスクに分割し、推奨アシスタントを割り当てました:\n\n${lines.join('\n\n')}`

      // AIメッセージをmessages用に作成
      const aiMsg: Message = { type: 'ai', content: summaryMsg }

      // postMessages用のメッセージも作成
      const postAiMsg: Messages = {
        role: 'model',
        parts: [{ text: summaryMsg }]
      }

      // 再度最新のチャットを取得
      const latestChats = await window.electronAPI.loadAgents()
      const autoAssistEntryIndex = latestChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

      if (autoAssistEntryIndex === -1) {
        console.error('AutoAssist entry not found when adding AI task message!')

        return
      }

      // 既存の最新オートアシストを取得
      const autoAssist = { ...latestChats[autoAssistEntryIndex] }

      // メッセージを追加
      autoAssist.messages = [...autoAssist.messages, aiMsg]
      autoAssist.postMessages = [...autoAssist.postMessages, postAiMsg]

      // 更新されたチャット配列を作成
      const updatedWithAIMessage = [...latestChats]
      updatedWithAIMessage[autoAssistEntryIndex] = autoAssist

      // UIに表示を先行
      setAutoAssistMessages(autoAssist.messages)

      // チャットの状態を更新・保存
      await saveAutoAssistData(updatedWithAIMessage)

      if (agentMode) {
        // エージェントモードON時は originalMsg を直接渡す
        await executeSubtasksAndShowOnce(subtaskInfos, originalMsg)
      } else {
        setAutoAssistState('awaitConfirm')

        // 確認メッセージをmessages用に作成
        const confirmMsg = '実行しますか？ (Yesで実行 / Noでキャンセル)'
        const confirmAiMsg: Message = { type: 'ai', content: confirmMsg }

        // postMessages用のメッセージも作成
        const postConfirmMsg: Messages = {
          role: 'model',
          parts: [{ text: confirmMsg }]
        }

        // 最新の状態を取得（API経由で再取得）
        const latestChatsAfterAI = await window.electronAPI.loadAgents()
        const confirmAutoAssistIndex = latestChatsAfterAI.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (confirmAutoAssistIndex === -1) {
          console.error('AutoAssist entry not found when adding confirm message!')

          return
        }

        // 既存のオートアシストを取得
        const confirmAutoAssist = { ...latestChatsAfterAI[confirmAutoAssistIndex] }

        // メッセージを追加
        confirmAutoAssist.messages = [...confirmAutoAssist.messages, confirmAiMsg]
        confirmAutoAssist.postMessages = [...confirmAutoAssist.postMessages, postConfirmMsg]

        // 更新されたチャット配列を作成
        const updatedWithConfirm = [...latestChatsAfterAI]
        updatedWithConfirm[confirmAutoAssistIndex] = confirmAutoAssist

        // UIに表示を先行
        setAutoAssistMessages(confirmAutoAssist.messages)

        // チャットの状態を更新・保存
        await saveAutoAssistData(updatedWithConfirm)
      }
    } catch (err) {
      console.error('handleAutoAssistSend error:', err)

      // エラーメッセージをmessages用に作成
      const errorMsg = 'タスク分割処理中にエラーが発生しました。'
      const errorAiMsg: Message = { type: 'ai', content: errorMsg }

      // postMessages用のエラーメッセージも作成
      const postErrorMsg: Messages = {
        role: 'model',
        parts: [{ text: errorMsg }]
      }

      try {
        // 最新の状態を取得
        const errorChats = await window.electronAPI.loadAgents()
        const errorAutoAssistIndex = errorChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (errorAutoAssistIndex !== -1) {
          // オートアシストを取得
          const errorAutoAssist = { ...errorChats[errorAutoAssistIndex] }

          // メッセージを追加
          errorAutoAssist.messages = [...errorAutoAssist.messages, errorAiMsg]
          errorAutoAssist.postMessages = [...errorAutoAssist.postMessages, postErrorMsg]

          // 更新されたチャット配列を作成
          const updatedWithError = [...errorChats]
          updatedWithError[errorAutoAssistIndex] = errorAutoAssist

          // UIに表示を先行
          setAutoAssistMessages(errorAutoAssist.messages)

          // チャットの状態を更新・保存
          await saveAutoAssistData(updatedWithError)
        }
      } catch (saveErr) {
        console.error('Failed to save error message:', saveErr)
      }

      // UIにエラーを追加（最低限の対応）
      setAutoAssistMessages((prev) => [...prev, errorAiMsg])

      toast({
        title: 'エラー',
        description: 'タスク分割処理中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function executeSubtasksAndShowOnce(subtasks: SubtaskInfo[], originalMsg?: Messages) {
    setAutoAssistState('executing')
    try {
      // originalMsg が提供されていない場合は pendingEphemeralMsg を使用
      const ephemeralMsg = originalMsg || pendingEphemeralMsg

      const subtaskOutputs: string[] = []
      // タスク間で情報を継承するための配列
      const taskResults: string[] = []

      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        let out = ''

        // 現在のタスク情報を設定
        const taskContext = `現在のタスク (${i + 1}/${subtasks.length}): ${st.task}`

        // 前のタスクの結果があれば、それも含める
        const previousResults =
          taskResults.length > 0 ? `\n\n前のタスクの結果:\n${taskResults.join('\n\n')}` : ''

        if (!st.recommendedAssistant) {
          // fallback
          const fallbackSystemPrompt = `
    あなたはAutoAssistです。
    以下のタスクをあなたが実行してください:
    ${st.task}
    
    ${previousResults}
    `
          // 新しいタスクメッセージを作成
          const taskMsg: Messages = {
            role: 'user',
            parts: [{ text: `${taskContext}${previousResults}` }]
          }

          // 元のメッセージに添付ファイルがあれば、新しいタスクメッセージに追加
          if (ephemeralMsg && ephemeralMsg.parts && ephemeralMsg.parts.length > 1) {
            for (let j = 1; j < ephemeralMsg.parts.length; j++) {
              if (ephemeralMsg.parts[j].inlineData) {
                taskMsg.parts.push({
                  inlineData: ephemeralMsg.parts[j].inlineData
                })
              }
            }
          }

          try {
            // 新しいタスクメッセージのみを送信
            const resp = await window.electronAPI.postChatAI(
              [taskMsg],
              apiKey,
              fallbackSystemPrompt
            )
            out = resp
          } catch (err) {
            out = '(実行中にエラー)'
          }
        } else {
          // recommended
          const asstObj = chats.find(
            (c) =>
              c.customTitle.trim().toLowerCase() === st.recommendedAssistant!.trim().toLowerCase()
          )
          if (!asstObj) {
            out = '(指定アシスタントが見つかりません)'
          } else {
            // 新しいタスクメッセージを作成
            const taskMsg: Messages = {
              role: 'user',
              parts: [{ text: `${taskContext}${previousResults}` }]
            }

            // 元のメッセージに添付ファイルがあれば、新しいタスクメッセージに追加
            if (ephemeralMsg && ephemeralMsg.parts && ephemeralMsg.parts.length > 1) {
              for (let j = 1; j < ephemeralMsg.parts.length; j++) {
                if (ephemeralMsg.parts[j].inlineData) {
                  taskMsg.parts.push({
                    inlineData: ephemeralMsg.parts[j].inlineData
                  })
                }
              }
            }

            // 拡張されたシステムプロンプト - 前のタスクの結果を考慮するよう指示
            const enhancedSystemPrompt = `
    ${asstObj.systemPrompt}
    
    現在はオートアシスト機能のタスク${i + 1}/${subtasks.length}を実行中です。
    依頼内容: ${st.task}
    ${previousResults ? '前のタスクの結果を考慮して対応してください。' : ''}
    `

            try {
              // 新しいタスクメッセージのみを送信
              const resp = await window.electronAPI.postChatAI(
                [taskMsg],
                apiKey,
                enhancedSystemPrompt
              )
              out = resp
            } catch (err) {
              out = '(アシスタント実行エラー)'
            }
          }
        }

        // タスク結果を配列に追加して次のタスクで利用できるようにする
        taskResults.push(`タスク${i + 1}の結果:\n${out}`)

        subtaskOutputs.push(
          `タスク${i + 1} : ${st.task}\n(アシスタント: ${
            st.recommendedAssistant || 'AutoAssist/fallback'
          })\n結果:\n${out}\n`
        )
      }

      // 最終結果のメッセージを作成
      const finalMerged = `以下が最終的な実行結果です:\n${subtaskOutputs.join('\n')}`

      try {
        // 最新の状態をAPIから取得
        const latestChats = await window.electronAPI.loadAgents()
        const autoAssistIndex = latestChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (autoAssistIndex === -1) {
          console.error('AutoAssist entry not found when saving final results')
          throw new Error('AutoAssist entry not found when saving final results')
        }

        // 既存のオートアシストを取得
        const autoAssist = { ...latestChats[autoAssistIndex] }

        // ユーザーメッセージが含まれているか確認（念のため）
        const hasUserMessages = autoAssist.messages.some((msg) => msg.type === 'user')
        if (!hasUserMessages) {
          console.warn('No user messages found in autoAssist history when saving final results.')
          console.log('Current autoAssist messages:', JSON.stringify(autoAssist.messages))
        }

        // messages用のAIメッセージを作成
        const finalAiMsg: Message = { type: 'ai', content: finalMerged }

        // メッセージを追加
        autoAssist.messages = [...autoAssist.messages, finalAiMsg]

        // postMessages用のメッセージも作成
        const postFinalMsg: Messages = {
          role: 'model',
          parts: [{ text: finalMerged }]
        }

        // postMessagesにも追加
        autoAssist.postMessages = [...autoAssist.postMessages, postFinalMsg]

        // 更新されたチャット配列を作成
        const updatedChats = [...latestChats]
        updatedChats[autoAssistIndex] = autoAssist

        // UIに表示を先行
        setAutoAssistMessages(autoAssist.messages)

        // チャットの状態を更新・保存
        await saveAutoAssistData(updatedChats)
      } catch (saveError) {
        console.error('Error saving final results:', saveError)

        // エラーが発生しても、少なくともUIには表示する
        const finalAiMsg: Message = { type: 'ai', content: finalMerged }
        setAutoAssistMessages((prev) => [...prev, finalAiMsg])

        // トーストでユーザーに通知
        toast({
          title: '保存エラー',
          description:
            '結果の保存中にエラーが発生しました。画面には表示されますが、保存されない可能性があります。',
          status: 'error',
          duration: 5000,
          isClosable: true
        })
      }
    } catch (executionError) {
      console.error('Error executing subtasks:', executionError)

      // 実行エラーメッセージ
      const errorMsg = 'タスク実行中にエラーが発生しました。'
      const errorAiMsg: Message = { type: 'ai', content: errorMsg }

      // UIに表示
      setAutoAssistMessages((prev) => [...prev, errorAiMsg])

      // トーストでユーザーに通知
      toast({
        title: 'エラー',
        description: 'タスク実行中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setPendingSubtasks([])
      setPendingEphemeralMsg(null)
      setAutoAssistState('idle')
    }
  }
  // 選択されたチャットオブジェクトをメモ化
  const selectedChatObj = useMemo(() => {
    if (typeof selectedChatId === 'number') {
      return chats.find((c) => c.id === selectedChatId) || null
    }

    return null
  }, [chats, selectedChatId])

  // 現在表示するメッセージをメモ化
  const currentMessages = useMemo(() => {
    if (selectedChatId === 'autoAssist') {
      return autoAssistMessages
    }
    if (typeof selectedChatId === 'number') {
      return selectedChatObj?.messages || []
    }

    return []
  }, [selectedChatId, autoAssistMessages, selectedChatObj?.messages])

  // --------------------------------
  // sendMessage本体
  // --------------------------------

  async function sendMessage() {
    let agentFiles: { name: string; data: string; mimeType: string }[] = []
    if (
      useAgentFile && // チェックが ON
      typeof selectedChatId === 'number' && // オートアシスト以外
      selectedChatObj?.agentFilePaths?.length
    ) {
      agentFiles = await readAgentFiles(selectedChatObj.agentFilePaths)
    }

    // tempFiles は常に送る。最終的に buildUserParts に渡す配列
    const filesForParts = [...tempFiles, ...agentFiles]

    // 1) オートアシスト + 編集モード
    if (selectedChatId === 'autoAssist' && editIndex != null) {
      setIsLoading(true)
      try {
        // ユーザーメッセージを作成・表示
        const userContent = inputMessage
        const clonedAuto = [...autoAssistMessages]
        clonedAuto.splice(editIndex, clonedAuto.length - editIndex, {
          type: 'user',
          content: userContent
        })
        setAutoAssistMessages(clonedAuto)

        // postMessages用のメッセージ形式を作成
        const postUserMsg: Messages = {
          role: 'user',
          parts: [{ text: userContent }]
        }

        const updatedChats = chats.map((chat) => {
          if (chat.id === AUTO_ASSIST_ID) {
            const cloned = [...chat.messages]
            cloned.splice(editIndex, cloned.length - editIndex, {
              type: 'user',
              content: userContent
            })
            const clonedPost = [...chat.postMessages]
            clonedPost.splice(editIndex, clonedPost.length - editIndex, postUserMsg)

            return {
              ...chat,
              messages: cloned,
              postMessages: clonedPost,
              inputMessage: '' // 明示的にクリアする
            }
          }

          return chat
        })
        setChats(updatedChats)
        // 保存が確実に完了するのを待つ
        await window.electronAPI.saveAgents(updatedChats)

        // 編集モードに使用した入力内容をグローバルにコピー
        const tempInputContent = inputMessage

        // 入力フィールドとファイル添付をクリア
        setEditIndex(null)
        setTempFiles([])

        // 一時的に入力内容を設定して、handleAutoAssistSendを呼ぶ
        // ただし、ユーザーメッセージは既に追加済みなので、スキップフラグをtrueにする
        setInputMessage(tempInputContent)
        await handleAutoAssistSend(true) // ユーザーメッセージの追加をスキップ
        setInputMessage('') // 処理後に入力を空にする

        toast({
          title: 'オートアシストの編集結果を再実行しました',
          description: '指定index以降の履歴を削除し、新しい内容で実行しました。',
          status: 'info',
          duration: 2500,
          isClosable: true
        })
      } catch (err) {
        console.error('edit & re-run (autoAssist) error:', err)
        toast({
          title: 'エラー',
          description: 'オートアシスト編集実行でエラーが発生しました。',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
      } finally {
        setIsLoading(false)
      }

      return
    }

    // 2) オートアシスト + Yes/No待ち
    if (selectedChatId === 'autoAssist' && autoAssistState === 'awaitConfirm') {
      const ans = inputMessage.trim().toLowerCase()
      const userMsg: Message = { type: 'user', content: inputMessage }

      // UI表示用と保存用のチャットデータ操作を分離

      // 1. まずUIに直接表示（即時反映のため）
      setAutoAssistMessages((prev) => [...prev, userMsg])

      // 2. 保存用データの準備
      const postUserMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      try {
        // 3. 最新のチャット状態をAPIから直接取得
        const latestChats = await window.electronAPI.loadAgents()
        const autoAssistIndex = latestChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (autoAssistIndex === -1) {
          throw new Error('AutoAssist entry not found when processing Yes/No response')
        }

        // 4. オートアシストエントリを取得
        const autoAssist = { ...latestChats[autoAssistIndex] }

        // 5. ユーザーメッセージを追加
        autoAssist.messages = [...autoAssist.messages, userMsg]
        autoAssist.postMessages = [...autoAssist.postMessages, postUserMsg]
        autoAssist.inputMessage = ''

        // 6. 更新されたチャット配列を作成
        const updatedWithUserMsg = [...latestChats]
        updatedWithUserMsg[autoAssistIndex] = autoAssist

        // 7. 状態を更新して保存
        await saveAutoAssistData(updatedWithUserMsg)

        if (ans === 'yes') {
          setIsLoading(true)

          // タスク実行
          // @ts-ignore
          await executeSubtasksAndShowOnce(pendingSubtasks, pendingEphemeralMsg)

          setIsLoading(false)
          setAutoAssistState('idle')
          setInputMessage('')

          return
        } else if (ans === 'no') {
          // キャンセルメッセージを作成
          const cancelMsg = 'タスク実行をキャンセルしました.'
          const cancelAiMsg: Message = { type: 'ai', content: cancelMsg }

          // UI表示を先に更新
          setAutoAssistMessages((prev) => [...prev, cancelAiMsg])

          // postMessages用のメッセージ形式も作成
          const postCancelMsg: Messages = {
            role: 'model',
            parts: [{ text: cancelMsg }]
          }

          // 最新の状態を取得
          const cancelChats = await window.electronAPI.loadAgents()
          const cancelAutoAssistIndex = cancelChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

          if (cancelAutoAssistIndex === -1) {
            throw new Error('AutoAssist entry not found when processing cancel')
          }

          // オートアシストを取得
          const cancelAutoAssist = { ...cancelChats[cancelAutoAssistIndex] }

          // メッセージを追加
          cancelAutoAssist.messages = [...cancelAutoAssist.messages, cancelAiMsg]
          cancelAutoAssist.postMessages = [...cancelAutoAssist.postMessages, postCancelMsg]

          // 更新されたチャット配列を作成
          const updatedWithCancel = [...cancelChats]
          updatedWithCancel[cancelAutoAssistIndex] = cancelAutoAssist

          // 状態を更新して保存
          await saveAutoAssistData(updatedWithCancel)

          setPendingSubtasks([])
          setPendingEphemeralMsg(null)
          setAutoAssistState('idle')
          setInputMessage('')

          return
        } else {
          // 不明な応答の場合のメッセージを作成
          const unknownMsg = 'Yes で実行 / No でキャンセル です.'
          const unknownAiMsg: Message = { type: 'ai', content: unknownMsg }

          // UI表示を先に更新
          setAutoAssistMessages((prev) => [...prev, unknownAiMsg])

          // postMessages用のメッセージ形式も作成
          const postUnknownMsg: Messages = {
            role: 'model',
            parts: [{ text: unknownMsg }]
          }

          // 最新の状態を取得
          const unknownChats = await window.electronAPI.loadAgents()
          const unknownAutoAssistIndex = unknownChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

          if (unknownAutoAssistIndex === -1) {
            throw new Error('AutoAssist entry not found when processing unknown response')
          }

          // オートアシストを取得
          const unknownAutoAssist = { ...unknownChats[unknownAutoAssistIndex] }

          // メッセージを追加
          unknownAutoAssist.messages = [...unknownAutoAssist.messages, unknownAiMsg]
          unknownAutoAssist.postMessages = [...unknownAutoAssist.postMessages, postUnknownMsg]

          // 更新されたチャット配列を作成
          const updatedWithUnknown = [...unknownChats]
          updatedWithUnknown[unknownAutoAssistIndex] = unknownAutoAssist

          // 状態を更新して保存
          await saveAutoAssistData(updatedWithUnknown)

          setInputMessage('')

          return
        }
      } catch (err) {
        console.error('Yes/No応答処理中にエラーが発生しました:', err)
        toast({
          title: 'エラー',
          description: 'メッセージの処理中にエラーが発生しました。',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        setInputMessage('')

        return
      }
    }

    // 3) オートアシスト(通常)
    if (selectedChatId === 'autoAssist') {
      setIsLoading(true)

      // 修正: inputMessageを先にクリアする前に、handleAutoAssistSendを呼び出す
      await handleAutoAssistSend(false)

      setIsLoading(false)

      return
    }

    // 4) 通常アシスタント
    const selectedChat = chats.find((c) => c.id === selectedChatId)
    if (!selectedChat) return

    // (通常)編集モード
    if (editIndex != null) {
      setIsLoading(true)
      try {
        // 編集で削除される可能性のあるメッセージを特定
        const messagesToBeRemoved =
          chats.find((c) => c.id === selectedChatId)?.messages.slice(editIndex + 1) || []

        // 削除予定メッセージから画像ファイルを削除
        await deleteImageFiles(messagesToBeRemoved)

        const updatedChats = chats.map((chat) => {
          if (chat.id === selectedChatId) {
            const cloned = [...chat.messages]
            cloned.splice(editIndex, cloned.length - editIndex, {
              type: 'user',
              content: inputMessage
            })
            const clonedPost = [...chat.postMessages]
            clonedPost.splice(editIndex, clonedPost.length - editIndex, {
              role: 'user',
              parts: buildUserParts(inputMessage, filesForParts)
            })

            return {
              ...chat,
              messages: cloned,
              postMessages: clonedPost,
              inputMessage: ''
            }
          }

          return chat
        })
        setChats(updatedChats)
        await window.electronAPI.saveAgents(updatedChats)

        const newSelectedChat = updatedChats.find((cc) => cc.id === selectedChatId)
        if (!newSelectedChat) {
          setEditIndex(null)
          setInputMessage('')
          setTempFiles([])
          setIsLoading(false)

          return
        }

        // 環境変数を参照して外部API機能が有効かチェック
        const isExternalApiEnabled = import.meta.env.VITE_ENABLE_EXTERNAL_API !== 'false'

        // API処理を追加（選択されたチャットにAPI設定があり、かつ有効な場合）
        let processedUserContent = inputMessage
        let apiProcessingResult = null
        let imageResponse = null
        let isImageOnly = false

        if (
          isExternalApiEnabled && // 環境変数チェック追加
          newSelectedChat.apiConfigs &&
          newSelectedChat.apiConfigs.length > 0 &&
          newSelectedChat.enableAPICall !== false
        ) {
          try {
            const result = await processAPITriggers(
              inputMessage,
              newSelectedChat.apiConfigs,
              apiKey,
              selectedChat
            )

            processedUserContent = result.processedMessage
            // @ts-ignore
            imageResponse = result.imageResponse
            isImageOnly = result.isImageOnly || false

            // オリジナルのメッセージと異なる場合、API処理が行われたと判断
            if (processedUserContent !== inputMessage) {
              // @ts-ignore
              apiProcessingResult = {
                originalMessage: inputMessage,
                processedMessage: processedUserContent
              }
            }
          } catch (apiErr) {
            console.error('API処理中にエラー:', apiErr)
            // エラー時は元のメッセージを使用
            processedUserContent = inputMessage
            // @ts-ignore
            apiProcessingResult = {
              originalMessage: inputMessage,
              // @ts-ignore
              error: apiErr.message || '不明なエラー'
            }
          }
        }

        // 画像レスポンスがある場合、画像として処理
        if (imageResponse) {
          try {
            // 画像をファイルに保存
            // @ts-ignore
            const imagePath = await window.electronAPI.saveImageToFile(imageResponse.base64Data)

            // AIメッセージを作成（画像付き）
            const aiMsg: Message = {
              type: 'ai',
              content: '画像を生成しました。', // 空文字から変更
              imagePath: imagePath
            }

            // チャット状態を更新
            const imageUpdatedChats = updatedChats.map((chat) => {
              if (chat.id === selectedChatId) {
                return {
                  ...chat,
                  messages: [...chat.messages, aiMsg],
                  postMessages: [
                    ...chat.postMessages,
                    { role: 'model', parts: [{ text: aiMsg.content }] }
                  ]
                }
              }

              return chat
            })

            // 状態更新と保存
            setChats(imageUpdatedChats)
            await window.electronAPI.saveAgents(imageUpdatedChats)

            // 画像のみのリクエストの場合は処理を終了
            if (isImageOnly) {
              setIsLoading(false)
              setEditIndex(null)
              setInputMessage('')
              setTempFiles([])

              return // 画像のみの処理の場合はここで終了
            }

            // 画像+テキストの場合は、以降の通常テキストチャットも実行する
            // この場合、最新のチャット状態を使用
            const latestChats = await window.electronAPI.loadAgents()
            const latestSelectedChat = latestChats.find((c) => c.id === selectedChatId)

            if (!latestSelectedChat) {
              throw new Error('選択されたチャットが見つかりません')
            }
          } catch (imgErr) {
            console.error('画像保存中にエラー:', imgErr)
            // エラー時は通常テキスト処理に戻る
          }
        }

        // 最新のチャット状態を取得して処理する
        const currentChats = await window.electronAPI.loadAgents()
        const currentSelectedChat = currentChats.find((c) => c.id === selectedChatId)

        if (!currentSelectedChat) {
          throw new Error('選択されたチャットが見つかりません')
        }

        // 最新のポストメッセージに基づいて処理を続行
        const currentMessages = [...currentSelectedChat.postMessages]

        // 編集モードの修正: API処理結果があれば反映
        if (processedUserContent !== inputMessage && currentMessages.length > 0) {
          // 最後のメッセージがユーザーのものである場合、内容を更新
          const lastIndex = currentMessages.length - 1
          if (currentMessages[lastIndex].role === 'user') {
            currentMessages[lastIndex] = {
              role: 'user',
              parts: [{ text: processedUserContent }]
            }
          }
        }

        // システムプロンプトも強化
        let enhancedSystemPrompt = newSelectedChat.systemPrompt
        if (
          isExternalApiEnabled && // 環境変数チェック追加
          newSelectedChat.apiConfigs &&
          newSelectedChat.apiConfigs.length > 0 &&
          newSelectedChat.enableAPICall !== false &&
          apiProcessingResult !== null // APIが実際に処理を行った場合のみ
        ) {
          enhancedSystemPrompt = enhanceSystemPromptWithAPIContext(
            newSelectedChat.systemPrompt,
            newSelectedChat.apiConfigs,
            apiProcessingResult
          )
        }

        const resp = await window.electronAPI.postChatAI(
          currentMessages,
          apiKey,
          enhancedSystemPrompt
        )

        const aiMsg: Message = { type: 'ai', content: resp }

        // 最新のチャット状態を更新
        const finalUpdated = currentChats.map((chat) => {
          if (chat.id === selectedChatId) {
            return {
              ...chat,
              messages: [...chat.messages, aiMsg],
              postMessages: [...chat.postMessages, { role: 'model', parts: [{ text: resp }] }]
            }
          }

          return chat
        })
        setChats(finalUpdated)
        await window.electronAPI.saveAgents(finalUpdated)

        toast({
          title: '編集内容を反映しました',
          description: '以降の履歴を削除し、新しい内容で実行しました。',
          status: 'info',
          duration: 2500,
          isClosable: true
        })
      } catch (err) {
        console.error('edit & re-run error:', err)
        toast({
          title: 'エラー',
          description: '編集内容の実行中にエラーが発生しました。',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
      } finally {
        setEditIndex(null)
        setInputMessage('')
        setTempFiles([])
        setIsLoading(false)
      }

      return
    }

    // (通常) 新規メッセージ
    setIsLoading(true)
    try {
      // 環境変数を参照して外部API機能が有効かチェック
      const isExternalApiEnabled = import.meta.env.VITE_ENABLE_EXTERNAL_API !== 'false'

      // ユーザー表示用のメッセージ
      const userMsg: Message = { type: 'user', content: inputMessage }

      // 修正1: UI表示と状態更新を一元化（一度だけ更新）
      const updatedChats = chats.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            messages: [...chat.messages, userMsg],
            postMessages: [
              ...chat.postMessages,
              { role: 'user', parts: buildUserParts(inputMessage, filesForParts) }
            ],
            inputMessage: ''
          }
        }

        return chat
      })

      // UIを更新し、状態も保存
      setChats(updatedChats)
      setInputMessage('')
      await window.electronAPI.saveAgents(updatedChats)

      // API処理を追加（選択されたチャットにAPI設定があり、かつ有効な場合）
      let processedUserContent = inputMessage
      let apiProcessingResult = null
      let imageResponse = null
      let isImageOnly = false

      if (
        isExternalApiEnabled && // 環境変数チェック追加
        selectedChat.apiConfigs &&
        selectedChat.apiConfigs.length > 0 &&
        selectedChat.enableAPICall !== false
      ) {
        try {
          const result = await processAPITriggers(
            inputMessage,
            selectedChat.apiConfigs,
            apiKey,
            selectedChat
          )

          processedUserContent = result.processedMessage
          // @ts-ignore
          imageResponse = result.imageResponse
          isImageOnly = result.isImageOnly || false

          // オリジナルのメッセージと異なる場合、API処理が行われたと判断
          if (processedUserContent !== inputMessage) {
            // @ts-ignore
            apiProcessingResult = {
              originalMessage: inputMessage,
              processedMessage: processedUserContent
            }
          }
        } catch (apiErr) {
          console.error('API処理中にエラー:', apiErr)
          // エラー時は元のメッセージを使用
          processedUserContent = inputMessage
          // @ts-ignore
          apiProcessingResult = {
            originalMessage: inputMessage,
            // @ts-ignore
            error: apiErr.message || '不明なエラー'
          }
        }
      }

      setTempFiles([])

      // 画像レスポンスがある場合、画像として処理
      if (imageResponse) {
        try {
          // 画像をファイルに保存
          // @ts-ignore
          const imagePath = await window.electronAPI.saveImageToFile(imageResponse.base64Data)

          // AIメッセージを作成（画像付き）
          const aiMsg: Message = {
            type: 'ai',
            content: '画像を生成しました。', // 空文字から変更
            imagePath: imagePath
          }

          // 修正2: チャット状態を更新（updatedChatsを使用）
          const imageUpdatedChats = updatedChats.map((chat) => {
            if (chat.id === selectedChatId) {
              return {
                ...chat,
                messages: [...chat.messages, aiMsg],
                postMessages: [
                  ...chat.postMessages,
                  { role: 'model', parts: [{ text: aiMsg.content }] }
                ]
              }
            }

            return chat
          })

          // 状態更新と保存
          setChats(imageUpdatedChats)
          await window.electronAPI.saveAgents(imageUpdatedChats)

          // 画像のみのリクエストの場合は処理を終了
          if (isImageOnly) {
            setIsLoading(false)

            return // 画像のみの処理の場合はここで終了
          }

          // 画像+テキストの場合は、以降の通常テキストチャットも実行する
          // この場合、最新のチャット状態を使用
          const latestChats = await window.electronAPI.loadAgents()
          const latestSelectedChat = latestChats.find((c) => c.id === selectedChatId)

          if (!latestSelectedChat) {
            throw new Error('選択されたチャットが見つかりません')
          }
        } catch (imgErr) {
          console.error('画像保存中にエラー:', imgErr)
          // エラー時は通常テキスト処理に戻る
        }
      }

      // 修正3: 重要な変更 - ユーザーメッセージの再追加を防止
      // 最新のチャット状態を取得
      const currentChats = await window.electronAPI.loadAgents()
      const currentSelectedChat = currentChats.find((c) => c.id === selectedChatId)

      if (!currentSelectedChat) {
        throw new Error('選択されたチャットが見つかりません')
      }

      // 修正4: 既存の会話履歴をそのまま使用し、新たなユーザーメッセージを追加しない
      const currentMessages = [...currentSelectedChat.postMessages]

      // API処理結果が異なる場合のみ、最後のユーザーメッセージを更新
      if (processedUserContent !== inputMessage && currentMessages.length > 0) {
        // 最後のメッセージがユーザーのものである場合、内容を更新
        const lastIndex = currentMessages.length - 1
        if (currentMessages[lastIndex].role === 'user') {
          currentMessages[lastIndex] = {
            role: 'user',
            parts: [{ text: processedUserContent }]
          }
        }
      }

      // 修正5: システムプロンプトの条件付け - APIが実際に処理を行った場合のみ
      let enhancedSystemPrompt = currentSelectedChat.systemPrompt
      if (
        isExternalApiEnabled &&
        selectedChat.apiConfigs &&
        selectedChat.apiConfigs.length > 0 &&
        selectedChat.enableAPICall !== false &&
        apiProcessingResult !== null // APIが実際に処理を行った場合のみ
      ) {
        enhancedSystemPrompt = enhanceSystemPromptWithAPIContext(
          selectedChat.systemPrompt,
          selectedChat.apiConfigs,
          apiProcessingResult
        )
      }

      // 修正6: 改良された会話履歴を使用
      const resp = await window.electronAPI.postChatAI(
        currentMessages,
        apiKey,
        enhancedSystemPrompt
      )

      const aiMsg: Message = { type: 'ai', content: resp }

      // 最新のチャット状態を取得して更新
      const finalUpdated = currentChats.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            messages: [...chat.messages, aiMsg],
            postMessages: [...chat.postMessages, { role: 'model', parts: [{ text: resp }] }]
          }
        }

        return chat
      })

      setChats(finalUpdated)
      await window.electronAPI.saveAgents(finalUpdated)
    } catch (err) {
      console.error('sendMessageエラー:', err)
      toast({
        title: 'エラー',
        description: 'メッセージの送信に失敗しました。',
        status: 'error',
        duration: 4000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
      chatInputRef.current?.focus()
    }
  }

  // --------------------------------
  // 新アシスタント作成モーダル
  // --------------------------------
  const openCustomChatModal = () => {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFiles([])
    setModalEnableAPICall(false)
    setModalAPIConfigs([])
    setIsModalOpen(true)
  }
  const closeCustomChatModal = () => {
    setIsModalOpen(false)
  }

  const handleSelectAgentFiles = async () => {
    const copiedPath = await window.electronAPI.copyFileToUserData(undefined)
    if (!copiedPath) {
      toast({
        title: 'ファイルが選択されませんでした',
        status: 'info',
        duration: 2000,
        isClosable: true
      })

      return
    }
    const splitted = copiedPath.split(/[/\\]/)
    const filename = splitted[splitted.length - 1] || ''
    setModalAgentFiles((prev) => [...prev, { name: filename, path: copiedPath }])
  }

  const handleRemoveAgentFile = async (targetPath: string) => {
    try {
      await window.electronAPI.deleteFileInUserData(targetPath)
    } catch (err) {
      console.error('Failed to delete old file in userData:', err)
    }
    setModalAgentFiles((prev) => prev.filter((f) => f.path !== targetPath))
  }

  const handleCreateCustomChat = async () => {
    if (!modalChatTitle.trim()) {
      toast({
        title: 'アシスタント名が入力されていません',
        status: 'warning',
        duration: 3000,
        isClosable: true
      })

      return
    }

    let summaryText = ''
    if (apiKey) {
      try {
        const summaryRequest: Messages = {
          role: 'user',
          parts: [{ text: modalSystemPrompt }]
        }
        const summarizerPrompt = `
        #命令書
        あなたは有能な要約者です。
        テキストは、生成AIのシステムプロンプトになります。
        この内容を要約してどのような事が出来るのかをまとめます。
        #制約条件
        - テキストの内容について、どのような事が出来るのか、得意なのかを考えて、重要なキーワードを取りこぼさないように詳細に要約してください
        - 要約したもののみ出力してください。返事などは不要です。
        - 要約文は20~30文字程度にまとめてください。
        `
        const sumResp = await window.electronAPI.postChatAI(
          [summaryRequest],
          apiKey,
          summarizerPrompt
        )
        summaryText = sumResp.trim()
      } catch (err) {
        console.error('要約失敗:', err)
      }
    }

    const newChat: ChatInfo = {
      id: Date.now(),
      customTitle: modalChatTitle,
      systemPrompt: modalSystemPrompt,
      messages: [],
      postMessages: [],
      createdAt: new Date().toLocaleString(),
      inputMessage: '',
      agentFilePaths: modalAgentFiles.map((f) => f.path),
      assistantSummary: summaryText,
      apiConfigs: modalAPIConfigs,
      enableAPICall: modalEnableAPICall
    }

    const updated = [...chats, newChat]
    setChats(updated)
    setSelectedChatId(newChat.id)
    setInputMessage('')
    setIsModalOpen(false)

    try {
      await window.electronAPI.saveAgents(updated)
    } catch (err) {
      console.error('saveAgentsエラー:', err)
    }
  }

  // --------------------------------
  // アシスタント削除
  // --------------------------------
  function closeDeleteModal() {
    setIsDeleteModalOpen(false)
    setDeleteTargetId(null)
  }

  async function confirmDeleteChat() {
    if (deleteTargetId == null) {
      closeDeleteModal()

      return
    }
    await handleDeleteChat(deleteTargetId)
    closeDeleteModal()
  }

  async function handleDeleteChat(chatId: number) {
    const target = chats.find((c) => c.id === chatId)
    if (!target) return

    if (target.agentFilePaths) {
      for (const p of target.agentFilePaths) {
        try {
          await window.electronAPI.deleteFileInUserData(p)
        } catch (err) {
          console.error('Failed to delete userData file:', err)
        }
      }
    }

    // 追加: 会話中の画像ファイルも削除
    await deleteImageFiles(target.messages || [])

    const updated = chats.filter((c) => c.id !== chatId)
    setChats(updated)
    window.electronAPI.saveAgents(updated).catch(console.error)

    if (chatId === selectedChatId) {
      setSelectedChatId(null)
      setInputMessage('')
    }
    toast({
      title: 'アシスタントを削除しました',
      status: 'info',
      duration: 2000,
      isClosable: true
    })
  }

  // --------------------------------
  // システムプロンプト編集
  // --------------------------------
  function openSystemPromptModal() {
    if (typeof selectedChatId !== 'number') return
    const sc = chats.find((c) => c.id === selectedChatId)
    if (!sc) return

    setEditingSystemPrompt(sc.systemPrompt)
    setEditingCustomTitle(sc.customTitle)

    const arr = sc.agentFilePaths || []
    const mapped = arr.map((p) => {
      const splitted = p.split(/[/\\]/)
      const filename = splitted[splitted.length - 1] || ''

      return { name: filename, path: p }
    })
    setEditingAgentFiles(mapped)

    // API設定の初期化を追加
    setEditingAPIConfigs(sc.apiConfigs || [])
    setEnableAPICall(sc.enableAPICall !== false)

    setIsPromptModalOpen(true)
  }

  function closeSystemPromptModal() {
    setIsPromptModalOpen(false)
  }

  const handleAddAgentFileInPrompt = async () => {
    const copiedPath = await window.electronAPI.copyFileToUserData(undefined)
    if (!copiedPath) {
      toast({
        title: 'ファイルが選択されませんでした',
        status: 'info',
        duration: 2000,
        isClosable: true
      })

      return
    }
    const splitted = copiedPath.split(/[/\\]/)
    const filename = splitted[splitted.length - 1] || ''
    setEditingAgentFiles((prev) => [...prev, { name: filename, path: copiedPath }])
  }

  const handleRemoveAgentFileInPrompt = async (targetPath: string) => {
    try {
      await window.electronAPI.deleteFileInUserData(targetPath)
    } catch (err) {
      console.error('Failed to delete old file in userData:', err)
    }
    setEditingAgentFiles((prev) => prev.filter((f) => f.path !== targetPath))
  }

  function handleSaveSystemPrompt() {
    if (typeof selectedChatId !== 'number') return
    const sc = chats.find((c) => c.id === selectedChatId)
    if (!sc) return

    const updated = chats.map((chat) => {
      if (chat.id === selectedChatId) {
        return {
          ...chat,
          customTitle: editingCustomTitle,
          systemPrompt: editingSystemPrompt,
          agentFilePaths: editingAgentFiles.map((f) => f.path),
          apiConfigs: editingAPIConfigs,
          enableAPICall: enableAPICall
        }
      }

      return chat
    })
    setChats(updated)
    window.electronAPI.saveAgents(updated).catch(console.error)
    toast({
      title: 'アシスタント情報を更新しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
    setIsPromptModalOpen(false)
  }

  // APISettingsModalのdirectSaveフラグを追加
  ;<APISettingsModal
    isOpen={isAPISettingsOpen}
    onClose={() => setIsAPISettingsOpen(false)}
    apiConfigs={editingAPIConfigs}
    onSave={(configs) => {
      setEditingAPIConfigs(configs)
      // 直接保存モードの場合は即時にアシスタント設定を保存
      if (configs !== editingAPIConfigs) {
        // 必要に応じてここでデータベースに保存する処理を追加することも可能
        window.electronAPI
          .saveAgents(
            chats.map((chat) => {
              if (chat.id === selectedChatId) {
                return {
                  ...chat,
                  apiConfigs: configs,
                  enableAPICall: enableAPICall
                }
              }

              return chat
            })
          )
          .catch(console.error)
      }
    }}
    directSave={true} // 直接保存モードを有効化
  />

  function handleCopySystemPrompt() {
    navigator.clipboard.writeText(editingSystemPrompt).then(() => {
      toast({
        title: '指示内容をコピーしました',
        status: 'info',
        duration: 1000,
        isClosable: true
      })
    })
  }

  // --------------------------------
  // 会話リセット
  // --------------------------------
  function closeResetConfirm() {
    setIsResetConfirmOpen(false)
  }

  async function handleResetConversation() {
    closeResetConfirm()
    if (selectedChatId === 'autoAssist') {
      // 画像ファイルを削除
      await deleteImageFiles(autoAssistMessages)

      setAutoAssistMessages([])
      const updated = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return { ...c, messages: [], postMessages: [], inputMessage: '' }
        }

        return c
      })
      setChats(updated)
      await window.electronAPI.saveAgents(updated)
      toast({
        title: 'オートアシストの会話履歴をリセットしました',
        status: 'info',
        duration: 2000,
        isClosable: true
      })
    } else if (typeof selectedChatId === 'number') {
      const selectedChatMessages = chats.find((c) => c.id === selectedChatId)?.messages || []
      // 画像ファイルを削除
      await deleteImageFiles(selectedChatMessages)

      const updated = chats.map((c) => {
        if (c.id === selectedChatId) {
          return { ...c, messages: [], postMessages: [], inputMessage: '' }
        }

        return c
      })
      setChats(updated)
      await window.electronAPI.saveAgents(updated)
      toast({
        title: 'アシスタントの会話履歴をリセットしました',
        status: 'info',
        duration: 2000,
        isClosable: true
      })
    }
  }

  const handleConfirmResetAutoAssist = () => {
    setIsResetAutoAssistConfirm(true)
  }

  async function handleResetAutoAssistFromModal() {
    setIsResetAutoAssistConfirm(false)

    // 画像ファイルを削除
    await deleteImageFiles(autoAssistMessages)

    setAutoAssistMessages([])
    const updated = chats.map((c) => {
      if (c.id === AUTO_ASSIST_ID) {
        return { ...c, messages: [], postMessages: [], inputMessage: '' }
      }

      return c
    })
    setChats(updated)
    await window.electronAPI.saveAgents(updated)
    toast({
      title: 'オートアシストの会話履歴をリセットしました',
      status: 'info',
      duration: 2000,
      isClosable: true
    })
  }

  const handleCopyMessage = useCallback(
    (content: string) => {
      navigator.clipboard.writeText(content).then(() => {
        toast({
          title: 'メッセージをコピーしました',
          status: 'info',
          duration: 1000,
          isClosable: true
        })
      })
    },
    [toast]
  )

  // --------------------------------
  // ユーザーメッセージ編集
  // --------------------------------
  const handleEditMessage = useCallback((msgIndex: number, oldContent: string) => {
    setEditIndex(msgIndex)
    setInputMessage(oldContent)
  }, [])

  // --------------------------------
  // エクスポート
  // --------------------------------
  async function handleExportConfig() {
    setIsExportModalOpen(true)
  }

  // --------------------------------
  // インポート
  // --------------------------------
  async function handleImportConfig() {
    try {
      if (!window.electronAPI.showOpenDialogAndRead) {
        toast({
          title: 'エラー',
          description: 'インポート機能が見つかりません',
          status: 'error',
          duration: 3000,
          isClosable: true
        })

        return
      }
      const fileContent = await window.electronAPI.showOpenDialogAndRead()
      if (!fileContent) {
        toast({
          title: 'キャンセル',
          description: 'ファイルが選択されませんでした',
          status: 'info',
          duration: 2000,
          isClosable: true
        })

        return
      }

      setImportedConfigRaw(fileContent)
      setIsImportModeModalOpen(true)
    } catch (err) {
      console.error('Import error:', err)
      toast({
        title: 'エラー',
        description: 'インポート中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }

  async function doReplaceImport(raw: string) {
    try {
      if (window.electronAPI.replaceLocalHistoryConfig) {
        await window.electronAPI.replaceLocalHistoryConfig(raw)
      } else {
        toast({
          title: 'エラー',
          description: 'replaceLocalHistoryConfig未実装',
          status: 'error',
          duration: 3000,
          isClosable: true
        })

        return
      }

      const newData = JSON.parse(raw) as { agents?: ChatInfo[]; titleSettings?: TitleSettings }
      if (newData.agents) {
        setChats(newData.agents)
      }
      if (newData.titleSettings) {
        setTitleSettings(newData.titleSettings)
      }
      toast({
        title: 'アシスタントを置き換えました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (err) {
      console.error('doReplaceImport error:', err)
      toast({
        title: 'エラー',
        description: '置き換えインポート中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }

  async function doAppendImport(raw: string) {
    try {
      if (!window.electronAPI.appendLocalHistoryConfig) {
        toast({
          title: 'エラー',
          description: 'appendLocalHistoryConfig未実装',
          status: 'error',
          duration: 3000,
          isClosable: true
        })

        return
      }
      await window.electronAPI.appendLocalHistoryConfig(raw)

      const updatedChats = await window.electronAPI.loadAgents()
      setChats(updatedChats)

      if (window.electronAPI.loadTitleSettings) {
        const ts = await window.electronAPI.loadTitleSettings()
        if (ts) {
          setTitleSettings(ts)
        }
      }

      toast({
        title: 'アシスタントを追加しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (err) {
      console.error('doAppendImport error:', err)
      toast({
        title: 'エラー',
        description: '追加インポート中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }

  // APIキー読み込み関数
  const loadSavedApiKey = useCallback(async () => {
    if (!window.electronAPI?.loadApiKey) return

    try {
      setIsLoadingApiKey(true)
      const savedKey = await window.electronAPI.loadApiKey()
      if (savedKey) {
        setApiKey(savedKey)
      }
    } catch (err) {
      console.error('Failed to load API key:', err)
    } finally {
      setIsLoadingApiKey(false)
    }
  }, [])

  // APIキー保存関数 - 最小限のコード
  const saveApiKey = useCallback(async (key: string) => {
    if (!window.electronAPI?.saveApiKey) return

    try {
      await window.electronAPI.saveApiKey(key)
    } catch (err) {
      console.error('Failed to save API key:', err)
    }
  }, [])

  // APIキー変更ハンドラ
  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value)
  }, [])

  // フォーカスアウト時の処理 - シンプルに保存
  const handleApiKeyBlur = useCallback(() => {
    if (apiKey && apiKey.trim() !== '') {
      saveApiKey(apiKey)
    }
  }, [apiKey, saveApiKey])

  // 初回ロード時にAPIキーを読み込む
  useEffect(() => {
    loadSavedApiKey()
  }, [loadSavedApiKey])

  // APIキー設定モーダルを開く関数
  const openApiKeySettings = useCallback(() => {
    setIsApiKeySettingsOpen(true)
  }, [])

  // APIキー設定モーダルを閉じる関数
  const closeApiKeySettings = useCallback(() => {
    setIsApiKeySettingsOpen(false)
  }, [])

  const toggleApiKeyVisibility = useCallback(() => {
    setShowApiKey((prev) => !prev)
  }, [])

  // --------------------------------
  // JSX
  // --------------------------------

  return (
    <Flex direction="column" h="100vh" bg="gray.100">
      {/* ヘッダー */}
      <Flex
        as="header"
        backgroundImage={headerBgDataUri ? headerBgDataUri : undefined}
        backgroundSize="cover"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
        borderBottom="1px"
        borderColor="gray.200"
        bg={headerBgDataUri ? undefined : 'white'}
        p={4}
        height={headerBgDataUri ? '130px' : undefined}
        justify="space-between"
        align="center"
      >
        <HStack
          spacing={2}
          onMouseEnter={() => setTitleHovered(true)}
          onMouseLeave={() => setTitleHovered(false)}
        >
          <Heading
            as="h1"
            size="lg"
            display="flex"
            alignItems="center"
            fontFamily={titleSettings.fontFamily}
          >
            {titleSettings.segments.map((seg, idx) => (
              <Text as="span" key={idx} color={seg.color} whiteSpace="pre">
                {seg.text}
              </Text>
            ))}
          </Heading>
          {titleHovered && (
            <IconButton
              aria-label="タイトル編集"
              icon={<FiEdit />}
              size="sm"
              variant="ghost"
              colorScheme="blue"
              onClick={() => setIsTitleEditOpen(true)}
            />
          )}
        </HStack>

        <HStack spacing={5}>
          <Box>
            <Text fontSize="sm" color={headerBgDataUri ? 'white' : 'gray.600'}>
              Ver. {appVersion}
            </Text>
          </Box>

          <HStack spacing={4}>
            <Button
              onClick={openCustomChatModal}
              colorScheme="teal"
              isDisabled={isExpired}
              minW="250px"
            >
              新しいアシスタントの作成
            </Button>

            <Menu>
              <MenuButton
                as={IconButton}
                aria-label="Options"
                icon={<HamburgerIcon />}
                isDisabled={isExpired}
              />
              <MenuList>
                <MenuItem onClick={handleExportConfig}>データのエクスポート</MenuItem>
                <MenuItem onClick={handleImportConfig}>データのインポート</MenuItem>
                <MenuItem onClick={openApiKeySettings}>APIキー設定</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </HStack>

        {/* APIキー設定モーダル */}
        <Modal isOpen={isApiKeySettingsOpen} onClose={closeApiKeySettings} isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>APIキー設定</ModalHeader>
            <ModalBody>
              <FormControl>
                <FormLabel htmlFor="api-key-input">APIキー</FormLabel>
                <InputGroup size="md">
                  <Input
                    id="api-key-input"
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    onBlur={handleApiKeyBlur}
                    placeholder="APIキーを入力"
                    type={showApiKey ? 'text' : 'password'}
                    pr="4.5rem"
                    isDisabled={isLoadingApiKey}
                  />
                  <InputRightElement width="4.5rem">
                    <Button h="1.75rem" size="sm" onClick={toggleApiKeyVisibility}>
                      {showApiKey ? '隠す' : '表示'}
                    </Button>
                  </InputRightElement>
                </InputGroup>
                <FormHelperText>入力されたAPIキーは暗号化されて保存されます</FormHelperText>
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" onClick={closeApiKeySettings}>
                閉じる
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Flex>

      {/* メイン (左=アシスタント一覧, ドラッグハンドル, 右=チャット表示) */}
      <Flex as="main" flex="1" overflow="hidden" p={4}>
        <Box
          // 元の w="20%" を残しつつ、追加で幅をstyleで上書き
          w="20%"
          style={{ width: leftPaneWidth }}
          bg="white"
          shadow="lg"
          rounded="lg"
          display="flex"
          flexDirection="column"
          minW="280px"
          mr={2}
        >
          {/* オートアシスト */}
          <Box p={4} borderBottom="1px solid #eee">
            <List spacing={3}>
              <ListItem
                key="autoAssist"
                p={2}
                bg={selectedChatId === 'autoAssist' ? 'blue.100' : 'white'}
                borderRadius="md"
                cursor="pointer"
                onClick={() => {
                  setSelectedChatId('autoAssist')
                  setInputMessage('')
                }}
                _hover={{ bg: selectedChatId === 'autoAssist' ? 'blue.100' : 'blue.50' }}
              >
                <Flex justify="space-between" align="center">
                  <Box>
                    <Text fontSize="md" fontWeight="bold">
                      オートアシスト
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      自動で最適アシスタントを提案
                    </Text>
                  </Box>
                  {selectedChatId === 'autoAssist' && (
                    <HStack spacing={1}>
                      <IconButton
                        icon={<LuSettings />}
                        aria-label="設定"
                        isDisabled={isExpired}
                        variant="ghost"
                        colorScheme="blue"
                        size="xs"
                        onClick={() => {
                          if (selectedChatId === 'autoAssist') {
                            setIsAutoAssistSettingsOpen(true)
                          } else if (typeof selectedChatId === 'number') {
                            openSystemPromptModal()
                          }
                        }}
                      />
                    </HStack>
                  )}
                </Flex>
              </ListItem>
            </List>
          </Box>

          {/* アシスタント一覧 (オートアシスト以外) */}
          <Box overflowY="auto" flex="1">
            <List spacing={3} p={4}>
              {(() => {
                // 表示用にオートアシスト以外を取り出し
                const displayedList = chats.filter((c) => c.id !== AUTO_ASSIST_ID)

                return displayedList.map((chat, index) => {
                  const isDragTarget = dragOverIndex === index
                  const isCurrentSelected = chat.id === selectedChatId

                  return (
                    <ListItem
                      key={chat.id}
                      p={2}
                      borderRadius="md"
                      cursor="pointer"
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleListDragOver(e, index)}
                      onDrop={(e) => handleListDrop(e, index)}
                      onClick={() => handleSelectChat(chat.id)}
                      bg={isCurrentSelected ? 'blue.100' : isDragTarget ? 'gray.200' : 'white'}
                      _hover={{
                        bg: isCurrentSelected || isDragTarget ? 'gray.200' : 'blue.50'
                      }}
                      // ellipsis関連の指定をListItem自身にも残しておく
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      <Flex justify="space-between" align="center" minW="0">
                        {/* minW="0"をつけることでBoxがflexで縮む余地を作り、ellipsisが効く */}
                        <Box minW="0" flex="1">
                          <Tooltip
                            label={chat.customTitle}
                            isDisabled={chat.customTitle.length <= 11}
                          >
                            <Text
                              fontSize="md"
                              fontWeight="bold"
                              overflow="hidden"
                              textOverflow="ellipsis"
                              whiteSpace="nowrap"
                              w="100%"
                            >
                              {chat.customTitle || '無題のアシスタント'}
                            </Text>
                          </Tooltip>
                        </Box>

                        {isCurrentSelected && (
                          <HStack spacing={1}>
                            <IconButton
                              icon={<LuSettings />}
                              aria-label="アシスタント設定"
                              variant="ghost"
                              colorScheme="blue"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                openSystemPromptModal()
                              }}
                            />
                            <IconButton
                              icon={<AiOutlineDelete />}
                              aria-label="アシスタント削除"
                              variant="ghost"
                              colorScheme="red"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteTargetId(chat.id)
                                setIsDeleteModalOpen(true)
                              }}
                            />
                          </HStack>
                        )}
                      </Flex>
                    </ListItem>
                  )
                })
              })()}
            </List>
          </Box>
        </Box>

        {/* ドラッグハンドルを追加 */}
        <Box
          width="5px"
          cursor="col-resize"
          onMouseDown={() => setIsResizing(true)}
          bg={isResizing ? 'gray.300' : ''}
          _hover={{ bg: isResizing ? '' : 'gray.300' }}
          mr={2}
          borderRadius="md"
        />

        {/* 右カラム(チャット表示) */}
        <Box w="100%" bg="white" shadow="lg" rounded="lg" display="flex" flexDirection="column">
          <Box ref={chatHistoryRef} flex="1" overflowY="auto" p={4}>
            {selectedChatId === 'autoAssist' ? (
              <>
                <Text fontWeight="bold" color="gray.600" mb={3}>
                  オートアシストモード
                </Text>
                <MessageList
                  messages={autoAssistMessages}
                  onCopy={handleCopyMessage}
                  onEdit={handleEditMessage}
                  chatHistoryRef={chatHistoryRef}
                />
              </>
            ) : selectedChatObj ? (
              <MessageList
                messages={selectedChatObj.messages}
                onCopy={handleCopyMessage}
                onEdit={handleEditMessage}
                chatHistoryRef={chatHistoryRef}
              />
            ) : (
              <Text fontWeight="bold" color="gray.500">
                アシスタントを作成・選択して開始してください
              </Text>
            )}
          </Box>

          {/* 入力フォーム */}
          <ChatInputForm
            inputMessage={inputMessage}
            onInputChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onSendMessage={memoizedSendMessage}
            onFileSelect={handleFileSelection}
            onFileChange={handleFileInputChange}
            useAgentFile={useAgentFile}
            onUseAgentFileChange={handleUseAgentFileChange}
            agentMode={agentMode}
            onAgentModeChange={handleAgentModeChange}
            isLoading={isLoading}
            disabled={apiKey.length === 0 || isExpired}
            selectedChatId={selectedChatId}
            chatInputRef={chatInputRef}
            fileInputRef={fileInputRef}
          />

          {/* 添付ファイル一覧 */}
          <AttachmentList files={tempFiles} onDelete={handleTempFileDelete} />
        </Box>
      </Flex>

      {/* 期限切れモーダル */}
      <Modal isOpen={isExpired} onClose={() => {}} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>使用期間終了</ModalHeader>
          <ModalBody>
            <Text>使用期間を過ぎています！</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" onClick={() => window.close()}>
              閉じる
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 新アシスタント作成モーダル */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeCustomChatModal}
        isCentered
        closeOnOverlayClick={false}
        closeOnEsc={false}
      >
        <ModalOverlay />
        <ModalContent maxW="3xl">
          <ModalHeader>新しいアシスタントの作成</ModalHeader>
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>アシスタント名</FormLabel>
              <Input
                value={modalChatTitle}
                onChange={(e) => setModalChatTitle(e.target.value)}
                placeholder="アシスタント名を入力"
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>指示</FormLabel>
              <Textarea
                rows={5}
                w="full"
                value={modalSystemPrompt}
                onChange={(e) => setModalSystemPrompt(e.target.value)}
                placeholder="アシスタントの役割や口調などを指定"
              />
            </FormControl>

            <FormControl>
              <FormLabel>ナレッジファイル(複数可)</FormLabel>
              <Button colorScheme="blue" variant="outline" onClick={handleSelectAgentFiles}>
                ファイルを選択
              </Button>
              {modalAgentFiles.length > 0 && (
                <Box mt={2}>
                  {modalAgentFiles.map((f) => (
                    <Flex
                      key={f.path}
                      align="center"
                      justify="space-between"
                      p={2}
                      bg="gray.50"
                      mt={2}
                      borderRadius="md"
                    >
                      <Text fontSize="sm" mr={4}>
                        {f.name}
                      </Text>
                      <IconButton
                        icon={<AiOutlineDelete />}
                        aria-label="削除"
                        colorScheme="red"
                        size="sm"
                        onClick={() => handleRemoveAgentFile(f.path)}
                      />
                    </Flex>
                  ))}
                </Box>
              )}
            </FormControl>
            {isExternalApiEnabled && (
              <>
                <FormControl mt={4} mb={4} display="flex" alignItems="center">
                  <FormLabel htmlFor="create-api-call-enabled" mb="0">
                    外部API呼び出しを有効にする
                  </FormLabel>
                  <Switch
                    id="create-api-call-enabled"
                    isChecked={modalEnableAPICall}
                    onChange={(e) => setModalEnableAPICall(e.target.checked)}
                  />
                </FormControl>

                <FormControl mt={4} mb={4}>
                  <Button
                    onClick={() => setIsCreateAPISettingsOpen(true)}
                    colorScheme="teal"
                    isDisabled={!modalEnableAPICall}
                  >
                    外部API設定
                  </Button>
                  <FormHelperText>アシスタントが呼び出し可能な外部APIを設定します</FormHelperText>
                </FormControl>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={closeCustomChatModal}>
              キャンセル
            </Button>
            <Button colorScheme="blue" onClick={handleCreateCustomChat}>
              作成
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <APISettingsModal
        isOpen={isCreateAPISettingsOpen}
        onClose={() => setIsCreateAPISettingsOpen(false)}
        apiConfigs={modalAPIConfigs}
        onSave={(configs) => {
          setModalAPIConfigs(configs)
        }}
      />
      {/* システムプロンプト編集モーダル */}
      <Modal
        isOpen={isPromptModalOpen}
        onClose={closeSystemPromptModal}
        isCentered
        closeOnOverlayClick={false}
        closeOnEsc={false}
      >
        <ModalOverlay />
        <ModalContent maxW="3xl">
          <ModalHeader>アシスタントの設定</ModalHeader>
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>アシスタント名</FormLabel>
              <Input
                value={editingCustomTitle}
                onChange={(e) => setEditingCustomTitle(e.target.value)}
                placeholder="アシスタント名を変更"
              />
            </FormControl>

            <FormControl>
              <FormLabel>指示</FormLabel>
              <Textarea
                rows={6}
                value={editingSystemPrompt}
                onChange={(e) => setEditingSystemPrompt(e.target.value)}
                placeholder="アシスタントへの指示を入力/編集"
                height="250px"
              />
            </FormControl>
            <HStack spacing={2} mt={3}>
              <Button variant="outline" colorScheme="blue" onClick={handleCopySystemPrompt}>
                コピー
              </Button>
            </HStack>

            <FormControl mt={5}>
              <FormLabel>ナレッジファイル(複数可)</FormLabel>
              <Button colorScheme="blue" variant="outline" onClick={handleAddAgentFileInPrompt}>
                ファイルを選択
              </Button>
              {editingAgentFiles.length > 0 && (
                <Box mt={2}>
                  {editingAgentFiles.map((f) => (
                    <Flex
                      key={f.path}
                      align="center"
                      justify="space-between"
                      p={2}
                      bg="gray.50"
                      mt={2}
                      borderRadius="md"
                    >
                      <Text fontSize="sm" mr={4}>
                        {f.name}
                      </Text>
                      <IconButton
                        icon={<AiOutlineDelete />}
                        aria-label="削除"
                        colorScheme="red"
                        size="sm"
                        onClick={() => handleRemoveAgentFileInPrompt(f.path)}
                      />
                    </Flex>
                  ))}
                </Box>
              )}
            </FormControl>

            <FormControl mt={5}>
              <FormLabel>会話履歴のリセット</FormLabel>
              <Button
                colorScheme="red"
                variant="outline"
                onClick={() => setIsResetConfirmOpen(true)}
              >
                会話履歴リセット
              </Button>
            </FormControl>
            {isExternalApiEnabled && (
              <>
                <FormControl mt={5} mb={4} display="flex" alignItems="center">
                  <FormLabel htmlFor="api-call-enabled" mb="0">
                    外部API呼び出しを有効にする
                  </FormLabel>
                  <Switch
                    id="api-call-enabled"
                    isChecked={enableAPICall}
                    onChange={(e) => setEnableAPICall(e.target.checked)}
                  />
                </FormControl>

                <FormControl mt={4} mb={4}>
                  <Button
                    onClick={() => setIsAPISettingsOpen(true)}
                    colorScheme="teal"
                    isDisabled={!enableAPICall}
                  >
                    外部API設定
                  </Button>
                  <FormHelperText>アシスタントが呼び出し可能な外部APIを設定します</FormHelperText>
                </FormControl>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={closeSystemPromptModal}>
              キャンセル
            </Button>
            <Button colorScheme="blue" onClick={handleSaveSystemPrompt}>
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <APISettingsModal
        isOpen={isAPISettingsOpen}
        onClose={() => setIsAPISettingsOpen(false)}
        apiConfigs={editingAPIConfigs}
        onSave={(configs) => {
          setEditingAPIConfigs(configs)
        }}
      />
      {/* 会話リセット確認モーダル */}
      <Modal isOpen={isResetConfirmOpen} onClose={closeResetConfirm} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>会話履歴のリセット</ModalHeader>
          <ModalBody>
            <Text>本当にこの会話の履歴を消去しますか？</Text>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={closeResetConfirm}>
              キャンセル
            </Button>
            <Button colorScheme="red" onClick={handleResetConversation}>
              消去
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* オートアシスト会話リセット */}
      <Modal
        isOpen={isResetAutoAssistConfirm}
        onClose={() => setIsResetAutoAssistConfirm(false)}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>オートアシスト会話履歴リセット</ModalHeader>
          <ModalBody>
            <Text>オートアシストの会話履歴を消去しますか？</Text>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={() => setIsResetAutoAssistConfirm(false)}>
              キャンセル
            </Button>
            <Button colorScheme="red" onClick={handleResetAutoAssistFromModal}>
              消去
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* アシスタント削除モーダル */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>アシスタント削除の確認</ModalHeader>
          <ModalBody>
            <Text>このアシスタントを削除しますか？</Text>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={closeDeleteModal}>
              キャンセル
            </Button>
            <Button colorScheme="red" onClick={() => confirmDeleteChat()}>
              削除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* オートアシスト設定モーダル */}
      <AutoAssistSettingsModal
        isOpen={isAutoAssistSettingsOpen}
        onClose={() => setIsAutoAssistSettingsOpen(false)}
        chats={chats}
        setChats={setChats}
        onConfirmResetAutoAssist={handleConfirmResetAutoAssist}
      />

      {/* タイトル編集モーダル */}
      <TitleEditModal
        isOpen={isTitleEditOpen}
        onClose={() => setIsTitleEditOpen(false)}
        titleSettings={titleSettings}
        setTitleSettings={setTitleSettings}
      />

      {/* エクスポートモーダル */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        chats={chats}
      />

      {/* インポートのモード選択モーダル */}
      <ImportModeModal
        isOpen={isImportModeModalOpen}
        onClose={() => setIsImportModeModalOpen(false)}
        importedRaw={importedConfigRaw}
        onReplace={(raw) => doReplaceImport(raw)}
        onAppend={(raw) => doAppendImport(raw)}
      />
    </Flex>
  )
}
