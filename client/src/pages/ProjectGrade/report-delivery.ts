export interface BrowserDownloadAnchor {
  href: string;
  download: string;
  rel: string;
  click(): void;
  remove(): void;
}

export interface BrowserDownloadEnvironment {
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  createAnchor(): BrowserDownloadAnchor;
  appendAnchor(anchor: BrowserDownloadAnchor): void;
}

function sanitizeFileName(value: string): string {
  const invalidWindowsCharacters = new Set(['/', '\\', ':', '*', '?', '"', '<', '>', '|']);
  const safeCharacters = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || invalidWindowsCharacters.has(character) ? '-' : character;
  }).join('');
  const normalized = safeCharacters
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 180);
  return normalized || 'AIbak-ProjectGrade-report';
}

export function buildProjectReportPdfFileName(title: string, publicId: string): string {
  const base = sanitizeFileName(`${title}-${publicId}`);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

export function parseAttachmentFileName(contentDisposition?: string): string | null {
  if (!contentDisposition) return null;
  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return sanitizeFileName(decodeURIComponent(encodedMatch[1].trim().replace(/^"|"$/g, '')));
    } catch {
      return null;
    }
  }
  const plainMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i);
  return plainMatch?.[1] ? sanitizeFileName(plainMatch[1]) : null;
}

export function formatReportDeliveryBytes(byteLength: number): string {
  if (!Number.isFinite(byteLength) || byteLength < 0) return '未知';
  if (byteLength < 1024) return `${Math.round(byteLength)} B`;
  if (byteLength < 1024 * 1024) return `${(byteLength / 1024).toFixed(1)} KB`;
  return `${(byteLength / (1024 * 1024)).toFixed(2)} MB`;
}

function browserEnvironment(): BrowserDownloadEnvironment {
  return {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    appendAnchor: (anchor) => document.body.appendChild(anchor as HTMLAnchorElement),
  };
}

export function saveBlobAsDownload(
  blob: Blob,
  fileName: string,
  environment: BrowserDownloadEnvironment = browserEnvironment()
): void {
  const objectUrl = environment.createObjectUrl(blob);
  const anchor = environment.createAnchor();
  anchor.href = objectUrl;
  anchor.download = sanitizeFileName(fileName);
  anchor.rel = 'noopener';
  environment.appendAnchor(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    environment.revokeObjectUrl(objectUrl);
  }
}
