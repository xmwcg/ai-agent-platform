import { create } from 'zustand';
import { billingAPI } from '@/services/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  interval: 'month' | 'year';
  features: string[];
  creditsPerMonth: number;
  aiCostBudget: number;
  highlighted?: boolean;
  popular?: boolean;
}

interface CreditsPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  originalPrice?: number;
}

interface Subscription {
  plan: string;
  status: string;
  expiresAt?: string;
  autoRenew?: boolean;
  startedAt?: string;
}

interface Order {
  _id: string;
  orderNo: string;
  plan: string;
  period: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface PaymentState {
  // 套餐数据
  plans: Plan[];
  plansLoading: boolean;
  creditsPackages: CreditsPackage[];
  creditsPackagesLoading: boolean;

  // 订阅状态
  subscription: Subscription | null;
  subscriptionLoading: boolean;

  // 订单
  orders: Order[];
  ordersLoading: boolean;

  // 当前支付流程
  currentOrderNo: string | null;
  paymentProvider: 'wechat' | 'stripe' | 'alipay' | 'mock' | null;
  paymentModalOpen: boolean;
  paymentStep: 'confirm' | 'pay' | 'result';
  paymentResult: 'success' | 'fail' | null;

  // Actions
  fetchPlans: () => Promise<void>;
  fetchCreditsPackages: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  createOrder: (plan: string, period: 'monthly' | 'yearly', provider?: string) => Promise<any>;
  createCreditsOrder: (packageId: string, provider?: string) => Promise<any>;
  getOrderStatus: (orderNo: string) => Promise<any>;
  setPaymentModalOpen: (open: boolean) => void;
  setPaymentProvider: (provider: PaymentState['paymentProvider']) => void;
  setPaymentStep: (step: PaymentState['paymentStep']) => void;
  setPaymentResult: (result: PaymentState['paymentResult']) => void;
  resetPayment: () => void;
}

export const usePaymentStore = create<PaymentState>()((set, get) => ({
  plans: [],
  plansLoading: false,
  creditsPackages: [],
  creditsPackagesLoading: false,
  subscription: null,
  subscriptionLoading: false,
  orders: [],
  ordersLoading: false,
  currentOrderNo: null,
  paymentProvider: null,
  paymentModalOpen: false,
  paymentStep: 'confirm',
  paymentResult: null,

  fetchPlans: async () => {
    set({ plansLoading: true });
    try {
      const res: any = await billingAPI.getPlans();
      set({ plans: res?.data || res?.plans || [], plansLoading: false });
    } catch {
      set({ plansLoading: false });
    }
  },

  fetchCreditsPackages: async () => {
    set({ creditsPackagesLoading: true });
    try {
      const res: any = await billingAPI.getCreditsPackages();
      set({ creditsPackages: res?.data || res?.packages || [], creditsPackagesLoading: false });
    } catch {
      set({ creditsPackagesLoading: false });
    }
  },

  fetchSubscription: async () => {
    set({ subscriptionLoading: true });
    try {
      const res: any = await billingAPI.getSubscription();
      set({ subscription: res?.data || res || null, subscriptionLoading: false });
    } catch {
      set({ subscriptionLoading: false });
    }
  },

  fetchOrders: async () => {
    set({ ordersLoading: true });
    try {
      const res: any = await billingAPI.getOrders();
      set({ orders: res?.data || res?.orders || [], ordersLoading: false });
    } catch {
      set({ ordersLoading: false });
    }
  },

  createOrder: async (plan, period, provider) => {
    const res: any = await billingAPI.createOrder({ plan: plan as any, period, provider });
    const orderNo = res?.orderNo || res?.data?.orderNo;
    set({ currentOrderNo: orderNo || null });
    return res;
  },

  createCreditsOrder: async (packageId, provider) => {
    const res: any = await billingAPI.createCreditsOrder({ packageId, provider });
    const orderNo = res?.orderNo || res?.data?.orderNo;
    set({ currentOrderNo: orderNo || null });
    return res;
  },

  getOrderStatus: async (orderNo) => {
    return await billingAPI.getOrderStatus(orderNo);
  },

  setPaymentModalOpen: (open) => set({ paymentModalOpen: open }),
  setPaymentProvider: (provider) => set({ paymentProvider: provider }),
  setPaymentStep: (step) => set({ paymentStep: step }),
  setPaymentResult: (result) => set({ paymentResult: result }),

  resetPayment: () =>
    set({
      currentOrderNo: null,
      paymentProvider: null,
      paymentModalOpen: false,
      paymentStep: 'confirm',
      paymentResult: null,
    }),
}));
