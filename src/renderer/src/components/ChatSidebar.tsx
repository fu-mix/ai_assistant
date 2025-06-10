import { memo, useCallback, useMemo } from 'react'
import {
  Box,
  Flex,
  Text,
  List,
  ListItem,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Badge,
  HStack,
  VStack,
  Tooltip
} from '@chakra-ui/react'
import { HamburgerIcon } from '@chakra-ui/icons'
import { AiOutlineDelete } from 'react-icons/ai'
import { FiEdit } from 'react-icons/fi'
import { LuSettings } from 'react-icons/lu'
import type { ChatInfo, AutoAssistState } from './types'

interface ChatSidebarProps {
  leftPaneWidth: number
  chats: ChatInfo[]
  selectedChatId: number | null | 'autoAssist'
  autoAssistState: AutoAssistState
  onSelectChat: (id: number) => void
  onSelectAutoAssist: () => void
  onCreateNewAssistant: () => void
  onEditAssistant: (chat: ChatInfo) => void
  onDeleteAssistant: (id: number) => void
  onDragStart: (e: React.DragEvent<HTMLLIElement>, index: number) => void
  onDragOver: (e: React.DragEvent<HTMLLIElement>, index: number) => void
  onDrop: (e: React.DragEvent<HTMLLIElement>, index: number) => void
  dragOverIndex: number | null
  isResizing: boolean
  onResizeStart: () => void
  onShowSettings: () => void
  onShowExport: () => void
  onShowImport: () => void
  onShowAPISettings: () => void
  onShowAutoAssistSettings: () => void
  onShowApiKeySettings: () => void
  isExternalApiEnabled: boolean
}

