import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 翻訳テキストの定義
const resources = {
  ja: {
    translation: {
      appName: "SimpleLauncher",
      aboutTitle: "このアプリについて",
      version: "バージョン",
      hotkeySetting: "起動キー設定",
      addShortcut: "ショートカット追加",
    }
  },
  en: {
    translation: {
      appName: "SimpleLauncher",
      aboutTitle: "About This App",
      version: "Version",
      hotkeySetting: "Hotkey Settings",
      addShortcut: "Add Shortcut",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // 初期言語（'en' にすればデフォルト英語になります）
    fallbackLng: 'en', // 該当する翻訳がない場合のフォールバック言語
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;