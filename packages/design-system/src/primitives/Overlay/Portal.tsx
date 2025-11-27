import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: ReactNode;
  container?: Element | null;
}

export function Portal({ children, container }: PortalProps) {
  // SSR safety - return null if window is not available
  if (typeof window === 'undefined') {
    return null;
  }

  const target = container ?? (typeof document !== 'undefined' ? document.body : null);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}
