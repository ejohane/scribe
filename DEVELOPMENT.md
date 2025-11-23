# Development Guide

Complete guide for developing Scribe, a personal note-taking system with markdown parsing, graph visualization, and intelligent search.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Monorepo Structure](#monorepo-structure)
- [Package Responsibilities](#package-responsibilities)
- [Development Workflow](#development-workflow)
- [Build Process](#build-process)
- [Testing](#testing)
- [Code Style](#code-style)
- [Contribution Guidelines](#contribution-guidelines)

## Architecture Overview

Scribe is built as a Turborepo monorepo.

### Packages

To be implemented based on new architecture.

#### Configuration

**`config/tsconfig`**
Shared TypeScript configurations.

- `base.json`: Base config for all packages
- `node.json`: Node.js packages

**`config/eslint`**
Shared ESLint configurations.

- `index.js`: Base config

**`config/prettier`**
Shared Prettier configuration for consistent formatting.

## Package Responsibilities

To be defined based on new architecture.

## Development Workflow

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd scribe

# Install dependencies
bun install

# Verify installation
bun run build
bun run test
```

### Development Mode

To be defined based on new architecture as packages are implemented.

## Build Process

### Full Build

```bash
# Build all packages in dependency order
bun run build
```

Turborepo automatically handles:

- Dependency ordering (packages built in correct sequence)
- Parallel execution (independent packages built concurrently)
- Caching (unchanged packages skipped)

### Build Pipeline

To be defined based on new architecture.

### Development Scripts

All scripts defined in root `package.json`:

```json
{
  "scripts": {
    "build": "turbo run build", // Build all packages
    "test": "turbo run test", // Run all tests
    "lint": "turbo run lint", // Lint all packages
    "clean": "turbo run clean && ..." // Clean build artifacts
  }
}
```

## Testing

### Test Infrastructure

- **Test Runner**: Bun's built-in test runner
- **Test Framework**: Bun test API (`describe`, `test`, `expect`)

### Running Tests

```bash
# Run all tests
bun run test

# Run tests for specific package
cd packages/utils
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/normalize.test.ts
```

### Test Organization

To be defined based on new architecture.

## Code Style

### TypeScript

- **Strict mode**: Enabled in all packages
- **Module system**: ESM (`"type": "module"`)
- **Target**: ES2022
- **Imports**: Use `.js` extension for local imports (ESM requirement)

Example:

```typescript
import type { MyType } from './types.js';
import { myFunction } from './utils.js'; // Note .js extension
```

### Formatting

- **Tool**: Prettier
- **Config**: `config/prettier/index.json`
- **Line length**: 100 characters
- **Trailing commas**: ES5
- **Single quotes**: Yes

### Linting

- **Tool**: ESLint
- **Config**: `config/eslint/`
- **Rules**: TypeScript recommended

Run linting:

```bash
bun run lint
```

### File Naming

- **Source files**: `kebab-case.ts`
- **Test files**: `kebab-case.test.ts`
- **Components**: `PascalCase.tsx`
- **Types**: `PascalCase` or `camelCase` depending on usage

### Import Organization

```typescript
// 1. External dependencies
import { readFile } from 'fs/promises';

// 2. Internal packages (scoped) - to be defined
// import type { MyType } from '@scribe/my-package';

// 3. Local imports
import { myFunction } from './utils.js';
import type { MyOptions } from './types.js';
```

## Contribution Guidelines

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `fix/*`: Bug fixes

### Commit Messages

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `chore`: Build/tooling changes

Examples:

```
feat(parser): add support for frontmatter tags

Implement tag extraction from YAML frontmatter in addition
to inline tags in note content.

Closes #123
```

```
fix(search): correct fuzzy search scoring

The fuzzy search was incorrectly weighting partial matches.
Adjusted the scoring algorithm to prioritize exact matches.
```

### Pull Request Process

1. **Create feature branch**:

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**:

   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

3. **Ensure tests pass**:

   ```bash
   bun run test
   bun run build
   bun run lint
   ```

4. **Push and create PR**:

   ```bash
   git push origin feature/my-feature
   ```

5. **PR checklist**:
   - [ ] Tests pass
   - [ ] Build succeeds
   - [ ] Linting passes
   - [ ] Documentation updated
   - [ ] Commit messages follow convention

### Code Review Guidelines

- Keep PRs focused and small
- Include tests for new features
- Update documentation for API changes
- Respond to feedback constructively
- Squash commits before merging

### Development Best Practices

1. **Type Safety**: Use strict TypeScript types, avoid `any`
2. **Testing**: Write tests for new features and bug fixes
3. **Documentation**: Update docs when changing APIs
4. **Performance**: Consider performance implications
5. **Dependencies**: Minimize external dependencies
6. **Accessibility**: Follow WCAG guidelines for UI

### Getting Help

- **Architecture docs**: See `architecture/` directory
- **Issues**: File bugs and feature requests on GitHub
- **Discussions**: Use GitHub Discussions for questions

---

## Useful Commands Reference

```bash
# Development
bun run build            # Build all packages
bun run test             # Run all tests
bun run lint             # Lint all code

# Package specific
cd packages/<name>
bun test                 # Run package tests
bun run build            # Type-check package
bun test --watch         # Watch mode

# Cleanup
bun run clean            # Remove build artifacts
rm -rf node_modules      # Clean dependencies
bun install              # Reinstall
```

## Troubleshooting

To be added as new architecture is implemented.
