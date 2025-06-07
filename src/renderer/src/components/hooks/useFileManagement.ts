import { useState, useCallback } from 'react'
import { useToast } from '@chakra-ui/react'

interface UseFileManagementReturn {
  // 状態
  tempFiles: { name: string; data: string; mimeType: string }[]
  useAgentFile: boolean

  // アクション
  setTempFiles: (files: { name: string; data: string; mimeType: string }[]) => void
  setUseAgentFile: (use: boolean) => void

  // メソッド
  handleFileSelection: (fileInputRef: React.RefObject<HTMLInputElement>) => void
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void
  handleDragOver: (e: React.DragEvent<HTMLTextAreaElement>) => void
  handleTempFileDelete: (targetName: string) => void
  addAgentFilesToChat: (chatId: number, files: File[]) => Promise<{ name: string; path: string }[]>
  removeAgentFileFromChat: (chatId: number, filePath: string) => Promise<void>
  readAgentFiles: (paths: string[]) => Promise<{ name: string; data: string; mimeType: string }[]>
  deleteImageFiles: (messages: { imagePath?: string }[]) => Promise<void>

  // ユーティリティ
  getMimeTypeFromExtension: (fileName: string) => string
}

export const useFileManagement = (): UseFileManagementReturn => {
  const toast = useToast()

  // 状態
  const [tempFiles, setTempFiles] = useState<{ name: string; data: string; mimeType: string }[]>([])
  const [useAgentFile, setUseAgentFile] = useState<boolean>(false)

  // ファイル選択ダイアログを開く
  const handleFileSelection = useCallback((fileInputRef: React.RefObject<HTMLInputElement>) => {
    fileInputRef.current?.click()
  }, [])

  // ファイル入力変更処理
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const readers: Promise<{ name: string; data: string; mimeType: string }>[] = []
    for (const file of Array.from(files)) {
      readers.push(
        new Promise((res) => {
          const r = new FileReader()
          r.onload = () => {
            const base64 = r.result!.toString().split(',')[1]
            const mime = file.type || 'application/octet-stream'
            res({ name: file.name, data: base64, mimeType: mime })
          }
          r.readAsDataURL(file)
        })
      )
    }
    Promise.all(readers).then((newFiles) => setTempFiles((prev) => [...prev, ...newFiles]))
    // 選択し直せるように value をリセット
    e.target.value = ''
  }, [])

  // ドラッグ&ドロップ処理
  const handleDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    const newFiles: { name: string; data: string; mimeType: string }[] = []
    let processed = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result) {
          const base64Data = reader.result.toString().split(',')[1]
          const mime = getMimeTypeFromExtension(file.name)

          newFiles.push({
            name: file.name,
            data: base64Data,
            mimeType: mime
          })
        }
        processed++
        if (processed === files.length) {
          setTempFiles((prev) => [...prev, ...newFiles])
        }
      }
      reader.readAsDataURL(file)
    }
  }, [])

  // ドラッグオーバー処理
  const handleDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // 一時ファイル削除
  const handleTempFileDelete = useCallback((targetName: string) => {
    setTempFiles((prev) => prev.filter((f) => f.name !== targetName))
  }, [])

  // 拡張子からMIMEタイプを取得
  const getMimeTypeFromExtension = useCallback((fileName: string): string => {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.pdf')) return 'application/pdf'
    if (lower.endsWith('.txt')) return 'text/plain'
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.gif')) return 'image/gif'
    if (lower.endsWith('.csv')) return 'text/csv'
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    return 'application/octet-stream'
  }, [])

  // チャットにエージェントファイルを追加
  const addAgentFilesToChat = useCallback(async (
    chatId: number,
    files: File[]
  ): Promise<{ name: string; path: string }[]> => {
    try {
      const agentFiles: { name: string; path: string }[] = []

      for (const file of files) {
        // ファイルをユーザーデータディレクトリにコピー
        const reader = new FileReader()
        const fileData = await new Promise<ArrayBuffer>((resolve) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer)
          reader.readAsArrayBuffer(file)
        })

        // Base64に変換
        const base64 = btoa(String.fromCharCode(...new Uint8Array(fileData)))
        
        // Electronのファイルコピー機能を使用
        const savedPath = await window.electronAPI.copyFileToUserData(base64)
        if (savedPath) {
          agentFiles.push({
            name: file.name,
            path: savedPath
          })
        }
      }

      return agentFiles
    } catch (error) {
      console.error('Failed to add agent files:', error)
      toast({
        title: 'エラー',
        description: 'エージェントファイルの追加に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
      return []
    }
  }, [toast])

  // チャットからエージェントファイルを削除
  const removeAgentFileFromChat = useCallback(async (chatId: number, filePath: string) => {
    try {
      await window.electronAPI.deleteFileInUserData(filePath)
      toast({
        title: 'ファイルを削除しました',
        status: 'success',
        duration: 2000,
        isClosable: true
      })
    } catch (error) {
      console.error('Failed to remove agent file:', error)
      toast({
        title: 'エラー',
        description: 'ファイルの削除に失敗しました',
        status: 'error',
        duration: 3000,
        isClosable: true
      })
    }
  }, [toast])

  // agentFilePaths に保存されているファイルを tempFiles と同じ形に読み込む
  const readAgentFiles = useCallback(async (
    paths: string[]
  ): Promise<{ name: string; data: string; mimeType: string }[]> => {
    const out: { name: string; data: string; mimeType: string }[] = []

    for (const p of paths) {
      try {
        // ユーザーデータ領域に置いたファイルを base64 で読む
        const base64 = await window.electronAPI.readFileByPath(p)
        if (!base64) continue

        // 拡張子→ MIME 判定
        const mime = getMimeTypeFromExtension(p)

        // ファイル名だけ抽出
        const name = p.split(/[/\\]/).pop() || p

        out.push({ name, data: base64, mimeType: mime })
      } catch (error) {
        console.warn(`Failed to read agent file: ${p}`, error)
      }
    }

    return out
  }, [getMimeTypeFromExtension])

  // 画像ファイルを削除
  const deleteImageFiles = useCallback(async (messages: { imagePath?: string }[]): Promise<void> => {
    // 画像パスを持つメッセージを特定
    const imageMessages = messages.filter((msg) => msg.imagePath && msg.imagePath.trim() !== '')

    if (imageMessages.length === 0) {
      console.log('削除対象の画像ファイルはありません')
      return
    }

    console.log(`画像ファイル削除対象: ${imageMessages.length}件`)

    // 直接削除APIが利用可能か確認
    const hasDirectDeleteAPI = !!window.electronAPI.directDeleteFile

    if (!hasDirectDeleteAPI) {
      console.warn('directDeleteFile APIが利用できません。削除処理をスキップします。')
      return
    }

    // 画像ファイルを削除
    for (const msg of imageMessages) {
      if (msg.imagePath) {
        try {
          console.log(`処理対象画像パス: ${msg.imagePath}`)

          // 直接削除APIを使用
          const result = await window.electronAPI.directDeleteFile(msg.imagePath)

          if (result) {
            console.log(`✓ 画像ファイル削除成功: ${msg.imagePath}`)
          } else {
            console.warn(`✗ 画像ファイル削除失敗: ${msg.imagePath}`)
          }
        } catch (err) {
          console.error(`✗ 画像ファイル削除エラー: ${msg.imagePath}`, err)
        }
      }
    }
  }, [])

  return {
    // 状態
    tempFiles,
    useAgentFile,

    // アクション
    setTempFiles,
    setUseAgentFile,

    // メソッド
    handleFileSelection,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleTempFileDelete,
    addAgentFilesToChat,
    removeAgentFileFromChat,
    readAgentFiles,
    deleteImageFiles,

    // ユーティリティ
    getMimeTypeFromExtension
  }
}
