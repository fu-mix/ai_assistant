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
  Select,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Radio,
  RadioGroup,
  VStack
} from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { AiOutlineDelete } from 'react-icons/ai'
import { MdOutlineContentCopy } from 'react-icons/md'
import { FiEdit } from 'react-icons/fi'
import { HamburgerIcon } from '@chakra-ui/icons'

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
 * オートアシスト: タスク分解結果
 */
type SubtaskInfo = {
  task: string
  recommendedAssistant: string | null
}

/* ------------------------------------------------
 * タイトル編集モーダル
 * ------------------------------------------------ */
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

  // ローカルステート
  const [tempSegments, setTempSegments] = useState<TitleSegment[]>([])
  const [tempFont, setTempFont] = useState<string>('Arial')
  const [tempBackgroundPath, setTempBackgroundPath] = useState<string | undefined>(undefined)

  const fontOptions = ['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New']

  // デフォルトタイトル (DesAIn Assistant)
  const defaultSegments: TitleSegment[] = [
    { text: 'D', color: '#ff6600' },
    { text: 'es', color: '#333333' },
    { text: 'AI', color: '#dd5588' },
    { text: 'n ', color: '#333333' },
    { text: 'A', color: '#ffd700' },
    { text: 'ssistant', color: '#333333' }
  ]
  const defaultFont = 'Arial'

  // モーダルを開くたびに既存の設定をコピー
  useEffect(() => {
    if (isOpen) {
      setTempSegments(JSON.parse(JSON.stringify(titleSettings.segments)))
      setTempFont(titleSettings.fontFamily)
      setTempBackgroundPath(titleSettings.backgroundImagePath)
    }
  }, [isOpen, titleSettings])

  const addSegment = () => {
    setTempSegments((prev) => [...prev, { text: '', color: '#000000' }])
  }

  const removeSegment = (idx: number) => {
    setTempSegments((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateSegmentText = (idx: number, newVal: string) => {
    setTempSegments((prev) => prev.map((seg, i) => (i === idx ? { ...seg, text: newVal } : seg)))
  }

  const updateSegmentColor = (idx: number, newColor: string) => {
    setTempSegments((prev) => prev.map((seg, i) => (i === idx ? { ...seg, color: newColor } : seg)))
  }

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

  const handleSelectBackgroundImage = async () => {
    try {
      // 既に背景画像があれば削除
      if (tempBackgroundPath) {
        await window.electronAPI.deleteFileInUserData(tempBackgroundPath)
      }
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

  const handleRemoveBackgroundImage = async () => {
    if (!tempBackgroundPath) return
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

  const handleSaveTitle = async () => {
    const newSettings: TitleSettings = {
      segments: tempSegments,
      fontFamily: tempFont,
      backgroundImagePath: tempBackgroundPath
    }
    setTitleSettings(newSettings)

    // Electron側へ保存
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

          <FormControl mt={4} mb={6}>
            <Button colorScheme="orange" variant="outline" onClick={handleRevertDefault}>
              デフォルトに戻す
            </Button>
          </FormControl>

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

/* ------------------------------------------------
 * オートアシスト設定モーダル
 * ------------------------------------------------ */
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

/* ------------------------------------------------
 * ExportModal: 一部 or 全部 のエクスポート
 *    ※「会話履歴を含める」チェックボックスを追加
 * ------------------------------------------------ */
function ExportModal({
  isOpen,
  onClose,
  chats
}: {
  isOpen: boolean
  onClose: () => void
  chats: ChatInfo[]
}) {
  const toast = useToast()
  const [mode, setMode] = useState<'all' | 'partial'>('all')
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  // ▼ ここで追加: 「会話履歴を含める」チェック (デフォルトtrue)
  const [includeHistory, setIncludeHistory] = useState<boolean>(true)

  useEffect(() => {
    if (isOpen) {
      setMode('all')
      setCheckedIds([])
      setIncludeHistory(true)
    }
  }, [isOpen])

  const handleToggleCheck = (id: number) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleExport = async () => {
    if (!window.electronAPI.exportSelectedAgents) {
      toast({
        title: 'エラー',
        description: '部分エクスポート機能が見つかりません',
        status: 'error',
        duration: 3000,
        isClosable: true
      })

      return
    }

    try {
      if (mode === 'all') {
        // 全部エクスポート -> 既存 showSaveDialog
        if (window.electronAPI.showSaveDialog) {
          await window.electronAPI.showSaveDialog('config.json')
        }
      } else {
        // 一部
        if (checkedIds.length === 0) {
          toast({
            title: 'アシスタントが選択されていません',
            status: 'warning',
            duration: 2000,
            isClosable: true
          })

          return
        }
        // 新IPC
        // ここで「includeHistory」も一緒に渡す
        await window.electronAPI.exportSelectedAgents({
          selectedIds: checkedIds,
          includeHistory
        })
      }

      toast({
        title: 'エクスポート完了',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
      onClose()
    } catch (err) {
      console.error('Export error:', err)
      toast({
        title: 'エラー',
        description: 'エクスポート中にエラーが発生しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>データのエクスポート</ModalHeader>
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>エクスポート対象</FormLabel>
            <RadioGroup value={mode} onChange={(val) => setMode(val as 'all' | 'partial')}>
              <HStack spacing={5}>
                <Radio value="all">全て(全アシスタント、タイトル設定)</Radio>
                <Radio value="partial">一部のアシスタント</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>

          {mode === 'partial' && (
            <>
              <Box
                border="1px solid #ddd"
                borderRadius="md"
                p={3}
                maxH="300px"
                overflowY="auto"
                mt={2}
                mb={2}
              >
                {/* オートアシストは含む・含まないはお好みだが、ここでは除外例示 */}
                {chats
                  .filter((c) => c.id !== 999999)
                  .map((chat) => (
                    <HStack key={chat.id} mb={2}>
                      <Checkbox
                        isChecked={checkedIds.includes(chat.id)}
                        onChange={() => handleToggleCheck(chat.id)}
                      >
                        {chat.customTitle}
                      </Checkbox>
                    </HStack>
                  ))}
              </Box>

              {/* ▼ 追加のチェックボックス */}
              <FormControl display="flex" alignItems="center" mb={2}>
                <Checkbox
                  isChecked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                >
                  会話履歴を含める
                </Checkbox>
              </FormControl>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button mr={3} onClick={onClose}>
            キャンセル
          </Button>
          <Button colorScheme="blue" onClick={handleExport}>
            エクスポート
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

/* ------------------------------------------------
 * ImportModeModal: "全部置き換え" or "追加" 選択
 * ------------------------------------------------ */
function ImportModeModal({
  isOpen,
  onClose,
  importedRaw,
  onReplace,
  onAppend
}: {
  isOpen: boolean
  onClose: () => void
  importedRaw: string | null
  onReplace: (raw: string) => void
  onAppend: (raw: string) => void
}) {
  const toast = useToast()

  const handleReplace = () => {
    if (!importedRaw) {
      toast({
        title: 'エラー',
        description: 'インポートデータがありません',
        status: 'error',
        duration: 2000,
        isClosable: true
      })

      return
    }
    onReplace(importedRaw)
    onClose()
  }

  const handleAppend = () => {
    if (!importedRaw) {
      toast({
        title: 'エラー',
        description: 'インポートデータがありません',
        status: 'error',
        duration: 2000,
        isClosable: true
      })

      return
    }
    onAppend(importedRaw)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>インポート方法</ModalHeader>
        <ModalBody>
          <Text mb={3}>読み込んだデータをどのように適用しますか？</Text>
          <VStack align="stretch" spacing={3}>
            <Button colorScheme="teal" variant="outline" onClick={handleAppend}>
              既存のアシスタントに追加する
            </Button>
            <Button colorScheme="blue" variant="outline" onClick={handleReplace}>
              すべて消して置き換える(リストア)
            </Button>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>キャンセル</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

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

/* ------------------------------------------------
 * メインコンポーネント
 * ------------------------------------------------ */
export const FinalRefinedElectronAppMockup = () => {
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
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null)
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
  useEffect(() => {
    let currentMsgCount = 0
    if (selectedChatId === 'autoAssist') {
      currentMsgCount = autoAssistMessages.length
    } else if (typeof selectedChatId === 'number') {
      const found = chats.find((c) => c.id === selectedChatId)
      if (found) {
        currentMsgCount = found.messages.length
      }
    }

    if (currentMsgCount > prevMessageCountRef.current) {
      if (chatHistoryRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
      }
    }
    prevMessageCountRef.current = currentMsgCount
  }, [chats, selectedChatId, autoAssistMessages])

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

  // --------------------------------
  // ファイル添付(チャット用)
  // --------------------------------
  const handleTempFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileNum = files.length
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
      if (!inputMessage.trim()) {
        return
      }
      sendMessage()
    }
  }

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
      // ユーザーメッセージを作成
      const userMsg: Message = { type: 'user', content: inputMessage }
      let currentUpdatedChats = [...chats] // 現在のチャット状態をコピー

      // skipAddingUserMessageがfalseの場合のみユーザーメッセージを追加
      if (!skipAddingUserMessage) {
        // UIに表示
        setAutoAssistMessages((prev) => [...prev, userMsg])

        // postMessages用のメッセージ形式を作成
        const postUserMsg: Messages = {
          role: 'user',
          parts: [{ text: inputMessage }]
        }

        // chatsのオートアシストにユーザーメッセージを追加
        currentUpdatedChats = chats.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [...c.messages, userMsg],
              postMessages: [...c.postMessages, postUserMsg],
              inputMessage: ''
            }
          }

          return c
        })

        // 状態と永続化を更新
        setChats(currentUpdatedChats)
        // 保存を実行
        await window.electronAPI.saveAgents(currentUpdatedChats)
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

      // AIメッセージをmessages用に作成 (ユーザーメッセージはすでに追加済みなので、AIメッセージだけを追加)
      const aiMsg: Message = { type: 'ai', content: summaryMsg }
      setAutoAssistMessages((prev) => [...prev, aiMsg])

      // postMessages用のメッセージも作成
      const postAiMsg: Messages = {
        role: 'model',
        parts: [{ text: summaryMsg }]
      }

      // 最新の更新されたチャット状態を使用
      const updatedWithAIMessage = currentUpdatedChats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [...c.messages, aiMsg],
            postMessages: [...c.postMessages, postAiMsg]
          }
        }

        return c
      })

      setChats(updatedWithAIMessage)
      // 保存実行
      await window.electronAPI.saveAgents(updatedWithAIMessage)

      if (agentMode) {
        // エージェントモードON時は originalMsg を直接渡す
        await executeSubtasksAndShowOnce(subtaskInfos, originalMsg)
      } else {
        setAutoAssistState('awaitConfirm')

        // 確認メッセージをmessages用に作成
        const confirmMsg = '実行しますか？ (Yesで実行 / Noでキャンセル)'
        const confirmAiMsg: Message = { type: 'ai', content: confirmMsg }
        setAutoAssistMessages((prev) => [...prev, confirmAiMsg])

        // postMessages用のメッセージも作成
        const postConfirmMsg: Messages = {
          role: 'model',
          parts: [{ text: confirmMsg }]
        }

        const updatedWithConfirm = updatedWithAIMessage.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [...c.messages, confirmAiMsg],
              postMessages: [...c.postMessages, postConfirmMsg]
            }
          }

          return c
        })

        setChats(updatedWithConfirm)
        // 保存実行
        await window.electronAPI.saveAgents(updatedWithConfirm)
      }
    } catch (err) {
      console.error('handleAutoAssistSend error:', err)

      // エラーメッセージをmessages用に作成
      const errorMsg = 'タスク分割処理中にエラーが発生しました。'
      const errorAiMsg: Message = { type: 'ai', content: errorMsg }
      setAutoAssistMessages((prev) => [...prev, errorAiMsg])

      // postMessages用のエラーメッセージも作成
      const postErrorMsg: Messages = {
        role: 'model',
        parts: [{ text: errorMsg }]
      }

      const updatedWithError = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [...c.messages, errorAiMsg],
            postMessages: [...c.postMessages, postErrorMsg]
          }
        }

        return c
      })

      setChats(updatedWithError)
      await window.electronAPI.saveAgents(updatedWithError)
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

      // messages用のAIメッセージを作成
      const finalAiMsg: Message = { type: 'ai', content: finalMerged }
      setAutoAssistMessages((prev) => [...prev, finalAiMsg])

      // postMessages用のメッセージも作成
      const postFinalMsg: Messages = {
        role: 'model',
        parts: [{ text: finalMerged }]
      }

      // 最終結果を保存する処理
      const updatedChats = chats.map((c) => {
        if (c.id === AUTO_ASSIST_ID) {
          return {
            ...c,
            messages: [...c.messages, finalAiMsg],
            // postMessagesにも最終結果を追加
            postMessages: [...c.postMessages, postFinalMsg]
          }
        }

        return c
      })

      setChats(updatedChats as ChatInfo[])
      // 保存が確実に完了するのを待つ
      await window.electronAPI.saveAgents(updatedChats)
    } finally {
      setPendingSubtasks([])
      setPendingEphemeralMsg(null)
      setAutoAssistState('idle')
    }
  }

  // --------------------------------
  // sendMessage本体
  // --------------------------------

  async function sendMessage() {
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
        // 3. 現在のチャット状態をコピー
        let currentChats = [...chats]

        // 4. ユーザーメッセージを追加
        const updatedWithUserMsg = currentChats.map((c) => {
          if (c.id === AUTO_ASSIST_ID) {
            return {
              ...c,
              messages: [...c.messages, userMsg],
              postMessages: [...c.postMessages, postUserMsg],
              inputMessage: '' // 明示的にクリアする
            }
          }

          return c
        })

        // 5. 状態を更新して保存（ユーザーメッセージ分）
        setChats(updatedWithUserMsg)

        // 6. 保存処理の完了を待機
        await window.electronAPI.saveAgents(updatedWithUserMsg)

        // 7. 処理後の状態を保持するための変数を更新
        currentChats = updatedWithUserMsg

        if (ans === 'yes') {
          setIsLoading(true)

          // Yes応答の後、タスク実行前に現在の状態を確実に保存
          await window.electronAPI.saveAgents(currentChats)

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

          // 最新の状態に基づいて更新
          const updatedWithCancel = currentChats.map((c) => {
            if (c.id === AUTO_ASSIST_ID) {
              return {
                ...c,
                messages: [...c.messages, cancelAiMsg],
                postMessages: [...c.postMessages, postCancelMsg]
              }
            }

            return c
          })

          // 状態を更新して保存
          setChats(updatedWithCancel)
          await window.electronAPI.saveAgents(updatedWithCancel)

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

          // 最新の状態に基づいて更新
          const updatedWithUnknown = currentChats.map((c) => {
            if (c.id === AUTO_ASSIST_ID) {
              return {
                ...c,
                messages: [...c.messages, unknownAiMsg],
                postMessages: [...c.postMessages, postUnknownMsg]
              }
            }

            return c
          })

          // 状態を更新して保存
          setChats(updatedWithUnknown)
          await window.electronAPI.saveAgents(updatedWithUnknown)

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

        // 再実行
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

    // (通常) 新規メッセージ
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
                ephemeralMsg.parts.push({ inlineData: { mimeType: 'text/csv', data: fileBase64 } })
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

  // --------------------------------
  // 会話リセット
  // --------------------------------
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

  // --------------------------------
  // ユーザーメッセージ編集
  // --------------------------------
  const handleEditMessage = (msgIndex: number, oldContent: string) => {
    setEditIndex(msgIndex)
    setInputMessage(oldContent)
  }

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

  // --------------------------------
  // JSX
  // --------------------------------
  const selectedChatObj =
    typeof selectedChatId === 'number' ? chats.find((c) => c.id === selectedChatId) : null

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
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ChatAIのAPI Key"
              type="password"
              size="md"
              isDisabled={isExpired}
              bgColor="white"
              w="200px"
            />
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
              </MenuList>
            </Menu>
          </HStack>
        </HStack>
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
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxWidth: '100%',
                      overflow: 'hidden'
                    }}
                  >
                    <div>
                      {msg.type === 'user' ? (
                        msg.content
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="markdown"
                          components={{
                            pre: ({ node, ...props }) => (
                              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                                <pre {...props} />
                              </div>
                            ),
                            code: ({ node, ...props }) => (
                              <code
                                style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                                {...props}
                              />
                            ),
                            table: ({ node, ...props }) => (
                              <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                                <table {...props} />
                              </div>
                            )
                          }}
                        >
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
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxWidth: '100%',
                    overflow: 'hidden'
                  }}
                >
                  <div>
                    {msg.type === 'user' ? (
                      msg.content
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        className="markdown"
                        components={{
                          pre: ({ node, ...props }) => (
                            <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                              <pre {...props} />
                            </div>
                          ),
                          code: ({ node, ...props }) => (
                            <code
                              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                              {...props}
                            />
                          ),
                          table: ({ node, ...props }) => (
                            <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                              <table {...props} />
                            </div>
                          )
                        }}
                      >
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
                  isDisabled={isLoading || isExpired}
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
                    isDisabled={isLoading || isExpired}
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
                  apiKey.length === 0 || isLoading || inputMessage.length === 0 || isExpired
                }
              />
            </HStack>
          </Flex>

          {/* 添付ファイル一覧 */}
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
