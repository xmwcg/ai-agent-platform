import { describe, expect, it } from 'vitest';
import {
  isCurrentProjectRequest,
  isCurrentRequestSequence,
  isSourceEvidenceEvaluationDisabled,
} from './project-grade-request-guard';

describe('ProjectGrade request sequence guard', () => {
  it('accepts the latest project collection request', () => {
    expect(isCurrentRequestSequence(12, 12)).toBe(true);
  });

  it('rejects a stale project collection response (BUG-PG-RACE-3)', () => {
    expect(isCurrentRequestSequence(13, 12)).toBe(false);
  });
});

describe('ProjectGrade source evidence operation guard', () => {
  it('blocks evaluation while an adoption request is in progress (BUG-PG-RACE-4)', () => {
    expect(
      isSourceEvidenceEvaluationDisabled({
        adoptionInProgress: true,
        evaluationInProgress: false,
        projectActive: true,
      })
    ).toBe(true);
  });

  it('allows evaluation only when the active project has no evidence operation in progress', () => {
    expect(
      isSourceEvidenceEvaluationDisabled({
        adoptionInProgress: false,
        evaluationInProgress: false,
        projectActive: true,
      })
    ).toBe(false);
  });
});

describe('ProjectGrade project request guard', () => {
  it('accepts only the active project and current request sequence', () => {
    expect(
      isCurrentProjectRequest({
        activeProjectId: 'project-b',
        requestProjectId: 'project-b',
        activeSequence: 8,
        requestSequence: 8,
      })
    ).toBe(true);
  });

  it('rejects a late response from the previously selected project (BUG-PG-RACE-1)', () => {
    expect(
      isCurrentProjectRequest({
        activeProjectId: 'project-b',
        requestProjectId: 'project-a',
        activeSequence: 8,
        requestSequence: 8,
      })
    ).toBe(false);
  });

  it('rejects an older request for the same project (BUG-PG-RACE-2)', () => {
    expect(
      isCurrentProjectRequest({
        activeProjectId: 'project-b',
        requestProjectId: 'project-b',
        activeSequence: 9,
        requestSequence: 8,
      })
    ).toBe(false);
  });
});
