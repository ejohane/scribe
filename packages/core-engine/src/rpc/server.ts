/**
 * JSON-RPC server for Core Engine.
 */

/**
 * JSON-RPC request.
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id: string | number;
}

/**
 * JSON-RPC response.
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number;
}

/**
 * RPC handler function.
 */
export type RPCHandler = (params: unknown) => Promise<unknown> | unknown;

/**
 * JSON-RPC server that communicates via stdin/stdout.
 */
export class JSONRPCServer {
  private handlers = new Map<string, RPCHandler>();

  /**
   * Register a handler for a method.
   */
  register(method: string, handler: RPCHandler): void {
    this.handlers.set(method, handler);
  }

  /**
   * Start the JSON-RPC server.
   */
  async start(): Promise<void> {
    console.log('[RPC Server] Listening on stdin/stdout');

    // Read from stdin
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (chunk) => {
      try {
        const data = chunk.toString();
        const request = JSON.parse(data) as JSONRPCRequest;
        const response = await this.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        console.error('[RPC Server] Error processing request:', error);
      }
    });
  }

  /**
   * Stop the JSON-RPC server.
   */
  async stop(): Promise<void> {
    console.log('[RPC Server] Stopped');
  }

  /**
   * Handle a JSON-RPC request.
   */
  private async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const handler = this.handlers.get(request.method);

    if (!handler) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
        id: request.id,
      };
    }

    try {
      const result = await handler(request.params);
      return {
        jsonrpc: '2.0',
        result,
        id: request.id,
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error,
        },
        id: request.id,
      };
    }
  }
}
