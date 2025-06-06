import { useState, memo, useCallback } from 'react'
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
        setHeadersJsonError('無効なJSONフォーマットです')
      }
    }, [])

    const handleAddTrigger = useCallback(() => {
      if (!newTriggerValue.trim()) return

      setTriggers((prev) => [
        ...prev,
        {
          type: newTriggerType,
          value: newTriggerValue.trim(),
          description:
            newTriggerDescription.trim() ||
            `${newTriggerType === 'keyword' ? 'キーワード' : 'パターン'}トリガー`
        }
      ])

      setNewTriggerValue('')
      setNewTriggerDescription('')
    }, [newTriggerType, newTriggerValue, newTriggerDescription])

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
        title: 'API設定を保存しました',
        description: '変更がすぐに適用されました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    }, [localConfig, triggers, onSave, toast])

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
          <FormLabel>API名</FormLabel>
          <Input
            value={localConfig.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="天気API、検索API など"
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>API説明</FormLabel>
          <Input
            value={localConfig.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="このAPIの機能や用途を説明"
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>エンドポイント</FormLabel>
          <Input
            value={localConfig.endpoint}
            onChange={(e) => handleChange('endpoint', e.target.value)}
            placeholder="https://api.example.com/data"
          />
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>メソッド</FormLabel>
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
          <FormLabel>認証タイプ</FormLabel>
          <Select
            value={localConfig.authType || 'none'}
            onChange={(e) => handleChange('authType', e.target.value)}
          >
            <option value="none">認証なし</option>
            <option value="apiKey">APIキー</option>
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic認証</option>
          </Select>
        </FormControl>

        {localConfig.authType === 'apiKey' && (
          <>
            <FormControl mb={4}>
              <FormLabel>APIキー名</FormLabel>
              <Input
                value={localConfig.authConfig?.keyName || ''}
                onChange={(e) => handleAuthChange('keyName', e.target.value)}
                placeholder="X-API-Key"
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>APIキー値</FormLabel>
              <InputGroup>
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={localConfig.authConfig?.keyValue || ''}
                  onChange={(e) => handleAuthChange('keyValue', e.target.value)}
                  placeholder="your-api-key"
                />
                <InputRightElement width="4.5rem">
                  <Button h="1.75rem" size="sm" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? '隠す' : '表示'}
                  </Button>
                </InputRightElement>
              </InputGroup>
              <FormHelperText>APIキーは安全に保管され、ローカルに保存されます</FormHelperText>
            </FormControl>

            <FormControl mb={4}>
              <Checkbox
                isChecked={localConfig.authConfig?.inHeader || false}
                onChange={(e) => handleAuthChange('inHeader', e.target.checked)}
              >
                ヘッダーに含める (チェックしない場合はクエリパラメータ)
              </Checkbox>
            </FormControl>
          </>
        )}

        {localConfig.authType === 'bearer' && (
          <FormControl mb={4}>
            <FormLabel>Bearer Token</FormLabel>
            <InputGroup>
              <Input
                type={showBearerToken ? 'text' : 'password'}
                value={localConfig.authConfig?.token || ''}
                onChange={(e) => handleAuthChange('token', e.target.value)}
                placeholder="your-access-token"
              />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" onClick={() => setShowBearerToken(!showBearerToken)}>
                  {showBearerToken ? '隠す' : '表示'}
                </Button>
              </InputRightElement>
            </InputGroup>
            <FormHelperText>トークンは安全に保管され、ローカルに保存されます</FormHelperText>
          </FormControl>
        )}

        {localConfig.authType === 'basic' && (
          <>
            <FormControl mb={4}>
              <FormLabel>ユーザー名</FormLabel>
              <Input
                value={localConfig.authConfig?.username || ''}
                onChange={(e) => handleAuthChange('username', e.target.value)}
                placeholder="username"
              />
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>パスワード</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={localConfig.authConfig?.password || ''}
                  onChange={(e) => handleAuthChange('password', e.target.value)}
                  placeholder="password"
                />
                <InputRightElement width="4.5rem">
                  <Button h="1.75rem" size="sm" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? '隠す' : '表示'}
                  </Button>
                </InputRightElement>
              </InputGroup>
              <FormHelperText>パスワードは安全に保管され、ローカルに保存されます</FormHelperText>
            </FormControl>
          </>
        )}

        <FormControl mb={4} isInvalid={!!headersJsonError}>
          <FormLabel>リクエストヘッダー (JSONフォーマット)</FormLabel>
          <Textarea
            value={headersText}
            onChange={(e) => handleHeadersChange(e.target.value)}
            placeholder={'{\n  "Content-Type": "application/json"\n}'}
          />
          {headersJsonError && <FormHelperText color="red.500">{headersJsonError}</FormHelperText>}
        </FormControl>

        {(localConfig.method === 'POST' || localConfig.method === 'PUT') && (
          <FormControl mb={4}>
            <FormLabel>リクエストボディテンプレート (ES6テンプレート構文)</FormLabel>
            <Textarea
              value={localConfig.bodyTemplate || ''}
              onChange={(e) => handleChange('bodyTemplate', e.target.value)}
              placeholder={getSafeTemplate('body')}
              rows={10}
            />
            <FormHelperText>
              $&#123;params.xxx&#125; の形式でパラメータを参照できます
            </FormHelperText>
          </FormControl>
        )}

        <FormControl mb={4}>
          <FormLabel>クエリパラメータテンプレート (ES6テンプレート構文)</FormLabel>
          <Textarea
            value={localConfig.queryParamsTemplate || ''}
            onChange={(e) => handleChange('queryParamsTemplate', e.target.value)}
            placeholder={getSafeTemplate('query')}
          />
          <FormHelperText>$&#123;params.xxx&#125; の形式でパラメータを参照できます</FormHelperText>
        </FormControl>

        <FormControl mb={4}>
          <FormLabel>レスポンステンプレート (ES6テンプレート構文)</FormLabel>
          <Textarea
            value={localConfig.responseTemplate || ''}
            onChange={(e) => handleChange('responseTemplate', e.target.value)}
            placeholder={getSafeTemplate('response')}
          />
          <FormHelperText>responseObj 変数でAPIレスポンスにアクセスできます</FormHelperText>
        </FormControl>

        <FormControl mt={4}>
          <FormLabel>レスポンスタイプ</FormLabel>
          <RadioGroup
            value={responseType}
            onChange={(val) => setResponseType(val as 'text' | 'image')}
          >
            <HStack spacing={5}>
              <Radio value="text">テキスト</Radio>
              <Radio value="image">画像</Radio>
            </HStack>
          </RadioGroup>
        </FormControl>

        {responseType === 'image' && (
          <FormControl mt={4}>
            <FormLabel>画像データパス</FormLabel>
            <Input
              value={imageDataPath}
              onChange={(e) => setImageDataPath(e.target.value)}
              placeholder="例: data[0].b64_json"
            />
            <FormHelperText>
              レスポンスJSON内の画像データ（Base64）の場所を指定します。例: data[0].b64_json
            </FormHelperText>
          </FormControl>
        )}

        <Divider my={6} />

        <Heading size="md" mb={4}>
          APIトリガー設定
        </Heading>
        <Text fontSize="sm" color="gray.600" mb={4}>
          以下のトリガーに一致するとAPIが呼び出されます。複数設定できます。
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
                        {trigger.type === 'keyword' ? 'キーワード' : 'パターン'}
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
                      aria-label="削除"
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
              トリガーが設定されていません。少なくとも1つのトリガーを追加することをお勧めします。
            </Text>
          </Box>
        )}

        {/* 新しいトリガーの追加 */}
        <Box mb={6} p={4} borderWidth="1px" borderRadius="md">
          <Heading size="sm" mb={3}>
            新しいトリガーを追加
          </Heading>

          <FormControl mb={3}>
            <FormLabel>トリガータイプ</FormLabel>
            <RadioGroup
              value={newTriggerType}
              onChange={(v) => setNewTriggerType(v as 'keyword' | 'pattern')}
            >
              <HStack spacing={5}>
                <Radio value="keyword">キーワード (カンマ区切り)</Radio>
                <Radio value="pattern">パターン (正規表現)</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>{newTriggerType === 'keyword' ? 'キーワード' : 'パターン'}</FormLabel>
            <Input
              value={newTriggerValue}
              onChange={(e) => setNewTriggerValue(e.target.value)}
              placeholder={
                newTriggerType === 'keyword'
                  ? '例: 天気,気象,気温'
                  : '例: (東京|大阪|名古屋)の(天気|気温)'
              }
            />
            <FormHelperText>
              {newTriggerType === 'keyword'
                ? 'カンマで区切って複数のキーワードを指定できます。いずれかのキーワードが含まれるとトリガーされます。'
                : '正規表現パターンを指定します。パターンに一致するとトリガーされます。'}
            </FormHelperText>
          </FormControl>

          <FormControl mb={3}>
            <FormLabel>説明 (オプション)</FormLabel>
            <Input
              value={newTriggerDescription}
              onChange={(e) => setNewTriggerDescription(e.target.value)}
              placeholder="例: 天気に関する質問を検出"
            />
          </FormControl>

          <Button
            colorScheme="blue"
            onClick={handleAddTrigger}
            isDisabled={!newTriggerValue.trim()}
          >
            トリガーを追加
          </Button>
        </Box>

        <HStack spacing={4} justify="flex-end" mt={6}>
          <Button onClick={onCancel}>キャンセル</Button>
          <Button colorScheme="blue" onClick={handleSaveConfig}>
            保存
          </Button>
        </HStack>

        {/* 確認ダイアログを追加 */}
        <Modal isOpen={isSaveConfirmOpen} onClose={() => setIsSaveConfirmOpen(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>設定を保存</ModalHeader>
            <ModalBody>
              <Text>この設定変更を直接適用しますか？</Text>
              <Text fontSize="sm" color="gray.600" mt={2}>
                ※この変更はすぐに適用されます。元の設定画面で「保存」を押す必要はありません。
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button mr={3} onClick={() => setIsSaveConfirmOpen(false)}>
                キャンセル
              </Button>
              <Button colorScheme="blue" onClick={handleConfirmDirectSave}>
                保存して適用
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    )
  }
)

APIConfigEditor.displayName = 'APIConfigEditor'
