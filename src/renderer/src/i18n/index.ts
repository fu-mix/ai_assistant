import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import jaTranslations from './locales/ja'
import enTranslations from './locales/en'

// リソースの型定義
export const resources = {
  ja: { translation: jaTranslations },
  en: { translation: enTranslations }
} as const

// 型定義のエクスポート
export type Language = keyof typeof resources
export type TranslationResource = typeof jaTranslations

// デフォルト言語の決定関数
export const getDefaultLanguage = async (): Promise<Language> => {
  try {
    // electron-storeから保存された言語設定を取得
    const storedLang = await window.electron.ipcRenderer.invoke('get-stored-locale')
    if (storedLang && (storedLang === 'ja' || storedLang === 'en')) {
      return storedLang as Language
    }

    // 保存されていない場合はシステム言語を取得
    const systemLang = await window.electron.ipcRenderer.invoke('get-system-locale')
    
    // 日本語の場合は'ja'、それ以外は'en'
    return systemLang.toLowerCase().startsWith('ja') ? 'ja' : 'en'
  } catch (error) {
    console.error('Failed to get language setting:', error)
    // エラー時のフォールバック
    return 'en'
  }
}

// 言語設定の保存関数
export const saveLanguage = async (language: Language): Promise<void> => {
  try {
    await window.electron.ipcRenderer.invoke('set-locale', language)
  } catch (error) {
    console.error('Failed to save language setting:', error)
  }
}

// i18n初期化関数
export const initI18n = async (): Promise<void> => {
  const defaultLang = await getDefaultLanguage()

  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: defaultLang,
      fallbackLng: 'en',
      debug: false,
      interpolation: {
        escapeValue: false // Reactは既にXSS対策済み
      },
      react: {
        useSuspense: false // Suspenseを無効化（非同期初期化のため）
      }
    })

  // 初期言語を保存
  await saveLanguage(defaultLang)
}

// 言語切り替え関数
export const changeLanguage = async (language: Language): Promise<void> => {
  await i18n.changeLanguage(language)
  await saveLanguage(language)
}

export default i18n
