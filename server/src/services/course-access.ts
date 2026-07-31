import { PlanId, planSatisfies } from '../config/billing';

export interface CourseAccessInput {
  price?: number;
  requiredPlan?: PlanId | null;
  freePreviewChapters?: number | null;
  chapters?: unknown[];
}

export interface CourseAccessResult {
  level: 'full' | 'preview';
  currentPlan: PlanId;
  requiredPlan: PlanId;
  freePreviewChapters: number;
  hasFullAccess: boolean;
}

const COURSE_PLAN_IDS = new Set<PlanId>(['free', 'pro', 'max', 'team']);

export function normalizeCourseRequiredPlan(course: CourseAccessInput): PlanId {
  const configured = COURSE_PLAN_IDS.has(course.requiredPlan as PlanId)
    ? (course.requiredPlan as PlanId)
    : 'free';
  return Number(course.price || 0) > 0 && configured === 'free' ? 'pro' : configured;
}

export function normalizeCoursePreviewCount(course: CourseAccessInput): number {
  const raw = Number(course.freePreviewChapters ?? 2);
  const normalized = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 2;
  return Array.isArray(course.chapters) ? Math.min(normalized, course.chapters.length) : normalized;
}

export function getCourseAccess(course: CourseAccessInput, currentPlan: PlanId): CourseAccessResult {
  const requiredPlan = normalizeCourseRequiredPlan(course);
  const hasFullAccess = Number(course.price || 0) <= 0 || planSatisfies(currentPlan, requiredPlan);
  return {
    level: hasFullAccess ? 'full' : 'preview',
    currentPlan,
    requiredPlan,
    freePreviewChapters: normalizeCoursePreviewCount(course),
    hasFullAccess,
  };
}

export function canAccessCourseChapter(
  course: CourseAccessInput,
  currentPlan: PlanId,
  chapterIndex: number,
): boolean {
  if (!Number.isInteger(chapterIndex) || chapterIndex < 0) return false;
  const access = getCourseAccess(course, currentPlan);
  return access.hasFullAccess || chapterIndex < access.freePreviewChapters;
}
