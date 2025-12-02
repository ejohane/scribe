/**
 * Shared Icon Components
 *
 * Re-exports from Lucide React icon library for consistent usage across the application.
 * All icons follow Lucide design patterns with configurable size.
 *
 * @example
 * import { SearchIcon, FileTextIcon } from '@scribe/design-system';
 *
 * <SearchIcon size={16} />
 * <FileTextIcon size={20} />
 */

// Re-export Lucide icons with our naming conventions
export {
  Search as SearchIcon,
  FileText as FileTextIcon,
  FilePlus as FilePlusIcon,
  Command as CommandIcon,
  CornerDownLeft as CornerDownLeftIcon,
  User as UserIcon,
  Menu as MenuIcon,
  PanelRight as PanelRightIcon,
  Plus as PlusIcon,
  Moon as MoonIcon,
  Sun as SunIcon,
  Type as TextIcon,
  Heading1 as Heading1Icon,
  Heading2 as Heading2Icon,
  Heading3 as Heading3Icon,
  List as ListIcon,
  ListTodo as CheckboxIcon,
  Quote as QuoteIcon,
  Sparkles as SparklesIcon,
  X as CloseIcon,
  // Additional icons that may be needed for SelectionToolbar
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Highlighter as HighlightIcon,
  Link as LinkIcon,
  // Navigation icons
  ArrowLeft as ArrowLeftIcon,
} from 'lucide-react';

// Re-export LucideProps as IconComponentProps for backwards compatibility
export type { LucideProps as IconComponentProps } from 'lucide-react';
