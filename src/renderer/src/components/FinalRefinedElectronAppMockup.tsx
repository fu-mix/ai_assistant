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
 * ElectronAPI
 */
interface ElectronAPI {
  postChatAI: (message: Messages[], apiKey: string, systemPrompt: string) => Promise<any>
  loadAgents: () => Promise<ChatInfo[]>
  saveAgents: (agentsData: ChatInfo[]) => Promise<any>
  copyFileToUserData: () => Promise<string | null>
  readFileByPath: (filePath: string) => Promise<string | null>
}
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

/**
 * Basic message for UI
 */
type Message = {
  type: 'user' | 'ai'
  content: string
}

/**
 * ChatAI message: multiple parts
 */
export type Messages = {
  role: string
  parts: [{ text: string }, { inline_data?: { mime_type: string; data: string } }?]
}

/**
 * Chat(エージェント)情報
 * agentFilePath: userDataにコピーしたファイルのパス
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
}

export const FinalRefinedElectronAppMockup = () => {
  const toast = useToast()

  // ステート
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [apiKey, setApiKey] = useState('')

  // チャットフォーム 一時ファイル
  const [tempFileName, setTempFileName] = useState<string | null>(null)
  const [tempFileData, setTempFileData] = useState<string | null>(null)
  const [tempFileMimeType, setTempFileMimeType] = useState<string | null>(null)

  // エージェント作成モーダル
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalChatTitle, setModalChatTitle] = useState('')
  const [modalSystemPrompt, setModalSystemPrompt] = useState('')
  const [modalAgentFilePath, setModalAgentFilePath] = useState<string | null>(null)

  // システムプロンプト編集モーダル
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')

  // フォームで「モーダルファイルを使う」チェック
  const [useAgentFile, setUseAgentFile] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  // Refs
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ----------------------------------------------
  // アプリ起動時に loadAgents
  // ----------------------------------------------
  useEffect(() => {
    window.electronAPI.loadAgents().then((stored) => {
      if (Array.isArray(stored)) {
        setChats(stored)
      }
    })
  }, [])

  // ----------------------------------------------
  // 新しいエージェント作成モーダル
  // ----------------------------------------------
  const openCustomChatModal = () => {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFilePath(null)
    setIsModalOpen(true)
  }
  const closeCustomChatModal = () => setIsModalOpen(false)

  // ファイルを userData にコピー
  const handleSelectAgentFile = async () => {
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
      agentFilePath: modalAgentFilePath || undefined
    }
    const updated = [...chats, newChat]
    setChats(updated)
    setSelectedChatId(newChat.id)
    setInputMessage('')
    setIsModalOpen(false)

    window.electronAPI.saveAgents(updated).catch(console.error)
  }

  // ----------------------------------------------
  // チャット選択
  // ----------------------------------------------
  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const target = chats.find((c) => c.id === id)
    if (target) {
      setInputMessage(target.inputMessage)
    }
  }

  // ----------------------------------------------
  // メッセージ送信
  // ----------------------------------------------
  const sendMessage = async () => {
    if (!inputMessage.trim() && !tempFileData) return
    setIsLoading(true)

    // UI表示用
    const newMsg: Message = {
      type: 'user',
      content: inputMessage
    }

    // API送信用 ephemeral
    const ephemeralMsg: Messages = {
      role: 'user',
      parts: [
        { text: inputMessage } // part[0] -> テキスト
      ]
    }

    // (1) 一時ファイル (フォーム添付)
    if (tempFileData && tempFileMimeType) {
      ephemeralMsg.parts.push({
        inline_data: {
          mime_type: tempFileMimeType,
          data: tempFileData
        }
      })
    }

    // (2) モーダルファイルを使う場合
    const selectedChat = chats.find((c) => c.id === selectedChatId)

    if (useAgentFile && selectedChat?.agentFilePath) {
      const fileBase64 = await window.electronAPI.readFileByPath(selectedChat.agentFilePath)
      if (fileBase64) {
        // 拡張子をチェックしてMIMEを判別
        const filePathLower = selectedChat.agentFilePath.toLowerCase()
        let derivedMime = 'application/octet-stream'

        if (filePathLower.endsWith('.pdf')) {
          derivedMime = 'application/pdf'
        } else if (filePathLower.endsWith('.txt')) {
          derivedMime = 'text/plain'
        }

        ephemeralMsg.parts.push({
          inline_data: {
            mime_type: derivedMime,
            data: fileBase64
          }
        })
      }
    }

    // 履歴にはテキストのみ
    const updated = chats.map((chat) => {
      if (chat.id === selectedChatId) {
        return {
          ...chat,
          messages: [...chat.messages, newMsg],
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
    setInputMessage('')
    setTempFileName(null)
    setTempFileData(null)
    setTempFileMimeType(null)

    try {
      const systemPrompt = selectedChat?.systemPrompt || ''
      const ephemeralAll = [...(selectedChat?.postMessages || []), ephemeralMsg]
      const responseData = await window.electronAPI.postChatAI(ephemeralAll, apiKey, systemPrompt)

      // AIメッセージ
      const aiMsg: Message = { type: 'ai', content: responseData }
      const finalUpdated = updated.map((chat) => {
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
      setChats(finalUpdated)

      window.electronAPI.saveAgents(finalUpdated).catch(console.error)
    } catch (err) {
      console.error('sendMessageエラー:', err)
      const finalErr = updated.map((chat) => {
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
      setChats(finalErr)

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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // チャット画面: 一時ファイル添付
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

  // ドラッグ＆ドロップ
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

  // 入力欄やスクロール
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

  // 使用期限
  useEffect(() => {
    const expiryDate = new Date(import.meta.env.VITE_EXPIRY_DATE)
    if (new Date().getTime() > expiryDate.getTime()) {
      setIsExpired(true)
    }
  }, [])

  // システムプロンプト編集
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
    window.electronAPI.saveAgents(updated).catch(console.error)

    toast({
      title: 'プロンプトを更新しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
    setIsPromptModalOpen(false)
  }

  const handleCopySystemPrompt = () => {
    navigator.clipboard.writeText(editingSystemPrompt).then(() => {
      toast({
        title: 'プロンプトをコピーしました',
        status: 'info',
        duration: 1000,
        isClosable: true
      })
    })
  }

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
            placeholder="ChatAIのAPI Key"
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
            新しいアシスタントの作成
          </Button>
        </HStack>
      </Flex>

      {/* メイン */}
      <Flex as="main" flex="1" overflow="hidden" p={4}>
        {/* 左: チャット一覧 */}
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

        {/* 右: 会話内容 */}
        <Box w="80%" bg="white" shadow="lg" rounded="lg" display="flex" flexDirection="column">
          {/* 履歴表示 */}
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
          <Flex p={4} borderTop="1px" borderColor="gray.200" align="end" width="100%">
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
                aria-label="システムプロンプト編集"
                onClick={openSystemPromptModal}
                isDisabled={!selectedChat || isExpired}
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

          {/* 一時添付ファイル表示 */}
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
              <FormLabel>アシスタントへの指示</FormLabel>
              <Textarea
                rows={5}
                w="full"
                value={modalSystemPrompt}
                onChange={(e) => setModalSystemPrompt(e.target.value)}
                placeholder="あなたは..."
              />
            </FormControl>

            <FormControl>
              <FormLabel>関連ファイル (任意)</FormLabel>
              <Button
                border="2px dashed"
                borderColor="gray.300"
                colorScheme="blue"
                variant="outline"
                w="full"
                onClick={handleSelectAgentFile}
              >
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
        <ModalContent>
          <ModalHeader>アシスタント指示の編集</ModalHeader>
          <ModalBody>
            <FormControl>
              <FormLabel>指示</FormLabel>
              <Textarea
                rows={6}
                value={editingSystemPrompt}
                onChange={(e) => setEditingSystemPrompt(e.target.value)}
                placeholder="アシスタントへの指示を入力/編集"
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
