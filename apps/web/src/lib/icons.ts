/**
 * Icon Mapping Utility
 *
 * Maps icon names from plugin manifests to Lucide React icon components.
 * Provides a fallback icon for unknown icon names.
 *
 * @module
 */

import {
  FileText,
  Search,
  CheckSquare,
  Calendar,
  Clock,
  Tag,
  Folder,
  Star,
  Heart,
  Bookmark,
  Hash,
  List,
  ListTodo,
  Settings,
  User,
  Users,
  Bell,
  Mail,
  MessageSquare,
  Image,
  Link,
  Globe,
  Code,
  Terminal,
  Database,
  Cloud,
  Download,
  Upload,
  Share,
  Pencil,
  Trash2,
  Plus,
  Minus,
  X,
  Check,
  AlertCircle,
  Info,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

/**
 * Map of icon names to Lucide icon components.
 *
 * Icon names are case-insensitive for convenience.
 * Names can be in either kebab-case (file-text) or PascalCase (FileText).
 */
const iconMap: Record<string, LucideIcon> = {
  // Document icons
  'file-text': FileText,
  filetext: FileText,
  search: Search,

  // Task/Todo icons
  'check-square': CheckSquare,
  checksquare: CheckSquare,
  list: List,
  'list-todo': ListTodo,
  listtodo: ListTodo,

  // Time icons
  calendar: Calendar,
  clock: Clock,

  // Organization icons
  tag: Tag,
  folder: Folder,
  hash: Hash,

  // Interaction icons
  star: Star,
  heart: Heart,
  bookmark: Bookmark,

  // Settings/User icons
  settings: Settings,
  user: User,
  users: Users,

  // Communication icons
  bell: Bell,
  mail: Mail,
  'message-square': MessageSquare,
  messagesquare: MessageSquare,

  // Media icons
  image: Image,
  link: Link,
  globe: Globe,

  // Dev icons
  code: Code,
  terminal: Terminal,
  database: Database,

  // Cloud/Transfer icons
  cloud: Cloud,
  download: Download,
  upload: Upload,
  share: Share,

  // Action icons
  pencil: Pencil,
  edit: Pencil,
  'trash-2': Trash2,
  trash2: Trash2,
  trash: Trash2,
  plus: Plus,
  minus: Minus,
  x: X,
  close: X,
  check: Check,

  // Status icons
  'alert-circle': AlertCircle,
  alertcircle: AlertCircle,
  alert: AlertCircle,
  info: Info,
  'help-circle': HelpCircle,
  helpcircle: HelpCircle,
  help: HelpCircle,
};

/**
 * Get a Lucide icon component by name.
 *
 * Supports both kebab-case (file-text) and PascalCase (FileText) names.
 * Returns FileText as a fallback if the icon name is not found.
 *
 * @param name - The icon name from a plugin manifest
 * @returns The corresponding Lucide icon component
 *
 * @example
 * ```tsx
 * import { getIcon } from '@/lib/icons';
 *
 * function SidebarTab({ iconName }: { iconName: string }) {
 *   const Icon = getIcon(iconName);
 *   return <Icon className="h-4 w-4" />;
 * }
 * ```
 */
export function getIcon(name: string): LucideIcon {
  // Normalize the name to lowercase for lookup
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  return iconMap[normalizedName] ?? FileText;
}

/**
 * Check if an icon name is recognized.
 *
 * @param name - The icon name to check
 * @returns true if the icon exists in the map, false otherwise
 */
export function hasIcon(name: string): boolean {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  return normalizedName in iconMap;
}

/**
 * Get all available icon names.
 *
 * @returns Array of all recognized icon names
 */
export function getAvailableIcons(): string[] {
  return Object.keys(iconMap);
}
