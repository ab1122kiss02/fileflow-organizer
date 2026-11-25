import { matchCategory, OTHER_CATEGORY, splitNameAndExt, getExtension } from './rules.js';

export function isFileSystemApiSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.showDirectoryPicker === 'function';
}

export async function pickLocalDirectory() {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const req = await handle.requestPermission({ mode: 'readwrite' });
    if (req !== 'granted') {
      throw new Error('未取得資料夾讀寫權限，無法進行掃描與整理。');
    }
  }
  return handle;
}

export async function scanLocalDirectory(rootHandle, { recursive = false } = {}) {
  const files = [];
  const existingNamesByFolder = new Map();
  let folderCount = 0;

  // Always inspect top-level subfolders' immediate filenames for accurate conflict checks
  async function collectImmediateNames(dirHandle, folderPath) {
    const names = new Set();
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        names.add(entry.name);
      }
    }
    existingNamesByFolder.set(folderPath, names);
  }

  async function walk(dirHandle, parentPath, isTopLevel) {
    const names = new Set();
    existingNamesByFolder.set(parentPath, names);

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        names.add(entry.name);
        const fileObj = await entry.getFile();
        const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
        const topFolder = parentPath ? parentPath.split('/')[0] : '';
        files.push({
          id: relativePath,
          name: entry.name,
          ext: getExtension(entry.name),
          size: fileObj.size,
          lastModified: fileObj.lastModified,
          parentPath,
          topFolder,
          relativePath,
          parentHandle: dirHandle,
          fileHandle: entry,
        });
      } else if (entry.kind === 'directory') {
        folderCount += 1;
        const subPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
        if (recursive) {
          await walk(entry, subPath, false);
        } else if (isTopLevel) {
          await collectImmediateNames(entry, subPath);
        }
      }
    }
  }

  await walk(rootHandle, '', true);
  return {
    folderName: rootHandle.name,
    files,
    folderCount,
    existingNamesByFolder,
    scannedAt: new Date(),
  };
}

export function createDemoDataset() {
  const sampleSpecs = [
    ['vacation_kyoto.jpg', 3_420_000, ''],
    ['screenshot_2026_11.png', 1_180_000, ''],
    ['brand_logo.svg', 48_000, ''],
    ['portrait_raw.heic', 4_950_000, ''],
    ['Q4_財務報表.xlsx', 860_000, ''],
    ['年度產品簡報.pptx', 6_420_000, ''],
    ['會議紀錄_1125.docx', 245_000, ''],
    ['合約草稿_final.pdf', 1_920_000, ''],
    ['待辦清單.txt', 12_400, ''],
    ['README_notes.md', 8_200, ''],
    ['demo_recording.mp4', 28_500_000, ''],
    ['podcast_ep12.mp3', 14_200_000, ''],
    ['voice_memo.m4a', 3_100_000, ''],
    ['app_bundle.zip', 18_400_000, ''],
    ['backup_assets.7z', 42_100_000, ''],
    ['main.py', 24_600, ''],
    ['dashboard.tsx', 31_200, ''],
    ['config.json', 4_500, ''],
    ['setup_installer.exe', 64_800_000, ''],
    ['hero_banner.fig', 5_700_000, ''],
    ['NotoSans.woff2', 1_450_000, ''],
    ['vacation_kyoto.jpg', 3_420_000, '圖片'],
    ['unknown_data.bin', 512_000, ''],
    ['dataset.csv', 930_000, ''],
  ];

  const now = Date.now();
  return sampleSpecs.map(([name, size, parentPath], idx) => ({
    id: `${parentPath ? parentPath + '/' : ''}${name}#${idx}`,
    name,
    ext: getExtension(name),
    size,
    lastModified: now - idx * 3600_000,
    parentPath,
    topFolder: parentPath ? parentPath.split('/')[0] : '',
    relativePath: parentPath ? `${parentPath}/${name}` : name,
    isDemo: true,
  }));
}

export function scanDemoDataset(demoFiles, { recursive = false } = {}) {
  const existingNamesByFolder = new Map();
  const folderSet = new Set();

  for (const f of demoFiles) {
    if (f.parentPath) {
      folderSet.add(f.parentPath.split('/')[0]);
    }
    if (!existingNamesByFolder.has(f.parentPath)) {
      existingNamesByFolder.set(f.parentPath, new Set());
    }
    existingNamesByFolder.get(f.parentPath).add(f.name);
  }

  const files = recursive ? [...demoFiles] : demoFiles.filter((f) => f.parentPath === '');
  return {
    folderName: '模擬資料夾 (Downloads_Demo)',
    files: files.map((f) => ({ ...f })),
    folderCount: folderSet.size,
    existingNamesByFolder,
    scannedAt: new Date(),
    isDemo: true,
  };
}

