(async function () {
  const F = CONFIG.STUDIO_FIELDS;
  const RF = CONFIG.REVIEW_FIELDS;
  const CF = CONFIG.CHANGELOG_FIELDS;

  const gridEl = document.getElementById('studioGrid');
  const countEl = document.getElementById('resultCount');
  const searchInput = document.getElementById('searchInput');
  const factorySel = document.getElementById('filterFactory');
  const itemSel = document.getElementById('filterItem');
  const statusSel = document.getElementById('filterStatus');
  const changelogContentEl = document.getElementById('changelogContent');

  let studios = [];
  const scoreMap = {}; // 工作室名稱 -> { avg, count }

  function renderState(msg, isError) {
    gridEl.innerHTML = `<div class="state-msg ${isError ? 'error' : ''}">
      ${isError ? '' : '<div class="spinner"></div>'}
      ${msg}
    </div>`;
  }

  function buildFilterOptions(select, values, placeholder) {
    const unique = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    select.innerHTML = `<option value="">${placeholder}</option>` +
      unique.map((v) => `<option value="${v}">${v}</option>`).join('');
  }

  function studioCard(s) {
    const status = CONFIG.STATUS_STYLE[s[F.STATUS]] || CONFIG.STATUS_STYLE['未知'];
    const items = splitTags(s[F.ITEMS]).slice(0, 4);
    const score = scoreMap[s[F.NAME]];
    const iconHtml = s[F.ICON]
      ? `<img src="${s[F.ICON]}" alt="${s[F.NAME]} icon" loading="lazy" onerror="this.parentElement.textContent='${(s[F.NAME] || '?').slice(0,1)}'">`
      : (s[F.NAME] || '?').slice(0, 1);

    return `
      <div class="charm-card">
        <div class="charm-icon">${iconHtml}</div>
        <h3>${s[F.NAME] || '未命名工作室'}</h3>
        ${mediaIconsHtml(s, F)}
        <div class="badge-row">
          <span class="badge ${status.cls}">${status.label}</span>
          ${s[F.FACTORY] ? `<span class="badge">${s[F.FACTORY]}</span>` : ''}
          ${score ? `<span class="badge badge-score">⭐ ${score.avg}（${score.count}則）</span>` : ''}
        </div>
        <div class="tag-row">
          ${items.map((t) => `<span class="tag">${t}</span>`).join('')}
        </div>
        <a class="view-link" href="studio.html?name=${encodeURIComponent(s[F.NAME] || '')}">查看詳情</a>
      </div>
    `;
  }

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const factory = factorySel.value;
    const item = itemSel.value;
    const status = statusSel.value;

    const filtered = studios.filter((s) => {
      if (q && !(s[F.NAME] || '').toLowerCase().includes(q) && !(s[F.PLURK] || '').toLowerCase().includes(q)) return false;
      if (factory && !splitTags(s[F.FACTORY]).includes(factory)) return false;
      if (status && s[F.STATUS] !== status) return false;
      if (item && !splitTags(s[F.ITEMS]).includes(item)) return false;
      return true;
    });

    countEl.textContent = `共找到 ${filtered.length} 間工作室`;
    gridEl.innerHTML = filtered.length
      ? filtered.map(studioCard).join('')
      : `<div class="state-msg">找不到符合條件的工作室，換個篩選條件看看？</div>`;
  }

  [searchInput, factorySel, itemSel, statusSel].forEach((el) => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  function renderChangelog(rows) {
    if (!rows || rows.length === 0) {
      changelogContentEl.innerHTML = '<p style="text-align:center; font-size:0.85rem; color:var(--ink-soft); margin:10px 0;">目前尚無更新紀錄。</p>';
      return;
    }
    const sorted = [...rows].sort((a, b) => safeDateValue(b[CF.TIME]) - safeDateValue(a[CF.TIME]));
    changelogContentEl.innerHTML = `
      <ul class="changelog-list">
        ${sorted.map((item) => `
          <li class="changelog-item">
            <div class="changelog-meta">
              <span class="changelog-time">${item[CF.TIME] || ''}</span>
              <span class="changelog-event">${item[CF.EVENT] || ''}</span>
            </div>
            <div class="changelog-text">${formatTextWithLinks(item[CF.CONTENT])}</div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  try {
    renderState('資料載入中...', false);

    const [studioRows, reviewRows, changelogRows] = await Promise.all([
      fetchSheetRows(CONFIG.SHEETS.STUDIOS),
      fetchSheetRows(CONFIG.SHEETS.REVIEWS).catch(() => []),
      fetchSheetRows(CONFIG.SHEETS.CHANGELOG).catch(() => []),
    ]);
    studios = studioRows;

    reviewRows.forEach((r) => {
      const name = r[RF.STUDIO_NAME];
      const score = parseFloat(r[RF.SCORE]);
      if (!name || Number.isNaN(score)) return;
      if (!scoreMap[name]) scoreMap[name] = { total: 0, count: 0 };
      scoreMap[name].total += score;
      scoreMap[name].count += 1;
    });
    Object.keys(scoreMap).forEach((name) => {
      scoreMap[name].avg = (scoreMap[name].total / scoreMap[name].count).toFixed(1);
    });

    const allFactories = studios.flatMap((s) => splitTags(s[F.FACTORY]));
    buildFilterOptions(factorySel, allFactories, '全部工廠');
    buildFilterOptions(statusSel, studios.map((s) => s[F.STATUS]), '全部狀態');
    const allItems = studios.flatMap((s) => splitTags(s[F.ITEMS]));
    buildFilterOptions(itemSel, allItems, '全部客製項目');

    applyFilters();
    renderChangelog(changelogRows);
  } catch (err) {
    console.error(err);
    renderState(
      `讀取試算表失敗，請確認試算表分享設定為「知道連結的任何人可檢視」。<br>（${err.message}）`,
      true
    );
    renderChangelog([]);
  }
})();
