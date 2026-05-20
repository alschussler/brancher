#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { parseArgs, printUsage } from './cli';
import { Executor } from './executor';
import { fetchPrInfo, createPr } from './github';
import * as git from './git';
import { pickCommits } from './picker';
import { buildNewBranchName } from './utils';
import { log } from './logger';
import { BranchResult, Commit, PrInfo } from './types';

// ─── Prerequisites ────────────────────────────────────────────────────────────

function checkPrerequisites(): void {
  for (const tool of ['git', 'gh']) {
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
  // Parse arguments
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (err: any) {
    log.error(`Error: ${err.message}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  const { pr, branches, dryRun, pick } = options;

  checkPrerequisites();

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
  log.info(`PR #${prInfo.number}: ${prInfo.title}`);
  log.dim(`  Source branch : ${prInfo.headBranch}`);
  log.dim(`  Base branch   : ${prInfo.baseBranch}`);
  log.dim(`  Total commits : ${prInfo.commits.length}`);

  // ── Select commits ─────────────────────────────────────────────────────────
  let selectedCommits: Commit[];
  if (pick) {
    log.info('');
    try {
      selectedCommits = await pickCommits(prInfo.commits);
    } catch (err: any) {
      log.error(`\nAborted: ${err.message}`);
      process.exit(1);
    }
    if (selectedCommits.length === 0) {
      log.warn('\nNo commits selected. Nothing to do.');
      process.exit(0);
    }
  } else {
    selectedCommits = prInfo.commits;
  }

  log.info('');
  log.info(`Commits to cherry-pick (${selectedCommits.length}):`);
  for (const commit of selectedCommits) {
    log.dim(`  ${commit.shortSha}  ${commit.message}`);
  }

  // ── Validate branch names up-front before touching anything ───────────────
  const plans: { targetBranch: string; newBranch: string }[] = [];
  for (const targetBranch of branches) {
    try {
      plans.push({
        targetBranch,
        newBranch: buildNewBranchName(prInfo.headBranch, targetBranch),
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
      // Warn if the new branch already exists remotely
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
        `Cherry-picking ${selectedCommits.length} commit${selectedCommits.length === 1 ? '' : 's'}`,
      );
      for (const commit of selectedCommits) {
        log.dim(`    ${commit.shortSha}  ${commit.message}`);
        git.cherryPick(commit, executor);
      }

      log.step(`Pushing ${newBranch}`);
      git.pushBranch(newBranch, executor);

      log.step(`Creating PR: ${prInfo.title}`);
      const prUrl = createPr(prInfo.title, prInfo.body, newBranch, targetBranch, executor);

      results.push({ targetBranch, newBranch, prUrl: prUrl || undefined });
      if (!dryRun && prUrl) {
        log.success(`  Created: ${prUrl}`);
      }
    } catch (err: any) {
      log.error(`  Failed: ${err.message}`);
      results.push({ targetBranch, newBranch, error: err.message });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  log.section('Summary');
  const succeeded = results.filter(r => !r.error);
  const failed    = results.filter(r => r.error);

  for (const r of succeeded) {
    const url = r.prUrl ? `  ${r.prUrl}` : '';
    log.success(`  ✓  ${r.targetBranch}  (${r.newBranch})${url}`);
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
