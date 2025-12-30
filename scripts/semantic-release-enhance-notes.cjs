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
  return `You are writing release notes for Scribe, a beautiful note-taking app for macOS. Your audience is regular users who just want to know what's new in simple terms.

Here is the raw changelog generated from commits:

${rawChangelog}

Transform this into friendly, easy-to-read release notes.

OUTPUT FORMAT (follow exactly):

# What's New in v${version}

## TL;DR
(One sentence summary of the most important change. Max 15 words. No jargon.)

## Highlights
(If there are meaningful user-facing changes, list 1-3 bullet points explaining what users can now do differently. Use simple language like "You can now..." or "We fixed..." - if there's nothing meaningful for users, skip this section entirely.)

## Technical Details
(One short paragraph for developers/curious users. Include links to commits/issues here. If only internal changes, say something like "Internal improvements to [area]." Keep to 2-3 sentences max.)

CRITICAL RULES:
1. NEVER just copy commit messages - translate them into plain English
2. NEVER use words like "refactor", "enhance", "implement", "bundle", "integrate" - these are developer jargon
3. The TL;DR must answer: "What does this update do for ME as a user?"
4. If the release is purely internal/technical with no user-facing changes, the TL;DR should say "Bug fixes and performance improvements" or similar
5. Skip the "Highlights" section entirely if there's nothing a regular user would care about
6. Be honest - don't oversell minor changes

EXAMPLES OF GOOD TL;DR:
- "You can now see what changed in each version of Scribe."
- "Fixed a crash when opening large notes."
- "Bug fixes and performance improvements."

EXAMPLES OF BAD TL;DR (never do this):
- "Bundle release notes in tagged commit by integrating enhancement"
- "Add changelog view in settings with AI-enhanced release notes"
- "Implement feature X with Y architecture"`;
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
