# @scribe/web

Web application for Scribe.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Testing**: Vitest + Playwright

## Development

```bash
# Start dev server
bun run dev

# Build for production
bun run build

# Run tests
bun run test

# Run e2e tests
bun run test:e2e
```

## UI Components

This app uses [shadcn/ui](https://ui.shadcn.com/) for UI components built on Tailwind CSS and Radix UI primitives.

### Adding Components

```bash
# Add a single component
bunx shadcn@latest add button

# Add multiple components
bunx shadcn@latest add card input dialog

# List available components
bunx shadcn@latest add
```

### Component Location

- UI components: `src/components/ui/`
- Utility functions: `src/lib/utils.ts`

### Configuration

- `components.json` - shadcn configuration
- `postcss.config.js` - PostCSS with Tailwind
- `src/styles/global.css` - Global styles and CSS variables

### Styling Guidelines

- Use Tailwind utility classes for styling
- Use the `cn()` utility from `@/lib/utils` to merge class names
- CSS variables for theming are defined in `global.css`

```tsx
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function Example({ className }: { className?: string }) {
  return (
    <Button className={cn("custom-class", className)}>
      Click me
    </Button>
  );
}
```

## Project Structure

```
src/
├── components/
│   └── ui/          # shadcn components
├── lib/
│   └── utils.ts     # Utility functions
├── pages/           # Page components
├── providers/       # React context providers
├── styles/
│   └── global.css   # Global styles + Tailwind
└── main.tsx         # App entry point
```
