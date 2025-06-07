import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@chakra-ui/react'
import { Message, Messages, ChatInfo } from './useChatManagement'

type AutoAssistState = 'idle' | 'awaitConfirm' | 'executing'

type SubtaskInfo = {
  task: string
  recommendedAssistant: string | null
}

interface UseAutoAssistReturn {
  // 状態
  autoAssistMessages: Message[]
  autoAssistState: AutoAssistState
  pendingSubtasks: SubtaskInfo[]
  agentMode: boolean
  isLoading: boolean

  // アクション
  setAutoAssistMessages: (messages: Message[]) => void
  setAutoAssistState: (state: AutoAssistState) => void
  setPendingSubtasks: (subtasks: SubtaskInfo[]) => void
  setAgentMode: (mode: boolean) => void
  setIsLoading: (loading: boolean) => void

  // メソッド
  handleAutoAssistSend: (
    inputMessage: string,
    tempFiles: { name: string; data: string; mimeType: string }[],
    apiKey: string,
    chats: ChatInfo[],
    skipAddingUserMessage?: boolean
  ) => Promise<void>
  executeSubtasksAndShowOnce: (
    subtasks: SubtaskInfo[],
    originalMsg: Messages | null,
    chats: ChatInfo[],
    apiKey: string
  ) => Promise<void>
  resetAutoAssist: () => Promise<void>
  updateAutoAssistSummary: (id: number, summary: string, chats: ChatInfo[]) => Promise<ChatInfo[]>
  handleYesNoResponse: (
    inputMessage: string,
    chats: ChatInfo[],
    apiKey: string
  ) => Promise<void>

  // ユーティリティ
  csvToJson: (csv: string) => string
  buildUserParts: (
    text: string,
    files: { name: string; data: string; mimeType: string }[]
  ) => { text?: string; inlineData?: { mimeType: string; data: string } }[]
}

