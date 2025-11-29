import React from 'react';
import { Note } from '../types';
import { Plus, X, Moon, Sun } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SidebarProps {
  isOpen: boolean;
  notes: Note[];
  activeNoteId: string;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (e: React.MouseEvent, id: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen,
  notes, 
  activeNoteId, 
  onSelectNote, 
  onCreateNote,
  onDeleteNote,
  isDarkMode,
  toggleTheme
}) => {
  return (
    <aside 
      className={`
        h-full bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-xl flex-shrink-0 border-r border-transparent dark:border-gray-800/50 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${isOpen ? 'w-80 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-10 overflow-hidden'}
      `}
    >
      <div className="w-80 h-full flex flex-col">
        {/* Header */}
        <div className="p-6 pt-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-serif tracking-tight text-gray-900 dark:text-gray-100">Scribe</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium tracking-wide">LIBRARY</p>
            </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
            <button 
                onClick={onCreateNote}
                className="w-full flex items-center gap-3 p-3 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-all duration-200 font-medium mb-6 group shadow-sm hover:shadow-md border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
            >
                <div className="w-8 h-8 rounded-full bg-gray-200/50 dark:bg-gray-700/50 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black flex items-center justify-center transition-all">
                    <Plus size={16} />
                </div>
                <span>New Note</span>
            </button>

            {notes.map(note => (
                <div 
                  key={note.id}
                  onClick={() => onSelectNote(note.id)}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      activeNoteId === note.id 
                      ? 'bg-white dark:bg-gray-800 shadow-sm ring-1 ring-black/5 dark:ring-white/5' 
                      : 'hover:bg-white/50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <h3 className={`font-medium text-sm mb-1 truncate pr-6 ${activeNoteId === note.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {note.title || 'Untitled'}
                  </h3>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                      {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
                  </div>
                  
                  {/* Delete button */}
                  <button
                      onClick={(e) => onDeleteNote(e, note.id)}
                      className={`absolute top-3 right-3 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100`}
                  >
                      <X size={12} />
                  </button>
                </div>
            ))}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-transparent dark:border-gray-800/50 flex items-center justify-between">
             <div className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity cursor-default">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600" />
                 <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Guest User</div>
             </div>

             <button 
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 transition-all"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
             >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
             </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;