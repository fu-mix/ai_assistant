import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@chakra-ui/react'

type APITrigger = {
  type: 'keyword' | 'pattern'
  value: string
  description: string
}

type APIConfig = {
  id: string
  name: string
  description?: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: Record<string, string>
  bodyTemplate?: string
  queryParamsTemplate?: string
  responseTemplate?: string
  authType?: 'none' | 'basic' | 'bearer' | 'apiKey'
  authConfig?: {
    username?: string
    password?: string
    token?: string
    keyName?: string
    keyValue?: string
    inHeader?: boolean
  }
  triggers: APITrigger[]
  parameterExtraction?: {
    paramName: string
    description: string
  }[]
  responseType?: 'text' | 'image'
  imageDataPath?: string
}

interface UseAPIManagementReturn {
  // 状態
  apiKey: string
  isLoadingApiKey: boolean
  showApiKey: boolean

  // アクション
  setApiKey: (key: string) => void
  setShowApiKey: (show: boolean) => void

  // メソッド
  loadApiKey: () => Promise<void>
  saveApiKey: (key: string) => Promise<void>
  detectTriggeredAPIs: (userMessage: string, apiConfigs: APIConfig[]) => Promise<APIConfig[]>
  processAPITriggers: (
    userMessage: string,
    apiConfigs: APIConfig[],
    apiKey: string,
    selectedChat?: any
  ) => Promise<{
    processedMessage: string
    imageResponse?: { base64Data: string; prompt: string } | null
    isImageOnly?: boolean
  }>
  extractParametersWithLLM: (
    userMessage: string,
    apiConfig: APIConfig,
    apiKey: string
  ) => Promise<any>
  enhanceSystemPromptWithAPIContext: (
    originalPrompt: string,
    apiConfigs: APIConfig[],
    apiResult?: any
  ) => string
}

