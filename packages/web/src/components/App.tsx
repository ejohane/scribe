/**
 * App component
 *
 * Root application component for Scribe Web client.
 */

import { type FC } from 'react';

export interface AppProps {
  /** Application title override (for testing) */
  title?: string;
}

export const App: FC<AppProps> = ({ title = 'Scribe Web' }) => {
  return (
    <div data-testid="app-root">
      <h1>{title}</h1>
      <p>Web client - not yet implemented</p>
    </div>
  );
};
