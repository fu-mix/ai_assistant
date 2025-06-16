import { useState, useCallback, memo, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  Text,
  RadioGroup,
  Radio,
  Stack,
  Box,
  useToast,
  HStack,
  Icon,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  FormHelperText
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { MdLanguage, MdApi, MdSettings } from 'react-icons/md'
import { APIConfig } from '../types'
import { APISettingsModal } from './APISettingsModal'
import { changeLanguage, Language } from '../../i18n'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  apiConfigs: APIConfig[]
  onSaveApiConfigs: (configs: APIConfig[]) => void
}

export const SettingsModal = memo<SettingsModalProps>(
  ({ isOpen, onClose, apiConfigs, onSaveApiConfigs }) => {
    const { t, i18n } = useTranslation()
    const toast = useToast()
    const [selectedTab, setSelectedTab] = useState(0)
    const [showApiModal, setShowApiModal] = useState(false)
    
    // APIキー管理
    const [apiKey, setApiKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [isLoadingApiKey, setIsLoadingApiKey] = useState(false)

    const currentLanguage = i18n.language as Language

    // APIキー関連の関数
    const loadSavedApiKey = useCallback(async () => {
      try {
        setIsLoadingApiKey(true)
        // @ts-ignore
        const savedKey = await window.electronAPI?.loadApiKey()
        if (savedKey) {
          setApiKey(savedKey)
        }
      } catch (err) {
        console.error('Failed to load API key:', err)
      } finally {
        setIsLoadingApiKey(false)
      }
    }, [])

    const saveApiKey = useCallback(async (key: string) => {
      try {
        // @ts-ignore
        await window.electronAPI?.saveApiKey(key)
        toast({
          title: t('common.success'),
          description: 'APIキーを保存しました',
          status: 'success',
          duration: 2000,
          isClosable: true
        })
      } catch (err) {
        console.error('Failed to save API key:', err)
        toast({
          title: t('common.error'),
          description: 'APIキーの保存に失敗しました',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
      }
    }, [t, toast])

    const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setApiKey(e.target.value)
    }, [])

    const handleApiKeyBlur = useCallback(() => {
      if (apiKey && apiKey.trim() !== '') {
        saveApiKey(apiKey)
      }
    }, [apiKey, saveApiKey])

    const toggleApiKeyVisibility = useCallback(() => {
      setShowApiKey(prev => !prev)
    }, [])

    // モーダルが開いたらAPIキーを読み込み
    useEffect(() => {
      if (isOpen) {
        loadSavedApiKey()
      }
    }, [isOpen, loadSavedApiKey])

    const handleLanguageChange = useCallback(
      async (language: Language) => {
        try {
          await changeLanguage(language)
          toast({
            title: t('common.success'),
            description: t('settings.language.changeSuccess'),
            status: 'success',
            duration: 2000,
            isClosable: true
          })
        } catch (error) {
          console.error('Failed to change language:', error)
          toast({
            title: t('common.error'),
            description: t('settings.language.changeError'),
            status: 'error',
            duration: 3000,
            isClosable: true
          })
        }
      },
      [t, toast]
    )

    const handleOpenApiSettings = useCallback(() => {
      setShowApiModal(true)
    }, [])

    const handleCloseApiSettings = useCallback(() => {
      setShowApiModal(false)
    }, [])

    const handleSaveApiSettings = useCallback(
      (configs: APIConfig[]) => {
        onSaveApiConfigs(configs)
        handleCloseApiSettings()
      },
      [onSaveApiConfigs, handleCloseApiSettings]
    )

    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="outside">
          <ModalOverlay />
          <ModalContent maxW="4xl" h="calc(80vh)">
            <ModalHeader borderBottomWidth="1px">
              <HStack spacing={2}>
                <Icon as={MdSettings} />
                <Text>{t('settings.title')}</Text>
              </HStack>
            </ModalHeader>

            <ModalBody p={0}>
              <Tabs
                index={selectedTab}
                onChange={setSelectedTab}
                orientation="vertical"
                variant="line"
                h="100%"
              >
                <TabList minW="180px" borderRightWidth="1px" pt={4}>
                  <Tab justifyContent="flex-start" px={6} py={3}>
                    <HStack spacing={3}>
                      <Icon as={MdSettings} />
                      <Text>{t('settings.tabs.general')}</Text>
                    </HStack>
                  </Tab>
                  <Tab justifyContent="flex-start" px={6} py={3}>
                    <HStack spacing={3}>
                      <Icon as={MdLanguage} />
                      <Text>{t('settings.tabs.language')}</Text>
                    </HStack>
                  </Tab>
                  <Tab justifyContent="flex-start" px={6} py={3}>
                    <HStack spacing={3}>
                      <Icon as={MdApi} />
                      <Text>{t('api.title')}</Text>
                    </HStack>
                  </Tab>
                  <Tab justifyContent="flex-start" px={6} py={3}>
                    <HStack spacing={3}>
                      <Icon as={MdApi} />
                      <Text>{t('settings.tabs.api')}</Text>
                    </HStack>
                  </Tab>
                </TabList>

                <TabPanels flex="1">
                  {/* 一般設定 */}
                  <TabPanel p={6}>
                    <VStack align="stretch" spacing={6}>
                      <Box>
                        <Text fontSize="xl" fontWeight="semibold" mb={2}>
                          {t('settings.tabs.general')}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          一般的な設定オプションです。
                        </Text>
                      </Box>
                      {/* 将来的に追加する一般設定項目のプレースホルダー */}
                      <Box p={4} bg="gray.50" borderRadius="md">
                        <Text color="gray.500" fontSize="sm">
                          今後、追加の設定項目がここに表示されます。
                        </Text>
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* 言語設定 */}
                  <TabPanel p={6}>
                    <VStack align="stretch" spacing={6}>
                      <Box>
                        <Text fontSize="xl" fontWeight="semibold" mb={2}>
                          {t('settings.language.title')}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          {t('settings.language.description')}
                        </Text>
                      </Box>

                      <Box>
                        <Text mb={4} fontWeight="medium">
                          {t('settings.language.current')}: {currentLanguage === 'ja' ? '日本語' : 'English'}
                        </Text>
                        
                        <RadioGroup
                          value={currentLanguage}
                          onChange={handleLanguageChange}
                        >
                          <Stack spacing={4}>
                            <Radio value="ja" size="lg">
                              <HStack spacing={3}>
                                <Text fontSize="lg">{t('settings.language.japanese')}</Text>
                                <Text fontSize="sm" color="gray.500">
                                  (Japanese)
                                </Text>
                              </HStack>
                            </Radio>
                            <Radio value="en" size="lg">
                              <HStack spacing={3}>
                                <Text fontSize="lg">{t('settings.language.english')}</Text>
                                <Text fontSize="sm" color="gray.500">
                                  (English)
                                </Text>
                              </HStack>
                            </Radio>
                          </Stack>
                        </RadioGroup>
                      </Box>
                    </VStack>
                  </TabPanel>

                  {/* APIキー設定 */}
                  <TabPanel p={6}>
                    <VStack align="stretch" spacing={6}>
                      <Box>
                        <Text fontSize="xl" fontWeight="semibold" mb={2}>
                          {t('api.title')}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          Google AI (Gemini) APIキーを設定します。
                        </Text>
                      </Box>

                      <FormControl>
                        <FormLabel htmlFor="api-key-input">{t('api.apiKey')}</FormLabel>
                        <InputGroup size="md">
                          <Input
                            id="api-key-input"
                            value={apiKey}
                            onChange={handleApiKeyChange}
                            onBlur={handleApiKeyBlur}
                            placeholder={t('api.apiKeyPlaceholder')}
                            type={showApiKey ? 'text' : 'password'}
                            pr="4.5rem"
                            isDisabled={isLoadingApiKey}
                          />
                          <InputRightElement width="4.5rem">
                            <Button h="1.75rem" size="sm" onClick={toggleApiKeyVisibility}>
                              {showApiKey ? t('api.hideKey') : t('api.showKey')}
                            </Button>
                          </InputRightElement>
                        </InputGroup>
                        <FormHelperText>{t('api.apiKeyHelp')}</FormHelperText>
                      </FormControl>
                    </VStack>
                  </TabPanel>

                  {/* 外部API設定 */}
                  <TabPanel p={6}>
                    <VStack align="stretch" spacing={6}>
                      <Box>
                        <Text fontSize="xl" fontWeight="semibold" mb={2}>
                          {t('settings.tabs.api')}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          外部API連携の設定を管理します。
                        </Text>
                      </Box>

                      <Box>
                        <Button
                          colorScheme="blue"
                          onClick={handleOpenApiSettings}
                          leftIcon={<Icon as={MdApi} />}
                        >
                          API設定を開く
                        </Button>
                        <Text fontSize="sm" color="gray.500" mt={2}>
                          現在 {apiConfigs.length} 個のAPIが設定されています
                        </Text>
                      </Box>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ModalBody>

            <ModalFooter borderTopWidth="1px">
              <Button onClick={onClose}>
                {t('common.close')}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* API設定モーダル */}
        <APISettingsModal
          isOpen={showApiModal}
          onClose={handleCloseApiSettings}
          apiConfigs={apiConfigs}
          onSave={handleSaveApiSettings}
          directSave={true}
        />
      </>
    )
  }
)

SettingsModal.displayName = 'SettingsModal'
