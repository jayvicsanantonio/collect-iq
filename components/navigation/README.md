# Navigation Components

## Header

Reusable header component with CollectIQ logo and customizable right content.

### Usage

**Public Routes (with Sign In button):**

```tsx
import { Header } from '@/components/navigation/Header';
import { SignInButton } from '@/components/auth/SignInButton';

export default function PublicPage() {
  return (
    <div>
      <Header
        rightContent={<SignInButton variant="primary" size="default" />}
      />
      {/* Page content */}
    </div>
  );
}
```

**Protected Routes (with user menu):**

```tsx
import { Header } from '@/components/navigation/Header';
import { SignOutButton } from '@/components/auth/SignOutButton';

export default function ProtectedPage() {
  return (
    <div>
      <Header
        rightContent={
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--muted-foreground)]">
              user@example.com
            </span>
            <SignOutButton variant="outline" size="sm" />
          </div>
        }
      />
      {/* Page content */}
    </div>
  );
}
```

**Custom Right Content:**

```tsx
import { Header } from '@/components/navigation/Header';
import { Button } from '@/components/ui/button';

export default function CustomPage() {
  return (
    <div>
      <Header
        rightContent={
          <>
            <Button variant="ghost">About</Button>
            <Button variant="ghost">Contact</Button>
            <Button variant="primary">Get Started</Button>
          </>
        }
      />
      {/* Page content */}
    </div>
  );
}
```

### Props

| Prop           | Type              | Default     | Description                                                     |
| -------------- | ----------------- | ----------- | --------------------------------------------------------------- |
| `rightContent` | `React.ReactNode` | `undefined` | Content to display on the right side (e.g., buttons, user menu) |
| `className`    | `string`          | `''`        | Additional CSS classes for styling                              |

### Features

- ✅ Responsive logo with gradient accent
- ✅ Theme toggle automatically included
- ✅ Customizable right content area
- ✅ Consistent styling across routes
- ✅ Accessible navigation

## Sidebar

Fixed left sidebar navigation for authenticated users.

### Usage

The Sidebar is automatically included in the protected layout:

```tsx
// app/(protected)/layout.tsx
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar } from '@/components/navigation/Sidebar';

export default function ProtectedLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64">{children}</main>
      </div>
    </AuthGuard>
  );
}
```

### Features

- ✅ Fixed position on the left (256px width)
- ✅ CollectIQ logo at the top
- ✅ Navigation links (Upload, Vault)
- ✅ User info and sign out button at the bottom
- ✅ Active state highlighting
- ✅ Smooth hover effects

### Navigation Items

- **Upload Card** - `/upload`
- **My Vault** - `/vault`

### User Section

- Shows user email with avatar
- Sign out button
- Loading state while checking authentication

## Layout Patterns

### Public Layout (with Header)

```tsx
// app/(public)/my-page/page.tsx
import { Header } from '@/components/navigation/Header';
import { SignInButton } from '@/components/auth/SignInButton';

export default function MyPublicPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header rightContent={<SignInButton variant="primary" />} />
      <main className="flex-1">{/* Page content */}</main>
      <footer>{/* Footer content */}</footer>
    </div>
  );
}
```

### Protected Layout (with Sidebar)

```tsx
// app/(protected)/my-page/page.tsx
// Sidebar is automatically included via layout.tsx

export default function MyProtectedPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1>My Protected Page</h1>
      {/* Page content */}
    </div>
  );
}
```

## Styling

Both components use CSS custom properties for theming:

- `--font-display` - Display font for logo and headings
- `--background` - Background color
- `--foreground` - Text color
- `--card` - Card background
- `--border` - Border color
- `--accent` - Accent background
- `--muted-foreground` - Secondary text
- `--color-vault-blue` - Primary brand color
- `--color-holo-cyan` - Secondary brand color

## Accessibility

- ✅ Semantic HTML (`<header>`, `<nav>`, `<aside>`)
- ✅ Keyboard navigation support
- ✅ Clear visual feedback for active states
- ✅ Sufficient color contrast
- ✅ Icon + text labels for clarity
