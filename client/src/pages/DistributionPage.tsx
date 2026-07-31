import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** 分销中心已合并到推荐分销页面，自动跳转 */
export default function DistributionPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/referral', { replace: true });
  }, [navigate]);
  return null;
}
