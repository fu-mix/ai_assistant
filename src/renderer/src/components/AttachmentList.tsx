import { memo, useCallback } from 'react'
import { Box, Text, Flex, IconButton } from '@chakra-ui/react'
import { AiOutlineDelete } from 'react-icons/ai'
import { useTranslation } from 'react-i18next'

interface AttachmentFile {
  name: string
  data: string
  mimeType: string
}

interface AttachmentListProps {
  files: AttachmentFile[]
  onDelete: (name: string) => void
}

interface AttachmentItemProps {
  file: AttachmentFile
  onDelete: (name: string) => void
}

/**
 * 個別添付ファイル表示コンポーネント
 */
const AttachmentItem = memo<AttachmentItemProps>(({ file, onDelete }) => {
  const { t } = useTranslation()
  const handleDelete = useCallback(() => {
    onDelete(file.name)
  }, [onDelete, file.name])

  return (
    <Flex
      align="center"
      justify="space-between"
      mb={2}
      p={2}
      bg="gray.50"
      borderRadius="md"
    >
      <Text fontSize="sm" color="gray.800" mr={4}>
        {file.name}
      </Text>
      <IconButton
        icon={<AiOutlineDelete />}
        aria-label={t('assistant.removeFile')}
        colorScheme="red"
        size="sm"
        onClick={handleDelete}
      />
    </Flex>
  )
})

AttachmentItem.displayName = 'AttachmentItem'

/**
 * 添付ファイル一覧表示コンポーネント
 * ファイルがない場合は何も表示しない
 */
export const AttachmentList = memo<AttachmentListProps>(({ files, onDelete }) => {
  const { t } = useTranslation()
  
  if (files.length === 0) return null

  return (
    <Box p={4} borderTop="1px" borderColor="gray.200">
      <Text fontSize="sm" color="gray.600" mb={2}>
        {t('chat.selectedFiles', '選択ファイル')}:
      </Text>
      {files.map((file) => (
        <AttachmentItem
          key={file.name}
          file={file}
          onDelete={onDelete}
        />
      ))}
    </Box>
  )
})

AttachmentList.displayName = 'AttachmentList'
