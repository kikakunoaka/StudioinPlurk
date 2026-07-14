// ==========================================================
// 讀取 Google 試算表（免後端、免 API Key）
// 前提：該試算表分享設定需為「知道連結的任何人 > 檢視者」
// ==========================================================

/**
 * 讀取指定分頁中的特定範圍（A1 表示法，例如 'A1:G15'）
 * headerRow = true  → 該範圍的第一列會被當作欄位標題（回傳欄位名稱陣列）
 * headerRow = false → 不當作標題，欄位用試算表欄位字母（A、B、C…）表示
 * 回傳 { cols, rows }，rows 為「陣列的陣列」，每列依 cols 順序對應
 */
async function fetchRange(sheetName, range, headerRow) {
  const params = new URLSearchParams({
    tqx: 'out:json',
    sheet: sheetName,
    range: range,
  });
  // 明確指定 headers=0 或 1，避免 Google 試算表在未指定時自動猜測
  // 第一列是否為標題列 — 猜錯會導致資料整批消失（例如「更新日誌」每一列
  // 都是資料、沒有標題列，若被誤判為有標題，第一列就會被吃掉）。
  params.set('headers', headerRow ? '1' : '0');

  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?${params.toString()}&_ts=${Date.now()}`;

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`無法連線到 Google 試算表分頁「${sheetName}」。`);
  }
  if (!res.ok) {
    throw new Error(`找不到分頁「${sheetName}」，請確認分頁名稱是否完全相符。`);
  }

  const text = await res.text();
  const match = text.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error('試算表回應格式不正確，請確認分享設定為「知道連結的任何人 > 檢視者」。');
  }

  const json = JSON.parse(match[1]);
  if (!json.table || !json.table.cols) {
    return { cols: [], rows: [] };
  }

  const cols = json.table.cols.map((c, i) => {
    if (headerRow) return (c.label && c.label.trim()) || c.id || `col${i}`;
    return c.id || String.fromCharCode(65 + i); // 'A', 'B', 'C'…
  });

  const rows = (json.table.rows || []).map((r) =>
    cols.map((_, i) => {
      const cell = r.c && r.c[i];
      if (!cell) return '';
      return cell.f !== undefined && cell.f !== null ? cell.f : cell.v ?? '';
    })
  );

  return { cols, rows };
}

/**
 * 穩定版讀取整個分頁：完全不依賴 Google 試算表「自動猜測第一列是否為
 * 標題列」的行為（這正是先前更新日誌、體驗評價欄位偶爾抓不到的根本原因）。
 * 一律將第一列當標題文字使用（若該格空白則以欄位字母 A/B/C… 代替），
 * 其餘列視為資料列。
 *
 * 回傳：
 *   cols    — 欄位標題陣列（依序對應 A、B、C… 欄）
 *   rows    — 物件陣列，key 為 cols 裡的標題文字（跟 fetchSheet 介面相同）
 *   rawRows — 陣列的陣列，可直接用「欄位字母轉成的 0-based 索引」存取，
 *             不受標題文字影響，用於「不管標題寫什麼，就是要抓某欄」的情境
 */
async function fetchSheetSafe(sheetName, range = 'A1:Z2000') {
  const raw = await fetchRange(sheetName, range, false);
  if (!raw.rows.length) return { cols: [], rows: [], rawRows: [] };

  const headerArr = raw.rows[0].map((v, i) => {
    const t = String(v || '').trim();
    return t || String.fromCharCode(65 + i);
  });
  const dataRows = raw.rows.slice(1).filter((r) => r.some((v) => String(v).trim() !== ''));

  const rows = dataRows.map((rowArr) => {
    const obj = {};
    headerArr.forEach((h, i) => {
      obj[h] = rowArr[i] !== undefined && rowArr[i] !== null ? rowArr[i] : '';
    });
    return obj;
  });

  return { cols: headerArr, rows, rawRows: dataRows };
}

/** 將欄位字母（A、B、C…、AA…）轉成 0-based 索引，例如 'H' → 7 */
function columnLetterToIndex(letter) {
  const s = String(letter || '').trim().toUpperCase();
  let idx = 0;
  for (let i = 0; i < s.length; i++) {
    idx = idx * 26 + (s.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/**
 * 決定「體驗評價」實際對應到哪個欄位標題。
 * 優先直接抓 CONFIG.ratingColumnLetter 指定的欄位位置（例如固定抓 H 欄，
 * 不管該欄標題文字寫什麼），只有在那個位置完全沒有資料時，才退而用
 * 標題文字比對 CONFIG.ratingColumnName。
 */
function pickRatingColumn(cols, rows) {
  const letterIdx = columnLetterToIndex(CONFIG.ratingColumnLetter);
  const letterCol = cols[letterIdx] || '';
  const letterHasData = letterCol && rows.some((r) => String(r[letterCol] || '').trim() !== '');
  if (letterHasData) return letterCol;

  const nameCol = findColumn(cols, CONFIG.ratingColumnName);
  const nameHasData = nameCol && rows.some((r) => String(r[nameCol] || '').trim() !== '');
  if (nameHasData) return nameCol;

  return letterCol || nameCol || '';
}


function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 將一個儲存格內容拆解成多個 TAG 值：
 * 半形逗號「,」與全形逗號「，」都視為分隔符號，
 * 並自動去除每個值前後的空白（含全形空白），過濾空字串
 * 例如 "常態團,獨立單" 或 "常態團，獨立單" → ["常態團", "獨立單"]
 */
function splitTagValues(text) {
  return String(text || '')
    .split(/[,，]/)
    .map((v) => v.replace(/^[\s\u3000]+|[\s\u3000]+$/g, ''))
    .filter(Boolean);
}

/** 比對用的正規化字串：去除頭尾空白（含全形）、統一大小寫，避免因空白或大小寫造成比對失敗 */
function normalizeForCompare(text) {
  return String(text || '')
    .replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
    .toLowerCase();
}

/** 判斷字串是否為圖片／ICON 網址 */
function isUrl(text) {
  return /^https?:\/\//i.test(String(text || '').trim());
}

/**
 * 在欄位標題陣列中尋找符合指定名稱的欄位，容錯處理：
 * 1) 先找完全相同（去除頭尾空白、忽略大小寫）
 * 2) 找不到再找「欄位標題包含目標文字」或「目標文字包含欄位標題」
 * 回傳欄位標題原文，找不到則回傳空字串
 */
function findColumn(cols, targetName) {
  const target = String(targetName || '').trim();
  if (!target) return '';
  const exact = cols.find((c) => c.trim().toLowerCase() === target.toLowerCase());
  if (exact) return exact;
  const partial = cols.find(
    (c) => c.trim() && (c.trim().includes(target) || target.includes(c.trim()))
  );
  return partial || '';
}

/** 若字串是網址則回傳可點擊連結的 HTML，否則回傳純文字 */
function linkify(text) {
  const t = String(text).trim();
  if (/^https?:\/\//i.test(t)) {
    return `<a href="${escapeHtml(t)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`;
  }
  return escapeHtml(t);
}
