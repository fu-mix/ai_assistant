// Electron APIの型定義
interface ElectronAPI {
  postChatAI: (message: any[], apiKey: string, systemPrompt: string) => Promise<any>
  loadAgents: () => Promise<any[]>
  saveAgents: (agentsData: any[]) => Promise<any>
  copyFileToUserData: (oldFilePath?: string) => Promise<string | null>
  readFileByPath: (filePath: string) => Promise<string | null>
  deleteFileInUserData: (filePath: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  loadTitleSettings?: () => Promise<any | null>
  saveTitleSettings?: (settings: any) => Promise<void>
  showSaveDialog?: (defaultFileName: string) => Promise<void>
  showOpenDialogAndRead?: () => Promise<string | null>
  replaceLocalHistoryConfig?: (newContent: string) => Promise<void>
  exportSelectedAgents?: (arg: { selectedIds: number[]; includeHistory: boolean }) => Promise<void>
  appendLocalHistoryConfig?: (newContent: string) => Promise<void>
  callExternalAPI?: (apiConfig: any, params: any) => Promise<{
    success: boolean
    data?: any
    error?: string
    status?: number
  }>
  saveImageToFile: (base64Data: string) => Promise<string>
  loadImage: (imagePath: string) => Promise<string | null>
  directDeleteFile: (filePath: string) => Promise<boolean>
  getUserDataPath: () => Promise<string>
  saveApiKey: (apiKey: string) => Promise<boolean>
  loadApiKey: () => Promise<string>
  
  // 言語設定関連
  getSystemLocale: () => Promise<string>
  getStoredLocale: () => Promise<string | null>
  setLocale: (language: string) => Promise<boolean>
}

interface Window {
  electron: {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
  electronAPI: ElectronAPI
}
