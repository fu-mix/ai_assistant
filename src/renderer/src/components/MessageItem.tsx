import { useState, useCallback, memo, useEffect } from 'react'
import { Box, HStack, IconButton, Text, Image, Button, Spinner } from '@chakra-ui/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MdOutlineContentCopy } from 'react-icons/md'
import { FiEdit } from 'react-icons/fi'
import { DownloadIcon } from '@chakra-ui/icons'
import { useTranslation } from 'react-i18next'

/**
 * Electron API interface
 */
interface ElectronAPI {
  loadImage: (imagePath: string) => Promise<string | null>
}

declare global {
  interface Window {
    // @ts-ignore
    electronAPI: ElectronAPI
  }
}

/**
 * ユーザー/AIメッセージ (表示用)
 */
export type Message = {
  type: 'user' | 'ai'
  content: string
  imagePath?: string // 画像ファイルへのパス
}

interface ImageWithLazyLoadingProps {
  imagePath: string
  chatHistoryRef: React.RefObject<HTMLDivElement>
}

/**
 * 画像遅延読み込みコンポーネント
 * メモ化により不要な再レンダリングを防止
 */
const ImageWithLazyLoading = memo<ImageWithLazyLoadingProps>(({ imagePath, chatHistoryRef }) => {
  const { t } = useTranslation()
  const [imageData, setImageData] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 画像読み込み処理をuseCallbackでメモ化
  const loadImage = useCallback(async () => {
    if (!imagePath) return

    try {
      setIsLoading(true)
      const base64Data = await window.electronAPI.loadImage(imagePath)
      if (base64Data) {
        setImageData(`data:image/png;base64,${base64Data}`)
      }
    } catch (err) {
      console.error(t('errors.loadFailed'), err)
    } finally {
      setIsLoading(false)
    }
  }, [imagePath])

  // 初回レンダリング時に画像読み込み
  useEffect(() => {
    loadImage()
  }, [loadImage])

  // 画像ロード完了時のハンドラー
  const handleImageLoaded = useCallback(() => {
    if (chatHistoryRef?.current) {
      setTimeout(() => {
        chatHistoryRef.current!.scrollTop = chatHistoryRef.current!.scrollHeight
      }, 50)
    }
  }, [chatHistoryRef])

  // 画像ダウンロード処理
  const handleDownload = useCallback(() => {
    if (!imageData) return

    // data URLからBlobを作成
    const byteString = atob(imageData.split(',')[1])
    const mimeType = 'image/png'
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }

    const blob = new Blob([ab], { type: mimeType })
    const url = URL.createObjectURL(blob)

    // ダウンロードリンクを作成
    const a = document.createElement('a')
    a.href = url
    a.download = `generated_image_${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [imageData])

  if (isLoading) {
    return <Spinner size="md" />
  }

  return imageData ? (
    <Box
      position="relative"
      display="flex"
      justifyContent="center"
      width="100%"
      mt={2}
      mb={2}
      onMouseEnter={(e) => e.stopPropagation()}
      onMouseOver={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
    >
      <Image
        src={imageData}
        alt={t('chat.generatedImage', '生成された画像')}
        maxWidth="500px"
        maxHeight="400px"
        borderRadius="md"
        objectFit="contain"
        onLoad={handleImageLoaded}
      />
      <Button
        position="absolute"
        bottom="8px"
        right="8px"
        size="sm"
        colorScheme="blue"
        leftIcon={<DownloadIcon />}
        onClick={handleDownload}
      >
        {t('common.download', 'ダウンロード')}
      </Button>
    </Box>
  ) : (
    <Text color="red.500">{t('errors.imageLoadError', '画像を読み込めませんでした')}</Text>
  )
})

ImageWithLazyLoading.displayName = 'ImageWithLazyLoading'

interface MessageItemProps {
  message: Message
  index: number
  onCopy: (content: string) => void
  onEdit: (index: number, content: string) => void
  chatHistoryRef: React.RefObject<HTMLDivElement>
}

/**
 * 個別メッセージ表示コンポーネント
 * React.memoを使用して不要な再レンダリングを防止
 */
export const MessageItem = memo<MessageItemProps>(
  ({ message, index, onCopy, onEdit, chatHistoryRef }) => {
    const { t } = useTranslation()
    const [isHovered, setIsHovered] = useState(false)

    // ホバー状態管理をメモ化
    const handleMouseEnter = useCallback(() => setIsHovered(true), [])
    const handleMouseLeave = useCallback(() => setIsHovered(false), [])

    // コピー処理をメモ化
    const handleCopy = useCallback(() => {
      onCopy(message.content)
    }, [onCopy, message.content])

    // 編集処理をメモ化
    const handleEdit = useCallback(() => {
      onEdit(index, message.content)
    }, [onEdit, index, message.content])

    return (
      <Box
        mb={4}
        p={3}
        rounded="lg"
        bg={message.type === 'user' ? 'gray.300' : 'gray.50'}
        position="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxWidth: '100%',
          overflow: 'hidden'
        }}
      >
        <div>
          {message.type === 'user' ? (
            message.content
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className="markdown"
                components={{
                  pre: ({ node, ...props }) => (
                    <div
                      style={{
                        overflow: 'auto',
                        maxWidth: '100%',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} {...props} />
                    </div>
                  ),
                  code: ({ node, ...props }) => (
                    <code
                      style={{
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        maxWidth: '100%'
                      }}
                      {...props}
                    />
                  ),
                  table: ({ node, ...props }) => (
                    <div style={{ overflow: 'auto', maxWidth: '100%' }}>
                      <table style={{ tableLayout: 'fixed', width: '100%' }} {...props} />
                    </div>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
              {/* 画像がある場合に表示 */}
              {message.imagePath && (
                <Box mt={3}>
                  <ImageWithLazyLoading
                    imagePath={message.imagePath}
                    chatHistoryRef={chatHistoryRef}
                  />
                </Box>
              )}
            </>
          )}
        </div>
        {isHovered && (
          <Box position="absolute" top="4px" right="6px">
            <HStack spacing={1}>
              <IconButton
                icon={<MdOutlineContentCopy />}
                aria-label={t('common.copy')}
                size="sm"
                variant="ghost"
                colorScheme="blue"
                onClick={handleCopy}
              />
              {message.type === 'user' && (
                <IconButton
                  icon={<FiEdit />}
                  aria-label={t('common.edit')}
                  size="sm"
                  variant="ghost"
                  colorScheme="blue"
                  onClick={handleEdit}
                />
              )}
            </HStack>
          </Box>
        )}
      </Box>
    )
  }
)

MessageItem.displayName = 'MessageItem'
