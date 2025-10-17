import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar } from '@/components/navigation/Sidebar';

/**
 * Protected layout that wraps all authenticated routes
 * Ensures user is authenticated before rendering children
 * Includes responsive navigation (desktop sidebar + mobile header/bottom nav)
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen md:flex">
        <Sidebar />
        {/* Desktop: Flex grow to fill remaining space, Mobile: Full width with padding for header/bottom nav */}
        <main
          id="main-content"
          className="min-h-screen pt-16 md:pt-0 pb-20 md:pb-0 md:flex-1 w-full"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
