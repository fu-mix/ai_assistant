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
      // ファイルを userDataにコピー
      copyFileToUserData: async () => {
        return await ipcRenderer.invoke('copy-file-to-userdata')
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

      // ★ ここから追加: タイトル設定を読み込み/保存
      loadTitleSettings: async () => {
        return await ipcRenderer.invoke('load-title-settings')
      },
      saveTitleSettings: async (settings: any) => {
        return await ipcRenderer.invoke('save-title-settings', settings)
      }
      // ★ ここまで
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
