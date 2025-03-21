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

      // ★ New: 部分エクスポート（複数IDを渡す）
      exportSelectedAgents: async (selectedIds: number[]) => {
        return await ipcRenderer.invoke('export-selected-agents', selectedIds)
      },

      // ★ New: 追加インポート
      appendLocalHistoryConfig: async (newContent: string) => {
        return await ipcRenderer.invoke('append-local-history-config', newContent)
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
