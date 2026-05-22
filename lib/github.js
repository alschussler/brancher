import { Executor } from "./executor.js";
export function fetchPrInfo(prNumber, executor) {
    let raw;
    try {
        raw = executor.query("gh", [
            "pr",
            "view",
            String(prNumber),
            "--json",
            "number,title,body,headRefName,baseRefName,commits",
        ]);
    }
    catch (err) {
        throw new Error(`Failed to fetch PR #${prNumber} from GitHub.\n` +
            `  Make sure gh is installed, authenticated, and this is the right repo.\n` +
            `  Details: ${err.message}`);
    }
    let data;
    try {
        data = JSON.parse(raw);
    }
    catch {
        throw new Error(`Could not parse response from gh. Unexpected output:\n${raw}`);
    }
    if (!data.commits || data.commits.length === 0) {
        throw new Error(`PR #${prNumber} has no commits. Nothing to cherry-pick.`);
    }
    const commits = data.commits.map((c) => ({
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
export function createPr(title, body, headBranch, baseBranch, executor) {
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
