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
        <main className="flex-1 ml-64">{children}</main>
      </div>
    </AuthGuard>
  );
}
