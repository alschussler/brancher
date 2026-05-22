"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Executor = void 0;
const child_process_1 = require("child_process");
class Executor {
    constructor(dryRun) {
        this.dryRun = dryRun;
        this.useColors = process.stdout.isTTY === true;
    }
    /**
     * Runs a command. In dry-run mode, prints it instead of executing.
     * Returns stdout on success, empty string in dry-run mode.
     */
    run(cmd, args) {
        if (this.dryRun) {
            const dim = this.useColors ? '\x1B[2m' : '';
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
    query(cmd, args) {
        return this.exec(cmd, args);
    }
    exec(cmd, args) {
        const result = (0, child_process_1.spawnSync)(cmd, args, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (result.error) {
            throw new Error(`Failed to run "${cmd}": ${result.error.message}`);
        }
        if (result.status !== 0) {
            const stderr = result.stderr?.trim() ?? '';
            throw new Error(`Command failed (exit ${result.status}): ${this.format(cmd, args)}` +
                (stderr ? `\n${stderr}` : ''));
        }
        return (result.stdout ?? '').trim();
    }
    /** Formats a command + args array as a human-readable shell string. */
    format(cmd, args) {
        return [cmd, ...args.map(a => this.quote(a))].join(' ');
    }
    quote(arg) {
        if (arg === '' || /[\s'"\\$|&;<>(){}[\]#~`!]/.test(arg)) {
            return `'${arg.replace(/'/g, "'\\''")}'`;
        }
        return arg;
    }
}
exports.Executor = Executor;
//# sourceMappingURL=executor.js.map