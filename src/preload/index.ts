import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type Messages = {
  role: string
  parts: [
    {
      text: string
    },
    {
      inline_data?: {
        mime_type: string
        data: string
      }
    }?
  ]
}

// カスタムAPI
const api = {}

// ElectronがcontextIsolationを有効にしている場合、contextBridgeを介してAPIを注入
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    // ★ ここに ElectronAPI をまとめて定義
    contextBridge.exposeInMainWorld('electronAPI', {
      // すでにある postChatAI
      postChatAI: async (message: Messages[], apiKey: string, systemPrompt: string) => {
        try {
          return await ipcRenderer.invoke('postChatAI', message, apiKey, systemPrompt)
        } catch (error) {
          console.error('Error sending message (preload):', error)
          throw error
        }
      },

      // readXXX系 (すでにあるなら変更不要)
      readKnowledgeFiles: async (knowledgeFiles: string[]) => {
        return await ipcRenderer.invoke('read-knowledge-files', knowledgeFiles)
      },
      readKnowledgeFile: async (knowledgeFile: string) => {
        return await ipcRenderer.invoke('read-knowledge-file', knowledgeFile)
      },
      readPromptFile: async (pipeline: string, usecase: string) => {
        return await ipcRenderer.invoke('read-prompt-file', pipeline, usecase)
      },

      // ★ 追加: loadAgents / saveAgents
      loadAgents: async () => {
        // IPC経由で main/index.ts の store.get('agents') を呼び出す
        return await ipcRenderer.invoke('load-agents')
      },
      saveAgents: async (agentsData: any) => {
        // IPC経由で store.set('agents', ...) を呼び出す
        return await ipcRenderer.invoke('save-agents', agentsData)
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // contextIsolationがfalseの場合のフォールバック
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
