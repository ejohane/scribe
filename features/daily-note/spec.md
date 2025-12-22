# Feature: Daily Note Navigation

**Status**: Draft  
**Created**: 2024-12-21  
**Epic ID**: scribe-daily-nav

## Overview

Enhance the note header date display with navigation controls that allow users to quickly move between daily notes. Hovering over the date reveals chevron icons for navigating to previous/next day's notes, while clicking the date opens a Calendar popover to jump to any date's daily note.

> **Implementation Note**: This feature uses the `Calendar` component directly (not `DatePicker`) since `DatePicker` includes its own trigger button with a calendar icon. The `DateNavigator` component will manage its own trigger (the date text) and popover behavior.

---

## Strategic Context & Motivation

### Why This Feature Matters

Daily notes are the cornerstone of Scribe's journaling and capture workflow. Users often need to:

1. **Review recent days** - Check what was discussed yesterday or plan for tomorrow
2. **Find historical context** - Jump to a specific date to reference past decisions, meetings, or notes
3. **Navigate chronologically** - Move through a sequence of days when reviewing a project timeline

Currently, navigating between daily notes requires:
- Opening the command palette
- Typing to search
- Selecting the target date

This friction discourages the natural "flip through the calendar" workflow that physical journals and calendar apps provide.

### Design Philosophy

The navigation UI follows Scribe's "progressive disclosure" principle:
- **Default state**: Clean, minimal - just the date text
- **Hover state**: Reveals navigation affordances (chevrons)
- **Click state**: Opens full calendar for arbitrary date jumps

This keeps the interface uncluttered while making power features immediately discoverable.

### Relationship to Other Features

- **Templates System**: Daily notes use the `dailyTemplate` which already handles title generation. This feature extends that with richer display titles (Yesterday/Tomorrow).
- **Context Panel**: The calendar section in the context panel shows note distribution by date. This feature complements it with direct navigation.
- **Command Palette**: The existing `Go to Daily` command remains the keyboard-first way to jump dates. This feature adds a mouse-friendly alternative.

---

## Entry Points

| Trigger | Behavior |
| ------- | -------- |
| Hover over date in header | Reveals left/right chevron navigation icons |
| Click left chevron | Navigate to previous day's daily note (create if needed) |
| Click right chevron | Navigate to next day's daily note (create if needed) |
| Click date text | Opens Calendar popover for arbitrary date selection |

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Daily Note Navigation Flow                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │   User hovers    │
    │   over date      │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────────────────────────────────────┐
    │                                                   │
    │   [ < ]   Dec 21, 2024   [ > ]                   │
    │                                                   │
    │   Chevrons fade in on either side of date        │
    └──────────────────────────────────────────────────┘
             │
             ├────────────────────┬────────────────────┐
             │                    │                    │
             ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Click left  │      │ Click date  │      │ Click right │
    │ chevron     │      │ text        │      │ chevron     │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Navigate to │      │ Calendar    │      │ Navigate to │
    │ previous    │      │ popover     │      │ next day's  │
    │ day's daily │      │ opens       │      │ daily note  │
    │ note        │      │             │      │             │
    └─────────────┘      └──────┬──────┘      └─────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │ User picks  │
                         │ any date    │
                         └──────┬──────┘
                                │
                                ▼
                         ┌─────────────┐
                         │ Navigate to │
                         │ selected    │
                         │ date's      │
                         │ daily note  │
                         └─────────────┘
