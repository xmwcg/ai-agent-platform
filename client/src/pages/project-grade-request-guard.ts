export interface ProjectRequestGuardInput {
  activeProjectId: string | null;
  requestProjectId: string;
  activeSequence: number;
  requestSequence: number;
}

export const isCurrentRequestSequence = (
  activeSequence: number,
  requestSequence: number
): boolean => activeSequence === requestSequence;

export interface SourceEvidenceEvaluationGuardInput {
  adoptionInProgress: boolean;
  evaluationInProgress: boolean;
  projectActive: boolean;
}

export const isSourceEvidenceEvaluationDisabled = ({
  adoptionInProgress,
  evaluationInProgress,
  projectActive,
}: SourceEvidenceEvaluationGuardInput): boolean =>
  adoptionInProgress || evaluationInProgress || !projectActive;

export const isCurrentProjectRequest = ({
  activeProjectId,
  requestProjectId,
  activeSequence,
  requestSequence,
}: ProjectRequestGuardInput): boolean =>
  activeProjectId === requestProjectId && isCurrentRequestSequence(activeSequence, requestSequence);
