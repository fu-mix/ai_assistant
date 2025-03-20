import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import * as fs from 'fs'
import * as path from 'path'

// === 追加: adm-zip をインポート ===
import AdmZip from 'adm-zip'

// 追加: os.userInfo() で実行ユーザー名を取得するため
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
  // 修正: agentFilePaths をサポートしうる場合もある (下位互換用にこのまま)
}

/**
 * タイトル設定の型を定義 (複数セグメント+フォント)
 */
type TitleSegment = {
  text: string
  color: string
}
type TitleSettings = {
  segments: TitleSegment[]
  fontFamily: string
  backgroundImagePath?: string // background 追加
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
// copy-file-to-userdata (修正)
//    - oldFilePathが渡された場合は先に削除してからコピー
// ----------------------
ipcMain.handle('copy-file-to-userdata', async (_event, oldFilePath?: string) => {
  // 1) もし oldFilePath が指定されていれば削除を試みる
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

  // 2) ファイル選択ダイアログ
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
//    - APIリクエスト・レスポンスを console.log で出力
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

ipcMain.handle('load-title-settings', () => {
  return store?.get('titleSettings') || null
})

ipcMain.handle('save-title-settings', (_event, newSettings: TitleSettings) => {
  store?.set('titleSettings', newSettings)

  return true
})

//
// === ↓ ここからが「エクスポート／インポート機能」の追記部分です ====
//

// === ここまでは既存 ===

// ----------------------------------------------------
// (1) ユーザー名を {userName} に置き換える (エクスポート時用)
// ----------------------------------------------------
function replaceRealUserNameWithToken(originalData: any): any {
  // deep copy
  const data = JSON.parse(JSON.stringify(originalData))
  const userName = os.userInfo().username
  // Windows想定のベースパスを作成 (例: C:\Users\xxx\AppData\Roaming\desain_assistant\files)
  const basePrefix = `C:\\Users\\${userName}\\AppData\\Roaming\\desain_assistant\\files`
  const tokenPrefix = `C:\\Users\\{userName}\\AppData\\Roaming\\desain_assistant\\files`

  // もし agents があれば、agentFilePaths を置換
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

  // titleSettings.backgroundImagePath も置換
  if (data.titleSettings && data.titleSettings.backgroundImagePath) {
    const p = data.titleSettings.backgroundImagePath
    if (p.startsWith(basePrefix)) {
      data.titleSettings.backgroundImagePath = p.replace(basePrefix, tokenPrefix)
    }
  }

  return data
}

// ----------------------------------------------------
// (2) {userName} を 実行ユーザー名 に書き換える (インポート時用)
// ----------------------------------------------------
function replaceTokenWithRealUserName(originalData: any): any {
  // deep copy
  const data = JSON.parse(JSON.stringify(originalData))
  const userName = os.userInfo().username
  // Windows想定
  const tokenPrefix = `C:\\Users\\{userName}\\AppData\\Roaming\\desain_assistant\\files`
  const basePrefix = `C:\\Users\\${userName}\\AppData\\Roaming\\desain_assistant\\files`

  // agents
  if (Array.isArray(data.agents)) {
    data.agents.forEach((agent: any) => {
      if (Array.isArray(agent.agentFilePaths)) {
        agent.agentFilePaths = agent.agentFilePaths.map((filePath: string) => {
          if (filePath.startsWith(tokenPrefix)) {
            return filePath.replace(tokenPrefix, basePrefix)
          }

          return filePath
        })
      }
    })
  }

  // titleSettings
  if (data.titleSettings && data.titleSettings.backgroundImagePath) {
    const p = data.titleSettings.backgroundImagePath
    if (p.startsWith(tokenPrefix)) {
      data.titleSettings.backgroundImagePath = p.replace(tokenPrefix, basePrefix)
    }
  }

  return data
}

// ----------------------------------------------------
// config.json + filesフォルダ → ZIP 生成エクスポート
// ----------------------------------------------------

// ipcMain.handle('show-save-dialog', async (_event, defaultFileName: string) => {
ipcMain.handle('show-save-dialog', async (_event) => {
  try {
    // electron-store 全体データを取り出す (agents, titleSettings 等すべて)
    const entireStoreData = store.store

    // --- (A) ユーザー名部分を {userName} に置換 ---
    const replacedForExport = replaceRealUserNameWithToken(entireStoreData)
    const rawContentForExport = JSON.stringify(replacedForExport, null, 2)

    // 「assistant_export.zip」をデフォルトにする
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'アシスタント一式をエクスポート',
      defaultPath: 'assistant_export.zip',
      filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    })
    if (canceled || !filePath) {
      return // ユーザーキャンセル
    }

    // --- (B) ZIP を作成 ---
    const zip = new AdmZip()

    // 1) config.json を ZIP 内に追加 (history/config.jsonというパスにしておく)
    zip.addFile('history/config.json', Buffer.from(rawContentForExport, 'utf-8'))

    // 2) files フォルダ配下の全ファイルを ZIP に追加
    const userDataDir = app.getPath('userData')
    const filesDir = path.join(userDataDir, 'files')
    if (fs.existsSync(filesDir)) {
      // 再帰的に全ファイルを追加
      zip.addLocalFolder(filesDir, 'files')
    }

    // --- (C) ZIPを書き出し ---
    zip.writeZip(filePath)

    console.log('[show-save-dialog] ZIPエクスポート完了:', filePath)

    return
  } catch (err) {
    console.error('[show-save-dialog]エクスポート中エラー:', err)
    throw err
  }
})

// ----------------------------------------------------
// ZIP(assistant_export.zip) を読み込み -> 展開 -> config.json復元
// ----------------------------------------------------
ipcMain.handle('show-open-dialog-and-read', async (_event) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'アシスタント一式をインポート (ZIP)',
      properties: ['openFile'],
      filters: [
        { name: 'ZIP Files', extensions: ['zip'] },
        // 下位互換でjsonも一応許可
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

    // -------------------------
    // (A) もし拡張子が zip でなければ旧ロジック(従来のJSONインポート)を使う
    // -------------------------
    if (path.extname(chosenPath).toLowerCase() !== '.zip') {
      // 旧: config.json だけ読む動作
      const rawContent = fs.readFileSync(chosenPath, 'utf-8')

      // そのまま返す
      return rawContent
    }

    // -------------------------
    // (B) ZIP 解凍して config.json + filesディレクトリ を取り出す
    // -------------------------
    const tmpDir = path.join(app.getPath('temp'), `tmp_import_${Date.now()}`)
    fs.mkdirSync(tmpDir, { recursive: true })

    const zip = new AdmZip(chosenPath)
    zip.extractAllTo(tmpDir, true)
    console.log('[show-open-dialog-and-read] ZIP解凍完了:', tmpDir)

    // config.json は history/config.json に置かれている想定
    const configJsonPath = path.join(tmpDir, 'history', 'config.json')
    if (!fs.existsSync(configJsonPath)) {
      console.error('ZIP内に history/config.json がありません')

      return null
    }

    let rawContent = fs.readFileSync(configJsonPath, 'utf-8')
    // JSONパースできるかチェック
    let parsed: any = null
    try {
      parsed = JSON.parse(rawContent)
    } catch (err) {
      console.error('ZIP内config.jsonが壊れています', err)

      return null
    }

    // {userName} を 実行ユーザー名 に置換
    const replaced = replaceTokenWithRealUserName(parsed)
    rawContent = JSON.stringify(replaced, null, 2)

    // -------------------------
    // (C) filesフォルダの中身を userData/files へコピー(上書き)
    // -------------------------
    const userDataDir = app.getPath('userData')
    const filesDir = path.join(userDataDir, 'files')
    const extractedFilesDir = path.join(tmpDir, 'files')

    if (fs.existsSync(extractedFilesDir)) {
      // ディレクトリを再帰的にコピー
      copyFolderRecursiveSync(extractedFilesDir, filesDir)
    }

    console.log('[show-open-dialog-and-read] filesフォルダをコピー完了')

    // 最後に、呼び出し元(レンダラー)へ rawContent(最終的に置換済みのconfig) を返す
    return rawContent
  } catch (err) {
    console.error('[show-open-dialog-and-read]インポート中エラー:', err)
    throw err
  }
})

// 再帰コピー用: シンプルなフォルダコピー関数
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
// 古い config.json を .old にリネームし、新しい config をコピー
//   + store に反映
// ----------------------------------------------------
ipcMain.handle('replace-local-history-config', async (_event, newContent: string) => {
  try {
    const storeFilePath = store.path // electron-storeの実ファイル
    if (!fs.existsSync(storeFilePath)) {
      // もし存在しないなら、そのまま書き込み
      fs.writeFileSync(storeFilePath, newContent, 'utf-8')
    } else {
      // oldにリネーム
      const oldPath = storeFilePath + '.old'
      // 既に old があれば削除
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
      fs.renameSync(storeFilePath, oldPath)

      // 新しい config をコピー
      fs.writeFileSync(storeFilePath, newContent, 'utf-8')
    }

    // さらに store に反映 (次回アプリ起動時だけでなく即時反映するため)
    const parsed = JSON.parse(newContent)
    store.store = parsed
  } catch (err) {
    console.error('[replace-local-history-config] インポート適用中エラー:', err)
    throw err
  }
})
