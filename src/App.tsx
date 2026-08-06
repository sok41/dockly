// 修正後（1〜2行目）
import { useState, useEffect } from 'react'
import { Search, Globe, AppWindow, Plus, Trash2, Key } from 'lucide-react'

// Electron IPCの読み込み (nodeIntegration: true)
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

interface ShortcutItem {
  id: string
  name: string
  description: string
  target: string
  type: 'url' | 'app'
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

  // 候補数に応じてウィンドウサイズを変更（見た目をすっきりさせるため）
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

  // ↓キー または Tabキー で下に移動
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredShortcuts.length)
    } 
    // ↑キー または Shift+Tabキー で上に移動
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredShortcuts.length) % filteredShortcuts.length)
    } 
    // Enterキー で確定実行
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

// --- 設定画面 ---
function SettingsUI() {
  const [hotkey, setHotkey] = useState('Alt+Space')
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([])

  // 新規登録フォーム用のState
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [type, setType] = useState<'url' | 'app'>('url')

  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-store-data').then((data: { hotkey?: string; shortcuts?: ShortcutItem[] }) => {
        setHotkey(data.hotkey || 'Alt+Space')
        setShortcuts(data.shortcuts || [])
      })
    }
  }, [])

  // ホットキーの変更保存
  const handleSaveHotkey = () => {
    if (ipcRenderer) {
      ipcRenderer.invoke('save-hotkey', hotkey)
      alert('起動キーを変更しました！')
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

  return (
    <div style={{
padding: '24px',
      color: '#abb2bf',
      backgroundColor: '#1e222a',
      maxHeight: '100vh', // 高さを画面内に収める
      overflowY: 'auto',  // はみ出た場合に縦スクロールバーを表示
      boxSizing: 'border-box',
      fontFamily: 'sans-serif'
    }}>
      <h2 style={{ color: '#fff', marginTop: 0, borderBottom: '1px solid #3e4451', paddingBottom: '10px' }}>
        ランチャー設定
      </h2>

      {/* 1. 起動キー（ホットキー）設定 */}
      <section style={{ marginBottom: '30px', backgroundColor: '#21252b', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ color: '#61afef', marginTop: 0, display: 'flex', alignItems: 'center' }}>
          <Key size={18} style={{ marginRight: '8px' }} /> 起動キー設定
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            placeholder="例: Alt+Space, Ctrl+Shift+L"
            style={{
              padding: '8px 12px',
              backgroundColor: '#1b1d23',
              border: '1px solid #3e4451',
              color: '#fff',
              borderRadius: '4px',
              width: '200px'
            }}
          />
          <button
            onClick={handleSaveHotkey}
            style={{
              padding: '8px 16px',
              backgroundColor: '#98c379',
              border: 'none',
              color: '#1e222a',
              fontWeight: 'bold',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            保存
          </button>
        </div>
      </section>

      {/* 2. ショートカット登録フォーム */}
      <section style={{ marginBottom: '30px', backgroundColor: '#21252b', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ color: '#61afef', marginTop: 0, display: 'flex', alignItems: 'center' }}>
          <Plus size={18} style={{ marginRight: '8px' }} /> ショートカット追加
        </h3>
        <form onSubmit={handleAddShortcut} style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="名前 (例: tenki)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ flex: 1, padding: '8px', backgroundColor: '#1b1d23', border: '1px solid #3e4451', color: '#fff', borderRadius: '4px' }}
            />
            <input
              type="text"
              placeholder="説明 (例: ヤフー天気)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ flex: 1, padding: '8px', backgroundColor: '#1b1d23', border: '1px solid #3e4451', color: '#fff', borderRadius: '4px' }}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'url' | 'app')}
              style={{ padding: '8px', backgroundColor: '#1b1d23', border: '1px solid #3e4451', color: '#fff', borderRadius: '4px' }}
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
              style={{ flex: 1, padding: '8px', backgroundColor: '#1b1d23', border: '1px solid #3e4451', color: '#fff', borderRadius: '4px' }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 20px',
                backgroundColor: '#61afef',
                border: 'none',
                color: '#fff',
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

      {/* 3. 登録済み一覧 */}
      <section>
        <h3 style={{ color: '#fff' }}>登録済みショートカット ({shortcuts.length})</h3>
        <div style={{ display: 'grid', gap: '8px' }}>
          {shortcuts.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#21252b',
                padding: '10px 15px',
                borderRadius: '6px',
                border: '1px solid #2d333f'
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ color: '#98c379', fontWeight: 'bold', marginRight: '10px' }}>[{item.name}]</span>
                <span style={{ color: '#fff', marginRight: '10px' }}>{item.description}</span>
                <span style={{ color: '#5c6370', fontSize: '12px' }}>({item.target})</span>
              </div>
              <button
                onClick={() => handleDeleteShortcut(item.id)}
                style={{ background: 'none', border: 'none', color: '#e06c75', cursor: 'pointer' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
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