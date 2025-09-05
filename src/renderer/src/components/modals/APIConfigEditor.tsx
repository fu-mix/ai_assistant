import { useState, memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Button,
  HStack,
  RadioGroup,
  Radio,
  Checkbox,
  InputGroup,
  InputRightElement,
  FormHelperText,
  Divider,
  Heading,
  Text,
  List,
  ListItem,
  Flex,
  Badge,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useToast
} from '@chakra-ui/react'
import { AiOutlineDelete } from 'react-icons/ai'
import { APIConfig, APITrigger } from '../types'

/**
 * APIConfigEditorのprops型
 */
interface APIConfigEditorProps {
  config: APIConfig
  onSave: (config: APIConfig) => void
  onCancel: () => void
  applyDirectly?: boolean
}

/**
 * API設定エディタコンポーネント
 */
export const APIConfigEditor = memo<APIConfigEditorProps>(
  ({ config, onSave, onCancel, applyDirectly = false }) => {
    const { t } = useTranslation()
    const [localConfig, setLocalConfig] = useState<APIConfig>({ ...config })
    const [triggers, setTriggers] = useState<APITrigger[]>(config.triggers || [])
    const [newTriggerType, setNewTriggerType] = useState<'keyword' | 'pattern'>('keyword')
    const [newTriggerValue, setNewTriggerValue] = useState('')
    const [newTriggerDescription, setNewTriggerDescription] = useState('')
    const [headersText, setHeadersText] = useState<string>(
      JSON.stringify(config.headers || {}, null, 2)
    )
    const [headersJsonError, setHeadersJsonError] = useState<string | null>(null)
    // APIキー表示/非表示の状態を管理
    const [showApiKey, setShowApiKey] = useState<boolean>(false)
    const [showBearerToken, setShowBearerToken] = useState<boolean>(false)
    const [showPassword, setShowPassword] = useState<boolean>(false)
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState<boolean>(false)

    const [responseType, setResponseType] = useState<'text' | 'image'>(
      config.responseType || 'text'
    )
    const [imageDataPath, setImageDataPath] = useState<string>(
      config.imageDataPath || 'data[0].b64_json'
    )
    const toast = useToast()

    const handleChange = useCallback((field: keyof APIConfig, value: any) => {
      setLocalConfig((prev) => ({ ...prev, [field]: value }))
    }, [])

    const handleAuthChange = useCallback((field: string, value: any) => {
      setLocalConfig((prev) => ({
        ...prev,
        authConfig: { ...(prev.authConfig || {}), [field]: value }
      }))
    }, [])

    const handleHeadersChange = useCallback((newHeadersText: string) => {
      // テキスト自体は常に更新
      setHeadersText(newHeadersText)

      try {
        // 空の場合は空オブジェクトとして扱う
        if (newHeadersText.trim() === '') {
          setLocalConfig((prev) => ({ ...prev, headers: {} }))
          setHeadersJsonError(null)

          return
        }

        // JSONとして解析を試みる
        const headers = JSON.parse(newHeadersText)
        setLocalConfig((prev) => ({ ...prev, headers }))
        setHeadersJsonError(null)
      } catch (err) {
        // JSON解析エラーの場合、エラーメッセージを設定するが
        // テキストは保持したまま
        console.error('Invalid JSON for headers:', err)
        setHeadersJsonError(t('apiConfig.invalidJsonFormat'))
      }
    }, [t])

    const handleAddTrigger = useCallback(() => {
      if (!newTriggerValue.trim()) return

      setTriggers((prev) => [
        ...prev,
        {
          type: newTriggerType,
          value: newTriggerValue.trim(),
          description:
            newTriggerDescription.trim() ||
            `${newTriggerType === 'keyword' ? t('apiConfig.triggers.keywordTrigger') : t('apiConfig.triggers.patternTrigger')}`
        }
      ])

      setNewTriggerValue('')
      setNewTriggerDescription('')
    }, [newTriggerType, newTriggerValue, newTriggerDescription, t])

    const handleRemoveTrigger = useCallback((index: number) => {
      setTriggers((prev) => prev.filter((_, i) => i !== index))
    }, [])

    const handleSaveConfig = useCallback(() => {
      const updatedConfig = {
        ...localConfig,
        triggers,
        responseType,
        imageDataPath: responseType === 'image' ? imageDataPath : undefined
      }

      if (applyDirectly) {
        // 直接適用する場合は確認ダイアログを表示
        setIsSaveConfirmOpen(true)
      } else {
        // 通常の保存処理
        onSave(updatedConfig)
      }
    }, [localConfig, triggers, responseType, imageDataPath, applyDirectly, onSave])

    const handleConfirmDirectSave = useCallback(() => {
      const updatedConfig = {
        ...localConfig,
        triggers
      }
      onSave(updatedConfig)
      setIsSaveConfirmOpen(false)

      // 保存成功のトースト通知を表示
      toast({
        title: t('apiConfig.saveSuccess'),
        description: t('apiConfig.saveSuccessDescription'),
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    }, [localConfig, triggers, onSave, toast, t])

    // 展開するテンプレートの例を安全に作成する関数
    const getSafeTemplate = useCallback((type: string) => {
      if (type === 'body') {
        return `{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "\${params.prompt}"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 2048
  }
}`
      } else if (type === 'query') {
        return '{\n  "q": "${params.query}",\n  "limit": 10\n}'
      } else if (type === 'response') {
        return '${responseObj.candidates[0].content.parts[0].text}'
      }

      return ''
    }, [])

    return (
      <Box>
        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.apiName')}</FormLabel>
          <Input
            value={localConfig.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={t('apiConfig.apiNamePlaceholder')}
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.description')}</FormLabel>
          <Input
            value={localConfig.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder={t('apiConfig.descriptionPlaceholder')}
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.endpoint')}</FormLabel>
          <Input
            value={localConfig.endpoint}
            onChange={(e) => handleChange('endpoint', e.target.value)}
            placeholder={t('apiConfig.endpointPlaceholder')}
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.method')}</FormLabel>
          <Select
            value={localConfig.method}
            onChange={(e) => handleChange('method', e.target.value)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </Select>
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.authType')}</FormLabel>
          <Select
            value={localConfig.authType || 'none'}
            onChange={(e) => handleChange('authType', e.target.value)}
          >
            <option value="none">{t('apiConfig.authTypeOptions.none')}</option>
            <option value="apiKey">{t('apiConfig.authTypeOptions.apiKey')}</option>
            <option value="bearer">{t('apiConfig.authTypeOptions.bearer')}</option>
            <option value="basic">{t('apiConfig.authTypeOptions.basic')}</option>
          </Select>
        </FormControl>

        {localConfig.authType === 'apiKey' && (
          <>
            <FormControl mb={4}>
              <FormLabel>{t('apiConfig.apiKeyName')}</FormLabel>
              <Input
                value={localConfig.authConfig?.keyName || ''}
                onChange={(e) => handleAuthChange('keyName', e.target.value)}
                placeholder={t('apiConfig.apiKeyNamePlaceholder')}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>{t('apiConfig.apiKeyValue')}</FormLabel>
              <InputGroup>
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={localConfig.authConfig?.keyValue || ''}
                  onChange={(e) => handleAuthChange('keyValue', e.target.value)}
                  placeholder={t('apiConfig.apiKeyValuePlaceholder')}
                />
                <InputRightElement width="4.5rem">
                  <Button h="1.75rem" size="sm" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? t('api.hideKey') : t('api.showKey')}
                  </Button>
                </InputRightElement>
              </InputGroup>
              <FormHelperText>{t('apiConfig.apiKeyHelp')}</FormHelperText>
            </FormControl>

            <FormControl mb={4}>
              <Checkbox
                isChecked={localConfig.authConfig?.inHeader || false}
                onChange={(e) => handleAuthChange('inHeader', e.target.checked)}
              >
                {t('apiConfig.includeInHeader')}
              </Checkbox>
            </FormControl>
          </>
        )}

        {localConfig.authType === 'bearer' && (
          <FormControl mb={4}>
            <FormLabel>{t('apiConfig.bearerToken')}</FormLabel>
            <InputGroup>
              <Input
                type={showBearerToken ? 'text' : 'password'}
                value={localConfig.authConfig?.token || ''}
                onChange={(e) => handleAuthChange('token', e.target.value)}
                placeholder={t('apiConfig.bearerTokenPlaceholder')}
              />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" onClick={() => setShowBearerToken(!showBearerToken)}>
                  {showBearerToken ? t('api.hideKey') : t('api.showKey')}
                </Button>
              </InputRightElement>
            </InputGroup>
            <FormHelperText>{t('apiConfig.bearerTokenHelp')}</FormHelperText>
          </FormControl>
        )}

        {localConfig.authType === 'basic' && (
          <>
            <FormControl mb={4}>
              <FormLabel>{t('apiConfig.username')}</FormLabel>
              <Input
                value={localConfig.authConfig?.username || ''}
                onChange={(e) => handleAuthChange('username', e.target.value)}
                placeholder={t('apiConfig.usernamePlaceholder')}
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>{t('apiConfig.password')}</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={localConfig.authConfig?.password || ''}
                  onChange={(e) => handleAuthChange('password', e.target.value)}
                  placeholder={t('apiConfig.passwordPlaceholder')}
                />
                <InputRightElement width="4.5rem">
                  <Button h="1.75rem" size="sm" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? t('api.hideKey') : t('api.showKey')}
                  </Button>
                </InputRightElement>
              </InputGroup>
              <FormHelperText>{t('apiConfig.passwordHelp')}</FormHelperText>
            </FormControl>
          </>
        )}

        <FormControl mb={4} isInvalid={!!headersJsonError}>
          <FormLabel>{t('apiConfig.requestHeaders')}</FormLabel>
          <Textarea
            value={headersText}
            onChange={(e) => handleHeadersChange(e.target.value)}
            placeholder={t('apiConfig.requestHeadersPlaceholder')}
          />
          {headersJsonError && <FormHelperText color="red.500">{t('apiConfig.invalidJsonFormat')}</FormHelperText>}
        </FormControl>

        {(localConfig.method === 'POST' || localConfig.method === 'PUT') && (
          <FormControl mb={4}>
            <FormLabel>{t('apiConfig.requestBodyTemplate')}</FormLabel>
            <Textarea
              value={localConfig.bodyTemplate || ''}
              onChange={(e) => handleChange('bodyTemplate', e.target.value)}
              placeholder={getSafeTemplate('body')}
              rows={10}
            />
            <FormHelperText>
              {t('apiConfig.templateHelp')}
            </FormHelperText>
          </FormControl>
        )}

        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.queryParamsTemplate')}</FormLabel>
          <Textarea
            value={localConfig.queryParamsTemplate || ''}
            onChange={(e) => handleChange('queryParamsTemplate', e.target.value)}
            placeholder={getSafeTemplate('query')}
          />
          <FormHelperText>{t('apiConfig.templateHelp')}</FormHelperText>
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>{t('apiConfig.responseTemplate')}</FormLabel>
          <Textarea
            value={localConfig.responseTemplate || ''}
            onChange={(e) => handleChange('responseTemplate', e.target.value)}
            placeholder={getSafeTemplate('response')}
          />
          <FormHelperText>{t('apiConfig.responseTemplateHelp')}</FormHelperText>
        </FormControl>

        <FormControl mt={4}>
          <FormLabel>{t('apiConfig.responseType')}</FormLabel>
          <RadioGroup
            value={responseType}
            onChange={(val) => setResponseType(val as 'text' | 'image')}
          >
            <HStack spacing={5}>
              <Radio value="text">{t('apiConfig.responseTypeText')}</Radio>
              <Radio value="image">{t('apiConfig.responseTypeImage')}</Radio>
            </HStack>
          </RadioGroup>
        </FormControl>

        {responseType === 'image' && (
          <FormControl mt={4}>
            <FormLabel>{t('apiConfig.imageDataPath')}</FormLabel>
            <Input
              value={imageDataPath}
              onChange={(e) => setImageDataPath(e.target.value)}
              placeholder={t('apiConfig.imageDataPathPlaceholder')}
            />
            <FormHelperText>
              {t('apiConfig.imageDataPathHelp')}
            </FormHelperText>
          </FormControl>
        )}

        <Divider my={6} />

        <Heading size="md" mb={4}>
          {t('apiConfig.triggers.title')}
        </Heading>
        <Text fontSize="sm" color="gray.600" mb={4}>
          {t('apiConfig.triggers.description')}
        </Text>

        {/* 現在のトリガーリスト */}
        {triggers.length > 0 ? (
          <Box mb={4}>
            <List spacing={2}>
              {triggers.map((trigger, index) => (
                <ListItem key={index} p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Badge colorScheme={trigger.type === 'keyword' ? 'blue' : 'purple'}>
                        {trigger.type === 'keyword' ? t('apiConfig.triggers.keyword') : t('apiConfig.triggers.pattern')}
                      </Badge>
                      <Text mt={1} fontWeight="bold">
                        {trigger.value}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {trigger.description}
                      </Text>
                    </Box>
                    <IconButton
                      icon={<AiOutlineDelete />}
                      aria-label={t('apiConfig.triggers.deleteButton')}
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleRemoveTrigger(index)}
                    />
                  </Flex>
                </ListItem>
              ))}
            </List>
          </Box>
        ) : (
          <Box mb={4} p={3} borderWidth="1px" borderRadius="md" bg="yellow.50">
            <Text color="yellow.800">
              {t('apiConfig.triggers.noTriggers')}
            </Text>
          </Box>
        )}

        {/* 新しいトリガーの追加 */}
        <Box mb={6} p={4} borderWidth="1px" borderRadius="md">
          <Heading size="sm" mb={3}>
            {t('apiConfig.triggers.addNew')}
          </Heading>

          <FormControl mb={3}>
            <FormLabel>{t('apiConfig.triggers.triggerType')}</FormLabel>
            <RadioGroup
              value={newTriggerType}
              onChange={(v) => setNewTriggerType(v as 'keyword' | 'pattern')}
            >
              <HStack spacing={5}>
                <Radio value="keyword">{t('apiConfig.triggers.keywordOption')}</Radio>
                <Radio value="pattern">{t('apiConfig.triggers.patternOption')}</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>{newTriggerType === 'keyword' ? t('apiConfig.triggers.keywordLabel') : t('apiConfig.triggers.patternLabel')}</FormLabel>
            <Input
              value={newTriggerValue}
              onChange={(e) => setNewTriggerValue(e.target.value)}
              placeholder={
                newTriggerType === 'keyword'
                  ? t('apiConfig.triggers.keywordPlaceholder')
                  : t('apiConfig.triggers.patternPlaceholder')
              }
            />
            <FormHelperText>
              {newTriggerType === 'keyword'
                ? t('apiConfig.triggers.keywordHelp')
                : t('apiConfig.triggers.patternHelp')}
            </FormHelperText>
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>{t('apiConfig.triggers.descriptionLabel')}</FormLabel>
            <Input
              value={newTriggerDescription}
              onChange={(e) => setNewTriggerDescription(e.target.value)}
              placeholder={t('apiConfig.triggers.descriptionPlaceholder')}
            />
          </FormControl>

          <Button
            colorScheme="blue"
            onClick={handleAddTrigger}
            isDisabled={!newTriggerValue.trim()}
          >
            {t('apiConfig.triggers.addButton')}
          </Button>
        </Box>

        <HStack spacing={4} justify="flex-end" mt={6}>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button colorScheme="blue" onClick={handleSaveConfig}>
            {t('common.save')}
          </Button>
        </HStack>

        {/* 確認ダイアログを追加 */}
        <Modal isOpen={isSaveConfirmOpen} onClose={() => setIsSaveConfirmOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{t('apiConfig.confirmSave.title')}</ModalHeader>
            <ModalBody>
              <Text>{t('apiConfig.confirmSave.message')}</Text>
              <Text fontSize="sm" color="gray.600" mt={2}>
                {t('apiConfig.confirmSave.note')}
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button mr={3} onClick={() => setIsSaveConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button colorScheme="blue" onClick={handleConfirmDirectSave}>
                {t('apiConfig.confirmSave.saveAndApply')}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    )
  }
)

APIConfigEditor.displayName = 'APIConfigEditor'