export const ChatSidebar = memo(
  ({
    leftPaneWidth,
    chats,
    selectedChatId,
    autoAssistState,
    onSelectChat,
    onSelectAutoAssist,
    onCreateNewAssistant,
    onEditAssistant,
    onDeleteAssistant,
    onDragStart,
    onDragOver,
    onDrop,
    dragOverIndex,
    isResizing,
    onResizeStart,
    onShowSettings,
    onShowExport,
    onShowImport,
    onShowAPISettings,
    onShowAutoAssistSettings,
    onShowApiKeySettings,
    isExternalApiEnabled
  }: ChatSidebarProps) => {
    const AUTO_ASSIST_ID = 999999

    // オートアシスト以外のチャットをメモ化
    const regularChats = useMemo(() => chats.filter((c) => c.id !== AUTO_ASSIST_ID), [chats])

    // アシスタント選択ハンドラーのメモ化
    const handleChatSelect = useCallback(
      (id: number) => {
        onSelectChat(id)
      },
      [onSelectChat]
    )

    // オートアシストボタンクリックハンドラーのメモ化
    const handleAutoAssistClick = useCallback(() => {
      onSelectAutoAssist()
    }, [onSelectAutoAssist])

    // 編集ハンドラーのメモ化
    const handleEditClick = useCallback(
      (chat: ChatInfo) => {
        onEditAssistant(chat)
      },
      [onEditAssistant]
    )

    // 削除ハンドラーのメモ化
    const handleDeleteClick = useCallback(
      (id: number) => {
        onDeleteAssistant(id)
      },
      [onDeleteAssistant]
    )

    // ドラッグハンドラーのメモ化
    const handleDragStart = useCallback(
      (e: React.DragEvent<HTMLLIElement>, index: number) => {
        onDragStart(e, index)
      },
      [onDragStart]
    )

    const handleDragOver = useCallback(
      (e: React.DragEvent<HTMLLIElement>, index: number) => {
        onDragOver(e, index)
      },
      [onDragOver]
    )

    const handleDrop = useCallback(
      (e: React.DragEvent<HTMLLIElement>, index: number) => {
        onDrop(e, index)
      },
      [onDrop]
    )

    // オートアシストのステータス表示をメモ化
    const autoAssistStatusBadge = useMemo(() => {
      if (autoAssistState === 'awaitConfirm') {
        return (
          <Badge colorScheme="yellow" variant="solid" fontSize="xs">
            確認待ち
          </Badge>
        )
      }
      if (autoAssistState === 'executing') {
        return (
          <Badge colorScheme="blue" variant="solid" fontSize="xs">
            実行中
          </Badge>
        )
      }

      return null
    }, [autoAssistState])

    return (
      <Box
        width={`${leftPaneWidth}px`}
        bg="gray.50"
        borderRight="1px solid #ddd"
        display="flex"
        flexDirection="column"
        position="relative"
        overflow="hidden"
      >
        {/* サイドバーヘッダー */}
        <Box p={4} borderBottom="1px solid #ddd" bg="white">
          <HStack justify="space-between" align="center">
            <Text fontSize="lg" fontWeight="bold">
              アシスタント一覧
            </Text>
            <Menu>
              <MenuButton as={IconButton} icon={<HamburgerIcon />} size="sm" variant="ghost" />
              <MenuList>
                <MenuItem onClick={onShowSettings}>
                  <LuSettings style={{ marginRight: '8px' }} />
                  設定
                </MenuItem>
                <MenuItem onClick={onShowExport}>エクスポート</MenuItem>
                <MenuItem onClick={onShowImport}>インポート</MenuItem>
                <MenuItem onClick={onShowAutoAssistSettings}>オートアシスト設定</MenuItem>
                {isExternalApiEnabled && <MenuItem onClick={onShowAPISettings}>API設定</MenuItem>}
                <MenuItem onClick={onShowApiKeySettings}>APIキー設定</MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Box>

        {/* オートアシストボタン */}
        <Box p={2} borderBottom="1px solid #ddd">
          <Button
            width="100%"
            colorScheme={selectedChatId === 'autoAssist' ? 'blue' : 'gray'}
            variant={selectedChatId === 'autoAssist' ? 'solid' : 'ghost'}
            onClick={handleAutoAssistClick}
            size="sm"
            justifyContent="flex-start"
            // @ts-ignore
            leftIcon={autoAssistStatusBadge}
          >
            オートアシスト
          </Button>
        </Box>

        {/* アシスタント一覧 */}
        <Box flex="1" overflowY="auto">
          <List spacing={0}>
            {regularChats.map((chat, index) => (
              <ListItem
                key={chat.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                bg={
                  dragOverIndex === index
                    ? 'blue.100'
                    : selectedChatId === chat.id
                      ? 'blue.50'
                      : 'transparent'
                }
                borderBottom="1px solid #eee"
                cursor="pointer"
                _hover={{ bg: 'gray.100' }}
                transition="background-color 0.2s"
              >
                <Flex
                  align="center"
                  p={3}
                  onClick={() => handleChatSelect(chat.id)}
                  justify="space-between"
                >
                  <VStack align="start" spacing={1} flex="1" minW={0}>
                    <Text
                      fontWeight={selectedChatId === chat.id ? 'bold' : 'normal'}
                      fontSize="sm"
                      noOfLines={1}
                      color={selectedChatId === chat.id ? 'blue.600' : 'gray.800'}
                    >
                      {chat.customTitle}
                    </Text>
                    <Text fontSize="xs" color="gray.500" noOfLines={1}>
                      {chat.messages.length > 0
                        ? `${chat.messages.length}件のメッセージ`
                        : '新規アシスタント'}
                    </Text>
                  </VStack>

                  <HStack spacing={1} onClick={(e) => e.stopPropagation()}>
                    <Tooltip label="編集" placement="top">
                      <IconButton
                        icon={<FiEdit />}
                        size="xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditClick(chat)
                        }}
                        aria-label="編集"
                      />
                    </Tooltip>
                    <Tooltip label="削除" placement="top">
                      <IconButton
                        icon={<AiOutlineDelete />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(chat.id)
                        }}
                        aria-label="削除"
                      />
                    </Tooltip>
                  </HStack>
                </Flex>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* 新規作成ボタン */}
        <Box p={3} borderTop="1px solid #ddd" bg="white">
          <Button
            width="100%"
            colorScheme="blue"
            variant="outline"
            onClick={onCreateNewAssistant}
            size="sm"
          >
            + 新しいアシスタント
          </Button>
        </Box>

        {/* リサイズハンドル */}
        <Box
          position="absolute"
          right="-2px"
          top="0"
          bottom="0"
          width="4px"
          cursor="col-resize"
          bg="transparent"
          _hover={{ bg: 'blue.200' }}
          onMouseDown={onResizeStart}
          zIndex={10}
          opacity={isResizing ? 1 : 0}
          transition="opacity 0.2s"
        />
      </Box>
    )
  }
)

ChatSidebar.displayName = 'ChatSidebar'
