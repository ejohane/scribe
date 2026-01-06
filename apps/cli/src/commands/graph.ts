import { Command } from 'commander';
import { createNoteId } from '@scribe/shared';
import { initializeContext, GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { noteNotFound } from '../errors.js';
import { getNoteUrl } from './notes-helpers.js';

export function registerGraphCommands(program: Command): void {
  const graph = program.command('graph').description('Graph operations');

  // backlinks <id>
  graph
    .command('backlinks')
    .description('Get notes that link TO a specific note')
    .argument('<id>', 'Note ID')
    .action(async (id: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const noteId = createNoteId(id);

      // Verify note exists
      let note;
      try {
        note = ctx.vault.read(noteId);
      } catch {
        throw noteNotFound(id);
      }

      const backlinks = ctx.graphEngine.backlinks(noteId);

      output(
        {
          note: { id: note.id, title: note.title, url: getNoteUrl(note.id) },
          backlinks: backlinks.map((n) => ({
            id: n.id,
            title: n.title,
            type: n.type,
            tags: n.tags || [],
            url: getNoteUrl(n.id),
          })),
          count: backlinks.length,
        },
        globalOpts
      );
    });

  // outlinks <id>
  graph
    .command('outlinks')
    .description('Get notes that a specific note links TO')
    .argument('<id>', 'Note ID')
    .action(async (id: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const noteId = createNoteId(id);

      let note;
      try {
        note = ctx.vault.read(noteId);
      } catch {
        throw noteNotFound(id);
      }

      // Use the outlinks() method
      const outlinks = ctx.graphEngine.outlinks(noteId);

      output(
        {
          note: { id: note.id, title: note.title, url: getNoteUrl(note.id) },
          outlinks: outlinks.map((n) => ({
            id: n.id,
            title: n.title,
            type: n.type,
            tags: n.tags || [],
            url: getNoteUrl(n.id),
          })),
          count: outlinks.length,
        },
        globalOpts
      );
    });

  // neighbors <id>
  graph
    .command('neighbors')
    .description('Get all notes connected to a specific note')
    .argument('<id>', 'Note ID')
    .action(async (id: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const noteId = createNoteId(id);

      let note;
      try {
        note = ctx.vault.read(noteId);
      } catch {
        throw noteNotFound(id);
      }

      const neighbors = ctx.graphEngine.neighbors(noteId);
      const backlinksSet = new Set(ctx.graphEngine.backlinks(noteId).map((n) => n.id));
      const outlinksSet = new Set(ctx.graphEngine.outlinks(noteId).map((n) => n.id));

      output(
        {
          note: { id: note.id, title: note.title, url: getNoteUrl(note.id) },
          neighbors: neighbors.map((n) => {
            const isIncoming = backlinksSet.has(n.id);
            const isOutgoing = outlinksSet.has(n.id);
            const direction =
              isIncoming && isOutgoing ? 'both' : isIncoming ? 'incoming' : 'outgoing';
            return {
              id: n.id,
              title: n.title,
              direction,
              type: 'link',
              url: getNoteUrl(n.id),
            };
          }),
          count: neighbors.length,
        },
        globalOpts
      );
    });

  // stats
  graph
    .command('stats')
    .description('Get vault-wide graph statistics')
    .action(async () => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const stats = ctx.graphEngine.getStats();
      const notes = ctx.vault.list();

      // Calculate additional stats
      const avgLinks = stats.nodes > 0 ? stats.edges / stats.nodes : 0;

      // Find most linked notes
      const linkCounts = new Map<string, number>();
      for (const note of notes) {
        const backlinks = ctx.graphEngine.backlinks(note.id);
        linkCounts.set(note.id, backlinks.length);
      }

      const mostLinked = Array.from(linkCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => {
          const note = ctx.vault.read(createNoteId(id));
          return { id, title: note.title, linkCount: count, url: getNoteUrl(id) };
        });

      // Count orphans
      let orphanCount = 0;
      for (const note of notes) {
        const backlinks = ctx.graphEngine.backlinks(note.id);
        const outlinks = ctx.graphEngine.outlinks(note.id);
        if (backlinks.length === 0 && outlinks.length === 0) {
          orphanCount++;
        }
      }

      output(
        {
          nodes: stats.nodes,
          edges: stats.edges,
          tags: stats.tags,
          avgLinksPerNote: Math.round(avgLinks * 10) / 10,
          mostLinked,
          orphanNotes: orphanCount,
        },
        globalOpts
      );
    });
}
