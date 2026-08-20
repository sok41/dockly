import { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, shell, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// データ保存用ストアの初期化
const store = new Store({
  defaults: {
    // Ctrl+Alt+Space は他アプリ（各種ランチャー/オーバーレイ系）が好んで使う組み合わせで
    // 競合しやすいため、文字キーを使った Ctrl+Alt+L をデフォルトにする
    hotkey: 'Ctrl+Alt+L',
    shortcuts: [
      { id: '1', name: 'tenki', description: 'Yahoo!天気', target: 'https://weather.yahoo.co.jp/weather/', type: 'url' }
    ]
  }
})

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null

// グローバルショートカットの登録関数
// 戻り値: 登録に成功したか（他アプリと競合している場合は false になる）
function registerGlobalShortcut(shortcutKey: string): boolean {
  globalShortcut.unregisterAll()
  try {
    const success = globalShortcut.register(shortcutKey, () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow?.show()
        mainWindow?.focus()
      }
    })
    if (!success) {
      // register() は他アプリがそのキーを既に使っている場合、例外を投げずに false を返す
      console.error('Failed to register shortcut (already in use by another app):', shortcutKey)
    }
    return success
  } catch (err) {
    console.error('Failed to register shortcut:', err)
    return false
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
// 戻り値: 実際にOS側への登録まで成功したか（false の場合は他アプリと競合している）
ipcMain.handle('save-hotkey', (_, hotkey: string) => {
  const success = registerGlobalShortcut(hotkey)
  store.set('hotkey', hotkey) // 競合していても希望のキーとして保存はしておく（後で他アプリが閉じれば有効になる）
  return success
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

// 4.5 外部リンクをOS既定のブラウザで開く（設定画面のGitHubリンクなど）
ipcMain.handle('open-external', (_, url: string) => {
  shell.openExternal(url)
})

// 5. メインウィンドウの高さ変更（候補数に応じて伸ばす）
ipcMain.handle('resize-window', (_, height: number) => {
  if (mainWindow) {
    mainWindow.setSize(600, height)
  }
})

// --- 自動アップデート（GitHub Releases経由） ---
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

function getUpdateDialogParent(): BrowserWindow | undefined {
  return settingsWindow ?? mainWindow ?? undefined
}

autoUpdater.on('update-available', (info) => {
  const parent = getUpdateDialogParent()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'info',
    title: 'アップデートがあります',
    message: 'アップデートがありました。インストールしますか？',
    detail: `新しいバージョン (v${info.version}) が利用可能です。`,
    buttons: ['インストール', 'キャンセル'],
    cancelId: 1,
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate()
    }
  })
})

autoUpdater.on('update-not-available', () => {
  const parent = getUpdateDialogParent()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'info',
    title: 'アップデート確認',
    message: '現在お使いのバージョンは最新です。',
  })
})

autoUpdater.on('error', (err) => {
  const parent = getUpdateDialogParent()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'error',
    title: 'アップデートエラー',
    message: 'アップデートの確認中にエラーが発生しました。',
    detail: String(err),
  })
})

autoUpdater.on('update-downloaded', () => {
  const parent = getUpdateDialogParent()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'info',
    title: 'アップデートの準備ができました',
    message: 'ダウンロードが完了しました。今すぐ再起動してインストールしますか？',
    buttons: ['今すぐ再起動', '後で'],
    cancelId: 1,
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })
})

// 6. アップデート確認（設定画面「このアプリについて」タブのボタンから呼び出し）
ipcMain.handle('check-for-update', async () => {
  if (!app.isPackaged) {
    dialog.showMessageBox(getUpdateDialogParent() as BrowserWindow, {
      type: 'info',
      title: 'アップデート確認',
      message: '開発モードのためアップデート確認はスキップされました。',
    })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    dialog.showMessageBox(getUpdateDialogParent() as BrowserWindow, {
      type: 'error',
      title: 'アップデートエラー',
      message: 'アップデートの確認中にエラーが発生しました。',
      detail: String(err),
    })
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