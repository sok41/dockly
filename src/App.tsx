import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Globe, AppWindow, Plus, Trash2, Key, Info, ExternalLink, Upload, Download, RefreshCw } from 'lucide-react'
import pkg from '../package.json'

// Electron IPCの読み込み (nodeIntegration: true)
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface ShortcutItem {
  id: string
  name: string
  description: string
  target: string
  type: 'url' | 'app'
}

interface AboutInfo {
  appName: string
  version: string
  author: string
  githubUrl: string
  description: string
  license?: string
}

type Language = 'ja' | 'en'

// KeyboardEvent.code を Electron の accelerator キー名に変換するためのマップ
const CODE_TO_ACCELERATOR_KEY: Record<string, string> = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Return',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
}

// 押されたキーの物理コードを Electron の accelerator 文字列用のキー名に変換する
// （対応不可のキーは null を返す）
function codeToAcceleratorKey(code: string): string | null {
  if (CODE_TO_ACCELERATOR_KEY[code]) return CODE_TO_ACCELERATOR_KEY[code]
  if (/^Key[A-Z]$/.test(code)) return code.slice(3) // KeyA -> A
  if (/^Digit[0-9]$/.test(code)) return code.slice(5) // Digit1 -> 1
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code // F1〜F24
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}` // Numpad1 -> num1
  return null
}

// --- メイン画面（ランチャー本体） ---
function LauncherUI() {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // ショートカット一覧・言語設定を取得
  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-store-data').then((data: { shortcuts?: ShortcutItem[]; hotkey?: string; language?: Language }) => {
        setShortcuts(data.shortcuts || [])
        if (data.language) i18n.changeLanguage(data.language)
      })
    }
  }, [i18n])

  // 入力キーワードに合致する候補をフィルタリング
  const filteredShortcuts = query.trim() === ''
    ? []
    : shortcuts.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description.toLowerCase().includes(query.toLowerCase())
      )

  // 候補数に応じてウィンドウサイズを変更
  useEffect(() => {
    if (ipcRenderer) {
      const baseHeight = 60
      const itemHeight = 50
      const newHeight = filteredShortcuts.length > 0
        ? baseHeight + Math.min(filteredShortcuts.length, 5) * itemHeight + 10
        : baseHeight
      ipcRenderer.invoke('resize-window', newHeight)
    }
  }, [filteredShortcuts.length])

  // アクションの実行
  const handleExecute = (item: ShortcutItem) => {
    if (ipcRenderer) {
      ipcRenderer.invoke('open-target', { target: item.target, type: item.type })
      setQuery('')
    }
  }

  // キーボード操作（上下で選択、Enterで実行）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredShortcuts.length === 0) return

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredShortcuts.length)
    }
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredShortcuts.length) % filteredShortcuts.length)
    }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredShortcuts[selectedIndex]) {
        handleExecute(filteredShortcuts[selectedIndex])
      }
    }
  }

  return (
    <div style={{
      backgroundColor: '#1e222a',
      borderRadius: '8px',
      padding: '10px 15px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      border: '1px solid #2d333f',
      overflow: 'hidden'
    }}>
      {/* 検索入力欄 */}
      <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
        <Search size={20} color="#858b97" style={{ marginRight: '12px', flexShrink: 0 }} />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e0e0e0',
            fontSize: '16px',
          }}
        />
      </div>

      {/* 候補リスト表示 */}
      {filteredShortcuts.length > 0 && (
        <div style={{ marginTop: '10px', borderTop: '1px solid #2d333f', paddingTop: '5px' }}>
          {filteredShortcuts.slice(0, 5).map((item, index) => {
            const isSelected = index === selectedIndex
            return (
              <div
                key={item.id}
                onClick={() => handleExecute(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? '#2c313a' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.1s'
                }}
              >
                {item.type === 'url' ? (
                  <Globe size={18} color="#61afef" style={{ marginRight: '10px' }} />
                ) : (
                  <AppWindow size={18} color="#98c379" style={{ marginRight: '10px' }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>{item.name}</div>
                  <div style={{ color: '#828997', fontSize: '12px' }}>{item.description}</div>
                </div>
                <div style={{ color: '#5c6370', fontSize: '11px' }}>{item.target}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- 設定画面（左サイドバー + 右コンテンツ） ---
function SettingsUI() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'hotkey' | 'shortcuts' | 'about'>('hotkey')
  const [hotkey, setHotkey] = useState('Ctrl+Alt+L')
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
  const [recordingPreview, setRecordingPreview] = useState('')
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])
  const [language, setLanguage] = useState<Language>('en')

  // ファイル選択用の参照
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 「このアプリについて」情報
  const [aboutInfo, setAboutInfo] = useState<AboutInfo>({
    appName: 'Dockly',
    version: pkg.version,
    author: "sok41",
    githubUrl: "https://github.com/sok41/dockly",
    description: '', // 未指定時は t('aboutDescription') を表示する
    license: "MIT License"
  })

  // アップデート確認中フラグ
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  // 新規登録フォーム用のState
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [type, setType] = useState<'url' | 'app'>('url')

  useEffect(() => {
    // 既存データの読み込み
    if (ipcRenderer) {
      ipcRenderer.invoke('get-store-data').then((data: { hotkey?: string; shortcuts?: ShortcutItem[]; language?: Language }) => {
        setHotkey(data.hotkey || 'Ctrl+Alt+L')
        setShortcuts(data.shortcuts || [])
        const lang: Language = data.language === 'ja' ? 'ja' : 'en'
        setLanguage(lang)
        i18n.changeLanguage(lang)
      })
    }

    // about.json の読み込み
    fetch('/about.json')
      .then(res => res.json())
      .then(data => setAboutInfo(data))
      .catch(() => {})
  }, [i18n])

  // 起動キーの記録（入力欄への直接タイプではなく、実際にキーを押して登録する方式）
  useEffect(() => {
    if (!isRecordingHotkey) {
      setRecordingPreview('')
      return
    }

    const buildModifiers = (e: KeyboardEvent) => {
      const mods: string[] = []
      if (e.ctrlKey) mods.push('Ctrl')
      if (e.altKey) mods.push('Alt')
      if (e.shiftKey) mods.push('Shift')
      if (e.metaKey) mods.push('Super')
      return mods
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return

      const modifiers = buildModifiers(e)

      // Escで記録をキャンセル（修飾キーなしで単独押下の場合のみ）
      if (e.key === 'Escape' && modifiers.length === 0) {
        setIsRecordingHotkey(false)
        return
      }

      // 修飾キー単体（Ctrl/Alt/Shift/Winキーのみ）が押されている間はプレビューだけ更新
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        setRecordingPreview(modifiers.length > 0 ? `${modifiers.join('+')}+…` : '')
        return
      }

      const keyName = codeToAcceleratorKey(e.code)

      // グローバルショートカットの誤爆防止のため、修飾キーを最低1つ必須にする
      if (!keyName || modifiers.length === 0) {
        setRecordingPreview(t('hotkeyRecordingNeedsModifier'))
        return
      }

      setHotkey([...modifiers, keyName].join('+'))
      setIsRecordingHotkey(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isRecordingHotkey, t])

  // ホットキーの変更保存
  const handleSaveHotkey = async () => {
    if (!ipcRenderer) return
    const success = await ipcRenderer.invoke('save-hotkey', hotkey)
    if (success) {
      alert(t('hotkeySavedSuccess'))
    } else {
      alert(t('hotkeySavedConflict'))
    }
  }

  // 言語の切り替え（即時反映 + メインプロセス側にも保存してトレイ/ダイアログに反映）
  const handleChangeLanguage = async (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    if (ipcRenderer) {
      await ipcRenderer.invoke('save-language', lang)
    }
  }

  // アップデートの確認（メインプロセス側でGitHub Releasesを確認し、結果はダイアログで表示）
  const handleCheckForUpdate = async () => {
    if (!ipcRenderer || checkingUpdate) return
    setCheckingUpdate(true)
    try {
      await ipcRenderer.invoke('check-for-update')
    } finally {
      setCheckingUpdate(false)
    }
  }

  // ショートカットの新規追加
  const handleAddShortcut = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !target) return

    const newItem: ShortcutItem = {
      id: Date.now().toString(),
      name,
      description,
      target,
      type
    }

    const updated = [...shortcuts, newItem]
    setShortcuts(updated)
    if (ipcRenderer) ipcRenderer.invoke('save-shortcuts', updated)

    setName('')
    setDescription('')
    setTarget('')
  }

  // ショートカットの削除
  const handleDeleteShortcut = (id: string) => {
    const updated = shortcuts.filter(s => s.id !== id)
    setShortcuts(updated)
    if (ipcRenderer) ipcRenderer.invoke('save-shortcuts', updated)
  }

  // --- CSV インポート処理 ---
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const lines = text.split(/\r?\n/)
      const importedList: ShortcutItem[] = []

      lines.forEach((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return

        // ヘッダー行のスキップ（日本語/英語どちらの見出しにも対応）
        if (index === 0 && (trimmed.includes('名前') || trimmed.toLowerCase().includes('name'))) return

        // カンマ区切り（ダブルクォーテーション対応）
        const parts = trimmed.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || trimmed.split(',')
        if (parts.length >= 3) {
          const nameVal = parts[0].replace(/^"|"$/g, '').trim()
          const descVal = parts[1].replace(/^"|"$/g, '').trim()
          const targetVal = parts[2].replace(/^"|"$/g, '').trim()

          // 種別判定（httpから始まればURL、それ以外はapp）
          const typeVal: 'url' | 'app' = targetVal.startsWith('http://') || targetVal.startsWith('https://') ? 'url' : 'app'

          if (nameVal && targetVal) {
            importedList.push({
              id: (Date.now() + index).toString(),
              name: nameVal,
              description: descVal,
              target: targetVal,
              type: typeVal
            })
          }
        }
      })

      if (importedList.length > 0) {
        const updated = [...shortcuts, ...importedList]
        setShortcuts(updated)
        if (ipcRenderer) ipcRenderer.invoke('save-shortcuts', updated)
        alert(t('csvImportSuccess', { count: importedList.length }))
      } else {
        alert(t('csvImportInvalid'))
      }
    }
    reader.readAsText(file)
    e.target.value = '' // リセット
  }

  // --- CSV エクスポート処理 ---
  const handleExportCSV = () => {
    if (shortcuts.length === 0) {
      alert(t('csvExportEmpty'))
      return
    }

    const header = `${t('csvHeader')}\n`
    const rows = shortcuts
      .map(s => `"${s.name.replace(/"/g, '""')}","${s.description.replace(/"/g, '""')}","${s.target.replace(/"/g, '""')}"`)
      .join('\n')

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]) // UTF-8 BOM（文字化け防止）
    const blob = new Blob([bom, header + rows], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'shortcuts.csv'
    link.click()
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#161d1c',
      color: '#d6e0dd',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* 1. 左側サイドバー */}
      <div style={{
        width: '220px',
        backgroundColor: '#111716',
        borderRight: '1px solid #2c3634',
        padding: '20px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
        height: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          color: '#eef5f3',
          fontWeight: 'bold',
          fontSize: '16px',
          padding: '0 12px 16px 12px',
          borderBottom: '1px solid #2c3634',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          Dockly
        </div>

        <select
          value={language}
          onChange={(e) => handleChangeLanguage(e.target.value as Language)}
          aria-label={t('language')}
          style={{
            marginBottom: '10px',
            padding: '6px 8px',
            backgroundColor: '#131a19',
            border: '1px solid #334140',
            color: '#d6e0dd',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>

        <button
          onClick={() => setActiveTab('hotkey')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'hotkey' ? '#1c3d38' : 'transparent',
            color: activeTab === 'hotkey' ? '#3fb3a9' : '#9aa8a5',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: activeTab === 'hotkey' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          <Key size={16} /> {t('tabHotkey')}
        </button>

        <button
          onClick={() => setActiveTab('shortcuts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'shortcuts' ? '#1c3d38' : 'transparent',
            color: activeTab === 'shortcuts' ? '#3fb3a9' : '#9aa8a5',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: activeTab === 'shortcuts' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          <Plus size={16} /> {t('tabShortcuts')}
        </button>

        <button
          onClick={() => setActiveTab('about')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'about' ? '#1c3d38' : 'transparent',
            color: activeTab === 'about' ? '#3fb3a9' : '#9aa8a5',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: activeTab === 'about' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          <Info size={16} /> {t('tabAbout')}
        </button>
      </div>

      {/* 2. 右側メインコンテンツ */}
      <div style={{
        flex: 1,
        height: '100%',
        padding: '28px',
        backgroundColor: '#161d1c',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>
        {/* タブ1: 起動キー設定 */}
        {activeTab === 'hotkey' && (
          <div>
            <h2 style={{ color: '#eef5f3', marginTop: 0, marginBottom: '20px' }}>{t('tabHotkey')}</h2>
            <section style={{ backgroundColor: '#1e2726', padding: '20px', borderRadius: '8px', border: '1px solid #2c3634' }}>
              <h3 style={{ color: '#3fb3a9', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} /> {t('hotkeySectionTitle')}
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsRecordingHotkey(true)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#131a19',
                    border: isRecordingHotkey ? '1px solid #3fb3a9' : '1px solid #334140',
                    color: isRecordingHotkey ? '#3fb3a9' : '#eef5f3',
                    borderRadius: '4px',
                    width: '260px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {isRecordingHotkey ? (recordingPreview || t('hotkeyRecordingPlaceholder')) : hotkey}
                </button>
                <button
                  onClick={handleSaveHotkey}
                  disabled={isRecordingHotkey}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isRecordingHotkey ? '#1e2726' : '#3fb3a9',
                    border: 'none',
                    color: isRecordingHotkey ? '#9aa8a5' : '#0d1d1a',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    cursor: isRecordingHotkey ? 'default' : 'pointer'
                  }}
                >
                  {t('save')}
                </button>
              </div>
              <p style={{ color: '#71807d', fontSize: '12px', marginTop: '10px', marginBottom: 0 }}>
                {t('hotkeyHelperText')}
              </p>
            </section>
          </div>
        )}

        {/* タブ2: ショートカット管理 */}
        {activeTab === 'shortcuts' && (
          <div>
            <h2 style={{ color: '#eef5f3', marginTop: 0, marginBottom: '20px' }}>{t('tabShortcuts')}</h2>

            {/* CSV 一括読み込み / 書き出し */}
            <section style={{ marginBottom: '20px', backgroundColor: '#1e2726', padding: '16px 20px', borderRadius: '8px', border: '1px solid #2c3634', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: '#eef5f3', margin: 0, fontSize: '15px' }}>{t('csvSectionTitle')}</h3>
                <p style={{ color: '#9aa8a5', margin: '4px 0 0 0', fontSize: '12px' }}>{t('csvSectionDesc')}</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleImportCSV}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title={t('csvImport')}
                  aria-label={t('csvImport')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    backgroundColor: '#1e2726',
                    border: '1px solid #334140',
                    color: '#3fb3a9',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={16} />
                </button>
                <button
                  onClick={handleExportCSV}
                  title={t('csvExport')}
                  aria-label={t('csvExport')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    backgroundColor: '#1e2726',
                    border: '1px solid #334140',
                    color: '#d6e0dd',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={16} />
                </button>
              </div>
            </section>

            {/* 個別追加フォーム */}
            <section style={{ marginBottom: '24px', backgroundColor: '#1e2726', padding: '20px', borderRadius: '8px', border: '1px solid #2c3634' }}>
              <h3 style={{ color: '#3fb3a9', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} /> {t('addShortcutTitle')}
              </h3>
              <form onSubmit={handleAddShortcut} style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder={t('namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ flex: 1, padding: '8px', backgroundColor: '#131a19', border: '1px solid #334140', color: '#eef5f3', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder={t('descPlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ flex: 1, padding: '8px', backgroundColor: '#131a19', border: '1px solid #334140', color: '#eef5f3', borderRadius: '4px' }}
                  />
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'url' | 'app')}
                    style={{ padding: '8px', backgroundColor: '#131a19', border: '1px solid #334140', color: '#eef5f3', borderRadius: '4px' }}
                  >
                    <option value="url">{t('typeUrl')}</option>
                    <option value="app">{t('typeApp')}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder={t('targetPlaceholder')}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    required
                    style={{ flex: 1, padding: '8px', backgroundColor: '#131a19', border: '1px solid #334140', color: '#eef5f3', borderRadius: '4px' }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      backgroundColor: '#3fb3a9',
                      border: 'none',
                      color: '#eef5f3',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {t('add')}
                  </button>
                </div>
              </form>
            </section>

            {/* 一覧表示 */}
            <section>
              <h3 style={{ color: '#eef5f3', fontSize: '16px' }}>{t('registeredShortcuts')} ({shortcuts.length})</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {shortcuts.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#1e2726',
                      padding: '10px 15px',
                      borderRadius: '6px',
                      border: '1px solid #2c3634'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#3fb3a9', fontWeight: 'bold', marginRight: '10px' }}>[{item.name}]</span>
                      <span style={{ color: '#eef5f3', marginRight: '10px' }}>{item.description}</span>
                      <span style={{ color: '#71807d', fontSize: '12px' }}>({item.target})</span>
                    </div>
                    <button
                      onClick={() => handleDeleteShortcut(item.id)}
                      style={{ background: 'none', border: 'none', color: '#d16b62', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* タブ3: このアプリについて */}
        {activeTab === 'about' && (
          <div>
            <h2 style={{ color: '#eef5f3', marginTop: 0, marginBottom: '20px' }}>{t('tabAbout')}</h2>
            <div style={{
              backgroundColor: '#1e2726',
              padding: '30px',
              borderRadius: '8px',
              border: '1px solid #2c3634',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#eef5f3', fontSize: '22px', margin: '0 0 6px 0' }}>{aboutInfo.appName}</h3>
              <span style={{
                display: 'inline-block',
                backgroundColor: '#1c3d38',
                color: '#3fb3a9',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginBottom: '16px'
              }}>
                v{aboutInfo.version}
              </span>
              <p style={{ color: '#d6e0dd', fontSize: '14px', maxWidth: '420px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
                {aboutInfo.description || t('aboutDescription')}
              </p>

              <div style={{
                borderTop: '1px solid #2c3634',
                paddingTop: '20px',
                maxWidth: '420px',
                margin: '0 auto',
                textAlign: 'left',
                fontSize: '14px'
              }}>
                <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #2c3634' }}>
                  <span style={{ width: '100px', color: '#71807d' }}>{t('author')}</span>
                  <span style={{ color: '#eef5f3' }}>{aboutInfo.author}</span>
                </div>
                <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #2c3634' }}>
                  <span style={{ width: '100px', color: '#71807d' }}>GitHub</span>
                  <a
                    href={aboutInfo.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      // Electron内ではなく、OS既定のブラウザで開く
                      e.preventDefault()
                      if (ipcRenderer) {
                        ipcRenderer.invoke('open-external', aboutInfo.githubUrl)
                      } else {
                        window.open(aboutInfo.githubUrl, '_blank')
                      }
                    }}
                    style={{ color: '#3fb3a9', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    {aboutInfo.githubUrl} <ExternalLink size={12} />
                  </a>
                </div>
                {aboutInfo.license && (
                  <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #2c3634' }}>
                    <span style={{ width: '100px', color: '#71807d' }}>{t('license')}</span>
                    <span style={{ color: '#eef5f3' }}>{aboutInfo.license}</span>
                  </div>
                )}

                <div style={{ padding: '16px 0 0 0' }}>
                  <button
                    onClick={handleCheckForUpdate}
                    disabled={checkingUpdate}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: checkingUpdate ? '#1e2726' : '#3fb3a9',
                      border: 'none',
                      color: checkingUpdate ? '#9aa8a5' : '#eef5f3',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: checkingUpdate ? 'default' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <RefreshCw size={14} className={checkingUpdate ? 'spin' : ''} />
                    {checkingUpdate ? t('checkingUpdate') : t('checkUpdate')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// --- メインエントリーコンポーネント ---
export default function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route === '#/settings' || route === '#settings') {
    return <SettingsUI />
  }

  return <LauncherUI />
}
