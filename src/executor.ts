import { spawnSync } from 'child_process';

export class Executor {
  private readonly useColors: boolean;

  constructor(private readonly dryRun: boolean) {
    this.useColors = process.stdout.isTTY === true;
  }

  /**
   * Runs a command. In dry-run mode, prints it instead of executing.
   * Returns stdout on success, empty string in dry-run mode.
   */
  run(cmd: string, args: string[]): string {
    if (this.dryRun) {
      const dim   = this.useColors ? '\x1B[2m' : '';
      const reset = this.useColors ? '\x1B[0m' : '';
      process.stdout.write(`  ${dim}$ ${this.format(cmd, args)}${reset}\n`);
      return '';
    }
    return this.exec(cmd, args);
  }

  /**
   * Always executes, regardless of dry-run mode. Use for read-only queries
   * (e.g. fetching PR info, checking git state) that must run in all modes.
   */
  query(cmd: string, args: string[]): string {
    return this.exec(cmd, args);
  }

  private exec(cmd: string, args: string[]): string {
    const result = spawnSync(cmd, args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.error) {
      throw new Error(`Failed to run "${cmd}": ${result.error.message}`);
    }

    if (result.status !== 0) {
      const stderr = (result.stderr as string | null)?.trim() ?? '';
      throw new Error(
        `Command failed (exit ${result.status}): ${this.format(cmd, args)}` +
        (stderr ? `\n${stderr}` : ''),
      );
    }

    return ((result.stdout as string | null) ?? '').trim();
  }

  /** Formats a command + args array as a human-readable shell string. */
  private format(cmd: string, args: string[]): string {
    return [cmd, ...args.map(a => this.quote(a))].join(' ');
  }

  private quote(arg: string): string {
    if (arg === '' || /[\s'"\\$|&;<>(){}[\]#~`!]/.test(arg)) {
      return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
  }
}
