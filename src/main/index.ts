import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
//import icon from '../../resources/icon.png?asset'

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

// APIキー用ストア変数
let apiKeyStore: any = null

// 言語設定用ストア変数
let languageStore: any = null

/* ────────────────────────────────────────────────
   共通ユーティリティ
──────────────────────────────────────────────── */
function buildProxyAgent() {
  // .env で定義されていなければ '' が返る
  const proxy = `${import.meta.env.MAIN_VITE_PROXY}`.trim()

  // 空文字列なら Agent を作らない
  if (!proxy) return { useProxy: false } // ⟵ ここで終了

  // Proxy が設定されている場合だけ生成
  return { useProxy: true, httpsAgent: new HttpsProxyAgent(proxy) }
}

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

// APIキー専用ストアの初期化関数を分離
async function initApiKeyStore() {
  const myRequire = createRequire(import.meta.url)
  const storeModule = myRequire('electron-store')
  const ElectronStore = storeModule.default

  const userDataPath = app.getPath('userData')
  const secureDir = path.join(userDataPath, 'secure')

  // マシン固有情報から暗号化キーを生成
  const machineId = os.hostname() + os.userInfo().username
  const encryptionKey = Buffer.from(machineId).toString('hex').slice(0, 32)

  // APIキー専用の暗号化ストアを別ファイルで作成
  const apiKeyStoreInstance = new ElectronStore({
    name: 'api-keys', // 別のファイル名を使用
    cwd: secureDir,
    encryptionKey, // 暗号化キーを設定
    clearInvalidConfig: true
  })

  return apiKeyStoreInstance
}

