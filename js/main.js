(async function () {
  const contentEl = document.getElementById('content');
  const tagGroupsEl = document.getElementById('tagGroups');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const changelogBody = document.getElementById('changelogBody');

  let cols = [];
  let rows = [];
  let nameCol = '';
  let iconCol = '';
  let ratingCol = '';
  let tagCols = [];
  let filterGroups = []; // 從 'sources' 分頁讀取：[{ label, values: [...] }]

  const activeTags = new Set();

  // ---- 更新日誌（可折疊區塊） ----
  loadChangelog();

  // ---- 篩選搜尋器（讀取 'sources' 分頁） ----
  loadFilterGroupsThenBuild();

  // ---- 主頁工作室列表（讀取「工作室列表」分頁全部欄位） ----
  try {
    const data = await fetchSheetSafe(CONFIG.listSheetName);
    cols = data.cols;
    rows = data.rows;
  } catch (err) {
    contentEl.innerHTML = `<div class="error-box">讀取「${escapeHtml(CONFIG.listSheetName)}」分頁失敗：${escapeHtml(err.message)}</div>`;
    return;
  }

  if (!cols.length) {
    contentEl.innerHTML = `<div class="error-box">找不到「${escapeHtml(CONFIG.listSheetName)}」分頁，或分頁目前沒有資料。</div>`;
    return;
  }

  nameCol = cols[0];
  iconCol = findColumn(cols, CONFIG.iconColumnName);
  // 體驗評價：優先直接抓 CONFIG.ratingColumnLetter 指定的欄位位置（預設 H 欄），
  // 不管標題文字寫什麼；抓不到資料才退而比對標題文字
  ratingCol = pickRatingColumn(cols, rows);
  // 卡片顯示「工作室列表」的全部欄位內容，僅排除名稱／ICON／體驗評價
  // （名稱是標題、ICON 顯示成圖片、體驗評價顯示成右上角勳章，三者都不當一般 TAG）
  tagCols = cols.filter((c) => c !== nameCol && c !== iconCol && c !== ratingCol);

  render();

  searchInput.addEventListener('input', render);
  clearBtn.addEventListener('click', () => {
    activeTags.clear();
    searchInput.value = '';
    document.querySelectorAll('.tag.active').forEach((el) => el.classList.remove('active'));
    render();
  });

  // ---- 更新日誌：每一列都是資料（無標題列），用固定寬範圍讀取避免漏抓 ----
  async function loadChangelog() {
    try {
      const raw = await fetchRange(CONFIG.changelogSheetName, 'A1:Z500', false);
      const entries = raw.rows.filter((rowArr) => rowArr.some((v) => String(v).trim() !== ''));
      if (!entries.length) {
        changelogBody.innerHTML = `<div class="changelog-entry">目前尚無更新紀錄。</div>`;
        return;
      }
      changelogBody.innerHTML = entries
        .map((rowArr) => {
          const date = String(rowArr[0] || '').trim();
          const msg = rowArr
            .slice(1)
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .join(' ・ ');
          return `<div class="changelog-entry">${date ? `<span class="cl-date">${escapeHtml(date)}</span>` : ''}${escapeHtml(msg)}</div>`;
        })
        .join('');
    } catch (err) {
      changelogBody.innerHTML = `<div class="error-box">更新日誌載入失敗：${escapeHtml(err.message)}</div>`;
    }
  }

  // ---- 篩選搜尋器：讀取 'sources' 分頁，A2:E2 為項目標題、A3:E 為項目內容 ----
  async function loadFilterGroupsThenBuild() {
    try {
      const headerRowNum = CONFIG.sourcesHeaderRow || 2;
      const range = `A${headerRowNum}:E1000`;
      const raw = await fetchRange(CONFIG.sourcesSheetName, range, true);
      filterGroups = raw.cols
        .map((label, i) => {
          const values = [];
          raw.rows.forEach((rowArr) => {
            splitTagValues(rowArr[i]).forEach((v) => {
              if (!values.includes(v)) values.push(v);
            });
          });
          return { label: String(label || '').trim(), values };
        })
        .filter((g) => g.label && g.values.length);
      buildTagFilterBar();
    } catch (err) {
      tagGroupsEl.innerHTML = `<div class="error-box">篩選搜尋器載入失敗：${escapeHtml(err.message)}</div>`;
    }
  }

  function buildTagFilterBar() {
    if (!filterGroups.length) {
      tagGroupsEl.innerHTML = '';
      return;
    }
    tagGroupsEl.innerHTML = '';
    filterGroups.forEach(({ label, values }) => {
      const group = document.createElement('div');
      group.className = 'tag-group';

      const labelEl = document.createElement('span');
      labelEl.className = 'group-label';
      labelEl.textContent = label;
      group.appendChild(labelEl);

      const chips = document.createElement('div');
      chips.className = 'tag-chips';

      values.forEach((val) => {
        const key = `${label}::${val}`;
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.textContent = val;
        chip.dataset.key = key;
        chip.addEventListener('click', () => {
          if (activeTags.has(key)) {
            activeTags.delete(key);
            chip.classList.remove('active');
          } else {
            activeTags.add(key);
            chip.classList.add('active');
          }
          render();
        });
        chips.appendChild(chip);
      });

      group.appendChild(chips);
      tagGroupsEl.appendChild(group);
    });
  }

  function render() {
    if (!cols.length) return;
    const q = searchInput.value.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (q) {
        const nameMatch = String(row[nameCol] || '').toLowerCase().includes(q);
        const tagTextMatch = tagCols.some((c) =>
          String(row[c] || '').toLowerCase().includes(q)
        );
        if (!nameMatch && !tagTextMatch) return false;
      }
      // 已勾選的篩選項目：比對「sources」分頁的項目標題是否對應到
      // 「工作室列表」欄位（容錯比對，不要求文字完全一致），並將該欄
      // 內容依逗號拆解後，正規化比對是否包含所選值
      for (const key of activeTags) {
        const idx = key.lastIndexOf('::');
        const label = key.slice(0, idx);
        const val = key.slice(idx + 2);
        const matchedCol = findColumn(cols, label);
        if (!matchedCol) return false;
        const cellValues = splitTagValues(row[matchedCol]).map(normalizeForCompare);
        if (!cellValues.includes(normalizeForCompare(val))) return false;
      }
      return true;
    });

    if (!filtered.length) {
      contentEl.innerHTML = `<div class="empty-state">沒有符合條件的工作室，試試調整篩選條件。</div>`;
      return;
    }

    contentEl.innerHTML = `<div class="grid">${filtered.map(renderCard).join('')}</div>`;
  }

  function renderCard(row) {
    const name = String(row[nameCol] || '未命名工作室').trim();
    const icon = iconCol ? String(row[iconCol] || '').trim() : '';
    const rating = ratingCol ? String(row[ratingCol] || '').trim() : '';
    const href = `studio.html?name=${encodeURIComponent(name)}`;

    const tagHtml = tagCols
      .flatMap((col) => splitTagValues(row[col]))
      .map((v) => `<span class="tag static">${escapeHtml(v)}</span>`)
      .join('');

    return `
      <div class="card">
        ${rating ? `<div class="rating-badge" title="體驗評價">${escapeHtml(rating)}</div>` : ''}
        <a class="card-link" href="${href}">
          <div class="card-head">
            ${icon ? `<img class="card-icon" src="${escapeHtml(icon)}" alt="${escapeHtml(name)} icon" loading="lazy" onerror="this.style.display='none'">` : ''}
            <h3>${escapeHtml(name)}</h3>
          </div>
          <div class="card-tags">${tagHtml}</div>
        </a>
      </div>
    `;
  }
})();
