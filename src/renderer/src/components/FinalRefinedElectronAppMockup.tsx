import { useState, useEffect, useRef } from 'react'
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
  Select
} from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { AiOutlineDelete } from 'react-icons/ai'
import { MdOutlineContentCopy } from 'react-icons/md'
import { FiEdit } from 'react-icons/fi' // タイトル編集アイコンなど

/**
 * Electron API interface
 *
 * ▼ タイトル設定を保存/読み込みするために、新たに
 *   loadTitleSettings / saveTitleSettings を追加
 */
interface ElectronAPI {
  postChatAI: (message: Messages[], apiKey: string, systemPrompt: string) => Promise<any>
  loadAgents: () => Promise<ChatInfo[]>
  saveAgents: (agentsData: ChatInfo[]) => Promise<any>
  copyFileToUserData: (oldFilePath?: string) => Promise<string | null>
  readFileByPath: (filePath: string) => Promise<string | null>
  deleteFileInUserData: (filePath: string) => Promise<boolean>
  getAppVersion: () => Promise<string>

  // ★ ここから追記: タイトル設定の保存/読み込み
  loadTitleSettings?: () => Promise<TitleSettings | null>
  saveTitleSettings?: (settings: TitleSettings) => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

/**
 * TitleSegment: タイトルの一部文字列＋色
 */
type TitleSegment = {
  text: string
  color: string
}

/**
 * タイトル全体の設定 (文字の部分配列 + 書体)
 *
 * ここに backgroundImagePath を追加して
 * ヘッダー背景画像を永続化できるようにする
 */
type TitleSettings = {
  segments: TitleSegment[]
  fontFamily: string
  backgroundImagePath?: string // ★ ヘッダー背景画像のパス(ユーザーデータ内)
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
}

/**
 * オートアシスト状態
 */
type AutoAssistState = 'idle' | 'awaitConfirm' | 'executing'

/**
 * タスク分解の結果
 */
type SubtaskInfo = {
  task: string
  recommendedAssistant: string | null
}

/* ------------------------------------
 * タイトル編集モーダル
 *   - 背景画像アップロード機能を追加
 *   - デフォルトに戻すボタンを追加
 *   - 画像削除ボタンを追加
 * ------------------------------------ */
function TitleEditModal({
  isOpen,
  onClose,
  titleSettings,
  setTitleSettings
}: {
  isOpen: boolean
  onClose: () => void
  titleSettings: TitleSettings
  setTitleSettings: (val: TitleSettings) => void
}) {
  const toast = useToast()

  // 既存の文字・色など
  const [tempSegments, setTempSegments] = useState<TitleSegment[]>([])
  const [tempFont, setTempFont] = useState<string>('Arial')

  // ★ 追加: 背景画像のパス(ローカルステート)
  const [tempBackgroundPath, setTempBackgroundPath] = useState<string | undefined>(undefined)

  // 選択肢として用意するフォント例
  const fontOptions = ['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New']

  // デフォルトタイトル設定 (DesAIn Assistant の色分け)
  const defaultSegments: TitleSegment[] = [
    { text: 'D', color: '#ff6600' },
    { text: 'es', color: '#333333' },
    { text: 'AI', color: '#dd5588' },
    { text: 'n ', color: '#333333' },
    { text: 'A', color: '#ffd700' },
    { text: 'ssistant', color: '#333333' }
  ]
  const defaultFont = 'Arial'

  // モーダルが開くたびに現在のタイトル設定をコピー
  useEffect(() => {
    if (isOpen) {
      setTempSegments(JSON.parse(JSON.stringify(titleSettings.segments)))
      setTempFont(titleSettings.fontFamily)
      setTempBackgroundPath(titleSettings.backgroundImagePath)
    }
  }, [isOpen, titleSettings])

  // セグメントを追加
  const addSegment = () => {
    setTempSegments((prev) => [...prev, { text: '', color: '#000000' }])
  }

  // セグメント削除
  const removeSegment = (idx: number) => {
    setTempSegments((prev) => prev.filter((_, i) => i !== idx))
  }

  // テキスト更新
  const updateSegmentText = (idx: number, newVal: string) => {
    setTempSegments((prev) => prev.map((seg, i) => (i === idx ? { ...seg, text: newVal } : seg)))
  }

  // カラー更新
  const updateSegmentColor = (idx: number, newColor: string) => {
    setTempSegments((prev) => prev.map((seg, i) => (i === idx ? { ...seg, color: newColor } : seg)))
  }

  // デフォルトに戻す
  const handleRevertDefault = () => {
    setTempSegments(JSON.parse(JSON.stringify(defaultSegments)))
    setTempFont(defaultFont)
    toast({
      title: 'タイトルをデフォルトに戻しました',
      status: 'info',
      duration: 1500,
      isClosable: true
    })
  }

  // ★ 背景画像を選択
  const handleSelectBackgroundImage = async () => {
    try {
      // もし既に画像があれば先に削除する
      if (tempBackgroundPath) {
        await window.electronAPI.deleteFileInUserData(tempBackgroundPath)
      }
      // 新しいファイルを選択し、userDataにコピー
      const newPath = await window.electronAPI.copyFileToUserData()
      if (newPath) {
        setTempBackgroundPath(newPath)
      } else {
        toast({
          title: '画像の選択がキャンセルされました',
          status: 'info',
          duration: 1500,
          isClosable: true
        })
      }
    } catch (err) {
      console.error('Failed to set background image:', err)
      toast({
        title: '背景画像の設定でエラー',
        status: 'error',
        duration: 2000,
        isClosable: true
      })
    }
  }

  // ★ 背景画像削除
  const handleRemoveBackgroundImage = async () => {
    if (!tempBackgroundPath) {
      return
    }
    try {
      const ok = await window.electronAPI.deleteFileInUserData(tempBackgroundPath)
      if (ok) {
        setTempBackgroundPath(undefined)
        toast({
          title: '背景画像を削除しました',
          status: 'info',
          duration: 1500,
          isClosable: true
        })
      }
    } catch (err) {
      console.error('Failed to remove background image:', err)
    }
  }

  // 保存 (タイトル設定を適用し、かつ electronAPI.saveTitleSettings も呼ぶ)
  const handleSaveTitle = async () => {
    const newSettings: TitleSettings = {
      segments: tempSegments,
      fontFamily: tempFont,
      backgroundImagePath: tempBackgroundPath // ★ 追加
    }
    setTitleSettings(newSettings)

    // ▼ タイトルを永続化
    try {
      if (window.electronAPI.saveTitleSettings) {
        await window.electronAPI.saveTitleSettings(newSettings)
      }
    } catch (err) {
      console.error('Failed to save title settings:', err)
    }

    toast({
      title: 'タイトル設定を保存しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>タイトルの編集</ModalHeader>
        <ModalBody>
          {/* 書体 */}
          <FormControl mb={4}>
            <FormLabel>書体</FormLabel>
            <Select value={tempFont} onChange={(e) => setTempFont(e.target.value)}>
              {fontOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </FormControl>

          {/* セグメント編集 (文字 + 色) */}
          <FormControl mb={4}>
            <FormLabel>タイトル文字＋色 (複数行可)</FormLabel>
            {tempSegments.map((seg, idx) => (
              <HStack key={idx} spacing={2} mb={1}>
                <Input
                  value={seg.text}
                  onChange={(e) => updateSegmentText(idx, e.target.value)}
                  placeholder="文字"
                  width="100px"
                />
                <Input
                  type="color"
                  value={seg.color}
                  onChange={(e) => updateSegmentColor(idx, e.target.value)}
                  width="60px"
                  p={0}
                />
                <IconButton
                  icon={<AiOutlineDelete />}
                  aria-label="削除"
                  colorScheme="red"
                  size="sm"
                  onClick={() => removeSegment(idx)}
                />
              </HStack>
            ))}
            <Button mt={2} onClick={addSegment}>
              + 行を追加
            </Button>
          </FormControl>

          {/* デフォルトに戻す */}
          <FormControl mt={4} mb={6}>
            <Button colorScheme="orange" variant="outline" onClick={handleRevertDefault}>
              デフォルトに戻す
            </Button>
          </FormControl>

          {/* ★ 背景画像の設定・削除 */}
          <FormControl mt={2}>
            <FormLabel>ヘッダー背景画像</FormLabel>
            <HStack spacing={3}>
              <Button colorScheme="blue" onClick={handleSelectBackgroundImage}>
                背景画像を選択
              </Button>
              <Button
                colorScheme="red"
                variant="outline"
                onClick={handleRemoveBackgroundImage}
                isDisabled={!tempBackgroundPath}
              >
                背景画像を削除
              </Button>
            </HStack>
            {tempBackgroundPath && (
              <Text fontSize="sm" color="gray.600" mt={2}>
                現在設定中: {tempBackgroundPath}
              </Text>
            )}
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose} mr={3}>
            キャンセル
          </Button>
          <Button colorScheme="blue" onClick={handleSaveTitle}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

/* ------------------------------------
 * オートアシスト設定モーダル (既存)
 * ------------------------------------ */
function AutoAssistSettingsModal({
  isOpen,
  onClose,
  chats,
  setChats,
  onConfirmResetAutoAssist
}: {
  isOpen: boolean
  onClose: () => void
  chats: ChatInfo[]
  setChats: (c: ChatInfo[]) => void
  onConfirmResetAutoAssist: () => void
}) {
  const toast = useToast()
  const [localChats, setLocalChats] = useState<ChatInfo[]>([])

  const AUTO_ASSIST_ID = 999999

  useEffect(() => {
    if (isOpen) {
      setLocalChats(JSON.parse(JSON.stringify(chats)))
    }
  }, [isOpen, chats])

  const handleChangeSummary = (id: number, summary: string) => {
    setLocalChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, assistantSummary: summary } : c))
    )
  }

  const handleSave = async () => {
    setChats(localChats)
    try {
      await window.electronAPI.saveAgents(localChats)
      toast({
        title: '要約を保存しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (err) {
      console.error('save agent summaries error:', err)
      toast({
        title: 'エラー',
        description: 'アシスタント要約の保存中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>オートアシスト設定</ModalHeader>
        <ModalBody>
          <Text mb={4} fontSize="sm" color="gray.600">
            各アシスタントの「得意分野要約」を確認・編集できます。
          </Text>

          <Box maxH="480px" overflowY="auto" mb={4}>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>アシスタント名</Th>
                  <Th>要約(assistantSummary)</Th>
                </Tr>
              </Thead>
              <Tbody>
                {localChats
                  .filter((chat) => chat.id !== AUTO_ASSIST_ID)
                  .map((c) => (
                    <Tr key={c.id}>
                      <Td>{c.id}</Td>
                      <Td>{c.customTitle}</Td>
                      <Td>
                        <Textarea
                          value={c.assistantSummary || ''}
                          onChange={(e) => handleChangeSummary(c.id, e.target.value)}
                          size="sm"
                          placeholder="得意分野要約"
                        />
                      </Td>
                    </Tr>
                  ))}
              </Tbody>
            </Table>
          </Box>

          <Box textAlign="center">
            <Button colorScheme="red" variant="outline" onClick={onConfirmResetAutoAssist}>
              オートアシストの会話履歴をリセット
            </Button>
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button mr={3} onClick={onClose}>
            キャンセル
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export const FinalRefinedElectronAppMockup = () => {
  const toast = useToast()

  // --------------------------------
  // タイトル設定 (部分文字+色 + フォント + 背景画像パス)
  // --------------------------------
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
    backgroundImagePath: undefined // 追加: 初期は無し
  })
  const [isTitleEditOpen, setIsTitleEditOpen] = useState(false)
  const [titleHovered, setTitleHovered] = useState(false)

  // ★ 追加: ヘッダー背景を base64 で保持して data URI 化
  const [headerBgDataUri, setHeaderBgDataUri] = useState<string | undefined>(undefined)

  // --------------------------------
  // オートアシスト関連
  // --------------------------------
  const [autoAssistMessages, setAutoAssistMessages] = useState<Message[]>([])
  const [autoAssistState, setAutoAssistState] = useState<AutoAssistState>('idle')
  const [pendingSubtasks, setPendingSubtasks] = useState<SubtaskInfo[]>([])
  const [pendingEphemeralMsg, setPendingEphemeralMsg] = useState<Messages | null>(null)
  const AUTO_ASSIST_ID = 999999
  const [agentMode, setAgentMode] = useState<boolean>(false)

  // --------------------------------
  // 全チャット関連
  // --------------------------------
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

  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null)
  const [isAutoAssistSettingsOpen, setIsAutoAssistSettingsOpen] = useState(false)

  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // メッセージ編集用Index
  const [editIndex, setEditIndex] = useState<number | null>(null)

  // バージョン
  const [appVersion, setAppVersion] = useState<string>('')

  // --------------------------------
  // 初期ロード
  // --------------------------------
  useEffect(() => {
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

    // タイトル設定のロード (あれば)
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

  // チャット欄常にスクロール最下部
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [chats, selectedChatId, autoAssistMessages])

  // ★ ヘッダー画像を base64 で読み込み、data URI を生成
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
        // 拡張子から MIME を推定
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

  // CSV->JSON
  function csvToJson(csv: string): string {
    const lines = csv.trim().split('\n')
    if (lines.length < 1) return JSON.stringify([])
    const headers = lines[0].split(',')
    const result = []
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',')
      if (row.length !== headers.length) continue
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => {
        obj[h.trim()] = row[idx].trim()
      })
      // @ts-ignore
      result.push(obj)
    }

    return JSON.stringify(result, null, 2)
  }

  // -----------------------------
  // ファイル添付 (チャット用)
  // -----------------------------
  const handleTempFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    // @ts-ignore
    const fileNum = files?.length
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
        if (processed === fileNum) {
          setTempFiles((prev) => [...prev, ...newFiles])
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
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
  }

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleTempFileDelete = (targetName: string) => {
    setTempFiles((prev) => prev.filter((f) => f.name !== targetName))
  }

  // --------------------------------
  // 入力フォーム
  // --------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputMessage(val)
    if (typeof selectedChatId === 'number') {
      setChats((prev) =>
        prev.map((chat) => (chat.id === selectedChatId ? { ...chat, inputMessage: val } : chat))
      )
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // --------------------------------
  // handleSelectChat
  // --------------------------------
  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const target = chats.find((c) => c.id === id)
    if (target) {
      setInputMessage(target.inputMessage)
    }
  }

  // --------------------------------
  // オートアシスト系ロジック (省略: 既存コードをそのまま)
  // --------------------------------
  async function executeSubtasksAndShowOnce(subtasks: SubtaskInfo[]) {
    setAutoAssistState('executing')
    try {
      const subtaskOutputs: string[] = []
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        let out = ''

        if (!st.recommendedAssistant) {
          const fallbackSystemPrompt = `
あなたはAutoAssistです。
以下のタスクをあなたが実行してください:
${st.task}
`
          const arr: Messages[] = []
          if (pendingEphemeralMsg) arr.push(pendingEphemeralMsg)
          arr.push({ role: 'user', parts: [{ text: st.task }] })
          try {
            const resp = await window.electronAPI.postChatAI(arr, apiKey, fallbackSystemPrompt)
            out = resp
          } catch (err) {
            out = '(実行中にエラー)'
          }
        } else {
          const asstObj = chats.find(
            (c) =>
              c.customTitle.trim().toLowerCase() === st.recommendedAssistant!.trim().toLowerCase()
          )
          if (!asstObj) {
            out = '(指定アシスタントが見つかりません)'
          } else {
            const arr: Messages[] = []
            if (pendingEphemeralMsg) arr.push(pendingEphemeralMsg)
            arr.push({ role: 'user', parts: [{ text: st.task }] })
            try {
              const resp = await window.electronAPI.postChatAI(arr, apiKey, asstObj.systemPrompt)
              out = resp
            } catch (err) {
              out = '(アシスタント実行エラー)'
            }
          }
        }

        subtaskOutputs.push(
          `タスク${i + 1} : ${st.task}\n(アシスタント: ${
            st.recommendedAssistant || 'AutoAssist/fallback'
          })\n結果:\n${out}\n`
        )
      }

      const finalMerged = `以下が最終的な実行結果です:\n${subtaskOutputs.join('\n')}`
      setAutoAssistMessages((prev) => [...prev, { type: 'ai', content: finalMerged }])
    } finally {
      setPendingSubtasks([])
      setPendingEphemeralMsg(null)
      setAutoAssistState('idle')
    }
  }

  async function findAssistantsForEachTask(tasks: string[]): Promise<SubtaskInfo[]> {
    const output: SubtaskInfo[] = []
    const summaries = chats
      .map((c) => `アシスタント名:"${c.customTitle}"\n要約:"${c.assistantSummary || ''}"`)
      .join('\n')

    for (const rawTask of tasks) {
      const cleanTask = rawTask.replace(/^タスク\d+\s*:\s*/, '')

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
`
      const msgs: Messages[] = []
      if (pendingEphemeralMsg) msgs.push(pendingEphemeralMsg)
      msgs.push({ role: 'user', parts: [{ text: cleanTask }] })

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

  async function handleAutoAssistSend() {
    setIsLoading(true)
    try {
      const ephemeralMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      for (const f of tempFiles) {
        if (f.mimeType === 'text/csv') {
          try {
            const csvString = window.atob(f.data)
            const jsonStr = csvToJson(csvString)
            ephemeralMsg.parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
          } catch {
            ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
          }
        }
        ephemeralMsg.parts.push({
          inlineData: { mimeType: f.mimeType, data: f.data }
        })
      }

      setInputMessage('')
      setTempFiles([])

      const parseSystemPrompt = `
ユーザー依頼をタスクに分割し、必ず JSON配列だけを返してください。
ユーザーの依頼で、処理内容が異なるところで分割する程度にとどめていください。
ユーザーの依頼分を詳細にタスク分解する必要はありません。
フォーマット：
例: ["タスク1:添付ファイルを分析","タスク2:ReactでUI生成"]
`
      const parseResp = await window.electronAPI.postChatAI(
        [ephemeralMsg],
        apiKey,
        parseSystemPrompt
      )
      const splittedRaw = parseResp.replaceAll('```json', '').replaceAll('```', '').trim()
      let splitted: string[] = []
      try {
        splitted = JSON.parse(splittedRaw)
      } catch {
        splitted = [ephemeralMsg.parts[0].text || '']
      }

      setPendingEphemeralMsg(ephemeralMsg)

      const subtaskInfos = await findAssistantsForEachTask(splitted)
      setPendingSubtasks(subtaskInfos)

      const lines = subtaskInfos.map(
        (si, idx) =>
          `タスク${idx + 1} : ${si.task}\n→ 推奨アシスタント : ${si.recommendedAssistant}`
      )
      const summaryMsg = `以下のタスクに分割し、推奨アシスタントを割り当てました:\n\n${lines.join('\n\n')}`
      setAutoAssistMessages((prev) => [...prev, { type: 'ai', content: summaryMsg }])

      const updatedStore = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [...c.messages, { type: 'ai', content: summaryMsg }]
          }
        }

        return c
      })
      setChats(updatedStore as ChatInfo[])
      // @ts-ignore
      await window.electronAPI.saveAgents(updatedStore)

      if (agentMode) {
        await executeSubtasksAndShowOnce(subtaskInfos)
      } else {
        setAutoAssistState('awaitConfirm')
        setAutoAssistMessages((prev) => [
          ...prev,
          { type: 'ai', content: '実行しますか？ (Yesで実行 / Noでキャンセル)' }
        ])
        const updated2 = updatedStore.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [
                ...c.messages,
                { type: 'ai', content: '実行しますか？ (Yesで実行 / Noでキャンセル)' }
              ]
            }
          }

          return c
        })
        setChats(updated2 as ChatInfo[])
        // @ts-ignore
        await window.electronAPI.saveAgents(updated2)
      }
    } catch (err) {
      console.error('handleAutoAssistSend error:', err)
      setAutoAssistMessages((prev) => [
        ...prev,
        { type: 'ai', content: 'タスク分割処理中にエラーが発生しました。' }
      ])
      const updatedErr = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [
              ...c.messages,
              { type: 'ai', content: 'タスク分割処理中にエラーが発生しました.' }
            ]
          }
        }

        return c
      })
      setChats(updatedErr as ChatInfo[])
      // @ts-ignore
      await window.electronAPI.saveAgents(updatedErr)
    } finally {
      setIsLoading(false)
    }
  }

  async function sendMessage() {
    // -------------------------------------------------------
    // 1) もしオートアシストでメッセージ編集モードなら
    // -------------------------------------------------------
    if (selectedChatId === 'autoAssist' && editIndex != null) {
      setIsLoading(true)
      try {
        const clonedAuto = [...autoAssistMessages]
        clonedAuto.splice(editIndex, clonedAuto.length - editIndex, {
          type: 'user',
          content: inputMessage
        })
        setAutoAssistMessages(clonedAuto)

        const updatedChats = chats.map((chat) => {
          if (chat.id === AUTO_ASSIST_ID) {
            const cloned = [...chat.messages]
            cloned.splice(editIndex, cloned.length - editIndex, {
              type: 'user',
              content: inputMessage
            })
            const clonedPost = [...chat.postMessages]
            clonedPost.splice(editIndex, clonedPost.length - editIndex)

            return {
              ...chat,
              messages: cloned,
              postMessages: clonedPost
            }
          }

          return chat
        })
        setChats(updatedChats)
        await window.electronAPI.saveAgents(updatedChats)

        setEditIndex(null)
        setInputMessage('')
        setTempFiles([])
        await handleAutoAssistSend()

        toast({
          title: 'オートアシストの編集結果を再実行しました',
          description: '指定index以降の履歴を削除し、新しい内容でオートアシストを再実行しました。',
          status: 'info',
          duration: 2500,
          isClosable: true
        })
      } catch (err) {
        console.error('edit & re-run (autoAssist) error:', err)
        toast({
          title: 'エラー',
          description: 'オートアシスト編集内容の実行中にエラーが発生しました。',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
      } finally {
        setIsLoading(false)
      }

      return
    }

    // -------------------------------------------------------
    // 2) オートアシストがYes/No待ちの場合
    // -------------------------------------------------------
    if (selectedChatId === 'autoAssist' && autoAssistState === 'awaitConfirm') {
      const ans = inputMessage.trim().toLowerCase()
      const userMsg: Message = { type: 'user', content: inputMessage }
      setAutoAssistMessages((prev) => [...prev, userMsg])

      let updated = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return { ...c, messages: [...c.messages, userMsg] }
        }

        return c
      })
      setChats(updated)
      await window.electronAPI.saveAgents(updated)

      if (ans === 'yes') {
        setIsLoading(true)
        await executeSubtasksAndShowOnce(pendingSubtasks)
        setIsLoading(false)
        setAutoAssistState('idle')
        setInputMessage('')

        return
      } else if (ans === 'no') {
        setAutoAssistMessages((prev) => [
          ...prev,
          { type: 'ai', content: 'タスク実行をキャンセルしました.' }
        ])
        updated = updated.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [...c.messages, { type: 'ai', content: 'タスク実行をキャンセルしました.' }]
            }
          }

          return c
        })
        setChats(updated)
        await window.electronAPI.saveAgents(updated)

        setPendingSubtasks([])
        setPendingEphemeralMsg(null)
        setAutoAssistState('idle')
        setInputMessage('')

        return
      } else {
        setAutoAssistMessages((prev) => [
          ...prev,
          { type: 'ai', content: 'Yes で実行 / No でキャンセル です.' }
        ])
        updated = updated.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [
                ...c.messages,
                { type: 'ai', content: 'Yes で実行 / No でキャンセル です.' }
              ]
            }
          }

          return c
        })
        setChats(updated)
        await window.electronAPI.saveAgents(updated)
        setInputMessage('')

        return
      }
    }

    // -------------------------------------------------------
    // 3) オートアシスト(通常)
    // -------------------------------------------------------
    if (selectedChatId === 'autoAssist') {
      const userMsg: Message = { type: 'user', content: inputMessage }
      setAutoAssistMessages((prev) => [...prev, userMsg])
      const updated = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return { ...c, messages: [...c.messages, userMsg] }
        }

        return c
      })
      setChats(updated)
      await window.electronAPI.saveAgents(updated)

      setIsLoading(true)
      setInputMessage('')
      setTempFiles([])
      await handleAutoAssistSend()
      setIsLoading(false)

      return
    }

    // -------------------------------------------------------
    // 4) 通常アシスタント
    // -------------------------------------------------------
    const selectedChat = chats.find((c) => c.id === selectedChatId)
    if (!selectedChat) return

    // (通常)編集モード
    if (editIndex != null) {
      setIsLoading(true)
      try {
        const updatedChats = chats.map((chat) => {
          if (chat.id === selectedChatId) {
            const cloned = [...chat.messages]
            cloned.splice(editIndex, cloned.length - editIndex, {
              type: 'user',
              content: inputMessage
            })
            const clonedPost = [...chat.postMessages]
            clonedPost.splice(editIndex, clonedPost.length - editIndex)

            return {
              ...chat,
              messages: cloned,
              postMessages: clonedPost
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

        const ephemeralMsg: Messages = {
          role: 'user',
          parts: [{ text: inputMessage }]
        }

        for (const f of tempFiles) {
          if (f.mimeType === 'text/csv') {
            try {
              const csvString = window.atob(f.data)
              const jsonStr = csvToJson(csvString)
              ephemeralMsg.parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
            } catch {
              ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
            }
          }
          ephemeralMsg.parts.push({
            inlineData: { mimeType: f.mimeType, data: f.data }
          })
        }

        if (useAgentFile && newSelectedChat.agentFilePaths) {
          for (const p of newSelectedChat.agentFilePaths) {
            try {
              const fileBase64 = await window.electronAPI.readFileByPath(p)
              if (fileBase64) {
                const lower = p.toLowerCase()
                let derivedMime = 'application/octet-stream'
                if (lower.endsWith('.pdf')) derivedMime = 'application/pdf'
                else if (lower.endsWith('.txt')) derivedMime = 'text/plain'
                else if (lower.endsWith('.png')) derivedMime = 'image/png'
                else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
                  derivedMime = 'image/jpeg'
                else if (lower.endsWith('.gif')) derivedMime = 'image/gif'
                else if (lower.endsWith('.csv')) {
                  try {
                    const csvString = window.atob(fileBase64)
                    const jsonStr = csvToJson(csvString)
                    ephemeralMsg.parts[0].text += `\nナレッジCSV→JSON:\n${jsonStr}`
                  } catch {
                    ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
                  }
                  ephemeralMsg.parts.push({
                    inlineData: { mimeType: 'text/csv', data: fileBase64 }
                  })
                  continue
                }
                ephemeralMsg.parts.push({
                  inlineData: { mimeType: derivedMime, data: fileBase64 }
                })
              }
            } catch (err) {
              console.error('readFileByPath error:', err)
            }
          }
        }

        const ephemeralAll = [...newSelectedChat.postMessages, ephemeralMsg]
        const resp = await window.electronAPI.postChatAI(
          ephemeralAll,
          apiKey,
          newSelectedChat.systemPrompt
        )
        const aiMsg: Message = { type: 'ai', content: resp }

        const finalUpdated = updatedChats.map((chat) => {
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

    // 新規メッセージ (通常送信)
    setIsLoading(true)
    try {
      const userMsg: Message = { type: 'user', content: inputMessage }
      const ephemeralMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      for (const f of tempFiles) {
        if (f.mimeType === 'text/csv') {
          try {
            const csvString = window.atob(f.data)
            const jsonStr = csvToJson(csvString)
            ephemeralMsg.parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
          } catch {
            ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
          }
        }
        ephemeralMsg.parts.push({
          inlineData: { mimeType: f.mimeType, data: f.data }
        })
      }

      if (useAgentFile && selectedChat.agentFilePaths) {
        for (const p of selectedChat.agentFilePaths) {
          try {
            const fileBase64 = await window.electronAPI.readFileByPath(p)
            if (fileBase64) {
              const lower = p.toLowerCase()
              let derivedMime = 'application/octet-stream'
              if (lower.endsWith('.pdf')) derivedMime = 'application/pdf'
              else if (lower.endsWith('.txt')) derivedMime = 'text/plain'
              else if (lower.endsWith('.png')) derivedMime = 'image/png'
              else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) derivedMime = 'image/jpeg'
              else if (lower.endsWith('.gif')) derivedMime = 'image/gif'
              else if (lower.endsWith('.csv')) {
                try {
                  const csvString = window.atob(fileBase64)
                  const jsonStr = csvToJson(csvString)
                  ephemeralMsg.parts[0].text += `\nナレッジCSV→JSON:\n${jsonStr}`
                } catch {
                  ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
                }
                ephemeralMsg.parts.push({
                  inlineData: { mimeType: 'text/csv', data: fileBase64 }
                })
                continue
              }
              ephemeralMsg.parts.push({
                inlineData: { mimeType: derivedMime, data: fileBase64 }
              })
            }
          } catch (err) {
            console.error('readFileByPath error:', err)
          }
        }
      }

      const updatedChats = chats.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            messages: [...chat.messages, userMsg],
            postMessages: [...chat.postMessages, { role: 'user', parts: [{ text: inputMessage }] }],
            inputMessage: ''
          }
        }

        return chat
      })
      setChats(updatedChats)

      setInputMessage('')
      setTempFiles([])

      const ephemeralAll = [...selectedChat.postMessages, ephemeralMsg]
      const resp = await window.electronAPI.postChatAI(
        ephemeralAll,
        apiKey,
        selectedChat.systemPrompt
      )
      const aiMsg: Message = { type: 'ai', content: resp }

      const finalUpdated = updatedChats.map((chat) => {
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
    }
  }

  // -----------------------------
  // 新アシスタント作成モーダル
  // -----------------------------
  const openCustomChatModal = () => {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFiles([])
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
        この内容を要約してどのような事が出来るかをまとめます。
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
      assistantSummary: summaryText
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

  // -----------------------------
  // アシスタント削除
  // -----------------------------
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

  // -----------------------------
  // システムプロンプト編集
  // -----------------------------
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
          agentFilePaths: editingAgentFiles.map((f) => f.path)
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

  // -----------------------------
  // 会話リセット
  // -----------------------------
  function closeResetConfirm() {
    setIsResetConfirmOpen(false)
  }

  async function handleResetConversation() {
    closeResetConfirm()
    if (selectedChatId === 'autoAssist') {
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

  // -----------------------------
  // ユーザーメッセージ編集
  // -----------------------------
  const handleEditMessage = (msgIndex: number, oldContent: string) => {
    setEditIndex(msgIndex)
    setInputMessage(oldContent)
  }

  const selectedChatObj =
    typeof selectedChatId === 'number' ? chats.find((c) => c.id === selectedChatId) : null

  return (
    <Flex direction="column" h="100vh" bg="gray.100">
      {/* ヘッダー (背景画像 + タイトル) */}
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
        {/* タイトル (部分文字 + 色)、hoverで編集アイコン */}
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
              Version: {appVersion}
            </Text>
          </Box>

          {/* {selectedChatId === 'autoAssist' && (
            <HStack align="center">
              <Text fontSize="sm" color={headerBgDataUri ? 'white' : 'gray.600'}>
                エージェントモード
              </Text>
              <Switch
                isChecked={agentMode}
                onChange={(e) => setAgentMode(e.target.checked)}
                colorScheme="teal"
              />
            </HStack>
          )} */}

          <HStack spacing={4}>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ChatAIのAPI Key"
              type="password"
              size="md"
              isDisabled={isExpired}
              bgColor="white"
              w="300px"
            />
            <Button
              onClick={openCustomChatModal}
              colorScheme="teal"
              isDisabled={isExpired}
              minW="250px"
            >
              新しいアシスタントの作成
            </Button>
          </HStack>
        </HStack>
      </Flex>

      {/* メイン (左=アシスタント一覧, 右=チャット表示) */}
      <Flex as="main" flex="1" overflow="hidden" p={4}>
        {/* 左カラム */}
        <Box
          w="20%"
          bg="white"
          shadow="lg"
          rounded="lg"
          display="flex"
          flexDirection="column"
          minW="280px"
          mr={4}
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

          {/* アシスタント一覧 */}
          <Box overflowY="auto" flex="1">
            <List spacing={3} p={4}>
              {chats.map((chat) => {
                if (chat.id === AUTO_ASSIST_ID) return null

                return (
                  <ListItem
                    key={chat.id}
                    p={2}
                    bg={chat.id === selectedChatId ? 'blue.100' : 'white'}
                    borderRadius="md"
                    cursor="pointer"
                    onClick={() => handleSelectChat(chat.id)}
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    _hover={{ bg: chat.id === selectedChatId ? 'blue.100' : 'blue.50' }}
                  >
                    <Flex justify="space-between" align="center">
                      <Box>
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
                            maxW="200px"
                          >
                            {chat.customTitle || '無題のアシスタント'}
                          </Text>
                        </Tooltip>
                      </Box>

                      {chat.id === selectedChatId && (
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
              })}
            </List>
          </Box>
        </Box>

        {/* 右カラム (チャット表示) */}
        <Box w="80%" bg="white" shadow="lg" rounded="lg" display="flex" flexDirection="column">
          <Box ref={chatHistoryRef} flex="1" overflowY="auto" p={4}>
            {selectedChatId === 'autoAssist' ? (
              <>
                <Text fontWeight="bold" color="gray.600" mb={3}>
                  オートアシストモード
                </Text>
                {autoAssistMessages.map((msg, idx) => (
                  <Box
                    key={idx}
                    mb={4}
                    p={3}
                    rounded="lg"
                    bg={msg.type === 'user' ? 'gray.300' : 'gray.50'}
                    position="relative"
                    onMouseEnter={() => setHoveredMessageIndex(idx)}
                    onMouseLeave={() => setHoveredMessageIndex(null)}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    <div>
                      {msg.type === 'user' ? (
                        msg.content
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    {hoveredMessageIndex === idx && (
                      <Box position="absolute" top="4px" right="6px">
                        <HStack spacing={1}>
                          <IconButton
                            icon={<MdOutlineContentCopy />}
                            aria-label="コピー"
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content).then(() => {
                                toast({
                                  title: 'メッセージをコピーしました',
                                  status: 'info',
                                  duration: 1000,
                                  isClosable: true
                                })
                              })
                            }}
                          />
                          {msg.type === 'user' && (
                            <IconButton
                              icon={<FiEdit />}
                              aria-label="編集"
                              size="sm"
                              variant="ghost"
                              colorScheme="blue"
                              onClick={() => handleEditMessage(idx, msg.content)}
                            />
                          )}
                        </HStack>
                      </Box>
                    )}
                  </Box>
                ))}
              </>
            ) : selectedChatObj ? (
              selectedChatObj.messages.map((msg, idx) => (
                <Box
                  key={idx}
                  mb={4}
                  p={3}
                  rounded="lg"
                  bg={msg.type === 'user' ? 'gray.300' : 'gray.50'}
                  position="relative"
                  onMouseEnter={() => setHoveredMessageIndex(idx)}
                  onMouseLeave={() => setHoveredMessageIndex(null)}
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  <div>
                    {msg.type === 'user' ? (
                      msg.content
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {hoveredMessageIndex === idx && (
                    <Box position="absolute" top="4px" right="6px">
                      <HStack spacing={1}>
                        <IconButton
                          icon={<MdOutlineContentCopy />}
                          aria-label="コピー"
                          size="sm"
                          variant="ghost"
                          colorScheme="blue"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content).then(() => {
                              toast({
                                title: 'メッセージをコピーしました',
                                status: 'info',
                                duration: 1000,
                                isClosable: true
                              })
                            })
                          }}
                        />
                        {msg.type === 'user' && (
                          <IconButton
                            icon={<FiEdit />}
                            aria-label="編集"
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => handleEditMessage(idx, msg.content)}
                          />
                        )}
                      </HStack>
                    </Box>
                  )}
                </Box>
              ))
            ) : (
              <Text fontWeight="bold" color="gray.500">
                アシスタントを作成・選択して開始してください
              </Text>
            )}
          </Box>

          {/* 入力フォーム */}
          <Flex p={4} borderTop="1px" borderColor="gray.200" align="end">
            <HStack spacing={3} w="100%">
              <Textarea
                ref={chatInputRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                placeholder={
                  selectedChatId === 'autoAssist'
                    ? 'オートアシストに依頼する...'
                    : 'メッセージを入力...'
                }
                resize="vertical"
                flex="1"
                isDisabled={apiKey.length === 0 || isExpired}
              />

              {typeof selectedChatId === 'number' && (
                <Checkbox
                  isChecked={useAgentFile}
                  onChange={(e) => setUseAgentFile(e.target.checked)}
                  isDisabled={isExpired}
                >
                  ナレッジを使用する
                </Checkbox>
              )}
              {selectedChatId === 'autoAssist' && (
                <HStack align="center">
                  <Text fontSize="sm">エージェントモード</Text>
                  <Switch
                    isChecked={agentMode}
                    onChange={(e) => setAgentMode(e.target.checked)}
                    colorScheme="teal"
                  />
                </HStack>
              )}

              <IconButton
                icon={<LuPaperclip />}
                aria-label="ファイル添付"
                onClick={() => fileInputRef.current?.click()}
                isDisabled={apiKey.length === 0 || isExpired}
              />
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg,.gif,.csv"
                multiple
                onChange={handleTempFileChange}
                display="none"
              />

              <IconButton
                icon={<IoSend />}
                aria-label="送信"
                onClick={sendMessage}
                isLoading={isLoading}
                isDisabled={
                  apiKey.length === 0 ||
                  (inputMessage.length === 0 && tempFiles.length === 0) ||
                  isExpired
                }
              />
            </HStack>
          </Flex>

          {/* 選択ファイル一覧 */}
          {tempFiles.length > 0 && (
            <Box p={4} borderTop="1px" borderColor="gray.200">
              <Text fontSize="sm" color="gray.600" mb={2}>
                選択ファイル:
              </Text>
              {tempFiles.map((file) => (
                <Flex
                  key={file.name}
                  align="center"
                  justify="space-between"
                  mb={2}
                  p={2}
                  bg="gray.50"
                  borderRadius="md"
                >
                  <Text fontSize="sm" color="gray.800" mr={4}>
                    {file.name}
                  </Text>
                  <IconButton
                    icon={<AiOutlineDelete />}
                    aria-label="ファイル削除"
                    colorScheme="red"
                    size="sm"
                    onClick={() => handleTempFileDelete(file.name)}
                  />
                </Flex>
              ))}
            </Box>
          )}
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

      {/* リセット確認モーダル */}
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

      {/* オートアシスト設定モーダル -> リセット確認 */}
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

      {/* タイトル編集モーダル (背景画像対応済み) */}
      <TitleEditModal
        isOpen={isTitleEditOpen}
        onClose={() => setIsTitleEditOpen(false)}
        titleSettings={titleSettings}
        setTitleSettings={(val) => setTitleSettings(val)}
      />
    </Flex>
  )
}
