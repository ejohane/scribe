# Scribe CI/CD Pipeline Documentation

## Overview

This document defines the complete Continuous Integration and Continuous Deployment (CI/CD) strategy for Scribe. The pipeline is designed to provide fast feedback, ensure code quality, automate versioning using semantic commits, and streamline releases of the Electron desktop application.

**Last Updated**: 2025-11-23  
**Status**: Ready for Implementation  
**Scope**: macOS only (Universal Binary for Intel + Apple Silicon)

---

## Table of Contents

1. [Goals & Principles](#1-goals--principles)
2. [Pipeline Architecture](#2-pipeline-architecture)
3. [Semantic Versioning Strategy](#3-semantic-versioning-strategy)
4. [Conventional Commits Standard](#4-conventional-commits-standard)
5. [Workflow Details](#5-workflow-details)
6. [Test Strategy Integration](#6-test-strategy-integration)
7. [Release Process](#7-release-process)
8. [Security & Secrets Management](#8-security--secrets-management)
9. [Performance & Cost Optimization](#9-performance--cost-optimization)
10. [Branch Protection & Policies](#10-branch-protection--policies)
11. [Developer Workflow](#11-developer-workflow)
12. [Monitoring & Alerting](#12-monitoring--alerting)
13. [Migration & Rollout Plan](#13-migration--rollout-plan)
14. [Troubleshooting Guide](#14-troubleshooting-guide)
15. [Reference & Resources](#15-reference--resources)

---

## 1. Goals & Principles

### Primary Goals

1. **Fast Feedback**: Provide test results in <5 minutes for PRs
2. **Automatic Versioning**: Eliminate manual version bumping via conventional commits
3. **Quality Gates**: Ensure all code merged to `main` passes comprehensive tests
4. **Automated Releases**: Build and publish macOS desktop app (Universal Binary)
5. **Monorepo Optimization**: Leverage Turborepo for incremental builds and caching
6. **Developer Experience**: Make it easy to contribute with clear feedback and automation

### Core Principles

- **Fail Fast**: Lint and typecheck before running expensive tests
- **Test Pyramid**: More unit tests, fewer integration tests, minimal E2E tests
- **Deterministic Builds**: Reproducible builds with locked dependencies
- **Security First**: No secrets in code, signed releases, vulnerability scanning
- **Cost Conscious**: Optimize CI minutes, especially for macOS runners (10x cost)
- **Incremental Everything**: Only rebuild/retest what changed

---

## 2. Pipeline Architecture

### Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKFLOW                        │
│                                                                  │
│  Developer commits → Pre-commit hooks → Push to branch → Open PR│
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PR VALIDATION WORKFLOW                      │
│                       (ci-pr.yml - 3-5 min)                      │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Lint & Format│───▶│  Typecheck   │───▶│  Unit Tests     │   │
│  │ (ESLint +    │    │ (tsc --noEmit)    │  (all packages) │   │
│  │  Prettier)   │    └──────────────┘    └─────────────────┘   │
│  └──────────────┘                                               │
│                                                                  │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │ Build Check  │───▶│     Integration Tests                │   │
│  │ (turbo build)│    │  - Engine integration                │   │
│  └──────────────┘    │  - Renderer component tests          │   │
│                      │  - Preload/IPC contract tests        │   │
│                      └──────────────────────────────────────┘   │
│                                                                  │
│  ✅ All checks pass → Ready to merge                            │
│  ❌ Any check fails → Review required                           │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         │ (PR approved & merged)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN BRANCH CI WORKFLOW                       │
│                    (ci-main.yml - 8-12 min)                      │
│                                                                  │
│  (All PR validation jobs) +                                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              E2E Tests (Electron App)                     │   │
│  │  - mvp.integration.test.ts                                │   │
│  │  - last-note.integration.test.ts                          │   │
│  │  - Run on macOS (primary platform)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           SEMANTIC RELEASE JOB                            │   │
│  │  1. Analyze commits since last release                    │   │
│  │  2. Determine version bump (major/minor/patch)            │   │
│  │  3. Generate CHANGELOG.md                                 │   │
│  │  4. Update package.json versions                          │   │
│  │  5. Commit version bump to main                           │   │
│  │  6. Create Git tag (e.g., v0.2.0)                         │   │
│  │  7. Push tag to repository                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│              (If new release published)                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RELEASE WORKFLOW                            │
│                (release.yml - triggered by tag push)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Build Release Artifacts                      │   │
│  │                                                           │   │
│  │  macOS (Universal Binary - Intel + Apple Silicon):       │   │
│  │    - Scribe-0.2.0-universal.dmg                          │   │
│  │    - Code signed with Apple Developer certificate        │   │
│  │    - Notarized for Gatekeeper                            │   │
│  │                                                           │   │
│  │  Note: Cross-platform support planned for future        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          Upload to GitHub Releases                        │   │
│  │  - Create release page for v0.2.0                        │   │
│  │  - Attach macOS DMG artifact                             │   │
│  │  - Include auto-generated release notes                  │   │
│  │  - Mark as latest release                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  🎉 Release Published - Users can download!                     │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Files Structure

```
.github/
├── workflows/
│   ├── ci-pr.yml              # PR validation (fast feedback)
│   ├── ci-main.yml            # Main branch CI + semantic release
│   ├── release.yml            # Build and publish release artifacts
│   ├── dependencies.yml       # Weekly dependency updates
│   └── security.yml           # Security scanning and audits
│
├── actions/                   # Reusable composite actions
│   ├── setup-bun/
│   │   └── action.yml        # Setup Bun with caching
│   ├── run-tests/
│   │   └── action.yml        # Run tests with coverage
│   └── build-electron/
│       └── action.yml        # Build Electron app
│
└── dependabot.yml            # Dependabot configuration
```

---

## 3. Semantic Versioning Strategy

### Versioning Approach

Scribe uses **automated semantic versioning** powered by **semantic-release**. Version numbers follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH

Example: 1.2.3
         │ │ │
         │ │ └─── Patch: Bug fixes, non-breaking changes
         │ └───── Minor: New features, backward compatible
         └─────── Major: Breaking changes, API changes
```

### Version Bump Rules

| Commit Type        | Version Bump | Example       |
| ------------------ | ------------ | ------------- |
| `fix:`             | PATCH        | 0.1.0 → 0.1.1 |
| `feat:`            | MINOR        | 0.1.0 → 0.2.0 |
| `BREAKING CHANGE:` | MAJOR        | 0.1.0 → 1.0.0 |
| Other types        | NONE         | No release    |

### Pre-release Versions

For beta/alpha releases (future):

```
0.2.0-beta.1
0.2.0-beta.2
0.2.0-rc.1
0.2.0  (final release)
```

Configuration for `beta` branch:

```json
{
  "branches": [
    "main",
    {
      "name": "beta",
      "prerelease": true
    }
  ]
}
```

### Package Versioning

**Desktop App** (`apps/desktop/package.json`):

- Versioned automatically by semantic-release
- User-facing version in app UI and installers

**Internal Packages** (`packages/*/package.json`):

- Use `workspace:*` for internal dependencies
- Not independently versioned (tied to desktop app version)
- Can be extracted and versioned separately in future if needed

---

## 4. Conventional Commits Standard

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer with BREAKING CHANGE or issue references]
```

### Commit Types

| Type       | Description                                      | Bumps Version? |
| ---------- | ------------------------------------------------ | -------------- |
| `feat`     | New feature for the user                         | MINOR          |
| `fix`      | Bug fix for the user                             | PATCH          |
| `docs`     | Documentation only changes                       | NO             |
| `style`    | Formatting, missing semicolons, etc.             | NO             |
| `refactor` | Code change that neither fixes bug nor adds feat | NO             |
| `perf`     | Performance improvements                         | PATCH          |
| `test`     | Adding or updating tests                         | NO             |
| `chore`    | Build process, dependency updates, etc.          | NO             |
| `ci`       | CI/CD configuration changes                      | NO             |
| `revert`   | Reverts a previous commit                        | Depends        |

### Scopes

Scopes represent the area of the codebase affected:

| Scope     | Description                         | Example                                    |
| --------- | ----------------------------------- | ------------------------------------------ |
| `editor`  | Lexical editor and plugins          | `feat(editor): add markdown shortcuts`     |
| `engine`  | Core engine modules                 | `fix(engine): correct metadata extraction` |
| `storage` | File system storage layer           | `feat(storage): add atomic save retries`   |
| `graph`   | Knowledge graph functionality       | `feat(graph): implement backlink count`    |
| `search`  | Search engine and indexing          | `perf(search): optimize tokenization`      |
| `palette` | Command palette                     | `feat(palette): add recent notes history`  |
| `ui`      | User interface components           | `fix(ui): correct theme toggle behavior`   |
| `vault`   | Vault initialization and management | `feat(vault): support custom vault path`   |
| `build`   | Build system and tooling            | `chore(build): update electron-builder`    |
| `deps`    | Dependency updates                  | `chore(deps): update lexical to 0.39.0`    |
| `ci`      | CI/CD pipelines                     | `ci: add E2E test caching`                 |

### Examples

**Patch Release** (0.1.0 → 0.1.1):

```
fix(editor): prevent crash when deleting empty note

The editor would crash if a user tried to delete a note with no content.
Added null check before accessing note content.

Fixes #42
```

**Minor Release** (0.1.0 → 0.2.0):

```
feat(search): add fuzzy search to command palette

Implements fuzzy matching using Fuse.js for more flexible note discovery.
Users can now find notes even with typos or partial matches.

- Added search score ranking
- Highlighted matched characters
- Configurable search threshold
```

**Major Release** (0.1.0 → 1.0.0):

```
feat(storage): migrate to new vault structure

BREAKING CHANGE: Vault structure has changed from flat files to
date-based directories. Users must migrate existing vaults using
the provided migration tool.

Migration guide: docs/vault-migration.md
```

**No Release**:

```
docs: update installation instructions

Added macOS-specific setup steps and troubleshooting section.
```

```
test(graph): add integration tests for backlinks

Covers edge cases for circular references and deleted notes.
```

### Breaking Changes

Breaking changes trigger a MAJOR version bump and **must** include `BREAKING CHANGE:` in the commit footer:

```
feat(api): redesign note creation API

BREAKING CHANGE: The `createNote()` function signature has changed.
Old: createNote(content)
New: createNote({ content, metadata })

Migration: Wrap content in an object with content key.
```

### Reverting Commits

```
revert: feat(search): add fuzzy search

This reverts commit abc123def456.

Reason: Fuzzy search caused performance regression on large vaults.
```

---

## 5. Workflow Details

### 5.1 PR Validation Workflow (`ci-pr.yml`)

**Trigger**:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches:
      - '**' # All branches (for fork support)
      - '!main' # Except main (use ci-main.yml)
```

**Jobs**:

#### Job 1: Lint and Format (30-60s)

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile
    - run: bun run lint
    - run: bunx prettier --check .
```

**Purpose**: Catch style issues early before expensive tests run.

#### Job 2: Typecheck (1-2min)

```yaml
typecheck:
  runs-on: ubuntu-latest
  needs: [lint]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile
    - run: bun run typecheck
```

**Purpose**: Ensure TypeScript compilation succeeds across all packages.

#### Job 3: Unit Tests (1-2min)

```yaml
unit-tests:
  runs-on: ubuntu-latest
  needs: [lint]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile
    - run: turbo run test --filter='./packages/*' --concurrency=4
    - uses: codecov/codecov-action@v3
      with:
        files: ./coverage/*.json
```

**Purpose**: Run all package-level unit tests in parallel.

**Packages tested**:

- `packages/engine-core`
- `packages/engine-graph`
- `packages/engine-search`
- `packages/storage-fs`
- `packages/shared`

#### Job 4: Build Check (1-2min)

```yaml
build:
  runs-on: ubuntu-latest
  needs: [typecheck]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile
    - run: turbo run build
    - uses: actions/cache/save@v3
      with:
        path: |
          packages/*/dist
          apps/desktop/electron/*/dist
          apps/desktop/renderer/dist
        key: build-${{ github.sha }}
```

**Purpose**: Ensure all packages and Electron components build successfully.

#### Job 5: Integration Tests (2-3min)

```yaml
integration-tests:
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - uses: actions/cache/restore@v3
      with:
        path: |
          packages/*/dist
          apps/desktop/electron/*/dist
          apps/desktop/renderer/dist
        key: build-${{ github.sha }}
    - run: bun install --frozen-lockfile
    - run: cd apps/desktop && bun test *.integration.test.ts
    - run: cd apps/desktop/renderer && bun run test
```

**Purpose**: Run integration tests against real filesystem and renderer components.

**Tests run**:

- Engine integration tests (storage + metadata + graph + search)
- Renderer component tests (EditorRoot, CommandPalette)
- Preload/IPC contract tests

**Total PR Validation Time**: ~5 minutes

---

### 5.2 Main Branch CI Workflow (`ci-main.yml`)

**Trigger**:

```yaml
on:
  push:
    branches: [main]
```

**Jobs**: All PR validation jobs (reused) + additional jobs:

#### Job 6: E2E Tests (3-5min)

```yaml
e2e-tests:
  runs-on: macos-latest # Electron works best on macOS
  needs: [build, integration-tests]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - uses: actions/cache/restore@v3
      with:
        path: |
          packages/*/dist
          apps/desktop/electron/*/dist
          apps/desktop/renderer/dist
        key: build-${{ github.sha }}
    - run: bun install --frozen-lockfile
    - run: cd apps/desktop && bun test mvp.integration.test.ts
    - run: cd apps/desktop && bun test last-note.integration.test.ts
```

**Purpose**: Validate full user flows inside real Electron app.

**Tests run**:

- `mvp.integration.test.ts`: Create note, edit, save, reload
- `last-note.integration.test.ts`: Last opened note persistence

**Why macOS for E2E**:

- Primary development and target platform
- Electron stability best on macOS
- Universal Binary supports both Intel and Apple Silicon

#### Job 7: Semantic Release (1-2min)

```yaml
release:
  runs-on: ubuntu-latest
  needs: [lint, typecheck, unit-tests, build, integration-tests, e2e-tests]
  permissions:
    contents: write # Create releases and tags
    issues: write # Comment on issues
    pull-requests: write # Comment on PRs
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Full history required
        persist-credentials: false

    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile

    - name: Semantic Release
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        GIT_AUTHOR_NAME: scribe-bot
        GIT_AUTHOR_EMAIL: bot@scribe.dev
        GIT_COMMITTER_NAME: scribe-bot
        GIT_COMMITTER_EMAIL: bot@scribe.dev
      run: bunx semantic-release

    - name: Output new version
      id: version
      run: |
        if [ -f .VERSION ]; then
          echo "new_version=$(cat .VERSION)" >> $GITHUB_OUTPUT
          echo "new_release_published=true" >> $GITHUB_OUTPUT
        else
          echo "new_release_published=false" >> $GITHUB_OUTPUT
        fi

  outputs:
    new_release_published: ${{ steps.version.outputs.new_release_published }}
    new_version: ${{ steps.version.outputs.new_version }}
```

**What semantic-release does**:

1. Analyzes commits since last release tag
2. Determines version bump (or none if only `chore:`/`docs:` commits)
3. Generates `CHANGELOG.md` with categorized changes
4. Updates `package.json` files with new version
5. Creates a commit: `chore(release): v0.2.0 [skip ci]`
6. Creates Git tag: `v0.2.0`
7. Pushes commit and tag to `main`
8. Creates GitHub Release (draft)

**Total Main CI Time**: ~12 minutes

---

### 5.3 Release Workflow (`release.yml`)

**Trigger**:

```yaml
on:
  push:
    tags:
      - 'v*' # Triggered by semantic-release creating tags
```

**Jobs**:

#### Job 1: Build macOS (15-20min)

```yaml
build-macos:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile

    # Build all packages and Electron components
    - run: turbo run build

    # Build and sign macOS app
    - name: Build Electron App
      env:
        APPLE_ID: ${{ secrets.APPLE_ID }}
        APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
        APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        CSC_LINK: ${{ secrets.CSC_LINK }}
        CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
      run: |
        cd apps/desktop
        bun run dist:mac

    # Upload artifacts
    - uses: actions/upload-artifact@v4
      with:
        name: macos-dmg
        path: apps/desktop/dist/*.dmg
```

**Output**:

- `Scribe-0.2.0-universal.dmg` (Universal Binary: Intel + ARM64)
- Code signed with Apple Developer certificate
- Notarized for macOS Gatekeeper

**Note**: Cross-platform support (Windows, Linux) will be added in future releases when demand justifies the additional complexity.

#### Job 2: Publish Release

```yaml
publish-release:
  runs-on: ubuntu-latest
  needs: [build-macos]
  permissions:
    contents: write
  steps:
    - uses: actions/checkout@v4

    # Download all artifacts
    - uses: actions/download-artifact@v4
      with:
        path: artifacts

    # Update GitHub Release with artifacts
    - name: Publish to GitHub Releases
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      run: |
        gh release upload ${{ github.ref_name }} \
          artifacts/macos-dmg/*.dmg

        # Publish the draft release
        gh release edit ${{ github.ref_name }} --draft=false
```

**Output**: Published GitHub Release with:

- Release notes (auto-generated from commits)
- macOS DMG (Universal Binary for Intel + Apple Silicon)
- SHA256 checksum

**Total Release Time**: ~15-20 minutes

---

### 5.4 Dependency Update Workflow (`dependencies.yml`)

**Trigger**:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9 AM UTC
  workflow_dispatch: # Manual trigger
```

**Job**:

```yaml
update-dependencies:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun

    # Update dependencies
    - run: bun update

    # Run tests to ensure nothing broke
    - run: turbo run lint test build

    # Create PR if changes detected
    - name: Create Pull Request
      uses: peter-evans/create-pull-request@v5
      with:
        commit-message: 'chore(deps): update dependencies'
        title: 'chore(deps): weekly dependency updates'
        body: |
          Automated dependency updates.

          Please review and merge if all checks pass.
        branch: chore/dependency-updates
        delete-branch: true
```

**Dependabot Configuration** (`.github/dependabot.yml`):

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 5
    groups:
      dev-dependencies:
        dependency-type: 'development'
      production-dependencies:
        dependency-type: 'production'
```

---

### 5.5 Security Workflow (`security.yml`)

**Trigger**:

```yaml
on:
  schedule:
    - cron: '0 0 * * *' # Daily at midnight
  pull_request:
  push:
    branches: [main]
```

**Jobs**:

#### Job 1: Dependency Audit

```yaml
audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-bun
    - run: bun install --frozen-lockfile
    - run: bun audit
```

#### Job 2: CodeQL Analysis

```yaml
codeql:
  runs-on: ubuntu-latest
  permissions:
    security-events: write
  steps:
    - uses: actions/checkout@v4
    - uses: github/codeql-action/init@v2
      with:
        languages: javascript, typescript
    - uses: github/codeql-action/analyze@v2
```

---

## 6. Test Strategy Integration

The CI/CD pipeline integrates directly with Scribe's [testing strategy](testing_strategy_and_design.md):

### Test Mapping to CI Stages

| Test Level           | CI Stage  | Frequency | Runtime |
| -------------------- | --------- | --------- | ------- |
| Unit Tests           | PR + Main | Every PR  | 1-2 min |
| Engine Integration   | PR + Main | Every PR  | 2-3 min |
| Renderer Component   | PR + Main | Every PR  | 1 min   |
| Preload/IPC Contract | PR + Main | Every PR  | 30s     |
| E2E Tests            | Main only | Main push | 3-5 min |

### Test Commands

```bash
# Run in CI
turbo run test                           # All tests
turbo run test --filter='./packages/*'   # Package unit tests only
cd apps/desktop && bun test *.integration.test.ts  # E2E tests
cd apps/desktop/renderer && bun run test           # Renderer tests
```

### Coverage Requirements

- **Minimum coverage**: 70% overall
- **Critical paths**: 90% (storage, metadata, graph)
- **Reports**: Uploaded to Codecov
- **PR comments**: Coverage diff vs. base branch

---

## 7. Release Process

### Automated Release Flow

```
1. Developer merges PR to main
   ↓
2. Main CI runs (all tests pass)
   ↓
3. semantic-release analyzes commits:
   - feat: add search → MINOR bump (0.1.0 → 0.2.0)
   - fix: editor crash → PATCH bump (0.1.0 → 0.1.1)
   - BREAKING CHANGE → MAJOR bump (0.1.0 → 1.0.0)
   ↓
4. semantic-release:
   - Updates package.json to 0.2.0
   - Generates CHANGELOG.md
   - Commits: "chore(release): v0.2.0 [skip ci]"
   - Creates tag: v0.2.0
   - Pushes to main
   ↓
5. Tag push triggers release.yml
   ↓
6. Build job runs:
   - macOS: Scribe-0.2.0-universal.dmg
   ↓
7. Artifacts uploaded to GitHub Release
   ↓
8. Release published (users can download)
```

### Manual Release Override

If needed, manually create a release:

```bash
# Tag manually
git tag v0.3.0
git push origin v0.3.0

# Triggers release.yml workflow
```

### Hotfix Process

For urgent fixes:

```bash
# 1. Create hotfix branch from tag
git checkout -b hotfix/v0.2.1 v0.2.0

# 2. Make fix and commit
git commit -m "fix(editor): critical crash on startup"

# 3. Merge to main (or create PR)
git checkout main
git merge hotfix/v0.2.1

# 4. semantic-release will bump to 0.2.1
```

### Release Checklist

**Before Release**:

- [ ] All E2E tests passing on main
- [ ] No open P0/P1 bugs
- [ ] Release notes reviewed (auto-generated)
- [ ] Testing performed on target platforms

**After Release**:

- [ ] Download and verify installers work
- [ ] Update documentation with new version
- [ ] Announce release (if major/minor)
- [ ] Close milestone (if using GitHub milestones)

---

## 8. Security & Secrets Management

### Required Secrets

Store in GitHub repository settings → Secrets and variables → Actions:

#### macOS Code Signing

```
APPLE_ID                  # Your Apple ID email
APPLE_ID_PASSWORD         # App-specific password (not main password)
APPLE_TEAM_ID             # 10-character team ID
CSC_LINK                  # Base64-encoded .p12 certificate
CSC_KEY_PASSWORD          # Certificate password
```

**Obtaining macOS certificates**:

```bash
# Export certificate from Keychain
# Keychain Access → My Certificates → Right-click → Export

# Encode to base64
base64 -i certificate.p12 | pbcopy

# Paste into CSC_LINK secret
```

#### GitHub Token

```
GITHUB_TOKEN  # Auto-provided by GitHub Actions (no setup needed)
```

### Secret Rotation Policy

- **Rotate secrets every 90 days**
- **Revoke immediately if exposed**
- **Use app-specific passwords** (not main account passwords)
- **Audit secret usage** quarterly

### Security Scanning

**Daily scans**:

- `bun audit` for known vulnerabilities
- CodeQL for code quality issues
- Dependabot alerts for outdated packages

**PR checks**:

- No secrets in code (via git-secrets or similar)
- License compatibility check

---

## 9. Performance & Cost Optimization

### GitHub Actions Minutes

**Free tier limits**:

- Linux: 2,000 min/month (1x multiplier)
- macOS: 2,000 min/month (10x multiplier → 200 actual minutes)
- Windows: 2,000 min/month (2x multiplier → 1,000 actual minutes)

**Estimated usage**:

| Workflow    | Frequency    | Runtime | Minutes/Month |
| ----------- | ------------ | ------- | ------------- |
| PR CI       | 20 PRs/month | 5 min   | 100 min       |
| Main CI     | 20 merges    | 12 min  | 240 min       |
| E2E (macOS) | 20 merges    | 5 min   | 1,000 min\*   |
| Releases    | 4 releases   | 20 min  | 320 min\*     |
| Security    | Daily        | 2 min   | 60 min        |
| **Total**   |              |         | **1,720 min** |

\*macOS time (10x multiplier applied)

### Optimization Strategies

**1. Concurrency limits** (cancel stale runs):

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**2. Conditional jobs**:

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

**3. Aggressive caching**:

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.bun/install/cache
    key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lockb') }}
```

**4. Turbo Remote Cache** (future):

```bash
turbo run build --token=${{ secrets.TURBO_TOKEN }} --team=scribe
```

**5. Skip E2E on docs-only changes**:

```yaml
paths-ignore:
  - '**.md'
  - 'docs/**'
```

### Cost Monitoring

- **GitHub Actions usage dashboard**: Settings → Billing → Usage
- **Alert at 80% of quota**: Set up billing alerts
- **Upgrade if needed**: GitHub Team plan ($4/user/month) for 3,000 minutes

---

## 10. Branch Protection & Policies

### Main Branch Policy

**Decision**: The `main` branch will remain **open without protection rules** for MVP development phase.

**Rationale**:

- Allows rapid iteration during early development
- Simplifies semantic-release workflow (no bypass configuration needed)
- CI/CD workflows provide quality gates without blocking merges
- Solo/small team development benefits from flexibility
- Can add protection rules when transitioning to public release

**Quality Assurance**:

- All code changes still run through CI/CD pipelines
- Automated tests (unit, integration, E2E) provide confidence
- Semantic-release ensures proper versioning
- Manual code review via PRs as needed (without enforcement)

**Future Considerations**:

- Add branch protection before public beta/release
- Enable required status checks when team expands
- Consider protection rules before open-sourcing or accepting external contributions

### PR Merge Strategies

**Allowed merge types**:

- [x] Squash and merge (recommended for conventional commits)
- [ ] Merge commit (disabled)
- [ ] Rebase and merge (disabled)

**Why squash**: Ensures one commit per PR → cleaner commit history for semantic-release

---

## 11. Developer Workflow

### Local Development

**1. Install pre-commit hooks**:

```bash
# First time setup
bun install
bun run prepare  # Installs husky hooks
```

**2. Make changes and commit**:

```bash
# Stage changes
git add .

# Commit (hooks will validate message)
git commit -m "feat(editor): add keyboard shortcuts"

# If commit message is invalid, hook will reject it
```

**3. Push and create PR**:

```bash
git push origin feature/keyboard-shortcuts

# Create PR via GitHub UI or gh CLI
gh pr create --title "Add keyboard shortcuts" --body "Implements cmd+b for bold, cmd+i for italic"
```

**4. CI runs automatically**:

- Watch PR checks in GitHub UI
- Fix any failures and push new commits
- CI re-runs automatically

**5. Merge when approved and green**:

- Squash and merge via GitHub UI
- Delete branch after merge

### Commit Message Helpers

**VS Code extension**: [Conventional Commits](https://marketplace.visualstudio.com/items?itemName=vivaxy.vscode-conventional-commits)

**CLI tool**:

```bash
bunx git-cz  # Interactive commit message builder
```

**Template** (`.gitmessage`):

```
<type>(<scope>): <subject>

# Why (motivation for the change):


# What (what changed):


# Breaking changes (if any):

```

Set as default:

```bash
git config commit.template .gitmessage
```

### Testing Locally Before Push

Run the same checks as CI:

```bash
# Full PR validation
bun run lint
bun run typecheck
turbo run test
turbo run build

# Integration tests
cd apps/desktop && bun test *.integration.test.ts

# E2E tests (macOS only)
cd apps/desktop && bun test mvp.integration.test.ts
```

### Validating Semantic Release Locally

Test what version would be released:

```bash
# Dry run (doesn't actually release)
bunx semantic-release --dry-run

# Output shows:
# - Detected commits
# - Calculated version bump
# - Generated release notes
```

---

## 12. Monitoring & Alerting

### CI Health Metrics

Track via GitHub Insights → Actions:

**Key metrics**:

- **Pass rate**: Target >95% on main
- **Mean time to feedback**: Target <5 min for PRs
- **Flaky test rate**: Target <2%
- **Build duration trend**: Alert if increasing

### Failure Notifications

**Slack integration** (optional):

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Email notifications**:

- Configure in GitHub Settings → Notifications
- Set to "Send notifications for failed workflows only"

### Release Monitoring

**Post-release checks**:

- [ ] DMG downloadable from GitHub Releases
- [ ] File size reasonable (<200MB)
- [ ] macOS Gatekeeper accepts signed app
- [ ] Works on both Intel and Apple Silicon Macs
- [ ] Auto-update works (when implemented)

**User-facing issues**:

- Monitor GitHub Issues for crash reports
- Track download counts via GitHub API
- Set up Sentry/error tracking (future)

---

## 13. Migration & Rollout Plan

### Phase 1: Setup (Week 1)

**Day 1-2**: Repository setup

- [ ] Create `.github/workflows/` directory
- [ ] Add `ci-pr.yml` (start with basic version)
- [ ] Test with a sample PR

**Day 3**: Semantic release setup

- [ ] Install `semantic-release` and plugins
- [ ] Create `.releaserc.json` configuration
- [ ] Add `commitlint` and husky hooks
- [ ] Update `CONTRIBUTING.md` with commit guidelines

**Day 4**: Main CI

- [ ] Add `ci-main.yml` with E2E tests
- [ ] Integrate semantic-release job
- [ ] Test full flow on main branch

**Day 5**: Release workflow

- [ ] Add `release.yml` for artifact builds
- [ ] Configure macOS code signing secrets
- [ ] Test release with a `v0.1.0-beta.1` tag

### Phase 2: Validation (Week 2)

**Week 2**: Team adoption

- [ ] Team training on conventional commits
- [ ] Run 5-10 PRs through new CI
- [ ] Fix any flaky tests
- [ ] Optimize CI performance

### Phase 3: Production (Week 3+)

**Week 3**: First production release

- [ ] Merge all pending PRs
- [ ] Create first semantic release (v0.1.0)
- [ ] Verify installers work on all platforms
- [ ] Document release process

**Ongoing**:

- [ ] Add dependency update automation
- [ ] Add security scanning
- [ ] Monitor CI health metrics
- [ ] Iterate on optimizations

### Rollback Plan

If CI causes issues:

1. **Disable workflows temporarily**:

   ```yaml
   # Add to top of workflow file
   if: false # Disables entire workflow
   ```

2. **Revert to manual versioning**:
   - Remove semantic-release job
   - Version manually in `package.json`
   - Create tags manually

3. **Keep PR checks minimal**:
   - Only lint and typecheck
   - Skip integration/E2E tests

---

## 14. Troubleshooting Guide

### Common Issues

#### Issue: Semantic release not creating a release

**Symptoms**: Main CI passes but no version bump occurs

**Causes**:

- No `feat:` or `fix:` commits since last release
- Commits are `chore:` or `docs:` only (don't trigger releases)
- Commit message format incorrect

**Solution**:

```bash
# Check what semantic-release would do
bunx semantic-release --dry-run

# Verify commit messages follow convention
git log --oneline origin/v0.1.0..HEAD
```

#### Issue: E2E tests flaky

**Symptoms**: Tests pass locally but fail in CI

**Causes**:

- Race conditions in Electron startup
- Filesystem timing issues
- Display/headless mode differences

**Solutions**:

1. Add longer timeouts:

   ```typescript
   await waitFor(() => expect(element).toBeInTheDocument(), { timeout: 5000 });
   ```

2. Use retry logic:

   ```yaml
   - uses: nick-invision/retry@v2
     with:
       timeout_minutes: 10
       max_attempts: 3
       command: bun test mvp.integration.test.ts
   ```

3. Add debug logging:
   ```typescript
   console.log('Current state:', app.getState());
   ```

#### Issue: macOS code signing fails

**Symptoms**: `release.yml` fails during `dist:mac`

**Causes**:

- Expired certificate
- Wrong certificate format
- Missing secrets

**Solutions**:

1. Verify secrets are set correctly in GitHub Settings
2. Check certificate expiration in Apple Developer portal
3. Re-encode certificate:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
4. Test locally:
   ```bash
   export CSC_LINK="base64string..."
   export CSC_KEY_PASSWORD="password"
   bun run dist:mac
   ```

#### Issue: Build artifacts too large

**Symptoms**: DMG/exe files are 500MB+ (expected: <200MB)

**Causes**:

- Development dependencies bundled
- Source maps included
- Unoptimized assets

**Solutions**:

1. Check `electron-builder` config:

   ```json
   {
     "files": ["electron/main/dist/**/*", "!**/*.map", "!**/*.ts"]
   }
   ```

2. Verify production build:

   ```bash
   NODE_ENV=production bun run build
   ```

3. Analyze bundle size:
   ```bash
   bunx webpack-bundle-analyzer apps/desktop/renderer/dist/stats.json
   ```

#### Issue: CI runs out of minutes

**Symptoms**: Workflows fail with "Usage limit exceeded"

**Solutions**:

1. Check usage: Settings → Billing → Usage
2. Optimize macOS jobs (10x cost):
   - Run E2E only on main, not PRs
   - Use matrix strategy sparingly
3. Add path filters to skip unnecessary runs:
   ```yaml
   paths-ignore:
     - 'docs/**'
     - '**.md'
   ```
4. Upgrade plan if needed

### Debug Commands

**Check workflow syntax**:

```bash
gh workflow list
gh workflow view ci-pr.yml
```

**View workflow run logs**:

```bash
gh run list --workflow=ci-pr.yml
gh run view <run-id> --log
```

**Re-run failed jobs**:

```bash
gh run rerun <run-id>
gh run rerun <run-id> --failed  # Only failed jobs
```

**Test semantic-release locally**:

```bash
# Requires GITHUB_TOKEN
export GITHUB_TOKEN=ghp_xxxxx
bunx semantic-release --dry-run --no-ci
```

---

## 15. Reference & Resources

### Configuration Files

All CI/CD configuration lives in:

```
.github/
├── workflows/           # GitHub Actions workflows
├── actions/            # Reusable composite actions
└── dependabot.yml      # Dependency updates

.releaserc.json         # Semantic release config
commitlint.config.js    # Commit message linting
.husky/                 # Git hooks
```

### Key Tools & Versions

| Tool             | Purpose                   | Version |
| ---------------- | ------------------------- | ------- |
| semantic-release | Automated versioning      | ^22.0.0 |
| commitlint       | Commit message validation | ^18.0.0 |
| husky            | Git hooks                 | ^8.0.0  |
| electron-builder | App packaging             | ^26.0.0 |
| Turborepo        | Monorepo build            | ^2.3.3  |
| Bun              | Package manager & runtime | 1.1.38  |

### Documentation Links

**Internal**:

- [Testing Strategy](testing_strategy_and_design.md)
- [Architecture Guide](README.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Development Workflow](../DEVELOPMENT.md)

**External**:

- [Semantic Release](https://semantic-release.gitbook.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Electron Builder](https://www.electron.build/)
- [Turborepo CI](https://turbo.build/repo/docs/ci)

### GitHub Actions Marketplace

**Recommended actions**:

- [actions/checkout](https://github.com/actions/checkout)
- [actions/cache](https://github.com/actions/cache)
- [codecov/codecov-action](https://github.com/codecov/codecov-action)
- [8398a7/action-slack](https://github.com/8398a7/action-slack)

---

## Appendix A: Semantic Release Configuration

**Complete `.releaserc.json`**:

```json
{
  "branches": ["main"],
  "plugins": [
    [
      "@semantic-release/commit-analyzer",
      {
        "preset": "conventionalcommits",
        "releaseRules": [
          { "type": "feat", "release": "minor" },
          { "type": "fix", "release": "patch" },
          { "type": "perf", "release": "patch" },
          { "type": "revert", "release": "patch" },
          { "type": "docs", "scope": "README", "release": "patch" },
          { "type": "refactor", "release": "patch" },
          { "type": "style", "release": false },
          { "type": "chore", "release": false },
          { "type": "test", "release": false },
          { "scope": "no-release", "release": false }
        ],
        "parserOpts": {
          "noteKeywords": ["BREAKING CHANGE", "BREAKING CHANGES"]
        }
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        "preset": "conventionalcommits",
        "presetConfig": {
          "types": [
            { "type": "feat", "section": "Features" },
            { "type": "fix", "section": "Bug Fixes" },
            { "type": "perf", "section": "Performance Improvements" },
            { "type": "revert", "section": "Reverts" },
            { "type": "docs", "section": "Documentation", "hidden": false },
            { "type": "style", "section": "Styles", "hidden": true },
            { "type": "chore", "section": "Miscellaneous Chores", "hidden": true },
            { "type": "refactor", "section": "Code Refactoring", "hidden": false },
            { "type": "test", "section": "Tests", "hidden": true },
            { "type": "build", "section": "Build System", "hidden": true },
            { "type": "ci", "section": "Continuous Integration", "hidden": true }
          ]
        }
      }
    ],
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md",
        "changelogTitle": "# Scribe Changelog\n\nAll notable changes to this project will be documented in this file."
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": [
          "package.json",
          "apps/desktop/package.json",
          "packages/*/package.json",
          "CHANGELOG.md"
        ],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    [
      "@semantic-release/github",
      {
        "successComment": false,
        "failComment": false,
        "releasedLabels": ["released"]
      }
    ]
  ]
}
```

---

## Appendix B: Commitlint Configuration

**Complete `commitlint.config.js`**:

```javascript
export default {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Type enum
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting
        'refactor', // Code restructuring
        'perf', // Performance
        'test', // Tests
        'chore', // Maintenance
        'ci', // CI/CD
        'revert', // Revert commit
      ],
    ],

    // Scope enum
    'scope-enum': [
      2,
      'always',
      [
        'editor',
        'engine',
        'storage',
        'graph',
        'search',
        'palette',
        'ui',
        'vault',
        'build',
        'deps',
        'ci',
        'release',
      ],
    ],

    // Subject rules
    'subject-case': [2, 'never', ['upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // Footer rules
    'footer-leading-blank': [2, 'always'],
  },
};
```

---

## Appendix C: Husky Git Hooks

**`.husky/commit-msg`**:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Validate commit message
bun commitlint --edit $1
```

**`.husky/pre-commit`**:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting on staged files
bunx lint-staged
```

**`package.json` lint-staged config**:

```json
{
  "lint-staged": {
    "*.{js,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

---

## Appendix D: GitHub Actions Composite Actions

**`.github/actions/setup-bun/action.yml`**:

```yaml
name: 'Setup Bun'
description: 'Setup Bun with caching'

inputs:
  bun-version:
    description: 'Bun version to install'
    required: false
    default: '1.1.38'

runs:
  using: 'composite'
  steps:
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: ${{ inputs.bun-version }}

    - name: Get bun cache directory
      id: bun-cache-dir
      shell: bash
      run: echo "dir=$(bun pm cache)" >> $GITHUB_OUTPUT

    - name: Cache Bun dependencies
      uses: actions/cache@v3
      with:
        path: ${{ steps.bun-cache-dir.outputs.dir }}
        key: bun-${{ runner.os }}-${{ hashFiles('**/bun.lockb') }}
        restore-keys: |
          bun-${{ runner.os }}-
```

---

## Document History

| Version | Date       | Author       | Changes                       |
| ------- | ---------- | ------------ | ----------------------------- |
| 1.0     | 2025-11-23 | AI Assistant | Initial comprehensive version |

---

**End of Document**
