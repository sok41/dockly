import { useState, useEffect, useRef } from 'react'
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
  const [query, setQuery] = useState('')
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // ショートカット一覧を取得
  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-store-data').then((data: { shortcuts?: ShortcutItem[]; hotkey?: string }) => {
        setShortcuts(data.shortcuts || [])
      })
    }
  }, [])

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
          placeholder="Type to search..."
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
  const [activeTab, setActiveTab] = useState<'hotkey' | 'shortcuts' | 'about'>('hotkey')
  const [hotkey, setHotkey] = useState('Ctrl+Alt+L')
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false)
  const [recordingPreview, setRecordingPreview] = useState('')
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])

  // ファイル選択用の参照
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 「このアプリについて」情報
  const [aboutInfo, setAboutInfo] = useState<AboutInfo>({
    appName: pkg.name,
    version: pkg.version,
    author: "sok41",
    githubUrl: "https://github.com/sok41/simple-launcher",
    description: "シンプルで使いやすい軽量デスクトップランチャーアプリです。",
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
      ipcRenderer.invoke('get-store-data').then((data: { hotkey?: string; shortcuts?: ShortcutItem[] }) => {
        setHotkey(data.hotkey || 'Ctrl+Alt+L')
        setShortcuts(data.shortcuts || [])
      })
    }

    // about.json の読み込み
    fetch('/about.json')
      .then(res => res.json())
      .then(data => setAboutInfo(data))
      .catch(() => {})
  }, [])

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
        setRecordingPreview('修飾キー（Ctrl/Alt/Shiftなど）と一緒に押してください')
        return
      }

      setHotkey([...modifiers, keyName].join('+'))
      setIsRecordingHotkey(false)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isRecordingHotkey])

  // ホットキーの変更保存
  const handleSaveHotkey = async () => {
    if (!ipcRenderer) return
    const success = await ipcRenderer.invoke('save-hotkey', hotkey)
    if (success) {
      alert('起動キーを変更しました！')
    } else {
      alert('保存はしましたが、このキーの組み合わせは他のアプリと競合しているため、今回は登録できませんでした。別のキーをお試しください。')
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

        // ヘッダー行のスキップ
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
        alert(`${importedList.length} 件のショートカットをインポートしました！`)
      } else {
        alert('有効なデータが見つかりませんでした。CSVの形式（名前,説明,URL）を確認してください。')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // リセット
  }

  // --- CSV エクスポート処理 ---
  const handleExportCSV = () => {
    if (shortcuts.length === 0) {
      alert('エクスポートするショートカットがありません。')
      return
    }

    const header = '名前,説明,URL\n'
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
      backgroundColor: '#262624',
      color: '#d4d2ce',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* 1. 左側サイドバー */}
      <div style={{
        width: '220px',
        backgroundColor: '#1e1e1c',
        borderRight: '1px solid #3d3d39',
        padding: '20px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flexShrink: 0,
        height: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          color: '#f2f0ec',
          fontWeight: 'bold',
          fontSize: '16px',
          padding: '0 12px 16px 12px',
          borderBottom: '1px solid #3d3d39',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          SimpleLauncher
        </div>

        <button
          onClick={() => setActiveTab('hotkey')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: activeTab === 'hotkey' ? '#3a332c' : 'transparent',
            color: activeTab === 'hotkey' ? '#cc785c' : '#a8a5a0',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: activeTab === 'hotkey' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          <Key size={16} /> 起動キー設定
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
            backgroundColor: activeTab === 'shortcuts' ? '#3a332c' : 'transparent',
            color: activeTab === 'shortcuts' ? '#cc785c' : '#a8a5a0',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: activeTab === 'shortcuts' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          <Plus size={16} /> ショートカット管理
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
            backgroundColor: activeTab === 'about' ? '#3a332c' : 'transparent',
            color: activeTab === 'about' ? '#cc785c' : '#a8a5a0',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: activeTab === 'about' ? 'bold' : 'normal',
            fontSize: '14px'
          }}
        >
          <Info size={16} /> このアプリについて
        </button>
      </div>

      {/* 2. 右側メインコンテンツ */}
      <div style={{
        flex: 1,
        height: '100%',
        padding: '28px',
        backgroundColor: '#262624',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>
        {/* タブ1: 起動キー設定 */}
        {activeTab === 'hotkey' && (
          <div>
            <h2 style={{ color: '#f2f0ec', marginTop: 0, marginBottom: '20px' }}>起動キー設定</h2>
            <section style={{ backgroundColor: '#30302e', padding: '20px', borderRadius: '8px', border: '1px solid #3d3d39' }}>
              <h3 style={{ color: '#cc785c', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} /> ランチャー起動ショートカット
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsRecordingHotkey(true)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#1a1a18',
                    border: isRecordingHotkey ? '1px solid #cc785c' : '1px solid #47463f',
                    color: isRecordingHotkey ? '#cc785c' : '#f2f0ec',
                    borderRadius: '4px',
                    width: '260px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {isRecordingHotkey ? (recordingPreview || 'キーを押してください... (Escでキャンセル)') : hotkey}
                </button>
                <button
                  onClick={handleSaveHotkey}
                  disabled={isRecordingHotkey}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isRecordingHotkey ? '#38372f' : '#cc785c',
                    border: 'none',
                    color: isRecordingHotkey ? '#a8a5a0' : '#1f1e1d',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    cursor: isRecordingHotkey ? 'default' : 'pointer'
                  }}
                >
                  保存
                </button>
              </div>
              <p style={{ color: '#7a766f', fontSize: '12px', marginTop: '10px', marginBottom: 0 }}>
                上のボタンをクリックしてから、割り当てたいキーの組み合わせ（修飾キー+キー）を実際に押してください。
              </p>
            </section>
          </div>
        )}

        {/* タブ2: ショートカット管理 */}
        {activeTab === 'shortcuts' && (
          <div>
            <h2 style={{ color: '#f2f0ec', marginTop: 0, marginBottom: '20px' }}>ショートカット管理</h2>
            
            {/* CSV 一括読み込み / 書き出し */}
            <section style={{ marginBottom: '20px', backgroundColor: '#30302e', padding: '16px 20px', borderRadius: '8px', border: '1px solid #3d3d39', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: '#f2f0ec', margin: 0, fontSize: '15px' }}>一括データ操作 (CSV)</h3>
                <p style={{ color: '#a8a5a0', margin: '4px 0 0 0', fontSize: '12px' }}>「名前, 説明, URL」の構成でCSVから登録・書き出しが可能です。</p>
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#38372f',
                    border: '1px solid #47463f',
                    color: '#cc785c',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold'
                  }}
                >
                  <Upload size={14} /> CSVインポート
                </button>
                <button
                  onClick={handleExportCSV}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#38372f',
                    border: '1px solid #47463f',
                    color: '#d4d2ce',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <Download size={14} /> CSVエクスポート
                </button>
              </div>
            </section>

            {/* 個別追加フォーム */}
            <section style={{ marginBottom: '24px', backgroundColor: '#30302e', padding: '20px', borderRadius: '8px', border: '1px solid #3d3d39' }}>
              <h3 style={{ color: '#cc785c', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} /> ショートカット手動追加
              </h3>
              <form onSubmit={handleAddShortcut} style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="名前 (例: tenki)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ flex: 1, padding: '8px', backgroundColor: '#1a1a18', border: '1px solid #47463f', color: '#f2f0ec', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="説明 (例: ヤフー天気)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ flex: 1, padding: '8px', backgroundColor: '#1a1a18', border: '1px solid #47463f', color: '#f2f0ec', borderRadius: '4px' }}
                  />
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'url' | 'app')}
                    style={{ padding: '8px', backgroundColor: '#1a1a18', border: '1px solid #47463f', color: '#f2f0ec', borderRadius: '4px' }}
                  >
                    <option value="url">Web (URL)</option>
                    <option value="app">アプリ (.exe)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="URL または ファイルパス (例: https://weather.yahoo.co.jp/weather/)"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    required
                    style={{ flex: 1, padding: '8px', backgroundColor: '#1a1a18', border: '1px solid #47463f', color: '#f2f0ec', borderRadius: '4px' }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      backgroundColor: '#cc785c',
                      border: 'none',
                      color: '#f2f0ec',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    追加
                  </button>
                </div>
              </form>
            </section>

            {/* 一覧表示 */}
            <section>
              <h3 style={{ color: '#f2f0ec', fontSize: '16px' }}>登録済みショートカット ({shortcuts.length})</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {shortcuts.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#30302e',
                      padding: '10px 15px',
                      borderRadius: '6px',
                      border: '1px solid #3d3d39'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#cc785c', fontWeight: 'bold', marginRight: '10px' }}>[{item.name}]</span>
                      <span style={{ color: '#f2f0ec', marginRight: '10px' }}>{item.description}</span>
                      <span style={{ color: '#7a766f', fontSize: '12px' }}>({item.target})</span>
                    </div>
                    <button
                      onClick={() => handleDeleteShortcut(item.id)}
                      style={{ background: 'none', border: 'none', color: '#c2645c', cursor: 'pointer' }}
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
            <h2 style={{ color: '#f2f0ec', marginTop: 0, marginBottom: '20px' }}>このアプリについて</h2>
            <div style={{
              backgroundColor: '#30302e',
              padding: '30px',
              borderRadius: '8px',
              border: '1px solid #3d3d39',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#f2f0ec', fontSize: '22px', margin: '0 0 6px 0' }}>{aboutInfo.appName}</h3>
              <span style={{
                display: 'inline-block',
                backgroundColor: '#3a332c',
                color: '#cc785c',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginBottom: '16px'
              }}>
                v{aboutInfo.version}
              </span>
              <p style={{ color: '#d4d2ce', fontSize: '14px', maxWidth: '420px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
                {aboutInfo.description}
              </p>

              <div style={{
                borderTop: '1px solid #3d3d39',
                paddingTop: '20px',
                maxWidth: '420px',
                margin: '0 auto',
                textAlign: 'left',
                fontSize: '14px'
              }}>
                <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #3d3d39' }}>
                  <span style={{ width: '100px', color: '#7a766f' }}>制作者</span>
                  <span style={{ color: '#f2f0ec' }}>{aboutInfo.author}</span>
                </div>
                <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #3d3d39' }}>
                  <span style={{ width: '100px', color: '#7a766f' }}>GitHub</span>
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
                    style={{ color: '#cc785c', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    {aboutInfo.githubUrl} <ExternalLink size={12} />
                  </a>
                </div>
                {aboutInfo.license && (
                  <div style={{ display: 'flex', padding: '8px 0', borderBottom: '1px solid #3d3d39' }}>
                    <span style={{ width: '100px', color: '#7a766f' }}>ライセンス</span>
                    <span style={{ color: '#f2f0ec' }}>{aboutInfo.license}</span>
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
                      backgroundColor: checkingUpdate ? '#38372f' : '#cc785c',
                      border: 'none',
                      color: checkingUpdate ? '#a8a5a0' : '#f2f0ec',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      cursor: checkingUpdate ? 'default' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <RefreshCw size={14} className={checkingUpdate ? 'spin' : ''} />
                    {checkingUpdate ? '確認中...' : 'アップデートを確認'}
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