import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@chakra-ui/react'

// 型定義のインポート
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

export type Message = {
  type: 'user' | 'ai'
  content: string
  imagePath?: string
}

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

interface UseChatManagementReturn {
  // 状態
  chats: ChatInfo[]
  selectedChatId: number | null | 'autoAssist'
  inputMessage: string
  editIndex: number | null
  
  // アクション
  setChats: (chats: ChatInfo[]) => void
  setSelectedChatId: (id: number | null | 'autoAssist') => void
  setInputMessage: (message: string) => void
  setEditIndex: (index: number | null) => void
  
  // メソッド
  handleSelectChat: (id: number) => void
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  createNewChat: (title: string, systemPrompt: string, agentFiles?: { name: string; path: string }[], apiConfigs?: APIConfig[], enableAPICall?: boolean) => Promise<void>
  deleteChat: (id: number) => Promise<void>
  updateChatTitle: (id: number, newTitle: string) => Promise<void>
  updateChatSystemPrompt: (id: number, newPrompt: string) => Promise<void>
  updateChatAgentFiles: (id: number, agentFiles: { name: string; path: string }[]) => Promise<void>
  updateChatAPISettings: (id: number, apiConfigs: APIConfig[], enableAPICall: boolean) => Promise<void>
  reorderChats: (dragStartIndex: number, dropIndex: number) => Promise<void>
  loadChats: () => Promise<void>
  saveChats: () => Promise<void>
  
  // 計算されたプロパティ
  selectedChatObj: ChatInfo | null
  currentMessages: Message[]
  nonAutoAssistChats: ChatInfo[]
}

