export interface Note {
  id: string;
  title: string;
  content: string; // HTML string
  updatedAt: number;
  tags: string[];
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export enum MenuType {
  SLASH = 'SLASH',
  MENTION = 'MENTION',
  LINK = 'LINK',
  HIDDEN = 'HIDDEN'
}

export interface MenuPosition {
  top: number;
  left: number;
}

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Alice Chen' },
  { id: '2', name: 'Bob Smith' },
  { id: '3', name: 'Charlie Kim' },
  { id: '4', name: 'Diana Prince' },
];