import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from 'antd';
import {
  VerticalAlignTopOutlined, HomeFilled,
  UpOutlined, DownOutlined, WechatOutlined,
} from '@ant-design/icons';

/**
 * 右下角全局悬浮工具条
 * - 返回顶部
 * - 返回首页
 * - 向上翻页 / 向下翻页
 * 使用 window 滚动（本项目内容区随文档滚动）。
 */

const ACCENT = '#6c5ce7';
const ACCENT_LIGHT = '#a29bfe';

function getScrollTop(): number {
  return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function getMaxScroll(): number {
  const doc = document.documentElement;
  return Math.max(
    document.body.scrollHeight, doc.scrollHeight,
    document.body.offsetHeight, doc.offsetHeight,
    document.body.clientHeight, doc.clientHeight,
  ) - window.innerHeight;
}

export default function ScrollFab() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrollTop, setScrollTop] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  const recompute = useCallback(() => {
    setScrollTop(getScrollTop());
    setMaxScroll(getMaxScroll());
  }, []);

  useEffect(() => {
    recompute();
    window.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    // 页面切换后内容高度变化，延迟重算
    const t = setTimeout(recompute, 350);
    return () => {
      window.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
      clearTimeout(t);
    };
  }, [recompute, location.pathname]);

  const isHome = location.pathname === '/';
  const showTop = scrollTop > 200;
  const pageStep = Math.round(window.innerHeight * 0.85);

  const scrollTo = (top: number) =>
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

  const btnStyle: React.CSSProperties = {
    width: 42, height: 42, borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-container)',
    color: 'var(--text-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 16,
    boxShadow: '0 4px 16px var(--shadow-color)',
    transition: 'all 0.2s ease',
  };
  const primaryBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_LIGHT})`,
    color: '#fff', border: 'none',
    boxShadow: '0 6px 20px rgba(108,92,231,0.4)',
  };

  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
  };
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = '';
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 88, // 让开移动端底部 TabBar / 客服气泡
        zIndex: 1050,
        display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center',
      }}
    >
      <Tooltip title="向上翻页" placement="left">
        <button style={btnStyle} onClick={() => scrollTo(scrollTop - pageStep)}
          onMouseEnter={hoverIn} onMouseLeave={hoverOut} aria-label="向上翻页">
          <UpOutlined />
        </button>
      </Tooltip>

      <Tooltip title="向下翻页" placement="left">
        <button style={btnStyle} onClick={() => scrollTo(scrollTop + pageStep)}
          onMouseEnter={hoverIn} onMouseLeave={hoverOut} aria-label="向下翻页"
          disabled={scrollTop >= maxScroll - 2}>
          <DownOutlined />
        </button>
      </Tooltip>

      {!isHome && (
        <Tooltip title="返回首页" placement="left">
          <button style={btnStyle} onClick={() => { navigate('/'); scrollTo(0); }}
            onMouseEnter={hoverIn} onMouseLeave={hoverOut} aria-label="返回首页">
            <HomeFilled />
          </button>
        </Tooltip>
      )}

      <Tooltip title="企业微信客服" placement="left">
        <button style={btnStyle} onClick={() => window.open('https://work.weixin.qq.com/kfid/kfce20d584b0179916f', '_blank')}
          onMouseEnter={hoverIn} onMouseLeave={hoverOut} aria-label="企业微信客服">
          <WechatOutlined />
        </button>
      </Tooltip>

      {showTop && (
        <Tooltip title="返回顶部" placement="left">
          <button style={primaryBtnStyle} onClick={() => scrollTo(0)}
            onMouseEnter={hoverIn} onMouseLeave={hoverOut} aria-label="返回顶部">
            <VerticalAlignTopOutlined />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
