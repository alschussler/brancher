import { Executor } from './executor';

export function validateRepo(executor: Executor): void {
  try {
    executor.query('git', ['rev-parse', '--git-dir']);
  } catch {
    throw new Error(
      'Not a git repository. Run brancher from within the target git repository.',
    );
  }
}

export function checkCleanWorkingTree(executor: Executor): void {
  const status = executor.query('git', ['status', '--porcelain']);
  if (status.length > 0) {
    throw new Error(
      'Working tree is not clean.\n' +
      '  Please commit or stash your changes before running brancher.',
    );
  }
}

export function fetchBranch(branch: string, executor: Executor): void {
  executor.run('git', ['fetch', 'origin', branch]);
}

export function checkoutBranch(branch: string, executor: Executor): void {
  executor.run('git', ['checkout', branch]);
}

export function pullLatest(executor: Executor): void {
  executor.run('git', ['pull']);
}

export function createBranch(branch: string, executor: Executor): void {
  executor.run('git', ['checkout', '-b', branch]);
}

export function cherryPick(commit: { sha: string; shortSha: string }, executor: Executor): void {
  try {
    executor.run('git', ['cherry-pick', commit.sha]);
  } catch (err: any) {
    throw new Error(
      `Cherry-pick failed for ${commit.shortSha}.\n` +
      `  ${err.message.split('\n')[0]}\n` +
      `  To abort:    git cherry-pick --abort\n` +
      `  To continue: resolve conflicts, then git cherry-pick --continue`,
    );
  }
}

export function pushBranch(branch: string, executor: Executor): void {
  executor.run('git', ['push', 'origin', branch]);
}

export function remoteBranchExists(branch: string, executor: Executor): boolean {
  try {
    const out = executor.query('git', ['ls-remote', '--heads', 'origin', branch]);
    return out.length > 0;
  } catch {
    return false;
  }
}