```

---

## UI Layout

### Today's Note (Default State)

```
┌─────────────────────────────────────────────────────┐
│  Today                                              │
├─────────────────────────────────────────────────────┤
│  Dec 21st, 2024  ·  #daily                          │
└─────────────────────────────────────────────────────┘
```

### Yesterday's Note

```
┌─────────────────────────────────────────────────────┐
│  Yesterday                                          │
├─────────────────────────────────────────────────────┤
│  Dec 20th, 2024  ·  #daily                          │
└─────────────────────────────────────────────────────┘
```

### Tomorrow's Note

```
┌─────────────────────────────────────────────────────┐
│  Tomorrow                                           │
├─────────────────────────────────────────────────────┤
│  Dec 22nd, 2024  ·  #daily                          │
└─────────────────────────────────────────────────────┘
```

### Other Date's Note

```
┌─────────────────────────────────────────────────────┐
│  Jul 28th, 1990                                     │
├─────────────────────────────────────────────────────┤
│  Jul 28th, 1990  ·  #daily                          │
└─────────────────────────────────────────────────────┘
```

### Hover State (Chevrons Visible)

```
┌─────────────────────────────────────────────────────┐
│  Today                                              │
├─────────────────────────────────────────────────────┤
│  [<]  Dec 21st, 2024  [>]  ·  #daily                │
└─────────────────────────────────────────────────────┘
```

### Calendar Popover Open State

```
┌─────────────────────────────────────────────────────┐
│  Today                                              │
├─────────────────────────────────────────────────────┤
│  [<]  Dec 21st, 2024  [>]  ·  #daily                │
│       ┌──────────────────────┐                      │
│       │     December 2024    │                      │
│       ├──────────────────────┤                      │
│       │ Su Mo Tu We Th Fr Sa │                      │
│       │  1  2  3  4  5  6  7 │                      │
│       │  8  9 10 11 12 13 14 │                      │
│       │ 15 16 17 18 19 20 21 │  ← Selected          │
│       │ 22 23 24 25 26 27 28 │                      │
│       │ 29 30 31             │                      │
│       └──────────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

---

## Title Display Behavior

The title displayed in the header should reflect the **relative or absolute date** of the daily note based on its proximity to the current date.

### Title Logic

| Daily Note Date | Title Display |
| --------------- | ------------- |
| Today | "Today" |
| Yesterday | "Yesterday" |
| Tomorrow | "Tomorrow" |
| Any other date | Formatted as "Mon Day, Year" (e.g., "Jul 28th, 1990") |

### Date Format Specification

| Element | Format | Example |
| ------- | ------ | ------- |
| Month | 3-letter abbreviation | "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" |
| Day | Numeric with ordinal suffix | "1st", "2nd", "3rd", "4th", "21st", "22nd", "23rd" |
| Year | 4-digit | "1990", "2024", "2025" |
| Full format | `MMM do, yyyy` (date-fns) | "Jul 28th, 1990" |

### Examples

| Note Date | Current Date | Title Display |
| --------- | ------------ | ------------- |
| Dec 21, 2024 | Dec 21, 2024 | "Today" |
| Dec 20, 2024 | Dec 21, 2024 | "Yesterday" |
| Dec 22, 2024 | Dec 21, 2024 | "Tomorrow" |
| Dec 19, 2024 | Dec 21, 2024 | "Dec 19th, 2024" |
| Jul 28, 1990 | Dec 21, 2024 | "Jul 28th, 1990" |
| Jan 1, 2025 | Dec 21, 2024 | "Jan 1st, 2025" |

### Implementation

The daily template already exists at `apps/desktop/renderer/src/templates/daily.ts` with a `renderTitle` function. However, it currently only handles "Today" and falls back to `MM/dd/yyyy` format. This needs to be updated to support "Yesterday", "Tomorrow", and the ordinal format (`MMM do, yyyy`).

**Current implementation** (`getDailyDisplayTitle` in `templates/daily.ts`):
```typescript
// Current: Only handles "Today", falls back to MM/dd/yyyy
if (isSameDay(noteDate, today)) {
  return 'Today';
}
return format(noteDate, 'MM/dd/yyyy');
```

**Updated implementation**:
```typescript
import { format, isToday, isYesterday, isTomorrow, parse, isValid, startOfDay } from 'date-fns';

export function getDailyDisplayTitle(note: Note): string {
  const noteDate = parse(note.title, 'MM-dd-yyyy', new Date());

  // Handle invalid dates gracefully
  if (!isValid(noteDate)) {
    return note.title;
  }

  if (isToday(noteDate)) {
    return 'Today';
  }
  if (isYesterday(noteDate)) {
    return 'Yesterday';
  }
  if (isTomorrow(noteDate)) {
    return 'Tomorrow';
  }
  // Format: "Jul 28th, 1990"
  return format(noteDate, 'MMM do, yyyy');
}
```

