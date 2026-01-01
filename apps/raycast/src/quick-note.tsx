/**
 * Quick Note Command
 *
 * Append text to today's daily note using a simple form.
 */

import { Action, ActionPanel, Form, showToast, Toast, popToRoot, Icon } from '@raycast/api';
import { useState } from 'react';
import { dailyAppend } from './lib/cli';
import { getUserFriendlyError } from './lib/errors';

export default function QuickNote() {
  const [isLoading, setIsLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | undefined>();

  async function handleSubmit(values: { note: string }) {
    const { note } = values;

    // Validate input
    if (!note.trim()) {
      setNoteError('Note cannot be empty');
      return;
    }

    setIsLoading(true);
    setNoteError(undefined);

    try {
      const result = await dailyAppend(note.trim());

      await showToast({
        style: Toast.Style.Success,
        title: result.created ? 'Created daily & added note' : 'Note added',
        message: `Added to ${result.note.title}`,
      });

      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to add note',
        message: getUserFriendlyError(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  function validateNote(value: string | undefined) {
    if (!value?.trim()) {
      setNoteError('Note cannot be empty');
    } else {
      setNoteError(undefined);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Note" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="note"
        title="Note"
        placeholder="What's on your mind?"
        autoFocus
        error={noteError}
        onChange={validateNote}
      />
      <Form.Description text="This will be appended to today's daily note." />
    </Form>
  );
}
