/**
 * Main application component.
 */

import { useState, useEffect } from 'react';
import { CoreClient } from '@scribe/core-client';

// Initialize Core Client
const coreClient = new CoreClient();

// Check if we're running in Electron
if (window.scribeAPI) {
  coreClient.initialize(async (message) => {
    return await window.scribeAPI.sendRPCRequest(message);
  });
}

export function App() {
  const [status, setStatus] = useState<string>('Connecting...');

  useEffect(() => {
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
  }, []);

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
