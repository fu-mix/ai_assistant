import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'

/**
 * AgentData型 (会話履歴やエージェント情報を保存する例)
 */
type Message = {
  type: string
  content: string
}
type AgentData = {
  id: number
  customTitle: string
  systemPrompt: string
  messages: Message[]
  createdAt: string
}

/**
 * Electron-store を動的 import するための関数
 */
async function initElectronStore() {
  // 動的インポート
  const { default: Store } = await import('electron-store')
  // userData パスを取得 (ビルド時 productName=desain_assistant であれば
  // C:\Users\<USERNAME>\AppData\Roaming\desain_assistant になる想定)
  const userDataPath = app.getPath('userData')
  const storePath = join(userDataPath, 'history')

  const store = new Store<{
    agents: AgentData[]
  }>({
    name: 'myhistory',
    cwd: storePath,
    defaults: {
      agents: []
    }
  })

  return store
}

// グローバル変数
let store: any = null

/**
 * createWindow
 */
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

/**
 * Electron起動
 */
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  // ここで electron-store を動的に import
  store = await initElectronStore()

  // IPC
  ipcMain.on('ping', () => console.log('pong'))

  // load-agents
  ipcMain.handle('load-agents', () => {
    return store.get('agents')
  })

  // save-agents
  ipcMain.handle('save-agents', (_event, newAgents: AgentData[]) => {
    store.set('agents', newAgents)

    return true
  })

  // postChatAI
  ipcMain.handle('postChatAI', async (_event, message, apiKey: string, systemPrompt: string) => {
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
  })

  // Window
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
