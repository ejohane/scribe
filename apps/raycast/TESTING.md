# Scribe Raycast Extension - Testing Guide

Manual testing documentation for the Scribe Raycast extension.

## Prerequisites

Before testing, ensure you have:

- [ ] Raycast installed
- [ ] Scribe CLI installed and in PATH (`which scribe` returns a path)
- [ ] Scribe Desktop app installed
- [ ] A vault with some existing notes
- [ ] The Raycast extension loaded (`npm run dev` in apps/raycast)

## Test Scenarios

### 1. Quick Note Command

#### 1.1 Basic Note Addition

1. Open Raycast
2. Search for "Quick Note"
3. Type: `Test note from Raycast`
4. Press Enter

**Expected:**
- [ ] Success toast appears: "Note added"
- [ ] Toast shows the daily note title
- [ ] Form closes and returns to Raycast root

**Verify:** Open Scribe, navigate to today's daily note, confirm the text appears.

#### 1.2 Note with Wiki Syntax

1. Open Raycast > Quick Note
2. Type: `Meeting with @John about [[Project Alpha]] #important`
3. Press Enter

**Expected:**
- [ ] Success toast appears
- [ ] Note is added with syntax preserved

**Verify:** In Scribe, the wiki link, mention, and tag should render correctly.

#### 1.3 Empty Note Validation

1. Open Raycast > Quick Note
2. Leave the text field empty
3. Press Enter

**Expected:**
- [ ] Error message appears: "Note cannot be empty"
- [ ] Form stays open
- [ ] No CLI call is made

#### 1.4 Daily Note Creation

1. Ensure today's daily note doesn't exist (or test on a fresh day)
2. Open Raycast > Quick Note
3. Add any text and submit

**Expected:**
- [ ] Toast shows "Created daily & added note"
- [ ] Daily note is created in the vault

---

### 2. Quick Task Command

#### 2.1 Basic Task Addition

1. Open Raycast
2. Search for "Quick Task"
3. Type: `Follow up with team`
4. Press Enter

**Expected:**
- [ ] Success toast appears
- [ ] Task is added to daily note

**Verify:** In Scribe, task appears with `- [ ]` checkbox syntax.

#### 2.2 Task with Syntax

1. Open Raycast > Quick Task
2. Type: `Review @Sarah's PR for [[Feature X]]`
3. Press Enter

**Expected:**
- [ ] Success toast appears
- [ ] Syntax is preserved in the task

---

### 3. Search Notes Command

#### 3.1 Basic Search

1. Open Raycast
2. Search for "Search Notes"
3. Type a word that exists in your vault (e.g., "meeting")

**Expected:**
- [ ] Results appear within 500ms
- [ ] Results show note titles
- [ ] Results show snippets with matches highlighted

#### 3.2 Search with Preview

1. Perform a search with results
2. Arrow down to select a result
3. Observe the preview panel

**Expected:**
- [ ] Preview shows note content
- [ ] Preview shows metadata (path, modified date)

#### 3.3 Open Search Result

1. Search and select a result
2. Press Enter

**Expected:**
- [ ] Scribe desktop opens
- [ ] The selected note is displayed

#### 3.4 Empty Search Results

1. Search for gibberish: `xyzabc123nonsense`

**Expected:**
- [ ] Empty state is shown
- [ ] Message indicates no results found

#### 3.5 Search Debouncing

1. Type quickly: `test`
2. Observe network/CLI activity

**Expected:**
- [ ] Search waits for typing to pause (debounce)
- [ ] Only one search executed, not one per keystroke

---

### 4. Open Daily Command

#### 4.1 Basic Open

1. Open Raycast
2. Search for "Open Daily"
3. Press Enter

**Expected:**
- [ ] Raycast closes immediately (no-view command)
- [ ] Scribe opens to today's daily note
- [ ] Response time < 500ms

#### 4.2 Daily Doesn't Exist

1. Remove today's daily note from vault (backup first)
2. Run Open Daily

**Expected:**
- [ ] Scribe opens
- [ ] Daily note is created automatically

---

### 5. List People Command

#### 5.1 Browse People

1. Open Raycast
2. Search for "List People"

**Expected:**
- [ ] All people in vault are listed
- [ ] Each person shows their @mention handle
- [ ] Loading state shown while fetching

#### 5.2 Copy Mention

1. List People
2. Select a person
3. Press `Cmd + C`

**Expected:**
- [ ] @mention is copied to clipboard
- [ ] Toast confirms copy

**Verify:** Paste in any app to confirm `@Name` format.

#### 5.3 Open Person Note

1. List People
2. Select a person
3. Press Enter

**Expected:**
- [ ] Scribe opens to the person's note

#### 5.4 Search/Filter People

1. List People
2. Start typing a name in the search bar

**Expected:**
- [ ] List filters to matching people
- [ ] Filtering is fast (client-side)

---

### 6. Recent Notes Command

