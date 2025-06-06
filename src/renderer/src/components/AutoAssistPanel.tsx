import { memo, useCallback } from 'react'
import {
  Box,
  Flex,
  Button,
  Text,
  VStack,
  HStack,
  Switch,
  FormControl,
  FormLabel,
  Badge,
  Divider
} from '@chakra-ui/react'
import { MessageList } from './MessageList'
import { ChatInputForm } from './ChatInputForm'
import { AttachmentList } from './AttachmentList'
import type { Message, AutoAssistState, SubtaskInfo } from './types'

interface AutoAssistPanelProps {
  messages: Message[]
  inputMessage: string
  isLoading: boolean
  tempFiles: { name: string; data: string; mimeType: string }[]
  autoAssistState: AutoAssistState
  pendingSubtasks: SubtaskInfo[]
  agentMode: boolean
  editIndex: number | null
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFileSelection: () => void
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onDragOver: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onTempFileDelete: (targetName: string) => void
  onMessageCopy: (content: string) => void
  onMessageEdit: (index: number, content: string) => void
  onAgentModeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onExecuteSubtasks: () => void
  chatInputRef: React.RefObject<HTMLTextAreaElement>
  chatHistoryRef: React.RefObject<HTMLDivElement>
}

export const AutoAssistPanel = memo(({
  messages,
  inputMessage,
  isLoading,
  tempFiles,
  autoAssistState,
  pendingSubtasks,
  agentMode,
  editIndex,
  onInputChange,
  onSendMessage,
  onKeyPress,
  onFileSelection,
  onDrop,
  onDragOver,
  onTempFileDelete,
  onMessageCopy,
  onMessageEdit,
  onAgentModeChange,
  onExecuteSubtasks,
  chatInputRef,
  chatHistoryRef
}: AutoAssistPanelProps) => {
  // メッセージ送信ハンドラーのメモ化
  const handleSendMessage = useCallback(() => {
    onSendMessage()
  }, [onSendMessage])

  // ファイル選択ハンドラーのメモ化
  const handleFileSelection = useCallback(() => {
    onFileSelection()
  }, [onFileSelection])

  // タスク実行ハンドラーのメモ化
  const handleExecuteSubtasks = useCallback(() => {
    onExecuteSubtasks()
  }, [onExecuteSubtasks])

  // エージェントモード変更ハンドラーのメモ化
  const handleAgentModeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onAgentModeChange(e)
  }, [onAgentModeChange])

  return (
    <Flex direction="column" height="100%" bg="gray.50">
      {/* オートアシスト情報パネル */}
      <Box bg="blue.50" borderBottom="1px solid #ddd" p={4}>
        <VStack align="stretch" spacing={3}>
          {/* ヘッダー情報 */}
          <Flex justify="space-between" align="center">
            <Text fontSize="lg" fontWeight="bold" color="blue.700">
              オートアシスト
            </Text>
            <HStack spacing={2}>
              {autoAssistState === 'awaitConfirm' && (
                <Badge colorScheme="yellow" variant="solid">確認待ち</Badge>
              )}
              {autoAssistState === 'executing' && (
                <Badge colorScheme="blue" variant="solid">実行中</Badge>
              )}
            </HStack>
          </Flex>

          {/* 説明文 */}
          <Text fontSize="sm" color="gray.600">
            複雑なタスクを自動的に分解し、最適なアシスタントに振り分けて実行します。
          </Text>

          {/* エージェントモード設定 */}
          <FormControl display="flex" alignItems="center">
            <FormLabel htmlFor="agent-mode" mb="0" fontSize="sm">
              エージェントモード（確認なしで自動実行）
            </FormLabel>
            <Switch
              id="agent-mode"
              isChecked={agentMode}
              onChange={handleAgentModeChange}
              colorScheme="blue"
            />
          </FormControl>

          {/* 保留中のタスク表示 */}
          {pendingSubtasks.length > 0 && autoAssistState === 'awaitConfirm' && (
            <>
              <Divider />
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={2} color="blue.700">
                  実行予定のタスク:
                </Text>
                <VStack align="stretch" spacing={2}>
                  {pendingSubtasks.map((task, index) => (
                    <Box
                      key={index}
                      p={2}
                      bg="white"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="blue.200"
                    >
                      <Text fontSize="sm" fontWeight="medium">
                        タスク{index + 1}: {task.task}
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        推奨アシスタント: {task.recommendedAssistant || 'AutoAssist'}
                      </Text>
                    </Box>
                  ))}
                </VStack>
                <Button
                  mt={3}
                  colorScheme="blue"
                  size="sm"
                  onClick={handleExecuteSubtasks}
                  isLoading={isLoading}
                  loadingText="実行中..."
                >
                  今すぐ実行
                </Button>
              </Box>
            </>
          )}
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
          autoAssistState={autoAssistState}
          onInputChange={onInputChange}
          onSendMessage={handleSendMessage}
          onKeyPress={onKeyPress}
          onFileSelection={handleFileSelection}
          onDrop={onDrop}
          onDragOver={onDragOver}
          chatInputRef={chatInputRef}
          placeholder={
            autoAssistState === 'awaitConfirm'
              ? 'Yes で実行 / No でキャンセル'
              : '複雑なタスクを入力してください...'
          }
        />
      </Box>
    </Flex>
  )
})

AutoAssistPanel.displayName = 'AutoAssistPanel'
