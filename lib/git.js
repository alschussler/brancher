import { Executor } from "./executor.js";
export function validateRepo(executor) {
    try {
        executor.query("git", ["rev-parse", "--git-dir"]);
    }
    catch {
        throw new Error("Not a git repository. Run brancher from within the target git repository.");
    }
}
export function checkCleanWorkingTree(executor) {
    const status = executor.query("git", ["status", "--porcelain"]);
    if (status.length > 0) {
        throw new Error("Working tree is not clean.\n" +
            "  Please commit or stash your changes before running brancher.");
    }
}
export function fetchBranch(branch, executor) {
    executor.run("git", ["fetch", "origin", branch]);
}
export function checkoutBranch(branch, executor) {
    executor.run("git", ["checkout", branch]);
}
export function pullLatest(executor) {
    executor.run("git", ["pull"]);
}
export function createBranch(branch, executor) {
    executor.run("git", ["checkout", "-b", branch]);
}
export function cherryPick(commit, executor) {
    try {
        executor.run("git", ["cherry-pick", commit.sha]);
    }
    catch (err) {
        throw new Error(`Cherry-pick failed for ${commit.shortSha}.\n` +
            `  ${err.message.split("\n")[0]}\n` +
            `  To abort:    git cherry-pick --abort\n` +
            `  To continue: resolve conflicts, then git cherry-pick --continue`);
    }
}
export function pushBranch(branch, executor) {
    executor.run("git", ["push", "origin", branch]);
}
export function remoteBranchExists(branch, executor) {
    try {
        const out = executor.query("git", [
            "ls-remote",
            "--heads",
            "origin",
            branch,
        ]);
        return out.length > 0;
    }
    catch {
        return false;
    }
}
export function getCurrentBranch(executor) {
    return executor.query("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}
export function validateCommitExists(hash, executor) {
    try {
        const type = executor.query("git", ["cat-file", "-t", hash]);
        if (type !== "commit") {
            throw new Error(`"${hash}" is a ${type}, not a commit`);
        }
    }
    catch (err) {
        if (err.message.includes("is a"))
            throw err;
        throw new Error(`Commit "${hash}" not found in this repository`);
    }
}
export function listBranches(executor) {
    const out = executor.query("git", [
        "branch",
        "-a",
        "--format=%(refname:short)",
    ]);
    const seen = new Set();
    for (const b of out.split("\n").filter(Boolean)) {
        seen.add(b
            .replace(/^origin\//, "")
            .replace(/^HEAD$/, "")
            .trim());
    }
    seen.delete("");
    seen.delete("HEAD");
    return [...seen].sort();
}
