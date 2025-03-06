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
import { MdOutlineContentCopy } from 'react-icons/md' // 既にコピーアイコンを入れている想定

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

type Message = {
  type: 'user' | 'ai'
  content: string
}

export type Messages = {
  role: string
  parts: [{ text: string }, { inline_data?: { mime_type: string; data: string } }?]
}

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

  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [apiKey, setApiKey] = useState('')

  // 一時ファイル(フォーム)
  const [tempFileName, setTempFileName] = useState<string | null>(null)
  const [tempFileData, setTempFileData] = useState<string | null>(null)
  const [tempFileMimeType, setTempFileMimeType] = useState<string | null>(null)

  // 新しいアシスタント(エージェント)モーダル
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalChatTitle, setModalChatTitle] = useState('')
  const [modalSystemPrompt, setModalSystemPrompt] = useState('')
  const [modalAgentFilePath, setModalAgentFilePath] = useState<string | null>(null)

  // システムプロンプト編集モーダル
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [editingSystemPrompt, setEditingSystemPrompt] = useState('')

  // 削除確認モーダル
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  // フォーム: agentFile
  const [useAgentFile, setUseAgentFile] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  // メッセージ Hover (コピー用)
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null)

  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // アプリ起動時: 履歴をロード
  useEffect(() => {
    window.electronAPI.loadAgents().then((stored) => {
      if (Array.isArray(stored)) {
        setChats(stored)
      }
    })
  }, [])

  // -------------------------------------------
  // 新しいアシスタント作成
  // -------------------------------------------
  const openCustomChatModal = () => {
    setModalChatTitle('')
    setModalSystemPrompt('')
    setModalAgentFilePath(null)
    setIsModalOpen(true)
  }
  const closeCustomChatModal = () => setIsModalOpen(false)

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

  const handleCreateCustomChat = () => {
    if (!modalChatTitle.trim()) {
      toast({
        title: 'アシスタント名が入力されていません',
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

  // -------------------------------------------
  // アシスタント選択
  // -------------------------------------------
  const handleSelectChat = (id: number) => {
    setSelectedChatId(id)
    const target = chats.find((c) => c.id === id)
    if (target) {
      setInputMessage(target.inputMessage)
    }
  }

  // -------------------------------------------
  // アシスタント削除 (確認モーダル)
  // -------------------------------------------
  const handleDeleteChatClick = (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTargetId(chatId)
    setIsDeleteModalOpen(true)
  }
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setDeleteTargetId(null)
  }
  const confirmDeleteChat = async () => {
    if (deleteTargetId == null) {
      closeDeleteModal()

      return
    }
    await handleDeleteChat(deleteTargetId)
    closeDeleteModal()
  }

  const handleDeleteChat = async (chatId: number) => {
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

  // -------------------------------------------
  // メッセージ送信
  // -------------------------------------------
  const sendMessage = async () => {
    if (!inputMessage.trim() && !tempFileData) return
    setIsLoading(true)

    const newMsg: Message = {
      type: 'user',
      content: inputMessage
    }
    const ephemeralMsg: Messages = {
      role: 'user',
      parts: [{ text: inputMessage }]
    }

    // (1) チャットフォームで一時添付ファイル
    if (tempFileData && tempFileMimeType) {
      ephemeralMsg.parts.push({
        inline_data: {
          mime_type: tempFileMimeType,
          data: tempFileData
        }
      })
    }

    // (2) モーダルファイル
    const selectedChat = chats.find((c) => c.id === selectedChatId)
    if (useAgentFile && selectedChat?.agentFilePath) {
      const fileBase64 = await window.electronAPI.readFileByPath(selectedChat.agentFilePath)
      if (fileBase64) {
        // 拡張子判定
        const pathLower = selectedChat.agentFilePath.toLowerCase()
        let derivedMime = 'application/octet-stream'
        if (pathLower.endsWith('.pdf')) {
          derivedMime = 'application/pdf'
        } else if (pathLower.endsWith('.txt')) {
          derivedMime = 'text/plain'
        } else if (pathLower.endsWith('.png')) {
          derivedMime = 'image/png'
        } else if (pathLower.endsWith('.jpg') || pathLower.endsWith('.jpeg')) {
          derivedMime = 'image/jpeg'
        } else if (pathLower.endsWith('.gif')) {
          derivedMime = 'image/gif'
        }
        ephemeralMsg.parts.push({
          inline_data: {
            mime_type: derivedMime,
            data: fileBase64
          }
        })
      }
    }

    // 履歴上はテキストのみ
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

  // -------------------------------------------
  // チャットフォームのファイル選択
  // -------------------------------------------
  const handleTempFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        const base64Data = reader.result.toString().split(',')[1]
        setTempFileData(base64Data)
        setTempFileName(file.name)

        // 拡張子判定 (PDF/TXT/画像 のみ)
        const lowerName = file.name.toLowerCase()
        if (lowerName.endsWith('.pdf')) {
          setTempFileMimeType('application/pdf')
        } else if (lowerName.endsWith('.txt')) {
          setTempFileMimeType('text/plain')
        } else if (lowerName.endsWith('.png')) {
          setTempFileMimeType('image/png')
        } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
          setTempFileMimeType('image/jpeg')
        } else if (lowerName.endsWith('.gif')) {
          setTempFileMimeType('image/gif')
        } else {
          setTempFileMimeType('application/octet-stream')
        }

        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  // ドラッグ&ドロップ
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

        // 同じ拡張子判定 (PDF/TXT/画像 のみ)
        const lowerName = file.name.toLowerCase()
        if (lowerName.endsWith('.pdf')) {
          setTempFileMimeType('application/pdf')
        } else if (lowerName.endsWith('.txt')) {
          setTempFileMimeType('text/plain')
        } else if (lowerName.endsWith('.png')) {
          setTempFileMimeType('image/png')
        } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
          setTempFileMimeType('image/jpeg')
        } else if (lowerName.endsWith('.gif')) {
          setTempFileMimeType('image/gif')
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

  // 入力欄/履歴スクロール
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
  // useEffect(() => {
  //   if (chatInputRef.current) {
  //     chatInputRef.current.style.height = 'auto'
  //     chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`
  //   }
  // }, [inputMessage])

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [chats, selectedChatId])

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
      title: 'アシスタント指示を更新しました',
      status: 'success',
      duration: 2000,
      isClosable: true
    })
    setIsPromptModalOpen(false)
  }

  const handleCopySystemPrompt = () => {
    navigator.clipboard.writeText(editingSystemPrompt).then(() => {
      toast({
        title: '指示内容をコピーしました',
        status: 'info',
        duration: 1000,
        isClosable: true
      })
    })
  }

  // ★↓↓↓↓ ここから追加・修正 ★↓↓↓↓
  // モーダル内でファイルを変更する関数
  const handleChangeFileInPromptModal = async () => {
    if (!selectedChat) return

    // 古いファイルがあれば削除
    if (selectedChat.agentFilePath) {
      try {
        await window.electronAPI.deleteFileInUserData(selectedChat.agentFilePath)
      } catch (err) {
        console.error('Failed to delete old file:', err)
      }
    }

    // 新しいファイルをコピー
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

    // agentFilePathを更新
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
  // ★↑↑↑↑ ここまで追加・修正 ★↑↑↑↑

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

      <Flex as="main" flex="1" overflow="hidden" p={4}>
        {/* 左カラム: アシスタント一覧 */}
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
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        {chat.createdAt}
                      </Text>
                      <Text fontSize="md" fontWeight="bold">
                        {chat.customTitle || '無題のアシスタント'}
                      </Text>
                    </Box>

                    {/* 削除アイコン(選択中のみ表示) */}
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
              ))}
            </List>
          </Box>
        </Box>

        {/* 右カラム: 会話本文 */}
        <Box w="80%" bg="white" shadow="lg" rounded="lg" display="flex" flexDirection="column">
          <Box ref={chatHistoryRef} flex="1" overflowY="auto" p={4}>
            {(() => {
              const selectedChatObj = chats.find((c) => c.id === selectedChatId)
              if (!selectedChatObj) {
                return (
                  <Text fontWeight="bold" color="gray.500">
                    アシスタントを作成して開始してください
                  </Text>
                )
              }

              return selectedChatObj.messages.map((msg, idx) => (
                <Box
                  key={idx}
                  mb={4}
                  p={3}
                  rounded="lg"
                  bg={msg.type === 'user' ? 'gray.300' : 'gray.50'}
                  position="relative"
                  onMouseEnter={() => setHoveredMessageIndex(idx)}
                  onMouseLeave={() => setHoveredMessageIndex(null)}
                >
                  {msg.type === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
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
            })()}
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
                //rows={1}
                resize="vertical"
                flex="1"
                // maxHeight="500px"
                // height="100px"
                isDisabled={apiKey.length === 0 || isExpired}
              />

              <Checkbox
                isChecked={useAgentFile}
                onChange={(e) => setUseAgentFile(e.target.checked)}
                isDisabled={selectedChatId == null || isExpired}
              >
                関連ファイル
              </Checkbox>

              {/* acceptを PDF/TXT/画像 のみ */}
              <IconButton
                icon={<LuPaperclip />}
                aria-label="ファイル添付"
                onClick={() => fileInputRef.current?.click()}
                isDisabled={apiKey.length === 0 || isExpired}
              />
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg,.gif"
                onChange={handleTempFileChange}
                display="none"
              />

              <IconButton
                icon={<LuSettings />}
                aria-label="システムプロンプト編集"
                onClick={openSystemPromptModal}
                isDisabled={selectedChatId == null || isExpired}
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

      {/* 新しいアシスタント作成モーダル */}
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
              <FormLabel>指示</FormLabel>
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
              <FormLabel>指示</FormLabel>
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

            {/* 追加: 関連ファイル変更UI */}
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

      {/* 削除確認モーダル */}
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
            <Button colorScheme="red" onClick={confirmDeleteChat}>
              削除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  )
}
