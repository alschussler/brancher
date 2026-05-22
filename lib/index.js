#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const cli_1 = require("./cli");
const completions_1 = require("./completions");
const executor_1 = require("./executor");
const github_1 = require("./github");
const git = __importStar(require("./git"));
const picker_1 = require("./picker");
const utils_1 = require("./utils");
const logger_1 = require("./logger");
// ─── Prerequisites ────────────────────────────────────────────────────────────
function checkPrerequisites(needsGh) {
    const tools = needsGh ? ['git', 'gh'] : ['git'];
    for (const tool of tools) {
        const result = (0, child_process_1.spawnSync)(tool, ['--version'], { encoding: 'utf-8' });
        if (result.error || result.status !== 0) {
            logger_1.log.error(tool === 'gh'
                ? 'gh CLI is not installed or not in PATH.\n  Install it from https://cli.github.com'
                : 'git is not installed or not in PATH.');
            process.exit(1);
        }
    }
}
// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const rawArgs = process.argv.slice(2);
    // Handle 'completion' subcommand before full arg parsing
    if (rawArgs[0] === 'completion') {
        (0, completions_1.printCompletionScript)(rawArgs[1] ?? 'bash');
        process.exit(0);
    }
    // Hidden flag used by shell completion scripts to enumerate branches
    if (rawArgs.includes('--list-branches')) {
        const executor = new executor_1.Executor(false);
        try {
            git.validateRepo(executor);
            const branches = git.listBranches(executor);
            console.log(branches.join('\n'));
        }
        catch {
            // silent — completion scripts must not produce error output
        }
        process.exit(0);
    }
    // Parse arguments
    let options;
    try {
        options = (0, cli_1.parseCliArgs)(process.argv);
    }
    catch (err) {
        logger_1.log.error(`Error: ${err.message}`);
        console.error('Run with --help for usage information.');
        process.exit(1);
    }
    const { pr, cherryPickHash, branches, dryRun, pick, push } = options;
    checkPrerequisites(/* needsGh */ !cherryPickHash);
    if (dryRun) {
        logger_1.log.warn('Dry-run mode — no commands will be executed\n');
    }
    // Validate we are inside a git repository and the tree is clean
    if (!dryRun) {
        try {
            git.validateRepo(new executor_1.Executor(false));
            git.checkCleanWorkingTree(new executor_1.Executor(false));
        }
        catch (err) {
            logger_1.log.error(`Error: ${err.message}`);
            process.exit(1);
        }
    }
    const executor = new executor_1.Executor(dryRun);
    // ── Cherry-pick mode ───────────────────────────────────────────────────────
    if (cherryPickHash) {
        await runCherryPickMode({ hash: cherryPickHash, branches, push, dryRun, executor });
        return;
    }
    // ── PR backport mode ───────────────────────────────────────────────────────
    await runPrBackportMode({ pr: pr, branches, dryRun, pick, executor });
}
// ─── Cherry-pick mode ─────────────────────────────────────────────────────────
async function runCherryPickMode(opts) {
    const { hash, branches, push, dryRun, executor } = opts;
    // Validate the commit exists before touching any branch
    if (!dryRun) {
        try {
            git.validateCommitExists(hash, executor);
        }
        catch (err) {
            logger_1.log.error(`Error: ${err.message}`);
            process.exit(1);
        }
    }
    logger_1.log.info('');
    logger_1.log.info(`Cherry-picking ${hash} onto ${branches.length} branch(es):`);
    for (const b of branches)
        logger_1.log.dim(`  ${b}`);
    if (push)
        logger_1.log.dim('  (will push each branch after cherry-pick)');
    // Remember the starting branch so we can return to it
    let originalBranch = '';
    if (!dryRun) {
        try {
            originalBranch = git.getCurrentBranch(executor);
        }
        catch {
            // detached HEAD or similar — we just won't restore
        }
    }
    const results = [];
    const commit = { sha: hash, shortSha: hash.slice(0, 7) };
    for (const branch of branches) {
        logger_1.log.section(`▶  ${branch}`);
        try {
            logger_1.log.step(`Fetching origin/${branch}`);
            git.fetchBranch(branch, executor);
            logger_1.log.step(`Checking out ${branch}`);
            git.checkoutBranch(branch, executor);
            git.pullLatest(executor);
            logger_1.log.step(`Cherry-picking ${commit.shortSha}`);
            git.cherryPick(commit, executor);
            if (push) {
                logger_1.log.step(`Pushing ${branch}`);
                git.pushBranch(branch, executor);
            }
            results.push({ targetBranch: branch, newBranch: branch });
            logger_1.log.success(`  ✓  done`);
        }
        catch (err) {
            logger_1.log.error(`  Failed: ${err.message}`);
            results.push({ targetBranch: branch, newBranch: branch, error: err.message });
        }
    }
    // Restore original branch
    if (!dryRun && originalBranch && originalBranch !== 'HEAD') {
        try {
            git.checkoutBranch(originalBranch, executor);
        }
        catch {
            logger_1.log.warn(`  Could not restore original branch "${originalBranch}" — check your working tree.`);
        }
    }
    printSummary(results);
}
// ─── PR backport mode ─────────────────────────────────────────────────────────
async function runPrBackportMode(opts) {
    const { pr, branches, dryRun, pick, executor } = opts;
    // ── Fetch PR info ──────────────────────────────────────────────────────────
    logger_1.log.step(`Fetching PR #${pr}…`);
    let prInfo;
    try {
        prInfo = (0, github_1.fetchPrInfo)(pr, executor);
    }
    catch (err) {
        logger_1.log.error(`\nError: ${err.message}`);
        process.exit(1);
    }
    logger_1.log.info('');
    logger_1.log.info(`PR #${prInfo.number}: ${prInfo.title}`);
    logger_1.log.dim(`  Source branch : ${prInfo.headBranch}`);
    logger_1.log.dim(`  Base branch   : ${prInfo.baseBranch}`);
    logger_1.log.dim(`  Total commits : ${prInfo.commits.length}`);
    // ── Select commits ─────────────────────────────────────────────────────────
    let selectedCommits;
    if (pick) {
        logger_1.log.info('');
        try {
            selectedCommits = await (0, picker_1.pickCommits)(prInfo.commits);
        }
        catch (err) {
            logger_1.log.error(`\nAborted: ${err.message}`);
            process.exit(1);
        }
        if (selectedCommits.length === 0) {
            logger_1.log.warn('\nNo commits selected. Nothing to do.');
            process.exit(0);
        }
    }
    else {
        selectedCommits = prInfo.commits;
    }
    logger_1.log.info('');
    logger_1.log.info(`Commits to cherry-pick (${selectedCommits.length}):`);
    for (const commit of selectedCommits) {
        logger_1.log.dim(`  ${commit.shortSha}  ${commit.message}`);
    }
    // ── Validate branch names up-front before touching anything ───────────────
    const plans = [];
    for (const targetBranch of branches) {
        try {
            plans.push({
                targetBranch,
                newBranch: (0, utils_1.buildNewBranchName)(prInfo.headBranch, targetBranch),
            });
        }
        catch (err) {
            logger_1.log.error(`\nError: ${err.message}`);
            process.exit(1);
        }
    }
    logger_1.log.info('');
    logger_1.log.info(`Target branches (${plans.length}):`);
    for (const p of plans) {
        logger_1.log.dim(`  ${p.targetBranch}  →  ${p.newBranch}`);
    }
    // ── Process each target branch ────────────────────────────────────────────
    const results = [];
    for (const { targetBranch, newBranch } of plans) {
        logger_1.log.section(`▶  ${targetBranch}  →  ${newBranch}`);
        try {
            if (!dryRun && git.remoteBranchExists(newBranch, executor)) {
                logger_1.log.warn(`  Branch "${newBranch}" already exists on origin. Skipping.`);
                results.push({ targetBranch, newBranch, error: 'Branch already exists on origin' });
                continue;
            }
            logger_1.log.step(`Fetching origin/${targetBranch}`);
            git.fetchBranch(targetBranch, executor);
            logger_1.log.step(`Checking out ${targetBranch}`);
            git.checkoutBranch(targetBranch, executor);
            git.pullLatest(executor);
            logger_1.log.step(`Creating branch ${newBranch}`);
            git.createBranch(newBranch, executor);
            logger_1.log.step(`Cherry-picking ${selectedCommits.length} commit${selectedCommits.length === 1 ? '' : 's'}`);
            for (const commit of selectedCommits) {
                logger_1.log.dim(`    ${commit.shortSha}  ${commit.message}`);
                git.cherryPick(commit, executor);
            }
            logger_1.log.step(`Pushing ${newBranch}`);
            git.pushBranch(newBranch, executor);
            logger_1.log.step(`Creating PR: ${prInfo.title}`);
            const prUrl = (0, github_1.createPr)(prInfo.title, prInfo.body, newBranch, targetBranch, executor);
            results.push({ targetBranch, newBranch, prUrl: prUrl || undefined });
            if (!dryRun && prUrl) {
                logger_1.log.success(`  Created: ${prUrl}`);
            }
        }
        catch (err) {
            logger_1.log.error(`  Failed: ${err.message}`);
            results.push({ targetBranch, newBranch, error: err.message });
        }
    }
    printSummary(results);
}
// ─── Shared helpers ───────────────────────────────────────────────────────────
function printSummary(results) {
    logger_1.log.section('Summary');
    const succeeded = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);
    for (const r of succeeded) {
        const url = r.prUrl ? `  ${r.prUrl}` : '';
        logger_1.log.success(`  ✓  ${r.targetBranch}${url}`);
    }
    for (const r of failed) {
        logger_1.log.error(`  ✗  ${r.targetBranch}  ${r.error}`);
    }
    if (failed.length > 0) {
        logger_1.log.info('');
        logger_1.log.warn(`${failed.length} of ${results.length} branch(es) failed.` +
            ' Review the errors above and retry those branches manually if needed.');
        process.exit(1);
    }
}
main().catch(err => {
    logger_1.log.error(`\nUnexpected error: ${err.message}`);
    if (process.env.DEBUG) {
        console.error(err.stack);
    }
    process.exit(1);
});
//# sourceMappingURL=index.js.map