export interface ShortcutInput {
  title: string;
  description: string;
  url: string;
}

// CSV文字列をショートカット配列に変換
export const parseShortcutsCSV = (csvText: string): ShortcutInput[] => {
  const lines = csvText.split(/\r?\n/);
  const result: ShortcutInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ヘッダー行（名前,説明,URL や title,description,url など）をスキップ
    if (i === 0 && (line.includes('名前') || line.toLowerCase().includes('title'))) {
      continue;
    }

    // カンマ区切り（ダブルクォーテーション考慮の簡易正規表現）
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');

    if (parts.length >= 3) {
      const title = parts[0].replace(/^"|"$/g, '').trim();
      const description = parts[1].replace(/^"|"$/g, '').trim();
      const url = parts[2].replace(/^"|"$/g, '').trim();

      if (title && url) {
        result.push({ title, description, url });
      }
    }
  }

  return result;
};

// ショートカット配列をCSV文字列に変換してダウンロード
export const exportShortcutsToCSV = (shortcuts: ShortcutInput[], filename = 'shortcuts.csv') => {
  const header = '名前,説明,URL\n';
  const rows = shortcuts
    .map((s) => `"${s.title.replace(/"/g, '""')}","${s.description.replace(/"/g, '""')}","${s.url.replace(/"/g, '""')}"`)
    .join('\n');

  // UTF-8 BOM付き（Excel等で文字化けしない対策）
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, header + rows], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};