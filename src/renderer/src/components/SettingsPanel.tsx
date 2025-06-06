import { memo, useCallback, useMemo } from 'react'
import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Button,
  Switch,
  FormControl,
  FormLabel,
  Divider,
  Badge,
  Textarea,
  Input,
  Select,
  IconButton,
  Tooltip,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react'
import { MessageList } from './MessageList'
import { ChatInputForm } from './ChatInputForm'
import { AttachmentList } from './AttachmentList'
import { LuPaperclip, LuSettings } from 'react-icons/lu'
import { FiEdit } from 'react-icons/fi'
import type { ChatInfo, Message, APIConfig } from './types'

interface SettingsPanelProps {
  selectedChat: ChatInfo | null
  messages: Message[]
  inputMessage: string
  isLoading: boolean
  tempFiles: { name: string; data: string; mimeType: string }[]
  useAgentFile: boolean
  editIndex: number | null
  isExpired: boolean
  apiKey: string
  showApiKey: boolean
  isLoadingApiKey: boolean
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFileSelection: () => void
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onDragOver: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onTempFileDelete: (targetName: string) => void
  onMessageCopy: (content: string) => void
  onMessageEdit: (index: number, content: string) => void
  onUseAgentFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onShowPromptModal: () => void
  onShowAPISettings: () => void
  onShowApiKeySettings: () => void
  onToggleApiKeyVisibility: () => void
  chatInputRef: React.RefObject<HTMLTextAreaElement>
  chatHistoryRef: React.RefObject<HTMLDivElement>
  fileInputRef: React.RefObject<HTMLInputElement>
  isExternalApiEnabled: boolean
}

