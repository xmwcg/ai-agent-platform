import axios from 'axios';
import * as cheerio from 'cheerio';
import { AppError } from '../lib/http-error';
import {
  createPinnedNetworkAgents,
  normalizePublicHttpUrl,
  resolvePublicAddresses,
  type PublicAddressLookup,
  type PublicNetworkAddress,
} from '../lib/network-safety';

const PROJECT_GRADE_URL_SCAN_VERSION = 'url-quick-scan/0.2.0';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_METADATA_LENGTH = 500;

export type ProjectGradeUrlCheckStatus = 'pass' | 'warning' | 'fail';

export interface ProjectGradeUrlCheck {
  key: string;
  status: ProjectGradeUrlCheckStatus;
  title: string;
  detail: string;
}

export interface ProjectGradeUrlQuickScanResult {
  scanVersion: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  responseBytes: number;
  durationMs: number;
  redirectChain: string[];
  checks: ProjectGradeUrlCheck[];
  metadata: {
    title?: string;
    description?: string;
    htmlLang?: string;
    canonical?: string;
    viewport?: string;
    h1Count: number;
  };
  staticSignals: {
    charset?: string;
    robots?: string;
    noindex: boolean;
    openGraphTitle?: string;
    openGraphDescription?: string;
    images: {
      total: number;
      missingAlt: number;
    };
    buttons: {
      total: number;
      missingAccessibleName: number;
    };
    formControls: {
      total: number;
      missingAccessibleName: number;
    };
  };
  links: {
    total: number;
    empty: number;
    invalid: number;
    internal: number;
    external: number;
  };
  securityHeaders: {
    present: string[];
    missing: string[];
  };
  evidenceScope: 'single_server_http_observation';
  productionAcceptance: false;
  note: string;
}

interface UrlScanHttpResponse {
  status: number;
  headers: Record<string, unknown>;
  data: unknown;
}

interface UrlScanRequestContext {
  address: PublicNetworkAddress;
  timeoutMs: number;
  maxResponseBytes: number;
}

export type ProjectGradeUrlScanRequest = (
  target: URL,
  context: UrlScanRequestContext
) => Promise<UrlScanHttpResponse>;

export interface ProjectGradeUrlScanServiceOptions {
  env?: NodeJS.ProcessEnv;
  lookup?: PublicAddressLookup;
  request?: ProjectGradeUrlScanRequest;
  now?: () => number;
}

function readHeader(headers: Record<string, unknown>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value === undefined || value === null ? '' : String(value);
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (data === undefined || data === null) return Buffer.alloc(0);
  return Buffer.from(String(data), 'utf8');
}

function cleanText(value: string | undefined, maxLength = MAX_METADATA_LENGTH): string | undefined {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function toEvidenceUrl(target: URL): string {
  const safe = new URL(target.toString());
  safe.username = '';
  safe.password = '';
  safe.search = '';
  safe.hash = '';
  return safe.toString();
}

function cleanCanonicalUrl(value: string | undefined, baseUrl: URL): string | undefined {
  const normalized = cleanText(value);
  if (!normalized) return undefined;
  try {
    const canonical = new URL(normalized, baseUrl);
    if (!['http:', 'https:'].includes(canonical.protocol) || canonical.username || canonical.password) {
      return undefined;
    }
    return toEvidenceUrl(canonical).slice(0, MAX_METADATA_LENGTH);
  } catch {
    return undefined;
  }
}

function check(
  key: string,
  status: ProjectGradeUrlCheckStatus,
  title: string,
  detail: string
): ProjectGradeUrlCheck {
  return { key, status, title, detail };
}

function parseTimeoutMs(env: NodeJS.ProcessEnv): number {
  const parsed = Number(env.PROJECT_GRADE_URL_SCAN_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.trunc(parsed), 1_000), MAX_TIMEOUT_MS);
}

export function isProjectGradeExternalScanningEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED || '').trim().toLowerCase() === 'true';
}

