#!/usr/bin/env bun

/**
 * enhance-release-notes.ts
 *
 * Post-semantic-release script that:
 * 1. Fetches the just-created GitHub Release
 * 2. Sends the raw changelog to Google Gemini for enhancement
 * 3. Updates the GitHub Release with user-friendly notes
 * 4. Prepends to RELEASE_NOTES.md (bundled in app)
 *
 * Environment Variables Required:
 * - GEMINI_API_KEY: Google AI Studio API key
 * - RELEASE_TAG: Version tag (e.g., "v1.32.0")
 * - GITHUB_TOKEN: For GitHub CLI authentication
 *
 * Usage:
 * RELEASE_TAG=v1.32.0 bun run scripts/enhance-release-notes.ts
 */

import { $ } from 'bun';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RELEASE_TAG = process.env.RELEASE_TAG;
const RELEASE_NOTES_PATH = 'RELEASE_NOTES.md';
const GEMINI_MODEL = 'gemini-1.5-flash';

async function main() {
  if (!RELEASE_TAG) {
    console.error('RELEASE_TAG environment variable is required');
    process.exit(1);
  }

  console.log(`Enhancing release notes for ${RELEASE_TAG}...`);

  try {
    // 1. Fetch the GitHub Release
    console.log(`Fetching release ${RELEASE_TAG}...`);
    const releaseJson = await $`gh release view ${RELEASE_TAG} --json body,tagName`.text();
    const release = JSON.parse(releaseJson);

    // 2. Enhance with Gemini (with fallback)
    let enhanced: string;
    if (GEMINI_API_KEY) {
      try {
        console.log('Enhancing release notes with Gemini...');
        enhanced = await enhanceWithGemini(release.body, release.tagName);
      } catch (error) {
        console.warn('Gemini enhancement failed, using raw notes:', error);
        enhanced = formatRawNotes(release.body, release.tagName);
      }
    } else {
      console.log('No GEMINI_API_KEY, using raw notes');
      enhanced = formatRawNotes(release.body, release.tagName);
    }

    // 3. Update GitHub Release
    console.log('Updating GitHub Release...');
    await $`gh release edit ${RELEASE_TAG} --notes ${enhanced}`;

    // 4. Prepend to RELEASE_NOTES.md
    console.log('Updating RELEASE_NOTES.md...');
    await prependToReleaseNotes(enhanced);

    // 5. Commit and push
    console.log('Committing changes...');
    await $`git config user.name "scribe-bot"`;
    await $`git config user.email "bot@scribe.dev"`;
    await $`git add ${RELEASE_NOTES_PATH}`;
    await $`git commit -m "docs: enhance release notes for ${RELEASE_TAG} [skip ci]"`;
    await $`git push`;

    console.log('Done!');
  } catch (error) {
    console.error('Enhancement failed:', error);
    process.exit(1);
  }
}

async function enhanceWithGemini(rawChangelog: string, version: string): Promise<string> {
  const prompt = buildPrompt(rawChangelog, version.replace('v', ''));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

function buildPrompt(rawChangelog: string, version: string): string {
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

function formatRawNotes(rawChangelog: string, version: string): string {
  return `# What's New in ${version}\n\n${rawChangelog}`;
}

async function prependToReleaseNotes(enhanced: string) {
  let existing = '';
  try {
    existing = await Bun.file(RELEASE_NOTES_PATH).text();
  } catch {
    // File doesn't exist yet, that's fine
  }

  // Find the position after the header (before the first version block)
  const headerEndIndex = existing.indexOf('\n---\n');
  let newContent: string;

  if (headerEndIndex !== -1) {
    // Insert after header, before existing versions
    const header = existing.slice(0, headerEndIndex);
    const rest = existing.slice(headerEndIndex);
    newContent = header + '\n\n---\n\n' + enhanced + rest;
  } else {
    // No existing versions, just append
    const separator = existing ? '\n\n---\n\n' : '';
    newContent = existing + separator + enhanced + '\n\n---\n';
  }

  await Bun.write(RELEASE_NOTES_PATH, newContent);
}

main().catch(console.error);
