import { describe, expect, it } from 'vitest';
import {
  buildProjectGradeUpgradeUrl,
  createOrderIdempotencyKey,
  parsePaymentContext,
} from './payment-context';

describe('pricing payment context', () => {
  it('maps ProjectGrade source to a safe order context', () => {
    const context = parsePaymentContext(
      new URLSearchParams(
        'source=project-grade&returnTo=%2Fproject-grade%2Fprojects%3Ftab%3Dreports'
      )
    );
    expect(context).toEqual({
      sourceProduct: 'project_grade',
      returnTo: '/project-grade/projects?tab=reports',
      isProjectGrade: true,
    });
  });

  it('falls back to the ProjectGrade workspace for unsafe redirects', () => {
    const context = parsePaymentContext(
      new URLSearchParams('source=project-grade&returnTo=https%3A%2F%2Fevil.example')
    );
    expect(context.returnTo).toBe('/project-grade/projects');
    expect(buildProjectGradeUpgradeUrl('//evil.example')).toBe(
      '/pricing?source=project-grade&returnTo=%2Fproject-grade%2Fprojects'
    );
  });

  it('creates a reusable high-entropy browser order key', () => {
    expect(createOrderIdempotencyKey()).toMatch(/^billing-[0-9a-f-]{36}$/);
  });
});
