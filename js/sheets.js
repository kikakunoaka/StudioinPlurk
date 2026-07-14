// ==========================================================
// 讀取 Google 試算表（免後端、免 API Key）
// 前提：該試算表分享設定需為「知道連結的任何人 > 檢視者」
// ==========================================================

/**
 * 讀取指定分頁，回傳 { cols, rows }
 * cols: 欄位名稱陣列（依表格第一列標題）
 * rows: 物件陣列，每個物件的 key 為欄位名稱
 */
async function fetchSheet(sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&_ts=${Date.now()}`;

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(
      `無法連線到 Google 試算表，請確認網路連線，或該分頁「${sheetName}」是否存在。`
    );
  }
  if (!res.ok) {
    throw new Error(
      `找不到分頁「${sheetName}」，請確認試算表分頁名稱是否完全相符（含空白、全形字）。`
    );
  }

  const text = await res.text();
  const match = text.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error(
      '試算表回應格式不正確，請確認分享設定為「知道連結的任何人 > 檢視者」。'
    );
  }

  const json = JSON.parse(match[1]);
  if (!json.table || !json.table.cols) {
    return { cols: [], rows: [] };
  }

  const cols = json.table.cols.map((c, i) => (c.label && c.label.trim()) || c.id || `欄位${i + 1}`);

  const rows = (json.table.rows || [])
    .map((r) => {
      const obj = {};
      cols.forEach((col, i) => {
        const cell = r.c && r.c[i];
        if (!cell) {
          obj[col] = '';
        } else if (cell.f !== undefined && cell.f !== null) {
          obj[col] = cell.f; // 格式化後的顯示文字（例如日期）
        } else {
          obj[col] = cell.v ?? '';
        }
      });
      return obj;
    })
    // 過濾整列空白的資料
    .filter((row) => Object.values(row).some((v) => String(v).trim() !== ''));

  return { cols, rows };
}

/** 簡單的 HTML escape，避免試算表內容意外破版或注入 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 判斷欄位是否應視為補充資訊（連結、介紹等）而非分類 TAG */
function isNonTagColumn(colName) {
  return CONFIG.nonTagKeywords.some((kw) => colName.includes(kw));
}

/** 若字串是網址則回傳可點擊連結的 HTML，否則回傳純文字 */
function linkify(text) {
  const t = String(text).trim();
  if (/^https?:\/\//i.test(t)) {
    return `<a href="${escapeHtml(t)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`;
  }
  return escapeHtml(t);
}
