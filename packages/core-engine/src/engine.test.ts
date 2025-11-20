import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { CoreEngine } from './engine';

describe('CoreEngine', () => {
  let engine: CoreEngine;

  beforeEach(() => {
    engine = new CoreEngine();
  });

  afterEach(async () => {
    if (engine) {
      await engine.stop();
    }
  });

  test('should create CoreEngine instance', () => {
    expect(engine).toBeDefined();
  });

  test('should start and stop successfully', async () => {
    await engine.start();
    await engine.stop();
  });

  test('should create CoreEngine with vault path', () => {
    const engineWithVault = new CoreEngine({ vaultPath: '/path/to/vault' });
    expect(engineWithVault).toBeDefined();
  });
});