**Note**: The stored note title remains in `MM-dd-yyyy` format (e.g., "12-21-2024"). The display title is computed by the template's `renderTitle` function.

---

## Date Display Behavior (Metadata Row)

The date displayed in the metadata row (below the title) should always reflect the **actual date of the daily note**, not the current date. This is the clickable element that opens the Calendar popover.

**Note**: The metadata row uses ordinal format (`MMM do, yyyy`) via date-fns, which includes day suffixes like "1st", "2nd", "3rd". This differs from the current `toLocaleDateString` implementation which uses "Dec 21, 2024" format. The DateNavigator component will use `format(date, 'MMM do, yyyy')` for consistency with the title display.

| Scenario | Displayed Date |
| -------- | -------------- |
| Today's daily note | "Dec 21st, 2024" |
| Yesterday's daily note | "Dec 20th, 2024" |
| Tomorrow's daily note | "Dec 22nd, 2024" |
| Daily note from Jul 28, 1990 | "Jul 28th, 1990" |

---

## Navigation Behavior

### Previous Day (Left Chevron)

| Action | Result |
| ------ | ------ |
| Click left chevron | Navigate to the daily note for the previous day |
| Daily note exists | Open existing note |
| Daily note doesn't exist | Create new daily note, then open it |

### Next Day (Right Chevron)

| Action | Result |
| ------ | ------ |
| Click right chevron | Navigate to the daily note for the next day |
| Daily note exists | Open existing note |
| Daily note doesn't exist | Create new daily note, then open it |

### Date Picker Selection

| Action | Result |
| ------ | ------ |
| Click date text | Open Calendar popover |
| Select a date | Navigate to that date's daily note (create if needed) |
| Click outside / Escape | Close DatePicker without navigating |

---

## Chevron Icon Specifications

| Element | Specification |
| ------- | ------------- |
| **Icon** | `ChevronLeft` / `ChevronRight` from lucide-react |
| **Size** | 14x14px |
| **Color** | Muted text color, matches date text |
| **Hover color** | Slightly brighter (primary text color) |
| **Hover area** | 24x24px for easier clicking |
| **Transition** | Opacity 0.15s ease-in-out |
| **Default state** | Hidden (opacity: 0) |
| **Hover state** | Visible (opacity: 1) |
| **Cursor** | Pointer on hover |

---

## Animation Specifications

### Chevron Fade In/Out

```
┌─────────────────────────────────────────────────────┐
│  Mouse enters date area                             │
│  ↓                                                  │
│  Chevrons fade in over 150ms (ease-out)             │
│                                                     │
│  Mouse leaves date area                             │
│  ↓                                                  │
│  Wait 100ms (debounce)                              │
│  ↓                                                  │
│  Chevrons fade out over 150ms (ease-in)             │
└─────────────────────────────────────────────────────┘
```

### Calendar Popover

| Animation | Specification |
| --------- | ------------- |
| Open | Scale from 0.95 to 1.0, opacity 0 to 1, 150ms ease-out |
| Close | Opacity 1 to 0, 100ms ease-in |
| Position | Below date text, centered (uses @floating-ui/react for positioning) |

---

## Keyboard Shortcuts

### When Focus on Date Area

| Shortcut | Action |
| -------- | ------ |
| `Enter` / `Space` | Open Calendar popover |
| `Left Arrow` | Navigate to previous day |
| `Right Arrow` | Navigate to next day |
| `Escape` | Close Calendar popover (if open) |

### When Calendar Popover Open

| Shortcut | Action |
| -------- | ------ |
| Arrow keys | Navigate calendar |
| `Enter` | Select highlighted date |
| `Escape` | Close without selecting |

---

## Click Behavior

| Element | Click Action |
| ------- | ------------ |
| Left chevron | Navigate to previous day's daily note |
| Date text | Open Calendar popover |
| Right chevron | Navigate to next day's daily note |
| Outside Calendar popover | Close popover without action |

