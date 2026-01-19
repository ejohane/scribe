/**
 * IconByName Component
 *
 * Renders a Lucide icon by name string.
 * This bridges the gap between plugin-defined icon names and actual icon components.
 *
 * @module
 */

import { ComponentType } from 'react';
import {
  SearchIcon,
  FileTextIcon,
  FilePlusIcon,
  PlusIcon,
  UserIcon,
  UsersIcon,
  CalendarIcon,
  SettingsIcon,
  CheckIcon,
  ListIcon,
  SparklesIcon,
} from '@scribe/design-system';

/**
 * Map of icon names to their component.
 * Add more icons here as needed.
 */
const iconMap: Record<string, ComponentType<{ size?: string | number; className?: string }>> = {
  Search: SearchIcon,
  FileText: FileTextIcon,
  FilePlus: FilePlusIcon,
  Plus: PlusIcon,
  User: UserIcon,
  Users: UsersIcon,
  Calendar: CalendarIcon,
  Settings: SettingsIcon,
  Check: CheckIcon,
  List: ListIcon,
  Sparkles: SparklesIcon,
};

export interface IconByNameProps {
  /** Icon name (Lucide icon name) */
  name: string;
  /** Icon size in pixels */
  size?: number;
  /** Optional className */
  className?: string;
}

/**
 * Render a Lucide icon by name.
 *
 * @example
 * ```tsx
 * <IconByName name="Search" size={16} />
 * ```
 */
export function IconByName({ name, size = 16, className }: IconByNameProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    // Fallback to FileText for unknown icons
    const FallbackIcon = iconMap['FileText'];
    return <FallbackIcon size={size} className={className} />;
  }

  return <IconComponent size={size} className={className} />;
}
