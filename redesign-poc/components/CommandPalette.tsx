import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, FileText, CornerDownLeft } from 'lucide-react';
import { Note } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  isOpen, 
  onClose, 
  notes, 
  onSelectNote, 
  onCreateNote 
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(query.toLowerCase()) ||
    n.content.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5); // Limit results

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredNotes.length + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filteredNotes.length + 1)) % (filteredNotes.length + 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex === filteredNotes.length) {
          onCreateNote();
        } else {
          onSelectNote(filteredNotes[selectedIndex].id);
        }
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredNotes, selectedIndex, onSelectNote, onCreateNote, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-slide-up transform ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <Search size={18} className="text-gray-400 dark:text-gray-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search notes or create new..."
            className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 h-8"
            value={query}
            onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
            }}
          />
          <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-500 dark:text-gray-400 font-medium">ESC</div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filteredNotes.length === 0 && query && (
             <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-600">
                No matching notes found.
             </div>
          )}

          {filteredNotes.map((note, index) => (
            <div
              key={note.id}
              onClick={() => { onSelectNote(note.id); onClose(); }}
              className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${
                index === selectedIndex ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <FileText size={16} className="text-gray-400 dark:text-gray-500" />
              <div className="flex-1 truncate">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{note.title || 'Untitled'}</div>
              </div>
              {index === selectedIndex && <CornerDownLeft size={14} className="text-gray-400" />}
            </div>
          ))}

          {/* Create New Option (Always visible or at bottom) */}
          <div
            onClick={() => { onCreateNote(); onClose(); }}
            className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center gap-3 transition-colors border-t border-gray-50 dark:border-gray-800 mt-1 ${
              selectedIndex === filteredNotes.length ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedIndex === filteredNotes.length ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                 <Plus size={16} />
            </div>
            <div className="flex-1 font-medium text-sm">Create "{query || 'New Note'}"</div>
            {selectedIndex === filteredNotes.length && <CornerDownLeft size={14} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;