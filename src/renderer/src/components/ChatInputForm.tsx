import { memo } from 'react'
import { Flex, HStack, Textarea, Checkbox, Text, Switch, IconButton, Input } from '@chakra-ui/react'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip } from 'react-icons/lu'

interface ChatInputFormProps {
  inputMessage: string
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onDragOver: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onSendMessage: () => void
  onFileSelect: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  useAgentFile: boolean
  onUseAgentFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  agentMode: boolean
  onAgentModeChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  isLoading: boolean
  disabled: boolean
  selectedChatId: number | null | 'autoAssist'
  chatInputRef: React.RefObject<HTMLTextAreaElement>
  fileInputRef: React.RefObject<HTMLInputElement>
}

/**
 * チャット入力フォームコンポーネント
 * メモ化により、propsが変更されない限り再レンダリングを防止
 */
export const ChatInputForm = memo<ChatInputFormProps>(
  ({
    inputMessage,
    onInputChange,
    onKeyPress,
    onDrop,
    onDragOver,
    onSendMessage,
    onFileSelect,
    onFileChange,
    useAgentFile,
    onUseAgentFileChange,
    agentMode,
    onAgentModeChange,
    isLoading,
    disabled,
    selectedChatId,
    chatInputRef,
    fileInputRef
  }) => {
    // 送信ボタンの無効化条件をメモ化
    const isSendDisabled = disabled || inputMessage.length === 0

    // プレースホルダーテキストをメモ化
    const placeholderText =
      selectedChatId === 'autoAssist' ? 'オートアシストに依頼する...' : 'メッセージを入力...'

    // 条件付きレンダリング用のフラグをメモ化
    const showAgentFileCheckbox = typeof selectedChatId === 'number'
    const showAgentModeSwitch = selectedChatId === 'autoAssist'

    return (
      <Flex p={4} borderTop="1px" borderColor="gray.200" align="end">
        <HStack spacing={3} w="100%">
          <Textarea
            ref={chatInputRef}
            value={inputMessage}
            onChange={onInputChange}
            onKeyPress={onKeyPress}
            onDrop={onDrop}
            onDragOver={onDragOver}
            placeholder={placeholderText}
            resize="vertical"
            flex="1"
            isDisabled={disabled}
          />

          {showAgentFileCheckbox && (
            <Checkbox
              isChecked={useAgentFile}
              onChange={onUseAgentFileChange}
              isDisabled={isLoading || disabled}
            >
              ナレッジを使用する
            </Checkbox>
          )}

          {showAgentModeSwitch && (
            <HStack align="center">
              <Text fontSize="sm">エージェントモード</Text>
              <Switch
                isChecked={agentMode}
                onChange={onAgentModeChange}
                colorScheme="teal"
                isDisabled={isLoading || disabled}
              />
            </HStack>
          )}

          <IconButton
            icon={<LuPaperclip />}
            aria-label="ファイル添付"
            onClick={onFileSelect}
            isDisabled={disabled}
          />

          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,.html,.htm,.png,.jpg,.jpeg,.gif,.csv"
            multiple
            onChange={onFileChange}
            display="none"
          />

          <IconButton
            icon={<IoSend />}
            aria-label="送信"
            onClick={onSendMessage}
            isLoading={isLoading}
            isDisabled={isSendDisabled}
          />
        </HStack>
      </Flex>
    )
  }
)

ChatInputForm.displayName = 'ChatInputForm'
