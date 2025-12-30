/**
 * parseReleaseNotes.ts
 *
 * Parses RELEASE_NOTES.md content into structured version blocks.
 * Used by ChangelogSettings to display release history.
 */

export interface ReleaseSection {
  /** Section title (e.g., "Highlights", "Features", "Bug Fixes") */
  title: string;
  /** Individual bullet points (markdown preserved) */
  items: string[];
}

export interface ReleaseVersion {
  /** Semantic version without 'v' prefix (e.g., "1.32.0") */
  version: string;
  /** Original version string (e.g., "v1.32.0") */
  rawVersion: string;
  /** Optional date if present in header */
  date?: string;
  /** Parsed sections within this version */
  sections: ReleaseSection[];
  /** Original markdown for this version block */
  rawContent: string;
}

export interface ParsedReleaseNotes {
  /** Optional header content before first version (intro text) */
  header?: string;
  /** All version blocks, newest first */
  versions: ReleaseVersion[];
}

const VERSION_HEADER_REGEX = /^# What's New in v(\d+\.\d+\.\d+)(?:\s+\(([^)]+)\))?/m;
const SECTION_HEADER_REGEX = /^## (.+)$/;
const SEPARATOR = '---';

/**
 * Parse RELEASE_NOTES.md content into structured data
 */
export function parseReleaseNotes(markdown: string): ParsedReleaseNotes {
  if (!markdown || typeof markdown !== 'string') {
    return { versions: [] };
  }

  const result: ParsedReleaseNotes = { versions: [] };

  // Split by separator
  const blocks = markdown
    .split(SEPARATOR)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const versionMatch = block.match(VERSION_HEADER_REGEX);

    if (versionMatch) {
      const [, version, date] = versionMatch;
      const sections = parseSections(block);

      result.versions.push({
        version,
        rawVersion: `v${version}`,
        date,
        sections,
        rawContent: block,
      });
    } else if (!result.header) {
      // First block without version header is the intro
      result.header = block;
    }
  }

  return result;
}

/**
 * Parse sections within a version block
 */
function parseSections(content: string): ReleaseSection[] {
  const sections: ReleaseSection[] = [];
  const lines = content.split('\n');

  let currentSection: ReleaseSection | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(SECTION_HEADER_REGEX);

    if (sectionMatch) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: sectionMatch[1], items: [] };
    } else if (currentSection) {
      // Handle both - and * bullet styles
      if (line.startsWith('- ')) {
        currentSection.items.push(line.slice(2));
      } else if (line.startsWith('* ')) {
        currentSection.items.push(line.slice(2));
      }
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Get a specific version's release notes
 */
export function getVersionNotes(
  parsed: ParsedReleaseNotes,
  version: string
): ReleaseVersion | undefined {
  const normalized = version.replace(/^v/, '');
  return parsed.versions.find((v) => v.version === normalized);
}

/**
 * Check if a version matches the current app version
 */
export function isCurrentVersion(version: string, appVersion: string): boolean {
  const normalizedVersion = version.replace(/^v/, '');
  const normalizedApp = appVersion.replace(/^v/, '');
  return normalizedVersion === normalizedApp;
}
