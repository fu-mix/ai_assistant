import { useState, useEffect, memo } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Select,
  Input,
  IconButton,
  HStack,
  Text,
  useToast
} from '@chakra-ui/react'
import { AiOutlineDelete } from 'react-icons/ai'
import { useTranslation } from 'react-i18next'

/**
 * タイトル設定用の型定義
 */
export type TitleSegment = {
  text: string
  color: string
}

export type TitleSettings = {
  segments: TitleSegment[]
  fontFamily: string
  backgroundImagePath?: string
}

/**
 * TitleEditModalのprops型
 */
interface TitleEditModalProps {
  isOpen: boolean
  onClose: () => void
  titleSettings: TitleSettings
  onSave: (settings: TitleSettings) => void
}

/**
 * タイトル編集モーダルコンポーネント
 */
export const TitleEditModal = memo<TitleEditModalProps>(
  ({ isOpen, onClose, titleSettings, onSave }) => {
    const { t } = useTranslation()
    const toast = useToast()

    // ローカルステート
    const [tempSegments, setTempSegments] = useState<TitleSegment[]>([])
    const [tempFont, setTempFont] = useState<string>('Arial')
    const [tempBackgroundPath, setTempBackgroundPath] = useState<string | undefined>(undefined)

    const fontOptions = ['Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New']

    // デフォルトタイトル (DesAIn Assistant)
    const defaultSegments: TitleSegment[] = [
      { text: 'D', color: '#ff6600' },
      { text: 'es', color: '#333333' },
      { text: 'AI', color: '#dd5588' },
      { text: 'n ', color: '#333333' },
      { text: 'A', color: '#ffd700' },
      { text: 'ssistant', color: '#333333' }
    ]
    const defaultFont = 'Arial'

    // モーダルを開くたびに既存の設定をコピー
    useEffect(() => {
      if (isOpen) {
        setTempSegments(JSON.parse(JSON.stringify(titleSettings.segments)))
        setTempFont(titleSettings.fontFamily)
        setTempBackgroundPath(titleSettings.backgroundImagePath)
      }
    }, [isOpen, titleSettings])

    const addSegment = () => {
      setTempSegments((prev) => [...prev, { text: '', color: '#000000' }])
    }

    const removeSegment = (idx: number) => {
      setTempSegments((prev) => prev.filter((_, i) => i !== idx))
    }

    const updateSegmentText = (idx: number, newVal: string) => {
      setTempSegments((prev) => prev.map((seg, i) => (i === idx ? { ...seg, text: newVal } : seg)))
    }

    const updateSegmentColor = (idx: number, newColor: string) => {
      setTempSegments((prev) =>
        prev.map((seg, i) => (i === idx ? { ...seg, color: newColor } : seg))
      )
    }

    const handleRevertDefault = () => {
      setTempSegments(JSON.parse(JSON.stringify(defaultSegments)))
      setTempFont(defaultFont)
      toast({
        title: t('title.revertedToDefault'),
        status: 'info',
        duration: 1500,
        isClosable: true
      })
    }

    const handleSelectBackgroundImage = async () => {
      try {
        // 既に背景画像があれば削除
        if (tempBackgroundPath) {
          // @ts-ignore
          await window.electronAPI.deleteFileInUserData(tempBackgroundPath)
        }
        // @ts-ignore
        const newPath = await window.electronAPI.copyFileToUserData()
        if (newPath) {
          setTempBackgroundPath(newPath)
        } else {
          toast({
            title: t('title.imageSelectionCancelled'),
            status: 'info',
            duration: 1500,
            isClosable: true
          })
        }
      } catch (err) {
        console.error('Failed to set background image:', err)
        toast({
          title: t('title.backgroundImageError'),
          status: 'error',
          duration: 2000,
          isClosable: true
        })
      }
    }

    const handleRemoveBackgroundImage = async () => {
      if (!tempBackgroundPath) return
      try {
        // @ts-ignore
        const ok = await window.electronAPI.deleteFileInUserData(tempBackgroundPath)
        if (ok) {
          setTempBackgroundPath(undefined)
          toast({
            title: t('title.backgroundImageRemoved'),
            status: 'info',
            duration: 1500,
            isClosable: true
          })
        }
      } catch (err) {
        console.error('Failed to remove background image:', err)
      }
    }

    const handleSaveTitle = async () => {
      const newSettings: TitleSettings = {
        segments: tempSegments,
        fontFamily: tempFont,
        backgroundImagePath: tempBackgroundPath
      }

      // 親コンポーネントのonSaveを呼び出し
      onSave(newSettings)

      toast({
        title: t('title.settingsSaved'),
        status: 'success',
        duration: 2000,
        isClosable: true
      })
      onClose()
    }

    return (
      <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t('title.edit')}</ModalHeader>
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>{t('title.fontFamily')}</FormLabel>
              <Select value={tempFont} onChange={(e) => setTempFont(e.target.value)}>
                {fontOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl mb={4}>
              <FormLabel>{t('title.titleSegmentsLabel')}</FormLabel>
              {tempSegments.map((seg, idx) => (
                <HStack key={idx} spacing={2} mb={1}>
                  <Input
                    value={seg.text}
                    onChange={(e) => updateSegmentText(idx, e.target.value)}
                    placeholder={t('title.text')}
                    width="100px"
                  />
                  <Input
                    type="color"
                    value={seg.color}
                    onChange={(e) => updateSegmentColor(idx, e.target.value)}
                    width="60px"
                    p={0}
                  />
                  <IconButton
                    icon={<AiOutlineDelete />}
                    aria-label={t('common.delete')}
                    colorScheme="red"
                    size="sm"
                    onClick={() => removeSegment(idx)}
                  />
                </HStack>
              ))}
              <Button mt={2} onClick={addSegment}>
                {t('title.addSegment')}
              </Button>
            </FormControl>

            <FormControl mt={4} mb={6}>
              <Button colorScheme="orange" variant="outline" onClick={handleRevertDefault}>
                {t('title.revertToDefault')}
              </Button>
            </FormControl>

            <FormControl mt={2}>
              <FormLabel>{t('title.backgroundImage')}</FormLabel>
              <HStack spacing={3}>
                <Button colorScheme="blue" onClick={handleSelectBackgroundImage}>
                  {t('title.selectImage')}
                </Button>
                <Button
                  colorScheme="red"
                  variant="outline"
                  onClick={handleRemoveBackgroundImage}
                  isDisabled={!tempBackgroundPath}
                >
                  {t('title.removeImage')}
                </Button>
              </HStack>
              {tempBackgroundPath && (
                <Text fontSize="sm" color="gray.600" mt={2}>
                  {t('title.currentlySet')}: {tempBackgroundPath}
                </Text>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} mr={3}>
              {t('common.cancel')}
            </Button>
            <Button colorScheme="blue" onClick={handleSaveTitle}>
              {t('common.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    )
  }
)

TitleEditModal.displayName = 'TitleEditModal'
