import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  VStack,
  useToast
} from '@chakra-ui/react'

/**
 * ImportModeModalのprops型
 */
interface ImportModeModalProps {
  isOpen: boolean
  onClose: () => void
  importedRaw: string | null
  onReplace: (raw: string) => void
  onAppend: (raw: string) => void
}

/**
 * インポートモード選択モーダルコンポーネント
 */
export const ImportModeModal = memo<ImportModeModalProps>(({
  isOpen,
  onClose,
  importedRaw,
  onReplace,
  onAppend
}) => {
  const { t } = useTranslation()
  const toast = useToast()

  // インポートデータが有効なJSONか確認する関数
  const validateImportData = useCallback((data: string | null): boolean => {
    if (!data) return false

    try {
      const parsed = JSON.parse(data)
      // 最低限、agentsプロパティが配列であることを確認
      return Array.isArray(parsed.agents)
    } catch (err) {
      console.error('インポートデータのJSON解析エラー:', err)
      return false
    }
  }, [])

  const handleReplace = useCallback(() => {
    if (!importedRaw) {
      toast({
        title: t('common.error'),
        description: t('import.importError'),
        status: 'error',
        duration: 2000,
        isClosable: true
      })
      return
    }

    // データ検証
    if (!validateImportData(importedRaw)) {
      toast({
        title: t('common.error'),
        description: t('validation.unsupportedFormat'),
        status: 'error',
        duration: 2000,
        isClosable: true
      })
      return
    }

    onReplace(importedRaw)
    onClose()
  }, [importedRaw, validateImportData, onReplace, onClose, toast, t])

  const handleAppend = useCallback(() => {
    if (!importedRaw) {
      toast({
        title: t('common.error'),
        description: t('import.importError'),
        status: 'error',
        duration: 2000,
        isClosable: true
      })
      return
    }

    // データ検証
    if (!validateImportData(importedRaw)) {
      toast({
        title: t('common.error'),
        description: t('validation.unsupportedFormat'),
        status: 'error',
        duration: 2000,
        isClosable: true
      })
      return
    }

    onAppend(importedRaw)
    onClose()
  }, [importedRaw, validateImportData, onAppend, onClose, toast, t])

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t('import.title')}</ModalHeader>
        <ModalBody>
          <Text mb={3}>{t('import.title')}</Text>
          <VStack align="stretch" spacing={3}>
            <Button colorScheme="teal" variant="outline" onClick={handleAppend}>
              {t('import.appendMode')}
            </Button>
            <Button colorScheme="blue" variant="outline" onClick={handleReplace}>
              {t('import.replaceMode')}
            </Button>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

ImportModeModal.displayName = 'ImportModeModal'
