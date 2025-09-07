import { memo } from 'react'
import { Flex, HStack, Textarea, Checkbox, Text, Switch, IconButton, Input } from '@chakra-ui/react'
import { IoSend } from 'react-icons/io5'
import { LuPaperclip } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'

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
    const { t } = useTranslation()
    // 送信ボタンの無効化条件をメモ化
    const isSendDisabled = disabled || inputMessage.length === 0

    // プレースホルダーテキストをメモ化
    const placeholderText =
      selectedChatId === 'autoAssist' ? t('autoAssist.placeholder', 'オートアシストに依頼する...') : t('chat.placeholder')

    // 条件付きレンダリング用のフラグをメモ化
    const showAgentFileCheckbox = typeof selectedChatId === 'number'
    const showAgentModeSwitch = selectedChatId === 'autoAssist'

    return (
      <Flex 
        p={6} 
        borderTop="none" 
        bg="white"
        align="end"
        position="relative"
        _before={{
          content: '""',
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60px',
          height: '3px',
          bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 'full'
        }}
      >
        <HStack spacing={4} w="100%" align="end">
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
            borderRadius="16px"
            border="2px solid"
            borderColor="gray.200"
            _hover={{
              borderColor: 'purple.300'
            }}
            _focus={{
              borderColor: 'purple.400',
              boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)'
            }}
            bg="gray.50"
            px={4}
            py={3}
            fontSize="md"
            fontWeight="500"
            _placeholder={{
              color: 'gray.500',
              fontSize: 'md'
            }}
            transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          />

          <Flex direction="column" spacing={2} align="end">
            {showAgentFileCheckbox && (
              <Checkbox
                isChecked={useAgentFile}
                onChange={onUseAgentFileChange}
                isDisabled={isLoading || disabled}
                colorScheme="purple"
                size="sm"
                mb={2}
              >
                <Text fontSize="sm" color="gray.600" fontWeight="500">
                  {t('chat.useAssistantFile')}
                </Text>
              </Checkbox>
            )}

            {showAgentModeSwitch && (
              <HStack align="center" mb={2}>
                <Text fontSize="sm" color="gray.600" fontWeight="500">
                  {t('chat.agentMode')}
                </Text>
                <Switch
                  isChecked={agentMode}
                  onChange={onAgentModeChange}
                  colorScheme="purple"
                  size="sm"
                  isDisabled={isLoading || disabled}
                />
              </HStack>
            )}

            <HStack spacing={3}>
              <IconButton
                icon={<LuPaperclip />}
                aria-label={t('chat.attachFile', 'ファイル添付')}
                onClick={onFileSelect}
                isDisabled={disabled}
                bg="white"
                color="purple.500"
                _hover={{
                  bg: 'purple.50',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)'
                }}
                _active={{
                  transform: 'translateY(0px)'
                }}
                borderRadius="12px"
                border="2px solid"
                borderColor="purple.200"
                transition="all 0.2s ease"
                size="md"
              />

              <IconButton
                icon={<IoSend />}
                aria-label={t('common.send', '送信')}
                onClick={onSendMessage}
                isLoading={isLoading}
                isDisabled={isSendDisabled}
                bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                color="white"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.35)'
                }}
                _active={{
                  transform: 'translateY(0px)'
                }}
                _disabled={{
                  bg: 'gray.300',
                  transform: 'none',
                  boxShadow: 'none'
                }}
                borderRadius="12px"
                border="none"
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                size="md"
              />
            </HStack>
          </Flex>

          <Input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,.html,.htm,.png,.jpg,.jpeg,.gif,.csv"
            multiple
            onChange={onFileChange}
            display="none"
          />
        </HStack>
      </Flex>
    )
  }
)

ChatInputForm.displayName = 'ChatInputForm'
