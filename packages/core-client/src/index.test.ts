import { describe, test, expect, mock } from 'bun:test';
import { CoreClient } from './index';

describe('CoreClient', () => {
  test('should initialize with a message sender', () => {
    const client = new CoreClient();
    const mockSender = mock(() => Promise.resolve({}));

    client.initialize(mockSender);
    expect(client).toBeDefined();
  });

  test('should throw error if not initialized', async () => {
    const client = new CoreClient();

    await expect(client.ping()).rejects.toThrow('CoreClient not initialized');
  });

  test('should send ping request', async () => {
    const client = new CoreClient();
    const mockResponse = { status: 'ok', timestamp: Date.now() };

    const mockSender = mock(() =>
      Promise.resolve({
        jsonrpc: '2.0',
        result: mockResponse,
        id: 1,
      })
    );

    client.initialize(mockSender);
    const response = await client.ping();

    expect(response.status).toBe('ok');
    expect(mockSender).toHaveBeenCalled();
  });

  test('should send search request', async () => {
    const client = new CoreClient();
    const mockResults = [
      { noteId: 'note:test.md', score: 1.0, matchType: 'title', note: {} as any },
    ];

    const mockSender = mock(() =>
      Promise.resolve({
        jsonrpc: '2.0',
        result: mockResults,
        id: 1,
      })
    );

    client.initialize(mockSender);
    const results = await client.search('test');

    expect(results).toHaveLength(1);
    expect(mockSender).toHaveBeenCalled();
  });

  test('should handle error responses', async () => {
    const client = new CoreClient();

    const mockSender = mock(() =>
      Promise.resolve({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id: 1,
      })
    );

    client.initialize(mockSender);

    await expect(client.ping()).rejects.toThrow('Method not found');
  });

  test('should increment request IDs', async () => {
    const client = new CoreClient();
    const calls: any[] = [];

    const mockSender = mock((message: any) => {
      calls.push(message);
      return Promise.resolve({
        jsonrpc: '2.0',
        result: { status: 'ok', timestamp: Date.now() },
        id: message.id,
      });
    });

    client.initialize(mockSender);

    await client.ping();
    await client.ping();

    expect(calls[0].id).toBe(1);
    expect(calls[1].id).toBe(2);
  });
});