export const SettingsPanel = memo(({
  selectedChat,
  messages,
  inputMessage,
  isLoading,
  tempFiles,
  useAgentFile,
  editIndex,
  isExpired,
  apiKey,
  showApiKey,
  isLoadingApiKey,
  onInputChange,
  onSendMessage,
  onKeyPress,
  onFileSelection,
  onDrop,
  onDragOver,
  onTempFileDelete,
  onMessageCopy,
  onMessageEdit,
  onUseAgentFileChange,
  onShowPromptModal,
  onShowAPISettings,
  onShowApiKeySettings,
  onToggleApiKeyVisibility,
  chatInputRef,
  chatHistoryRef,
  fileInputRef,
  isExternalApiEnabled
}: SettingsPanelProps) => {
  // メッセージ送信ハンドラーのメモ化
  const handleSendMessage = useCallback(() => {
    onSendMessage()
  }, [onSendMessage])

  // ファイル選択ハンドラーのメモ化
  const handleFileSelection = useCallback(() => {
    onFileSelection()
  }, [onFileSelection])

  // プロンプト編集ハンドラーのメモ化
  const handleShowPromptModal = useCallback(() => {
    onShowPromptModal()
  }, [onShowPromptModal])

  // API設定ハンドラーのメモ化
  const handleShowAPISettings = useCallback(() => {
    onShowAPISettings()
  }, [onShowAPISettings])

  // APIキー設定ハンドラーのメモ化
  const handleShowApiKeySettings = useCallback(() => {
    onShowApiKeySettings()
  }, [onShowApiKeySettings])

  // APIキー表示切り替えハンドラーのメモ化
  const handleToggleApiKeyVisibility = useCallback(() => {
    onToggleApiKeyVisibility()
  }, [onToggleApiKeyVisibility])

  // エージェントファイル使用ハンドラーのメモ化
  const handleUseAgentFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUseAgentFileChange(e)
  }, [onUseAgentFileChange])

  // アシスタント情報をメモ化
  const assistantInfo = useMemo(() => {
    if (!selectedChat) return null

    return {
      hasSystemPrompt: Boolean(selectedChat.systemPrompt?.trim()),
      hasAgentFiles: Boolean(selectedChat.agentFilePaths?.length),
      hasAPIConfigs: Boolean(selectedChat.apiConfigs?.length),
      messageCount: selectedChat.messages.length,
      apiCallEnabled: selectedChat.enableAPICall !== false
    }
  }, [selectedChat])

  // アシスタントが選択されていない場合の表示
  if (!selectedChat) {
    return (
      <Flex
        direction="column"
        height="100%"
        bg="gray.50"
        align="center"
        justify="center"
        p={8}
      >
        <VStack spacing={4}>
          <Text fontSize="xl" color="gray.500" textAlign="center">
            アシスタントを選択してください
          </Text>
          <Text fontSize="sm" color="gray.400" textAlign="center">
            左のサイドバーからアシスタントを選択するか、
            <br />
            新しいアシスタントを作成してください。
          </Text>
        </VStack>
      </Flex>
    )
  }

  // 期限切れの場合の表示
  if (isExpired) {
    return (
      <Flex
        direction="column"
        height="100%"
        bg="red.50"
        align="center"
        justify="center"
        p={8}
      >
        <Alert status="error" borderRadius="md" maxW="md">
          <AlertIcon />
          <Box>
            <AlertTitle>アプリケーションの有効期限が切れています</AlertTitle>
            <AlertDescription>
              最新版をダウンロードしてご利用ください。
            </AlertDescription>
          </Box>
        </Alert>
      </Flex>
    )
  }

  return (
    <Flex direction="column" height="100%" bg="white">
      {/* アシスタント設定パネル */}
      <Box bg="gray.50" borderBottom="1px solid #ddd" p={4}>
        <VStack align="stretch" spacing={4}>
          {/* アシスタント基本情報 */}
          <Box>
            <Text fontSize="lg" fontWeight="bold" color="gray.700" mb={3}>
              {selectedChat.customTitle}
            </Text>
            
            <HStack spacing={4} flexWrap="wrap">
              <Badge colorScheme={assistantInfo?.hasSystemPrompt ? 'green' : 'gray'}>
                {assistantInfo?.hasSystemPrompt ? 'プロンプト設定済み' : 'プロンプト未設定'}
              </Badge>
              <Badge colorScheme={assistantInfo?.hasAgentFiles ? 'blue' : 'gray'}>
                {assistantInfo?.hasAgentFiles ? 
                  `${selectedChat.agentFilePaths?.length}個のファイル` : 
                  'ファイルなし'
                }
              </Badge>
              <Badge colorScheme={assistantInfo?.messageCount > 0 ? 'purple' : 'gray'}>
                {assistantInfo?.messageCount}件のメッセージ
              </Badge>
              {isExternalApiEnabled && (
                <Badge colorScheme={assistantInfo?.hasAPIConfigs ? 'orange' : 'gray'}>
                  {assistantInfo?.hasAPIConfigs ? 
                    `${selectedChat.apiConfigs?.length}個のAPI` : 
                    'API未設定'
                  }
                </Badge>
              )}
            </HStack>
          </Box>

          <Divider />

          {/* 設定コントロール */}
          <VStack align="stretch" spacing={3}>
            {/* システムプロンプト編集 */}
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="medium">システムプロンプト</Text>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FiEdit />}
                onClick={handleShowPromptModal}
              >
                編集
              </Button>
            </HStack>

            {/* エージェントファイル使用設定 */}
            {assistantInfo?.hasAgentFiles && (
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="use-agent-file" mb="0" fontSize="sm" flex="1">
                  エージェントファイルを送信に含める
                </FormLabel>
                <Switch
                  id="use-agent-file"
                  isChecked={useAgentFile}
                  onChange={handleUseAgentFileChange}
                  colorScheme="blue"
                />
              </FormControl>
            )}

            {/* API設定 */}
            {isExternalApiEnabled && (
              <HStack justify="space-between">
                <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="medium">外部API設定</Text>
                  <Text fontSize="xs" color="gray.500">
                    {assistantInfo?.apiCallEnabled ? '有効' : '無効'}
                  </Text>
                </VStack>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<LuSettings />}
                  onClick={handleShowAPISettings}
                >
                  設定
                </Button>
              </HStack>
            )}

            <Divider />

            {/* APIキー設定 */}
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontSize="sm" fontWeight="medium">APIキー</Text>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleShowApiKeySettings}
                >
                  設定
                </Button>
              </HStack>
              
              {!isLoadingApiKey && (
                <HStack>
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    isReadOnly
                    size="sm"
                    bg="gray.100"
                    placeholder="APIキーが設定されていません"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleToggleApiKeyVisibility}
                  >
                    {showApiKey ? '隠す' : '表示'}
                  </Button>
                </HStack>
              )}
            </VStack>
          </VStack>
        </VStack>
      </Box>

      {/* メッセージ履歴 */}
      <Box flex="1" overflowY="auto" ref={chatHistoryRef}>
        <MessageList
          messages={messages}
          onCopy={onMessageCopy}
          onEdit={onMessageEdit}
          editIndex={editIndex}
        />
      </Box>

      {/* 添付ファイル一覧 */}
      {tempFiles.length > 0 && (
        <Box borderTop="1px solid #ddd" bg="white">
          <AttachmentList
            tempFiles={tempFiles}
            onDelete={onTempFileDelete}
          />
        </Box>
      )}

      {/* 入力フォーム */}
      <Box borderTop="1px solid #ddd" bg="white" p={4}>
        <ChatInputForm
          inputMessage={inputMessage}
          isLoading={isLoading}
          onInputChange={onInputChange}
          onSendMessage={handleSendMessage}
          onKeyPress={onKeyPress}
          onFileSelection={handleFileSelection}
          onDrop={onDrop}
          onDragOver={onDragOver}
          chatInputRef={chatInputRef}
          placeholder="メッセージを入力してください..."
        />
      </Box>

      {/* ファイル入力（非表示） */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={() => {}} // 実際のハンドラーは親コンポーネントで設定
      />
    </Flex>
  )
})

SettingsPanel.displayName = 'SettingsPanel'
