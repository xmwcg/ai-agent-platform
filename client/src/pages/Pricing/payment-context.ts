import { resolveSafeReturnTo } from '@/utils/safe-return-to';

export type BillingSourceProduct = 'platform' | 'project_grade' | 'jinwangtong' | 'zhipingtong' | 'transync' | 'guard';

export interface PaymentContext {
  sourceProduct: BillingSourceProduct;
  returnTo?: string;
  isProjectGrade: boolean;
}

export const PROJECT_GRADE_RETURN_TO = '/project-grade/projects';

export function parsePaymentContext(params: URLSearchParams): PaymentContext {
  const source = params.get('source');
  const isProjectGrade = source === 'project-grade' || source === 'project_grade';
  const fallback = isProjectGrade ? PROJECT_GRADE_RETURN_TO : '/';
  const requestedReturnTo = params.get('returnTo');
  const safeReturnTo = requestedReturnTo
    ? resolveSafeReturnTo(requestedReturnTo, fallback)
    : isProjectGrade
      ? fallback
      : undefined;
  return {
    sourceProduct: isProjectGrade ? 'project_grade' : 'platform',
    returnTo: safeReturnTo,
    isProjectGrade,
  };
}

export function buildProjectGradeUpgradeUrl(returnTo = PROJECT_GRADE_RETURN_TO): string {
  const safeReturnTo = resolveSafeReturnTo(returnTo, PROJECT_GRADE_RETURN_TO);
  return `/pricing?source=project-grade&returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function createOrderIdempotencyKey(): string {
  return `billing-${crypto.randomUUID()}`;
}
