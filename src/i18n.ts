import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// UI文言の翻訳リソース（日本語 / 英語）
const resources = {
  ja: {
    translation: {
      appName: 'Dockly',
      searchPlaceholder: '検索...',

      tabHotkey: '起動キー設定',
      tabShortcuts: 'ショートカット管理',
      tabAbout: 'このアプリについて',

      language: '言語',

      hotkeySectionTitle: 'ランチャー起動ショートカット',
      hotkeyRecordingPlaceholder: 'キーを押してください... (Escでキャンセル)',
      hotkeyRecordingNeedsModifier: '修飾キー（Ctrl/Alt/Shiftなど）と一緒に押してください',
      hotkeyHelperText: '上のボタンをクリックしてから、割り当てたいキーの組み合わせ（修飾キー+キー）を実際に押してください。',
      hotkeySavedSuccess: '起動キーを変更しました！',
      hotkeySavedConflict: '保存はしましたが、このキーの組み合わせは他のアプリと競合しているため、今回は登録できませんでした。別のキーをお試しください。',
      save: '保存',

      startupSectionTitle: 'スタートアップ設定',
      autoLaunchLabel: 'Windows起動時に自動で起動する',

      csvSectionTitle: '一括データ操作 (CSV)',
      csvSectionDesc: '「名前, 説明, URL」の構成でCSVから登録・書き出しが可能です。',
      csvHeader: '名前,説明,URL',
      csvImport: 'CSVインポート',
      csvExport: 'CSVエクスポート',
      csvImportSuccess: '{{count}} 件のショートカットをインポートしました！',
      csvImportInvalid: '有効なデータが見つかりませんでした。CSVの形式（名前,説明,URL）を確認してください。',
      csvExportEmpty: 'エクスポートするショートカットがありません。',

      addShortcutTitle: 'ショートカット手動追加',
      editShortcutTitle: 'ショートカット編集',
      namePlaceholder: '名前 (例: Google)',
      descPlaceholder: '説明 (例: search engine)',
      targetPlaceholder: 'URL または ファイルパス (例: https://www.google.com/)',
      typeUrl: 'Web (URL)',
      typeApp: 'アプリ (.exe)',
      add: '追加',
      update: '更新',
      edit: '編集',
      delete: '削除',
      cancelEdit: 'キャンセル',
      registeredShortcuts: '登録済みショートカット',

      aboutDescription: 'シンプルで使いやすい軽量デスクトップランチャーアプリです。',
      author: '制作者',
      license: 'ライセンス',
      checkUpdate: 'アップデートを確認',
      checkingUpdate: '確認中...',
    }
  },
  en: {
    translation: {
      appName: 'Dockly',
      searchPlaceholder: 'Type to search...',

      tabHotkey: 'Hotkey',
      tabShortcuts: 'Shortcuts',
      tabAbout: 'About',

      language: 'Language',

      hotkeySectionTitle: 'Launcher Hotkey',
      hotkeyRecordingPlaceholder: 'Press a key... (Esc to cancel)',
      hotkeyRecordingNeedsModifier: 'Please include a modifier key (Ctrl/Alt/Shift, etc.)',
      hotkeyHelperText: 'Click the button above, then press the key combination (modifier + key) you want to assign.',
      hotkeySavedSuccess: 'Hotkey updated!',
      hotkeySavedConflict: "Saved, but this key combination is already used by another app and couldn't be registered. Please try a different combination.",
      save: 'Save',

      startupSectionTitle: 'Startup',
      autoLaunchLabel: 'Launch automatically when Windows starts',

      csvSectionTitle: 'Bulk Actions (CSV)',
      csvSectionDesc: 'Import or export shortcuts as CSV with the columns "Name, Description, URL".',
      csvHeader: 'Name,Description,URL',
      csvImport: 'Import CSV',
      csvExport: 'Export CSV',
      csvImportSuccess: '{{count}} shortcut(s) imported!',
      csvImportInvalid: 'No valid data found. Please check the CSV format (Name, Description, URL).',
      csvExportEmpty: 'There are no shortcuts to export.',

      addShortcutTitle: 'Add Shortcut',
      editShortcutTitle: 'Edit Shortcut',
      namePlaceholder: 'Name (e.g. Google)',
      descPlaceholder: 'Description (e.g. search engine)',
      targetPlaceholder: 'URL or file path (e.g. https://www.google.com/)',
      typeUrl: 'Web (URL)',
      typeApp: 'App (.exe)',
      add: 'Add',
      update: 'Update',
      edit: 'Edit',
      delete: 'Delete',
      cancelEdit: 'Cancel',
      registeredShortcuts: 'Registered Shortcuts',

      aboutDescription: 'A simple, lightweight desktop launcher app.',
      author: 'Author',
      license: 'License',
      checkUpdate: 'Check for Updates',
      checkingUpdate: 'Checking...',
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // 初期値。実際の言語はmainプロセス側の保存値をget-store-data経由で取得後に切り替える
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
