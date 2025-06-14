import { useState, useEffect, memo, useCallback } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Textarea,
  useToast
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { ChatInfo } from '../types'

/**
 * AutoAssistSettingsModalのprops型
 */
interface AutoAssistSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  chats: ChatInfo[]
  onSave: (chats: ChatInfo[]) => void
  onResetAutoAssist: () => void
}

/**
 * オートアシスト設定モーダルコンポーネント
 */
export const AutoAssistSettingsModal = memo<AutoAssistSettingsModalProps>(({
  isOpen,
  onClose,
  chats,
  onSave,
  onResetAutoAssist
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [localChats, setLocalChats] = useState<ChatInfo[]>([])

  const AUTO_ASSIST_ID = 999999

  useEffect(() => {
    if (isOpen) {
      setLocalChats(JSON.parse(JSON.stringify(chats)))
    }
  }, [isOpen, chats])

  const handleChangeSummary = useCallback((id: number, summary: string) => {
    setLocalChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, assistantSummary: summary } : c))
    )
  }, [])

  const handleSave = useCallback(async () => {
    try {
      onSave(localChats)
      toast({
        title: t('common.success'),
        description: t('assistant.updateSuccess'),
        status: 'success',
        duration: 2000,
        isClosable: true
      })
      onClose()
    } catch (err) {
      console.error('save agent summaries error:', err)
      toast({
        title: t('common.error'),
        description: t('errors.saveFailed'),
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [localChats, onSave, onClose, toast, t])

  const handleResetConfirm = useCallback(() => {
    onResetAutoAssist()
  }, [onResetAutoAssist])

  // オートアシスト以外のチャットをフィルタリング
  const filteredChats = localChats.filter((chat) => chat.id !== AUTO_ASSIST_ID)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t('assistant.autoAssist')} {t('common.settings')}</ModalHeader>
        <ModalBody>
          <Text mb={4} fontSize="sm" color="gray.600">
            {t('assistant.autoAssistDescription')}
          </Text>

          <Box maxH="480px" overflowY="auto" mb={4}>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>{t('assistant.name')}</Th>
                  <Th>{t('assistant.summary')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredChats.map((c) => (
                  <Tr key={c.id}>
                    <Td>{c.id}</Td>
                    <Td>{c.customTitle}</Td>
                    <Td>
                      <Textarea
                        value={c.assistantSummary || ''}
                        onChange={(e) => handleChangeSummary(c.id, e.target.value)}
                        size="sm"
                        placeholder={t('assistant.summary')}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          <Box textAlign="center">
            <Button colorScheme="red" variant="outline" onClick={handleResetConfirm}>
              {t('chat.resetConversation')}
            </Button>
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button mr={3} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

AutoAssistSettingsModal.displayName = 'AutoAssistSettingsModal'
