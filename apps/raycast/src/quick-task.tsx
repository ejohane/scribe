/**
 * Quick Task Command
 *
 * Add a task to today's daily note using a simple form.
 */

import { Action, ActionPanel, Form, showToast, Toast, popToRoot, Icon } from '@raycast/api';
import { useState } from 'react';
import { dailyAddTask } from './lib/cli';
import { getUserFriendlyError } from './lib/errors';

export default function QuickTask() {
  const [isLoading, setIsLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | undefined>();

  async function handleSubmit(values: { task: string }) {
    const { task } = values;

    // Validate input
    if (!task.trim()) {
      setTaskError('Task cannot be empty');
      return;
    }

    setIsLoading(true);
    setTaskError(undefined);

    try {
      const result = await dailyAddTask(task.trim());

      await showToast({
        style: Toast.Style.Success,
        title: result.created ? 'Created daily & added task' : 'Task added',
        message: result.task.text,
      });

      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to add task',
        message: getUserFriendlyError(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  function validateTask(value: string | undefined) {
    if (!value?.trim()) {
      setTaskError('Task cannot be empty');
    } else {
      setTaskError(undefined);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Task" icon={Icon.CheckCircle} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="task"
        title="Task"
        placeholder="What needs to be done?"
        autoFocus
        error={taskError}
        onChange={validateTask}
      />
      <Form.Description text="This will be added as a task to today's daily note." />
    </Form>
  );
}
