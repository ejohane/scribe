# Contributing to Scribe

Thank you for your interest in contributing to Scribe! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Node.js >= 18.0.0
- Git
- Code editor (VS Code recommended)

### Setup

1. **Fork and clone the repository**:

   ```bash
   git clone https://github.com/yourusername/scribe.git
   cd scribe
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Verify setup**:

   ```bash
   bun run build
   bun run test
   ```

4. **Ready to develop** - Development workflows will be defined as packages are implemented.

## Development Workflow

### 1. Create a Branch

Create a descriptive branch name:

```bash
# For new features
git checkout -b feature/add-pdf-export

# For bug fixes
git checkout -b fix/search-ranking-bug

# For documentation
git checkout -b docs/update-api-docs

# For refactoring
git checkout -b refactor/simplify-parser
```

### 2. Make Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Test Your Changes

Before committing, ensure all checks pass:

```bash
# Run all tests
bun run test

# Build all packages
bun run build

# Run linting
bun run lint
```

### 4. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes
- `perf`: Performance improvements

#### Scope

The scope should be the package or component name (e.g., `config`, etc.).

#### Examples

```bash
# Good commit messages
git commit -m "feat(config): add support for dark mode"
git commit -m "fix(config): correct ESLint configuration"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(utils): add tests for helper functions"

# Bad commit messages (avoid these)
git commit -m "update stuff"
git commit -m "fix bug"
git commit -m "WIP"
```

#### Multi-line commits

For more complex changes:

```bash
git commit -m "feat(core): add support for multiple vaults

This commit adds the ability to work with multiple vaults
simultaneously. Each vault operates independently with its own
state and configuration.

Closes #123"
```

### 5. Push and Create Pull Request

```bash
# Push your branch
git push origin feature/your-feature

# Create pull request on GitHub
```

## Pull Request Guidelines

### PR Title

Use the same format as commit messages:

```
feat(core): add support for dark mode
fix(config): correct ESLint configuration
```

### PR Description

Include:

1. **What** - What does this PR do?
2. **Why** - Why is this change needed?
3. **How** - How does it work?
4. **Testing** - How was it tested?
5. **Screenshots** - If UI changes, include before/after screenshots

Template:

```markdown
## Description

Brief description of the changes.

## Motivation

Why is this change necessary? What problem does it solve?

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How have you tested this?

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] Build passes
- [ ] Tests pass

## Screenshots (if applicable)

Before:
[Screenshot]

After:
[Screenshot]

## Related Issues

Closes #123
Relates to #456
```

### PR Checklist

Before submitting, verify:

- [ ] Code follows the project's style guidelines
- [ ] Tests have been added for new features
- [ ] All tests pass (`bun run test`)
- [ ] Build succeeds (`bun run build`)
- [ ] Linting passes (`bun run lint`)
- [ ] Documentation has been updated
- [ ] Commit messages follow conventional commits
- [ ] PR title follows conventional commits
- [ ] No unnecessary dependencies added

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `type` over `interface` for simple types
- Use `interface` for extendable object shapes
- Avoid `any` - use `unknown` if type is truly unknown
- Use descriptive variable names

```typescript
// Good
function parseNote(filePath: string): ParsedNote {
  const content = readFileSync(filePath, 'utf-8');
  return {
    id: generateNoteId(filePath),
    path: filePath,
    content,
  };
}

// Bad
function parse(fp: string): any {
  const c = readFileSync(fp, 'utf-8');
  return { i: genId(fp), p: fp, c };
}
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`
- **Private members**: Prefix with `_` or use `#` for truly private

```typescript
// Good
class NoteParser {
  private readonly MAX_FILE_SIZE = 10_000_000;

  parseNote(filePath: string): ParsedNote {
    // ...
  }
}

// Bad
class noteparser {
  max_file_size = 10000000;

  ParseNote(FilePath: string): parsednote {
    // ...
  }
}
```

### Comments

- Write self-documenting code first
- Add comments for complex logic
- Use JSDoc for public APIs

