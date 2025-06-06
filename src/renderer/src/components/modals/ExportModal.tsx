import { useState, useEffect, memo, useCallback } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  HStack,
  Box,
  Checkbox,
  useToast
} from '@chakra-ui/react'
import { ChatInfo } from '../types' // 型をインポート

/**
 * ExportModalのprops型
 */
interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  chats: ChatInfo[]
  onExportAll: () => Promise<void>
  onExportSelected: (selectedIds: number[], includeHistory: boolean) => Promise<void>
}

/**
 * エクスポートモーダルコンポーネント
 */
export const ExportModal = memo<ExportModalProps>(({
  isOpen,
  onClose,
  chats,
  onExportAll,
  onExportSelected
}) => {
  const toast = useToast()
  const [mode, setMode] = useState<'all' | 'partial'>('all')
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  const [includeHistory, setIncludeHistory] = useState<boolean>(true)

  useEffect(() => {
    if (isOpen) {
      setMode('all')
      setCheckedIds([])
      setIncludeHistory(true)
    }
  }, [isOpen])

  const handleToggleCheck = useCallback((id: number) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const handleExport = useCallback(async () => {
    try {
      if (mode === 'all') {
        await onExportAll()
      } else {
        if (checkedIds.length === 0) {
          toast({
            title: 'アシスタントが選択されていません',
            status: 'warning',
            duration: 2000,
            isClosable: true
          })
          return
        }
        await onExportSelected(checkedIds, includeHistory)
      }

      toast({
        title: 'エクスポート完了',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
      onClose()
    } catch (err) {
      console.error('Export error:', err)
      toast({
        title: 'エラー',
        description: 'エクスポート中にエラーが発生しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [mode, checkedIds, includeHistory, onExportAll, onExportSelected, onClose, toast])

  // オートアシスト(ID: 999999)を除外したチャットリスト
  const exportableChats = chats.filter((c) => c.id !== 999999)

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>データのエクスポート</ModalHeader>
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>エクスポート対象</FormLabel>
            <RadioGroup value={mode} onChange={(val) => setMode(val as 'all' | 'partial')}>
              <HStack spacing={5}>
                <Radio value="all">全て(全アシスタント、タイトル設定)</Radio>
                <Radio value="partial">一部のアシスタント</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>

          {mode === 'partial' && (
            <>
              <Box
                border="1px solid #ddd"
                borderRadius="md"
                p={3}
                maxH="300px"
                overflowY="auto"
                mt={2}
                mb={2}
              >
                {exportableChats.map((chat) => (
                  <HStack key={chat.id} mb={2}>
                    <Checkbox
                      isChecked={checkedIds.includes(chat.id)}
                      onChange={() => handleToggleCheck(chat.id)}
                    >
                      {chat.customTitle}
                    </Checkbox>
                  </HStack>
                ))}
              </Box>

              <FormControl display="flex" alignItems="center" mb={2}>
                <Checkbox
                  isChecked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                >
                  会話履歴を含める
                </Checkbox>
              </FormControl>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button mr={3} onClick={onClose}>
            キャンセル
          </Button>
          <Button colorScheme="blue" onClick={handleExport}>
            エクスポート
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
})

ExportModal.displayName = 'ExportModal'
