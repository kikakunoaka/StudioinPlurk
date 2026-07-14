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
  let tagCols = [];

  const activeTags = new Set();

  // ---- 更新日誌（可折疊區塊） ----
  loadChangelog();

  // ---- 主頁工作室列表 ----
  try {
    const data = await fetchSheet(CONFIG.listSheetName);
    cols = data.cols;
    rows = data.rows;
  } catch (err) {
    contentEl.innerHTML = `<div class="error-box">讀取「${escapeHtml(CONFIG.listSheetName)}」分頁失敗：${escapeHtml(err.message)}</div>`;
    tagGroupsEl.innerHTML = '';
    return;
  }

  if (!cols.length) {
    contentEl.innerHTML = `<div class="error-box">找不到「${escapeHtml(CONFIG.listSheetName)}」分頁，或分頁目前沒有資料。</div>`;
    tagGroupsEl.innerHTML = '';
    return;
  }

  nameCol = cols[0];
  iconCol = cols.find((c) => c.trim().toUpperCase() === CONFIG.iconColumnName.toUpperCase()) || '';
  tagCols = CONFIG.filterColumns.filter((c) => cols.includes(c));

  buildTagFilterBar();
  render();

  searchInput.addEventListener('input', render);
  clearBtn.addEventListener('click', () => {
    activeTags.clear();
    searchInput.value = '';
    document.querySelectorAll('.tag.active').forEach((el) => el.classList.remove('active'));
    render();
  });

  async function loadChangelog() {
    try {
      const log = await fetchSheet(CONFIG.changelogSheetName);
      if (!log.rows.length) {
        changelogBody.innerHTML = `<div class="changelog-entry">目前尚無更新紀錄。</div>`;
        return;
      }
      const dateCol = log.cols[0];
      const otherCols = log.cols.slice(1);
      changelogBody.innerHTML = log.rows
        .map((row) => {
          const date = String(row[dateCol] || '').trim();
          const msg = otherCols
            .map((c) => String(row[c] || '').trim())
            .filter(Boolean)
            .join(' ・ ');
          return `<div class="changelog-entry">${date ? `<span class="cl-date">${escapeHtml(date)}</span>` : ''}${escapeHtml(msg)}</div>`;
        })
        .join('');
    } catch (err) {
      changelogBody.innerHTML = `<div class="error-box">更新日誌載入失敗：${escapeHtml(err.message)}</div>`;
    }
  }

  function buildTagFilterBar() {
    if (!tagCols.length) {
      tagGroupsEl.innerHTML = '';
      return;
    }
    tagGroupsEl.innerHTML = '';
    tagCols.forEach((col) => {
      const values = Array.from(
        new Set(rows.map((r) => String(r[col] || '').trim()).filter(Boolean))
      ).sort();
      if (!values.length) return;

      const group = document.createElement('div');
      group.className = 'tag-group';

      const label = document.createElement('span');
      label.className = 'group-label';
      label.textContent = col;
      group.appendChild(label);

      const chips = document.createElement('div');
      chips.className = 'tag-chips';

      values.forEach((val) => {
        const key = `${col}::${val}`;
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
    const q = searchInput.value.trim().toLowerCase();

    // 篩選內容僅比對指定欄位（C/F/G/H）的值是否包含搜尋字串，或符合已勾選的 TAG
    const filtered = rows.filter((row) => {
      if (q) {
        const nameMatch = String(row[nameCol] || '').toLowerCase().includes(q);
        const tagTextMatch = tagCols.some((c) =>
          String(row[c] || '').toLowerCase().includes(q)
        );
        if (!nameMatch && !tagTextMatch) return false;
      }
      for (const key of activeTags) {
        const [col, val] = key.split('::');
        if (String(row[col] || '').trim() !== val) return false;
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
    const href = `studio.html?name=${encodeURIComponent(name)}`;

    const tagHtml = tagCols
      .map((col) => String(row[col] || '').trim())
      .filter(Boolean)
      .map((v) => `<span class="tag static">${escapeHtml(v)}</span>`)
      .join('');

    return `
      <div class="card">
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
