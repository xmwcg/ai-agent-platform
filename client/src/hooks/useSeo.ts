import { useEffect } from 'react';

/**
 * SPA 每页独立 SEO：动态设置 document.title 与 meta description。
 * 配合 index.html 的 JSON-LD（WebSite/SoftwareApplication）与 sitemap，
 * 让爬虫为每个路由获得独立 meta，提升收录与分享卡片质量。
 */
export function useSeo(title?: string, description?: string) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
  }, [title, description]);
}

export default useSeo;
