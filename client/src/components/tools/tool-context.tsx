import { createContext, useContext } from 'react';

export interface ToolEntitlementView {
  id: string;
  label: string;
  category: string;
  requiredPlan: 'free' | 'pro' | 'max' | 'team';
  creditCost: number;
  allowed: boolean;
  accessMode?: 'plan' | 'credits' | 'upgrade';
  reason: string;
  upgradeUrl: string;
  creditsUrl: string;
}

export const ToolEntitlementContext = createContext<ToolEntitlementView | null>(null);

export function useToolEntitlement(): ToolEntitlementView | null {
  return useContext(ToolEntitlementContext);
}
