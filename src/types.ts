export interface CliOptions {
  pr: number;
  branches: string[];
  dryRun: boolean;
  pick: boolean;
}

export interface Commit {
  sha: string;
  shortSha: string;
  message: string;
}

export interface PrInfo {
  number: number;
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  commits: Commit[];
}

export interface BranchResult {
  targetBranch: string;
  newBranch: string;
  prUrl?: string;
  error?: string;
}
