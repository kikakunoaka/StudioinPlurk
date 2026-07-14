(async function () {
  const contentEl = document.getElementById('content');
  const tagGroupsEl = document.getElementById('tagGroups');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');

  let cols = [];
  let rows = [];
  let nameCol = '';
  let tagCols = [];
  let extraCols = [];

  // 目前被選取的篩選 TAG，用 "欄位名::值" 當作 key 儲存
  const activeTags = new Set();

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
  tagCols = cols.slice(1).filter((c) => !isNonTagColumn(c));
  extraCols = cols.slice(1).filter((c) => isNonTagColumn(c));

  buildTagFilterBar();
  render();

  searchInput.addEventListener('input', render);
  clearBtn.addEventListener('click', () => {
    activeTags.clear();
    searchInput.value = '';
    document.querySelectorAll('.tag.active').forEach((el) => el.classList.remove('active'));
    render();
  });

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

    const filtered = rows.filter((row) => {
      if (q && !String(row[nameCol] || '').toLowerCase().includes(q)) return false;
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
    const href = `studio.html?name=${encodeURIComponent(name)}`;

    const tagHtml = tagCols
      .map((col) => String(row[col] || '').trim())
      .filter(Boolean)
      .map((v) => `<span class="tag static">${escapeHtml(v)}</span>`)
      .join('');

    const extraHtml = extraCols
      .map((col) => {
        const v = String(row[col] || '').trim();
        if (!v) return '';
        return `<div>${escapeHtml(col)}：${linkify(v)}</div>`;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="card">
        <a class="card-link" href="${href}">
          <h3>${escapeHtml(name)}</h3>
          <div class="card-tags">${tagHtml}</div>
        </a>
        ${extraHtml ? `<div class="card-extra">${extraHtml}</div>` : ''}
      </div>
    `;
  }
})();
