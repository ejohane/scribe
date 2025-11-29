import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Note, MenuType, MenuPosition, MOCK_USERS } from '../../types';
import FloatingMenu from './FloatingMenu';
import SelectionMenu from './SelectionMenu';
import { generateTextContinuation, summarizeText } from '../../services/geminiService';
import { Loader2 } from 'lucide-react';

interface EditorProps {
  note: Note;
  allNotes: Note[];
  onUpdate: (id: string, content: string, title: string) => void;
}

const Editor: React.FC<EditorProps> = ({ note, allNotes, onUpdate }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  
  // Slash/Mention Menu State
  const [menuType, setMenuType] = useState<MenuType>(MenuType.HIDDEN);
  const [menuPos, setMenuPos] = useState<MenuPosition>({ top: 0, left: 0 });
  const [query, setQuery] = useState('');
  
  // Selection Toolbar State
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);

  const [isAiLoading, setIsAiLoading] = useState(false);

  // Sync state when switching notes
  useEffect(() => {
    setTitle(note.title);
    if (contentRef.current && contentRef.current.innerHTML !== note.content) {
      contentRef.current.innerHTML = note.content;
    }
  }, [note.id]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value);
    onUpdate(note.id, contentRef.current?.innerHTML || '', e.target.value);
    
    // Auto-resize title
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const saveContent = useCallback(() => {
    if (contentRef.current) {
      onUpdate(note.id, contentRef.current.innerHTML, title);
    }
  }, [note.id, title, onUpdate]);

  // Handle Selection Change for Floating Toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      
      // If no selection or selection is collapsed (cursor only), hide menu
      if (!selection || selection.isCollapsed || !contentRef.current?.contains(selection.anchorNode)) {
        setSelectionPos(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Calculate center position above selection
      setSelectionPos({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  // Monitor cursor position and text triggers for Slash commands
  const handleInput = () => {
    saveContent();
    checkTriggers();
  };

  const checkTriggers = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    // We only care about text nodes
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const cursorOffset = range.startOffset;

    // Check for trigger characters before cursor
    const textBeforeCursor = text.slice(0, cursorOffset);
    
    const slashMatch = textBeforeCursor.match(/\/(\w*)$/);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    const linkMatch = textBeforeCursor.match(/\[\[([\w\s]*)$/);

    let match = null;
    let type = MenuType.HIDDEN;

    if (slashMatch) {
      match = slashMatch;
      type = MenuType.SLASH;
    } else if (mentionMatch) {
      match = mentionMatch;
      type = MenuType.MENTION;
    } else if (linkMatch) {
      match = linkMatch;
      type = MenuType.LINK;
    }

    if (match) {
      const rect = range.getBoundingClientRect();
      setMenuPos({ top: rect.bottom, left: rect.left });
      setMenuType(type);
      setQuery(match[1]);
      // If typing a command, hide selection menu
      setSelectionPos(null);
    } else {
      setMenuType(MenuType.HIDDEN);
    }
  };

  const handleFormat = (format: string) => {
    if (format === 'bold') document.execCommand('bold');
    else if (format === 'italic') document.execCommand('italic');
    else if (format === 'underline') document.execCommand('underline');
    else if (format === 'strike') document.execCommand('strikethrough');
    else if (format === 'h1') document.execCommand('formatBlock', false, 'H1');
    else if (format === 'h2') document.execCommand('formatBlock', false, 'H2');
    else if (format === 'highlight') document.execCommand('backColor', false, '#fef3c7'); // yellow-100
    else if (format === 'link') {
        const url = prompt('Enter link URL:');
        if (url) document.execCommand('createLink', false, url);
    }
    else if (format === 'ai-edit') {
        // Placeholder for AI edit on selection
        const selection = window.getSelection();
        if (selection) {
            const text = selection.toString();
            // In a real app, this would open an AI dialog
            alert(`AI would edit: "${text}"`);
        }
    }
    
    saveContent();
  };

  const handleMenuSelect = async (item: any) => {
    const selection = window.getSelection();
    if (!selection || !contentRef.current) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    let triggerLength = 1; 
    if (menuType === MenuType.LINK) triggerLength = 2; 

    const deleteCount = query.length + triggerLength;

    try {
        range.setStart(node, range.endOffset - deleteCount);
        range.deleteContents();
    } catch (e) {
        // Fallback
    }

    if (menuType === MenuType.SLASH) {
      if (item.id === 'ai-continue') {
        setIsAiLoading(true);
        setMenuType(MenuType.HIDDEN);
        
        const fullText = contentRef.current.innerText;
        const aiText = await generateTextContinuation(fullText);
        
        document.execCommand('insertText', false, aiText);
        setIsAiLoading(false);
        saveContent();
        return;
      }
      
      if (item.id === 'ai-summarize') {
        setIsAiLoading(true);
        setMenuType(MenuType.HIDDEN);
        const fullText = contentRef.current.innerText;
        const summary = await summarizeText(fullText);
        
        const summaryHtml = `<div class="bg-gray-50 dark:bg-gray-800 p-6 rounded-md my-6 border-l-4 border-gray-900 dark:border-gray-100 text-gray-700 dark:text-gray-300 italic font-serif"><div class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">AI Summary</div>${summary}</div><p><br/></p>`;
        document.execCommand('insertHTML', false, summaryHtml);
        setIsAiLoading(false);
        saveContent();
        return;
      }

      if (['h1', 'h2', 'bullet', 'todo', 'quote'].includes(item.id)) {
        if (item.id === 'h1') document.execCommand('formatBlock', false, 'H1');
        else if (item.id === 'h2') document.execCommand('formatBlock', false, 'H2');
        else if (item.id === 'bullet') document.execCommand('insertUnorderedList', false);
        else if (item.id === 'quote') document.execCommand('formatBlock', false, 'BLOCKQUOTE');
        else if (item.id === 'todo') {
             const checkbox = `<ul style="list-style-type: none; padding-left: 0;"><li><input type="checkbox" class="mr-2 accent-black dark:accent-white" /> </li></ul>`;
             document.execCommand('insertHTML', false, checkbox);
        }
      }
    } else if (menuType === MenuType.MENTION) {
      const mentionHtml = `<span class="mention" contenteditable="false">@${item.name}</span>&nbsp;`;
      document.execCommand('insertHTML', false, mentionHtml);
    } else if (menuType === MenuType.LINK) {
      const linkHtml = `<span class="page-link" contenteditable="false" data-id="${item.id}">${item.title}</span>&nbsp;`;
      document.execCommand('insertHTML', false, linkHtml);
    }

    setMenuType(MenuType.HIDDEN);
    saveContent();
  };

  return (
    <div className="w-full max-w-2xl mx-auto pt-24 pb-48 px-6 sm:px-0 animate-fade-in relative">
       {isAiLoading && (
        <div className="fixed bottom-10 right-10 bg-black dark:bg-white text-white dark:text-black shadow-xl rounded-full px-5 py-3 flex items-center gap-3 animate-slide-up z-50">
          <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={18} />
          <span className="text-sm font-medium">Scribe is thinking...</span>
        </div>
      )}

      {/* Title Input */}
      <textarea
        placeholder="Untitled"
        value={title}
        onChange={handleTitleChange}
        rows={1}
        className="w-full text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 placeholder-gray-200 dark:placeholder-gray-700 border-none outline-none bg-transparent mb-8 resize-none overflow-hidden font-serif"
        style={{ minHeight: '3rem' }}
      />

      {/* Rich Text Area */}
      <div
        ref={contentRef}
        contentEditable
        onInput={handleInput}
        onKeyUp={checkTriggers}
        onKeyDown={(e) => {
           if (e.key === 'Tab') {
             e.preventDefault();
             document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
           }
        }}
        className="editor-content prose prose-lg prose-slate dark:prose-invert focus:outline-none min-h-[60vh] max-w-none text-gray-700 dark:text-gray-300 leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/30 selection:text-blue-900 dark:selection:text-blue-200"
        suppressContentEditableWarning
      />

      <FloatingMenu 
        type={menuType} 
        position={menuPos} 
        users={MOCK_USERS} 
        notes={allNotes.filter(n => n.id !== note.id && n.title.toLowerCase().includes(query.toLowerCase()))}
        onSelect={handleMenuSelect}
        onClose={() => setMenuType(MenuType.HIDDEN)}
      />

      <SelectionMenu 
        position={selectionPos}
        onFormat={handleFormat}
      />
    </div>
  );
};

export default Editor;