```typescript
/**
 * Parse a markdown file into a ParsedNote structure.
 *
 * @param file - Raw file to parse
 * @returns Parsed note with extracted metadata
 * @throws {Error} If file content is invalid
 */
export function parseNote(file: RawFile): ParsedNote {
  // Extract frontmatter first as it may override title
  const frontmatter = parseFrontmatter(file.content);

  // ...
}
```

### Testing

- Write tests for all new features
- Test edge cases and error conditions
- Keep tests simple and focused
- Use descriptive test names

```typescript
import { describe, test, expect } from 'bun:test';
import { parseNote } from './parser';

describe('parseNote', () => {
  test('should extract title from frontmatter', () => {
    const file = {
      path: 'test.md',
      content: '---\ntitle: My Note\n---\n\nContent',
      lastModified: Date.now(),
    };

    const result = parseNote(file);
    expect(result.frontmatterTitle).toBe('My Note');
  });

  test('should handle missing frontmatter', () => {
    const file = {
      path: 'test.md',
      content: '# My Note\n\nContent',
      lastModified: Date.now(),
    };

    const result = parseNote(file);
    expect(result.frontmatterTitle).toBeUndefined();
    expect(result.h1Title).toBe('My Note');
  });
});
```

## Documentation

### When to Update Documentation

Update documentation when you:

- Add a new feature
- Change an API
- Fix a significant bug
- Add or change configuration
- Update dependencies

### What to Document

- **README.md**: High-level overview, quick start
- **DEVELOPMENT.md**: Detailed development guide
- **Architecture docs**: Design decisions, system architecture
- **Code comments**: Complex algorithms, non-obvious logic
- **JSDoc**: Public APIs, exported functions/classes

### Documentation Style

- Be concise but complete
- Use code examples
- Include common use cases
- Link to related documentation
- Keep it up to date

## Review Process

### What to Expect

1. **Initial Review**: Within 1-2 days
2. **Feedback**: Constructive comments and suggestions
3. **Iteration**: You may need to make changes
4. **Approval**: Once all feedback is addressed
5. **Merge**: Maintainer will merge your PR

### Responding to Feedback

- Be open to suggestions
- Ask questions if unclear
- Make requested changes promptly
- Mark conversations as resolved when fixed
- Be patient and respectful

### Code Review Checklist

Reviewers will check:

- [ ] Code quality and style
- [ ] Test coverage
- [ ] Documentation completeness
- [ ] No breaking changes (or properly documented)
- [ ] Performance implications considered
- [ ] Security implications considered
- [ ] Accessibility (for UI changes)

## Types of Contributions

### Bug Fixes

1. Open an issue describing the bug (if not already reported)
2. Create a branch: `fix/description`
3. Write a failing test that reproduces the bug
4. Fix the bug
5. Ensure the test now passes
6. Submit PR

### New Features

1. Open an issue to discuss the feature
2. Get feedback from maintainers
3. Create a branch: `feature/description`
4. Implement the feature
5. Add tests
6. Update documentation
7. Submit PR

### Documentation

1. Create a branch: `docs/description`
2. Make changes
3. Ensure examples work
4. Submit PR

### Refactoring

1. Open an issue to discuss the refactoring
2. Create a branch: `refactor/description`
3. Make changes
4. Ensure all tests still pass
5. Submit PR

## Common Tasks

### Adding a New Package

See [DEVELOPMENT.md](DEVELOPMENT.md#adding-a-new-package) for detailed instructions.

### Updating Dependencies

```bash
# Update a specific package
bun add <package>@latest

# Update all dependencies
bun update
```

After updating, run tests to ensure nothing broke:

```bash
bun run test
bun run build
```

### Running Specific Tests

```bash
# Run tests for a specific package
cd packages/<package-name>
bun test

# Run a specific test file
bun test src/example.test.ts

# Run tests in watch mode
bun test --watch
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Features**: Open a GitHub Issue for discussion
- **Security**: Email security@example.com (do not open public issue)

## Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned in project documentation

Thank you for contributing to Scribe! 🎉
