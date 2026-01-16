/**
 * E2E Test Application for ScribeEditor
 *
 * This is a standalone React application that renders the ScribeEditor
 * for end-to-end browser testing.
 */

import { createRoot } from 'react-dom/client';
import { ScribeEditor, type EditorContent } from '../src/components/ScribeEditor';

function TestApp() {
  const handleChange = (content: EditorContent) => {
    // Log content changes for debugging
    console.log('Content changed:', JSON.stringify(content).substring(0, 100) + '...');
  };

  return (
    <ScribeEditor
      onChange={handleChange}
      placeholder="Start typing to test the editor..."
      autoFocus={true}
    />
  );
}

const container = document.getElementById('editor-container');
if (container) {
  createRoot(container).render(<TestApp />);
}