export const useAutoAssist = (): UseAutoAssistReturn => {
  const toast = useToast()
  const AUTO_ASSIST_ID = 999999

  // 状態
  const [autoAssistMessages, setAutoAssistMessages] = useState<Message[]>([])
  const [autoAssistState, setAutoAssistState] = useState<AutoAssistState>('idle')
  const [pendingSubtasks, setPendingSubtasks] = useState<SubtaskInfo[]>([])
  const [pendingEphemeralMsg, setPendingEphemeralMsg] = useState<Messages | null>(null)
  const [agentMode, setAgentMode] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // CSV → JSON変換ユーティリティ
  const csvToJson = useCallback((csv: string): string => {
    const lines = csv.split(/\r?\n/)
    if (lines.length <= 1) return '[]'
    const headers = lines[0].split(',')
    const result = []
    for (let i = 1; i < lines.length; i++) {
      const obj: any = {}
      const currentline = lines[i].split(',')
      if (currentline.length !== headers.length) {
        continue
      }
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentline[j]
      }
      result.push(obj)
    }
    return JSON.stringify(result, null, 2)
  }, [])

  // ユーザーパーツ構築
  const buildUserParts = useCallback((
    text: string,
    files: { name: string; data: string; mimeType: string }[]
  ): { text?: string; inlineData?: { mimeType: string; data: string } }[] => {
    const parts: Messages['parts'] = [{ text }]
    for (const f of files) {
      // CSV → JSON 変換
      if (f.mimeType === 'text/csv') {
        try {
          const csvStr = atob(f.data)
          const jsonStr = csvToJson(csvStr)
          parts[0].text += `\n---\nCSV→JSON:\n${jsonStr}`
        } catch {
          parts[0].text += '\n(CSV→JSON失敗)'
        }
      }
      parts.push({ inlineData: { mimeType: f.mimeType, data: f.data } })
    }
    return parts
  }, [csvToJson])

  // オートアシストデータ保存
  const saveAutoAssistData = useCallback(async (updatedChats: ChatInfo[]): Promise<boolean> => {
    try {
      // オートアシストの状態も別途更新
      const autoAssist = updatedChats.find((c) => c.id === AUTO_ASSIST_ID)
      if (autoAssist) {
        setAutoAssistMessages(autoAssist.messages)
      }

      // 保存を実行して完了を待つ
      await window.electronAPI.saveAgents(updatedChats)
      return true
    } catch (err) {
      console.error('Failed to save AutoAssist data:', err)
      return false
    }
  }, [])

  // タスク分解 - 各タスクに最適なアシスタントを見つける
  const findAssistantsForEachTask = useCallback(async (
    tasks: string[],
    chats: ChatInfo[],
    apiKey: string
  ): Promise<SubtaskInfo[]> => {
    const output: SubtaskInfo[] = []
    const summaries = chats
      .map((c) => `アシスタント名:"${c.customTitle}"\n要約:"${c.assistantSummary || ''}"`)
      .join('\n')

    for (let i = 0; i < tasks.length; i++) {
      const rawTask = tasks[i]
      const cleanTask = rawTask.replace(/^タスク\d+\s*:\s*/, '')

      // タスクのコンテキスト情報を追加
      let taskContext = ''
      if (tasks.length > 1) {
        taskContext = `このタスクは全${tasks.length}ステップ中の${i + 1}番目のタスクです。\n`

        if (i > 0) {
          taskContext += `前のタスク: ${tasks[i - 1].replace(/^タスク\d+\s*:\s*/, '')}\n`
        }

        if (i < tasks.length - 1) {
          taskContext += `次のタスク: ${tasks[i + 1].replace(/^タスク\d+\s*:\s*/, '')}\n`
        }
      }

      const systemPrompt = `
#タスクの内容が実施可能と考えられるもの、#アシスタント名の下の#要約から探し出し、そのアシスタント名を以下のフォーマットに従って表示してください。
#フォーマット例:
{
  "assistantTitle": "ReactAssistant"
}
#もし該当なしなら:
{
  "assistantTitle": null
}

[アシスタント一覧]
${summaries}

[タスク内容]
${cleanTask}

[タスクコンテキスト]
${taskContext}
`

      const msgs: Messages[] = [{ role: 'user', parts: [{ text: cleanTask }] }]

      let recommended: string | null = null
      try {
        const resp = await window.electronAPI.postChatAI(msgs, apiKey, systemPrompt)
        const cleanResp = resp.replaceAll('```json', '').replaceAll('```', '').trim()
        const parsed = JSON.parse(cleanResp)
        recommended = parsed.assistantTitle ?? null
      } catch (err) {
        recommended = null
      }

      output.push({ task: cleanTask, recommendedAssistant: recommended })
    }

    return output
  }, [])

  // オートアシストメッセージ送信
  const handleAutoAssistSend = useCallback(async (
    inputMessage: string,
    tempFiles: { name: string; data: string; mimeType: string }[],
    apiKey: string,
    chats: ChatInfo[],
    skipAddingUserMessage: boolean = false
  ) => {
    setIsLoading(true)

    try {
      // 現在のチャット状態のコピーを取得（常に最新の状態を使う）
      const currentChats = [...chats]

      // ユーザーメッセージを作成
      const userMsg: Message = { type: 'user', content: inputMessage }

      // postMessages用のメッセージ形式を作成
      const postUserMsg: Messages = {
        role: 'user',
        parts: [{ text: inputMessage }]
      }

      // 安全のために自動アシストエントリを明示的に検索
      const autoAssistIndex = currentChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

      if (autoAssistIndex === -1) {
        console.error('AutoAssist entry not found!')
        toast({
          title: 'エラー',
          description: 'オートアシストが見つかりません',
          status: 'error',
          duration: 3000,
          isClosable: true
        })
        setIsLoading(false)
        return
      }

      if (!skipAddingUserMessage) {
        // 既存のオートアシストを取得し、ユーザーメッセージを追加
        const autoAssist = { ...currentChats[autoAssistIndex] }

        // 既存のメッセージを保持しながら、新しいメッセージを追加
        autoAssist.messages = [...autoAssist.messages, userMsg]
        autoAssist.postMessages = [...autoAssist.postMessages, postUserMsg]
        autoAssist.inputMessage = ''

        // 新しいチャット配列を作成（オートアシストを更新）
        const updatedChats = [...currentChats]
        updatedChats[autoAssistIndex] = autoAssist

        // UIに表示を先行
        setAutoAssistMessages(autoAssist.messages)

        // 保存を実行
        await saveAutoAssistData(updatedChats)
      }

      // 入力メッセージの保存（ファイル添付用）
      const originalMsg: Messages = {
        role: 'user',
        parts: buildUserParts(inputMessage, tempFiles)
      }

      // 入力フィールドクリア
      // setInputMessage('') // これは呼び出し元で行う
      // setTempFiles([]) // これは呼び出し元で行う

      // タスク分解用のメッセージ（ファイル添付なし）
      const parseMsg: Messages = {
        role: 'user',
        parts: [{ text: originalMsg.parts[0].text || '' }]
      }

      // ファイル情報を含む元のメッセージを後で使用するため保存
      setPendingEphemeralMsg(originalMsg)

      // タスク分割のプロンプト
      const parseSystemPrompt = `
      ユーザー依頼をタスクに分割し、必ず JSON配列だけを返してください。
      以下の点に注意してタスクを分割してください：
      
      1. ユーザーの依頼内容が複数の処理を必要とする場合、論理的なステップに分割する。分割が必要無い場合は無理に分割しないこと
      2. 各タスクは明確で具体的な目標を持つようにする
      3. タスク間に依存関係がある場合（例：タスク2がタスク1の結果を必要とする）は、その順序を維持する
      4. 分割は2〜4個程度のタスクに抑え、細かすぎる分割は避ける
      5. タスクには簡潔かつ明確な名前をつける
      
      フォーマット：
      ["タスク1:添付ファイルを分析する", "タスク2:分析結果に基づいて要約を作成する"]
      
      各タスクが順番に実行され、前のタスクの結果が後続のタスクで利用可能になることを考慮してください。
      `

      // タスク分解リクエスト（ファイル添付なし）
      const parseResp = await window.electronAPI.postChatAI([parseMsg], apiKey, parseSystemPrompt)

      const splittedRaw = parseResp.replaceAll('```json', '').replaceAll('```', '').trim()
      let splitted: string[] = []
      try {
        splitted = JSON.parse(splittedRaw)
      } catch {
        splitted = [originalMsg.parts[0].text || '']
      }

      // アシスタント推奨事も同様にファイル添付しない
      const subtaskInfos = await findAssistantsForEachTask(splitted, chats, apiKey)
      setPendingSubtasks(subtaskInfos)

      const lines = subtaskInfos.map(
        (si, idx) =>
          `タスク${idx + 1} : ${si.task}\n→ 推奨アシスタント : ${si.recommendedAssistant}`
      )
      const summaryMsg = `以下のタスクに分割し、推奨アシスタントを割り当てました:\n\n${lines.join('\n\n')}`

      // AIメッセージをmessages用に作成
      const aiMsg: Message = { type: 'ai', content: summaryMsg }

      // postMessages用のメッセージも作成
      const postAiMsg: Messages = {
        role: 'model',
        parts: [{ text: summaryMsg }]
      }

      // 再度最新のチャットを取得
      const latestChats = await window.electronAPI.loadAgents()
      const autoAssistEntryIndex = latestChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

      if (autoAssistEntryIndex === -1) {
        console.error('AutoAssist entry not found when adding AI task message!')
        return
      }

      // 既存の最新オートアシストを取得
      const autoAssist = { ...latestChats[autoAssistEntryIndex] }

      // メッセージを追加
      autoAssist.messages = [...autoAssist.messages, aiMsg]
      autoAssist.postMessages = [...autoAssist.postMessages, postAiMsg]

      // 更新されたチャット配列を作成
      const updatedWithAIMessage = [...latestChats]
      updatedWithAIMessage[autoAssistEntryIndex] = autoAssist

      // UIに表示を先行
      setAutoAssistMessages(autoAssist.messages)

      // チャットの状態を更新・保存
      await saveAutoAssistData(updatedWithAIMessage)

      if (agentMode) {
        // エージェントモードON時は originalMsg を直接渡す
        await executeSubtasksAndShowOnce(subtaskInfos, originalMsg, updatedWithAIMessage, apiKey)
      } else {
        setAutoAssistState('awaitConfirm')

        // 確認メッセージをmessages用に作成
        const confirmMsg = '実行しますか？ (Yesで実行 / Noでキャンセル)'
        const confirmAiMsg: Message = { type: 'ai', content: confirmMsg }

        // postMessages用のメッセージも作成
        const postConfirmMsg: Messages = {
          role: 'model',
          parts: [{ text: confirmMsg }]
        }

        // 最新の状態を取得（API経由で再取得）
        const latestChatsAfterAI = await window.electronAPI.loadAgents()
        const confirmAutoAssistIndex = latestChatsAfterAI.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (confirmAutoAssistIndex === -1) {
          console.error('AutoAssist entry not found when adding confirm message!')
          return
        }

        // 既存のオートアシストを取得
        const confirmAutoAssist = { ...latestChatsAfterAI[confirmAutoAssistIndex] }

        // メッセージを追加
        confirmAutoAssist.messages = [...confirmAutoAssist.messages, confirmAiMsg]
        confirmAutoAssist.postMessages = [...confirmAutoAssist.postMessages, postConfirmMsg]

        // 更新されたチャット配列を作成
        const updatedWithConfirm = [...latestChatsAfterAI]
        updatedWithConfirm[confirmAutoAssistIndex] = confirmAutoAssist

        // UIに表示を先行
        setAutoAssistMessages(confirmAutoAssist.messages)

        // チャットの状態を更新・保存
        await saveAutoAssistData(updatedWithConfirm)
      }
    } catch (err) {
      console.error('handleAutoAssistSend error:', err)

      // エラーメッセージをmessages用に作成
      const errorMsg = 'タスク分割処理中にエラーが発生しました。'
      const errorAiMsg: Message = { type: 'ai', content: errorMsg }

      // postMessages用のエラーメッセージも作成
      const postErrorMsg: Messages = {
        role: 'model',
        parts: [{ text: errorMsg }]
      }

      try {
        // 最新の状態を取得
        const errorChats = await window.electronAPI.loadAgents()
        const errorAutoAssistIndex = errorChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (errorAutoAssistIndex !== -1) {
          // オートアシストを取得
          const errorAutoAssist = { ...errorChats[errorAutoAssistIndex] }

          // メッセージを追加
          errorAutoAssist.messages = [...errorAutoAssist.messages, errorAiMsg]
          errorAutoAssist.postMessages = [...errorAutoAssist.postMessages, postErrorMsg]

          // 更新されたチャット配列を作成
          const updatedWithError = [...errorChats]
          updatedWithError[errorAutoAssistIndex] = errorAutoAssist

          // UIに表示を先行
          setAutoAssistMessages(errorAutoAssist.messages)

          // チャットの状態を更新・保存
          await saveAutoAssistData(updatedWithError)
        }
      } catch (saveErr) {
        console.error('Failed to save error message:', saveErr)
      }

      // UIにエラーを追加（最低限の対応）
      setAutoAssistMessages((prev) => [...prev, errorAiMsg])

      toast({
        title: 'エラー',
        description: 'タスク分割処理中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, buildUserParts, saveAutoAssistData, findAssistantsForEachTask, agentMode])

  // サブタスク実行
  const executeSubtasksAndShowOnce = useCallback(async (
    subtasks: SubtaskInfo[],
    originalMsg: Messages | null,
    chats: ChatInfo[],
    apiKey: string
  ) => {
    setAutoAssistState('executing')
    try {
      // originalMsg が提供されていない場合は pendingEphemeralMsg を使用
      const ephemeralMsg = originalMsg || pendingEphemeralMsg

      const subtaskOutputs: string[] = []
      // タスク間で情報を継承するための配列
      const taskResults: string[] = []

      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i]
        let out = ''

        // 現在のタスク情報を設定
        const taskContext = `現在のタスク (${i + 1}/${subtasks.length}): ${st.task}`

        // 前のタスクの結果があれば、それも含める
        const previousResults =
          taskResults.length > 0 ? `\n\n前のタスクの結果:\n${taskResults.join('\n\n')}` : ''

        if (!st.recommendedAssistant) {
          // fallback
          const fallbackSystemPrompt = `
    あなたはAutoAssistです。
    以下のタスクをあなたが実行してください:
    ${st.task}
    
    ${previousResults}
    `
          // 新しいタスクメッセージを作成
          const taskMsg: Messages = {
            role: 'user',
            parts: [{ text: `${taskContext}${previousResults}` }]
          }

          // 元のメッセージに添付ファイルがあれば、新しいタスクメッセージに追加
          if (ephemeralMsg && ephemeralMsg.parts && ephemeralMsg.parts.length > 1) {
            for (let j = 1; j < ephemeralMsg.parts.length; j++) {
              if (ephemeralMsg.parts[j].inlineData) {
                taskMsg.parts.push({
                  inlineData: ephemeralMsg.parts[j].inlineData
                })
              }
            }
          }

          try {
            // 新しいタスクメッセージのみを送信
            const resp = await window.electronAPI.postChatAI(
              [taskMsg],
              apiKey,
              fallbackSystemPrompt
            )
            out = resp
          } catch (err) {
            out = '(実行中にエラー)'
          }
        } else {
          // recommended
          const asstObj = chats.find(
            (c) =>
              c.customTitle.trim().toLowerCase() === st.recommendedAssistant!.trim().toLowerCase()
          )
          if (!asstObj) {
            out = '(指定アシスタントが見つかりません)'
          } else {
            // 新しいタスクメッセージを作成
            const taskMsg: Messages = {
              role: 'user',
              parts: [{ text: `${taskContext}${previousResults}` }]
            }

            // 元のメッセージに添付ファイルがあれば、新しいタスクメッセージに追加
            if (ephemeralMsg && ephemeralMsg.parts && ephemeralMsg.parts.length > 1) {
              for (let j = 1; j < ephemeralMsg.parts.length; j++) {
                if (ephemeralMsg.parts[j].inlineData) {
                  taskMsg.parts.push({
                    inlineData: ephemeralMsg.parts[j].inlineData
                  })
                }
              }
            }

            // 拡張されたシステムプロンプト - 前のタスクの結果を考慮するよう指示
            const enhancedSystemPrompt = `
    ${asstObj.systemPrompt}
    
    現在はオートアシスト機能のタスク${i + 1}/${subtasks.length}を実行中です。
    依頼内容: ${st.task}
    ${previousResults ? '前のタスクの結果を考慮して対応してください。' : ''}
    `

            try {
              // 新しいタスクメッセージのみを送信
              const resp = await window.electronAPI.postChatAI(
                [taskMsg],
                apiKey,
                enhancedSystemPrompt
              )
              out = resp
            } catch (err) {
              out = '(アシスタント実行エラー)'
            }
          }
        }

        // タスク結果を配列に追加して次のタスクで利用できるようにする
        taskResults.push(`タスク${i + 1}の結果:\n${out}`)

        subtaskOutputs.push(
          `タスク${i + 1} : ${st.task}\n(アシスタント: ${
            st.recommendedAssistant || 'AutoAssist/fallback'
          })\n結果:\n${out}\n`
        )
      }

      // 最終結果のメッセージを作成
      const finalMerged = `以下が最終的な実行結果です:\n${subtaskOutputs.join('\n')}`

      try {
        // 最新の状態をAPIから取得
        const latestChats = await window.electronAPI.loadAgents()
        const autoAssistIndex = latestChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (autoAssistIndex === -1) {
          console.error('AutoAssist entry not found when saving final results')
          throw new Error('AutoAssist entry not found when saving final results')
        }

        // 既存のオートアシストを取得
        const autoAssist = { ...latestChats[autoAssistIndex] }

        // messages用のAIメッセージを作成
        const finalAiMsg: Message = { type: 'ai', content: finalMerged }

        // メッセージを追加
        autoAssist.messages = [...autoAssist.messages, finalAiMsg]

        // postMessages用のメッセージも作成
        const postFinalMsg: Messages = {
          role: 'model',
          parts: [{ text: finalMerged }]
        }

        // postMessagesにも追加
        autoAssist.postMessages = [...autoAssist.postMessages, postFinalMsg]

        // 更新されたチャット配列を作成
        const updatedChats = [...latestChats]
        updatedChats[autoAssistIndex] = autoAssist

        // UIに表示を先行
        setAutoAssistMessages(autoAssist.messages)

        // チャットの状態を更新・保存
        await saveAutoAssistData(updatedChats)
      } catch (saveError) {
        console.error('Error saving final results:', saveError)

        // エラーが発生しても、少なくともUIには表示する
        const finalAiMsg: Message = { type: 'ai', content: finalMerged }
        setAutoAssistMessages((prev) => [...prev, finalAiMsg])

        // トーストでユーザーに通知
        toast({
          title: '保存エラー',
          description:
            '結果の保存中にエラーが発生しました。画面には表示されますが、保存されない可能性があります。',
          status: 'error',
          duration: 5000,
          isClosable: true
        })
      }
    } catch (executionError) {
      console.error('Error executing subtasks:', executionError)

      // 実行エラーメッセージ
      const errorMsg = 'タスク実行中にエラーが発生しました。'
      const errorAiMsg: Message = { type: 'ai', content: errorMsg }

      // UIに表示
      setAutoAssistMessages((prev) => [...prev, errorAiMsg])

      // トーストでユーザーに通知
      toast({
        title: 'エラー',
        description: 'タスク実行中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    } finally {
      setPendingSubtasks([])
      setPendingEphemeralMsg(null)
      setAutoAssistState('idle')
    }
  }, [toast, pendingEphemeralMsg, saveAutoAssistData])

  // Yes/No応答処理
  const handleYesNoResponse = useCallback(async (
    inputMessage: string,
    chats: ChatInfo[],
    apiKey: string
  ) => {
    const ans = inputMessage.trim().toLowerCase()
    const userMsg: Message = { type: 'user', content: inputMessage }

    // UI表示用と保存用のチャットデータ操作を分離

    // 1. まずUIに直接表示（即時反映のため）
    setAutoAssistMessages((prev) => [...prev, userMsg])

    // 2. 保存用データの準備
    const postUserMsg: Messages = {
      role: 'user',
      parts: [{ text: inputMessage }]
    }

    try {
      // 3. 最新のチャット状態をAPIから直接取得
      const latestChats = await window.electronAPI.loadAgents()
      const autoAssistIndex = latestChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

      if (autoAssistIndex === -1) {
        throw new Error('AutoAssist entry not found when processing Yes/No response')
      }

      // 4. オートアシストエントリを取得
      const autoAssist = { ...latestChats[autoAssistIndex] }

      // 5. ユーザーメッセージを追加
      autoAssist.messages = [...autoAssist.messages, userMsg]
      autoAssist.postMessages = [...autoAssist.postMessages, postUserMsg]
      autoAssist.inputMessage = ''

      // 6. 更新されたチャット配列を作成
      const updatedWithUserMsg = [...latestChats]
      updatedWithUserMsg[autoAssistIndex] = autoAssist

      // 7. 状態を更新して保存
      await saveAutoAssistData(updatedWithUserMsg)

      if (ans === 'yes') {
        setIsLoading(true)

        // タスク実行
        await executeSubtasksAndShowOnce(pendingSubtasks, pendingEphemeralMsg, updatedWithUserMsg, apiKey)

        setIsLoading(false)
        setAutoAssistState('idle')
        return
      } else if (ans === 'no') {
        // キャンセルメッセージを作成
        const cancelMsg = 'タスク実行をキャンセルしました.'
        const cancelAiMsg: Message = { type: 'ai', content: cancelMsg }

        // UI表示を先に更新
        setAutoAssistMessages((prev) => [...prev, cancelAiMsg])

        // postMessages用のメッセージ形式も作成
        const postCancelMsg: Messages = {
          role: 'model',
          parts: [{ text: cancelMsg }]
        }

        // 最新の状態を取得
        const cancelChats = await window.electronAPI.loadAgents()
        const cancelAutoAssistIndex = cancelChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (cancelAutoAssistIndex === -1) {
          throw new Error('AutoAssist entry not found when processing cancel')
        }

        // オートアシストを取得
        const cancelAutoAssist = { ...cancelChats[cancelAutoAssistIndex] }

        // メッセージを追加
        cancelAutoAssist.messages = [...cancelAutoAssist.messages, cancelAiMsg]
        cancelAutoAssist.postMessages = [...cancelAutoAssist.postMessages, postCancelMsg]

        // 更新されたチャット配列を作成
        const updatedWithCancel = [...cancelChats]
        updatedWithCancel[cancelAutoAssistIndex] = cancelAutoAssist

        // 状態を更新して保存
        await saveAutoAssistData(updatedWithCancel)

        setPendingSubtasks([])
        setPendingEphemeralMsg(null)
        setAutoAssistState('idle')
        return
      } else {
        // 不明な応答の場合のメッセージを作成
        const unknownMsg = 'Yes で実行 / No でキャンセル です.'
        const unknownAiMsg: Message = { type: 'ai', content: unknownMsg }

        // UI表示を先に更新
        setAutoAssistMessages((prev) => [...prev, unknownAiMsg])

        // postMessages用のメッセージ形式も作成
        const postUnknownMsg: Messages = {
          role: 'model',
          parts: [{ text: unknownMsg }]
        }

        // 最新の状態を取得
        const unknownChats = await window.electronAPI.loadAgents()
        const unknownAutoAssistIndex = unknownChats.findIndex((c) => c.id === AUTO_ASSIST_ID)

        if (unknownAutoAssistIndex === -1) {
          throw new Error('AutoAssist entry not found when processing unknown response')
        }

        // オートアシストを取得
        const unknownAutoAssist = { ...unknownChats[unknownAutoAssistIndex] }

        // メッセージを追加
        unknownAutoAssist.messages = [...unknownAutoAssist.messages, unknownAiMsg]
        unknownAutoAssist.postMessages = [...unknownAutoAssist.postMessages, postUnknownMsg]

        // 更新されたチャット配列を作成
        const updatedWithUnknown = [...unknownChats]
        updatedWithUnknown[unknownAutoAssistIndex] = unknownAutoAssist

        // 状態を更新して保存
        await saveAutoAssistData(updatedWithUnknown)

        return
      }
    } catch (err) {
      console.error('Yes/No応答処理中にエラーが発生しました:', err)
      toast({
        title: 'エラー',
        description: 'メッセージの処理中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
      return
    }
  }, [toast, saveAutoAssistData, pendingSubtasks, pendingEphemeralMsg, executeSubtasksAndShowOnce])

  // オートアシストリセット
  const resetAutoAssist = useCallback(async () => {
    try {
      const chats = await window.electronAPI.loadAgents()
      const updatedChats = chats.map((chat) => {
        if (chat.id === AUTO_ASSIST_ID) {
          return {
            ...chat,
            messages: [],
            postMessages: [],
            inputMessage: ''
          }
        }
        return chat
      })

      await window.electronAPI.saveAgents(updatedChats)
      setAutoAssistMessages([])
      setAutoAssistState('idle')
      setPendingSubtasks([])
      setPendingEphemeralMsg(null)

      toast({
        title: 'オートアシストをリセットしました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (err) {
      console.error('Failed to reset AutoAssist:', err)
      toast({
        title: 'エラー',
        description: 'オートアシストのリセットに失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [toast])

  // アシスタント要約更新
  const updateAutoAssistSummary = useCallback(async (
    id: number,
    summary: string,
    chats: ChatInfo[]
  ): Promise<ChatInfo[]> => {
    const updatedChats = chats.map((c) => (c.id === id ? { ...c, assistantSummary: summary } : c))
    try {
      await window.electronAPI.saveAgents(updatedChats)
      return updatedChats
    } catch (err) {
      console.error('save agent summaries error:', err)
      toast({
        title: 'エラー',
        description: 'アシスタント要約の保存中にエラーが発生しました。',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
      return chats
    }
  }, [toast])

  // オートアシストメッセージの初期化
  useEffect(() => {
    const initAutoAssist = async () => {
      try {
        const chats = await window.electronAPI.loadAgents()
        const auto = chats.find((c) => c.id === AUTO_ASSIST_ID)
        if (auto) {
          setAutoAssistMessages(auto.messages)
        }
      } catch (err) {
        console.error('Failed to load AutoAssist messages:', err)
      }
    }
    initAutoAssist()
  }, [])

  return {
    // 状態
    autoAssistMessages,
    autoAssistState,
    pendingSubtasks,
    agentMode,
    isLoading,

    // アクション
    setAutoAssistMessages,
    setAutoAssistState,
    setPendingSubtasks,
    setAgentMode,
    setIsLoading,

    // メソッド
    handleAutoAssistSend,
    executeSubtasksAndShowOnce,
    resetAutoAssist,
    updateAutoAssistSummary,
    handleYesNoResponse,

    // ユーティリティ
    csvToJson,
    buildUserParts
  }
}
