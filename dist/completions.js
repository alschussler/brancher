"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printCompletionScript = printCompletionScript;
function printCompletionScript(shell) {
    switch (shell) {
        case 'zsh':
            printZsh();
            break;
        case 'fish':
            printFish();
            break;
        default:
            printBash();
    }
}
function printBash() {
    console.log(`
# brancher bash completion
# Add to ~/.bashrc:  source <(brancher completion bash)
_brancher_complete() {
  local cur prev
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ "$prev" == "-b" || "$prev" == "--branches" ]]; then
    local branches
    branches=$(brancher --list-branches 2>/dev/null)
    COMPREPLY=($(compgen -W "$branches" -- "$cur"))
    return
  fi

  COMPREPLY=($(compgen -W "--pr --cherry-pick -b --branches --push --dry-run --pick --help completion" -- "$cur"))
}
complete -F _brancher_complete brancher
`.trim());
}
function printZsh() {
    console.log(`
# brancher zsh completion
# Add to ~/.zshrc:  source <(brancher completion zsh)
_brancher() {
  local -a branches
  branches=(\${(f)"$(brancher --list-branches 2>/dev/null)"})

  _arguments -C \\
    '--pr[Source PR number]:pr:' \\
    '--cherry-pick[Commit hash to cherry-pick]:hash:($(git log --oneline -20 2>/dev/null | awk '"'"'{print $1}'"'"'))' \\
    '(-b --branches)'{-b,--branches}'[Target branch]:branch:($branches)' \\
    '--push[Push branch to origin after cherry-pick]' \\
    '--dry-run[Print commands without executing]' \\
    '--pick[Interactively select commits]' \\
    '(-h --help)'{-h,--help}'[Show help]' \\
    '1:subcommand:(completion)'
}
compdef _brancher brancher
`.trim());
}
function printFish() {
    console.log(`
# brancher fish completion
# Add to ~/.config/fish/completions/brancher.fish  or run:
#   brancher completion fish > ~/.config/fish/completions/brancher.fish

function __brancher_branches
  brancher --list-branches 2>/dev/null
end

complete -c brancher -l pr          -d 'Source PR number'              -r
complete -c brancher -l cherry-pick -d 'Commit hash to cherry-pick'    -r
complete -c brancher -s b -l branches -d 'Target branch'               -r -a '(__brancher_branches)'
complete -c brancher -l push        -d 'Push branch to origin after cherry-pick'
complete -c brancher -l dry-run     -d 'Print commands without executing'
complete -c brancher -l pick        -d 'Interactively select commits'
complete -c brancher -s h -l help   -d 'Show help'
complete -c brancher -f -a completion -d 'Print shell completion script'
`.trim());
}
//# sourceMappingURL=completions.js.map