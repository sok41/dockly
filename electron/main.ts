import { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, shell, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// アプリアイコン（ウィンドウのタイトルバー/タスクバー、トレイで共通利用）
const APP_ICON_PATH = path.join(__dirname, '../public/icon.png')

type Language = 'ja' | 'en'

// メインプロセス側（トレイメニュー・ネイティブダイアログ）の文言。
// レンダラー側（設定画面）の文言は src/i18n.ts で別途管理している。
const LOCALES: Record<Language, {
  trayShow: string
  traySettings: string
  trayQuit: string
  settingsWindowTitle: string
  updateAvailableTitle: string
  updateAvailableMessage: string
  updateAvailableDetail: (version: string) => string
  installButton: string
  cancelButton: string
  updateNotAvailableTitle: string
  updateNotAvailableMessage: string
  updateErrorTitle: string
  updateErrorMessage: string
  updateDownloadedTitle: string
  updateDownloadedMessage: string
  restartNowButton: string
  laterButton: string
  devModeSkipMessage: string
}> = {
  ja: {
    trayShow: '表示',
    traySettings: '設定',
    trayQuit: '終了',
    settingsWindowTitle: '設定',
    updateAvailableTitle: 'アップデートがあります',
    updateAvailableMessage: 'アップデートがありました。インストールしますか？',
    updateAvailableDetail: (version) => `新しいバージョン (v${version}) が利用可能です。`,
    installButton: 'インストール',
    cancelButton: 'キャンセル',
    updateNotAvailableTitle: 'アップデート確認',
    updateNotAvailableMessage: '現在お使いのバージョンは最新です。',
    updateErrorTitle: 'アップデートエラー',
    updateErrorMessage: 'アップデートの確認中にエラーが発生しました。',
    updateDownloadedTitle: 'アップデートの準備ができました',
    updateDownloadedMessage: 'ダウンロードが完了しました。今すぐ再起動してインストールしますか？',
    restartNowButton: '今すぐ再起動',
    laterButton: '後で',
    devModeSkipMessage: '開発モードのためアップデート確認はスキップされました。',
  },
  en: {
    trayShow: 'Show',
    traySettings: 'Settings',
    trayQuit: 'Quit',
    settingsWindowTitle: 'Settings',
    updateAvailableTitle: 'Update Available',
    updateAvailableMessage: 'An update is available. Install it now?',
    updateAvailableDetail: (version) => `A new version (v${version}) is available.`,
    installButton: 'Install',
    cancelButton: 'Cancel',
    updateNotAvailableTitle: 'Check for Updates',
    updateNotAvailableMessage: 'You are using the latest version.',
    updateErrorTitle: 'Update Error',
    updateErrorMessage: 'An error occurred while checking for updates.',
    updateDownloadedTitle: 'Update Ready',
    updateDownloadedMessage: 'The download is complete. Restart now to install?',
    restartNowButton: 'Restart Now',
    laterButton: 'Later',
    devModeSkipMessage: 'Update check skipped in development mode.',
  },
}

// データ保存用ストアの初期化
// ※ language はここでは静的デフォルトにせず、app.whenReady() 内でOSのロケールから動的に決定する
interface ShortcutData {
  id: string
  name: string
  description: string
  target: string
  type: string
}

interface StoreSchema {
  hotkey: string
  shortcuts: ShortcutData[]
  language: Language
  autoLaunchInitialized: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    // Ctrl+Alt+Space は他アプリ（各種ランチャー/オーバーレイ系）が好んで使う組み合わせで
    // 競合しやすいため、文字キーを使った Ctrl+Alt+L をデフォルトにする
    hotkey: 'Ctrl+Alt+L',
    shortcuts: [
      { id: '1', name: 'Google', description: 'search engine', target: 'https://www.google.com/', type: 'url' }
    ]
  } as StoreSchema // language はここでは静的デフォルトにせず、app.whenReady() 内でOSのロケールから動的に決定する
})

function getLanguage(): Language {
  return store.get('language') === 'ja' ? 'ja' : 'en'
}

function getLocale() {
  return LOCALES[getLanguage()]
}

// --- スタートアップ（Windowsログイン時の自動起動）登録 ---
// 開発時（npm run dev）にOSのスタートアップへ登録してしまわないよう、パッケージ版でのみ実際にAPIを呼び出す
function getAutoLaunchEnabled(): boolean {
  if (!app.isPackaged) return false
  return app.getLoginItemSettings().openAtLogin
}

function setAutoLaunchEnabled(enabled: boolean): boolean {
  if (!app.isPackaged) return false
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
  return app.getLoginItemSettings().openAtLogin
}

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ランチャーウィンドウを表示する共通処理。
// mainWindow は起動時に一度作られたまま隠す/表示するだけで中身は再読み込みされないため、
// 表示するたびに 'window-shown' を送り、レンダラー側で最新のショートカット一覧を取り直させる
function showMainWindow() {
  mainWindow?.show()
  mainWindow?.focus()
  mainWindow?.webContents.send('window-shown')
}

