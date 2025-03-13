import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Messages定義
 */
type Messages = {
  role: string
  parts: [{ text: string }, { inline_data?: { mime_type: string; data: string } }?]
}

/**
 * 会話ログ用
 */
type Message = {
  type: 'user' | 'ai'
  content: string
}

/**
 * エージェント(アシスタント)の型。load/saveAgentsで管理
 */
type AgentData = {
  id: number
  customTitle: string
  systemPrompt: string
  messages: Message[]
  postMessages: Messages[]
  createdAt: string
  inputMessage: string
  agentFilePath?: string // userDataにコピーしたファイルパス
  agentFileData?: string // 互換のため残す場合
  agentFileMimeType?: string
}

// ※ StoreSchema は使わないので削除/コメントアウト
// interface StoreSchema {
//   agents: AgentData[]
// }

import { createRequire } from 'module'
let store: any = null

async function initStore() {
  const myRequire = createRequire(import.meta.url)
  const storeModule = myRequire('electron-store')
  const ElectronStore = storeModule.default

  const userDataPath = app.getPath('userData')
  const historyDir = path.join(userDataPath, 'history')

  const storeInstance = new ElectronStore({
    name: 'myhistory',
    cwd: historyDir,
    defaults: {
      agents: []
    }
  })

  return storeInstance
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1566,
    height: 1000,
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

app.whenReady().then(async () => {
  try {
    store = await initStore()
  } catch (err) {
    console.error('Error init store:', err)
  }

  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

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

// ----------------------
// load/save Agents
// ----------------------
ipcMain.handle('load-agents', () => {
  return store?.get('agents') || []
})

ipcMain.handle('save-agents', (_event, agents: AgentData[]) => {
  store?.set('agents', agents)

  return true
})

// ----------------------
// copy-file-to-userdata
// ----------------------
ipcMain.handle('copy-file-to-userdata', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) {
    return null
  }
  const originalPath = filePaths[0]

  try {
    const userDataDir = app.getPath('userData')
    const filesDir = path.join(userDataDir, 'files')
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true })
    }
    const fileName = path.basename(originalPath)
    const destPath = path.join(filesDir, fileName)

    fs.copyFileSync(originalPath, destPath)

    return destPath
  } catch (err) {
    console.error('Failed to copy file:', err)

    return null
  }
})

// ----------------------
// readFileByPath -> base64
// ----------------------
ipcMain.handle('readFileByPath', (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath)

    return data.toString('base64')
  } catch (err) {
    console.error('Failed to read file:', err)

    return null
  }
})

// ----------------------
// ★ ファイル削除IPC
// ----------------------
ipcMain.handle('delete-file-in-userdata', (_event, filePath: string) => {
  if (!filePath) return false
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)

      return true
    }

    return false
  } catch (err) {
    console.error('Failed to delete file:', err)

    return false
  }
})

// ----------------------
// postChatAI
//    - ★ APIリクエスト・レスポンスを console.log で出力
// ----------------------
ipcMain.handle(
  'postChatAI',
  async (_event, message: Messages[], apiKey: string, systemPrompt: string) => {
    const debugFlag = `${import.meta.env.MAIN_VITE_DEBUG}`

    if (debugFlag) {
      console.log('\n=== postChatAI Request ===')
      console.log('messages:', JSON.stringify(message, null, 2))
      console.log('apiKey:', apiKey ? '********' : '(none)')
      console.log('systemPrompt:', systemPrompt)
    }
    const API_ENDPOINT =
      'https://api.ai-service.global.fujitsu.com/ai-foundation/chat-ai/gemini/flash:generateContent'
    const httpsAgent = new HttpsProxyAgent(`${import.meta.env.MAIN_VITE_PROXY}`)

    try {
      const response = await axios.post(
        API_ENDPOINT,
        {
          contents: [...message],
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

      if (debugFlag) {
        console.log('\n=== postChatAI Response ===')
        console.log(resData)
        console.log('============================\n')
      }

      return resData
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }
)

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})
