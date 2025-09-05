import { memo, useMemo } from 'react'
import { MessageItem, Message } from './MessageItem'

interface MessageListProps {
  messages: Message[]
  onCopy: (content: string) => void
  onEdit: (index: number, content: string) => void
  chatHistoryRef: React.RefObject<HTMLDivElement>
}

/**
 * メッセージリスト全体を管理するコンポーネント
 * React.memoを使用して、messagesプロパティが変更された場合のみ再レンダリング
 */
export const MessageList = memo<MessageListProps>(
  ({ messages, onCopy, onEdit, chatHistoryRef }) => {
    // メッセージの一意性を確保するためのキー生成をメモ化
    const messageItems = useMemo(() => {
      return messages.map((msg, idx) => (
        <MessageItem
          key={`${idx}-${msg.type}-${msg.content.substring(0, 50)}`} // より安定したキー生成
          message={msg}
          index={idx}
          onCopy={onCopy}
          onEdit={onEdit}
          chatHistoryRef={chatHistoryRef}
        />
      ))
    }, [messages, onCopy, onEdit, chatHistoryRef])

    return <>{messageItems}</>
  }
)

MessageList.displayName = 'MessageList'