### Event Propagation

- Chevron clicks should `stopPropagation` to prevent triggering date click
- Calendar popover escape should `stopPropagation` to prevent closing parent modals

---

## Edge Cases

| Case | Behavior |
| ---- | -------- |
| Non-daily note | Chevrons are hidden; clicking date navigates to the daily note for that date (existing behavior via `onNavigateToDaily`) |
| Navigate to future date | Create daily note for future date |
| Navigate to distant past | Create daily note for that date |
| Rapid clicking chevrons | Debounce navigation (200ms) to prevent excessive note creation |
| Storage error | Show error toast via `useToast` hook, stay on current note |
| Calendar popover on small screen | Popover may flip to above date if insufficient space below |
| Timezone handling | "Today/Yesterday/Tomorrow" use user's local timezone (date-fns default) |
| Midnight transition | Title updates on next navigation or note switch (not real-time) |

### Non-Daily Note Behavior (Clarification)

For non-daily notes (regular notes, meeting notes, etc.):
- The `DateNavigator` component receives `showNavigation={false}`
- Chevrons are not rendered
- Clicking the date navigates to the daily note for that date (uses `onNavigateToDaily` prop)
- No Calendar popover is shown (direct navigation only)

---

## Component Architecture

### Modified Components

```
NoteHeader
├── DateNavigator (new)
│   ├── ChevronButton (left) — hidden when showNavigation=false
│   ├── DateButton (trigger for Calendar popover)
│   │   └── Calendar popover (on click, daily notes only; uses @floating-ui/react)
│   └── ChevronButton (right) — hidden when showNavigation=false
├── Title (uses template.renderTitle for daily notes)
└── Tags
```

### DateNavigator Component

```typescript
interface DateNavigatorProps {
  /** The date to display and navigate from */
  date: Date;
  /** Called when navigating to a different date's daily note */
  onNavigate: (date: Date) => void;
  /** Whether to show the navigation controls (false for non-daily notes) */
  showNavigation?: boolean;
}
```

---

## Technical Implementation

### IPC Contract: `daily:getOrCreate`

The handler accepts an optional date parameter and returns the daily note:

```typescript
// Channel: 'daily:getOrCreate'
// Input: { date?: string } - ISO date string or omit for today
// Output: Note

// Examples:
await window.scribe.daily.getOrCreate(); // Today
await window.scribe.daily.getOrCreate({ date: '2024-12-20' }); // Specific date
await window.scribe.daily.getOrCreate({ date: new Date().toISOString() }); // Also works
```

**Behavior:**
- Returns existing daily note if one exists for the date
- Creates new daily note if none exists
- Sets `createdAt` to noon on target date (avoids timezone edge cases)
- Daily notes are identified by `type: 'daily'` and title in `MM-dd-yyyy` format

### New Component: DateNavigator

Location: `apps/desktop/renderer/src/components/NoteHeader/DateNavigator.tsx`

```typescript
interface DateNavigatorProps {
  /** The date to display and navigate from */
  date: Date;
  /** Called when navigating to a different date's daily note */
  onNavigate: (date: Date) => void;
  /** Whether to show chevron navigation (true for daily notes) */
  showNavigation?: boolean;
}

function DateNavigator({ date, onNavigate, showNavigation = true }: DateNavigatorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Debounced navigation to prevent rapid clicking
  const handleNavigate = useCallback((targetDate: Date) => {
    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }
    navigateTimeoutRef.current = setTimeout(() => {
      onNavigate(targetDate);
    }, 200);
  }, [onNavigate]);
  
  const handlePrevious = useCallback(() => {
    handleNavigate(subDays(date, 1));
  }, [date, handleNavigate]);
  
  const handleNext = useCallback(() => {
    handleNavigate(addDays(date, 1));
  }, [date, handleNavigate]);
  
  const handleDateSelect = useCallback((selectedDate: Date | undefined) => {
    if (selectedDate) {
      setIsCalendarOpen(false);
      onNavigate(selectedDate); // No debounce for picker selection
      // Return focus to date button
      dateButtonRef.current?.focus();
    }
  }, [onNavigate]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, []);
  
  // ... render with Calendar component for popover
}
```