export function buildOrganizationPlan(scanResult, rules, options) {
  const {
    skipTargetFolders = true,
    moveOthers = false,
    conflictStrategy = 'rename',
  } = options;

  // Clone sets so dry-run conflict checks never mutate scanResult
  const occupiedByFolder = new Map();
  for (const [folder, set] of scanResult.existingNamesByFolder.entries()) {
    occupiedByFolder.set(folder, new Set(set));
  }

  const items = scanResult.files.map((file) => {
    const category = matchCategory(file.name, rules);
    const isOther = category.id === OTHER_CATEGORY.id;
    const targetFolder = category.folderName;

    if (isOther && !moveOthers) {
      return {
        ...file,
        category,
        targetFolder: file.parentPath,
        targetName: file.name,
        action: 'skip',
        reason: '未勾選移動「其他」類型',
        selected: false,
      };
    }

    if (skipTargetFolders && file.topFolder === targetFolder) {
      return {
        ...file,
        category,
        targetFolder,
        targetName: file.name,
        action: 'skip',
        reason: '已在目標分類資料夾',
        selected: false,
      };
    }

    if (!occupiedByFolder.has(targetFolder)) {
      occupiedByFolder.set(targetFolder, new Set());
    }
    const occupied = occupiedByFolder.get(targetFolder);

    let targetName = file.name;
    let action = 'move';
    let reason = '待移動';

    if (occupied.has(targetName)) {
      if (conflictStrategy === 'skip') {
        return {
          ...file,
          category,
          targetFolder,
          targetName: file.name,
          action: 'skip',
          reason: '目標資料夾已有同名檔案',
          selected: false,
        };
      }

      const { base, ext } = splitNameAndExt(file.name);
      let counter = 1;
      while (occupied.has(`${base} (${counter})${ext}`)) {
        counter += 1;
      }
      targetName = `${base} (${counter})${ext}`;
      action = 'rename';
      reason = '同名衝突自動編號';
    }

    occupied.add(targetName);

    return {
      ...file,
      category,
      targetFolder,
      targetName,
      action,
      reason,
      selected: true,
    };
  });

  return items;
}

async function moveFileHandle(fileHandle, sourceParentHandle, targetDirHandle, targetName) {
  if (typeof fileHandle.move === 'function') {
    try {
      await fileHandle.move(targetDirHandle, targetName);
      return;
    } catch {
      // Fall through to stream copy + remove
    }
  }

  const sourceFile = await fileHandle.getFile();
  const destHandle = await targetDirHandle.getFileHandle(targetName, { create: true });
  const writable = await destHandle.createWritable();
  try {
    await sourceFile.stream().pipeTo(writable);
  } catch (err) {
    try {
      await writable.abort();
    } catch {
      // ignore abort error
    }
    throw err;
  }
  await sourceParentHandle.removeEntry(fileHandle.name);
}

export async function executeOrganizationPlan({
  rootHandle,
  planItems,
  isDemo,
  demoFiles,
  onProgress,
}) {
  const queue = planItems.filter((item) => item.selected && (item.action === 'move' || item.action === 'rename'));
  const dirCache = new Map();
  const undoRecords = [];
  const logs = [];
  let movedCount = 0;
  let failedCount = 0;

  async function getTargetDir(folderName) {
    if (!dirCache.has(folderName)) {
      const handle = await rootHandle.getDirectoryHandle(folderName, { create: true });
      dirCache.set(folderName, handle);
    }
    return dirCache.get(folderName);
  }

  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    onProgress?.(i, queue.length, item.name);

    try {
      if (isDemo) {
        const target = demoFiles.find((f) => f.id === item.id);
        if (target) {
          const prevParentPath = target.parentPath;
          const prevName = target.name;
          target.parentPath = item.targetFolder;
          target.topFolder = item.targetFolder.split('/')[0];
          target.name = item.targetName;
          target.relativePath = `${item.targetFolder}/${item.targetName}`;
          undoRecords.push({
            isDemo: true,
            fileId: target.id,
            prevParentPath,
            prevName,
            movedToPath: target.relativePath,
          });
        }
      } else {
        const targetDirHandle = await getTargetDir(item.targetFolder);
        await moveFileHandle(item.fileHandle, item.parentHandle, targetDirHandle, item.targetName);
        // Re-acquire moved handle for accurate session undo
        const movedHandle = await targetDirHandle.getFileHandle(item.targetName);
        undoRecords.push({
          isDemo: false,
          sourceParentHandle: item.parentHandle,
          originalName: item.name,
          targetDirHandle,
          movedHandle,
          movedName: item.targetName,
          from: item.relativePath,
          to: `${item.targetFolder}/${item.targetName}`,
        });
      }

      movedCount += 1;
      logs.push({
        status: 'success',
        from: item.relativePath,
        to: `${item.targetFolder}/${item.targetName}`,
        category: item.category.folderName,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      failedCount += 1;
      logs.push({
        status: 'error',
        from: item.relativePath,
        to: `${item.targetFolder}/${item.targetName}`,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  onProgress?.(queue.length, queue.length, '完成');
  return { movedCount, failedCount, undoRecords, logs };
}

export async function undoLastOrganization({ undoRecords, demoFiles, onProgress }) {
  let restoredCount = 0;
  let failedCount = 0;

  for (let i = undoRecords.length - 1; i >= 0; i -= 1) {
    const rec = undoRecords[i];
    const step = undoRecords.length - i;
    onProgress?.(step, undoRecords.length, rec.isDemo ? rec.prevName : rec.originalName);

    try {
      if (rec.isDemo) {
        const target = demoFiles.find((f) => f.id === rec.fileId);
        if (target) {
          target.parentPath = rec.prevParentPath;
          target.topFolder = rec.prevParentPath ? rec.prevParentPath.split('/')[0] : '';
          target.name = rec.prevName;
          target.relativePath = rec.prevParentPath ? `${rec.prevParentPath}/${rec.prevName}` : rec.prevName;
        }
      } else {
        await moveFileHandle(rec.movedHandle, rec.targetDirHandle, rec.sourceParentHandle, rec.originalName);
      }
      restoredCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { restoredCount, failedCount };
}
