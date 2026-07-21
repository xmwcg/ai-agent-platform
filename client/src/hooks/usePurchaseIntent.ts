import { useEffect, useRef, useCallback, useState } from 'react';
import api from '@/services/api';

type IntentAction = 'click_pricing' | 'compare' | 'view_demo' | 'stay_long' | 'exit_intent' | 'return_visit' | 'view_features';

interface Tip {
  type: 'value' | 'objection' | 'urgency' | 'social_proof' | 'guide';
  title: string;
  content: string;
  action?: { text: string; path: string };
}

export function usePurchaseIntent(productId: string, productName?: string) {
  const [tips, setTips] = useState<Tip[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const stayTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const staySeconds = useRef(0);
  const eventsCount = useRef(0);
  const tipsShown = useRef(false);

  const trackAction = useCallback((action: IntentAction, extra?: Record<string, any>) => {
    eventsCount.current++;
    api.post('/marketing/purchase-intent', {
      productId, productName, action,
      pageStaySeconds: staySeconds.current, ...extra,
    }).catch(() => {});
  }, [productId, productName]);

  useEffect(() => {
    stayTimer.current = setInterval(() => {
      staySeconds.current++;
      if (staySeconds.current % 30 === 0) trackAction('stay_long');
    }, 1000);
    return () => { if (stayTimer.current) clearInterval(stayTimer.current); };
  }, [trackAction]);

  const fetchTips = useCallback(async () => {
    if (tipsShown.current) return;
    try {
      const res = await api.post('/marketing/generate-tips', { productId, productName });
      const newTips = res.data?.data?.tips || [];
      if (newTips.length > 0) { setTips(newTips); setShowPanel(true); tipsShown.current = true; }
    } catch {
      // 营销提示为尽力而为，失败不阻断用户当前操作。
    }
  }, [productId, productName]);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !tipsShown.current && eventsCount.current >= 2) {
        trackAction('exit_intent'); fetchTips();
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [trackAction, fetchTips]);

  useEffect(() => {
    if (eventsCount.current >= 3 && staySeconds.current >= 20 && !tipsShown.current) {
      const t = setTimeout(() => fetchTips(), 3000);
      return () => clearTimeout(t);
    }
  }, [fetchTips]);

  const dismissTips = useCallback(() => setShowPanel(false), []);

  return { trackAction, tips, showPanel, dismissTips, fetchTips };
}