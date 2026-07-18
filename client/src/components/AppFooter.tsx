import { useNavigate } from "react-router-dom";
import { Typography } from "antd";
import {
  ThunderboltOutlined, WechatOutlined, MailOutlined, GlobalOutlined, LinkOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

const BRAND = "AIbak";
const BRAND_SLOGAN = "打造您的全站 AI 应用平台";
const SITE_URL = "https://aibak.site";
const CONTACT_EMAIL = "contact@aibak.site";

// 页脚导航分组
const FOOTER_GROUPS: { title: string; links: { label: string; path: string; external?: boolean }[] }[] = [
  {
    title: "产品",
    links: [
      { label: "平台介绍", path: "/about" },
      { label: "AI 对话", path: "/ai-chat" },
      { label: "通用知识库", path: "/knowledge" },
      { label: "智能工具箱", path: "/tools" },
      { label: "会员升级", path: "/pricing" },
    ],
  },
  {
    title: "服务",
    links: [
      { label: "本站查询", path: "/query-center" },
      { label: "积分中心", path: "/points-center" },
      { label: "模型配置", path: "/model-config" },
      { label: "联系我们", path: "/contact" },
      { label: "合作伙伴", path: "/partners" },
    ],
  },
  {
    title: "法律与合规",
    links: [
      { label: "服务条款", path: "/terms" },
      { label: "隐私政策", path: "/privacy" },
      { label: "退款政策", path: "/refund-policy" },
      { label: "积分规则", path: "/points-rules" },
      { label: "Cookies 政策", path: "/cookies" },
    ],
  },
];

// 友情链接
const FRIENDLY_LINKS: { label: string; url: string }[] = [
  { label: "腾讯云 CloudBase", url: "https://www.cloudbase.net" },
  { label: "腾讯混元大模型", url: "https://hunyuan.tencent.com" },
  { label: "DeepSeek", url: "https://www.deepseek.com" },
  { label: "微信开放平台", url: "https://open.weixin.qq.com" },
];

export default function AppFooter() {
  const navigate = useNavigate();

  const go = (path: string, external?: boolean) => {
    if (external) window.open(path, "_blank", "noopener,noreferrer");
    else { navigate(path); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  return (
    <footer
      style={{
        marginTop: 24,
        background: "var(--bg-container)",
        border: "1px solid var(--border-light)",
        borderRadius: 16,
        padding: "32px 28px 20px",
      }}
    >
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 32,
        justifyContent: "space-between",
      }}>
        {/* 品牌区 */}
        <div style={{ maxWidth: 320, minWidth: 240 }}>
          <div
            onClick={() => go(SITE_URL, true)}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(108,92,231,0.3)",
            }}>
              <ThunderboltOutlined style={{ color: "#fff", fontSize: 17 }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
                {BRAND}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{BRAND_SLOGAN}</div>
            </div>
          </div>
          <Text style={{ fontSize: 13, color: "var(--text-secondary)", display: "block", lineHeight: 1.7 }}>
            一站式智能生产力平台 —— 知识管理 · AI 对话 · 智能工具 · 团队协作 · API 变现。
          </Text>
          <div style={{ display: "flex", gap: 14, marginTop: 14, alignItems: "center", color: "var(--text-secondary)", fontSize: 13, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }} onClick={() => go(SITE_URL, true)}>
              <GlobalOutlined /> aibak.site
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MailOutlined /> {CONTACT_EMAIL}
            </span>
          </div>
        </div>

        {/* 导航分组 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, flex: 1, justifyContent: "flex-start" }}>
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title} style={{ minWidth: 110 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                {group.title}
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <span
                      onClick={() => go(link.path, link.external)}
                      style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", transition: "color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                    >
                      {link.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 微信二维码 */}
        <div style={{ textAlign: "center", minWidth: 130 }}>
          <div style={{
            width: 120, height: 120, borderRadius: 12,
            border: "1px solid var(--border)", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#fff",
          }}>
            <img
              src="/wechat-qr-placeholder.svg"
              alt="微信二维码"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <WechatOutlined style={{ color: "#07c160" }} /> 扫码联系我们
          </div>
        </div>
      </div>

      {/* 友情链接 */}
      <div style={{
        marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border-light)",
        display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginRight: 4 }}>
          友情链接
        </span>
        {FRIENDLY_LINKS.map((l) => (
          <span
            key={l.label}
            onClick={() => window.open(l.url, "_blank", "noopener,noreferrer")}
            style={{
              fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 10px", borderRadius: 8,
              border: "1px solid var(--border-light)", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--brand-primary)";
              e.currentTarget.style.borderColor = "var(--brand-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.borderColor = "var(--border-light)";
            }}
          >
            <LinkOutlined style={{ fontSize: 11 }} /> {l.label}
          </span>
        ))}
      </div>

      {/* 版权栏 */}
      <div style={{
        marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-light)",
        display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center",
      }}>
        <Text style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {"©"} {new Date().getFullYear()} {BRAND} · {BRAND_SLOGAN} · All rights reserved.
        </Text>
        <Text style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          经营主体信息详见 <a href="/about" style={{ color: "var(--text-tertiary)" }}>平台介绍</a>
        </Text>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "服务条款", path: "/terms" },
            { label: "隐私政策", path: "/privacy" },
            { label: "退款政策", path: "/refund-policy" },
            { label: "积分规则", path: "/points-rules" },
            { label: "Cookies 政策", path: "/cookies" },
            { label: "联系我们", path: "/contact" },
          ].map((l) => (
            <span key={l.label}
              onClick={() => go(l.path)}
              style={{ fontSize: 12, color: "var(--text-tertiary)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
            >
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}