// 言語設定専用ストアの初期化関数
async function initLanguageStore() {
  const myRequire = createRequire(import.meta.url)
  const storeModule = myRequire('electron-store')
  const ElectronStore = storeModule.default

  const userDataPath = app.getPath('userData')
  const configDir = path.join(userDataPath, 'config')

  const languageStoreInstance = new ElectronStore({
    name: 'language-settings',
    cwd: configDir,
    defaults: {
      language: null // 初回はnull
    }
  })

  return languageStoreInstance
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1566,
    height: 1000,
    show: false,
    autoHideMenuBar: true,
    title: '',
    ...(process.platform === 'linux' ? {} : {}),
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

  //mainWindow.setIcon(icon)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    store = await initStore()

    // APIキー専用ストアを別途初期化
    apiKeyStore = await initApiKeyStore()

    // 言語設定ストアの初期化
    languageStore = await initLanguageStore()
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
    const API_ENDPOINT = `${import.meta.env.MAIN_VITE_API_ENDPOINT}`

    const proxyUrl = `${import.meta.env.MAIN_VITE_PROXY}`.trim()
    const useProxy = proxyUrl !== ''
    const httpsAgent = useProxy ? new HttpsProxyAgent(proxyUrl) : undefined

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
          // httpsAgent,
          // proxy: false
          ...(useProxy && { httpsAgent, proxy: false })
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
//    ※ 一部エクスポート時は titleSettings を含めない
//    ※ さらに「会話履歴を含むかどうか」を指定できるように修正
// ----------------------------------------------------
ipcMain.handle(
  'export-selected-agents',
  async (_event, arg: { selectedIds: number[]; includeHistory: boolean }) => {
    const debugFlag = `${import.meta.env.MAIN_VITE_DEBUG}`
    try {
      const { selectedIds, includeHistory } = arg

      const entireStoreData = store.store || {}
      const allAgents: AgentData[] = entireStoreData.agents || []
      const exportedAgents = allAgents.filter((a) => selectedIds.includes(a.id))

      // 会話履歴を含まない場合、messages / postMessages を空にする
      if (!includeHistory) {
        for (const ag of exportedAgents) {
          ag.messages = []
          ag.postMessages = []
        }
      }

      // 一部エクスポートの場合、titleSettingsは含めない
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
        if (debugFlag) {
          console.log('[export-selected-agents] partial export done (no files folder)')
        }

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
      if (debugFlag) {
        console.log('[export-selected-agents] partial export complete:', filePath)
      }
    } catch (err) {
      console.error('[export-selected-agents]エラー:', err)
      throw err
    }
  }
)

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

// 外部API呼び出し用のIPC通信ハンドラを追加
ipcMain.handle('callExternalAPI', async (_event, apiConfig: any, params: any) => {
  const debugFlag = `${import.meta.env.MAIN_VITE_DEBUG}`

  try {
    const { endpoint, method, headers, bodyTemplate, queryParamsTemplate, authType, authConfig } =
      apiConfig

    if (debugFlag) {
      console.log('\n=== API Request ===')
      console.log('Endpoint:', endpoint)
      console.log('Method:', method)
      console.log('Headers:', JSON.stringify(headers, null, 2))
      console.log('Parameters:', JSON.stringify(params, null, 2))

      // 認証情報のマスク処理（既存のコード）
      let authInfo = 'None'
      if (authType === 'bearer') authInfo = 'Bearer Token: ********'
      else if (authType === 'apiKey')
        authInfo = `API Key (${authConfig?.keyName || 'unknown'}): ********`
      else if (authType === 'basic') authInfo = 'Basic Auth: ********'
      console.log('Authentication:', authInfo)
    }

    // 既存の認証情報処理（変更なし）
    const finalHeaders = { ...headers }
    if (authType === 'bearer' && authConfig?.token) {
      let token = authConfig.token
      if (token.includes('${params.apiKey}') && params.apiKey) {
        token = params.apiKey
      }
      finalHeaders['Authorization'] = `Bearer ${token}`
    } else if (authType === 'basic' && authConfig?.username && authConfig?.password) {
      const auth = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64')
      finalHeaders['Authorization'] = `Basic ${auth}`
    } else if (authType === 'apiKey' && authConfig?.keyName && authConfig?.keyValue) {
      if (authConfig.inHeader) {
        finalHeaders[authConfig.keyName] = authConfig.keyValue
      }
    }

    // 既存のリクエストボディとクエリパラメータの処理（変更なし）
    let url = endpoint
    let requestData = null

    if (queryParamsTemplate) {
      try {
        const paramsObj = params || {}
        const templateFn = new Function(
          'params',
          'return `' + queryParamsTemplate.replace(/`/g, '\\`') + '`'
        )
        const queryParamsJson = templateFn(paramsObj)
        const queryParams = JSON.parse(queryParamsJson)

        const queryString = Object.entries(queryParams)
          .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
          .join('&')
        if (debugFlag) {
          console.log('Query Parameters:', queryString)
        }

        url = `${endpoint}${url.includes('?') ? '&' : '?'}${queryString}`
      } catch (err) {
        console.error('Failed to process query parameters:', err)
      }
    }

    if (bodyTemplate && (method === 'POST' || method === 'PUT')) {
      try {
        const paramsObj = params || {}

        // プロンプトなどの文字列パラメータの改行を適切に処理
        const sanitizedParams = { ...paramsObj }

        // 画像生成用のプロンプトなど、文字列型パラメータの改行を処理
        Object.keys(sanitizedParams).forEach((key) => {
          if (typeof sanitizedParams[key] === 'string') {
            // 改行を空白に置換して1行にする
            sanitizedParams[key] = sanitizedParams[key].replace(/\r?\n/g, ' ')
          }
        })

        // テンプレートからリクエストボディを生成する際にsanitizedParamsを渡す
        const templateFn = new Function(
          'params',
          'return `' + bodyTemplate.replace(/`/g, '\\`') + '`'
        )

        // sanitizedParamsを引数として渡す
        const bodyJson = templateFn(sanitizedParams)
        // const templateFn = new Function(
        //   'params',
        //   'return `' + bodyTemplate.replace(/`/g, '\\`') + '`'
        // )
        // const bodyJson = templateFn(paramsObj)
        requestData = JSON.parse(bodyJson)
        if (debugFlag) {
          console.log('Request Body:', JSON.stringify(requestData, null, 2))
        }
      } catch (err) {
        console.error('Failed to process request body:', err)
      }
    }

    if (debugFlag) {
      console.log('==================\n')
    }

    // APIリクエスト実行
    // const response = await axios({
    //   method: method.toLowerCase(),
    //   url,
    //   headers: finalHeaders,
    //   data: requestData,
    //   httpsAgent: new HttpsProxyAgent(`${import.meta.env.MAIN_VITE_PROXY}`),
    //   proxy: false,
    //   // 画像の場合はJSONレスポンスを期待
    //   responseType: 'json'
    // })

    const { httpsAgent, useProxy } = buildProxyAgent()

    const response = await axios({
      method: method.toLowerCase(),
      url,
      headers: finalHeaders,
      data: requestData,
      ...(useProxy && { httpsAgent, proxy: false }), // 空なら付かない
      responseType: 'json'
    })

    if (debugFlag) {
      console.log('\n=== API Response ===')
      console.log('Status:', response.status)
      console.log('Headers:', JSON.stringify(response.headers, null, 2))
      console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 1000) + '...')
      console.log('====================\n')
    }

    // 画像生成APIの場合の特別処理
    if (apiConfig.responseType === 'image') {
      try {
        // imageDataPathからデータを抽出（例: 'data[0].b64_json'）
        let base64Data = response.data

        if (apiConfig.imageDataPath) {
          // ドット記法でネストされたプロパティにアクセス
          const pathParts = apiConfig.imageDataPath.split('.')
          let current = response.data

          // 配列表記（例: data[0]）も処理
          for (const part of pathParts) {
            const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/)
            if (arrayMatch) {
              // 配列要素へのアクセス
              const [_, arrayName, index] = arrayMatch
              current = current[arrayName][parseInt(index)]
            } else {
              // 通常のプロパティアクセス
              current = current[part]
            }
          }

          base64Data = current
        }

        // ここでbase64Dataが実際の画像データになっているはず
        if (base64Data) {
          // 画像データをレンダラープロセスに返す
          return {
            success: true,
            type: 'image',
            data: base64Data,
            status: response.status
          }
        }
      } catch (err) {
        console.error('Error processing image response:', err)
      }
    }

    // 既存のレスポンス処理
    let formattedResponse = response.data
    if (apiConfig.responseTemplate) {
      try {
        const templateFn = new Function(
          'responseObj',
          'return `' + apiConfig.responseTemplate.replace(/`/g, '\\`') + '`'
        )
        formattedResponse = templateFn(response.data)
      } catch (err) {
        console.error('Error formatting response:', err)
      }
    }

    return {
      success: true,
      data: formattedResponse,
      status: response.status
    }
  } catch (error) {
    console.error('Error calling external API:', error)

    if (debugFlag) {
      console.log('\n=== API Error ===')
      // @ts-ignore
      console.log('Message:', error.message)
      // @ts-ignore
      console.log('Status:', error.response?.status)
      // @ts-ignore
      console.log('Data:', error.response?.data)
      console.log('================\n')
    }

    return {
      success: false,
      // @ts-ignore
      error: error.message,
      // @ts-ignore
      status: error.response?.status || 500
    }
  }
})
// 画像保存用IPCハンドラー
ipcMain.handle('save-image-to-file', async (_event, base64Data: string) => {
  const imageId = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const userDataDir = app.getPath('userData')
  const imagesDir = path.join(userDataDir, 'images')

  // imagesディレクトリの作成
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true })
  }

  const filePath = path.join(imagesDir, `${imageId}.png`)

  try {
    // Base64データをデコードして保存
    const imageBuffer = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(filePath, imageBuffer)

    // 相対パスを返す
    return `images/${imageId}.png`
  } catch (err) {
    console.error('Failed to save image:', err)
    throw err
  }
})

// 画像読み込み用IPCハンドラー
ipcMain.handle('load-image', async (_event, imagePath: string) => {
  try {
    const userDataDir = app.getPath('userData')
    const fullPath = path.join(userDataDir, imagePath)

    if (fs.existsSync(fullPath)) {
      const data = fs.readFileSync(fullPath)

      return data.toString('base64')
    }

    return null
  } catch (err) {
    console.error('Failed to load image:', err)

    return null
  }
})

ipcMain.handle('direct-delete-file', (_event, filePath: string) => {
  if (!filePath) return false
  console.log(`[direct-delete-file] 削除試行: ${filePath}`)

  try {
    // 絶対パスとして試行
    if (path.isAbsolute(filePath)) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`[direct-delete-file] 絶対パスで削除成功: ${filePath}`)

        return true
      }
    }

    // 相対パスの場合または絶対パスでの削除に失敗した場合
    // ユーザーデータディレクトリと結合して試行
    const userDataDir = app.getPath('userData')

    // パターン1: userDataDir直下
    let combinedPath = path.join(userDataDir, filePath)
    if (fs.existsSync(combinedPath)) {
      fs.unlinkSync(combinedPath)
      console.log(`[direct-delete-file] ユーザーデータ直下で削除成功: ${combinedPath}`)

      return true
    }

    // パターン2: userDataDir/files直下
    combinedPath = path.join(userDataDir, 'files', filePath.replace(/^files[/\\]?/, ''))
    if (fs.existsSync(combinedPath)) {
      fs.unlinkSync(combinedPath)
      console.log(`[direct-delete-file] files直下で削除成功: ${combinedPath}`)

      return true
    }

    // パターン3: userDataDir/images直下
    combinedPath = path.join(userDataDir, 'images', path.basename(filePath))
    if (fs.existsSync(combinedPath)) {
      fs.unlinkSync(combinedPath)
      console.log(`[direct-delete-file] images直下で削除成功: ${combinedPath}`)

      return true
    }

    // パターン4: userDataDir/files/images直下
    combinedPath = path.join(userDataDir, 'files', 'images', path.basename(filePath))
    if (fs.existsSync(combinedPath)) {
      fs.unlinkSync(combinedPath)
      console.log(`[direct-delete-file] files/images直下で削除成功: ${combinedPath}`)

      return true
    }

    console.log(`[direct-delete-file] 該当ファイルが見つかりませんでした: ${filePath}`)

    return false
  } catch (err) {
    console.error(`[direct-delete-file] 削除エラー: ${filePath}`, err)

    return false
  }
})

// ----------------------
// get-user-data-path
// ----------------------
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData')
})

// APIキー保存用のIPCハンドラを追加
ipcMain.handle('save-api-key', (_event, apiKey: string) => {
  try {
    if (!apiKeyStore) {
      console.error('API Key Store not initialized')

      return false
    }

    // 空のキーなら削除
    if (!apiKey || apiKey.trim() === '') {
      apiKeyStore.delete('apiKey')

      return true
    }

    // APIキーを保存
    apiKeyStore.set('apiKey', apiKey)

    return true
  } catch (err) {
    console.error('Error saving API key:', err)

    return false
  }
})

// APIキー読み込み用のIPCハンドラを追加
ipcMain.handle('load-api-key', () => {
  try {
    if (!apiKeyStore) {
      console.error('API Key Store not initialized')

      return ''
    }

    return apiKeyStore.get('apiKey', '')
  } catch (err) {
    console.error('Error loading API key:', err)

    return ''
  }
})

// ----------------------
// 言語設定用IPCハンドラー
// ----------------------
ipcMain.handle('get-system-locale', () => {
  // システムのロケール情報を取得
  return app.getLocale()
})

ipcMain.handle('get-stored-locale', () => {
  try {
    if (!languageStore) {
      console.error('Language Store not initialized')

      return null
    }

    return languageStore.get('language', null)
  } catch (err) {
    console.error('Error loading language setting:', err)

    return null
  }
})

ipcMain.handle('set-locale', (_event, language: string) => {
  try {
    if (!languageStore) {
      console.error('Language Store not initialized')

      return false
    }

    languageStore.set('language', language)

    return true
  } catch (err) {
    console.error('Error saving language setting:', err)

    return false
  }
})
