import { DEFAULT_RULES, OTHER_CATEGORY, formatBytes, parseExtensionList } from './rules.js';
import {
  isFileSystemApiSupported,
  pickLocalDirectory,
  scanLocalDirectory,
  createDemoDataset,
  scanDemoDataset,
  buildOrganizationPlan,
  executeOrganizationPlan,
  undoLastOrganization,
} from './scanner.js';
import { renderDonutChart, renderSizeBarChart } from './charts.js';

const STORAGE_RULES_KEY = 'fileflow_rules_v1';
const STORAGE_THEME_KEY = 'fileflow_theme_v1';

const state = {
  rules: loadRules(),
  isDemo: false,
  demoFiles: [],
  rootHandle: null,
  scanResult: null,
  planItems: [],
  undoRecords: [],
  lastLogs: [],
  options: {
    recursive: false,
    skipTargetFolders: true,
    moveOthers: false,
    conflictStrategy: 'rename',
  },
  filters: {
    search: '',
    category: 'all',
    status: 'all',
  },
};

const els = {
  apiBadge: document.getElementById('apiBadge'),
  contextBanner: document.getElementById('contextBanner'),
  contextBannerMsg: document.getElementById('contextBannerMsg'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  pickFolderBtn: document.getElementById('pickFolderBtn'),
  demoBtn: document.getElementById('demoBtn'),
  emptyPickBtn: document.getElementById('emptyPickBtn'),
  emptyDemoBtn: document.getElementById('emptyDemoBtn'),
  workspaceBar: document.getElementById('workspaceBar'),
  modePill: document.getElementById('modePill'),
  folderNameText: document.getElementById('folderNameText'),
  scanTimeText: document.getElementById('scanTimeText'),
  rescanBtn: document.getElementById('rescanBtn'),
  undoBtn: document.getElementById('undoBtn'),
  exportLogBtn: document.getElementById('exportLogBtn'),
  emptyState: document.getElementById('emptyState'),
  dashboard: document.getElementById('dashboard'),
  kpiTotalFiles: document.getElementById('kpiTotalFiles'),
  kpiTotalFolders: document.getElementById('kpiTotalFolders'),
  kpiTotalSize: document.getElementById('kpiTotalSize'),
  kpiAvgSize: document.getElementById('kpiAvgSize'),
  kpiMoveCount: document.getElementById('kpiMoveCount'),
  kpiMoveSize: document.getElementById('kpiMoveSize'),
  kpiTargetFolders: document.getElementById('kpiTargetFolders'),
  kpiConflictCount: document.getElementById('kpiConflictCount'),
  donutChart: document.getElementById('donutChart'),
  donutLegend: document.getElementById('donutLegend'),
  sizeBarChart: document.getElementById('sizeBarChart'),
  optRecursive: document.getElementById('optRecursive'),
  optSkipTargetFolders: document.getElementById('optSkipTargetFolders'),
  optMoveOthers: document.getElementById('optMoveOthers'),
  optConflict: document.getElementById('optConflict'),
  rulesList: document.getElementById('rulesList'),
  addRuleBtn: document.getElementById('addRuleBtn'),
  previewSummaryText: document.getElementById('previewSummaryText'),
  executeBtn: document.getElementById('executeBtn'),
  executeCount: document.getElementById('executeCount'),
  progressBox: document.getElementById('progressBox'),
  progressLabel: document.getElementById('progressLabel'),
  progressPercent: document.getElementById('progressPercent'),
  progressFill: document.getElementById('progressFill'),
  resultBanner: document.getElementById('resultBanner'),
  resultBannerMsg: document.getElementById('resultBannerMsg'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  deselectAllBtn: document.getElementById('deselectAllBtn'),
  masterCheckbox: document.getElementById('masterCheckbox'),
  previewTableBody: document.getElementById('previewTableBody'),
  ruleModal: document.getElementById('ruleModal'),
  ruleModalTitle: document.getElementById('ruleModalTitle'),
  ruleForm: document.getElementById('ruleForm'),
  ruleIdInput: document.getElementById('ruleIdInput'),
  ruleIconInput: document.getElementById('ruleIconInput'),
  ruleFolderInput: document.getElementById('ruleFolderInput'),
  ruleColorInput: document.getElementById('ruleColorInput'),
  ruleExtInput: document.getElementById('ruleExtInput'),
  deleteRuleBtn: document.getElementById('deleteRuleBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
};

function loadRules() {
  try {
    const saved = localStorage.getItem(STORAGE_RULES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return structuredClone(DEFAULT_RULES);
}

function saveRules() {
  try {
    localStorage.setItem(STORAGE_RULES_KEY, JSON.stringify(state.rules));
  } catch {
    // ignore
  }
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME_KEY) || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(STORAGE_THEME_KEY, theme);
}

function initApiStatus() {
  if (isFileSystemApiSupported()) {
    els.apiBadge.textContent = '✓ 本機存取就緒 (Chrome/Edge)';
    els.apiBadge.classList.add('ok');
    els.contextBanner.classList.add('hidden');
  } else {
    els.apiBadge.textContent = '⚠ 僅支援模擬模式';
    els.apiBadge.classList.add('warn');
    els.contextBanner.classList.remove('hidden');
    if (window.location.protocol === 'file:') {
      els.contextBannerMsg.innerHTML =
        '您目前以 <code>file://</code> 直接開啟網頁，瀏覽器基於安全性會停用資料夾讀寫。請執行專案內的 <code>start.bat</code>（透過 <code>http://localhost</code> 開啟）並使用 Chrome / Edge，或先體驗「模擬體驗模式」。';
    }
    els.pickFolderBtn.disabled = true;
    els.emptyPickBtn.disabled = true;
  }
}

async function handlePickFolder() {
  try {
    const handle = await pickLocalDirectory();
    state.isDemo = false;
    state.rootHandle = handle;
    state.undoRecords = [];
    els.resultBanner.classList.add('hidden');
    await runScan();
  } catch (err) {
    if (err.name !== 'AbortError') {
      alert(err.message || '無法開啟資料夾');
    }
  }
}

async function handleStartDemo() {
  state.isDemo = true;
  state.rootHandle = null;
  state.demoFiles = createDemoDataset();
  state.undoRecords = [];
  els.resultBanner.classList.add('hidden');
  await runScan();
}

async function runScan() {
  if (state.isDemo) {
    state.scanResult = scanDemoDataset(state.demoFiles, { recursive: state.options.recursive });
  } else if (state.rootHandle) {
    state.scanResult = await scanLocalDirectory(state.rootHandle, { recursive: state.options.recursive });
  } else {
    return;
  }

  recomputePlan();
  showDashboard();
}

function recomputePlan() {
  if (!state.scanResult) return;
  state.planItems = buildOrganizationPlan(state.scanResult, state.rules, state.options);
  renderAll();
}

function showDashboard() {
  els.emptyState.classList.add('hidden');
  els.workspaceBar.classList.remove('hidden');
  els.dashboard.classList.remove('hidden');
}

function renderAll() {
  if (!state.scanResult) return;

  els.modePill.textContent = state.isDemo ? '模擬體驗模式' : '本機授權模式';
  els.folderNameText.textContent = state.scanResult.folderName;
  els.scanTimeText.textContent = `掃描時間：${state.scanResult.scannedAt.toLocaleTimeString('zh-Hant')}`;

  els.undoBtn.classList.toggle('hidden', state.undoRecords.length === 0);
  els.exportLogBtn.classList.toggle('hidden', state.lastLogs.length === 0);

  renderKPIsAndCharts();
  renderRulesList();
  populateCategoryFilter();
  renderPreviewTable();
}

function renderKPIsAndCharts() {
  const files = state.planItems;
  const totalFiles = files.length;
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const toMove = files.filter((f) => f.selected && (f.action === 'move' || f.action === 'rename'));
  const moveSize = toMove.reduce((s, f) => s + f.size, 0);
  const conflicts = files.filter((f) => f.action === 'rename').length;
  const targetFolders = new Set(toMove.map((f) => f.targetFolder));

  els.kpiTotalFiles.textContent = totalFiles.toLocaleString();
  els.kpiTotalFolders.textContent = `含 ${state.scanResult.folderCount} 個子資料夾`;
  els.kpiTotalSize.textContent = formatBytes(totalSize);
  els.kpiAvgSize.textContent = `平均大小 ${formatBytes(totalFiles ? totalSize / totalFiles : 0)}`;
  els.kpiMoveCount.textContent = toMove.length.toLocaleString();
  els.kpiMoveSize.textContent = `預計整理 ${formatBytes(moveSize)}`;
  els.kpiTargetFolders.textContent = targetFolders.size.toLocaleString();
  els.kpiConflictCount.textContent = `${conflicts} 個同名衝突將自動編號`;

  els.executeCount.textContent = toMove.length;
  els.executeBtn.disabled = toMove.length === 0;

  const statMap = new Map();
  for (const item of files) {
    const cat = item.category;
    if (!statMap.has(cat.id)) {
      statMap.set(cat.id, {
        id: cat.id,
        folderName: cat.folderName,
        icon: cat.icon,
        color: cat.color,
        count: 0,
        size: 0,
      });
    }
    const entry = statMap.get(cat.id);
    entry.count += 1;
    entry.size += item.size;
  }

  const stats = Array.from(statMap.values()).sort((a, b) => b.count - a.count);
  renderDonutChart(els.donutChart, els.donutLegend, stats, (catId) => {
    state.filters.category = state.filters.category === catId ? 'all' : catId;
    els.categoryFilter.value = state.filters.category;
    renderPreviewTable();
  });
  renderSizeBarChart(els.sizeBarChart, stats);
}

function renderRulesList() {
  els.rulesList.innerHTML = state.rules
    .map(
      (rule) => `
      <div class="rule-item ${rule.enabled ? '' : 'disabled'}">
        <div class="rule-top">
          <label class="rule-title">
            <input type="checkbox" class="rule-toggle" data-id="${rule.id}" ${rule.enabled ? 'checked' : ''} />
            <span class="rule-color-dot" style="background:${rule.color}"></span>
            <span>${rule.icon} ${escapeHtml(rule.folderName)}</span>
          </label>
          <button class="btn btn-ghost btn-sm rule-edit-btn" data-id="${rule.id}" type="button">編輯</button>
        </div>
        <div class="rule-exts">${rule.extensions.map((e) => '.' + e).join(', ')}</div>
      </div>
    `
    )
    .join('');

  els.rulesList.querySelectorAll('.rule-toggle').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const rule = state.rules.find((r) => r.id === e.target.dataset.id);
      if (rule) {
        rule.enabled = e.target.checked;
        saveRules();
        recomputePlan();
      }
    });
  });

  els.rulesList.querySelectorAll('.rule-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openRuleModal(btn.dataset.id));
  });
}

