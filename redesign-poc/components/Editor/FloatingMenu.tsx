import React, { useEffect, useRef, useState } from 'react';
import { MenuType, User, Note } from '../../types';
import { 
  Type, 
  Heading1, 
  Heading2, 
  List, 
  CheckSquare, 
  Sparkles, 
  FileText, 
  User as UserIcon,
  Quote
} from 'lucide-react';

interface FloatingMenuProps {
  type: MenuType;
  position: { top: number; left: number };
  users: User[];
  notes: Note[];
  onSelect: (item: any) => void;
  onClose: () => void;
}

const FloatingMenu: React.FC<FloatingMenuProps> = ({ 
  type, 
  position, 
  users, 
  notes, 
  onSelect, 
  onClose 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const slashCommands = [
    { id: 'text', label: 'Text', icon: <Type size={14} />, description: 'Plain text' },
    { id: 'h1', label: 'Heading 1', icon: <Heading1 size={14} />, description: 'Large section' },
    { id: 'h2', label: 'Heading 2', icon: <Heading2 size={14} />, description: 'Medium section' },
    { id: 'bullet', label: 'List', icon: <List size={14} />, description: 'Bullet points' },
    { id: 'todo', label: 'To-do', icon: <CheckSquare size={14} />, description: 'Checklist' },
    { id: 'quote', label: 'Quote', icon: <Quote size={14} />, description: 'Capture a quote' },
    { id: 'ai-continue', label: 'Continue', icon: <Sparkles size={14} className="text-yellow-600 dark:text-yellow-500" />, description: 'AI generation' },
    { id: 'ai-summarize', label: 'Summarize', icon: <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />, description: 'AI summary' },
  ];

  const getItems = () => {
    switch (type) {
      case MenuType.SLASH: return slashCommands;
      case MenuType.MENTION: return users;
      case MenuType.LINK: return notes;
      default: return [];
    }
  };

  const items = getItems();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (type === MenuType.HIDDEN) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(items[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [type, items, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [type]);

  if (type === MenuType.HIDDEN) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 w-64 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-100/50 dark:border-gray-700/50 overflow-hidden flex flex-col max-h-72 animate-fade-in"
      style={{ top: position.top + 12, left: position.left }}
    >
      <div className="overflow-y-auto p-1.5">
        {items.map((item: any, index: number) => (
          <button
            key={item.id}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 rounded-lg transition-all duration-150 ${
              index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {type === MenuType.SLASH && (
              <>
                <div className={`w-8 h-8 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 shrink-0 ${index === selectedIndex ? 'bg-white dark:bg-gray-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-700'}`}>
                  {item.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{item.description}</div>
                </div>
              </>
            )}

            {type === MenuType.MENTION && (
               <>
                <div className="w-6 h-6 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full shrink-0">
                  <UserIcon size={12} />
                </div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</div>
               </>
            )}

            {type === MenuType.LINK && (
               <>
                <div className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded shrink-0">
                  <FileText size={12} />
                </div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.title || 'Untitled'}</div>
               </>
            )}
          </button>
        ))}
        {items.length === 0 && (
          <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">No results</div>
        )}
      </div>
    </div>
  );
};

export default FloatingMenu;