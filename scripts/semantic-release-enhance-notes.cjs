/**
 * semantic-release-enhance-notes.cjs
 *
 * Custom semantic-release plugin that enhances release notes with AI
 * and updates RELEASE_NOTES.md BEFORE the git commit/tag is created.
 *
 * This runs in the "prepare" step, after notes are generated but before
 * @semantic-release/git commits. The enhanced notes are then included
 * in the tagged commit.
 *
 * Plugin Lifecycle:
 * 1. verifyConditions - validate config (optional)
 * 2. prepare - enhance notes and update RELEASE_NOTES.md (this plugin)
 * 3. @semantic-release/git - commits files including RELEASE_NOTES.md
 * 4. @semantic-release/github - creates release with enhanced notes
 */

const fs = require('fs');
const path = require('path');

const RELEASE_NOTES_PATH = 'RELEASE_NOTES.md';
const GEMINI_MODEL = 'gemini-1.5-flash';

/**
 * Verify plugin configuration
 */
async function verifyConditions(pluginConfig, context) {
  const { logger } = context;

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set - will use raw changelog without AI enhancement');
  }
}

/**
 * Prepare step - enhance notes and update RELEASE_NOTES.md
 * This runs BEFORE @semantic-release/git commits
 */
async function prepare(pluginConfig, context) {
  const { nextRelease, logger } = context;
  const { version, notes } = nextRelease;

  logger.log(`Enhancing release notes for v${version}...`);

  let enhanced;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      logger.log('Calling Gemini API for enhancement...');
      enhanced = await enhanceWithGemini(notes, version, geminiKey);
      logger.log('Successfully enhanced notes with AI');
    } catch (error) {
      logger.warn(`Gemini enhancement failed: ${error.message}`);
      logger.log('Falling back to formatted raw notes');
      enhanced = formatRawNotes(notes, version);
    }
  } else {
    logger.log('No GEMINI_API_KEY, using formatted raw notes');
    enhanced = formatRawNotes(notes, version);
  }

  // Update RELEASE_NOTES.md (will be committed by @semantic-release/git)
  logger.log('Updating RELEASE_NOTES.md...');
  await prependToReleaseNotes(enhanced);

  // Also update the release notes that will be used for GitHub release
  // This modifies nextRelease.notes which @semantic-release/github will use
  nextRelease.notes = enhanced;

  logger.log('Release notes enhancement complete');
}

async function enhanceWithGemini(rawChangelog, version, apiKey) {
  const prompt = buildPrompt(rawChangelog, version);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data = await response.json();

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Unexpected Gemini response structure');
  }

  return data.candidates[0].content.parts[0].text;
}

function buildPrompt(rawChangelog, version) {
  return `You are writing release notes for Scribe, a note-taking app for macOS.

Here is the raw changelog generated from commits:

${rawChangelog}

Transform this into user-friendly release notes. Start with this exact heading:

# What's New in v${version}

Then include these sections (omit any that have no items):

## Highlights
(1-3 most important user-facing changes, written in plain language)

## Features
(new capabilities - rewrite commit messages to be user-friendly)

## Improvements
(enhancements to existing features)

## Bug Fixes
(user-facing issues resolved - skip test fixes)

## Under the Hood
(internal changes like refactoring, tests, CI - keep very brief, 1-2 lines max)

Guidelines:
- Write for end users, not developers
- Focus on WHAT changed and WHY it matters, not HOW
- Use plain, friendly language
- Keep "Under the Hood" minimal - users don't need test details
- Preserve links to commits and issues where helpful
- If a section has no items, omit it entirely
- Be concise - aim for scannable release notes`;
}

function formatRawNotes(rawChangelog, version) {
  return `# What's New in v${version}\n\n${rawChangelog}`;
}

async function prependToReleaseNotes(enhanced) {
  let existing = '';
  try {
    existing = fs.readFileSync(RELEASE_NOTES_PATH, 'utf-8');
  } catch {
    // File doesn't exist yet, that's fine
  }

  // Find the position after the header (before the first version block)
  const headerEndIndex = existing.indexOf('\n---\n');
  let newContent;

  if (headerEndIndex !== -1) {
    // Insert after header, before existing versions
    const header = existing.slice(0, headerEndIndex);
    const rest = existing.slice(headerEndIndex);
    newContent = header + '\n\n---\n\n' + enhanced + rest;
  } else {
    // No existing versions, create with header
    const header = `# Scribe Release Notes

This document contains user-friendly release notes for each version of Scribe.
`;
    newContent = header + '\n\n---\n\n' + enhanced + '\n\n---\n';
  }

  fs.writeFileSync(RELEASE_NOTES_PATH, newContent);
}

module.exports = { verifyConditions, prepare };