// グローバルショートカットの登録関数
// 戻り値: 登録に成功したか（他アプリと競合している場合は false になる）
function registerGlobalShortcut(shortcutKey: string): boolean {
  globalShortcut.unregisterAll()
  try {
    const success = globalShortcut.register(shortcutKey, () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide()
      } else {
        showMainWindow()
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
    show: false, // アプリ起動時に自動で表示されないようにする（ホットキー/トレイから明示的に開くまで非表示のまま）
    hasShadow: false,
    skipTaskbar: true,
    icon: APP_ICON_PATH,
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
    title: getLocale().settingsWindowTitle,
    icon: APP_ICON_PATH,
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

// トレイのコンテキストメニュー・ツールチップを現在の言語で作り直す
// （初回作成時・言語切り替え時の両方から呼ばれる）
function updateTrayMenu() {
  if (!tray) return
  const locale = getLocale()

  const contextMenu = Menu.buildFromTemplate([
    { label: locale.trayShow, click: () => { showMainWindow() } },
    { label: locale.traySettings, click: () => { createSettingsWindow() } },
    { type: 'separator' },
    { label: locale.trayQuit, click: () => { app.quit() } },
  ])

  tray.setToolTip('Dockly')
  tray.setContextMenu(contextMenu)
}

function createTray() {
// 1. アイコン画像の読み込み（プロジェクト直下の public/icon.png）
  let icon = nativeImage.createFromPath(APP_ICON_PATH)

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
  tray.on('click', () => { showMainWindow() })
  updateTrayMenu()
}

// --- IPC 通信イベントハンドラー ---
// 1. 保存データの取得
ipcMain.handle('get-store-data', () => {
  return {
    hotkey: store.get('hotkey'),
    shortcuts: store.get('shortcuts'),
    language: getLanguage(),
    autoLaunch: getAutoLaunchEnabled(),
  }
})

// 2. ショートカット一覧の保存
ipcMain.handle('save-shortcuts', (_, shortcuts) => {
  store.set('shortcuts', shortcuts)
  // ランチャーウィンドウが既に開いている場合に備え、即座に最新データを反映させる
  mainWindow?.webContents.send('shortcuts-updated', shortcuts)
  return true
})

// 3. 起動ホットキーの変更・保存
// 戻り値: 実際にOS側への登録まで成功したか（false の場合は他アプリと競合している）
ipcMain.handle('save-hotkey', (_, hotkey: string) => {
  const success = registerGlobalShortcut(hotkey)
  store.set('hotkey', hotkey) // 競合していても希望のキーとして保存はしておく（後で他アプリが閉じれば有効になる）
  return success
})

// 3.5 表示言語の変更・保存（トレイメニュー・ネイティブダイアログにも反映）
ipcMain.handle('save-language', (_, language: Language) => {
  store.set('language', language === 'ja' ? 'ja' : 'en')
  updateTrayMenu()
  return true
})

// 3.6 スタートアップ（Windowsログイン時の自動起動）設定の変更・保存
ipcMain.handle('set-auto-launch', (_, enabled: boolean) => {
  return setAutoLaunchEnabled(enabled)
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
  const locale = getLocale()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'info',
    title: locale.updateAvailableTitle,
    message: locale.updateAvailableMessage,
    detail: locale.updateAvailableDetail(info.version),
    buttons: [locale.installButton, locale.cancelButton],
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
  const locale = getLocale()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'info',
    title: locale.updateNotAvailableTitle,
    message: locale.updateNotAvailableMessage,
  })
})

autoUpdater.on('error', (err) => {
  const parent = getUpdateDialogParent()
  const locale = getLocale()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'error',
    title: locale.updateErrorTitle,
    message: locale.updateErrorMessage,
    detail: String(err),
  })
})

autoUpdater.on('update-downloaded', () => {
  const parent = getUpdateDialogParent()
  const locale = getLocale()
  dialog.showMessageBox(parent as BrowserWindow, {
    type: 'info',
    title: locale.updateDownloadedTitle,
    message: locale.updateDownloadedMessage,
    buttons: [locale.restartNowButton, locale.laterButton],
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
  const locale = getLocale()
  if (!app.isPackaged) {
    dialog.showMessageBox(getUpdateDialogParent() as BrowserWindow, {
      type: 'info',
      title: locale.updateNotAvailableTitle,
      message: locale.devModeSkipMessage,
    })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    dialog.showMessageBox(getUpdateDialogParent() as BrowserWindow, {
      type: 'error',
      title: locale.updateErrorTitle,
      message: locale.updateErrorMessage,
      detail: String(err),
    })
  }
})

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)

  // 初回起動時のみ、OSのロケールから表示言語を自動判定する
  // （一度でも保存された言語設定があれば、それを常に優先する）
  if (!store.has('language')) {
    const osLocale = app.getLocale().toLowerCase()
    store.set('language', osLocale.startsWith('ja') ? 'ja' : 'en')
  }

  // 初回起動時のみ、Windowsのスタートアップに自動登録する
  // （一度でも設定を保存していれば、以降はユーザーの選択（設定画面のトグル）を尊重する）
  if (app.isPackaged && !store.has('autoLaunchInitialized')) {
    setAutoLaunchEnabled(true)
    store.set('autoLaunchInitialized', true)
  }

  createMainWindow()
  createTray()

  const currentHotkey = store.get('hotkey') as string
  registerGlobalShortcut(currentHotkey)
})

app.on('window-all-closed', (e: Electron.Event) => {
  e.preventDefault()
})
app.on('will-quit', () => { globalShortcut.unregisterAll() })
