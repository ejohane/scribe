/**
 * ChangelogSettings Component
 *
 * Displays app release notes in the Settings page.
 * Current version is highlighted and expanded by default.
 */

import { useState, useMemo } from 'react';
import { Text, Surface } from '@scribe/design-system';
import { parseReleaseNotes, isCurrentVersion } from '@/utils/parseReleaseNotes';
import * as styles from './ChangelogSettings.css';

interface ChangelogSettingsProps {
  /** Override release notes content (for testing) */
  releaseNotes?: string;
}

export function ChangelogSettings({ releaseNotes }: ChangelogSettingsProps) {
  const content = releaseNotes ?? __RELEASE_NOTES__;
  const appVersion = __APP_VERSION__;

  // Wrap parsing in try-catch for robustness
  const parsed = useMemo(() => {
    try {
      return parseReleaseNotes(content);
    } catch (error) {
      console.error('Failed to parse release notes:', error);
      return { versions: [] };
    }
  }, [content]);

  // Current version is expanded by default
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    const currentVersion = parsed.versions.find((v) => isCurrentVersion(v.version, appVersion));
    if (currentVersion) {
      initial.add(currentVersion.version);
    } else if (parsed.versions.length > 0) {
      initial.add(parsed.versions[0].version);
    }
    return initial;
  });

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  if (parsed.versions.length === 0) {
    return (
      <div className={styles.container}>
        <Text size="md" color="foregroundMuted">
          No release notes available yet. Check back after the next update!
        </Text>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Text size="xl" weight="bold" as="h2">
          Changelog
        </Text>
        <Text size="sm" color="foregroundMuted">
          You&apos;re on version {appVersion}
        </Text>
      </header>

      <div className={styles.versionList}>
        {parsed.versions.map((release) => {
          const isCurrent = isCurrentVersion(release.version, appVersion);
          const isExpanded = expandedVersions.has(release.version);

          return (
            <Surface key={release.version} className={styles.versionCard} data-current={isCurrent}>
              <button
                className={styles.versionHeader}
                onClick={() => toggleVersion(release.version)}
                aria-expanded={isExpanded}
                type="button"
              >
                <span className={styles.versionTitle}>
                  <Text size="md" weight="medium">
                    v{release.version}
                  </Text>
                  {isCurrent && <span className={styles.currentBadge}>Current</span>}
                </span>
                <span className={styles.expandIcon} data-expanded={isExpanded}>
                  ▸
                </span>
              </button>

              {isExpanded && (
                <div className={styles.versionContent}>
                  {release.sections.map((section) => (
                    <div key={section.title} className={styles.section}>
                      <Text size="sm" weight="medium" color="foregroundMuted" as="h3">
                        {section.title}
                      </Text>
                      <ul className={styles.itemList}>
                        {section.items.map((item, i) => (
                          <li key={i} className={styles.item}>
                            <Text size="sm">{item}</Text>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          );
        })}
      </div>
    </div>
  );
}
