(async function () {
  const contentEl = document.getElementById('content');

  const params = new URLSearchParams(window.location.search);
  const studioName = (params.get('name') || '').trim();

  if (!studioName) {
    contentEl.innerHTML = `<div class="error-box">網址缺少工作室名稱參數（?name=…）。請從主頁點擊工作室卡片進入。</div>`;
    return;
  }

  document.title = `${studioName}｜噗浪周邊客製工作室`;

  // ---- 嘗試從主頁工作室列表抓 ICON、體驗評價（非必要，抓不到就略過）----
  let iconUrl = '';
  let ratingValue = '';
  try {
    const list = await fetchSheetSafe(CONFIG.listSheetName);
    const iconCol = findColumn(list.cols, CONFIG.iconColumnName);
    const ratingCol = pickRatingColumn(list.cols, list.rows);
    const nameCol = list.cols[0];
    const match = list.rows.find((r) => String(r[nameCol] || '').trim() === studioName);
    if (match) {
      if (iconCol) iconUrl = String(match[iconCol] || '').trim();
      if (ratingCol) ratingValue = String(match[ratingCol] || '').trim();
    }
  } catch (e) {
    /* icon／評價抓不到不影響其餘內容，略過 */
  }

  // ---- 廠商介紹：A1:G16，A 欄為標題、B:G 欄為內容 ----
  // 第一列（A1 為標題、B1 起為內容）視為 ICON 圖示列，網址會顯示成圖片；
  // 其餘列（A2:G16）顯示成橢圓 TAG，內容若含半形逗號則拆解成多個 TAG
  let profileRows = [];
  let profileError = null;
  try {
    const raw = await fetchRange(studioName, CONFIG.profileRange, false);
    // raw.cols 例如 ['A','B','C','D','E','F','G']；raw.rows 為陣列的陣列
    profileRows = raw.rows
      .map((rowArr, idx) => {
        const label = String(rowArr[0] || '').trim();
        const rawValues = rowArr.slice(1).map((v) => String(v || '').trim()).filter(Boolean);
        if (idx === 0) {
          // 第一列：轉成 ICON 圖示
          return { label, values: rawValues, isIcon: true };
        }
        const values = rawValues.flatMap((v) => splitTagValues(v));
        return { label, values, isIcon: false };
      })
      .filter((r) => r.label && r.values.length);
  } catch (err) {
    profileError = err.message;
  }

  // ---- 體驗者感想：從第 18 列開始（該列為標題列）----
  let reviewCols = [];
  let reviewRows = [];
  let reviewError = null;
  try {
    const lastRow = CONFIG.reviewStartRow + 500; // 涵蓋範圍，足夠容納未來新增的回報
    const range = `A${CONFIG.reviewStartRow}:Z${lastRow}`;
    const raw = await fetchRange(studioName, range, true);
    reviewCols = raw.cols;
    reviewRows = raw.rows.filter((rowArr) => rowArr.some((v) => String(v).trim() !== ''));
  } catch (err) {
    reviewError = err.message;
  }

  contentEl.innerHTML = `
    <div class="studio-toprow">
      <div class="studio-head">
        ${iconUrl ? `<img class="studio-icon" src="${escapeHtml(iconUrl)}" alt="${escapeHtml(studioName)} icon" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div>
          <h1 class="studio-title">
            ${escapeHtml(studioName)}
            ${ratingValue ? `<span class="rating-badge rating-badge--inline" title="體驗評價">${escapeHtml(ratingValue)}</span>` : ''}
          </h1>
          <div class="studio-sub">工作室介紹與體驗者心得</div>
        </div>
      </div>
      ${CONFIG.reviewFormUrl ? `<a class="review-report-link" href="${escapeHtml(CONFIG.reviewFormUrl)}" target="_blank" rel="noopener">📝 體驗回報</a>` : ''}
    </div>

    <div class="section-label">廠商介紹</div>
    ${renderProfile()}

    <div class="section-label">體驗者感想 ${reviewRows.length ? `(${reviewRows.length})` : ''}</div>
    ${renderReviews()}
  `;

  function renderProfile() {
    if (profileError) {
      return `<div class="error-box">讀取工作室介紹失敗：${escapeHtml(profileError)}<br>請確認試算表中有一個名稱完全為「${escapeHtml(studioName)}」的分頁。</div>`;
    }
    if (!profileRows.length) {
      return `<div class="empty-state">尚未填寫工作室介紹資料。</div>`;
    }

    const blocks = profileRows
      .map(({ label, values, isIcon }) => {
        if (isIcon) {
          const iconsHtml = values
            .map((v) =>
              isUrl(v)
                ? `<img class="profile-icon" src="${escapeHtml(v)}" alt="${escapeHtml(label)}" loading="lazy" onerror="this.style.display='none'">`
                : `<span class="tag static">${escapeHtml(v)}</span>`
            )
            .join('');
          return `
            <div class="tag-group profile-icon-row" style="margin-bottom:12px;">
              <span class="group-label">${escapeHtml(label)}</span>
              <div class="tag-chips profile-icons">${iconsHtml}</div>
            </div>`;
        }
        const tagHtml = values.map((v) => `<span class="tag static">${linkify(v)}</span>`).join('');
        return `
          <div class="tag-group" style="margin-bottom:12px;">
            <span class="group-label">${escapeHtml(label)}</span>
            <div class="tag-chips">${tagHtml}</div>
          </div>`;
      })
      .join('');

    return `<div class="profile-card">${blocks}</div>`;
  }

  function renderReviews() {
    if (reviewError) {
      return `<div class="error-box">讀取體驗者感想失敗：${escapeHtml(reviewError)}</div>`;
    }
    if (!reviewRows.length) {
      return `<div class="empty-state">目前還沒有體驗心得，成為第一個分享的人吧！</div>`;
    }

    const cards = reviewRows
      .map((rowArr) => {
        const fields = reviewCols
          .map((col, i) => {
            const v = String(rowArr[i] || '').trim();
            if (!v) return '';
            return `<div class="review-field"><span class="f-label">${escapeHtml(col)}</span>${linkify(v)}</div>`;
          })
          .filter(Boolean)
          .join('');
        return `<div class="review-card">${fields}</div>`;
      })
      .join('');

    return `<div class="review-list">${cards}</div>`;
  }
})();
