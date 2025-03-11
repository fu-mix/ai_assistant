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
  Switch
} from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { AiOutlineDelete } from 'react-icons/ai'
import { MdOutlineContentCopy } from 'react-icons/md'

/**
 * Electron API interface
 */
interface ElectronAPI {
  postChatAI: (message: Messages[], apiKey: string, systemPrompt: string) => Promise<any>
  loadAgents: () => Promise<ChatInfo[]>
  saveAgents: (agentsData: ChatInfo[]) => Promise<any>
  copyFileToUserData: () => Promise<string | null>
  readFileByPath: (filePath: string) => Promise<string | null>
  deleteFileInUserData: (filePath: string) => Promise<boolean>
}
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

/**
 * LLM用 Messages
 */
export type Messages = {
  role: string
  parts: [
    {
      text: string
    },
    { inline_data?: { mime_type: string; data: string } }?
  ]
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
  agentFilePath?: string
  assistantSummary?: string // "得意分野"などを保持
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

/**
 * デバッグ用: 要約編集モーダル
 * ※ 修正ポイント:
 *    - ID=999999(オートアシスト本体)はリストから除外
 *    - オートアシスト会話履歴のリセットボタンを追加
 */
function AutoAssistSettingsModal({
  isOpen,
  onClose,
  chats,
  setChats,
  onResetAutoAssist
}: {
  isOpen: boolean
  onClose: () => void
  chats: ChatInfo[]
  setChats: (c: ChatInfo[]) => void
  onResetAutoAssist: () => void
}) {
  const toast = useToast()
  const [localChats, setLocalChats] = useState<ChatInfo[]>([])

  // ★ 固定ID(オートアシスト用)
  const AUTO_ASSIST_ID = 999999

  useEffect(() => {
    if (isOpen) {
      // モーダルを開くときに chats をコピー
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
        <ModalHeader>オートアシスト設定 / 要約デバッグ</ModalHeader>
        <ModalBody>
          <Text mb={4} fontSize="sm" color="gray.600">
            各アシスタントの「得意分野要約」を確認・編集できます。
          </Text>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>アシスタント名</Th>
                <Th>要約(assistantSummary)</Th>
              </Tr>
            </Thead>
            <Tbody>
              {/** ID=999999(オートアシスト本体)を除外 */}
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

          {/* ★ オートアシスト会話履歴リセットボタン */}
          <Box mt={6} textAlign="center">
            <Button colorScheme="red" variant="outline" onClick={onResetAutoAssist}>
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

  // -----------------------------
  // オートアシスト関連state
  // -----------------------------
  const [autoAssistMessages, setAutoAssistMessages] = useState<Message[]>([])
  const [autoAssistState, setAutoAssistState] = useState<AutoAssistState>('idle')
  const [pendingSubtasks, setPendingSubtasks] = useState<SubtaskInfo[]>([])
  const [pendingEphemeralMsg, setPendingEphemeralMsg] = useState<Messages | null>(null)

  // ★ 固定ID(オートアシスト用)
  const AUTO_ASSIST_ID = 999999

  const [agentMode, setAgentMode] = useState<boolean>(false)

  // -----------------------------
  // 全チャット関連
  // -----------------------------
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null | 'autoAssist'>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [apiKey, setApiKey] = useState('')

  // ファイル添付
  const [tempFileName, setTempFileName] = useState<string | null>(null)
  const [tempFileData, setTempFileData] = useState<string | null>(null)
  const [tempFileMimeType, setTempFileMimeType] = useState<string | null>(null)

  // 新アシスタント作成モーダル
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalChatTitle, setModalChatTitle] = useState('')
  const [modalSystemPrompt, setModalSystemPrompt] = useState('')
  const [modalAgentFilePath, setModalAgentFilePath] = useState<string | null>(null)

  // システムプロンプト編集モーダル
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')

  // アシスタント削除モーダル
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  // 会話履歴リセット用
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  // 通常
  const [useAgentFile, setUseAgentFile] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null)
  const [isAutoAssistSettingsOpen, setIsAutoAssistSettingsOpen] = useState(false)

  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // -----------------------------
  // 初期ロード: chats読み込み
  // -----------------------------
  useEffect(() => {
    window.electronAPI.loadAgents().then((stored) => {
      if (Array.isArray(stored)) {
        const foundAuto = stored.find((c) => c.id === AUTO_ASSIST_ID)
        if (!foundAuto) {
          // オートアシスト用ChatInfoを新規作成
          const newAutoAssist: ChatInfo = {
            id: AUTO_ASSIST_ID,
            customTitle: 'AutoAssistSystem',
            systemPrompt: '',
            messages: [],
            postMessages: [],
            createdAt: new Date().toLocaleString(),
            inputMessage: ''
          }
          stored.push(newAutoAssist)
        }
        setChats(stored)
        // オートアシスト用 messages を state へ
        const auto = stored.find((c) => c.id === AUTO_ASSIST_ID)
        if (auto) {
          setAutoAssistMessages(auto.messages)
        }
      }
    })
  }, [])

  // -----------------------------
  // ライセンス期限チェック
  // -----------------------------
  useEffect(() => {
    const expiryDate = new Date(import.meta.env.VITE_EXPIRY_DATE)
    if (new Date().getTime() > expiryDate.getTime()) {
      setIsExpired(true)
    }
  }, [])

  // -----------------------------
  // チャット欄を常にスクロール最下部
  // -----------------------------
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [chats, selectedChatId, autoAssistMessages])

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
  // ファイル添付ハンドラ
  // -----------------------------
  const handleTempFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        const base64Data = reader.result.toString().split(',')[1]
        setTempFileData(base64Data)
        setTempFileName(file.name)

        const lower = file.name.toLowerCase()
        if (lower.endsWith('.pdf')) setTempFileMimeType('application/pdf')
        else if (lower.endsWith('.txt')) setTempFileMimeType('text/plain')
        else if (lower.endsWith('.png')) setTempFileMimeType('image/png')
        else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          setTempFileMimeType('image/jpeg')
        } else if (lower.endsWith('.gif')) {
          setTempFileMimeType('image/gif')
        } else if (lower.endsWith('.csv')) {
          setTempFileMimeType('text/csv')
        } else {
          setTempFileMimeType('application/octet-stream')
        }
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        const base64Data = reader.result.toString().split(',')[1]
        setTempFileData(base64Data)
        setTempFileName(file.name)

        const lower = file.name.toLowerCase()
        if (lower.endsWith('.pdf')) setTempFileMimeType('application/pdf')
        else if (lower.endsWith('.txt')) setTempFileMimeType('text/plain')
        else if (lower.endsWith('.png')) setTempFileMimeType('image/png')
        else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          setTempFileMimeType('image/jpeg')
        } else if (lower.endsWith('.gif')) {
          setTempFileMimeType('image/gif')
        } else if (lower.endsWith('.csv')) {
          setTempFileMimeType('text/csv')
        } else {
          setTempFileMimeType('application/octet-stream')
        }
      }
    }
    reader.readAsDataURL(file)
  }
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const handleTempFileDelete = () => {
    setTempFileName(null)
    setTempFileData(null)
    setTempFileMimeType(null)
  }

  // -----------------------------
  // 入力フォーム
  // -----------------------------
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

  // -----------------------------
  // handleSelectChat
  // -----------------------------
  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const target = chats.find((c) => c.id === id)
    if (target) {
      setInputMessage(target.inputMessage)
    }
  }

  // -----------------------------
  // executeSubtasksAndShowOnce
  // -----------------------------
  async function executeSubtasksAndShowOnce(subtasks: SubtaskInfo[]) {
    setAutoAssistState('executing')
    try {
      const subtaskOutputs: string[] = []
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        let out = ''

        if (!st.recommendedAssistant) {
          // fallback -> AutoAssist
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
          // recommended assistant
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

        subtaskOutputs.push(`
タスク${i + 1} : ${st.task}
(アシスタント: ${st.recommendedAssistant || 'AutoAssist/fallback'})
結果:
${out}
`)
      }

      const finalMerged = `以下が最終的な実行結果です:\n${subtaskOutputs.join('\n')}`
      setAutoAssistMessages((prev) => [...prev, { type: 'ai', content: finalMerged }])
    } finally {
      setPendingSubtasks([])
      setPendingEphemeralMsg(null)
      setAutoAssistState('idle')
    }
  }

  // -----------------------------
  // removeCodeFence
  // -----------------------------
  function removeCodeFence(str: string): string {
    return str.replaceAll('```json', '').replaceAll('```', '').trim()
  }

  // -----------------------------
  // findAssistantsForEachTask
  // -----------------------------
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
        const cleanResp = removeCodeFence(resp)
        const parsed = JSON.parse(cleanResp)
        recommended = parsed.assistantTitle ?? null
      } catch (err) {
        recommended = null
      }

      output.push({ task: cleanTask, recommendedAssistant: recommended })
    }

    return output
  }

  // -----------------------------
  // handleAutoAssistSend
  //   修正: 重複メッセージ追加を削除
  // -----------------------------
  async function handleAutoAssistSend() {
    setIsLoading(true)
    try {
      // ephemeralMsg
      const ephemeralMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }
      if (tempFileData && tempFileMimeType) {
        ephemeralMsg.parts.push({
          inline_data: {
            mime_type: tempFileMimeType,
            data: tempFileData
          }
        })
      }

      // タスク分割プロンプト
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
      const splittedRaw = removeCodeFence(parseResp)
      let splitted: string[] = []
      try {
        splitted = JSON.parse(splittedRaw)
      } catch (err) {
        splitted = [inputMessage]
      }

      setPendingEphemeralMsg(ephemeralMsg)

      const subtaskInfos = await findAssistantsForEachTask(splitted)
      setPendingSubtasks(subtaskInfos)

      // 表示
      const lines = subtaskInfos.map(
        (si, idx) =>
          `タスク${idx + 1} : ${si.task}\n→ 推奨アシスタント : ${si.recommendedAssistant}`
      )
      const summaryMsg = `以下のタスクに分割し、推奨アシスタントを割り当てました:\n\n${lines.join('\n\n')}`
      setAutoAssistMessages((prev) => [...prev, { type: 'ai', content: summaryMsg }])

      // storeにも "AIメッセージ" を追加
      const updatedStore = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [...c.messages, { type: 'ai', content: summaryMsg }]
          }
        }

        return c
      })
      setChats(updatedStore)
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
        setChats(updated2)
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
              { type: 'ai', content: 'タスク分割処理中にエラーが発生しました。' }
            ]
          }
        }

        return c
      })
      setChats(updatedErr)
      await window.electronAPI.saveAgents(updatedErr)
    } finally {
      setInputMessage('')
      setTempFileName(null)
      setTempFileData(null)
      setTempFileMimeType(null)
      setIsLoading(false)
    }
  }

  // -----------------------------
  // sendMessage
  // -----------------------------
  async function sendMessage() {
    if (!inputMessage.trim() && !tempFileData) return
    if (!apiKey) {
      toast({
        title: 'API Keyが未入力です',
        status: 'warning',
        duration: 2000,
        isClosable: true
      })

      return
    }

    // autoAssist Yes/No
    if (selectedChatId === 'autoAssist' && autoAssistState === 'awaitConfirm') {
      const ans = inputMessage.trim().toLowerCase()

      // 先にユーザー発言をautoAssistMessagesに追加 + store反映
      const userMsg: Message = { type: 'user', content: inputMessage }
      setAutoAssistMessages((prev) => [...prev, userMsg])
      let updated = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [...c.messages, userMsg]
          }
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
          { type: 'ai', content: 'タスク実行をキャンセルしました。' }
        ])
        updated = updated.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [...c.messages, { type: 'ai', content: 'タスク実行をキャンセルしました。' }]
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
          { type: 'ai', content: 'Yes で実行 / No でキャンセル です。' }
        ])
        updated = updated.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [
                ...c.messages,
                { type: 'ai', content: 'Yes で実行 / No でキャンセル です。' }
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

    // autoAssist start
    if (selectedChatId === 'autoAssist') {
      // ユーザーメッセージを追加 (handleAutoAssistSendでは追加しない)
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
      await handleAutoAssistSend()
      setIsLoading(false)

      return
    }

    // 通常アシスタント
    const selectedChat = chats.find((c) => c.id === selectedChatId)
    if (!selectedChat) return

    setIsLoading(true)
    try {
      const userMsg: Message = { type: 'user', content: inputMessage }
      const ephemeralMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      if (tempFileData && tempFileMimeType) {
        if (tempFileMimeType === 'text/csv') {
          try {
            const csvString = window.atob(tempFileData)
            const jsonStr = csvToJson(csvString)
            ephemeralMsg.parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
          } catch (err) {
            ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
          }
        } else {
          ephemeralMsg.parts.push({
            inline_data: { mime_type: tempFileMimeType, data: tempFileData }
          })
        }
      }

      if (useAgentFile && selectedChat.agentFilePath) {
        try {
          const fileBase64 = await window.electronAPI.readFileByPath(selectedChat.agentFilePath)
          if (fileBase64) {
            const pathLower = selectedChat.agentFilePath.toLowerCase()
            let derivedMime = 'application/octet-stream'
            if (pathLower.endsWith('.pdf')) derivedMime = 'application/pdf'
            else if (pathLower.endsWith('.txt')) derivedMime = 'text/plain'
            else if (pathLower.endsWith('.png')) derivedMime = 'image/png'
            else if (pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg')) {
              derivedMime = 'image/jpeg'
            } else if (pathLower.endsWith('.gif')) {
              derivedMime = 'image/gif'
            } else if (pathLower.endsWith('.csv')) {
              try {
                const csvString = window.atob(fileBase64)
                const jsonStr = csvToJson(csvString)
                ephemeralMsg.parts[0].text += `\n関連CSV→JSON:\n${jsonStr}`
              } catch (err) {
                ephemeralMsg.parts[0].text += '\n(CSV→JSON失敗)'
              }
            } else {
              ephemeralMsg.parts.push({
                inline_data: { mime_type: derivedMime, data: fileBase64 }
              })
            }
          }
        } catch (err) {
          console.error('readFileByPath error:', err)
        }
      }

      const updated = chats.map((chat) => {
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
      setChats(updated)
      setInputMessage('')
      setTempFileName(null)
      setTempFileData(null)
      setTempFileMimeType(null)

      const ephemeralAll = [...selectedChat.postMessages, ephemeralMsg]
      const resp = await window.electronAPI.postChatAI(
        ephemeralAll,
        apiKey,
        selectedChat.systemPrompt
      )
      const aiMsg: Message = { type: 'ai', content: resp }

      const finalUpdated = updated.map((chat) => {
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

  // --------------------------
  // 新アシスタント作成モーダル
  // --------------------------
  function openCustomChatModal() {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFilePath(null)
    setIsModalOpen(true)
  }
  function closeCustomChatModal() {
    setIsModalOpen(false)
  }
  async function handleSelectAgentFile() {
    const copiedPath = await window.electronAPI.copyFileToUserData()
    if (copiedPath) {
      setModalAgentFilePath(copiedPath)
    } else {
      toast({
        title: 'ファイルが選択されませんでした',
        status: 'info',
        duration: 2000,
        isClosable: true
      })
    }
  }
  async function handleCreateCustomChat() {
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
          parts: [
            {
              text: `${modalSystemPrompt}`
            }
          ]
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
      agentFilePath: modalAgentFilePath || undefined,
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

  // --------------------------
  // アシスタント削除
  // --------------------------
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

    if (target.agentFilePath) {
      try {
        await window.electronAPI.deleteFileInUserData(target.agentFilePath)
      } catch (err) {
        console.error('Failed to delete userData file:', err)
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

  // --------------------------
  // システムプロンプト編集
  // --------------------------
  function openSystemPromptModal() {
    if (typeof selectedChatId !== 'number') return
    const sc = chats.find((c) => c.id === selectedChatId)
    if (!sc) return
    setEditingSystemPrompt(sc.systemPrompt)
    setIsPromptModalOpen(true)
  }
  function closeSystemPromptModal() {
    setIsPromptModalOpen(false)
  }
  function handleSaveSystemPrompt() {
    if (typeof selectedChatId !== 'number') return
    const sc = chats.find((c) => c.id === selectedChatId)
    if (!sc) return
    const updated = chats.map((chat) => {
      if (chat.id === selectedChatId) {
        return { ...chat, systemPrompt: editingSystemPrompt }
      }

      return chat
    })
    setChats(updated)
    window.electronAPI.saveAgents(updated).catch(console.error)
    toast({
      title: 'アシスタント指示を更新しました',
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

  function openResetConfirm() {
    setIsResetConfirmOpen(true)
  }
  function closeResetConfirm() {
    setIsResetConfirmOpen(false)
  }
  async function handleResetConversation() {
    closeResetConfirm()

    if (selectedChatId === 'autoAssist') {
      // オートアシストリセット
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
      // 通常アシスタント
      const updated = chats.map((c) => {
        if (c.id === selectedChatId) {
          return {
            ...c,
            messages: [],
            postMessages: [],
            inputMessage: ''
          }
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

  async function handleChangeFileInPromptModal() {
    if (typeof selectedChatId !== 'number') return
    const sc = chats.find((c) => c.id === selectedChatId)
    if (!sc) return

    if (sc.agentFilePath) {
      try {
        await window.electronAPI.deleteFileInUserData(sc.agentFilePath)
      } catch (err) {
        console.error('Failed to delete old file:', err)
      }
    }
    const newPath = await window.electronAPI.copyFileToUserData()
    if (!newPath) {
      toast({
        title: 'ファイルが選択されませんでした',
        status: 'info',
        duration: 2000,
        isClosable: true
      })

      return
    }
    const updated = chats.map((chat) => {
      if (chat.id === selectedChatId) {
        return { ...chat, agentFilePath: newPath }
      }

      return chat
    })
    setChats(updated)
    window.electronAPI.saveAgents(updated).catch(console.error)
    toast({
      title: '関連ファイルを変更しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
  }

  // ★ オートアシスト設定モーダル内の「オートアシスト会話履歴リセット」ボタン押下時
  const handleResetAutoAssistFromModal = async () => {
    // AUTO_ASSIST_IDの会話を消す
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

  const selectedChat =
    typeof selectedChatId === 'number' ? chats.find((c) => c.id === selectedChatId) : null

  return (
    <Flex direction="column" h="100vh" bg="gray.100">
      {/* ヘッダー */}
      <Flex
        as="header"
        bg="white"
        borderBottom="1px"
        borderColor="gray.200"
        p={4}
        justify="space-between"
        align="center"
      >
        <HStack spacing={8}>
          <Heading as="h1" size="lg" fontWeight="extrabold" color="gray.800">
            DesAIn Assistant
          </Heading>

          {/* ★ エージェントモード: オートアシストのときだけ表示 */}
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
        </HStack>

        <HStack spacing={4}>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ChatAIのAPI Key"
            type="password"
            size="md"
            isDisabled={isExpired}
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
      </Flex>

      {/* メイン */}
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
          <Box overflowY="auto" flex="1">
            <List spacing={3} p={4}>
              {/* オートアシスト */}
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
                <Text fontSize="md" fontWeight="bold">
                  オートアシスト
                </Text>
                <Text fontSize="xs" color="gray.500">
                  自動で最適アシスタントを提案
                </Text>
              </ListItem>

              {/* 通常アシスタント一覧 */}
              {chats.map((chat) => {
                if (chat.id === AUTO_ASSIST_ID) {
                  // オートアシスト用はリストに表示しない
                  return null
                }

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
                        <Text fontSize="xs" color="gray.500">
                          {chat.createdAt}
                        </Text>
                        <Text
                          fontSize="md"
                          fontWeight="bold"
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          maxW="220px"
                        >
                          {chat.customTitle || '無題のアシスタント'}
                        </Text>
                      </Box>

                      {/* アシスタント削除 */}
                      {chat.id === selectedChatId && (
                        <IconButton
                          icon={<AiOutlineDelete />}
                          aria-label="アシスタント削除"
                          variant="ghost"
                          colorScheme="red"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTargetId(chat.id)
                            setIsDeleteModalOpen(true)
                          }}
                        />
                      )}
                    </Flex>
                  </ListItem>
                )
              })}
            </List>
          </Box>
        </Box>

        {/* 右カラム(チャット表示) */}
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
                    {msg.type === 'user' ? (
                      <div>{msg.content}</div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">
                        {msg.content}
                      </ReactMarkdown>
                    )}
                    {hoveredMessageIndex === idx && (
                      <IconButton
                        icon={<MdOutlineContentCopy />}
                        aria-label="コピー"
                        size="sm"
                        position="absolute"
                        top="4px"
                        right="6px"
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
                    )}
                  </Box>
                ))}
              </>
            ) : selectedChat ? (
              selectedChat.messages.map((msg, idx) => (
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
                  {msg.type === 'user' ? (
                    <div>{msg.content}</div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                  {hoveredMessageIndex === idx && (
                    <IconButton
                      icon={<MdOutlineContentCopy />}
                      aria-label="コピー"
                      size="sm"
                      position="absolute"
                      top="4px"
                      right="6px"
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
                  )}
                </Box>
              ))
            ) : (
              <Text fontWeight="bold" color="gray.500">
                アシスタントを作成して開始してください
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
                  関連ファイル
                </Checkbox>
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
                onChange={handleTempFileChange}
                display="none"
              />

              <IconButton
                icon={<LuSettings />}
                aria-label="設定"
                isDisabled={isExpired}
                onClick={() => {
                  if (selectedChatId === 'autoAssist') {
                    setIsAutoAssistSettingsOpen(true)
                  } else if (typeof selectedChatId === 'number') {
                    openSystemPromptModal()
                  }
                }}
              />
              <IconButton
                icon={<IoSend />}
                aria-label="送信"
                onClick={sendMessage}
                isLoading={isLoading}
                isDisabled={apiKey.length === 0 || inputMessage.length === 0 || isExpired}
              />
            </HStack>
          </Flex>

          {tempFileName && (
            <Box p={4} borderTop="1px" borderColor="gray.200" display="flex" alignItems="center">
              <Text flex="1" fontSize="sm" color="gray.500">
                選択ファイル: {tempFileName}
              </Text>
              <IconButton
                icon={<AiOutlineDelete />}
                aria-label="ファイル削除"
                colorScheme="red"
                onClick={handleTempFileDelete}
              />
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
      <Modal isOpen={isModalOpen} onClose={closeCustomChatModal} isCentered>
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
              <FormLabel>指示(System Prompt)</FormLabel>
              <Textarea
                rows={5}
                w="full"
                value={modalSystemPrompt}
                onChange={(e) => setModalSystemPrompt(e.target.value)}
                placeholder="アシスタントの役割や口調などを指定"
              />
            </FormControl>

            <FormControl>
              <FormLabel>関連ファイル (任意)</FormLabel>
              <Button colorScheme="blue" variant="outline" onClick={handleSelectAgentFile}>
                ファイルを選択
              </Button>
              {modalAgentFilePath && (
                <Text fontSize="sm" color="gray.600" mt={2}>
                  コピー先: {modalAgentFilePath}
                </Text>
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
      <Modal isOpen={isPromptModalOpen} onClose={closeSystemPromptModal} isCentered>
        <ModalOverlay />
        <ModalContent maxW="3xl">
          <ModalHeader>アシスタント指示の編集</ModalHeader>
          <ModalBody>
            <FormControl>
              <FormLabel>指示(System Prompt)</FormLabel>
              <Textarea
                rows={6}
                value={editingSystemPrompt}
                onChange={(e) => setEditingSystemPrompt(e.target.value)}
                placeholder="アシスタントへの指示を入力/編集"
                height="500px"
              />
            </FormControl>
            <HStack spacing={2} mt={3}>
              <Button variant="outline" colorScheme="blue" onClick={handleCopySystemPrompt}>
                コピー
              </Button>
            </HStack>

            {selectedChat && (
              <FormControl mt={5}>
                <FormLabel>関連ファイルの変更</FormLabel>
                <Button
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleChangeFileInPromptModal}
                >
                  新しいファイルを選択
                </Button>
                {selectedChat.agentFilePath && (
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    現在のファイル: {selectedChat.agentFilePath}
                  </Text>
                )}
              </FormControl>
            )}

            {/* 会話履歴リセットボタン */}
            {selectedChatId && (
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
        onResetAutoAssist={handleResetAutoAssistFromModal}
      />
    </Flex>
  )
}
