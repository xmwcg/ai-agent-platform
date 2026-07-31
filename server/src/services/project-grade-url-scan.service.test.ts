import axios from 'axios';
import { AppError } from '../lib/http-error';
import { ProjectGradeUrlScanService } from './project-grade-url-scan.service';

function htmlResponse(overrides: Partial<{ status: number; headers: Record<string, unknown>; data: unknown }> = {}) {
  return {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'self'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'geolocation=()',
      'strict-transport-security': 'max-age=31536000',
    },
    data: Buffer.from(`<!doctype html>
      <html lang="zh-CN"><head>
        <meta charset="utf-8">
        <title>AIbak 项目</title>
        <meta name="description" content="ProjectGrade 快速体检">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="index,follow">
        <meta property="og:title" content="AIbak 项目">
        <meta property="og:description" content="ProjectGrade 快速体检">
        <link rel="canonical" href="https://example.com/">
      </head><body>
        <h1>欢迎</h1><a href="/docs">文档</a>
        <img src="/logo.png" alt="AIbak"><button>开始评估</button>
        <label for="project-name">项目名称</label><input id="project-name">
      </body></html>`),
    ...overrides,
  };
}

describe('ProjectGradeUrlScanService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps external scanning disabled by default and performs no DNS or HTTP work', async () => {
    const lookup = jest.fn(async () => [{ address: '8.8.8.8', family: 4 }]);
    const request = jest.fn(async () => htmlResponse());
    const service = new ProjectGradeUrlScanService({ env: {}, lookup, request });

    await expect(service.scanRegisteredUrl('https://example.com')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED',
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('scans the registered public URL and returns bounded deterministic checks', async () => {
    const lookup = jest.fn(async () => [{ address: '8.8.8.8', family: 4 }]);
    const request = jest.fn(async () => htmlResponse());
    const now = jest.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1085);
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup,
      request,
      now,
    });

    const result = await service.scanRegisteredUrl('https://example.com/#secret');

    expect(result).toMatchObject({
      scanVersion: 'url-quick-scan/0.2.0',
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      statusCode: 200,
      durationMs: 85,
      productionAcceptance: false,
      evidenceScope: 'single_server_http_observation',
      metadata: {
        title: 'AIbak 项目',
        description: 'ProjectGrade 快速体检',
        htmlLang: 'zh-CN',
        h1Count: 1,
      },
      staticSignals: {
        charset: 'utf-8',
        robots: 'index,follow',
        noindex: false,
        openGraphTitle: 'AIbak 项目',
        openGraphDescription: 'ProjectGrade 快速体检',
        images: { total: 1, missingAlt: 0 },
        buttons: { total: 1, missingAccessibleName: 0 },
        formControls: { total: 1, missingAccessibleName: 0 },
      },
      links: { total: 1, empty: 0, invalid: 0, internal: 1, external: 0 },
    });
    expect(result.checks.every((item) => item.status === 'pass')).toBe(true);
    expect(request).toHaveBeenCalledWith(
      new URL('https://example.com/'),
      expect.objectContaining({
        address: { address: '8.8.8.8', family: 4 },
        maxResponseBytes: 2 * 1024 * 1024,
      })
    );
  });


  it('reports bounded static SEO and accessibility markup signals without browser execution', async () => {
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request: async () => htmlResponse({
        data: Buffer.from(`<!doctype html><html><head>
          <meta name="robots" content="noindex,nofollow">
          <title>Static signals</title>
          <meta name="description" content="Static-only inspection">
          <meta name="viewport" content="width=device-width">
          <link rel="canonical" href="https://example.com/">
        </head><body>
          <h1>Static signals</h1>
          <img src="missing.png"><img src="decorative.png" alt="">
          <button></button><button aria-label="保存"></button>
          <label for="named">姓名</label><input id="named">
          <input id="missing-name"><select aria-label="地区"><option>北京</option></select>
          <input type="hidden" value="ignored"><textarea aria-hidden="true"></textarea>
        </body></html>`),
      }),
    });

    const result = await service.scanRegisteredUrl('https://example.com');

    expect(result.staticSignals).toEqual({
      charset: undefined,
      robots: 'noindex,nofollow',
      noindex: true,
      openGraphTitle: undefined,
      openGraphDescription: undefined,
      images: { total: 2, missingAlt: 1 },
      buttons: { total: 2, missingAccessibleName: 1 },
      formControls: { total: 3, missingAccessibleName: 1 },
    });
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'charset', status: 'warning' }),
      expect.objectContaining({ key: 'robots_noindex', status: 'warning' }),
      expect.objectContaining({ key: 'open_graph_title', status: 'warning' }),
      expect.objectContaining({ key: 'open_graph_description', status: 'warning' }),
      expect.objectContaining({ key: 'image_alt', status: 'warning' }),
      expect.objectContaining({ key: 'button_accessible_name', status: 'warning' }),
      expect.objectContaining({ key: 'form_control_accessible_name', status: 'warning' }),
    ]));
    expect(result.note).toContain('静态 HTML 标记');
    expect(result.note).toContain('完整 WCAG');
  });

  it('removes query strings and fragments from returned evidence without changing the request query', async () => {
    const request = jest.fn(async (target: URL) =>
      htmlResponse({
        data: Buffer.from(
          `<html><head><title>Query scan</title><link rel="canonical" href="${target.toString()}#canonical"></head><body><h1>Query scan</h1></body></html>`
        ),
      })
    );
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request,
    });

    const result = await service.scanRegisteredUrl(
      'https://example.com/private?secret-token=abc123#browser-only'
    );

    expect(request.mock.calls[0][0].toString()).toBe(
      'https://example.com/private?secret-token=abc123'
    );
    expect(result.requestedUrl).toBe('https://example.com/private');
    expect(result.finalUrl).toBe('https://example.com/private');
    expect(result.metadata.canonical).toBe('https://example.com/private');
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(result)).not.toContain('abc123');
    expect(JSON.stringify(result)).not.toContain('browser-only');
  });

  it('disables proxy handling and automatic redirects in the default HTTP request', async () => {
    const getSpy = jest.spyOn(axios, 'get').mockResolvedValue(htmlResponse() as any);
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    });

    await service.scanRegisteredUrl('https://example.com');

    expect(getSpy).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({
        proxy: false,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
      })
    );
  });

  it('revalidates DNS after every redirect and blocks redirects to private targets', async () => {
    const lookup = jest
      .fn()
      .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }]);
    const request = jest.fn(async () => ({
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' },
      data: Buffer.alloc(0),
    }));
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup,
      request,
    });

    await expect(service.scanRegisteredUrl('https://example.com')).rejects.toMatchObject({
      statusCode: 422,
      code: 'PROJECT_GRADE_URL_REDIRECT_UNSAFE',
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('revalidates a public redirect and reports missing metadata and headers as warnings', async () => {
    const lookup = jest
      .fn()
      .mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }])
      .mockResolvedValueOnce([{ address: '1.1.1.1', family: 4 }]);
    const request = jest
      .fn()
      .mockResolvedValueOnce({
        status: 301,
        headers: { location: 'https://www.example.com/home' },
        data: Buffer.alloc(0),
      })
      .mockResolvedValueOnce(htmlResponse({
        headers: { 'content-type': 'text/html' },
        data: '<html><body><a href="#">空</a><a href="::bad">错误</a></body></html>',
      }));
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup,
      request,
    });

    const result = await service.scanRegisteredUrl('https://example.com');
    expect(result.redirectChain).toEqual(['https://www.example.com/home']);
    expect(result.finalUrl).toBe('https://www.example.com/home');
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'redirects', status: 'warning' }),
      expect.objectContaining({ key: 'title', status: 'warning' }),
      expect.objectContaining({ key: 'security_headers', status: 'warning' }),
    ]));
  });

  it('sanitizes request failures into a safe application error', async () => {
    const service = new ProjectGradeUrlScanService({
      env: { PROJECT_GRADE_EXTERNAL_SCANNING_ENABLED: 'true' },
      lookup: async () => [{ address: '8.8.8.8', family: 4 }],
      request: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.8:8080 secret-token');
      },
    });

    let caught: unknown;
    try {
      await service.scanRegisteredUrl('https://example.com/private?secret-token=abc123');
    } catch (error) {
      caught = error;
    }

    expect(caught).toEqual(
      expect.objectContaining<Partial<AppError>>({
        statusCode: 502,
        code: 'PROJECT_GRADE_URL_SCAN_FAILED',
        safeMessage: '无法安全读取项目登记网址',
      })
    );
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).message).not.toContain('10.0.0.8');
    expect((caught as AppError).message).not.toContain('secret-token');
    expect((caught as AppError).message).not.toContain('abc123');
  });
});
