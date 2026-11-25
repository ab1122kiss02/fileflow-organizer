import { formatBytes } from './rules.js';

export function renderDonutChart(containerEl, legendEl, stats, onSelectCategory) {
  const total = stats.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    containerEl.innerHTML = `<svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="64" fill="none" stroke="var(--border)" stroke-width="22"/><text x="90" y="95" text-anchor="middle" fill="var(--text-muted)" font-size="14">無檔案</text></svg>`;
    legendEl.innerHTML = '';
    return;
  }

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = stats.map((item) => {
    const fraction = item.count / total;
    const dash = fraction * circumference;
    const seg = `<circle
      cx="90" cy="90" r="${radius}"
      fill="none"
      stroke="${item.color}"
      stroke-width="22"
      stroke-dasharray="${dash} ${circumference - dash}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 90 90)"
      style="cursor:pointer; transition: opacity 0.15s;"
      data-cat-id="${item.id}"
    ><title>${item.folderName}: ${item.count} 個 (${Math.round(fraction * 100)}%)</title></circle>`;
    offset += dash;
    return seg;
  });

  containerEl.innerHTML = `
    <svg viewBox="0 0 180 180" aria-label="檔案類型分佈圖">
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="var(--surface-alt)" stroke-width="22" />
      ${segments.join('')}
      <text x="90" y="86" text-anchor="middle" fill="var(--text)" font-size="22" font-weight="800">${total}</text>
      <text x="90" y="106" text-anchor="middle" fill="var(--text-muted)" font-size="11">總檔案數</text>
    </svg>
  `;

  legendEl.innerHTML = stats
    .map(
      (item) => `
      <div class="legend-item" data-cat-id="${item.id}" title="點擊篩選 ${item.folderName}">
        <span class="legend-dot" style="background:${item.color}"></span>
        <span class="legend-name">${item.icon} ${item.folderName}</span>
        <span class="legend-count">${item.count}</span>
      </div>
    `
    )
    .join('');

  containerEl.querySelectorAll('[data-cat-id]').forEach((el) => {
    el.addEventListener('click', () => onSelectCategory(el.dataset.catId));
  });
  legendEl.querySelectorAll('[data-cat-id]').forEach((el) => {
    el.addEventListener('click', () => onSelectCategory(el.dataset.catId));
  });
}

export function renderSizeBarChart(containerEl, stats) {
  if (stats.length === 0) {
    containerEl.innerHTML = '<p class="panel-hint">尚無資料可顯示</p>';
    return;
  }

  const sorted = [...stats].sort((a, b) => b.size - a.size).slice(0, 7);
  const maxSize = Math.max(...sorted.map((s) => s.size), 1);

  containerEl.innerHTML = sorted
    .map((item) => {
      const pct = Math.max(Math.round((item.size / maxSize) * 100), 2);
      return `
        <div class="bar-row">
          <div class="bar-meta">
            <span>${item.icon} ${item.folderName} (${item.count})</span>
            <strong>${formatBytes(item.size)}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${item.color}"></div>
          </div>
        </div>
      `;
    })
    .join('');
}