export const useAPIManagement = (): UseAPIManagementReturn => {
  const toast = useToast()

  // 状態
  const [apiKey, setApiKey] = useState<string>('')
  const [isLoadingApiKey, setIsLoadingApiKey] = useState<boolean>(true)
  const [showApiKey, setShowApiKey] = useState<boolean>(false)

  // APIキー読み込み
  const loadApiKey = useCallback(async () => {
    try {
      setIsLoadingApiKey(true)
      const savedApiKey = await window.electronAPI.loadApiKey()
      if (savedApiKey) {
        setApiKey(savedApiKey)
      }
    } catch (err) {
      console.error('Failed to load API key:', err)
      toast({
        title: 'エラー',
        description: 'APIキーの読み込みに失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setIsLoadingApiKey(false)
    }
  }, [toast])

  // APIキー保存
  const saveApiKey = useCallback(async (key: string) => {
    try {
      await window.electronAPI.saveApiKey(key)
      setApiKey(key)
      toast({
        title: 'APIキーを保存しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (err) {
      console.error('Failed to save API key:', err)
      toast({
        title: 'エラー',
        description: 'APIキーの保存に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [toast])

  // API検知関数 - ユーザーメッセージからトリガーされるAPIを検出
  const detectTriggeredAPIs = useCallback(async (
    userMessage: string,
    apiConfigs: APIConfig[]
  ): Promise<APIConfig[]> => {
    const triggeredAPIs: APIConfig[] = []

    for (const apiConfig of apiConfigs) {
      // トリガーが設定されていない場合はスキップ
      if (!apiConfig.triggers || apiConfig.triggers.length === 0) {
        continue
      }

      let isTriggered = false

      // 各トリガーをチェック
      for (const trigger of apiConfig.triggers) {
        if (trigger.type === 'keyword') {
          // キーワードタイプのトリガー
          const keywords = trigger.value.split(',').map((k) => k.trim())

          if (
            keywords.some((keyword) => {
              const found = userMessage.toLowerCase().includes(keyword.toLowerCase())
              return found
            })
          ) {
            isTriggered = true
            break
          }
        } else if (trigger.type === 'pattern') {
          // パターンタイプのトリガー
          try {
            const regex = new RegExp(trigger.value, 'i')
            const match = regex.test(userMessage)

            if (match) {
              isTriggered = true
              break
            }
          } catch (err) {
            console.error(`無効な正規表現パターン: ${trigger.value}`, err)
          }
        }
      }

      if (isTriggered) {
        triggeredAPIs.push(apiConfig)
      }
    }

    return triggeredAPIs
  }, [])

  // LLMを使用したパラメータ抽出
  const extractParametersWithLLM = useCallback(async (
    userMessage: string,
    apiConfig: APIConfig,
    apiKey: string
  ): Promise<any> => {
    // デフォルトパラメータの設定
    const defaultParams: any = {}

    // トリガーがキーワードタイプの場合、promptパラメータを設定
    if (apiConfig.triggers && apiConfig.triggers.length > 0) {
      for (const trigger of apiConfig.triggers) {
        if (trigger.type === 'keyword') {
          const keywords = trigger.value.split(',').map((k) => k.trim())
          for (const keyword of keywords) {
            if (userMessage.toLowerCase().includes(keyword.toLowerCase())) {
              // キーワードを削除せず、元のメッセージをpromptパラメータとして設定
              defaultParams.prompt = userMessage
              // トークンがconfig経由で提供されている場合は使用
              if (apiConfig.authConfig?.token) {
                defaultParams.apiKey = apiConfig.authConfig.token
              }
              break
            }
          }
        }
      }
    }

    // パラメータ抽出設定がない場合はデフォルトパラメータを返す
    if (!apiConfig.parameterExtraction || apiConfig.parameterExtraction.length === 0) {
      return defaultParams
    }

    // パラメータ抽出設定がある場合はLLMを使用して抽出
    const extractionPrompt = `
あなたはパラメータ抽出エンジンです。
ユーザーのメッセージから必要なパラメータを抽出してください。

ユーザーメッセージ:
"${userMessage}"

抽出すべきパラメータ:
${apiConfig.parameterExtraction.map((p) => `- ${p.paramName}: ${p.description}`).join('\n')}

結果は以下のJSON形式で返してください:
{
  "パラメータ名": "抽出値"
}
余計な説明は不要です。JSONだけを返してください。
`

    try {
      const extractionResponse = await window.electronAPI.postChatAI(
        [{ role: 'user', parts: [{ text: extractionPrompt }] }],
        apiKey,
        'あなたはパラメータ抽出エンジンです。JSONだけを返してください。'
      )

      const jsonMatch = extractionResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return defaultParams
      }

      try {
        const extractedParams = JSON.parse(jsonMatch[0])

        // APIキーの追加
        if (apiConfig.authConfig?.token) {
          extractedParams.apiKey = apiConfig.authConfig.token
        }

        // オリジナルのメッセージを保持するためにoriginalMessageパラメータを追加
        extractedParams.originalMessage = userMessage

        return extractedParams
      } catch (parseError) {
        console.error('パラメータJSON解析エラー:', parseError)
        return defaultParams
      }
    } catch (err) {
      console.error('パラメータ抽出中にエラー:', err)
      return defaultParams
    }
  }, [])

  // API処理関数 - 検出されたAPIを実行し結果を統合
  const processAPITriggers = useCallback(async (
    userMessage: string,
    apiConfigs: APIConfig[],
    apiKey: string,
    selectedChat?: any
  ): Promise<{
    processedMessage: string
    imageResponse?: { base64Data: string; prompt: string } | null
    isImageOnly?: boolean
  }> => {
    const isExternalApiEnabled = import.meta.env.VITE_ENABLE_EXTERNAL_API !== 'false'

    // 外部API機能が無効の場合は処理しない
    if (!isExternalApiEnabled) {
      return { processedMessage: userMessage }
    }

    // トリガーされたAPIを検出
    const triggeredAPIs = await detectTriggeredAPIs(userMessage, apiConfigs)

    if (triggeredAPIs.length === 0) {
      return { processedMessage: userMessage } // APIトリガーなし
    }

    let processedMessage = userMessage
    let imageResponse = null
    let isImageOnly = false

    for (const apiConfig of triggeredAPIs) {
      try {
        // パラメータ抽出
        const params = await extractParametersWithLLM(userMessage, apiConfig, apiKey)

        // 会話履歴がある場合は適切な形式に変換
        if (selectedChat && selectedChat.messages && selectedChat.messages.length > 0) {
          // OpenAI形式のフォーマット済み会話履歴
          const openAIFormattedHistory = selectedChat.messages.map((msg: any) => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
          params.openAIFormattedHistory = openAIFormattedHistory
          params.openAIFormattedHistoryStr = JSON.stringify(openAIFormattedHistory).slice(1, -1)

          // Gemini形式のフォーマット済み会話履歴
          const geminiFormattedHistory = selectedChat.messages.map((msg: any) => ({
            role: msg.type === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }))
          params.geminiFormattedHistory = geminiFormattedHistory
          params.geminiFormattedHistoryStr = JSON.stringify(geminiFormattedHistory).slice(1, -1)
        }

        // オリジナルの会話履歴も含める
        params.conversationHistory = selectedChat?.messages || []
        params.prompt = userMessage

        // callExternalAPIメソッドの存在確認
        if (!window.electronAPI.callExternalAPI) {
          console.error('callExternalAPI機能が実装されていません')
          processedMessage += `\n\n[補足情報: ${apiConfig.name}]\nAPI呼び出し機能が利用できません。`
          continue
        }

        // API呼び出し実行
        const apiResponse = await window.electronAPI.callExternalAPI(apiConfig, params)

        // 画像レスポンスの場合
        if (apiResponse.success && apiConfig.responseType === 'image' && apiResponse.data) {
          imageResponse = {
            base64Data: apiResponse.data,
            prompt: userMessage
          }

          const isImageGenerationTrigger =
            apiConfig.responseType === 'image' &&
            apiConfig.triggers.some((trigger) => {
              if (trigger.type === 'keyword') {
                const keywords = trigger.value.split(',').map((k) => k.trim().toLowerCase())
                return keywords.some((keyword) =>
                  userMessage.toLowerCase().includes(keyword.toLowerCase())
                )
              } else if (trigger.type === 'pattern') {
                try {
                  const regex = new RegExp(trigger.value, 'i')
                  return regex.test(userMessage)
                } catch (err) {
                  console.error(`無効な正規表現パターン: ${trigger.value}`, err)
                  return false
                }
              }
              return false
            })

          if (isImageGenerationTrigger) {
            isImageOnly = true
          }

          continue
        }

        // 結果テキスト生成
        let resultText = ''
        if (apiResponse.success) {
          resultText =
            typeof apiResponse.data === 'string'
              ? apiResponse.data
              : JSON.stringify(apiResponse.data, null, 2)
        } else {
          resultText = `エラー: ${apiResponse.error || '不明なエラー'}`
        }

        // メッセージに結果を追加
        processedMessage += `\n\n[補足情報: ${apiConfig.name}]\n${resultText}`
      } catch (err) {
        console.error(`API呼び出し失敗: ${apiConfig.name}`, err)
        processedMessage += `\n\n[補足情報: ${apiConfig.name}]\nAPI呼び出し中にエラーが発生しました。`
      }
    }

    return { processedMessage, imageResponse, isImageOnly }
  }, [detectTriggeredAPIs, extractParametersWithLLM])

  // APIに渡すシステムプロンプトを強化する関数
  const enhanceSystemPromptWithAPIContext = useCallback((
    originalPrompt: string,
    apiConfigs: APIConfig[],
    apiResult?: any
  ): string => {
    if (!apiConfigs || apiConfigs.length === 0) {
      return originalPrompt
    }

    // API情報の説明テキスト
    const apiInfo = apiConfigs
      .map((api) => {
        return `
- API名: ${api.name}
  - 説明: ${api.description || 'なし'}
  - 提供する情報: ${api.triggers.map((t) => t.description).join(', ') || 'なし'}
  `
      })
      .join('\n')

    // API実行結果の情報を追加
    let apiResultInfo = ''
    if (apiResult) {
      if (apiResult.error) {
        apiResultInfo = `
注意: 直近のユーザーメッセージに対するAPI呼び出しに失敗しました。
エラー: ${apiResult.error}

これは内部エラーであり、ユーザーには通知されていません。
通常通り対応し、このエラーについては言及しないでください。
`
      } else if (
        apiResult.processedMessage &&
        apiResult.processedMessage !== apiResult.originalMessage
      ) {
        // APIが成功して追加情報が含まれている場合
        apiResultInfo = `
注意: 直近のユーザーメッセージに対して、API呼び出しが実行され、追加情報が含まれています。
オリジナルメッセージ: "${apiResult.originalMessage}"
APIから追加された情報も含むメッセージ: "${apiResult.processedMessage}"

この情報はユーザーに表示されません。ユーザーは追加された情報を認識していないため、
回答には自然に情報を織り込んでください。
`
      }
    }

    // システムプロンプトに追加
    return `
${originalPrompt}

あなたには様々な外部情報へのアクセス機能があります。ユーザーの質問やリクエストによっては、これらの情報源からデータが自動的に提供されます。以下は利用可能な情報源のリストです：

${apiInfo}
${apiResultInfo}

これらの情報源からのデータはユーザーの質問に含まれる場合があります。このデータを使って最適な回答を提供してください。

データが提供されている場合は、その情報を活用して回答してください。ユーザーには「このデータは〇〇APIから取得しました」などと説明する必要はありません。自然な回答に情報を組み込んでください。

データが提供されていない場合でも、一般的な知識に基づいて最善の回答を提供してください。
`
  }, [])

  // 初期化時にAPIキーを読み込み
  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])

  return {
    // 状態
    apiKey,
    isLoadingApiKey,
    showApiKey,

    // アクション
    setApiKey,
    setShowApiKey,

    // メソッド
    loadApiKey,
    saveApiKey,
    detectTriggeredAPIs,
    processAPITriggers,
    extractParametersWithLLM,
    enhanceSystemPromptWithAPIContext
  }
}
