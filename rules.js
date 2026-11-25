export const DEFAULT_RULES = [
  {
    id: 'images',
    icon: '🖼️',
    folderName: '圖片',
    color: '#ec4899',
    enabled: true,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'raw', 'bmp', 'ico', 'tiff', 'avif'],
  },
  {
    id: 'documents',
    icon: '📄',
    folderName: '文件',
    color: '#3b82f6',
    enabled: true,
    extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pages', 'epub'],
  },
  {
    id: 'office',
    icon: '📊',
    folderName: '試算表與簡報',
    color: '#10b981',
    enabled: true,
    extensions: ['xls', 'xlsx', 'csv', 'ppt', 'pptx', 'key', 'numbers', 'ods', 'odp'],
  },
  {
    id: 'videos',
    icon: '🎬',
    folderName: '影片',
    color: '#8b5cf6',
    enabled: true,
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
  },
  {
    id: 'audio',
    icon: '🎵',
    folderName: '音訊',
    color: '#f59e0b',
    enabled: true,
    extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'],
  },
  {
    id: 'code',
    icon: '💻',
    folderName: '程式碼',
    color: '#06b6d4',
    enabled: true,
    extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'php', 'sh', 'bat', 'ps1', 'sql', 'yaml', 'yml', 'xml'],
  },
  {
    id: 'archives',
    icon: '🗜️',
    folderName: '壓縮檔',
    color: '#f97316',
    enabled: true,
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  },
  {
    id: 'installers',
    icon: '📦',
    folderName: '程式與安裝檔',
    color: '#ef4444',
    enabled: true,
    extensions: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk', 'iso'],
  },
  {
    id: 'design',
    icon: '🎨',
    folderName: '設計與字型',
    color: '#a855f7',
    enabled: true,
    extensions: ['psd', 'ai', 'fig', 'sketch', 'xd', 'ttf', 'otf', 'woff', 'woff2'],
  },
];

export const OTHER_CATEGORY = {
  id: 'others',
  icon: '📁',
  folderName: '其他',
  color: '#64748b',
};

export function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function splitNameAndExt(filename) {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0) return { base: filename, ext: '' };
  return {
    base: filename.slice(0, idx),
    ext: filename.slice(idx),
  };
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val >= 10 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

export function matchCategory(filename, rules) {
  const ext = getExtension(filename);
  if (!ext) return OTHER_CATEGORY;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.extensions.includes(ext)) {
      return rule;
    }
  }
  return OTHER_CATEGORY;
}

export function parseExtensionList(raw) {
  return Array.from(
    new Set(
      raw
        .split(/[\s,，;]+/)
        .map((s) => s.trim().replace(/^\./, '').toLowerCase())
        .filter(Boolean)
    )
  );
}
