/**
 * Main application component.
 */

import { useState, useEffect, useMemo } from 'react';
import { CoreClient } from '@scribe/core-client';
import { Editor } from './components/Editor';
import { CommandPalette, type Command } from './components/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';

export function App() {
  const [coreClient] = useState(() => new CoreClient());
  const [isConnected, setIsConnected] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const { isOpen, close } = useCommandPalette();

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
    console.log('Content (JSON):', JSON.stringify(content));
    console.log('Content (raw):', content);
  };

  const handleSelectionChange = (start: number, end: number) => {
    // Selection tracking for reveal-on-cursor rendering (scribe-751)
    console.log('Selection:', start, end);
  };

  const handleOpenNote = async (noteId: string) => {
    try {
      const content = await coreClient.getNoteContent(noteId);
      setCurrentNoteId(noteId);
      // TODO: Update editor content when we have proper note loading
      console.log('Opening note:', noteId, content.length, 'chars');
    } catch (error) {
      console.error('Failed to open note:', error);
    }
  };

  // Define available commands
  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'new-note',
        label: 'New Note',
        description: 'Create a new note',
        keywords: ['create', 'add'],
        action: () => {
          console.log('Creating new note...');
          // TODO: Implement note creation
        },
      },
      {
        id: 'toggle-preview',
        label: 'Toggle Preview',
        description: 'Switch between edit and preview modes',
        keywords: ['view', 'mode'],
        action: () => {
          console.log('Toggling preview mode...');
          // TODO: Implement preview toggle
        },
      },
    ],
    []
  );

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
    <>
      <Editor
        initialContent=""
        onChange={handleContentChange}
        onSelectionChange={handleSelectionChange}
      />
      <CommandPalette
        coreClient={coreClient}
        isOpen={isOpen}
        onClose={close}
        onOpenNote={handleOpenNote}
        commands={commands}
      />
    </>
  );
}
