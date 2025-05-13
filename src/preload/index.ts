import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type Messages = {
  role: string
  parts: [{ text: string }, { inline_data?: { mime_type: string; data: string } }?]
}

// カスタムAPI
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    contextBridge.exposeInMainWorld('electronAPI', {
      postChatAI: async (messages: Messages[], apiKey: string, systemPrompt: string) => {
        return await ipcRenderer.invoke('postChatAI', messages, apiKey, systemPrompt)
      },
      loadAgents: async () => {
        return await ipcRenderer.invoke('load-agents')
      },
      saveAgents: async (agentsData: any) => {
        return await ipcRenderer.invoke('save-agents', agentsData)
      },

      // ファイル操作
      copyFileToUserData: async (oldFilePath?: string) => {
        return await ipcRenderer.invoke('copy-file-to-userdata', oldFilePath)
      },
      readFileByPath: async (filePath: string) => {
        return await ipcRenderer.invoke('readFileByPath', filePath)
      },
      deleteFileInUserData: async (filePath: string) => {
        return await ipcRenderer.invoke('delete-file-in-userdata', filePath)
      },

      getAppVersion: async () => {
        return await ipcRenderer.invoke('get-app-version')
      },

      // タイトル設定
      loadTitleSettings: async () => {
        return await ipcRenderer.invoke('load-title-settings')
      },
      saveTitleSettings: async (settings: any) => {
        return await ipcRenderer.invoke('save-title-settings', settings)
      },

      // 既存のエクスポート/インポートIPC
      showSaveDialog: async (defaultFileName: string) => {
        return await ipcRenderer.invoke('show-save-dialog', defaultFileName)
      },
      showOpenDialogAndRead: async () => {
        return await ipcRenderer.invoke('show-open-dialog-and-read')
      },
      replaceLocalHistoryConfig: async (newContent: string) => {
        return await ipcRenderer.invoke('replace-local-history-config', newContent)
      },

      // 部分エクスポート（オブジェクトとして渡す）
      exportSelectedAgents: async (arg: { selectedIds: number[]; includeHistory: boolean }) => {
        return await ipcRenderer.invoke('export-selected-agents', arg)
      },

      // 追加インポート
      appendLocalHistoryConfig: async (newContent: string) => {
        return await ipcRenderer.invoke('append-local-history-config', newContent)
      },

      // 外部API呼び出し
      callExternalAPI: async (apiConfig: any, params: any) => {
        return await ipcRenderer.invoke('callExternalAPI', apiConfig, params)
      },
      // 画像保存用の関数を追加
      saveImageToFile: async (base64Data: string) => {
        return await ipcRenderer.invoke('save-image-to-file', base64Data)
      },

      // 画像読み込み用の関数を追加
      loadImage: async (imagePath: string) => {
        return await ipcRenderer.invoke('load-image', imagePath)
      },
      directDeleteFile: async (filePath: string) => {
        return await ipcRenderer.invoke('direct-delete-file', filePath)
      },
      getUserDataPath: async () => {
        return await ipcRenderer.invoke('get-user-data-path')
      },
      saveApiKey: async (apiKey: string) => {
        return await ipcRenderer.invoke('save-api-key', apiKey)
      },
      loadApiKey: async () => {
        return await ipcRenderer.invoke('load-api-key')
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // fallback if contextIsolation=false
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
