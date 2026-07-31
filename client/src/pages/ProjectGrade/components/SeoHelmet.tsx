import { useEffect } from 'react';

/**
 * 轻量级 SEO meta 标签管理：避免对 react-helmet-async 的依赖，
 * 适用于公开 Landing / 公开评分报告等需要搜索引擎索引的页面。
 *
 * 用法：
 *   <SeoHelmet
 *     title="页面标题"
 *     description="页面描述"
 *     url="https://aibak.site/path"
 *     schemaJsonLd={object}
 *   />
 */
export interface SeoHelmetProps {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  type?: 'website' | 'article';
  schemaJsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(name: string, content: string, isProperty = false) {
  if (typeof document === 'undefined') return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setTitle(title: string) {
  if (typeof document !== 'undefined') document.title = title;
}

function upsertJsonLd(jsonLd: Record<string, unknown> | Record<string, unknown>[]) {
  if (typeof document === 'undefined') return;
  const id = 'pg-jsonld';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    (el as HTMLScriptElement).type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(jsonLd);
}

export const SeoHelmet: React.FC<SeoHelmetProps> = ({
  title,
  description,
  url,
  image,
  type = 'website',
  schemaJsonLd,
}) => {
  useEffect(() => {
    if (title) setTitle(title);
    if (description) {
      upsertMeta('description', description);
      upsertMeta('og:description', description, true);
      upsertMeta('twitter:description', description);
    }
    if (title) {
      upsertMeta('og:title', title, true);
      upsertMeta('twitter:title', title);
    }
    if (url) {
      upsertMeta('og:url', url, true);
      upsertLink('canonical', url);
    }
    if (image) {
      upsertMeta('og:image', image, true);
      upsertMeta('twitter:image', image);
    }
    upsertMeta('og:type', type, true);
    upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary');

    if (schemaJsonLd) {
      upsertJsonLd(schemaJsonLd);
    }
  }, [title, description, url, image, type, JSON.stringify(schemaJsonLd ?? null)]);

  return null;
};

export default SeoHelmet;