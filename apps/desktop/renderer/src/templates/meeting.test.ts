import { describe, it, expect } from 'vitest';
import { createMeetingContent, meetingTemplate } from './meeting';

describe('meetingTemplate', () => {
  describe('createMeetingContent', () => {
    it('creates content with 3 H3 sections', () => {
      const content = createMeetingContent();
      const headings = content.root.children.filter(
        (child: any) => child.type === 'heading' && child.tag === 'h3'
      );
      expect(headings).toHaveLength(3);
    });

    it('has Pre-Read, Notes, Action Items sections in order', () => {
      const content = createMeetingContent();
      const headingTexts = content.root.children
        .filter((child: any) => child.type === 'heading')
        .map((h: any) => h.children[0].text);
      expect(headingTexts).toEqual(['Pre-Read', 'Notes', 'Action Items']);
    });

    it('each section is followed by a bullet list', () => {
      const content = createMeetingContent();
      const children = content.root.children;
      // Pattern: heading, list, heading, list, heading, list
      expect((children[0] as any).type).toBe('heading');
      expect((children[1] as any).type).toBe('list');
      expect((children[2] as any).type).toBe('heading');
      expect((children[3] as any).type).toBe('list');
      expect((children[4] as any).type).toBe('heading');
      expect((children[5] as any).type).toBe('list');
    });

    it('has type: meeting on content', () => {
      const content = createMeetingContent();
      expect(content.type).toBe('meeting');
    });

    it('has no H1 heading', () => {
      const content = createMeetingContent();
      const hasH1 = content.root.children.some(
        (child: any) => child.type === 'heading' && child.tag === 'h1'
      );
      expect(hasH1).toBe(false);
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
