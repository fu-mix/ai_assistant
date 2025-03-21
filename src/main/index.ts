import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import * as fs from 'fs'
import * as path from 'path'

// === 追加: adm-zip をインポート
import AdmZip from 'adm-zip'

// === 追加: os.userInfo() で実行ユーザー名を取得
import * as os from 'os'

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
  agentFilePaths?: string[] // 新しいフィールド対応
}

/**
 * タイトル設定の型 (複数セグメント+フォント)
 */
type TitleSegment = {
  text: string
  color: string
}
type TitleSettings = {
  segments: TitleSegment[]
  fontFamily: string
  backgroundImagePath?: string
}

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
    title: '',
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
ipcMain.handle('copy-file-to-userdata', async (_event, oldFilePath?: string) => {
  if (oldFilePath) {
    try {
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath)
        console.log('[copy-file-to-userdata] Deleted old file:', oldFilePath)
      }
    } catch (deleteErr) {
      console.error('[copy-file-to-userdata] Failed to delete old file:', deleteErr)
    }
  }

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
    console.log('[copy-file-to-userdata] Copied new file:', destPath)

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
// delete-file-in-userdata
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
            parts: [{ text: systemPrompt }]
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

ipcMain.handle('load-title-settings', () => {
  return store?.get('titleSettings') || null
})

ipcMain.handle('save-title-settings', (_event, newSettings: TitleSettings) => {
  store?.set('titleSettings', newSettings)

  return true
})

//
// === ↓ ここから既存の「エクスポート／インポート機能」 ===
//

// ---------- ユーザー名置換ユーティリティ ----------
function replaceRealUserNameWithToken(originalData: any): any {
  const data = JSON.parse(JSON.stringify(originalData))
  const userName = os.userInfo().username
  const basePrefix = `C:\\Users\\${userName}\\AppData\\Roaming\\desain_assistant\\files`
  const tokenPrefix = `C:\\Users\\{userName}\\AppData\\Roaming\\desain_assistant\\files`

  if (Array.isArray(data.agents)) {
    data.agents.forEach((agent: any) => {
      if (Array.isArray(agent.agentFilePaths)) {
        agent.agentFilePaths = agent.agentFilePaths.map((filePath: string) => {
          if (filePath.startsWith(basePrefix)) {
            return filePath.replace(basePrefix, tokenPrefix)
          }

          return filePath
        })
      }
    })
  }

  if (data.titleSettings && data.titleSettings.backgroundImagePath) {
    const p = data.titleSettings.backgroundImagePath
    if (p.startsWith(basePrefix)) {
      data.titleSettings.backgroundImagePath = p.replace(basePrefix, tokenPrefix)
    }
  }

  return data
}

function replaceTokenWithRealUserName(originalData: any): any {
  const data = JSON.parse(JSON.stringify(originalData))
  const userName = os.userInfo().username
  const tokenPrefix = `C:\\Users\\{userName}\\AppData\\Roaming\\desain_assistant\\files`
  const basePrefix = `C:\\Users\\${userName}\\AppData\\Roaming\\desain_assistant\\files`

  if (Array.isArray(data.agents)) {
    data.agents.forEach((agent: any) => {
      if (Array.isArray(agent.agentFilePaths)) {
        agent.agentFilePaths = agent.agentFilePaths.map((fp: string) => {
          if (fp.startsWith(tokenPrefix)) {
            return fp.replace(tokenPrefix, basePrefix)
          }

          return fp
        })
      }
    })
  }

  if (data.titleSettings && data.titleSettings.backgroundImagePath) {
    const p = data.titleSettings.backgroundImagePath
    if (p.startsWith(tokenPrefix)) {
      data.titleSettings.backgroundImagePath = p.replace(tokenPrefix, basePrefix)
    }
  }

  return data
}

