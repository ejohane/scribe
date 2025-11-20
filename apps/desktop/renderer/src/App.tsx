/**
 * Main application component.
 */

import { useState, useEffect } from 'react';
import { CoreClient } from '@scribe/core-client';

// Declare the window.scribeAPI type
declare global {
  interface Window {
    scribeAPI?: {
      sendRPCRequest: (message: unknown) => Promise<unknown>;
    };
  }
}

export function App() {
  const [status, setStatus] = useState<string>('Connecting...');
  const [coreClient] = useState(() => new CoreClient());

  useEffect(() => {
    // Initialize Core Client when component mounts
    if (window.scribeAPI) {
      coreClient.initialize(async (message) => {
        return await window.scribeAPI!.sendRPCRequest(message);
      });
    } else {
      setStatus('Error: Not running in Electron environment');
      return;
    }

    // Test the connection to Core Engine
    const testConnection = async () => {
      try {
        const result = await coreClient.ping();
        setStatus(`Connected - ${result.status}`);
      } catch (error) {
        setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    testConnection();
  }, [coreClient]);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Scribe</h1>
      <p>Personal note-taking system</p>
      <p>
        <strong>Core Engine Status:</strong> {status}
      </p>
    </div>
  );
}
