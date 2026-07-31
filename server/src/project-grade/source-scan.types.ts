export type ProjectGradeSourceFindingSeverity = 'info' | 'warning' | 'high';

export interface ProjectGradeSourceScanLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  timeoutMs: number;
}

export interface ProjectGradeSourceScanRequest {
  rootKey: string;
  relativePath?: string;
}

export interface ProjectGradeSourceFileEvidence {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface ProjectGradeSourceFinding {
  ruleKey: string;
  severity: ProjectGradeSourceFindingSeverity;
  filePath: string;
  line: number;
  message: string;
  fingerprint: string;
}

export interface ProjectGradeSourceRoute {
  framework: 'express';
  method: string;
  routePath: string;
  filePath: string;
  line: number;
}

export interface ProjectGradeSourceProjectSignals {
  hasTests: boolean;
  hasDocker: boolean;
  hasCi: boolean;
  hasLicense: boolean;
  hasPackageManifest: boolean;
}

export interface ProjectGradeSourceScanResult {
  scanVersion: string;
  rootKey: string;
  snapshotHash: string;
  files: ProjectGradeSourceFileEvidence[];
  findings: ProjectGradeSourceFinding[];
  routes: ProjectGradeSourceRoute[];
  projectSignals: ProjectGradeSourceProjectSignals;
  summary: {
    filesScanned: number;
    totalBytes: number;
    findings: number;
    routes: number;
  };
  skipped: {
    ignoredDirectories: number;
    unsupportedExtensions: number;
    binaryFiles: number;
    symbolicLinks: number;
  };
  limits: ProjectGradeSourceScanLimits;
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  externalScanningEnabled: false;
  sourceContentPersisted: false;
  executedSourceCode: false;
  installedDependencies: false;
  networkAccessed: false;
}
