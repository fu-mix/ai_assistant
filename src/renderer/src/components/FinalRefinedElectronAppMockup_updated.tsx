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
  Switch,
  Tooltip,
  Select,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Image
} from '@chakra-ui/react'
import { MessageList } from './MessageList'
import { ChatInputForm } from './ChatInputForm'
import { AttachmentList } from './AttachmentList'
// 分離されたモーダルコンポーネントをインポート
import {
  TitleEditModal,
  AutoAssistSettingsModal,
  ExportModal,
  ImportModeModal,
  APISettingsModal
} from './modals'
// 共通型定義をインポート
import {
  Messages,
  Message,
  ChatInfo,
  TitleSettings,
  APIConfig,
  AutoAssistState,
  SubtaskInfo
} from './types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { AiOutlineDelete } from 'react-icons/ai'
import { MdOutlineContentCopy } from 'react-icons/md'
import { FiEdit } from 'react-icons/fi'
import { HamburgerIcon, DownloadIcon } from '@chakra-ui/icons'

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
