import { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// データ保存用ストアの初期化
const store = new Store({
  defaults: {
    hotkey: 'Ctrl+Alt+Space',
    shortcuts: [
      { id: '1', name: 'tenki', description: 'Yahoo!天気', target: 'https://weather.yahoo.co.jp/weather/', type: 'url' }
    ]
  }
})

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null

// グローバルショートカットの登録関数
function registerGlobalShortcut(shortcutKey: string) {
  globalShortcut.unregisterAll()
  try {
    globalShortcut.register(shortcutKey, () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow?.show()
        mainWindow?.focus()
      }
    })
  } catch (err) {
    console.error('Failed to register shortcut:', err)
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 60, // 候補リスト表示に合わせて高さは自動調整されるように設定
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    show: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false // 簡易的なIPC通信用
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('blur', () => {
    mainWindow?.hide()
  })
}

function createSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 850,
    minWidth: 800,
    height: 550,
    title: '設定',
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/settings`)
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function createTray() {
// 1. アイコン画像パスの指定（プロジェクト直下の public/icon.png）
  const iconPath = path.join(__dirname, '../public/icon.png')
  let icon = nativeImage.createFromPath(iconPath)

  // 2. 画像が見つからない/読み込めない場合は、プログラムで「簡易アイコン（青い四角）」を生成する
  if (icon.isEmpty()) {
    const buffer = Buffer.alloc(16 * 16 * 4)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 97     // Blue
      buffer[i + 1] = 175 // Green
      buffer[i + 2] = 239 // Red
      buffer[i + 3] = 255 // Alpha (不透明)
    }
    // Uint8Array に変換して安全に渡す
    icon = nativeImage.createFromBuffer(buffer, { width: 16, height: 16 })
  } else {
    // 画像がある場合は 16x16 にリサイズ
    icon = icon.resize({ width: 16, height: 16 })
  }

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: '表示', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { label: '設定', click: () => { createSettingsWindow() } },
    { type: 'separator' },
    { label: '終了', click: () => { app.quit() } },
  ])

  tray.setToolTip('SimpleLauncher')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus() })
}

// --- IPC 通信イベントハンドラー ---
// 1. 保存データの取得
ipcMain.handle('get-store-data', () => {
  return {
    hotkey: store.get('hotkey'),
    shortcuts: store.get('shortcuts')
  }
})

// 2. ショートカット一覧の保存
ipcMain.handle('save-shortcuts', (_, shortcuts) => {
  store.set('shortcuts', shortcuts)
  return true
})

// 3. 起動ホットキーの変更・保存
ipcMain.handle('save-hotkey', (_, hotkey: string) => {
  store.set('hotkey', hotkey)
  registerGlobalShortcut(hotkey)
  return true
})

// 4. URLまたはアプリの起動処理
ipcMain.handle('open-target', (_, { target, type }) => {
  if (type === 'url') {
    shell.openExternal(target)
  } else {
    shell.openPath(target) // アプリ実行ファイルのパスを開く
  }
  mainWindow?.hide()
})

// 5. メインウィンドウの高さ変更（候補数に応じて伸ばす）
ipcMain.handle('resize-window', (_, height: number) => {
  if (mainWindow) {
    mainWindow.setSize(600, height)
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createMainWindow()
  createTray()

  const currentHotkey = store.get('hotkey') as string
  registerGlobalShortcut(currentHotkey)
})

app.on('window-all-closed', (e: Electron.Event) => { 
  e.preventDefault() 
})
app.on('will-quit', () => { globalShortcut.unregisterAll() })