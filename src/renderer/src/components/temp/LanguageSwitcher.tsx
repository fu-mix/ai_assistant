import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, HStack, Text } from '@chakra-ui/react'

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation()
  const [currentLang, setCurrentLang] = useState(i18n.language)

  useEffect(() => {
    setCurrentLang(i18n.language)
  }, [i18n.language])

  const handleLanguageChange = async (lang: string) => {
    try {
      // 言語を変更
      await i18n.changeLanguage(lang)
      // electron-storeに保存
      await window.electron.ipcRenderer.invoke('set-locale', lang)
      setCurrentLang(lang)
    } catch (error) {
      console.error('Failed to change language:', error)
    }
  }

  return (
    <HStack
      position="fixed"
      bottom={4}
      right={4}
      bg="white"
      p={3}
      borderRadius="md"
      boxShadow="md"
      zIndex={9999}
    >
      <Text fontSize="sm" fontWeight="bold">
        Language:
      </Text>
      <Button
        size="sm"
        colorScheme={currentLang === 'ja' ? 'blue' : 'gray'}
        onClick={() => handleLanguageChange('ja')}
      >
        日本語
      </Button>
      <Button
        size="sm"
        colorScheme={currentLang === 'en' ? 'blue' : 'gray'}
        onClick={() => handleLanguageChange('en')}
      >
        English
      </Button>
    </HStack>
  )
}
