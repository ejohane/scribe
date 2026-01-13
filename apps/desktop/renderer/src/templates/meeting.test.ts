import { describe, it, expect } from 'vitest';
import { createMeetingContent, meetingTemplate } from './meeting';

describe('meetingTemplate', () => {
  describe('createMeetingContent', () => {
    it('creates content with empty paragraph (blank page)', () => {
      const content = createMeetingContent();
      expect(content.root.children).toHaveLength(1);
      expect((content.root.children[0] as any).type).toBe('paragraph');
    });

    it('has type: meeting on content', () => {
      const content = createMeetingContent();
      expect(content.type).toBe('meeting');
    });

    it('has no heading', () => {
      const content = createMeetingContent();
      const hasHeading = content.root.children.some((child: any) => child.type === 'heading');
      expect(hasHeading).toBe(false);
    });
  });

  describe('contextPanelConfig', () => {
    it('includes attendees section', () => {
      const hasAttendees = meetingTemplate.contextPanelConfig.sections.some(
        (s) => s.type === 'attendees'
      );
      expect(hasAttendees).toBe(true);
    });

    it('does not include calendar section', () => {
      const hasCalendar = meetingTemplate.contextPanelConfig.sections.some(
        (s) => s.type === 'calendar'
      );
      expect(hasCalendar).toBe(false);
    });
  });

  describe('generateTitle', () => {
    it('uses userInput when provided', () => {
      const title = meetingTemplate.generateTitle({ date: new Date(), userInput: 'Team Sync' });
      expect(title).toBe('Team Sync');
    });

    it('falls back to "Untitled Meeting" when no userInput', () => {
      const title = meetingTemplate.generateTitle({ date: new Date() });
      expect(title).toBe('Untitled Meeting');
    });
  });
});