// ---------- フォルダ再帰コピー ----------
function copyFolderRecursiveSync(src: string, dest: string) {
  if (!fs.existsSync(src)) {
    return
  }
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyFolderRecursiveSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// ----------------------------------------------------
// 既存: 全エージェントをZIPにまとめてエクスポート
// ----------------------------------------------------
ipcMain.handle('show-save-dialog', async (_event) => {
  try {
    const entireStoreData = store.store
    const replacedForExport = replaceRealUserNameWithToken(entireStoreData)
    const rawContentForExport = JSON.stringify(replacedForExport, null, 2)

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'アシスタント一式をエクスポート',
      defaultPath: 'assistant_export.zip',
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    })
    if (canceled || !filePath) {
      return
    }

    const zip = new AdmZip()
    zip.addFile('history/config.json', Buffer.from(rawContentForExport, 'utf-8'))

    const userDataDir = app.getPath('userData')
    const filesDir = path.join(userDataDir, 'files')
    if (fs.existsSync(filesDir)) {
      zip.addLocalFolder(filesDir, 'files')
    }

    zip.writeZip(filePath)
    console.log('[show-save-dialog] ZIPエクスポート完了:', filePath)

    return
  } catch (err) {
    console.error('[show-save-dialog]エクスポート中エラー:', err)
    throw err
  }
})