function populateCategoryFilter() {
  const current = state.filters.category;
  const opts = ['<option value="all">全部分類</option>'];
  for (const r of state.rules) {
    opts.push(`<option value="${r.id}">${r.icon} ${escapeHtml(r.folderName)}</option>`);
  }
  opts.push(`<option value="${OTHER_CATEGORY.id}">${OTHER_CATEGORY.icon} ${OTHER_CATEGORY.folderName}</option>`);
  els.categoryFilter.innerHTML = opts.join('');
  els.categoryFilter.value = current;
}

function getFilteredItems() {
  const q = state.filters.search.trim().toLowerCase();
  return state.planItems.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q) && !item.ext.toLowerCase().includes(q)) {
      return false;
    }
    if (state.filters.category !== 'all' && item.category.id !== state.filters.category) {
      return false;
    }
    if (state.filters.status === 'move' && item.action === 'skip') {
      return false;
    }
    if (state.filters.status === 'skip' && item.action !== 'skip') {
      return false;
    }
    return true;
  });
}

function renderPreviewTable() {
  const filtered = getFilteredItems();
  const movableCount = state.planItems.filter((i) => i.selected && i.action !== 'skip').length;
  els.previewSummaryText.textContent = `顯示 ${filtered.length} / ${state.planItems.length} 個檔案（已勾選待移動 ${movableCount} 個）`;

  if (filtered.length === 0) {
    els.previewTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">沒有符合篩選條件的檔案</td></tr>`;
    return;
  }

  els.previewTableBody.innerHTML = filtered
    .map((item) => {
      const canSelect = item.action !== 'skip';
      const statusBadge =
        item.action === 'move'
          ? '<span class="status-tag status-move">待移動</span>'
          : item.action === 'rename'
            ? `<span class="status-tag status-rename" title="${escapeHtml(item.reason)}">自動編號</span>`
            : `<span class="status-tag status-skip" title="${escapeHtml(item.reason)}">${escapeHtml(item.reason)}</span>`;

      const pathPreview =
        item.action === 'skip'
          ? `<span class="path-preview">${escapeHtml(item.relativePath)}（維持原位）</span>`
          : `<span class="path-preview">${escapeHtml(item.parentPath || '根目錄')}<span class="path-arrow">→</span><strong>${escapeHtml(item.targetFolder)}/${escapeHtml(item.targetName)}</strong></span>`;

      return `
        <tr>
          <td class="col-check">
            <input type="checkbox" class="row-check" data-id="${escapeHtml(item.id)}" ${item.selected ? 'checked' : ''} ${canSelect ? '' : 'disabled'} />
          </td>
          <td class="file-name-cell">
            ${escapeHtml(item.name)}
            ${item.ext ? `<span class="file-ext-pill">.${escapeHtml(item.ext)}</span>` : ''}
          </td>
          <td>${formatBytes(item.size)}</td>
          <td>
            <span class="cat-badge" style="background:${item.category.color}20; color:${item.category.color}">
              ${item.category.icon} ${escapeHtml(item.category.folderName)}
            </span>
          </td>
          <td>${pathPreview}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    })
    .join('');

  els.previewTableBody.querySelectorAll('.row-check').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const target = state.planItems.find((i) => i.id === e.target.dataset.id);
      if (target) {
        target.selected = e.target.checked;
        renderKPIsAndCharts();
        const count = state.planItems.filter((i) => i.selected && i.action !== 'skip').length;
        els.previewSummaryText.textContent = `顯示 ${filtered.length} / ${state.planItems.length} 個檔案（已勾選待移動 ${count} 個）`;
      }
    });
  });
}

async function handleExecute() {
  const queueCount = state.planItems.filter((i) => i.selected && i.action !== 'skip').length;
  if (queueCount === 0) return;

  els.executeBtn.disabled = true;
  els.progressBox.classList.remove('hidden');
  els.resultBanner.classList.add('hidden');

  const result = await executeOrganizationPlan({
    rootHandle: state.rootHandle,
    planItems: state.planItems,
    isDemo: state.isDemo,
    demoFiles: state.demoFiles,
    onProgress: (done, total, currentName) => {
      const pct = total ? Math.round((done / total) * 100) : 100;
      els.progressLabel.textContent = done < total ? `正在移動：${currentName}` : '整理完成！';
      els.progressPercent.textContent = `${pct}%`;
      els.progressFill.style.width = `${pct}%`;
    },
  });

  state.undoRecords = result.undoRecords;
  state.lastLogs = result.logs;

  els.resultBanner.classList.remove('hidden');
  els.resultBannerMsg.textContent = `整理完成！成功移動 ${result.movedCount} 個檔案${result.failedCount ? `，失敗 ${result.failedCount} 個` : ''}。${result.undoRecords.length ? '如需還原，可點擊上方「復原上次整理」。' : ''}`;

  await runScan();
}

async function handleUndo() {
  if (state.undoRecords.length === 0) return;
  els.undoBtn.disabled = true;
  els.progressBox.classList.remove('hidden');

  const res = await undoLastOrganization({
    undoRecords: state.undoRecords,
    demoFiles: state.demoFiles,
    onProgress: (done, total, name) => {
      const pct = total ? Math.round((done / total) * 100) : 100;
      els.progressLabel.textContent = done < total ? `正在復原：${name}` : '復原完成！';
      els.progressPercent.textContent = `${pct}%`;
      els.progressFill.style.width = `${pct}%`;
    },
  });

  state.undoRecords = [];
  els.undoBtn.disabled = false;
  els.resultBanner.classList.remove('hidden');
  els.resultBannerMsg.textContent = `已復原 ${res.restoredCount} 個檔案至原本位置${res.failedCount ? `，失敗 ${res.failedCount} 個` : ''}。`;
  await runScan();
}

function handleExportLogs() {
  if (state.lastLogs.length === 0) return;
  const blob = new Blob([JSON.stringify(state.lastLogs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fileflow-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Modal editing
function openRuleModal(ruleId = null) {
  const existing = ruleId ? state.rules.find((r) => r.id === ruleId) : null;
  els.ruleModalTitle.textContent = existing ? '編輯分類規則' : '新增分類規則';
  els.ruleIdInput.value = existing ? existing.id : '';
  els.ruleIconInput.value = existing ? existing.icon : '📂';
  els.ruleFolderInput.value = existing ? existing.folderName : '';
  els.ruleColorInput.value = existing ? existing.color : '#6366f1';
  els.ruleExtInput.value = existing ? existing.extensions.join(', ') : '';
  els.deleteRuleBtn.classList.toggle('hidden', !existing);
  els.ruleModal.classList.remove('hidden');
}

function closeRuleModal() {
  els.ruleModal.classList.add('hidden');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bindEvents() {
  els.themeToggleBtn.addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme');
    applyTheme(curr === 'dark' ? 'light' : 'dark');
  });

  els.pickFolderBtn.addEventListener('click', handlePickFolder);
  els.emptyPickBtn.addEventListener('click', handlePickFolder);
  els.demoBtn.addEventListener('click', handleStartDemo);
  els.emptyDemoBtn.addEventListener('click', handleStartDemo);
  els.rescanBtn.addEventListener('click', runScan);
  els.executeBtn.addEventListener('click', handleExecute);
  els.undoBtn.addEventListener('click', handleUndo);
  els.exportLogBtn.addEventListener('click', handleExportLogs);

  els.optRecursive.addEventListener('change', async (e) => {
    state.options.recursive = e.target.checked;
    await runScan();
  });
  els.optSkipTargetFolders.addEventListener('change', (e) => {
    state.options.skipTargetFolders = e.target.checked;
    recomputePlan();
  });
  els.optMoveOthers.addEventListener('change', (e) => {
    state.options.moveOthers = e.target.checked;
    recomputePlan();
  });
  els.optConflict.addEventListener('change', (e) => {
    state.options.conflictStrategy = e.target.value;
    recomputePlan();
  });

  els.searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderPreviewTable();
  });
  els.categoryFilter.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    renderPreviewTable();
  });
  els.statusFilter.addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    renderPreviewTable();
  });

  els.selectAllBtn.addEventListener('click', () => {
    for (const item of state.planItems) {
      if (item.action !== 'skip') item.selected = true;
    }
    renderKPIsAndCharts();
    renderPreviewTable();
  });

  els.deselectAllBtn.addEventListener('click', () => {
    for (const item of state.planItems) {
      item.selected = false;
    }
    renderKPIsAndCharts();
    renderPreviewTable();
  });

  els.masterCheckbox.addEventListener('change', (e) => {
    const visible = getFilteredItems();
    const visibleIds = new Set(visible.map((v) => v.id));
    for (const item of state.planItems) {
      if (visibleIds.has(item.id) && item.action !== 'skip') {
        item.selected = e.target.checked;
      }
    }
    renderKPIsAndCharts();
    renderPreviewTable();
  });

  els.addRuleBtn.addEventListener('click', () => openRuleModal(null));
  els.closeModalBtn.addEventListener('click', closeRuleModal);
  els.cancelModalBtn.addEventListener('click', closeRuleModal);

  els.ruleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = els.ruleIdInput.value.trim();
    const icon = els.ruleIconInput.value.trim() || '📁';
    const folderName = els.ruleFolderInput.value.trim();
    const color = els.ruleColorInput.value || '#6366f1';
    const extensions = parseExtensionList(els.ruleExtInput.value);

    if (!folderName || extensions.length === 0) {
      alert('請填寫資料夾名稱與至少一個副檔名');
      return;
    }

    if (id) {
      const rule = state.rules.find((r) => r.id === id);
      if (rule) {
        rule.icon = icon;
        rule.folderName = folderName;
        rule.color = color;
        rule.extensions = extensions;
      }
    } else {
      state.rules.push({
        id: `custom_${Date.now()}`,
        icon,
        folderName,
        color,
        enabled: true,
        extensions,
      });
    }

    saveRules();
    closeRuleModal();
    recomputePlan();
  });

  els.deleteRuleBtn.addEventListener('click', () => {
    const id = els.ruleIdInput.value;
    state.rules = state.rules.filter((r) => r.id !== id);
    saveRules();
    closeRuleModal();
    recomputePlan();
  });
}

initTheme();
initApiStatus();
bindEvents();
