/**
 * Unit tests for completion.ts CLI command module
 *
 * Tests shell completion script generation for bash, zsh, and fish shells.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Import after setting up any mocks
import { registerCompletionCommand } from '../../../src/commands/completion';

describe('completion commands', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    // Spy on console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerCompletionCommand', () => {
    it('should register completion command on program', () => {
      registerCompletionCommand(program);

      const completionCmd = program.commands.find((cmd) => cmd.name() === 'completion');
      expect(completionCmd).toBeDefined();
    });

    it('should register bash subcommand', () => {
      registerCompletionCommand(program);

      const completionCmd = program.commands.find((cmd) => cmd.name() === 'completion');
      const bashCmd = completionCmd?.commands.find((cmd) => cmd.name() === 'bash');
      expect(bashCmd).toBeDefined();
    });

    it('should register zsh subcommand', () => {
      registerCompletionCommand(program);

      const completionCmd = program.commands.find((cmd) => cmd.name() === 'completion');
      const zshCmd = completionCmd?.commands.find((cmd) => cmd.name() === 'zsh');
      expect(zshCmd).toBeDefined();
    });

    it('should register fish subcommand', () => {
      registerCompletionCommand(program);

      const completionCmd = program.commands.find((cmd) => cmd.name() === 'completion');
      const fishCmd = completionCmd?.commands.find((cmd) => cmd.name() === 'fish');
      expect(fishCmd).toBeDefined();
    });
  });

  describe('bash', () => {
    it('outputs bash completion script', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'bash']);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('# Bash completion for scribe');
      expect(output).toContain('_scribe_completions');
      expect(output).toContain('complete -F _scribe_completions scribe');
    });

    it('includes all top-level commands in bash completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'bash']);

      const output = consoleSpy.mock.calls[0][0];

      // Check that main commands are included
      expect(output).toContain('notes');
      expect(output).toContain('search');
      expect(output).toContain('graph');
      expect(output).toContain('tags');
      expect(output).toContain('people');
      expect(output).toContain('tasks');
      expect(output).toContain('daily');
      expect(output).toContain('vault');
      expect(output).toContain('completion');
    });

    it('includes notes subcommands in bash completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'bash']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('list');
      expect(output).toContain('show');
      expect(output).toContain('find');
      expect(output).toContain('create');
      expect(output).toContain('append');
      expect(output).toContain('add-task');
      expect(output).toContain('update');
      expect(output).toContain('delete');
    });

    it('includes global options in bash completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'bash']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('--vault');
      expect(output).toContain('--format');
      expect(output).toContain('--help');
      expect(output).toContain('--version');
    });

    it('includes format option values in bash completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'bash']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('json text');
    });
  });

  describe('zsh', () => {
    it('outputs zsh completion script', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'zsh']);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('#compdef scribe');
      expect(output).toContain('_scribe()');
    });

    it('includes command descriptions in zsh completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'zsh']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain("'notes:Note operations'");
      expect(output).toContain("'search:Full-text search'");
      expect(output).toContain("'graph:Graph operations'");
      expect(output).toContain("'tags:Tag operations'");
      expect(output).toContain("'vault:Vault operations'");
      expect(output).toContain("'completion:Generate shell completion'");
    });

    it('includes global options with descriptions in zsh completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'zsh']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain("'--vault[Override vault path]");
      expect(output).toContain("'--format[Output format]");
      expect(output).toContain("'--help[Show help]'");
    });

    it('includes subcommand completions in zsh', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'zsh']);

      const output = consoleSpy.mock.calls[0][0];

      // Check notes subcommands
      expect(output).toContain('notes)');
      expect(output).toContain('list show find create append add-task update delete');

      // Check graph subcommands
      expect(output).toContain('graph)');
      expect(output).toContain('backlinks outlinks neighbors stats');

      // Check completion subcommands
      expect(output).toContain('completion)');
      expect(output).toContain('bash zsh fish');
    });
  });

  describe('fish', () => {
    it('outputs fish completion script', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'fish']);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('# Fish completion for scribe');
      expect(output).toContain('complete -c scribe');
    });

    it('includes global options in fish completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'fish']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain("-l vault -d 'Override vault path'");
      expect(output).toContain("-l format -d 'Output format'");
      expect(output).toContain("-l include-raw -d 'Include raw Lexical JSON'");
      expect(output).toContain("-l quiet -d 'Suppress non-essential output'");
      expect(output).toContain("-l verbose -d 'Show detailed operation info'");
      expect(output).toContain("-l debug -d 'Show debug information'");
    });

    it('includes command completions in fish', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'fish']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain("-a notes -d 'Note operations'");
      expect(output).toContain("-a search -d 'Full-text search'");
      expect(output).toContain("-a graph -d 'Graph operations'");
      expect(output).toContain("-a tags -d 'Tag operations'");
      expect(output).toContain("-a people -d 'People operations'");
      expect(output).toContain("-a tasks -d 'Task operations'");
      expect(output).toContain("-a daily -d 'Daily note operations'");
      expect(output).toContain("-a vault -d 'Vault operations'");
      expect(output).toContain("-a completion -d 'Generate shell completion'");
    });

    it('includes notes subcommands in fish completion', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'fish']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('__fish_seen_subcommand_from notes');
      expect(output).toContain("-a list -d 'List notes'");
      expect(output).toContain("-a show -d 'Show note'");
      expect(output).toContain("-a create -d 'Create note'");
    });

    it('includes completion subcommands in fish', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'fish']);

      const output = consoleSpy.mock.calls[0][0];

      expect(output).toContain('__fish_seen_subcommand_from completion');
      expect(output).toContain('bash zsh fish');
    });

    it('disables file completion for scribe command', async () => {
      registerCompletionCommand(program);
      await program.parseAsync(['node', 'test', 'completion', 'fish']);

      const output = consoleSpy.mock.calls[0][0];

      // -f flag disables file completion
      expect(output).toContain('complete -c scribe -f');
    });
  });
});