### Focus Management

| Action | Focus Destination |
| ------ | ----------------- |
| Calendar closes (date selected) | Date button |
| Calendar closes (Escape) | Date button |
| Calendar closes (outside click) | No change (natural blur) |
| Chevron click (navigation) | Editor content (new note) |

### NoteHeader Changes

Location: `apps/desktop/renderer/src/components/NoteHeader/NoteHeader.tsx`

> **Note**: The existing `NoteHeader` already has an `onDateClick?: (date: Date) => void` prop (line 18). This feature renames it to `onNavigateToDaily` for clarity and makes it required for daily notes.

```typescript
interface NoteHeaderProps {
  note: Note;
  onTitleChange: (title: string) => void;
  onTagsChange: (tags: string[]) => void;
  /** Called when navigating to a daily note for a date (replaces onDateClick) */
  onNavigateToDaily: (date: Date) => void;
  translateY?: number;
}
```

### App.tsx Integration

```typescript
const { showToast } = useToast(); // Already available in App.tsx

const handleNavigateToDaily = useCallback(async (date: Date) => {
  try {
    // Note: The preload layer handles converting Date to ISO string internally
    const dailyNote = await window.scribe.daily.getOrCreate(date);
    navigateToNote(dailyNote.id);
  } catch (error) {
    showToast('Failed to open daily note', 'error');
    console.error('Failed to navigate to daily note:', error);
  }
}, [navigateToNote, showToast]);
```

**Note:** The `useToast` hook is already used in `App.tsx` (line 54) for other features like export notifications. Error toasts auto-dismiss after 3 seconds and can be manually dismissed by clicking.

### Files to Modify/Create

| File | Changes |
| ---- | ------- |
| `renderer/src/components/NoteHeader/DateNavigator.tsx` | **New** - Date display with chevrons and Calendar popover |
| `renderer/src/components/NoteHeader/DateNavigator.css.ts` | **New** - Vanilla Extract styles |
| `renderer/src/components/NoteHeader/DateNavigator.test.tsx` | **New** - Unit tests |
| `renderer/src/components/NoteHeader/NoteHeader.tsx` | Replace date button with DateNavigator; rename `onDateClick` to `onNavigateToDaily` |
| `renderer/src/components/NoteHeader/NoteHeader.css.ts` | Remove old `dateButton` styles (moved to DateNavigator) |
| `renderer/src/components/NoteHeader/NoteHeader.test.tsx` | Add tests for title display (Today/Yesterday/Tomorrow) |
| `renderer/src/components/NoteHeader/index.ts` | Export DateNavigator |
| `renderer/src/templates/daily.ts` | **Modify** - Update `getDailyDisplayTitle` to support Yesterday/Tomorrow and ordinal format |
| `renderer/src/templates/daily.test.ts` | **Modify** - Add tests for Yesterday/Tomorrow/ordinal titles |
| `renderer/src/App.tsx` | **Modify** - Add try/catch with toast for `handleNavigateToDaily` |
| `apps/desktop/daily-navigation.integration.test.ts` | **New** - E2E integration tests |

---

## CSS Specifications

This feature uses Vanilla Extract with the design system's `vars` from `@scribe/design-system`. The CSS below shows the intended styles; actual implementation will use the `style()` function.

### Design Token Mapping

| Spec Token | Design System Token |
| ---------- | ------------------- |
| `--text-muted` | `vars.color.foregroundMuted` |
| `--text-primary` | `vars.color.foreground` |
| `--bg-hover` | `vars.color.surface` |
| `--border-radius` | `vars.radius.sm` |
| `--transition` | `vars.animation.duration.fast` + `vars.animation.easing.default` |

### DateNavigator Container (Vanilla Extract)

```typescript
export const dateNavigator = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  position: 'relative',
});
```

### Chevron Button (Vanilla Extract)

