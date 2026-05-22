# brancher

CLI to create backport PRs for multiple version branches from a single source PR.

When a fix needs to be applied to previous releases, brancher automates the process of cherry-picking commits and opening a PR against each target branch — preserving the original PR title and body.

## Requirements

- [git](https://git-scm.com)
- [gh](https://cli.github.com) — authenticated (`gh auth login`)
- Node.js ≥ 16

## Install

```bash
npm install -g https://github.com/alschussler/brancher.git --install-links
```

## Usage

```
brancher --pr <number> -b <branch> [-b <branch> ...] [options]
```

### Options

| Flag | Description |
|---|---|
| `--pr <number>` | Source PR number to cherry-pick from (required) |
| `-b`, `--branches <branch>` | Target branch to create a PR against — repeat for each branch (required) |
| `--dry-run` | Print the commands that would run without executing them |
| `--pick` | Interactively select which commits to cherry-pick |
| `--help`, `-h` | Show help |

## Examples

```bash
# Backport PR #123 to two version branches
brancher --pr 123 -b 5.04.194.42 -b 5.03.100.10

# Preview what would happen without making any changes
brancher --pr 123 -b release/5.04 -b release/5.03 --dry-run

# Choose specific commits to backport
brancher --pr 123 -b 5.04.x --pick
```

## How it works

For each target branch, brancher:

1. Fetches and checks out the target branch
2. Creates a new branch named `<source-branch>-<version>` (e.g. `fix-auth-bug-50419442`)
3. Cherry-picks the selected commits
4. Pushes the new branch
5. Opens a PR against the target branch with the same title and body as the original

### Branch naming

Non-digit characters are stripped from the target branch name to form the suffix:

```
source branch : fix-auth-bug
target branch : 5.04.194.42
new branch    : fix-auth-bug-50419442
```

## Interactive commit picker (`--pick`)

When `--pick` is passed, a TUI is shown to select which commits to cherry-pick:

```
Select commits to cherry-pick:
↑/↓ navigate  Space toggle  a select all  n deselect all  Enter confirm  Ctrl+C abort

▶ [x] abc1234  Fix null check in auth handler
  [x] def5678  Add regression test for auth
  [ ] ghi9012  Bump version

2 / 3 commits selected
```

By default all commits are selected. If not running in a TTY, all commits are selected automatically.

## Development

```bash
npm run build   # compile once
npm run dev     # watch mode
```