async function defaultRequest(target: URL, context: UrlScanRequestContext): Promise<UrlScanHttpResponse> {
  const agents = createPinnedNetworkAgents(context.address);
  try {
    const response = await axios.get(target.toString(), {
      timeout: context.timeoutMs,
      maxRedirects: 0,
      maxContentLength: context.maxResponseBytes,
      maxBodyLength: context.maxResponseBytes,
      responseType: 'arraybuffer',
      decompress: true,
      httpAgent: agents.httpAgent,
      httpsAgent: agents.httpsAgent,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'User-Agent': 'AIbak-ProjectGrade/0.1 (+https://aibak.site/project-grade)',
      },
      validateStatus: () => true,
      proxy: false,
    });
    return {
      status: response.status,
      headers: response.headers as Record<string, unknown>,
      data: response.data,
    };
  } finally {
    agents.destroy();
  }
}

function analyzeHtml(html: string, finalUrl: URL) {
  const $ = cheerio.load(html);
  const title = cleanText($('title').first().text(), 300);
  const description = cleanText($('meta[name="description"]').first().attr('content'));
  const htmlLang = cleanText($('html').first().attr('lang'), 50);
  const canonical = cleanCanonicalUrl($('link[rel~="canonical"]').first().attr('href'), finalUrl);
  const viewport = cleanText($('meta[name="viewport"]').first().attr('content'));
  const h1Count = $('h1').length;
  let charset: string | undefined;
  let robots: string | undefined;
  let openGraphTitle: string | undefined;
  let openGraphDescription: string | undefined;

  $('meta').each((_index, element) => {
    const meta = $(element);
    const declaredCharset = cleanText(meta.attr('charset'), 100);
    if (!charset && declaredCharset) charset = declaredCharset;

    const name = String(meta.attr('name') || '').trim().toLowerCase();
    const property = String(meta.attr('property') || '').trim().toLowerCase();
    const httpEquiv = String(meta.attr('http-equiv') || '').trim().toLowerCase();
    const content = cleanText(meta.attr('content'));
    if (!charset && httpEquiv === 'content-type' && content) {
      charset = cleanText(/charset\s*=\s*["']?([^;"'\s]+)/i.exec(content)?.[1], 100);
    }
    if (!robots && name === 'robots') robots = content;
    if (!openGraphTitle && (property === 'og:title' || name === 'og:title')) {
      openGraphTitle = cleanText(content, 300);
    }
    if (!openGraphDescription && (property === 'og:description' || name === 'og:description')) {
      openGraphDescription = content;
    }
  });

  const hasAriaName = (element: any): boolean => {
    const node = $(element);
    if (cleanText(node.attr('aria-label'), 300)) return true;
    const labelledBy = String(node.attr('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
    return labelledBy.some((id) => {
      const labelNode = $('[id]').filter((_index, candidate) => $(candidate).attr('id') === id).first();
      return Boolean(cleanText(labelNode.text(), 300) || cleanText(labelNode.attr('aria-label'), 300));
    });
  };
  const isMarkupHidden = (element: any): boolean => {
    const node = $(element);
    return node.is('[hidden], [aria-hidden="true"]')
      || node.parents('[hidden], [aria-hidden="true"]').length > 0;
  };
  const hasButtonName = (element: any): boolean => {
    const node = $(element);
    return hasAriaName(element)
      || Boolean(cleanText(node.text(), 300))
      || Boolean(cleanText(node.attr('title'), 300))
      || node.find('img[alt]').toArray().some((image) => Boolean(cleanText($(image).attr('alt'), 300)));
  };
  const hasFormControlName = (element: any): boolean => {
    const node = $(element);
    if (hasAriaName(element) || cleanText(node.attr('title'), 300)) return true;
    const id = String(node.attr('id') || '').trim();
    if (id) {
      const explicitLabel = $('label[for]').filter((_index, label) => $(label).attr('for') === id).first();
      if (cleanText(explicitLabel.text(), 300)) return true;
    }
    return node.parents('label').toArray().some((label) => Boolean(cleanText($(label).text(), 300)));
  };

  const staticSignals: ProjectGradeUrlQuickScanResult['staticSignals'] = {
    charset,
    robots,
    noindex: /(?:^|[,\s])noindex(?:$|[,\s])/i.test(robots || ''),
    openGraphTitle,
    openGraphDescription,
    images: { total: 0, missingAlt: 0 },
    buttons: { total: 0, missingAccessibleName: 0 },
    formControls: { total: 0, missingAccessibleName: 0 },
  };

  $('img').each((_index, element) => {
    if (isMarkupHidden(element)) return;
    staticSignals.images.total += 1;
    if ($(element).attr('alt') === undefined) staticSignals.images.missingAlt += 1;
  });
  $('button, [role="button"]').each((_index, element) => {
    if (isMarkupHidden(element)) return;
    staticSignals.buttons.total += 1;
    if (!hasButtonName(element)) staticSignals.buttons.missingAccessibleName += 1;
  });
  $('input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), select, textarea').each((_index, element) => {
    if (isMarkupHidden(element)) return;
    staticSignals.formControls.total += 1;
    if (!hasFormControlName(element)) staticSignals.formControls.missingAccessibleName += 1;
  });

  const links = { total: 0, empty: 0, invalid: 0, internal: 0, external: 0 };

  $('a').each((_index, element) => {
    links.total += 1;
    const href = String($(element).attr('href') || '').trim();
    if (!href || href === '#' || href.toLowerCase().startsWith('javascript:')) {
      links.empty += 1;
      return;
    }
    if (/^(mailto:|tel:)/i.test(href)) return;
    try {
      const resolved = new URL(href, finalUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        links.invalid += 1;
      } else if (resolved.origin === finalUrl.origin) {
        links.internal += 1;
      } else {
        links.external += 1;
      }
    } catch {
      links.invalid += 1;
    }
  });

  return {
    metadata: { title, description, htmlLang, canonical, viewport, h1Count },
    staticSignals,
    links,
  };
}

function createChecks(input: {
  finalUrl: URL;
  statusCode: number;
  contentType: string;
  responseBytes: number;
  redirectChain: string[];
  metadata: ProjectGradeUrlQuickScanResult['metadata'];
  staticSignals: ProjectGradeUrlQuickScanResult['staticSignals'];
  links: ProjectGradeUrlQuickScanResult['links'];
  missingSecurityHeaders: string[];
}): ProjectGradeUrlCheck[] {
  const {
    finalUrl,
    statusCode,
    contentType,
    responseBytes,
    redirectChain,
    metadata,
    staticSignals,
    links,
  } = input;
  const isHtml = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
  return [
    check(
      'http_status',
      statusCode >= 200 && statusCode < 300 ? 'pass' : statusCode >= 400 ? 'fail' : 'warning',
      'HTTP 状态',
      `最终响应为 HTTP ${statusCode}`
    ),
    check(
      'https',
      finalUrl.protocol === 'https:' ? 'pass' : 'fail',
      'HTTPS',
      finalUrl.protocol === 'https:' ? '最终地址使用 HTTPS' : '最终地址未使用 HTTPS'
    ),
    check(
      'content_type',
      isHtml ? 'pass' : 'warning',
      'HTML 内容类型',
      contentType || '响应未声明 Content-Type'
    ),
    check(
      'response_size',
      responseBytes <= 1024 * 1024 ? 'pass' : 'warning',
      '响应体大小',
      `读取 ${responseBytes} 字节，上限 ${MAX_RESPONSE_BYTES} 字节`
    ),
    check(
      'redirects',
      redirectChain.length === 0 ? 'pass' : 'warning',
      '重定向',
      redirectChain.length === 0 ? '未发生重定向' : `安全跟随 ${redirectChain.length} 次重定向`
    ),
    check('title', metadata.title ? 'pass' : 'warning', '页面标题', metadata.title || '未检测到 title'),
    check(
      'meta_description',
      metadata.description ? 'pass' : 'warning',
      '页面描述',
      metadata.description || '未检测到 meta description'
    ),
    check('html_lang', metadata.htmlLang ? 'pass' : 'warning', '页面语言', metadata.htmlLang || '未设置 html lang'),
    check('viewport', metadata.viewport ? 'pass' : 'warning', '移动端视口', metadata.viewport || '未设置 viewport'),
    check('canonical', metadata.canonical ? 'pass' : 'warning', '规范链接', metadata.canonical || '未设置 canonical'),
    check('charset', staticSignals.charset ? 'pass' : 'warning', '文档字符集', staticSignals.charset || '未声明 meta charset'),
    check(
      'robots_noindex',
      staticSignals.noindex ? 'warning' : 'pass',
      '搜索引擎索引指令',
      staticSignals.noindex
        ? `检测到 noindex：${staticSignals.robots || 'robots meta'}`
        : staticSignals.robots || '未声明 robots，静态标记未禁止索引'
    ),
    check(
      'open_graph_title',
      staticSignals.openGraphTitle ? 'pass' : 'warning',
      'Open Graph 标题',
      staticSignals.openGraphTitle || '未检测到 og:title'
    ),
    check(
      'open_graph_description',
      staticSignals.openGraphDescription ? 'pass' : 'warning',
      'Open Graph 描述',
      staticSignals.openGraphDescription || '未检测到 og:description'
    ),
    check(
      'image_alt',
      staticSignals.images.missingAlt === 0 ? 'pass' : 'warning',
      '图片 alt 属性',
      `可见静态图片 ${staticSignals.images.total} 个，缺少 alt 属性 ${staticSignals.images.missingAlt} 个`
    ),
    check(
      'button_accessible_name',
      staticSignals.buttons.missingAccessibleName === 0 ? 'pass' : 'warning',
      '按钮可访问名称',
      `可见静态按钮 ${staticSignals.buttons.total} 个，缺少可访问名称 ${staticSignals.buttons.missingAccessibleName} 个`
    ),
    check(
      'form_control_accessible_name',
      staticSignals.formControls.missingAccessibleName === 0 ? 'pass' : 'warning',
      '表单控件名称',
      `非隐藏静态表单控件 ${staticSignals.formControls.total} 个，缺少 label/ARIA 名称 ${staticSignals.formControls.missingAccessibleName} 个`
    ),
    check(
      'h1_count',
      metadata.h1Count === 1 ? 'pass' : 'warning',
      'H1 数量',
      `检测到 ${metadata.h1Count} 个 H1`
    ),
    check(
      'link_markup',
      links.empty === 0 && links.invalid === 0 ? 'pass' : 'warning',
      '链接标记',
      `共 ${links.total} 个链接，空链接 ${links.empty} 个，无效链接 ${links.invalid} 个`
    ),
    check(
      'security_headers',
      input.missingSecurityHeaders.length === 0 ? 'pass' : 'warning',
      '基础安全响应头',
      input.missingSecurityHeaders.length === 0
        ? '基础安全响应头齐全'
        : `缺少：${input.missingSecurityHeaders.join(', ')}`
    ),
  ];
}

export class ProjectGradeUrlScanService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly lookup?: PublicAddressLookup;
  private readonly request: ProjectGradeUrlScanRequest;
  private readonly now: () => number;

  constructor(options: ProjectGradeUrlScanServiceOptions = {}) {
    this.env = options.env || process.env;
    this.lookup = options.lookup;
    this.request = options.request || defaultRequest;
    this.now = options.now || Date.now;
  }

  /** 已登录项目扫描：目标地址只能来自项目登记信息。 */
  async scanRegisteredUrl(projectUrl: string): Promise<ProjectGradeUrlQuickScanResult> {
    return this.scanUrl(projectUrl, '项目登记网址');
  }

  /** 匿名获客体验：不持久化、不写入项目或最终评分。 */
  async scanPublicUrl(targetUrl: string): Promise<ProjectGradeUrlQuickScanResult> {
    return this.scanUrl(targetUrl, '目标网址');
  }

  private async scanUrl(
    targetUrl: string,
    targetLabel: string
  ): Promise<ProjectGradeUrlQuickScanResult> {
    if (!isProjectGradeExternalScanningEnabled(this.env)) {
      throw new AppError(
        503,
        'ProjectGrade 网址快速体检当前未启用',
        'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED'
      );
    }

    const startedAt = this.now();
    const timeoutMs = parseTimeoutMs(this.env);
    let current: URL;
    try {
      current = normalizePublicHttpUrl(targetUrl);
    } catch (error) {
      throw new AppError(
        422,
        `${targetLabel}不在允许的公网范围内`,
        'PROJECT_GRADE_URL_UNSAFE',
        error instanceof Error ? error.message : String(error)
      );
    }

    const requestedUrl = toEvidenceUrl(current);
    const redirectChain: string[] = [];
    let response: UrlScanHttpResponse | undefined;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      let addresses: PublicNetworkAddress[];
      try {
        addresses = await resolvePublicAddresses(current.hostname, this.lookup);
      } catch (error) {
        throw new AppError(
          422,
          `${targetLabel}不在允许的公网范围内`,
          'PROJECT_GRADE_URL_UNSAFE',
          error instanceof Error ? error.message : String(error)
        );
      }

      try {
        response = await this.request(current, {
          address: addresses[0],
          timeoutMs,
          maxResponseBytes: MAX_RESPONSE_BYTES,
        });
      } catch (error: any) {
        const code = String(error?.code || '');
        const message = String(error?.message || '');
        if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
          throw new AppError(504, '网址体检请求超时', 'PROJECT_GRADE_URL_SCAN_TIMEOUT');
        }
        if (/maxContentLength|max response size|too large/i.test(message)) {
          throw new AppError(413, '目标页面响应超过 2MB 安全上限', 'PROJECT_GRADE_URL_RESPONSE_TOO_LARGE');
        }
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        throw new AppError(
          502,
          `无法安全读取${targetLabel}`,
          'PROJECT_GRADE_URL_SCAN_FAILED',
          `URL scan request failed (${code || errorName})`
        );
      }

      if (response.status < 300 || response.status >= 400) break;
      const location = readHeader(response.headers, 'location');
      if (!location) {
        throw new AppError(502, '目标网址返回无效重定向', 'PROJECT_GRADE_URL_REDIRECT_INVALID');
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new AppError(502, '目标网址重定向次数超过安全上限', 'PROJECT_GRADE_URL_REDIRECT_LIMIT');
      }
      try {
        current = normalizePublicHttpUrl(new URL(location, current));
      } catch (error) {
        throw new AppError(
          422,
          '目标网址重定向到不安全地址',
          'PROJECT_GRADE_URL_REDIRECT_UNSAFE',
          error instanceof Error ? error.message : String(error)
        );
      }
      redirectChain.push(toEvidenceUrl(current));
    }

    if (!response) {
      throw new AppError(502, '网址体检未取得响应', 'PROJECT_GRADE_URL_SCAN_FAILED');
    }

    const body = toBuffer(response.data);
    if (body.byteLength > MAX_RESPONSE_BYTES) {
      throw new AppError(413, '目标页面响应超过 2MB 安全上限', 'PROJECT_GRADE_URL_RESPONSE_TOO_LARGE');
    }
    const contentType = readHeader(response.headers, 'content-type').slice(0, 200);
    const isHtml = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);
    const analyzed = isHtml
      ? analyzeHtml(body.toString('utf8'), current)
      : {
          metadata: { h1Count: 0 },
          staticSignals: {
            noindex: false,
            images: { total: 0, missingAlt: 0 },
            buttons: { total: 0, missingAccessibleName: 0 },
            formControls: { total: 0, missingAccessibleName: 0 },
          },
          links: { total: 0, empty: 0, invalid: 0, internal: 0, external: 0 },
        };

    const securityHeaderNames = [
      'content-security-policy',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
      ...(current.protocol === 'https:' ? ['strict-transport-security'] : []),
    ];
    const present = securityHeaderNames.filter((name) => Boolean(readHeader(response!.headers, name)));
    const missing = securityHeaderNames.filter((name) => !present.includes(name));
    const checks = createChecks({
      finalUrl: current,
      statusCode: response.status,
      contentType,
      responseBytes: body.byteLength,
      redirectChain,
      metadata: analyzed.metadata,
      staticSignals: analyzed.staticSignals,
      links: analyzed.links,
      missingSecurityHeaders: missing,
    });

    return {
      scanVersion: PROJECT_GRADE_URL_SCAN_VERSION,
      requestedUrl,
      finalUrl: toEvidenceUrl(current),
      statusCode: response.status,
      contentType,
      responseBytes: body.byteLength,
      durationMs: Math.max(0, this.now() - startedAt),
      redirectChain,
      checks,
      metadata: analyzed.metadata,
      staticSignals: analyzed.staticSignals,
      links: analyzed.links,
      securityHeaders: { present, missing },
      evidenceScope: 'single_server_http_observation',
      productionAcceptance: false,
      note: '该结果仅代表本次服务端 HTTP 与静态 HTML 标记观察，不执行 JavaScript、计算样式、完整 WCAG、Lighthouse、真实浏览器或生产链路验收。',
    };
  }
}

export const projectGradeUrlScanService = new ProjectGradeUrlScanService();
