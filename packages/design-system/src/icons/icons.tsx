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
  ArrowRight as ArrowRightIcon,
  // Calendar icons for daily notes and meetings
  CalendarPlus as CalendarPlusIcon,
  CalendarCheck as CalendarCheckIcon,
  CalendarDays as CalendarDaysIcon,
  // Utility icons
  Trash2 as TrashIcon,
  // Context panel icons
  Users as UsersIcon,
  ExternalLink as ExternalLinkIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  Calendar as CalendarIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  GripVertical as GripVerticalIcon,
  Check as CheckIcon,
  // Settings icon for settings page
  Settings as SettingsIcon,
  // Navigation icons for modals
  ChevronLeft as ChevronLeftIcon,
  // Copy icons
  Copy as CopyIcon,
  // Sync conflict icons
  RefreshCw as RefreshIcon,
  AlertTriangle as AlertIcon,
  // Sync settings icons
  Cloud as CloudIcon,
  LogOut as LogOutIcon,
} from 'lucide-react';

// Re-export LucideProps as IconComponentProps for backwards compatibility
export type { LucideProps as IconComponentProps } from 'lucide-react';
