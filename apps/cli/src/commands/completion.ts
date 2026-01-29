import { Command } from 'commander';

export function registerCompletionCommand(program: Command): void {
  const completion = program.command('completion').description('Generate shell completion scripts');

  completion
    .command('bash')
    .description('Generate bash completion script')
    .action(() => {
      console.log(generateBashCompletion());
    });

  completion
    .command('zsh')
    .description('Generate zsh completion script')
    .action(() => {
      console.log(generateZshCompletion());
    });

  completion
    .command('fish')
    .description('Generate fish completion script')
    .action(() => {
      console.log(generateFishCompletion());
    });
}

function generateBashCompletion(): string {
  return `# Bash completion for scribe
_scribe_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  
  # Top-level commands
  local commands="notes search graph tags people daily vault completion"
  
  # Global options
  local global_opts="--vault --format --include-raw --quiet --verbose --debug --help --version"
  
  case "\${prev}" in
    scribe)
      COMPREPLY=($(compgen -W "\${commands} \${global_opts}" -- "\${cur}"))
      ;;
    notes)
      COMPREPLY=($(compgen -W "list show find create append update delete" -- "\${cur}"))
      ;;
    graph)
      COMPREPLY=($(compgen -W "backlinks outlinks neighbors stats" -- "\${cur}"))
      ;;
    tags)
      COMPREPLY=($(compgen -W "list notes" -- "\${cur}"))
      ;;
    people)
      COMPREPLY=($(compgen -W "list mentions" -- "\${cur}"))
      ;;
    daily)
      COMPREPLY=($(compgen -W "show create" -- "\${cur}"))
      ;;
    vault)
      COMPREPLY=($(compgen -W "info" -- "\${cur}"))
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "\${cur}"))
      ;;
    --format)
      COMPREPLY=($(compgen -W "json text" -- "\${cur}"))
      ;;
    *)
      COMPREPLY=($(compgen -W "\${global_opts}" -- "\${cur}"))
      ;;
  esac
}
complete -F _scribe_completions scribe
`;
}

function generateZshCompletion(): string {
  return `#compdef scribe

_scribe() {
  local -a commands
  commands=(
    'notes:Note operations'
    'search:Full-text search'
    'graph:Graph operations'
    'tags:Tag operations'
    'people:People operations'
    'daily:Daily note operations'
    'vault:Vault operations'
    'completion:Generate shell completion'
  )

  _arguments -C \\
    '--vault[Override vault path]:path:_files -/' \\
    '--format[Output format]:format:(json text)' \\
    '--include-raw[Include raw Lexical JSON]' \\
    '--quiet[Suppress non-essential output]' \\
    '--verbose[Show detailed operation info]' \\
    '--debug[Show debug information]' \\
    '--help[Show help]' \\
    '--version[Show version]' \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        notes)
          _values 'subcommand' list show find create append update delete
          ;;
        graph)
          _values 'subcommand' backlinks outlinks neighbors stats
          ;;
        completion)
          _values 'shell' bash zsh fish
          ;;
      esac
      ;;
  esac
}

_scribe
`;
}

function generateFishCompletion(): string {
  return `# Fish completion for scribe
complete -c scribe -f

# Global options
complete -c scribe -l vault -d 'Override vault path' -r
complete -c scribe -l format -d 'Output format' -xa 'json text'
complete -c scribe -l include-raw -d 'Include raw Lexical JSON'
complete -c scribe -l quiet -d 'Suppress non-essential output'
complete -c scribe -l verbose -d 'Show detailed operation info'
complete -c scribe -l debug -d 'Show debug information'

# Commands
complete -c scribe -n "__fish_use_subcommand" -a notes -d 'Note operations'
complete -c scribe -n "__fish_use_subcommand" -a search -d 'Full-text search'
complete -c scribe -n "__fish_use_subcommand" -a graph -d 'Graph operations'
complete -c scribe -n "__fish_use_subcommand" -a tags -d 'Tag operations'
complete -c scribe -n "__fish_use_subcommand" -a people -d 'People operations'
complete -c scribe -n "__fish_use_subcommand" -a daily -d 'Daily note operations'
complete -c scribe -n "__fish_use_subcommand" -a vault -d 'Vault operations'
complete -c scribe -n "__fish_use_subcommand" -a completion -d 'Generate shell completion'

# Notes subcommands
complete -c scribe -n "__fish_seen_subcommand_from notes" -a list -d 'List notes'
complete -c scribe -n "__fish_seen_subcommand_from notes" -a show -d 'Show note'
complete -c scribe -n "__fish_seen_subcommand_from notes" -a create -d 'Create note'

# Completion subcommands
complete -c scribe -n "__fish_seen_subcommand_from completion" -a "bash zsh fish" -d 'Shell type'
`;
}
