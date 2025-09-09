import { memo, useMemo, useCallback } from 'react'
import {
  Box,
  Flex,
  Text,
  IconButton,
  HStack,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
} from '@chakra-ui/react'
import { LuSettings } from 'react-icons/lu'
import { FiEdit } from 'react-icons/fi'
import { MdApi, MdSettings, MdFileDownload, MdFileUpload } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
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
  onApiSettingsClick: () => void
  onExportClick: () => void
  onImportClick: () => void
}

export const ChatHeader = memo(
  ({
    titleSettings,
    headerBgDataUri,
    selectedChatId,
    selectedChat,
    titleHovered,
    appVersion,
    onTitleHover,
    onTitleEdit,
    onSettingsClick,
    onApiSettingsClick,
    onExportClick,
    onImportClick
  }: ChatHeaderProps) => {
    const { t } = useTranslation()
    // タイトル要素のメモ化
    const titleElements = useMemo(() => {
      // 背景画像の有無でシャドウの強さを調整
      const shadow = headerBgDataUri
        ? '0 0 2px rgba(0,0,0,0.55), 0 1px 6px rgba(0,0,0,0.35)'
        : '0 1px 1px rgba(0,0,0,0.25)'

      return titleSettings.segments.map((seg, idx) => (
        <Text
          key={idx}
          as="span"
          color={seg.color}
          fontFamily={titleSettings.fontFamily}
          fontSize="2xl"
          fontWeight="bold"
          textShadow={shadow}
        >
          {seg.text}
        </Text>
      ))
    }, [titleSettings.segments, titleSettings.fontFamily, headerBgDataUri])

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
        _before={
          headerBgDataUri
            ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                zIndex: 1
              }
            : undefined
        }
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

          {/* 設定メニュー */}
          <HStack spacing={2}>
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<LuSettings />}
                variant="ghost"
                size="md"
                aria-label={t('common.settings')}
                _hover={{ bg: 'gray.100' }}
              />
              <MenuList>
                <MenuItem icon={<MdSettings />} onClick={handleSettingsClick}>
                  {t('common.settings')}
                </MenuItem>
                <MenuItem icon={<MdApi />} onClick={onApiSettingsClick}>
                  {t('header.apiKeySettings')}
                </MenuItem>
                <MenuItem icon={<MdFileDownload />} onClick={onExportClick}>
                  {t('header.dataExport')}
                </MenuItem>
                <MenuItem icon={<MdFileUpload />} onClick={onImportClick}>
                  {t('header.dataImport')}
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
        </Flex>
      </Box>
    )
  }
)

ChatHeader.displayName = 'ChatHeader'
