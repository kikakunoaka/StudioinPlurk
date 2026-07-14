(async function () {
  const contentEl = document.getElementById('content');

  const params = new URLSearchParams(window.location.search);
  const studioName = (params.get('name') || '').trim();

  if (!studioName) {
    contentEl.innerHTML = `<div class="error-box">網址缺少工作室名稱參數（?name=…）。請從主頁點擊工作室卡片進入。</div>`;
    return;
  }

  document.title = `${studioName}｜工作室評價目錄`;

  let profile = { cols: [], rows: [] };
  let profileError = null;
  try {
    profile = await fetchSheet(studioName);
  } catch (err) {
    profileError = err.message;
  }

  let reviews = { cols: [], rows: [] };
  let reviewError = null;
  try {
    reviews = await fetchSheet(CONFIG.reviewSheetName);
  } catch (err) {
    reviewError = err.message;
  }

  const matchedReviews = reviews.rows.filter((row) =>
    Object.values(row).some((v) => String(v).trim() === studioName)
  );

  contentEl.innerHTML = `
    <h1 class="studio-title">${escapeHtml(studioName)}</h1>
    <div class="studio-sub">工作室介紹與體驗者心得</div>

    <div class="section-label">廠商介紹</div>
    ${renderProfile()}

    <div class="section-label">體驗者感想 ${matchedReviews.length ? `(${matchedReviews.length})` : ''}</div>
    ${renderReviews()}
  `;

  function renderProfile() {
    if (profileError) {
      return `<div class="error-box">讀取工作室介紹失敗：${escapeHtml(profileError)}<br>請確認試算表中有一個名稱完全為「${escapeHtml(studioName)}」的分頁。</div>`;
    }
    if (!profile.cols.length || !profile.rows.length) {
      return `<div class="empty-state">尚未填寫工作室介紹資料。</div>`;
    }

    // 兩欄格式（欄位／值逐列並排）→ 直接當作 key-value 清單
    if (profile.cols.length === 2) {
      const items = profile.rows
        .filter((r) => String(r[profile.cols[0]] || '').trim())
        .map(
          (r) =>
            `<dt>${escapeHtml(r[profile.cols[0]])}</dt><dd>${linkify(r[profile.cols[1]] || '')}</dd>`
        )
        .join('');
      return `<div class="profile-card"><dl class="kv-grid">${items}</dl></div>`;
    }

    // 一般表格格式：以第一列資料為主要介紹內容
    const mainRow = profile.rows[0];
    const items = profile.cols
      .map((col) => {
        const v = String(mainRow[col] || '').trim();
        if (!v) return '';
        return `<dt>${escapeHtml(col)}</dt><dd>${linkify(v)}</dd>`;
      })
      .filter(Boolean)
      .join('');

    let extraRowsHtml = '';
    if (profile.rows.length > 1) {
      const extraRows = profile.rows.slice(1);
      extraRowsHtml = `
        <div style="margin-top:18px; display:flex; flex-direction:column; gap:10px;">
          ${extraRows
            .map((row) => {
              const rowItems = profile.cols
                .map((col) => {
                  const v = String(row[col] || '').trim();
                  return v ? `<dt>${escapeHtml(col)}</dt><dd>${linkify(v)}</dd>` : '';
                })
                .filter(Boolean)
                .join('');
              return `<dl class="kv-grid">${rowItems}</dl>`;
            })
            .join('<hr style="border:none;border-top:1px dashed var(--rule);margin:4px 0;">')}
        </div>`;
    }

    return `<div class="profile-card"><dl class="kv-grid">${items}</dl>${extraRowsHtml}</div>`;
  }

  function renderReviews() {
    if (reviewError) {
      return `<div class="error-box">讀取體驗回報失敗：${escapeHtml(reviewError)}</div>`;
    }
    if (!matchedReviews.length) {
      return `<div class="empty-state">目前還沒有體驗心得，成為第一個分享的人吧！</div>`;
    }

    const cards = matchedReviews
      .map((row) => {
        const fields = reviews.cols
          .map((col) => {
            const v = String(row[col] || '').trim();
            if (!v || v === studioName) return '';
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
