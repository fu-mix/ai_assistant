import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'

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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)

    return { action: 'deny' }
  })

  mainWindow.setIcon(icon)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle(
  'postChatAI',
  async (_event, message: Messages[], apiKey: string, systemPrompt: string) => {
    const API_ENDPOINT =
      'https://ai-foundation-api.app/ai-foundation/chat-ai/gemini/pro:generateContent'
    const httpsAgent = new HttpsProxyAgent(`${import.meta.env.MAIN_VITE_PROXY}`)

    try {
      const response = await axios.post(
        API_ENDPOINT,
        {
          contents: message,
          system_instruction: {
            parts: [
              {
                text: systemPrompt
              }
            ]
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Access-Control-Allow-Origin': '*'
          },
          httpsAgent,
          proxy: false
        }
      )

      if (response.status !== 200) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const resData: string = response.data.candidates[0].content.parts[0].text

      return resData
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }
)
