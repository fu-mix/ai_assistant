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

interface ElectronAPI {
  postChatAI: (message: Messages[], apiKey: string, systemPrompt: string) => Promise<any>
  readKnowledgeFiles: (knowledgeFiles: string[]) => Promise<any>
  readKnowledgeFile: (knowledgeFile: string) => Promise<any>
  readPromptFile: (pipeline: string, usecase: string) => Promise<any>
}
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

// エージェント(チャット)情報
type ChatInfo = {
  id: number
  customTitle: string
  systemPrompt: string
  messages: Message[]
  postMessages: Messages[]
  createdAt: string
  inputMessage: string

  // モーダルで設定したファイル情報 (Base64等)
  agentFileData?: string
  agentFileMimeType?: string
}

export const FinalRefinedElectronAppMockup = () => {
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [inputMessage, setInputMessage] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')

  // 画面で一時添付するファイル
  const [tempFileName, setTempFileName] = useState<string | null>(null)
  const [tempFileData, setTempFileData] = useState<string | null>(null)
  const [tempFileMimeType, setTempFileMimeType] = useState<string | null>(null)

  // モーダル：エージェント
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalChatTitle, setModalChatTitle] = useState('')
  const [modalSystemPrompt, setModalSystemPrompt] = useState('')
  // ★ モーダンUIファイル入力
  const [modalAgentFileData, setModalAgentFileData] = useState<string | null>(null)
  const [modalAgentFileMimeType, setModalAgentFileMimeType] = useState<string | null>(null)
  const [modalAgentFileName, setModalAgentFileName] = useState('')

  // システムプロンプト編集モーダル
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')

  // チャットフォームチェック
  const [useAgentFile, setUseAgentFile] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const toast = useToast()

  // DOM参照
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // ★ モーダンUIファイル入力の hidden ref
  const hiddenModalFileRef = useRef<HTMLInputElement>(null)

  // ------------------------------------------------------
  //  新しいエージェントの作成モーダル
  // ------------------------------------------------------
  const openCustomChatModal = () => {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFileData(null)
    setModalAgentFileMimeType(null)
    setModalAgentFileName('')
    setIsModalOpen(true)
  }
  const closeCustomChatModal = () => setIsModalOpen(false)

  // ★ モダンUIのドラッグ＆ドロップ / クリック
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

  // ★ 従来の onChange
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

  // ★ ユーティリティ：ファイルをBase64変換
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
    setChats((prev) => [...prev, newChat])
    setSelectedChatId(newChat.id)
    setInputMessage('')
    setIsModalOpen(false)
  }

  // ------------------------------------------------------
  //  チャット選択
  // ------------------------------------------------------
  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const targetChat = chats.find((c) => c.id === id)
    if (targetChat) {
      setInputMessage(targetChat.inputMessage)
    }
  }

  // ------------------------------------------------------
  //  送信 (ファイルは履歴に保存しない)
  // ------------------------------------------------------
  const sendMessage = async () => {
    if (!inputMessage.trim() && !tempFileData) return
    setIsLoading(true)

    const newMessage: Message = {
      type: 'user',
      content: inputMessage
    }

    // リクエスト用 ephemeralMessage
    const ephemeralMessage: Messages = {
      role: 'user',
      parts: [{ text: inputMessage }]
    }

    // チャット画面で一時添付ファイル
    if (tempFileData && tempFileMimeType) {
      ephemeralMessage.parts.push({
        inline_data: {
          mime_type: tempFileMimeType,
          data: tempFileData
        }
      })
    }

    // モーダルで設定したファイル (useAgentFileがtrueの場合のみ)
    const selectedChat = chats.find((c) => c.id === selectedChatId)
    if (useAgentFile && selectedChat?.agentFileData && selectedChat?.agentFileMimeType) {
      ephemeralMessage.parts.push({
        inline_data: {
          mime_type: selectedChat.agentFileMimeType,
          data: selectedChat.agentFileData
        }
      })
    }

    // 会話履歴にはファイルを含めず、テキストのみ
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === selectedChatId) {
          return {
            ...chat,
            messages: [...chat.messages, newMessage],
            postMessages: [
              ...chat.postMessages,
              {
                role: 'user',
                parts: [{ text: inputMessage }] // テキストのみ
              }
            ],
            inputMessage: ''
          }
        }

        return chat
      })
    )

    // UIリセット
    setInputMessage('')
    setTempFileName(null)
    setTempFileData(null)
    setTempFileMimeType(null)

    try {
      const systemPrompt = selectedChat ? selectedChat.systemPrompt : ''
      const ephemeralMessages = [
        ...(selectedChat?.postMessages || []), // テキストのみ
        ephemeralMessage // 今回送信するファイル付メッセージ
      ]

      const responseData = await window.electronAPI.postChatAI(
        ephemeralMessages,
        apiKey,
        systemPrompt
      )

      // AIメッセージ (テキストのみ)
      const aiMsg: Message = { type: 'ai', content: responseData }

      // 履歴にもテキストのみ保存
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id === selectedChatId) {
            return {
              ...chat,
              messages: [...chat.messages, aiMsg],
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
      )
    } catch (err) {
      console.error('sendMessageエラー:', err)
      setChats((prev) =>
        prev.map((chat) => {
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
      )
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

  // ------------------------------------------------------
  //  チャット画面で一時ファイル添付
  // ------------------------------------------------------
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

  // ------------------------------------------------------
  //  入力欄やスクロール
  // ------------------------------------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputMessage(val)
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

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [chats, selectedChatId])

  // ------------------------------------------------------
  //  使用期限
  // ------------------------------------------------------
  useEffect(() => {
    const expiryDate = new Date(import.meta.env.VITE_EXPIRY_DATE)
    // const expiryDate = new Date('2024-10-01') // テスト
    const currentDate = new Date()
    if (currentDate.getTime() > expiryDate.getTime()) {
      setIsExpired(true)
    }
  }, [])

  // ------------------------------------------------------
  //  システムプロンプト編集
  // ------------------------------------------------------
  const selectedChat = chats.find((c) => c.id === selectedChatId)

  const openSystemPromptModal = () => {
    if (!selectedChat) return
    setEditingSystemPrompt(selectedChat.systemPrompt)
    setIsPromptModalOpen(true)
  }

  const closeSystemPromptModal = () => setIsPromptModalOpen(false)

  const handleSaveSystemPrompt = () => {
    if (!selectedChatId) return
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id === selectedChatId) {
          return { ...chat, systemPrompt: editingSystemPrompt }
        }

        return chat
      })
    )
    toast({
      title: '指示の内容を更新しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
    setIsPromptModalOpen(false)
  }

  const handleCopySystemPrompt = () => {
    navigator.clipboard.writeText(editingSystemPrompt).then(() => {
      toast({
        title: '指示の内容をコピーしました',
        status: 'info',
        duration: 1000,
        isClosable: true
      })
    })
  }

  // ------------------------------------------------------
  //  JSX
  // ------------------------------------------------------
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
          DesAIn Assistant
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
          {/* ボタン幅を確保して文字切れ回避 */}
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

        {/* 右カラム：チャット本文 */}
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

          {/* 一時添付ファイル表示 */}
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

            {/* ★ モダンUIファイル入力: ドラッグ＆ドロップ + クリック */}
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
                {/* hidden input */}
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
