const isTTY = process.stdout.isTTY === true;
const c = {
    reset: isTTY ? '\x1B[0m' : '',
    bold: isTTY ? '\x1B[1m' : '',
    dim: isTTY ? '\x1B[2m' : '',
    green: isTTY ? '\x1B[32m' : '',
    red: isTTY ? '\x1B[31m' : '',
    yellow: isTTY ? '\x1B[33m' : '',
    cyan: isTTY ? '\x1B[36m' : '',
};
export const log = {
    info: (msg) => console.log(msg),
    success: (msg) => console.log(`${c.green}${msg}${c.reset}`),
    error: (msg) => console.error(`${c.red}${msg}${c.reset}`),
    warn: (msg) => console.warn(`${c.yellow}${msg}${c.reset}`),
    dim: (msg) => console.log(`${c.dim}${msg}${c.reset}`),
    section: (msg) => console.log(`\n${c.bold}${c.cyan}${msg}${c.reset}`),
    step: (msg) => console.log(`  ${c.cyan}»${c.reset} ${msg}`),
};
