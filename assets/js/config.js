// ============================================
// 網站設定檔：修改這裡即可調整資料來源
// ============================================
const CONFIG = {
  // Google 試算表 ID（在網址 /d/ 和 /edit 之間那一串）
  SHEET_ID: '1fpoLejfAJz6bQwAPA4xwTzQzW21Y-5ABPT1f-vaGwsQ',

  // 各分頁名稱，需與試算表內的分頁名稱完全一致
  SHEETS: {
    STUDIOS: '工作室列表',
    REVIEWS: '體驗回報',
    CHANGELOG: '更新日誌',
  },

  // 「工作室列表」分頁欄位名稱（對應試算表表頭文字）
  STUDIO_FIELDS: {
    NAME: '工作室',
    PLURK: '噗浪帳號',
    WEBSITE: '官方網站',
    EMAIL: 'E-Mail',
    ICON: 'ICON',
    STATUS: '營運狀態',
    ORDER_TYPE: '委託方式',
    FACTORY: '工廠',
    ITEMS: '客製項目',
    NOTE: '評價',
  },

  // 「體驗回報」分頁欄位名稱
  REVIEW_FIELDS: {
    TIMESTAMP: '時間戳記',
    REVIEWER: '體驗者',
    STUDIO_NAME: '工作室名稱',
    SCORE: '體驗分數',
    ORDER_ITEM: '委印項目',
    COMMENT: '體驗感想',
    IMAGE_URL: '返圖網址',
    NOTE: '備註',
    // 電子郵件地址：故意不設定 / 不使用，避免在網站上外洩體驗者信箱
  },

  CHANGELOG_FIELDS: {
    TIME: '時間',
    EVENT: '事項',
    CONTENT: '內容',
  },

  // 營運狀況對應的顯示樣式（需與試算表「營運狀況」欄位的選項文字完全一致）
  STATUS_STYLE: {
    '營運中': { label: '營運中', cls: 'status-active' },
    '無限期休止': { label: '休止中', cls: 'status-pause' },
    '停止營運': { label: '已停止', cls: 'status-stop' },
    '未知': { label: '狀態未知', cls: 'status-unknown' },
  },
};