// ----------------------------------------------------
// 既存: ZIP(assistant_export.zip) を読み込み -> 展開 -> config.json復元
// ----------------------------------------------------
ipcMain.handle('show-open-dialog-and-read', async (_event) => {
  const debugFlag = `${import.meta.env.MAIN_VITE_DEBUG}`
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'アシスタント一式をインポート (ZIP)',
      properties: ['openFile'],
      filters: [
        { name: 'ZIP Files', extensions: ['zip'] },
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })
    if (canceled || filePaths.length === 0) {
      return null
    }

    const chosenPath = filePaths[0]
    if (!fs.existsSync(chosenPath)) {
      return null
    }

    // 拡張子が zip でなければ旧ロジック(単一json)
    if (path.extname(chosenPath).toLowerCase() !== '.zip') {
      const rawContent = fs.readFileSync(chosenPath, 'utf-8')

      return rawContent
    }

    // ZIP解凍
    const tmpDir = path.join(app.getPath('temp'), `tmp_import_${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    const zip = new AdmZip(chosenPath)
    zip.extractAllTo(tmpDir, true)
    if (debugFlag) {
      console.log('[show-open-dialog-and-read] ZIP解凍完了:', tmpDir)
    }
    const configJsonPath = path.join(tmpDir, 'history', 'config.json')
    if (!fs.existsSync(configJsonPath)) {
      console.error('ZIP内に history/config.json がありません')

      return null
    }

    let rawContent = fs.readFileSync(configJsonPath, 'utf-8')
    let parsed: any
    try {
      parsed = JSON.parse(rawContent)
    } catch (err) {
      console.error('ZIP内config.jsonが壊れています', err)

      return null
    }
    const replaced = replaceTokenWithRealUserName(parsed)
    rawContent = JSON.stringify(replaced, null, 2)

    // filesフォルダを上書きコピー
    const userDataDir = app.getPath('userData')
    const filesDir = path.join(userDataDir, 'files')
    const extractedFilesDir = path.join(tmpDir, 'files')
    if (fs.existsSync(extractedFilesDir)) {
      copyFolderRecursiveSync(extractedFilesDir, filesDir)
    }

    console.log('[show-open-dialog-and-read] filesフォルダをコピー完了')

    return rawContent
  } catch (err) {
    console.error('[show-open-dialog-and-read]インポート中エラー:', err)
    throw err
  }
})

// ----------------------------------------------------
// 既存: 全部置き換え時の処理 (config.json.oldにリネーム)
// ----------------------------------------------------
ipcMain.handle('replace-local-history-config', async (_event, newContent: string) => {
  try {
    const storeFilePath = store.path
    if (!fs.existsSync(storeFilePath)) {
      fs.writeFileSync(storeFilePath, newContent, 'utf-8')
    } else {
      const oldPath = storeFilePath + '.old'
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
      fs.renameSync(storeFilePath, oldPath)

      fs.writeFileSync(storeFilePath, newContent, 'utf-8')
    }

    const parsed = JSON.parse(newContent)
    store.store = parsed
  } catch (err) {
    console.error('[replace-local-history-config] インポート適用中エラー:', err)
    throw err
  }
})

//
// === ↓ ここからが「部分エクスポート」と「追加インポート」機能 ===
//

// ----------------------------------------------------
// (New) exportSelectedAgents: 選択されたエージェントだけをZIP化
//    ※ 一部エクスポート時は titleSettings を含めないように修正
// ----------------------------------------------------
ipcMain.handle('export-selected-agents', async (_event, selectedIds: number[]) => {
  try {
    const entireStoreData = store.store || {}
    const allAgents: AgentData[] = entireStoreData.agents || []
    const exportedAgents = allAgents.filter((a) => selectedIds.includes(a.id))

    // ★ 一部エクスポートの場合、titleSettingsは含めない
    const partialData = {
      agents: exportedAgents
    }

    // ユーザー名 → {userName} 置換
    const replacedForExport = replaceRealUserNameWithToken(partialData)
    const rawContentForExport = JSON.stringify(replacedForExport, null, 2)

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '部分エクスポート (ZIP)',
      defaultPath: 'partial_export.zip',
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    })
    if (canceled || !filePath) {
      return
    }

    const zip = new AdmZip()
    zip.addFile('history/config.json', Buffer.from(rawContentForExport, 'utf-8'))

    // 選択エージェントが持つファイルを収集
    const userDataDir = app.getPath('userData')
    const filesDir = path.join(userDataDir, 'files')
    if (!fs.existsSync(filesDir)) {
      // filesフォルダ自体が無ければ config.jsonだけ
      zip.writeZip(filePath)
      console.log('[export-selected-agents] partial export done (no files folder)')

      return
    }

    const uniquePaths = new Set<string>()
    for (const agent of exportedAgents) {
      if (agent.agentFilePaths) {
        for (const p of agent.agentFilePaths) {
          if (p.startsWith(filesDir)) {
            uniquePaths.add(p)
          }
        }
      }
    }
    // 重複除去した上でzipに追加
    uniquePaths.forEach((absPath) => {
      if (fs.existsSync(absPath)) {
        const relativePath = path.relative(filesDir, absPath)
        zip.addLocalFile(absPath, 'files', relativePath)
      }
    })

    zip.writeZip(filePath)
    console.log('[export-selected-agents] partial export complete:', filePath)
  } catch (err) {
    console.error('[export-selected-agents]エラー:', err)
    throw err
  }
})

// ----------------------------------------------------
// (New) append-local-history-config: インポートjsonを既存に追加 (ID衝突→新ID付与)
// ----------------------------------------------------
ipcMain.handle('append-local-history-config', async (_event, newContent: string) => {
  try {
    const parsed = JSON.parse(newContent)
    const importedAgents: AgentData[] = parsed.agents || []
    const importedTitleSettings = parsed.titleSettings || {}

    // 既存store
    const storeFilePath = store.path
    const oldData = store.store || {}
    if (!oldData.agents) {
      oldData.agents = []
    }
    const existingAgents: AgentData[] = oldData.agents

    // 既存IDs
    const existingIds = new Set<number>(existingAgents.map((a) => a.id))

    // 被ってるIDに対しては新しいIDを振る
    for (const agent of importedAgents) {
      if (existingIds.has(agent.id)) {
        agent.id = Date.now() + Math.floor(Math.random() * 100000)
      }
    }

    // 既存との結合
    const merged = [...existingAgents, ...importedAgents]
    oldData.agents = merged

    // titleSettings のマージ方針 = インポート側で上書き or 結合等、好みに応じて
    // ここは「インポート版を上書き適用」というシンプル実装
    oldData.titleSettings = {
      ...oldData.titleSettings,
      ...importedTitleSettings
    }

    // JSON化して保存
    const finalStr = JSON.stringify(oldData, null, 2)
    fs.writeFileSync(storeFilePath, finalStr, 'utf-8')

    // storeに即時反映
    store.store = oldData
    console.log('[append-local-history-config] 追加インポート完了')
  } catch (err) {
    console.error('[append-local-history-config] 追加インポートエラー:', err)
    throw err
  }
})
