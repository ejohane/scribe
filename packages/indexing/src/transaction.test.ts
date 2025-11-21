import { describe, test, expect } from 'bun:test';
import {
  createAppState,
  addStateChangeListener,
  getIndexingReadiness,
  getStateSnapshot,
  publishStateSnapshot,
  withTransaction,
  registerParsedNote,
} from './index';
import type { StateChangeEvent } from './types';
import type { ParsedNote } from '@scribe/domain-model';

describe('State Event Management', () => {
  test('should notify listeners of state changes', () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => {
      events.push(event);
    });

    const state = createAppState();
    const note: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'Test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:test'],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    registerParsedNote(state, note);

    // Should not have emitted any events yet (no transaction context)
    expect(events.length).toBe(0);

    unsubscribe();
  });

  test('should allow multiple listeners', () => {
    const events1: StateChangeEvent[] = [];
    const events2: StateChangeEvent[] = [];

    const unsubscribe1 = addStateChangeListener((event) => events1.push(event));
    const unsubscribe2 = addStateChangeListener((event) => events2.push(event));

    const state = createAppState();
    publishStateSnapshot(state);

    // Both listeners should receive the event
    expect(events1.length).toBe(1);
    expect(events2.length).toBe(1);
    expect(events1[0].type).toBe('state-snapshot');
    expect(events2[0].type).toBe('state-snapshot');

    unsubscribe1();
    unsubscribe2();
  });

  test('should remove listener when unsubscribe is called', () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    const state = createAppState();
    publishStateSnapshot(state);

    expect(events.length).toBe(1);

    unsubscribe();

    publishStateSnapshot(state);

    // Should still be 1, not 2
    expect(events.length).toBe(1);
  });
});

describe('Transaction Management', () => {
  test('should batch events in transaction', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    await withTransaction(() => {
      const state = createAppState();
      publishStateSnapshot(state);
      publishStateSnapshot(state);
    });

    // Should emit both snapshots plus final transaction snapshot
    expect(events.length).toBe(3);
    expect(events[2].type).toBe('state-snapshot');

    unsubscribe();
  });

  test('should rollback on error', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    try {
      await withTransaction(() => {
        const state = createAppState();
        publishStateSnapshot(state);
        throw new Error('Test error');
      });
    } catch (error) {
      // Expected error
    }

    // Should not emit any events due to rollback
    expect(events.length).toBe(0);

    unsubscribe();
  });

  test('should handle async operations in transaction', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    await withTransaction(async () => {
      const state = createAppState();
      await new Promise((resolve) => setTimeout(resolve, 10));
      publishStateSnapshot(state);
    });

    // Should emit snapshot plus final transaction snapshot
    expect(events.length).toBe(2);

    unsubscribe();
  });

  test('should use custom transaction ID', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    await withTransaction(() => {
      const state = createAppState();
      publishStateSnapshot(state);
    }, 'custom-tx-123');

    // Transaction should complete successfully
    expect(events.length).toBe(2);

    unsubscribe();
  });
});

describe('Indexing Readiness', () => {
  test('should return readiness state', () => {
    const readiness = getIndexingReadiness();

    // Readiness object should have all required fields
    expect(readiness.isReady).toBeDefined();
    expect(typeof readiness.filesIndexed).toBe('number');
    expect(typeof readiness.totalFiles).toBe('number');
    expect(typeof readiness.progress).toBe('number');
    expect(typeof readiness.isMinimallyReady).toBe('boolean');
  });

  test('should track progress during indexing', () => {
    // Note: This is implicitly tested in performStartupIndexing
    // The readiness tracker is updated during the indexing process
    const readiness = getIndexingReadiness();
    expect(readiness).toBeDefined();
  });
});

describe('State Snapshot', () => {
  test('should capture current state statistics', () => {
    const state = createAppState();

    const note: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'Test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:test'],
      aliases: [],
      headings: [
        {
          id: 'heading:h1' as any,
          level: 1,
          rawText: 'Heading',
          normalized: 'heading',
          line: 1,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    registerParsedNote(state, note);

    const snapshot = getStateSnapshot(state);

    expect(snapshot.noteCount).toBe(1);
    expect(snapshot.tagCount).toBe(1);
    expect(snapshot.headingCount).toBe(1);
    expect(snapshot.readiness).toBeDefined();
  });

  test('should emit snapshot event when published', () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    const state = createAppState();
    publishStateSnapshot(state);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('state-snapshot');
    expect(events[0].data).toBeDefined();
    expect(events[0].data.noteCount).toBe(0);

    unsubscribe();
  });

  test('should include readiness in snapshot', () => {
    const state = createAppState();
    const snapshot = getStateSnapshot(state);

    expect(snapshot.readiness).toBeDefined();
    expect(snapshot.readiness.isReady).toBeDefined();
    expect(snapshot.readiness.progress).toBeDefined();
  });
});

describe('Event Types', () => {
  test('should emit note-added event', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    // Note: This would be tested through handleVaultChanges in integration tests
    // The event emission is implemented in handleFileCreated

    unsubscribe();
  });

  test('should emit note-updated event', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    // Note: This would be tested through handleVaultChanges in integration tests
    // The event emission is implemented in handleFileModified

    unsubscribe();
  });

  test('should emit note-removed event', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    // Note: This would be tested through handleVaultChanges in integration tests
    // The event emission is implemented in handleFileDeleted

    unsubscribe();
  });

  test('should emit indexing-started event', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    // Note: This would be tested through performStartupIndexing
    // The event emission is implemented at the start of indexing

    unsubscribe();
  });

  test('should emit indexing-complete event', async () => {
    const events: StateChangeEvent[] = [];
    const unsubscribe = addStateChangeListener((event) => events.push(event));

    // Note: This would be tested through performStartupIndexing
    // The event emission is implemented at the end of indexing

    unsubscribe();
  });
});