```typescript
export const chevronButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  border: 'none',
  background: 'transparent',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  opacity: 0,
  transition: `opacity ${vars.animation.duration.fast} ${vars.animation.easing.default}, background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  color: vars.color.foregroundMuted,
  ':hover': {
    color: vars.color.foreground,
    backgroundColor: vars.color.surface,
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
    opacity: 1,
  },
});

// Chevron visibility on parent hover/focus
export const chevronVisible = style({
  opacity: 1,
});
```

### Date Button (Vanilla Extract)

```typescript
export const dateButton = style({
  padding: `${vars.spacing['0']} ${vars.spacing['2']}`,
  border: 'none',
  background: 'transparent',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
  fontFamily: vars.typography.fontFamily.ui,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  ':hover': {
    color: vars.color.accent,
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});
```

### Calendar Popover (Vanilla Extract)

```typescript
// Note: Actual positioning is handled by @floating-ui/react via inline styles.
// These base styles provide the visual appearance.
export const calendarPopover = style({
  position: 'absolute', // floating-ui will manage placement
  zIndex: vars.zIndex.popover,
  backgroundColor: vars.color.background,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  // Animation handled via CSS classes or React state
});
```

---

## Testing Plan

Aligned with [testing_strategy_and_design.md](../../architecture/testing_strategy_and_design.md).

### Unit Tests

**DateNavigator.test.tsx**

| Test Case | Condition | Expected Result |
| --------- | --------- | --------------- |
| Renders date correctly | Date = Dec 21, 2024 | Shows "Dec 21, 2024" |
| Chevrons hidden by default | Not hovered | Chevrons have opacity: 0 |
| Chevrons visible on hover | Hovered | Chevrons have opacity: 1 |
| Previous day navigation | Click left chevron | onNavigate called with Dec 20 |
| Next day navigation | Click right chevron | onNavigate called with Dec 22 |
| Calendar opens on date click | Click date | Calendar popover visible |
| Calendar closes on selection | Select date | onNavigate called, popover closed |
| Calendar closes on escape | Press Escape | Popover closed, no navigation |
| Calendar closes on outside click | Click outside | Popover closed, no navigation |
| Keyboard: left arrow | Press Left | Navigate to previous day |
| Keyboard: right arrow | Press Right | Navigate to next day |
| Keyboard: enter on date | Press Enter | Calendar popover opens |
| Debounce: rapid chevron clicks | Click chevron 3x fast | Only one navigation occurs |
| Focus: after calendar select | Select date | Focus returns to date button |

**NoteHeader.test.tsx additions**

| Test Case | Condition | Expected Result |
| --------- | --------- | --------------- |
| Daily note shows navigation | type: 'daily' | DateNavigator with chevrons rendered |
| Non-daily note hides chevrons | type: 'note' | DateNavigator with showNavigation=false, no chevrons |
| Date reflects note date | Yesterday's daily | Shows yesterday's date |
| Title shows "Today" | Daily note for today | Title is "Today" |
| Title shows "Yesterday" | Daily note for yesterday | Title is "Yesterday" |
| Title shows "Tomorrow" | Daily note for tomorrow | Title is "Tomorrow" |
| Title shows formatted date | Daily note for 2 days ago | Title is "Dec 19th, 2024" |
| Title shows formatted date | Daily note for Jul 28, 1990 | Title is "Jul 28th, 1990" |
| Ordinal suffix "1st" | Daily note for Jan 1 | Title includes "1st" |
| Ordinal suffix "2nd" | Daily note for Jan 2 | Title includes "2nd" |
| Ordinal suffix "3rd" | Daily note for Jan 3 | Title includes "3rd" |
| Ordinal suffix "4th" | Daily note for Jan 4 | Title includes "4th" |
| Ordinal suffix "11th" | Daily note for Jan 11 | Title includes "11th" |
| Ordinal suffix "21st" | Daily note for Jan 21 | Title includes "21st" |

### Renderer Component Tests

**Date display accuracy**

| Test Case | Action | Expected Result |
| --------- | ------ | --------------- |
| Today's daily note | Open today's note | Shows today's date |
| Yesterday's daily | Navigate back | Shows yesterday's date |
| Future date | Navigate forward | Shows future date |
| Custom date via picker | Select Jan 1, 2024 | Shows "Jan 1, 2024" |

**Navigation state transitions**

| Test Case | Action | Expected Result |
| --------- | ------ | --------------- |
| Back from today | Click left chevron | Yesterday's note opens |
| Forward from today | Click right chevron | Tomorrow's note opens |
| Picker navigation | Select date | That date's note opens |
| Note creation | Navigate to non-existent | New daily note created |

### IPC Contract Tests

| Test Case | Channel | Validation |
| --------- | ------- | ---------- |
| Get or create daily | `daily:getOrCreate` | Returns Note with correct date |
| Create for past date | `daily:getOrCreate` | Creates note with past createdAt (noon on target date) |
| Create for future date | `daily:getOrCreate` | Creates note with future createdAt |
| Idempotent creation | `daily:getOrCreate` | Calling twice returns same note ID |
| ISO date string | `daily:getOrCreate` | Accepts full ISO string (e.g., `2024-12-21T00:00:00.000Z`) |
| Short date string | `daily:getOrCreate` | Accepts short format (e.g., `2024-12-21`) |

### Template Tests (daily.test.ts additions)

| Test Case | Input | Expected Output |
| --------- | ----- | --------------- |
| Today's note | Note with today's date | `"Today"` |
| Yesterday's note | Note with yesterday's date | `"Yesterday"` |
| Tomorrow's note | Note with tomorrow's date | `"Tomorrow"` |
| Two days ago | Note dated 2 days prior | `"Dec 19th, 2024"` (ordinal format) |
| Historical date | Note dated Jul 28, 1990 | `"Jul 28th, 1990"` |
| Invalid date in title | Note with title "invalid" | Returns original title |

### E2E Tests (Integration)

**Flow 1: Navigate between daily notes with correct titles**

1. Launch app with today's daily note open
2. Verify title shows "Today"
3. Hover over date in header
4. Verify chevrons appear
5. Click left chevron
6. Verify yesterday's daily note opens
7. Verify title shows "Yesterday"
8. Verify date in metadata shows yesterday's date (e.g., "Dec 20th, 2024")
9. Click left chevron again
10. Verify title shows formatted date (e.g., "Dec 19th, 2024")
11. Click right chevron three times
12. Verify title shows "Tomorrow"
13. Click left chevron
14. Verify title shows "Today"

**Flow 2: Use Calendar picker for navigation**

1. Open today's daily note
2. Click on the date text
3. Verify Calendar popover opens
4. Select a date from 2 weeks ago
5. Verify new daily note created and opened
6. Verify title shows formatted date (e.g., "Dec 7th, 2024")
7. Click date text again, select tomorrow's date
8. Verify title shows "Tomorrow"

**Flow 3: Create notes via navigation**

1. Open today's daily note
2. Navigate forward 3 days
3. Verify each daily note is created
4. Navigate back 3 days
5. Verify all notes exist (no duplicates created)

**Flow 4: Keyboard navigation**

1. Focus on date button (Tab to it)
2. Press Left Arrow
3. Verify previous day's note opens
4. Press Right Arrow
5. Verify today's note opens
6. Press Enter or Space
7. Verify Calendar popover opens
8. Use arrow keys to navigate calendar (react-day-picker built-in)
9. Press Enter to select
10. Verify selected date's note opens
11. Verify focus returns to date button

**Flow 5: Error handling**

1. Open today's daily note
2. Simulate storage failure (e.g., disk full)
3. Click chevron to navigate
4. Verify error toast appears with message "Failed to open daily note"
5. Verify current note remains open
6. Verify toast auto-dismisses after 3 seconds

### Test File Locations

| Test Type | Location |
| --------- | -------- |
| Unit: DateNavigator | `renderer/src/components/NoteHeader/DateNavigator.test.tsx` |
| Unit: NoteHeader | `renderer/src/components/NoteHeader/NoteHeader.test.tsx` |
| E2E | `apps/desktop/daily-navigation.integration.test.ts` |

---

## Accessibility

| Requirement | Implementation |
| ----------- | -------------- |
| Chevron focus visible | `outline: 2px solid ${vars.color.accent}` on `:focus-visible` |
| Screen reader labels | `aria-label="Navigate to previous day"`, `aria-label="Navigate to next day"` |
| Date button label | `aria-label="Open calendar to select date"` (daily notes) or `aria-label="Go to daily note for this date"` (non-daily) |
| Date button state | `aria-expanded={isCalendarOpen}`, `aria-haspopup="dialog"` |
| Calendar popover ARIA | `role="dialog"`, `aria-modal="true"` (via FloatingFocusManager) |
| Keyboard navigation | Arrow keys on date button navigate days; Enter/Space opens calendar |
| Focus management | Focus returns to date button when calendar closes (via FloatingFocusManager) |
| Live region | Navigation success announced via `aria-live="polite"` region |
| Error toasts | Use `role="alert"` with `aria-live="assertive"` |

### Keyboard Flow

```
Tab → [Left Chevron] → Tab → [Date Button] → Tab → [Right Chevron]
                              ↓ Enter/Space
                         [Calendar Dialog]
                              ↓ Arrow keys to navigate
                              ↓ Enter to select
                         [Date Button] (focus returns)
```

---

## Dependencies

This feature uses the existing:

- `@scribe/design-system` **Calendar** component (`packages/design-system/src/primitives/Calendar`) - uses react-day-picker v9 with built-in keyboard navigation
- `daily:getOrCreate` IPC handler (`apps/desktop/electron/main/src/handlers/dailyHandlers.ts`) - accepts ISO date strings
- `date-fns` for date manipulation (`isToday`, `isYesterday`, `isTomorrow`, `format`, `addDays`, `subDays`)
- `lucide-react` for `ChevronLeft`/`ChevronRight` icons
- `useToast` hook (`apps/desktop/renderer/src/hooks/useToast.ts`) for error notifications
- Daily template (`apps/desktop/renderer/src/templates/daily.ts`) - needs update for Yesterday/Tomorrow titles

### Calendar Component Notes

The `Calendar` component wraps react-day-picker v9 which provides:
- Full keyboard navigation (arrow keys, Enter, Escape)
- ARIA attributes for accessibility
- `onSelect` callback when a date is chosen
- `defaultMonth` prop to control initial view

No additional keyboard handling is needed for the calendar itself.

---

## Implementation Order (Suggested)

The following order minimizes integration risk and allows incremental testing:

1. **Template Update** - Update `getDailyDisplayTitle` to support Yesterday/Tomorrow/ordinal format
2. **Template Tests** - Add unit tests for new title logic
3. **DateNavigator Component** - Build the new component with chevrons and Calendar popover
4. **DateNavigator Styles** - Create Vanilla Extract styles
5. **DateNavigator Tests** - Unit tests for navigation and popover behavior
6. **NoteHeader Integration** - Replace date button with DateNavigator
7. **NoteHeader Tests** - Update tests for new prop name and component
8. **App.tsx Integration** - Wire up error handling with toast
9. **E2E Tests** - Full flow integration tests

---

## Future Considerations

- **Swipe gestures**: On touch devices, swipe left/right to navigate
- **Visual timeline**: Show dots or indicators for days with existing notes
- **Quick jump**: Keyboard shortcut (e.g., `g d`) to jump to today's daily note
- **Week/month view**: Navigate by week or month increments
- **Note preview on hover**: Show snippet of adjacent day's note on chevron hover

---

## Appendix: Ordinal Suffix Rules

For the date format, English ordinal suffixes follow these rules:

| Day | Suffix | Exception Rule |
| --- | ------ | -------------- |
| 1, 21, 31 | st | |
| 2, 22 | nd | |
| 3, 23 | rd | |
| 4-20, 24-30 | th | 11th, 12th, 13th are exceptions (not 11st, 12nd, 13rd) |

date-fns `format(date, 'do')` handles this automatically.
