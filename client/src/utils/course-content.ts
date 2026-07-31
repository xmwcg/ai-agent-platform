import DOMPurify from 'dompurify';

export type CourseResourceType = 'video' | 'article' | 'code' | 'pdf' | 'link' | 'file';

const HTML_CONTENT_PATTERN = /^\s*<\/?(?:h[1-6]|p|ul|ol|blockquote|pre|div|hr|table|section|article|strong|em|a|br)\b/i;
const ALLOWED_TAGS = [
  'a', 'article', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'li', 'ol', 'p', 'pre', 'section', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function renderCourseMarkdown(content: string): string {
  const escaped = escapeHtml(content.replace(/\r\n?/g, '\n'));
  const codeBlocks: string[] = [];
  const withCodeTokens = escaped.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_match, language: string, code: string) => {
    const index = codeBlocks.push(
      `<div class="course-code-block"><div class="course-code-language">${language || 'code'}</div><pre><code>${code}</code></pre></div>`,
    ) - 1;
    return `__COURSE_CODE_${index}__`;
  });

  const lines = withCodeTokens.split('\n');
  const html: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeToken = line.match(/^__COURSE_CODE_(\d+)__$/);
    if (codeToken) {
      html.push(codeBlocks[Number(codeToken[1])]);
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${renderInlineMarkdown(lines[index].replace(/^[-*+]\s+/, ''))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${renderInlineMarkdown(lines[index].replace(/^\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      html.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quotes: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quotes.push(renderInlineMarkdown(lines[index].replace(/^>\s?/, '')));
        index += 1;
      }
      html.push(`<blockquote>${quotes.join('<br>')}</blockquote>`);
      continue;
    }

    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
    index += 1;
  }

  return html.join('');
}

function sanitizeCourseHtml(content: string): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return renderCourseMarkdown(content);
  }

  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math'],
  });
  const parsed = new window.DOMParser().parseFromString(sanitized, 'text/html');
  parsed.querySelectorAll('a').forEach((anchor) => {
    const safeUrl = resolveCourseResourceUrl(anchor.getAttribute('href'));
    if (!safeUrl) {
      anchor.removeAttribute('href');
      return;
    }
    anchor.setAttribute('href', safeUrl);
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  });
  return parsed.body.innerHTML;
}

export function renderCourseContent(content?: string): string {
  if (!content) return '';
  return HTML_CONTENT_PATTERN.test(content) ? sanitizeCourseHtml(content) : renderCourseMarkdown(content);
}

export function resolveCourseResourceUrl(rawUrl?: string | null, origin = 'https://aibak.site'): string | null {
  const value = rawUrl?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value, origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getCourseResourceLabel(type: CourseResourceType): string {
  return ({
    video: '视频',
    article: '文章',
    code: '代码',
    pdf: 'PDF',
    link: '链接',
    file: '文件',
  } satisfies Record<CourseResourceType, string>)[type];
}
