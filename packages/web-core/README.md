# @scribe/app-shell

Shared React components and providers for Scribe applications.

## Overview

The app-shell package provides the shared UI layer that both web and Electron apps use. It abstracts away platform differences and provides a consistent API for building Scribe clients.

## Installation

```bash
bun add @scribe/app-shell
```

## Usage

```typescript
import {
  ScribeProvider,
  PlatformProvider,
  NoteListPage,
  NoteEditorPage,
} from '@scribe/app-shell';
```

### Basic Setup (Web)

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider, PlatformProvider, NoteListPage, NoteEditorPage } from '@scribe/app-shell';

function App() {
  return (
    <BrowserRouter>
      <PlatformProvider platform="web" capabilities={{}}>
        <ScribeProvider daemonUrl="http://localhost:47900">
          <Routes>
            <Route path="/" element={<NoteListPage />} />
            <Route path="/note/:id" element={<NoteEditorPage renderEditor={renderEditor} />} />
          </Routes>
        </ScribeProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
}
```

### Basic Setup (Electron)

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ScribeProvider, PlatformProvider, NoteListPage, NoteEditorPage } from '@scribe/app-shell';

function App() {
  const [daemonPort, setDaemonPort] = useState<number | null>(null);

  useEffect(() => {
    window.scribe.scribe.getDaemonPort().then(setDaemonPort);
  }, []);

  if (!daemonPort) return <div>Loading...</div>;

  const capabilities: PlatformCapabilities = {
    window: {
      openNewWindow: () => window.scribe.window.new(),
      openNoteInWindow: (id) => window.scribe.window.openNote(id),
      close: () => window.scribe.window.close(),
    },
    dialog: {
      selectFolder: () => window.scribe.dialog.selectFolder(),
    },
    // ... other capabilities
  };

  return (
    <HashRouter>
      <PlatformProvider platform="electron" capabilities={capabilities}>
        <ScribeProvider daemonUrl={`http://localhost:${daemonPort}`}>
          <Routes>
            <Route path="/" element={<NoteListPage />} />
            <Route path="/note/:id" element={<NoteEditorPage renderEditor={renderEditor} />} />
          </Routes>
        </ScribeProvider>
      </PlatformProvider>
    </HashRouter>
  );
}
```

## Components

### Providers

#### ScribeProvider
Sets up tRPC client and React Query for data fetching.

```tsx
<ScribeProvider daemonUrl="http://localhost:47900">
  {children}
</ScribeProvider>
```

Props:
- `daemonUrl` - URL of the Scribe daemon

#### PlatformProvider
Provides platform abstraction for native features.

```tsx
<PlatformProvider platform="web" capabilities={capabilities}>
  {children}
</PlatformProvider>
```

Props:
- `platform` - Either `"web"` or `"electron"`
- `capabilities` - Platform-specific feature implementations

### Pages

#### NoteListPage
Displays a list of all notes with search and filtering.

```tsx
<Route path="/" element={<NoteListPage />} />
```

#### NoteEditorPage
Note editing view with title and content editor.

```tsx
<Route
  path="/note/:id"
  element={<NoteEditorPage renderEditor={renderEditor} />}
/>
```

Props:
- `renderEditor` - Function to render the editor component

## Hooks

### useScribe
Access the tRPC client instance.

```tsx
const { api } = useScribe();
const notes = api.notes.list.useQuery();
```

### usePlatform
Access platform capabilities.

```tsx
const { platform, capabilities } = usePlatform();

if (capabilities.window?.openNewWindow) {
  capabilities.window.openNewWindow();
}
```

## Platform Capabilities

The `PlatformCapabilities` interface defines optional features that platforms can provide:

```typescript
interface PlatformCapabilities {
  window?: {
    openNewWindow: () => void;
    openNoteInWindow: (id: string) => void;
    close: () => void;
  };
  dialog?: {
    selectFolder: () => Promise<string | undefined>;
    saveFile: (content: string, filename: string) => Promise<boolean>;
  };
  shell?: {
    openExternal: (url: string) => void;
  };
  update?: {
    check: () => void;
    install: () => void;
    onAvailable: (callback: (info: UpdateInfo) => void) => () => void;
  };
}
```

Web apps typically provide empty capabilities (or browser-based alternatives), while Electron apps provide native implementations via IPC.

## Dependencies

### Peer Dependencies
- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `react-router-dom` >= 6.0.0
- `@tanstack/react-query` >= 5.0.0
- `@trpc/client` >= 10.0.0

### Internal Dependencies
- `@scribe/client-sdk` - tRPC client and types
