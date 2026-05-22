import { Executor } from "./executor.ts";

export function validateRepo(executor: Executor): void {
  try {
    executor.query("git", ["rev-parse", "--git-dir"]);
  } catch {
    throw new Error(
      "Not a git repository. Run brancher from within the target git repository.",
    );
  }
}

export function checkCleanWorkingTree(executor: Executor): void {
  const status = executor.query("git", ["status", "--porcelain"]);
  if (status.length > 0) {
    throw new Error(
      "Working tree is not clean.\n" +
        "  Please commit or stash your changes before running brancher.",
    );
  }
}

export function fetchBranch(branch: string, executor: Executor): void {
  executor.run("git", ["fetch", "origin", branch]);
}

export function checkoutBranch(branch: string, executor: Executor): void {
  executor.run("git", ["checkout", branch]);
}

export function pullLatest(executor: Executor): void {
  executor.run("git", ["pull"]);
}

export function createBranch(branch: string, executor: Executor): void {
  executor.run("git", ["checkout", "-b", branch]);
}

export function cherryPick(
  commit: { sha: string; shortSha: string },
  executor: Executor,
): void {
  try {
    executor.run("git", ["cherry-pick", commit.sha]);
  } catch (err: any) {
    throw new Error(
      `Cherry-pick failed for ${commit.shortSha}.\n` +
        `  ${err.message.split("\n")[0]}\n` +
        `  To abort:    git cherry-pick --abort\n` +
        `  To continue: resolve conflicts, then git cherry-pick --continue`,
    );
  }
}

export function pushBranch(branch: string, executor: Executor): void {
  executor.run("git", ["push", "origin", branch]);
}

export function remoteBranchExists(
  branch: string,
  executor: Executor,
): boolean {
  try {
    const out = executor.query("git", [
      "ls-remote",
      "--heads",
      "origin",
      branch,
    ]);
    return out.length > 0;
  } catch {
    return false;
  }
}

export function getCurrentBranch(executor: Executor): string {
  return executor.query("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function validateCommitExists(hash: string, executor: Executor): void {
  try {
    const type = executor.query("git", ["cat-file", "-t", hash]);
    if (type !== "commit") {
      throw new Error(`"${hash}" is a ${type}, not a commit`);
    }
  } catch (err: any) {
    if (err.message.includes("is a")) throw err;
    throw new Error(`Commit "${hash}" not found in this repository`);
  }
}

export function listBranches(executor: Executor): string[] {
  const out = executor.query("git", [
    "branch",
    "-a",
    "--format=%(refname:short)",
  ]);
  const seen = new Set<string>();
  for (const b of out.split("\n").filter(Boolean)) {
    seen.add(
      b
        .replace(/^origin\//, "")
        .replace(/^HEAD$/, "")
        .trim(),
    );
  }
  seen.delete("");
  seen.delete("HEAD");
  return [...seen].sort();
}
