import { Commit } from './types';

const KEY = {
  UP:     '\x1B[A',
  DOWN:   '\x1B[B',
  SPACE:  ' ',
  ENTER:  '\r',
  CTRL_C: '\x03',
  CTRL_D: '\x04',
};

const MAX_MSG_LEN = 72;

/**
 * Interactive TUI for selecting commits to cherry-pick.
 * Falls back to selecting all commits when not running in a TTY.
 */
export async function pickCommits(commits: Commit[]): Promise<Commit[]> {
  if (!process.stdin.isTTY) {
    console.log('(Not a TTY — all commits selected by default)');
    return commits;
  }

  return new Promise((resolve, reject) => {
    const isTTY = process.stdout.isTTY === true;
    const c = {
      reset:  isTTY ? '\x1B[0m'  : '',
      bold:   isTTY ? '\x1B[1m'  : '',
      dim:    isTTY ? '\x1B[2m'  : '',
      cyan:   isTTY ? '\x1B[36m' : '',
      green:  isTTY ? '\x1B[32m' : '',
    };

    const state = {
      cursor: 0,
      // Start with all commits selected
      selected: new Set<number>(commits.map((_, i) => i)),
    };

    let renderedLineCount = 0;

    function render(redraw: boolean): void {
      const lines: string[] = [];

      lines.push(`${c.bold}Select commits to cherry-pick:${c.reset}`);
      lines.push(
        `${c.dim}↑/↓ navigate  Space toggle  a select all  n deselect all  Enter confirm  Ctrl+C abort${c.reset}`,
      );
      lines.push('');

      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        const isSelected = state.selected.has(i);
        const isCursor  = state.cursor === i;

        const arrow   = isCursor  ? `${c.cyan}▶${c.reset}` : ' ';
        const box     = isSelected ? `${c.green}[x]${c.reset}` : '[ ]';
        const sha     = `${c.dim}${commit.shortSha}${c.reset}`;
        const msg     = commit.message.length > MAX_MSG_LEN
          ? commit.message.slice(0, MAX_MSG_LEN - 1) + '…'
          : commit.message;

        lines.push(`${arrow} ${box} ${sha}  ${msg}`);
      }

      lines.push('');
      lines.push(`${c.dim}${state.selected.size} / ${commits.length} commits selected${c.reset}`);

      let output = '';
      if (redraw && renderedLineCount > 0) {
        // Move cursor up to start of previously rendered block and clear to end of screen
        output += `\x1B[${renderedLineCount}A\x1B[J`;
      }
      output += lines.join('\n') + '\n';
      renderedLineCount = lines.length;

      process.stdout.write(output);
    }

    function cleanup(): void {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    }

    function onData(key: string): void {
      if (key === KEY.CTRL_C || key === KEY.CTRL_D) {
        cleanup();
        process.stdout.write('\n');
        reject(new Error('Aborted'));
        return;
      }

      if (key === KEY.UP) {
        state.cursor = Math.max(0, state.cursor - 1);

      } else if (key === KEY.DOWN) {
        state.cursor = Math.min(commits.length - 1, state.cursor + 1);

      } else if (key === KEY.SPACE) {
        if (state.selected.has(state.cursor)) {
          state.selected.delete(state.cursor);
        } else {
          state.selected.add(state.cursor);
        }

      } else if (key === 'a' || key === 'A') {
        commits.forEach((_, i) => state.selected.add(i));

      } else if (key === 'n' || key === 'N') {
        state.selected.clear();

      } else if (key === KEY.ENTER) {
        cleanup();
        process.stdout.write('\n');
        resolve(commits.filter((_, i) => state.selected.has(i)));
        return;
      }

      render(true);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', onData);

    render(false);
  });
}
