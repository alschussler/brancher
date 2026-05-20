import { parseArgs } from 'node:util';
import { CliOptions } from './types';

type CliArgDescription = {
  type: 'string' | 'boolean';
  short?: string;
  multiple?: boolean;
  default?: string | boolean | string[] | boolean[];
  description: string;
};

type CliArgs = Record<string, CliArgDescription>;

const ARGS_OPTIONS = {
  pr: {
    type: 'string' as const,
    description: 'Source PR number to backport (required unless --cherry-pick)',
  },
  'cherry-pick': {
    type: 'string' as const,
    description: 'Commit hash to cherry-pick onto each target branch',
  },
  branches: {
    type: 'string' as const,
    short: 'b',
    multiple: true,
    description: 'Target branches (repeat for each). In --pr mode: base for new backport PRs. In --cherry-pick mode: branches that will receive the cherry-pick.',
  },
  push: {
    type: 'boolean' as const,
    default: false,
    description: 'Push each branch to origin after cherry-picking (--cherry-pick mode)',
  },
  'dry-run': {
    type: 'boolean' as const,
    default: false,
    description: 'Print commands that would run without executing them',
  },
  pick: {
    type: 'boolean' as const,
    default: false,
    description: 'Interactively select which commits to cherry-pick (--pr mode)',
  },
  help: {
    type: 'boolean' as const,
    short: 'h',
    default: false,
    description: 'Show this help message',
  },
} satisfies CliArgs;

export function parseCliArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const { values } = parseArgs({
    args,
    options: ARGS_OPTIONS,
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const hasPr          = !!values.pr;
  const hasCherryPick  = !!values['cherry-pick'];

  if (!hasPr && !hasCherryPick) {
    throw new Error('Either --pr or --cherry-pick is required');
  }
  if (hasPr && hasCherryPick) {
    throw new Error('--pr and --cherry-pick are mutually exclusive');
  }

  let pr: number | undefined;
  if (hasPr) {
    pr = parseInt(values.pr!, 10);
    if (isNaN(pr) || pr <= 0) {
      throw new Error(`--pr requires a positive integer, got: ${values.pr}`);
    }
  }

  const branches = values.branches ?? [];
  if (branches.length === 0) {
    throw new Error('--branches (-b) is required with at least one branch');
  }

  return {
    pr,
    cherryPickHash: values['cherry-pick'],
    branches,
    dryRun: values['dry-run'] ?? false,
    pick:   values.pick ?? false,
    push:   values.push ?? false,
  };
}

export function printUsage(): void {
  console.log('');
  console.log('brancher — Create backport PRs or cherry-pick commits across branches');
  console.log('');
  console.log('Usage:');
  console.log('  brancher --pr <number> -b <branch> [-b <branch> ...] [options]');
  console.log('  brancher --cherry-pick <hash> -b <branch> [-b <branch> ...] [--push]');
  console.log('  brancher completion [bash|zsh|fish]');
  console.log('');
  console.log('Options:');
  for (const [key, value] of Object.entries(ARGS_OPTIONS) as [string, CliArgDescription][]) {
    const flag = `${value.short ? `-${value.short}, ` : '    '}--${key}`;
    console.log(`  ${flag.padEnd(20)}  ${value.description}`);
  }
  console.log('');
  console.log('Examples:');
  console.log('  brancher --pr 123 -b 5.04.194.42 -b 5.03.100.10');
  console.log('  brancher --pr 123 -b release/5.04 -b release/5.03 --dry-run');
  console.log('  brancher --pr 123 -b 5.04.x --pick');
  console.log('  brancher --cherry-pick abc1234 -b release/5.04 -b release/5.03');
  console.log('  brancher --cherry-pick abc1234 -b release/5.04 --push');
  console.log('  brancher completion bash >> ~/.bashrc');
  console.log('');
}
