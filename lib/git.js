"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRepo = validateRepo;
exports.checkCleanWorkingTree = checkCleanWorkingTree;
exports.fetchBranch = fetchBranch;
exports.checkoutBranch = checkoutBranch;
exports.pullLatest = pullLatest;
exports.createBranch = createBranch;
exports.cherryPick = cherryPick;
exports.pushBranch = pushBranch;
exports.remoteBranchExists = remoteBranchExists;
exports.getCurrentBranch = getCurrentBranch;
exports.validateCommitExists = validateCommitExists;
exports.listBranches = listBranches;
function validateRepo(executor) {
    try {
        executor.query('git', ['rev-parse', '--git-dir']);
    }
    catch {
        throw new Error('Not a git repository. Run brancher from within the target git repository.');
    }
}
function checkCleanWorkingTree(executor) {
    const status = executor.query('git', ['status', '--porcelain']);
    if (status.length > 0) {
        throw new Error('Working tree is not clean.\n' +
            '  Please commit or stash your changes before running brancher.');
    }
}
function fetchBranch(branch, executor) {
    executor.run('git', ['fetch', 'origin', branch]);
}
function checkoutBranch(branch, executor) {
    executor.run('git', ['checkout', branch]);
}
function pullLatest(executor) {
    executor.run('git', ['pull']);
}
function createBranch(branch, executor) {
    executor.run('git', ['checkout', '-b', branch]);
}
function cherryPick(commit, executor) {
    try {
        executor.run('git', ['cherry-pick', commit.sha]);
    }
    catch (err) {
        throw new Error(`Cherry-pick failed for ${commit.shortSha}.\n` +
            `  ${err.message.split('\n')[0]}\n` +
            `  To abort:    git cherry-pick --abort\n` +
            `  To continue: resolve conflicts, then git cherry-pick --continue`);
    }
}
function pushBranch(branch, executor) {
    executor.run('git', ['push', 'origin', branch]);
}
function remoteBranchExists(branch, executor) {
    try {
        const out = executor.query('git', ['ls-remote', '--heads', 'origin', branch]);
        return out.length > 0;
    }
    catch {
        return false;
    }
}
function getCurrentBranch(executor) {
    return executor.query('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
}
function validateCommitExists(hash, executor) {
    try {
        const type = executor.query('git', ['cat-file', '-t', hash]);
        if (type !== 'commit') {
            throw new Error(`"${hash}" is a ${type}, not a commit`);
        }
    }
    catch (err) {
        if (err.message.includes('is a'))
            throw err;
        throw new Error(`Commit "${hash}" not found in this repository`);
    }
}
function listBranches(executor) {
    const out = executor.query('git', ['branch', '-a', '--format=%(refname:short)']);
    const seen = new Set();
    for (const b of out.split('\n').filter(Boolean)) {
        seen.add(b.replace(/^origin\//, '').replace(/^HEAD$/, '').trim());
    }
    seen.delete('');
    seen.delete('HEAD');
    return [...seen].sort();
}
//# sourceMappingURL=git.js.map