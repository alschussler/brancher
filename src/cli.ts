import { CliOptions } from './types';

export function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let pr: number | undefined;
  const branches: string[] = [];
  let dryRun = false;
  let pick = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--pr') {
      const raw = args[++i];
      if (raw === undefined || raw.startsWith('-')) {
        throw new Error('--pr requires a number argument');
      }
      pr = parseInt(raw, 10);
      if (isNaN(pr) || pr <= 0) {
        throw new Error(`--pr requires a positive integer, got: ${raw}`);
      }
    } else if (arg === '--branches' || arg === '-b') {
      let count = 0;
      while (args[i + 1] !== undefined && !args[i + 1].startsWith('-')) {
        branches.push(args[++i]);
        count++;
      }
      if (count === 0) {
        throw new Error(`${arg} requires at least one branch argument`);
      }
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--pick') {
      pick = true;
    } else {
      throw new Error(
        `Unknown argument: ${arg}\nRun with --help for usage information.`,
      );
    }
  }

  if (pr === undefined) {
    throw new Error('--pr is required');
  }
  if (branches.length === 0) {
    throw new Error('--branches (-b) is required with at least one branch');
  }

  return { pr, branches, dryRun, pick };
}

export function printUsage(): void {
  console.log(`
brancher — Create backport PRs for multiple version branches

USAGE
  brancher --pr <number> --branches <branch...> [options]

OPTIONS
  --pr <number>             Source PR number to cherry-pick from (required)
  --branches, -b <branch…>  Target branches to create PRs against (required)
  --dry-run                 Print commands that would run without executing them
  --pick                    Interactively select which commits to cherry-pick
  --help, -h                Show this help message

EXAMPLES
  # Backport PR #123 to two version branches
  brancher --pr 123 --branches 5.04.194.42 5.03.100.10

  # Preview without making any changes
  brancher --pr 123 -b release/5.04 release/5.03 --dry-run

  # Interactively pick which commits to apply
  brancher --pr 123 -b 5.04.x --pick

BRANCH NAMING
  New branches are formed by appending the sanitized target-branch version to
  the source PR's head branch (digits only, all other characters stripped).
  Example: source branch "fix-auth" + target "5.04.194.42" → "fix-auth-50419442"

REQUIREMENTS
  - git CLI available in PATH
  - gh CLI (https://cli.github.com) available in PATH and authenticated
  - Must be run from within the target git repository
`);
}
