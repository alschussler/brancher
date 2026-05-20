#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { parseCliArgs, printUsage } from './cli';
import { printCompletionScript } from './completions';
import { Executor } from './executor';
import { fetchPrInfo, createPr } from './github';
import * as git from './git';
import { pickCommits } from './picker';
import { buildNewBranchName } from './utils';
import { log } from './logger';
import { BranchResult, Commit, PrInfo } from './types';

// ─── Prerequisites ────────────────────────────────────────────────────────────

function checkPrerequisites(needsGh: boolean): void {
  const tools = needsGh ? ['git', 'gh'] : ['git'];
  for (const tool of tools) {
    const result = spawnSync(tool, ['--version'], { encoding: 'utf-8' });
    if (result.error || result.status !== 0) {
      log.error(
        tool === 'gh'
          ? 'gh CLI is not installed or not in PATH.\n  Install it from https://cli.github.com'
          : 'git is not installed or not in PATH.',
      );
      process.exit(1);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  // Handle 'completion' subcommand before full arg parsing
  if (rawArgs[0] === 'completion') {
    printCompletionScript(rawArgs[1] ?? 'bash');
    process.exit(0);
  }

  // Hidden flag used by shell completion scripts to enumerate branches
  if (rawArgs.includes('--list-branches')) {
    const executor = new Executor(false);
    try {
      git.validateRepo(executor);
      const branches = git.listBranches(executor);
      console.log(branches.join('\n'));
    } catch {
      // silent — completion scripts must not produce error output
    }
    process.exit(0);
  }

  // Parse arguments
  let options;
  try {
    options = parseCliArgs(process.argv);
  } catch (err: any) {
    log.error(`Error: ${err.message}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  const { pr, cherryPickHash, branches, dryRun, pick, push } = options;

  checkPrerequisites(/* needsGh */ !cherryPickHash);

  if (dryRun) {
    log.warn('Dry-run mode — no commands will be executed\n');
  }

  // Validate we are inside a git repository and the tree is clean
  if (!dryRun) {
    try {
      git.validateRepo(new Executor(false));
      git.checkCleanWorkingTree(new Executor(false));
    } catch (err: any) {
      log.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }

  const executor = new Executor(dryRun);

  // ── Cherry-pick mode ───────────────────────────────────────────────────────
  if (cherryPickHash) {
    await runCherryPickMode({ hash: cherryPickHash, branches, push, dryRun, executor });
    return;
  }

  // ── PR backport mode ───────────────────────────────────────────────────────
  await runPrBackportMode({ pr: pr!, branches, dryRun, pick, executor });
}

// ─── Cherry-pick mode ─────────────────────────────────────────────────────────

async function runCherryPickMode(opts: {
  hash: string;
  branches: string[];
  push: boolean;
  dryRun: boolean;
  executor: Executor;
}): Promise<void> {
  const { hash, branches, push, dryRun, executor } = opts;

  // Validate the commit exists before touching any branch
  if (!dryRun) {
    try {
      git.validateCommitExists(hash, executor);
    } catch (err: any) {
      log.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }

  log.info('');
  log.info(`Cherry-picking ${hash} onto ${branches.length} branch(es):`);
  for (const b of branches) log.dim(`  ${b}`);
  if (push) log.dim('  (will push each branch after cherry-pick)');

  // Remember the starting branch so we can return to it
  let originalBranch = '';
  if (!dryRun) {
    try {
      originalBranch = git.getCurrentBranch(executor);
    } catch {
      // detached HEAD or similar — we just won't restore
    }
  }

  const results: BranchResult[] = [];
  const commit = { sha: hash, shortSha: hash.slice(0, 7) };

  for (const branch of branches) {
    log.section(`▶  ${branch}`);

    try {
      log.step(`Fetching origin/${branch}`);
      git.fetchBranch(branch, executor);

      log.step(`Checking out ${branch}`);
      git.checkoutBranch(branch, executor);
      git.pullLatest(executor);

      log.step(`Cherry-picking ${commit.shortSha}`);
      git.cherryPick(commit, executor);

      if (push) {
        log.step(`Pushing ${branch}`);
        git.pushBranch(branch, executor);
      }

      results.push({ targetBranch: branch, newBranch: branch });
      log.success(`  ✓  done`);
    } catch (err: any) {
      log.error(`  Failed: ${err.message}`);
      results.push({ targetBranch: branch, newBranch: branch, error: err.message });
    }
  }

  // Restore original branch
  if (!dryRun && originalBranch && originalBranch !== 'HEAD') {
    try {
      git.checkoutBranch(originalBranch, executor);
    } catch {
      log.warn(`  Could not restore original branch "${originalBranch}" — check your working tree.`);
    }
  }

  printSummary(results);
}

// ─── PR backport mode ─────────────────────────────────────────────────────────

async function runPrBackportMode(opts: {
  pr: number;
  branches: string[];
  dryRun: boolean;
  pick: boolean;
  executor: Executor;
}): Promise<void> {
  const { pr, branches, dryRun, pick, executor } = opts;

  // ── Fetch PR info ──────────────────────────────────────────────────────────
  log.step(`Fetching PR #${pr}…`);
  let prInfo: PrInfo;
  try {
    prInfo = fetchPrInfo(pr, executor);
  } catch (err: any) {
    log.error(`\nError: ${err.message}`);
    process.exit(1);
  }

  log.info('');
  log.info(`PR #${prInfo!.number}: ${prInfo!.title}`);
  log.dim(`  Source branch : ${prInfo!.headBranch}`);
  log.dim(`  Base branch   : ${prInfo!.baseBranch}`);
  log.dim(`  Total commits : ${prInfo!.commits.length}`);

  // ── Select commits ─────────────────────────────────────────────────────────
  let selectedCommits: Commit[];
  if (pick) {
    log.info('');
    try {
      selectedCommits = await pickCommits(prInfo!.commits);
    } catch (err: any) {
      log.error(`\nAborted: ${err.message}`);
      process.exit(1);
    }
    if (selectedCommits!.length === 0) {
      log.warn('\nNo commits selected. Nothing to do.');
      process.exit(0);
    }
  } else {
    selectedCommits = prInfo!.commits;
  }

  log.info('');
  log.info(`Commits to cherry-pick (${selectedCommits!.length}):`);
  for (const commit of selectedCommits!) {
    log.dim(`  ${commit.shortSha}  ${commit.message}`);
  }

  // ── Validate branch names up-front before touching anything ───────────────
  const plans: { targetBranch: string; newBranch: string }[] = [];
  for (const targetBranch of branches) {
    try {
      plans.push({
        targetBranch,
        newBranch: buildNewBranchName(prInfo!.headBranch, targetBranch),
      });
    } catch (err: any) {
      log.error(`\nError: ${err.message}`);
      process.exit(1);
    }
  }

  log.info('');
  log.info(`Target branches (${plans.length}):`);
  for (const p of plans) {
    log.dim(`  ${p.targetBranch}  →  ${p.newBranch}`);
  }

  // ── Process each target branch ────────────────────────────────────────────
  const results: BranchResult[] = [];

  for (const { targetBranch, newBranch } of plans) {
    log.section(`▶  ${targetBranch}  →  ${newBranch}`);

    try {
      if (!dryRun && git.remoteBranchExists(newBranch, executor)) {
        log.warn(`  Branch "${newBranch}" already exists on origin. Skipping.`);
        results.push({ targetBranch, newBranch, error: 'Branch already exists on origin' });
        continue;
      }

      log.step(`Fetching origin/${targetBranch}`);
      git.fetchBranch(targetBranch, executor);

      log.step(`Checking out ${targetBranch}`);
      git.checkoutBranch(targetBranch, executor);
      git.pullLatest(executor);

      log.step(`Creating branch ${newBranch}`);
      git.createBranch(newBranch, executor);

      log.step(
        `Cherry-picking ${selectedCommits!.length} commit${selectedCommits!.length === 1 ? '' : 's'}`,
      );
      for (const commit of selectedCommits!) {
        log.dim(`    ${commit.shortSha}  ${commit.message}`);
        git.cherryPick(commit, executor);
      }

      log.step(`Pushing ${newBranch}`);
      git.pushBranch(newBranch, executor);

      log.step(`Creating PR: ${prInfo!.title}`);
      const prUrl = createPr(prInfo!.title, prInfo!.body, newBranch, targetBranch, executor);

      results.push({ targetBranch, newBranch, prUrl: prUrl || undefined });
      if (!dryRun && prUrl) {
        log.success(`  Created: ${prUrl}`);
      }
    } catch (err: any) {
      log.error(`  Failed: ${err.message}`);
      results.push({ targetBranch, newBranch, error: err.message });
    }
  }

  printSummary(results);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function printSummary(results: BranchResult[]): void {
  log.section('Summary');
  const succeeded = results.filter(r => !r.error);
  const failed    = results.filter(r => r.error);

  for (const r of succeeded) {
    const url = r.prUrl ? `  ${r.prUrl}` : '';
    log.success(`  ✓  ${r.targetBranch}${url}`);
  }
  for (const r of failed) {
    log.error(`  ✗  ${r.targetBranch}  ${r.error}`);
  }

  if (failed.length > 0) {
    log.info('');
    log.warn(
      `${failed.length} of ${results.length} branch(es) failed.` +
      ' Review the errors above and retry those branches manually if needed.',
    );
    process.exit(1);
  }
}

main().catch(err => {
  log.error(`\nUnexpected error: ${err.message}`);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});
