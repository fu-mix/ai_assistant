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
  FormLabel
} from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { AiOutlineDelete } from 'react-icons/ai'

/**
 * ElectronAPI の型定義
 * preload/index.ts で expose しているメソッドを合わせる
 */
interface ElectronAPI {
  postChatAI: (message: Messages[], apiKey: string, systemPrompt: string) => Promise<any>
  readKnowledgeFiles: (knowledgeFiles: string[]) => Promise<any>
  readKnowledgeFile: (knowledgeFile: string) => Promise<any>
  readPromptFile: (pipeline: string, usecase: string) => Promise<any>

  // ★ 追加: loadAgents / saveAgents
  loadAgents: () => Promise<ChatInfo[]>
  saveAgents: (agentsData: ChatInfo[]) => Promise<any>
}

// declare globalへ
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

type Message = {
  type: string
  content: string
}

export type Messages = {
  role: string
  parts: [{ text: string }, { inline_data?: { mime_type: string; data: string } }?]
}

// ★ 各エージェント(チャット)情報
type ChatInfo = {
  id: number
  customTitle: string
  systemPrompt: string
  messages: Message[]
  postMessages: Messages[]
  createdAt: string
  inputMessage: string

  agentFileData?: string
  agentFileMimeType?: string
}

export const FinalRefinedElectronAppMockup = () => {
  const toast = useToast()

  // -------------------------------------------------------
  // ステート
  // -------------------------------------------------------
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [apiKey, setApiKey] = useState('')

  // チャット画面で1回限り添付するファイル
  const [tempFileName, setTempFileName] = useState<string | null>(null)
  const [tempFileData, setTempFileData] = useState<string | null>(null)
  const [tempFileMimeType, setTempFileMimeType] = useState<string | null>(null)

  // 新しいエージェント作成モーダル
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalChatTitle, setModalChatTitle] = useState('')
  const [modalSystemPrompt, setModalSystemPrompt] = useState('')

  const [modalAgentFileData, setModalAgentFileData] = useState<string | null>(null)
  const [modalAgentFileMimeType, setModalAgentFileMimeType] = useState<string | null>(null)
  const [modalAgentFileName, setModalAgentFileName] = useState('')

  // システムプロンプト編集モーダル
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')

  // チャットフォームの「関連ファイルを使う」チェック
  const [useAgentFile, setUseAgentFile] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  // DOM参照
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hiddenModalFileRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------
  // Electronストアからロード
  // -------------------------------------------------------
  useEffect(() => {
    window.electronAPI.loadAgents().then((stored) => {
      if (Array.isArray(stored)) {
        setChats(stored)
      }
    })
  }, [])

  // -------------------------------------------------------
  // 必要に応じて都度save あるいはイベント駆動
  // -------------------------------------------------------
  // 例: アプリ中で "メッセージ送信" "エージェント作成" など変更タイミングで呼ぶ
  const saveAll = () => {
    window.electronAPI.saveAgents(chats).catch((err) => {
      console.error('Failed to save agents:', err)
    })
  }

  // -------------------------------------------------------
  // 新しいエージェント作成モーダル
  // -------------------------------------------------------
  const openCustomChatModal = () => {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFileData(null)
    setModalAgentFileMimeType(null)
    setModalAgentFileName('')
    setIsModalOpen(true)
  }
  const closeCustomChatModal = () => setIsModalOpen(false)

  const handleModalAgentFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    fileToBase64(file, (base64, mime) => {
      setModalAgentFileData(base64)
      setModalAgentFileMimeType(mime)
      setModalAgentFileName(file.name)
    })
  }
  const handleModalAgentFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const handleModalAgentFileBoxClick = () => {
    hiddenModalFileRef.current?.click()
  }
  const handleModalAgentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    fileToBase64(file, (base64, mime) => {
      setModalAgentFileData(base64)
      setModalAgentFileMimeType(mime)
      setModalAgentFileName(file.name)
    })
    e.target.value = ''
  }

  const fileToBase64 = (file: File, callback: (base64: string, mime: string) => void) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        const base64Data = reader.result.toString().split(',')[1]
        let mime = 'application/octet-stream'
        if (file.name.endsWith('.pdf')) {
          mime = 'application/pdf'
        } else if (file.name.endsWith('.txt')) {
          mime = 'text/plain'
        }
        callback(base64Data, mime)
      }
    }
    reader.readAsDataURL(file)
  }

  // エージェント作成
  const handleCreateCustomChat = () => {
    if (!modalChatTitle.trim()) {
      toast({
        title: 'チャット名が入力されていません',
        status: 'warning',
        duration: 3000,
        isClosable: true
      })

      return
    }
    const newChat: ChatInfo = {
      id: Date.now(),
      customTitle: modalChatTitle,
      systemPrompt: modalSystemPrompt,
      messages: [],
      postMessages: [],
      createdAt: new Date().toLocaleString(),
      inputMessage: '',
      agentFileData: modalAgentFileData || undefined,
      agentFileMimeType: modalAgentFileMimeType || undefined
    }
    const updated = [...chats, newChat]
    setChats(updated)
    setSelectedChatId(newChat.id)
    setInputMessage('')
    setIsModalOpen(false)

    // 保存
    window.electronAPI.saveAgents(updated).catch((err) => console.error(err))
  }

  // -------------------------------------------------------
  // チャット選択
  // -------------------------------------------------------
  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const sel = chats.find((c) => c.id === id)
    if (sel) {
      setInputMessage(sel.inputMessage)
    }
  }

  // -------------------------------------------------------
  // メッセージ送信
  // -------------------------------------------------------
  const sendMessage = async () => {
    if (!inputMessage.trim() && !tempFileData) return
    setIsLoading(true)

    const newMessage: Message = {
      type: 'user',
      content: inputMessage
    }

    // ephemeral
    const ephemeralMessage: Messages = {
      role: 'user',
      parts: [{ text: inputMessage }]
    }

    // 添付ファイル(一時)
    if (tempFileData && tempFileMimeType) {
      ephemeralMessage.parts.push({
        inline_data: {
          mime_type: tempFileMimeType,
          data: tempFileData
        }
      })
    }

    // モーダルファイル
    const selectedChat = chats.find((c) => c.id === selectedChatId)
    if (useAgentFile && selectedChat?.agentFileData && selectedChat?.agentFileMimeType) {
      ephemeralMessage.parts.push({
        inline_data: {
          mime_type: selectedChat.agentFileMimeType,
          data: selectedChat.agentFileData
        }
      })
    }

    // 会話履歴にはBase64を含めずにメッセージだけ
    const updated = chats.map((chat) => {
      if (chat.id === selectedChatId) {
        return {
          ...chat,
          messages: [...chat.messages, newMessage],
          postMessages: [
            ...chat.postMessages,
            {
              role: 'user',
              parts: [{ text: inputMessage }]
            }
          ],
          inputMessage: ''
        }
      }

      return chat
    })
    setChats(updated)

    // 画面クリア
    setInputMessage('')
    setTempFileName(null)
    setTempFileData(null)
    setTempFileMimeType(null)

    try {
      const systemPrompt = selectedChat ? selectedChat.systemPrompt : ''
      const ephemeralMessages = [...(selectedChat?.postMessages || []), ephemeralMessage]

      const responseData = await window.electronAPI.postChatAI(
        ephemeralMessages,
        apiKey,
        systemPrompt
      )

      // AIメッセージ (テキストのみ)
      const aiMessage: Message = { type: 'ai', content: responseData }

      const finalUpdated = updated.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            messages: [...chat.messages, aiMessage],
            postMessages: [
              ...chat.postMessages,
              {
                role: 'model',
                parts: [{ text: responseData }]
              }
            ]
          }
        }

        return chat
      })

      setChats(finalUpdated)
      // 保存
      window.electronAPI.saveAgents(finalUpdated).catch((err) => console.error(err))
    } catch (err) {
      console.error('sendMessageエラー:', err)
      const finalUpdated = updated.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            postMessages: [
              ...chat.postMessages,
              { role: 'model', parts: [{ text: 'sendMessageエラー' }] }
            ]
          }
        }

        return chat
      })
      setChats(finalUpdated)

      toast({
        title: 'エラー',
        description: 'メッセージの送信に失敗しました。',
        status: 'error',
        duration: 5000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // -------------------------------------------------------
  // チャット画面でファイル添付(一時)
  // -------------------------------------------------------
  const handleTempFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        const base64Data = reader.result.toString().split(',')[1]
        setTempFileData(base64Data)
        setTempFileName(file.name)
        if (file.name.endsWith('.pdf')) {
          setTempFileMimeType('application/pdf')
        } else if (file.name.endsWith('.txt')) {
          setTempFileMimeType('text/plain')
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
        if (file.name.endsWith('.pdf')) {
          setTempFileMimeType('application/pdf')
        } else if (file.name.endsWith('.txt')) {
          setTempFileMimeType('text/plain')
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

  // -------------------------------------------------------
  // 入力欄やスクロール
  // -------------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputMessage(val)
    // 選択中チャットのinputMessageを更新
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === selectedChatId) {
          return { ...chat, inputMessage: val }
        }

        return chat
      })
    )
  }

  useEffect(() => {
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto'
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`
    }
  }, [inputMessage])

  const chatHistoryRefCurrent = chatHistoryRef.current
  useEffect(() => {
    if (chatHistoryRefCurrent) {
      chatHistoryRefCurrent.scrollTop = chatHistoryRefCurrent.scrollHeight
    }
  }, [chats, selectedChatId, chatHistoryRefCurrent])

  // -------------------------------------------------------
  // 使用期限
  // -------------------------------------------------------
  useEffect(() => {
    const expiryDate = new Date(import.meta.env.VITE_EXPIRY_DATE)
    const currentDate = new Date()
    if (currentDate.getTime() > expiryDate.getTime()) {
      setIsExpired(true)
    }
  }, [])

  // -------------------------------------------------------
  // システムプロンプト編集
  // -------------------------------------------------------
  const selectedChat = chats.find((c) => c.id === selectedChatId)

  const openSystemPromptModal = () => {
    if (!selectedChat) return
    setEditingSystemPrompt(selectedChat.systemPrompt)
    setIsPromptModalOpen(true)
  }
  const closeSystemPromptModal = () => setIsPromptModalOpen(false)

  const handleSaveSystemPrompt = () => {
    if (!selectedChatId) return
    const updated = chats.map((chat) => {
      if (chat.id === selectedChatId) {
        return { ...chat, systemPrompt: editingSystemPrompt }
      }

      return chat
    })
    setChats(updated)
    window.electronAPI.saveAgents(updated).catch((err) => console.error(err))

    toast({
      title: 'システムプロンプトを更新しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
    setIsPromptModalOpen(false)
  }

  const handleCopySystemPrompt = () => {
    navigator.clipboard.writeText(editingSystemPrompt).then(() => {
      toast({
        title: 'システムプロンプトをコピーしました',
        status: 'info',
        duration: 1000,
        isClosable: true
      })
    })
  }

  // -------------------------------------------------------
  // JSX表示
  // -------------------------------------------------------
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
        <Heading as="h1" size="lg" fontWeight="extrabold" color="gray.800">
          DesAIn_Assistant
        </Heading>

        <HStack spacing={4}>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ChatAIのAPI Keyを入力"
            type="password"
            size="md"
            isDisabled={isExpired}
          />
          <Button
            onClick={openCustomChatModal}
            colorScheme="teal"
            isDisabled={isExpired}
            minW="250px"
          >
            新しいエージェントの作成
          </Button>
        </HStack>
      </Flex>

      {/* メイン */}
      <Flex as="main" flex="1" overflow="hidden" p={4}>
        {/* 左カラム：チャット一覧 */}
        <Box
          w="20%"
          bg="white"
          shadow="lg"
          rounded="lg"
          display="flex"
          flexDirection="column"
          mr={4}
        >
          <Box overflowY="auto" flex="1">
            <List spacing={3} p={4}>
              {chats.map((chat) => (
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
                  <Text fontSize="xs" color="gray.500">
                    {chat.createdAt}
                  </Text>
                  <Text fontSize="md" fontWeight="bold">
                    {chat.customTitle || '無題のチャット'}
                  </Text>
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>

        {/* 右カラム：チャット内容 */}
        <Box w="80%" bg="white" shadow="lg" rounded="lg" display="flex" flexDirection="column">
          {/* メッセージ一覧 */}
          <Box ref={chatHistoryRef} flex="1" overflowY="auto" p={4}>
            {selectedChat ? (
              selectedChat.messages.map((msg, idx) => (
                <Box
                  key={idx}
                  mb={4}
                  p={3}
                  rounded="lg"
                  bg={msg.type === 'user' ? 'gray.300' : 'gray.50'}
                >
                  {msg.type === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </Box>
              ))
            ) : (
              <Text fontWeight="bold" color="gray.500">
                チャットを作成して開始してください
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
                placeholder="メッセージを入力..."
                rows={1}
                resize="none"
                flex="1"
                maxHeight="200px"
                isDisabled={apiKey.length === 0 || isExpired}
              />

              <Checkbox
                isChecked={useAgentFile}
                onChange={(e) => setUseAgentFile(e.target.checked)}
                isDisabled={!selectedChat || isExpired}
              >
                関連ファイル
              </Checkbox>

              <IconButton
                icon={<LuPaperclip />}
                aria-label="ファイル添付"
                onClick={() => fileInputRef.current?.click()}
                isDisabled={apiKey.length === 0 || isExpired}
              />
              <Input
                ref={fileInputRef}
                type="file"
                accept="application/pdf, text/plain"
                onChange={handleTempFileChange}
                display="none"
              />

              <IconButton
                icon={<LuSettings />}
                aria-label="指示の編集"
                onClick={openSystemPromptModal}
                isDisabled={!selectedChat || isExpired}
              />
              <IconButton
                icon={<IoSend />}
                aria-label="メッセージ送信"
                onClick={sendMessage}
                isLoading={isLoading}
                isDisabled={apiKey.length === 0 || inputMessage.length === 0 || isExpired}
              />
            </HStack>
          </Flex>

          {/* 一時添付ファイル(画面だけ) */}
          {tempFileName && (
            <Box p={4} borderTop="1px" borderColor="gray.200" display="flex" alignItems="center">
              <Text flex="1" fontSize="sm" color="gray.500">
                選択されたファイル: {tempFileName}
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

      {/* 使用期限切れモーダル */}
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

      {/* 新しいエージェント作成モーダル */}
      <Modal isOpen={isModalOpen} onClose={closeCustomChatModal} isCentered>
        <ModalOverlay />
        <ModalContent maxW="3xl">
          <ModalHeader>新しいエージェントの作成</ModalHeader>
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>エージェント名</FormLabel>
              <Input
                value={modalChatTitle}
                onChange={(e) => setModalChatTitle(e.target.value)}
                placeholder="エージェント名を入力"
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>指示内容</FormLabel>
              <Textarea
                rows={5}
                w="full"
                value={modalSystemPrompt}
                onChange={(e) => setModalSystemPrompt(e.target.value)}
                placeholder="system prompt..."
              />
            </FormControl>

            <FormControl>
              <FormLabel>関連ファイル (任意)</FormLabel>
              <Box
                p={4}
                border="2px dashed"
                borderColor="gray.300"
                borderRadius="md"
                textAlign="center"
                _hover={{ borderColor: 'gray.400', bg: 'gray.50' }}
                onClick={handleModalAgentFileBoxClick}
                onDrop={handleModalAgentFileDrop}
                onDragOver={handleModalAgentFileDragOver}
                position="relative"
              >
                {modalAgentFileName ? (
                  <Text color="gray.700">{modalAgentFileName}</Text>
                ) : (
                  <Text color="gray.500">クリックまたはファイルをドラッグ＆ドロップ</Text>
                )}
                <Input
                  ref={hiddenModalFileRef}
                  type="file"
                  accept="application/pdf, text/plain"
                  display="none"
                  onChange={handleModalAgentFileChange}
                />
              </Box>
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
        <ModalContent>
          <ModalHeader>指示内容の編集</ModalHeader>
          <ModalBody>
            <FormControl>
              <FormLabel>指示</FormLabel>
              <Textarea
                rows={6}
                value={editingSystemPrompt}
                onChange={(e) => setEditingSystemPrompt(e.target.value)}
                placeholder="指示の内容を入力/編集"
              />
            </FormControl>
            <HStack spacing={2} mt={3}>
              <Button variant="outline" colorScheme="blue" onClick={handleCopySystemPrompt}>
                コピー
              </Button>
            </HStack>
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
    </Flex>
  )
}
