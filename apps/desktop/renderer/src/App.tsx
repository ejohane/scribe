/**
 * Main application component.
 */

import { useState, useEffect } from 'react';
import { CoreClient } from '@scribe/core-client';
import { Editor } from './components/Editor';

export function App() {
  const [coreClient] = useState(() => new CoreClient());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize Core Client when component mounts
    coreClient.initialize(async (message) => {
      return await window.scribeAPI.sendRPCRequest(message);
    });

    // Test the connection to Core Engine
    const testConnection = async () => {
      try {
        await coreClient.ping();
        setIsConnected(true);
      } catch (error) {
        console.error('Core Engine connection failed:', error);
        setIsConnected(false);
      }
    };

    testConnection();
  }, [coreClient]);

  const handleContentChange = (content: string) => {
    // TODO: Will implement autosave in scribe-752
    console.log('Content changed:', content.length, 'characters');
  };

  const handleSelectionChange = (start: number, end: number) => {
    // Selection tracking for reveal-on-cursor rendering (scribe-751)
    console.log('Selection:', start, end);
  };

  if (!isConnected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'system-ui',
          color: '#666',
        }}
      >
        Connecting to Core Engine...
      </div>
    );
  }

  return (
    <Editor
      initialContent="# Welcome to Scribe\n\nStart typing..."
      onChange={handleContentChange}
      onSelectionChange={handleSelectionChange}
    />
  );
}
