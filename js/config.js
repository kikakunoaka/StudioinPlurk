// ==========================================================
// 網站設定 — 如需修改試算表 ID 或分頁名稱，只需改這裡
// ==========================================================
const CONFIG = {
  // 試算表 ID（網址 /d/ 與 /edit 之間那一長串）
  sheetId: '1fpoLejfAJz6bQwAPA4xwTzQzW21Y-5ABPT1f-vaGwsQ',

  // 主頁資料來源分頁名稱
  listSheetName: '工作室列表',

  // 更新日誌分頁名稱（主頁最上方可折疊區塊）
  changelogSheetName: '更新日誌',

  // 主頁篩選搜尋器資料來源分頁：第 2 列（A2:E2）為搜尋項目標題，
  // 第 3 列起（A3:E）為每個項目底下可篩選的內容
  sourcesSheetName: 'sources',
  sourcesHeaderRow: 2,

  // 主頁「工作室列表」中，ICON 圖片欄位的標題文字
  iconColumnName: 'ICON',

  // 主頁「工作室列表」中，體驗評價欄位的標題文字（顯示於卡片右上角勳章）
  ratingColumnName: '體驗評價',
  // 體驗評價欄位所在的試算表欄位字母（例如 'H'）— 優先依此欄位位置抓取，
  // 抓不到資料時才退而用上面的標題文字比對
  ratingColumnLetter: 'H',

  // 體驗回報表單網址（顯示於工作室分頁右上角的「體驗回報」連結）
  reviewFormUrl: 'https://forms.gle/ZiiJwXSDe9ic8GEB7',

  // 各工作室分頁：「廠商介紹」讀取範圍（A 欄為標題、B:G 欄為內容）
  // 第一列（A1/B1…）視為 ICON 圖示列，其餘列顯示為橢圓 TAG
  profileRange: 'A1:G16',

  // 各工作室分頁：「體驗者感想」從此列開始（該列為標題列）
  reviewStartRow: 18,
};
