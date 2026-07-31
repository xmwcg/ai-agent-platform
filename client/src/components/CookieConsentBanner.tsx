import { useState, useEffect } from "react";
import { Button, Space, Checkbox } from "antd";
import { useNavigate } from "react-router-dom";

interface CookiePreferences {
  necessary: boolean; // always true
  functional: boolean;
  analytics: boolean;
  preferences: boolean;
}

const STORAGE_KEY = "aibak_cookie_prefs";
const COOKIE_BANNER_DISMISSED = "aibak_cookie_dismissed";

function getSavedPrefs(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return null;
  } catch {
    return null;
  }
}

function savePrefs(prefs: CookiePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  localStorage.setItem(COOKIE_BANNER_DISMISSED, "true");
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({
    necessary: true,
    functional: true,
    analytics: false,
    preferences: true,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const saved = getSavedPrefs();
    const dismissed = localStorage.getItem(COOKIE_BANNER_DISMISSED);
    if (!saved && !dismissed) {
      setTimeout(() => setVisible(true), 600);
    }
  }, []);

  const handleAcceptAll = () => {
    const all: CookiePreferences = { necessary: true, functional: true, analytics: true, preferences: true };
    savePrefs(all);
    setVisible(false);
  };

  const handleAcceptSelected = () => {
    savePrefs({ ...prefs, necessary: true });
    setVisible(false);
  };

  const handleRejectNonEssential = () => {
    const onlyNecessary: CookiePreferences = { necessary: true, functional: false, analytics: false, preferences: false };
    savePrefs(onlyNecessary);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1050,
        background: "var(--bg-container, #fff)",
        borderTop: "1px solid var(--border-light, #e8e8e8)",
        boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
        padding: "18px 28px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 12, lineHeight: 1.7 }}>
          <strong>Cookie 使用说明</strong>：本网站使用 Cookie 和 localStorage 来维持登录状态、记住偏好和统计分析。
          您可以选择接受或拒绝非必要 Cookie。必要 Cookie 用于保障网站基本功能，无法关闭。
          详情请参阅 <a href="/cookies" onClick={(e) => { e.preventDefault(); navigate("/cookies"); }}>Cookies 政策</a>。
        </p>

        <div style={{ marginBottom: 12 }}>
          <Space direction="vertical" size={4}>
            <Checkbox checked={true} disabled>
              必要 Cookie — 维持登录状态、保障安全（不可关闭）
            </Checkbox>
            <Checkbox checked={prefs.functional} onChange={(e) => setPrefs((p) => ({ ...p, functional: e.target.checked }))}>
              功能 Cookie — 记住主题、语言、界面设置
            </Checkbox>
            <Checkbox checked={prefs.analytics} onChange={(e) => setPrefs((p) => ({ ...p, analytics: e.target.checked }))}>
              分析 Cookie — 统计访问量，用于优化产品
            </Checkbox>
            <Checkbox checked={prefs.preferences} onChange={(e) => setPrefs((p) => ({ ...p, preferences: e.target.checked }))}>
              偏好 Cookie — 记录常用模型和个性化配置
            </Checkbox>
          </Space>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button size="small" onClick={handleRejectNonEssential}>
            仅必要 Cookie
          </Button>
          <Button size="small" onClick={handleAcceptSelected}>
            保存选择
          </Button>
          <Button size="small" type="primary" onClick={handleAcceptAll}>
            全部接受
          </Button>
        </div>
      </div>
    </div>
  );
}