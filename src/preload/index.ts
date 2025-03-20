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

      // ▼ oldFilePath も渡せるように修正
      // ファイルを userDataにコピー (変更前ファイルパスを指定できる)
      copyFileToUserData: async (oldFilePath?: string) => {
        return await ipcRenderer.invoke('copy-file-to-userdata', oldFilePath)
      },

      // userData配下のファイルをbase64化
      readFileByPath: async (filePath: string) => {
        return await ipcRenderer.invoke('readFileByPath', filePath)
      },
      // ★ userDataファイル削除
      deleteFileInUserData: async (filePath: string) => {
        return await ipcRenderer.invoke('delete-file-in-userdata', filePath)
      },
      getAppVersion: async () => {
        return await ipcRenderer.invoke('get-app-version')
      },

      // タイトル設定を読み込み/保存
      loadTitleSettings: async () => {
        return await ipcRenderer.invoke('load-title-settings')
      },
      saveTitleSettings: async (settings: any) => {
        return await ipcRenderer.invoke('save-title-settings', settings)
      },

      // ★ ここからエクスポート／インポート用の新メソッド
      showSaveDialog: async (defaultFileName: string) => {
        return await ipcRenderer.invoke('show-save-dialog', defaultFileName)
      },
      showOpenDialogAndRead: async () => {
        return await ipcRenderer.invoke('show-open-dialog-and-read')
      },
      replaceLocalHistoryConfig: async (newContent: string) => {
        return await ipcRenderer.invoke('replace-local-history-config', newContent)
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
