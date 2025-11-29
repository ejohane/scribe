import React, { useState, useEffect } from 'react';
import { Note } from './types';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import Editor from './components/Editor/Editor';
import CommandPalette from './components/CommandPalette';
import { Menu, Search, Sidebar as SidebarIcon } from 'lucide-react';

const generateId = () => Math.random().toString(36).substr(2, 9);

const INITIAL_NOTE: Note = {
  id: 'welcome-scribe',
  title: 'Welcome to Scribe',
  content: `
    <h1>Focus on your thoughts.</h1>
    <p>Scribe is designed to get out of your way.</p>
    <h2>Shortcuts</h2>
    <ul>
      <li><strong>CMD+K</strong>: Open Command Palette to search or create notes.</li>
      <li><strong>/</strong>: Use the slash command menu for formatting and AI.</li>
      <li><strong>@</strong>: Mention people.</li>
      <li><strong>[[</strong>: Link to other notes.</li>
    </ul>
    <blockquote>"Simplicity is the ultimate sophistication."</blockquote>
    <p><br/></p>
  `,
  updatedAt: Date.now(),
  tags: [],
};

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('zenith_notes');
    return saved ? JSON.parse(saved) : [INITIAL_NOTE];
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || '');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('scribe_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('zenith_notes', JSON.stringify(notes));
  }, [notes]);

  // Handle Theme Change
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('scribe_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('scribe_theme', 'light');
    }
  }, [isDarkMode]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsLeftSidebarOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsLeftSidebarOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        setIsRightSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  const handleUpdateNote = (id: string, content: string, title: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content, title, updatedAt: Date.now() } : n))
    );
  };

  const handleCreateNote = () => {
    const newNote: Note = {
      id: generateId(),
      title: '',
      content: '<p></p>',
      updatedAt: Date.now(),
      tags: [],
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
  };

  const handleDeleteNote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure?')) {
      const newNotes = notes.filter((n) => n.id !== id);
      setNotes(newNotes);
      if (activeNoteId === id && newNotes.length > 0) {
        setActiveNoteId(newNotes[0].id);
      } else if (newNotes.length === 0) {
        handleCreateNote();
      }
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-white dark:bg-gray-950 flex relative text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Left Sidebar (Note List) */}
      <Sidebar
        isOpen={isLeftSidebarOpen}
        notes={notes}
        activeNoteId={activeNoteId}
        onSelectNote={setActiveNoteId}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode((prev) => !prev)}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-full relative flex flex-col transition-all duration-300 ease-out">
        <div className="flex-1 overflow-y-auto scroll-smooth relative">
          {activeNote ? (
            <Editor
              key={activeNote.id}
              note={activeNote}
              allNotes={notes}
              onUpdate={handleUpdateNote}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 dark:text-gray-700">
              No note selected
            </div>
          )}
        </div>

        {/* Floating Action Dock (Centered in Main Area) */}
        <div className="group absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-0.5 p-0.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100/50 dark:border-gray-700/50 transition-all duration-300 ease-out scale-90 hover:scale-100 hover:gap-1 hover:p-1 hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)]">
          <button
            onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-0 group-hover:gap-1 p-1.5 rounded-full transition-all duration-200 ${
              isLeftSidebarOpen
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            title="Toggle Library (Cmd+J)"
          >
            <Menu size={14} />
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap transition-all duration-200 ease-out w-0 group-hover:w-auto overflow-hidden opacity-0 group-hover:opacity-100">
              ⌘J
            </span>
          </button>

          <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-0.5" />

          <button
            onClick={() => setIsPaletteOpen(true)}
            className="flex items-center gap-0 group-hover:gap-1 p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-200"
            title="Search (Cmd+K)"
          >
            <Search size={14} />
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap transition-all duration-200 ease-out w-0 group-hover:w-auto overflow-hidden opacity-0 group-hover:opacity-100">
              ⌘K
            </span>
          </button>

          <div className="w-px h-3 bg-gray-200 dark:bg-gray-700 mx-0.5" />

          <button
            onClick={() => setIsRightSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-0 group-hover:gap-1 p-1.5 rounded-full transition-all duration-200 ${
              isRightSidebarOpen
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            title="Toggle Context (Cmd+L)"
          >
            <SidebarIcon size={14} className="transform rotate-180" />
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap transition-all duration-200 ease-out w-0 group-hover:w-auto overflow-hidden opacity-0 group-hover:opacity-100">
              ⌘L
            </span>
          </button>
        </div>
      </main>

      {/* Right Sidebar (Context/Tools) */}
      <RightPanel isOpen={isRightSidebarOpen} />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        notes={notes}
        onSelectNote={setActiveNoteId}
        onCreateNote={handleCreateNote}
      />
    </div>
  );
};

export default App;