#### 6.1 View Recent

1. Open Raycast
2. Search for "Recent Notes"

**Expected:**
- [ ] Notes listed in descending order by modified time
- [ ] Relative time shown (e.g., "2 hours ago", "Yesterday")
- [ ] Most recent note at top

#### 6.2 Open Recent Note

1. Recent Notes
2. Select any note
3. Press Enter

**Expected:**
- [ ] Scribe opens to the selected note

---

## Error Scenarios

### E1. CLI Not Found

**Setup:** Temporarily rename the CLI binary

```bash
sudo mv /usr/local/bin/scribe /usr/local/bin/scribe.bak
```

**Test:** Run any command (e.g., Quick Note)

**Expected:**
- [ ] Error toast: "Scribe CLI not found..."
- [ ] Message mentions checking preferences
- [ ] No crash or hang

**Cleanup:**
```bash
sudo mv /usr/local/bin/scribe.bak /usr/local/bin/scribe
```

### E2. Invalid Vault Path

**Setup:** In Raycast Preferences > Scribe, set vault path to `/nonexistent/path`

**Test:** Run any command

**Expected:**
- [ ] Error toast: "Vault not found..."
- [ ] Message mentions checking preferences

**Cleanup:** Clear or fix the vault path preference

### E3. CLI Timeout

**Note:** This is difficult to test without modifying the CLI. Skip unless investigating timeout issues.

**Expected behavior if timeout occurs:**
- [ ] Error toast: "Command timed out..."
- [ ] Suggestion to try again

### E4. Empty Vault

**Setup:** Point to an empty vault directory

**Test:** Run Search, List People, Recent Notes

**Expected:**
- [ ] Search: Empty state shown
- [ ] List People: Empty state shown
- [ ] Recent Notes: Empty state shown
- [ ] No errors thrown

---

## Performance Benchmarks

| Command | Target | Actual | Pass? |
|---------|--------|--------|-------|
| Quick Note submit | < 1s | | |
| Quick Task submit | < 1s | | |
| Search (first results) | < 500ms | | |
| Open Daily | < 500ms | | |
| List People load | < 500ms | | |
| Recent Notes load | < 500ms | | |

**Note:** Times measured from action to visible feedback. Larger vaults may have longer times.

---

## Test Report Template

Copy this template for test reports:

```markdown
## Scribe Raycast Extension - Test Report

**Date:** YYYY-MM-DD
**Tester:** Name
**Platform:** macOS XX.X
**Raycast Version:** X.X.X
**CLI Version:** X.X.X

### Environment
- Vault location: /path/to/vault
- Vault size: ~XXX notes
- CLI in PATH: Yes/No
- Custom preferences: None / (list any)

### Results

| Test | Status | Notes |
|------|--------|-------|
| 1.1 Basic Note | Pass/Fail | |
| 1.2 Note with Syntax | Pass/Fail | |
| 1.3 Empty Note Validation | Pass/Fail | |
| 1.4 Daily Note Creation | Pass/Fail | |
| 2.1 Basic Task | Pass/Fail | |
| 2.2 Task with Syntax | Pass/Fail | |
| 3.1 Basic Search | Pass/Fail | |
| 3.2 Search with Preview | Pass/Fail | |
| 3.3 Open Search Result | Pass/Fail | |
| 3.4 Empty Search Results | Pass/Fail | |
| 3.5 Search Debouncing | Pass/Fail | |
| 4.1 Basic Open Daily | Pass/Fail | |
| 4.2 Daily Doesn't Exist | Pass/Fail | |
| 5.1 Browse People | Pass/Fail | |
| 5.2 Copy Mention | Pass/Fail | |
| 5.3 Open Person Note | Pass/Fail | |
| 5.4 Search/Filter People | Pass/Fail | |
| 6.1 View Recent | Pass/Fail | |
| 6.2 Open Recent Note | Pass/Fail | |
| E1. CLI Not Found | Pass/Fail | |
| E2. Invalid Vault Path | Pass/Fail | |
| E4. Empty Vault | Pass/Fail | |

### Performance

| Command | Target | Actual | Pass? |
|---------|--------|--------|-------|
| Quick Note submit | < 1s | | |
| Search results | < 500ms | | |
| Open Daily | < 500ms | | |
| List People | < 500ms | | |
| Recent Notes | < 500ms | | |

### Issues Found

1. [Issue description]
   - Severity: Critical/High/Medium/Low
   - Steps to reproduce: ...
   - Expected: ...
   - Actual: ...

### Notes

[Any additional observations]
```

---

## Automated Testing

This extension currently uses manual testing. Automated testing considerations:

- **Unit tests**: CLI wrapper functions (`lib/cli.ts`) could be unit tested with mocked exec
- **Component tests**: React components are difficult to test outside Raycast
- **E2E tests**: Raycast doesn't provide E2E testing infrastructure

For now, the manual test scenarios above provide coverage for all user-facing functionality.
