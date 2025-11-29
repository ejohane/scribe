/**
 * Command Registry
 *
 * Central registry for all commands available in the command palette.
 * Provides registration, retrieval, and query capabilities.
 */

import type { Command, CommandGroup } from './types';

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private groups: Map<string, CommandGroup> = new Map();

  /**
   * Register a command
   */
  register(command: Command): void {
    if (this.commands.has(command.id)) {
      console.warn(`Command with id "${command.id}" is already registered. Overwriting.`);
    }
    this.commands.set(command.id, command);
  }

  /**
   * Register multiple commands
   */
  registerMany(commands: Command[]): void {
    commands.forEach((cmd) => this.register(cmd));
  }

  /**
   * Get a command by ID
   */
  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  /**
   * Get all commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get all visible commands (excludes hidden commands)
   * Use this for displaying commands in the command palette UI
   */
  getVisible(): Command[] {
    return Array.from(this.commands.values()).filter((cmd) => !cmd.hidden);
  }

  /**
   * Register a command group
   */
  registerGroup(group: CommandGroup): void {
    this.groups.set(group.id, group);
  }

  /**
   * Get all groups
   */
  getGroups(): CommandGroup[] {
    return Array.from(this.groups.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get commands by group
   */
  getCommandsByGroup(groupId: string): Command[] {
    return this.getAll().filter((cmd) => cmd.group === groupId);
  }

  /**
   * Clear all commands (useful for testing)
   */
  clear(): void {
    this.commands.clear();
    this.groups.clear();
  }
}

/**
 * Global command registry instance
 */
export const commandRegistry = new CommandRegistry();
