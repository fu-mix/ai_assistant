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
  List,
  ListItem,
  Flex,
  Box,
  HStack,
  IconButton,
  useToast
} from '@chakra-ui/react'
import { FiEdit } from 'react-icons/fi'
import { AiOutlineDelete } from 'react-icons/ai'
import { APIConfig } from '../types'
import { APIConfigEditor } from './APIConfigEditor'

/**
 * APISettingsModalのprops型
 */
interface APISettingsModalProps {
  isOpen: boolean
  onClose: () => void
  apiConfigs: APIConfig[]
  onSave: (configs: APIConfig[]) => void
  directSave?: boolean // 直接保存モードのフラグ
}

/**
 * API設定モーダルコンポーネント
 */
export const APISettingsModal = memo<APISettingsModalProps>(
  ({ isOpen, onClose, apiConfigs = [], onSave, directSave = false }) => {
    const toast = useToast()
    const [localConfigs, setLocalConfigs] = useState<APIConfig[]>([])
    const [currentEditConfig, setCurrentEditConfig] = useState<APIConfig | null>(null)
    const [isAddingConfig, setIsAddingConfig] = useState(false)

    // モーダルが開いたら設定をコピー
    useEffect(() => {
      if (isOpen) {
        setLocalConfigs(JSON.parse(JSON.stringify(apiConfigs)))
      }
    }, [isOpen, apiConfigs])

    const handleAddConfig = useCallback(() => {
      const newConfig: APIConfig = {
        id: `api-${Date.now()}`,
        name: '新しいAPI',
        description: '',
        endpoint: '',
        method: 'GET',
        headers: {},
        authType: 'none',
        triggers: []
      }
      setCurrentEditConfig(newConfig)
      setIsAddingConfig(true)
    }, [])

    const handleEditConfig = useCallback((config: APIConfig) => {
      setCurrentEditConfig(JSON.parse(JSON.stringify(config)))
      setIsAddingConfig(false)
    }, [])

    const handleSaveConfig = useCallback(
      (config: APIConfig) => {
        let updatedConfigs: APIConfig[]

        if (isAddingConfig) {
          updatedConfigs = [...localConfigs, config]
          setLocalConfigs(updatedConfigs)
        } else {
          updatedConfigs = localConfigs.map((c) => (c.id === config.id ? config : c))
          setLocalConfigs(updatedConfigs)
        }

        // 直接保存モードの場合は親コンポーネントの onSave を呼び出す
        if (directSave) {
          onSave(updatedConfigs)

          // 直接保存時のトースト通知
          toast({
            title: 'API設定を保存しました',
            description: '変更がすぐに適用されました',
            status: 'success',
            duration: 2000,
            isClosable: true
          })
        }

        setCurrentEditConfig(null)
        setIsAddingConfig(false)
      },
      [isAddingConfig, localConfigs, directSave, onSave, toast]
    )

    const handleDeleteConfig = useCallback(
      (id: string) => {
        const updatedConfigs = localConfigs.filter((c) => c.id !== id)
        setLocalConfigs(updatedConfigs)

        // 直接保存モードの場合は削除時も親コンポーネントの onSave を呼び出す
        if (directSave) {
          onSave(updatedConfigs)

          toast({
            title: 'API設定を削除しました',
            description: '変更がすぐに適用されました',
            status: 'success',
            duration: 2000,
            isClosable: true
          })
        }
      },
      [localConfigs, directSave, onSave, toast]
    )

    const handleSaveAll = useCallback(() => {
      onSave(localConfigs)
      toast({
        title: 'API設定を保存しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
      onClose()
    }, [localConfigs, onSave, onClose, toast])

    const handleCancelEdit = useCallback(() => {
      setCurrentEditConfig(null)
      setIsAddingConfig(false)
    }, [])

    return (
      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="outside">
        <ModalOverlay />
        <ModalContent
          maxW="4xl"
          h="calc(90vh)"
          position="relative"
          display="flex"
          flexDirection="column"
        >
          <ModalHeader position="sticky" top={0} bg="white" zIndex={1} borderBottomWidth="1px">
            外部API設定
          </ModalHeader>

          {/* スクロール可能なコンテンツエリア */}
          <Box position="relative" flex="1" overflow="hidden">
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              overflowY="auto"
              px={6}
              pt={4}
              pb={16}
              onWheel={(e) => e.stopPropagation()}
            >
              {currentEditConfig ? (
                <Box width="100%" pb={24}>
                  <APIConfigEditor
                    config={currentEditConfig}
                    onSave={handleSaveConfig}
                    onCancel={handleCancelEdit}
                    applyDirectly={directSave}
                  />
                </Box>
              ) : (
                <>
                  <Button colorScheme="blue" mb={4} onClick={handleAddConfig}>
                    新しいAPIを追加
                  </Button>

                  {localConfigs.length === 0 ? (
                    <Text>
                      設定されたAPIはありません。「新しいAPIを追加」ボタンから作成してください。
                    </Text>
                  ) : (
                    <List spacing={3}>
                      {localConfigs.map((config) => (
                        <ListItem key={config.id} p={3} borderWidth="1px" borderRadius="md">
                          <Flex justify="space-between" align="center">
                            <Box>
                              <Text fontWeight="bold">{config.name}</Text>
                              <Text fontSize="sm" color="gray.600">
                                {config.method} {config.endpoint}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                トリガー:{' '}
                                {config.triggers.length > 0
                                  ? config.triggers
                                      .map((t) => (t.type === 'keyword' ? t.value : 'パターン'))
                                      .join(', ')
                                  : 'なし'}
                              </Text>
                            </Box>
                            <HStack>
                              <IconButton
                                icon={<FiEdit />}
                                aria-label="編集"
                                size="sm"
                                onClick={() => handleEditConfig(config)}
                              />
                              <IconButton
                                icon={<AiOutlineDelete />}
                                aria-label="削除"
                                size="sm"
                                colorScheme="red"
                                onClick={() => handleDeleteConfig(config.id)}
                              />
                            </HStack>
                          </Flex>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* 固定フッター */}
          {!currentEditConfig && (
            <Box
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              borderTopWidth="1px"
              bg="white"
              zIndex={10}
              p={4}
              display="flex"
              justifyContent="flex-end"
            >
              <Button mr={3} onClick={onClose}>
                キャンセル
              </Button>
              <Button colorScheme="blue" onClick={handleSaveAll}>
                保存
              </Button>
            </Box>
          )}
        </ModalContent>
      </Modal>
    )
  }
)

APISettingsModal.displayName = 'APISettingsModal'
