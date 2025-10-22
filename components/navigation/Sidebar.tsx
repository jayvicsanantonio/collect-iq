'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Upload, Vault, LogOut, User, Sparkles, Menu, X, Sun, Moon } from 'lucide-react';
import { getSession, signOut } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';

/**
 * Left sidebar navigation component
 * Shows different navigation items based on authentication status
 * Responsive: Hidden on mobile with hamburger menu, always visible on desktop
 */
export function Sidebar() {
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    checkAuth();
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      // Default to dark mode
      document.documentElement.classList.add('dark');
    }
  }, []);

  async function checkAuth() {
    try {
      const currentSession = await getSession();
      setSession(currentSession);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
  }

  function toggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  }

  const isActive = (path: string) => pathname === path;

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Menu Button - Fixed at top left */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-[var(--card)] border border-[var(--border)] shadow-lg"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Slide in on mobile, always visible on desktop */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-50 bg-[var(--card)] border-r border-[var(--border)] transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
      {/* Logo */}
      <div className="p-6 border-b border-[var(--border)]">
        <Link href="/upload" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--color-vault-blue)] to-[var(--color-holo-cyan)]">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold font-display text-[var(--foreground)]">
            Collect
            <span className="ml-0.5 bg-gradient-to-r from-[var(--color-amber-pulse)] to-[#FFD700] bg-clip-text text-transparent">
              IQ
            </span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <Link
          href="/upload"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/upload')
              ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span>Upload Card</span>
        </Link>

        <Link
          href="/vault"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/vault')
              ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
              : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]'
          }`}
        >
          <Vault className="w-5 h-5" />
          <span>My Vault</span>
        </Link>
      </nav>

      {/* Theme Toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Moon className="w-5 h-5" />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-5 h-5" />
              <span>Light Mode</span>
            </>
          )}
        </button>
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-[var(--border)] space-y-2">
        {/* User Info - Show if session available */}
        {!isCheckingAuth && session && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--color-vault-blue)] to-[var(--color-holo-cyan)]">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-[var(--foreground)]">
                {session.email}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Authenticated
              </p>
            </div>
          </div>
        )}

        {/* Sign Out Button - Always show when not checking auth */}
        {!isCheckingAuth && (
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
          >
            <LogOut className="w-5 h-5" />
            <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        )}

        {/* Loading State */}
        {isCheckingAuth && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-5 h-5 animate-spin rounded-full border-2 border-[var(--muted)] border-t-[var(--foreground)]" />
            <span className="text-sm text-[var(--muted-foreground)]">
              Loading...
            </span>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
