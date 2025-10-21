import { AuthGuard } from '@/components/auth/AuthGuard';
import { Sidebar } from '@/components/navigation/Sidebar';

/**
 * Protected layout that wraps all authenticated routes
 * Ensures user is authenticated before rendering children
 * Includes navigation sidebar for authenticated users
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        {/* Responsive main content: no left margin on mobile, ml-64 on desktop */}
        <main className="flex-1 w-full md:ml-64">{children}</main>
      </div>
    </AuthGuard>
  );
}
