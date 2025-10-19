# CollectIQ Design System

This document provides an overview of the design system implementation for CollectIQ.

## Design Tokens

All design tokens are defined in `app/globals.css` using Tailwind CSS v4's `@theme` directive.

### Color Tokens

- **Primary Colors**
  - `--color-vault-blue`: #1A73E8 (primary actions)
  - `--color-holo-cyan`: #00C6FF (secondary accent)

- **Surface Colors**
  - `--color-carbon-gray`: #1E1E1E (dark mode background)
  - `--color-cloud-silver`: #F5F7FA (light mode background)
  - `--color-graphite-gray`: #2E2E2E (dark mode cards)

- **Semantic Colors**
  - `--color-emerald-glow`: #00E676 (success)
  - `--color-amber-pulse`: #FFC400 (warning)
  - `--color-crimson-red`: #D32F2F (error)

### Typography

- **Sans**: Inter (UI elements)
- **Display**: Space Grotesk (headings)
- **Mono**: JetBrains Mono (code/data)

### Spacing System (8px grid)

- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 16px
- `--spacing-lg`: 24px
- `--spacing-xl`: 32px
- `--spacing-2xl`: 48px

### Border Radius

- `--radius-sm`: 8px (buttons, inputs)
- `--radius-md`: 12px (cards)
- `--radius-lg`: 16px (modals)
- `--radius-pill`: 9999px (badges)

### Transitions

- `--transition-fast`: 150ms (hover states)
- `--transition-base`: 200ms (standard transitions)
- `--transition-slow`: 300ms (complex animations)

## UI Components

All components are built using shadcn/ui and Radix UI primitives, located in `components/ui/`.

### Button

Variants: `primary`, `secondary`, `gradient`, `outline`, `ghost`, `destructive`, `link`

```tsx
import { Button } from '@/components/ui/button';

<Button variant="primary">Click me</Button>
<Button variant="gradient">Gradient Button</Button>
```

### Card

Sub-components: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>;
```

### Dialog

Modal component with overlay and close button.

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
  </DialogContent>
</Dialog>;
```

### Toast

Notification system with provider and hook.

```tsx
import { useToast } from '@/hooks/use-toast';

const { toast } = useToast();

toast({
  title: 'Success',
  description: 'Your action was completed.',
});
```

### Input

Text input with validation states.

```tsx
import { Input } from '@/components/ui/input';

<Input placeholder="Enter text" error={hasError} />;
```

### Select

Dropdown select component.

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>;
```

### Tooltip

Hover tooltip component.

```tsx
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover me</TooltipTrigger>
    <TooltipContent>Tooltip content</TooltipContent>
  </Tooltip>
</TooltipProvider>;
```

## Theme System

### ThemeProvider

Wraps the application and provides theme context. Located in `components/theme-provider.tsx`.

```tsx
import { ThemeProvider } from '@/components/theme-provider';

<ThemeProvider defaultTheme="system" storageKey="collectiq-theme">
  {children}
</ThemeProvider>;
```

### ThemeToggle

Component for switching between light, dark, and system themes. Located in `components/theme-toggle.tsx`.

```tsx
import { ThemeToggle } from '@/components/theme-toggle';

<ThemeToggle />;
```

### Using Theme in Components

```tsx
import { useTheme } from '@/components/theme-provider';

const { theme, setTheme } = useTheme();
```

## Accessibility Features

- **Focus Indicators**: 2px solid Holo Cyan ring on all interactive elements
- **Keyboard Navigation**: All components are keyboard accessible
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Reduced Motion**: Respects `prefers-reduced-motion` media query
- **Color Contrast**: All color combinations meet WCAG AA standards (4.5:1)

## Dark Mode

The application supports three theme modes:

1. **Light**: Light background with dark text
2. **Dark**: Dark background with light text
3. **System**: Automatically matches the user's system preference

Theme preference is persisted in localStorage and applied without page reload.

## CSS Variables

All theme-specific colors are defined as CSS variables that automatically switch based on the active theme:

- `--background`: Page background color
- `--foreground`: Primary text color
- `--card`: Card background color
- `--card-foreground`: Card text color
- `--primary`: Primary action color
- `--primary-foreground`: Primary action text color
- `--secondary`: Secondary action color
- `--secondary-foreground`: Secondary action text color
- `--muted`: Muted background color
- `--muted-foreground`: Muted text color
- `--accent`: Accent color
- `--accent-foreground`: Accent text color
- `--destructive`: Error/destructive action color
- `--destructive-foreground`: Error/destructive text color
- `--border`: Border color
- `--input`: Input border color
- `--ring`: Focus ring color

## Testing the Design System

To test the design system, run the development server:

```bash
pnpm web:dev
```

Visit `http://localhost:3000` to see the design system in action with the theme toggle in the top-right corner.
