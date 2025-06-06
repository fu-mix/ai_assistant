import { memo, useMemo, useCallback } from 'react'
import {
  Box,
  Flex,
  Text,
  IconButton,
  HStack,
  Tooltip,
  Image
} from '@chakra-ui/react'
import { LuSettings } from 'react-icons/lu'
import { FiEdit } from 'react-icons/fi'
import type { TitleSettings, ChatInfo } from './types'

interface ChatHeaderProps {
  titleSettings: TitleSettings
  headerBgDataUri?: string
  selectedChatId: number | null | 'autoAssist'
  selectedChat?: ChatInfo | null
  titleHovered: boolean
  appVersion: string
  onTitleHover: (hovered: boolean) => void
  onTitleEdit: () => void
  onSettingsClick: () => void
}

export const ChatHeader = memo(({
  titleSettings,
  headerBgDataUri,
  selectedChatId,
  selectedChat,
  titleHovered,
  appVersion,
  onTitleHover,
  onTitleEdit,
  onSettingsClick
}: ChatHeaderProps) => {
  // タイトル要素のメモ化
  const titleElements = useMemo(() => 
    titleSettings.segments.map((seg, idx) => (
      <Text
        key={idx}
        as="span"
        color={seg.color}
        fontFamily={titleSettings.fontFamily}
        fontSize="2xl"
        fontWeight="bold"
      >
        {seg.text}
      </Text>
    )),
    [titleSettings.segments, titleSettings.fontFamily]
  )

  // 現在のチャットタイトルをメモ化
  const currentChatTitle = useMemo(() => {
    if (selectedChatId === 'autoAssist') {
      return 'オートアシスト'
    }
    return selectedChat?.customTitle || '新しいアシスタント'
  }, [selectedChatId, selectedChat?.customTitle])

  // ホバーハンドラーのメモ化
  const handleTitleMouseEnter = useCallback(() => {
    onTitleHover(true)
  }, [onTitleHover])

  const handleTitleMouseLeave = useCallback(() => {
    onTitleHover(false)
  }, [onTitleHover])

  // 設定ボタンクリックハンドラーのメモ化
  const handleSettingsClick = useCallback(() => {
    onSettingsClick()
  }, [onSettingsClick])

  // タイトル編集ハンドラーのメモ化
  const handleTitleEditClick = useCallback(() => {
    onTitleEdit()
  }, [onTitleEdit])

  return (
    <Box
      p={4}
      bg="white"
      borderBottom="1px solid #ddd"
      position="relative"
      backgroundImage={headerBgDataUri ? `url(${headerBgDataUri})` : undefined}
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat"
      _before={headerBgDataUri ? {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        zIndex: 1
      } : undefined}
    >
      <Flex justify="space-between" align="center" position="relative" zIndex={2}>
        {/* アプリタイトル */}
        <HStack spacing={2}>
          <Box
            cursor="pointer"
            position="relative"
            onMouseEnter={handleTitleMouseEnter}
            onMouseLeave={handleTitleMouseLeave}
            onClick={handleTitleEditClick}
          >
            {titleElements}
            {titleHovered && (
              <Box
                position="absolute"
                top="-2px"
                right="-25px"
                opacity={0.7}
                _hover={{ opacity: 1 }}
              >
                <FiEdit size={16} color="#666" />
              </Box>
            )}
          </Box>
          
          <Text fontSize="xs" color="gray.500" ml={4}>
            v{appVersion}
          </Text>
        </HStack>

        {/* 現在のチャットタイトル */}
        <Text
          fontSize="lg"
          fontWeight="semibold"
          color="gray.700"
          textAlign="center"
          flex="1"
          mx={4}
          noOfLines={1}
        >
          {currentChatTitle}
        </Text>

        {/* 設定ボタン */}
        <HStack spacing={2}>
          <Tooltip label="設定" placement="bottom">
            <IconButton
              icon={<LuSettings />}
              variant="ghost"
              size="md"
              onClick={handleSettingsClick}
              aria-label="設定"
              _hover={{ bg: 'gray.100' }}
            />
          </Tooltip>
        </HStack>
      </Flex>
    </Box>
  )
})

ChatHeader.displayName = 'ChatHeader'
