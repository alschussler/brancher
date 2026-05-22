import { Executor } from "./executor.ts";
import type { Commit, PrInfo } from "./types.ts";

interface GhCommit {
  oid: string;
  messageHeadline: string;
  messageBody: string;
}

interface GhPrView {
  number: number;
  title: string;
  body: string;
  headRefName: string;
  baseRefName: string;
  commits: GhCommit[];
}

export function fetchPrInfo(prNumber: number, executor: Executor): PrInfo {
  let raw: string;
  try {
    raw = executor.query("gh", [
      "pr",
      "view",
      String(prNumber),
      "--json",
      "number,title,body,headRefName,baseRefName,commits",
    ]);
  } catch (err: any) {
    throw new Error(
      `Failed to fetch PR #${prNumber} from GitHub.\n` +
        `  Make sure gh is installed, authenticated, and this is the right repo.\n` +
        `  Details: ${err.message}`,
    );
  }

  let data: GhPrView;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Could not parse response from gh. Unexpected output:\n${raw}`,
    );
  }

  if (!data.commits || data.commits.length === 0) {
    throw new Error(`PR #${prNumber} has no commits. Nothing to cherry-pick.`);
  }

  const commits: Commit[] = data.commits.map((c) => ({
    sha: c.oid,
    shortSha: c.oid.slice(0, 7),
    message: c.messageHeadline,
  }));

  return {
    number: data.number,
    title: data.title,
    body: data.body ?? "",
    headBranch: data.headRefName,
    baseBranch: data.baseRefName,
    commits,
  };
}

export function createPr(
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string,
  executor: Executor,
): string {
  return executor.run("gh", [
    "pr",
    "create",
    "--title",
    title,
    "--body",
    body,
    "--head",
    headBranch,
    "--base",
    baseBranch,
  ]);
}