export const useChatManagement = (): UseChatManagementReturn => {
  const toast = useToast()
  const AUTO_ASSIST_ID = 999999
  
  // 状態
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null | 'autoAssist'>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)

  // 初期ロード
  const loadChats = useCallback(async () => {
    try {
      const stored = await window.electronAPI.loadAgents()
      if (Array.isArray(stored)) {
        const reformed = stored.map((c) => ({
          ...c,
          agentFilePaths: c.agentFilePaths || []
        }))
        
        // オートアシストが存在しない場合は作成
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
          reformed.push(newAutoAssist)
        }
        
        setChats(reformed)
      }
    } catch (error) {
      console.error('Failed to load chats:', error)
      toast({
        title: 'エラー',
        description: 'チャットの読み込みに失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [toast])

  // チャット保存
  const saveChats = useCallback(async () => {
    try {
      await window.electronAPI.saveAgents(chats)
    } catch (error) {
      console.error('Failed to save chats:', error)
      toast({
        title: 'エラー',
        description: 'チャットの保存に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // チャット選択
  const handleSelectChat = useCallback((id: number) => {
    setSelectedChatId(id)
    const target = chats.find((c) => c.id === id)
    if (target) {
      setInputMessage(target.inputMessage)
    }
  }, [chats])

  // 入力変更
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputMessage(val)

    if (typeof selectedChatId === 'number') {
      setChats((prev) =>
        prev.map((chat) => (chat.id === selectedChatId ? { ...chat, inputMessage: val } : chat))
      )
    }
  }, [selectedChatId])

  // 新しいチャット作成
  const createNewChat = useCallback(async (
    title: string, 
    systemPrompt: string, 
    agentFiles: { name: string; path: string }[] = [],
    apiConfigs: APIConfig[] = [],
    enableAPICall: boolean = false
  ) => {
    try {
      const newId = Math.max(...chats.map((c) => c.id), 0) + 1
      const newChat: ChatInfo = {
        id: newId,
        customTitle: title,
        systemPrompt,
        messages: [],
        postMessages: [],
        createdAt: new Date().toLocaleString(),
        inputMessage: '',
        agentFilePaths: agentFiles.map(f => f.path),
        apiConfigs,
        enableAPICall
      }

      const updatedChats = [...chats, newChat]
      setChats(updatedChats)
      await window.electronAPI.saveAgents(updatedChats)
      
      toast({
        title: 'チャットを作成しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (error) {
      console.error('Failed to create chat:', error)
      toast({
        title: 'エラー',
        description: 'チャットの作成に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // チャット削除
  const deleteChat = useCallback(async (id: number) => {
    try {
      // 削除対象のチャットを取得
      const targetChat = chats.find(c => c.id === id)
      if (!targetChat) return

      // 画像ファイルを削除
      const imageMessages = targetChat.messages.filter(msg => msg.imagePath && msg.imagePath.trim() !== '')
      for (const msg of imageMessages) {
        if (msg.imagePath) {
          try {
            await window.electronAPI.directDeleteFile(msg.imagePath)
          } catch (err) {
            console.warn(`Failed to delete image file: ${msg.imagePath}`, err)
          }
        }
      }

      // エージェントファイルを削除
      if (targetChat.agentFilePaths && targetChat.agentFilePaths.length > 0) {
        for (const filePath of targetChat.agentFilePaths) {
          try {
            await window.electronAPI.deleteFileInUserData(filePath)
          } catch (err) {
            console.warn(`Failed to delete agent file: ${filePath}`, err)
          }
        }
      }

      // チャットリストから削除
      const updatedChats = chats.filter((c) => c.id !== id)
      setChats(updatedChats)
      await window.electronAPI.saveAgents(updatedChats)

      // 削除したチャットが選択されていた場合、選択を解除
      if (selectedChatId === id) {
        setSelectedChatId(null)
        setInputMessage('')
      }

      toast({
        title: 'チャットを削除しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (error) {
      console.error('Failed to delete chat:', error)
      toast({
        title: 'エラー',
        description: 'チャットの削除に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, selectedChatId, toast])

  // チャットタイトル更新
  const updateChatTitle = useCallback(async (id: number, newTitle: string) => {
    try {
      const updatedChats = chats.map((chat) =>
        chat.id === id ? { ...chat, customTitle: newTitle } : chat
      )
      setChats(updatedChats)
      await window.electronAPI.saveAgents(updatedChats)
    } catch (error) {
      console.error('Failed to update chat title:', error)
      toast({
        title: 'エラー',
        description: 'タイトルの更新に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // チャットシステムプロンプト更新
  const updateChatSystemPrompt = useCallback(async (id: number, newPrompt: string) => {
    try {
      const updatedChats = chats.map((chat) =>
        chat.id === id ? { ...chat, systemPrompt: newPrompt } : chat
      )
      setChats(updatedChats)
      await window.electronAPI.saveAgents(updatedChats)
    } catch (error) {
      console.error('Failed to update chat system prompt:', error)
      toast({
        title: 'エラー',
        description: 'システムプロンプトの更新に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // チャットエージェントファイル更新
  const updateChatAgentFiles = useCallback(async (id: number, agentFiles: { name: string; path: string }[]) => {
    try {
      const updatedChats = chats.map((chat) =>
        chat.id === id ? { ...chat, agentFilePaths: agentFiles.map(f => f.path) } : chat
      )
      setChats(updatedChats)
      await window.electronAPI.saveAgents(updatedChats)
    } catch (error) {
      console.error('Failed to update chat agent files:', error)
      toast({
        title: 'エラー',
        description: 'エージェントファイルの更新に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // チャットAPI設定更新
  const updateChatAPISettings = useCallback(async (id: number, apiConfigs: APIConfig[], enableAPICall: boolean) => {
    try {
      const updatedChats = chats.map((chat) =>
        chat.id === id ? { ...chat, apiConfigs, enableAPICall } : chat
      )
      setChats(updatedChats)
      await window.electronAPI.saveAgents(updatedChats)
    } catch (error) {
      console.error('Failed to update chat API settings:', error)
      toast({
        title: 'エラー',
        description: 'API設定の更新に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // チャット順序変更
  const reorderChats = useCallback(async (dragStartIndex: number, dropIndex: number) => {
    try {
      const newChats = [...chats]
      // オートアシスト以外で構成された配列
      const filtered = newChats.filter((c) => c.id !== AUTO_ASSIST_ID)

      const dragItem = filtered[dragStartIndex]
      filtered.splice(dragStartIndex, 1)
      filtered.splice(dropIndex, 0, dragItem)

      // オートアシスト再追加
      const autoAssistObj = newChats.find((c) => c.id === AUTO_ASSIST_ID)
      const finalChats = autoAssistObj ? [...filtered, autoAssistObj] : filtered

      setChats(finalChats)
      await window.electronAPI.saveAgents(finalChats)
    } catch (error) {
      console.error('Failed to reorder chats:', error)
      toast({
        title: 'エラー',
        description: 'チャットの並び替えに失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [chats, toast])

  // 計算されたプロパティ
  const selectedChatObj = useMemo(() => {
    if (typeof selectedChatId === 'number') {
      return chats.find((c) => c.id === selectedChatId) || null
    }
    return null
  }, [chats, selectedChatId])

  const currentMessages = useMemo(() => {
    if (selectedChatId === 'autoAssist') {
      // オートアシストの場合は空配列を返す（useAutoAssistで管理）
      return []
    }
    if (typeof selectedChatId === 'number') {
      return selectedChatObj?.messages || []
    }
    return []
  }, [selectedChatId, selectedChatObj?.messages])

  const nonAutoAssistChats = useMemo(() => {
    return chats.filter((c) => c.id !== AUTO_ASSIST_ID)
  }, [chats])

  // 初期ロード
  useEffect(() => {
    loadChats()
  }, [loadChats])

  return {
    // 状態
    chats,
    selectedChatId,
    inputMessage,
    editIndex,
    
    // アクション
    setChats,
    setSelectedChatId,
    setInputMessage,
    setEditIndex,
    
    // メソッド
    handleSelectChat,
    handleInputChange,
    createNewChat,
    deleteChat,
    updateChatTitle,
    updateChatSystemPrompt,
    updateChatAgentFiles,
    updateChatAPISettings,
    reorderChats,
    loadChats,
    saveChats,
    
    // 計算されたプロパティ
    selectedChatObj,
    currentMessages,
    nonAutoAssistChats
  }
}
