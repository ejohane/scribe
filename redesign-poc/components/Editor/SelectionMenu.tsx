import React from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  Link as LinkIcon, 
  Sparkles,
  Highlighter
} from 'lucide-react';

interface SelectionMenuProps {
  position: { top: number; left: number } | null;
  onFormat: (format: string) => void;
}

// Keyboard shortcut mapping
const shortcuts: Record<string, string> = {
  bold: '⌘B',
  italic: '⌘I',
  underline: '⌘U',
  strike: '⌘⇧X',
  h1: '⌘⌥1',
  h2: '⌘⌥2',
  highlight: '⌘⇧H',
  link: '⌘K',
};

const SelectionMenu: React.FC<SelectionMenuProps> = ({ position, onFormat }) => {
  if (!position) return null;

  const Button = ({ id, icon: Icon, active = false }: { id: string; icon: any; active?: boolean }) => {
    const shortcut = shortcuts[id];
    
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFormat(id);
        }}
        className={`flex items-center gap-1 p-1.5 rounded transition-all duration-200 ${
          active 
            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
        }`}
      >
        <Icon size={16} strokeWidth={2.5} />
        {shortcut && (
          <span className="shortcut-hint text-[10px] font-medium text-gray-400 dark:text-gray-500 overflow-hidden transition-all duration-200 ease-out max-w-0 opacity-0">
            {shortcut}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <style>{`
        .selection-menu:hover .shortcut-hint {
          max-width: 40px;
          opacity: 1;
          margin-left: 2px;
        }
      `}</style>
      <div
        className="selection-menu fixed z-50 flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200 transition-all"
        style={{
          top: position.top - 50, // Position above selection
          left: position.left,
          transform: 'translateX(-50%)',
        }}
        onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
      >
        <div className="flex items-center gap-0.5 px-1">
          <Button id="bold" icon={Bold} />
          <Button id="italic" icon={Italic} />
          <Button id="underline" icon={Underline} />
          <Button id="strike" icon={Strikethrough} />
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        <div className="flex items-center gap-0.5 px-1">
          <Button id="h1" icon={Heading1} />
          <Button id="h2" icon={Heading2} />
          <Button id="highlight" icon={Highlighter} />
        </div>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />

        <div className="flex items-center gap-0.5 px-1">
          <Button id="link" icon={LinkIcon} />
          <button
              onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFormat('ai-edit');
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-tr from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold transition-all border border-purple-100/50 dark:border-purple-800/30"
          >
              <Sparkles size={12} />
              <span>Ask AI</span>
          </button>
        </div>
        
        {/* Little triangular arrow pointing down */}
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white dark:border-t-gray-800 drop-shadow-sm filter" />
      </div>
    </>
  );
};

export default SelectionMenu;