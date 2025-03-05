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

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronAPI', {
      postChatAI: async (message: Messages[], apiKey: string, systemPrompt: string) => {
        try {
          return await ipcRenderer.invoke('postChatAI', message, apiKey, systemPrompt)
        } catch (error) {
          console.error('Error sending message (preload):', error)
          throw error
        }
      },
      readKnowledgeFiles: async (knowledgeFiles: string[]) => {
        return await ipcRenderer.invoke('read-knowledge-files', knowledgeFiles)
      },
      readKnowledgeFile: async (knowledgeFile: string) => {
        return await ipcRenderer.invoke('read-knowledge-file', knowledgeFile)
      },
      readPromptFile: async (pipeline: string, usecase: string) => {
        return await ipcRenderer.invoke('read-prompt-file', pipeline, usecase)
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
