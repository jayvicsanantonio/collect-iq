'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Upload,
  Vault,
  LogIn,
  LogOut,
  User,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { getSession, signIn, signOut } from '@/lib/auth';
import type { UserSession } from '@/lib/auth';

/**
 * Left sidebar navigation component
 * Shows different navigation items based on authentication status
 * Responsive: Desktop sidebar, mobile bottom navigation
 */
export function Sidebar() {
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkAuth();
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

  async function handleSignIn() {
    await signIn(pathname === '/' ? '/vault' : pathname);
  }

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 md:h-screen md:sticky md:top-0 z-50 flex-shrink-0"
        style={{
          backgroundColor: 'var(--card)',
          borderRight: '1px solid var(--border)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div
          className="p-6"
          style={{
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(to bottom right, var(--color-vault-blue), var(--color-holo-cyan))',
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-xl font-semibold"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--foreground)',
              }}
            >
              Collect
              <span
                style={{
                  background:
                    'linear-gradient(to right, var(--color-amber-pulse), #FFD700)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                IQ
              </span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1" aria-label="Primary navigation">
          {/* Home */}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: isActive('/') ? 'var(--accent)' : 'transparent',
              color: isActive('/')
                ? 'var(--accent-foreground)'
                : 'var(--muted-foreground)',
            }}
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </Link>

          {/* Authenticated Navigation */}
          {session && (
            <>
              <Link
                href="/upload"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive('/upload')
                    ? 'var(--accent)'
                    : 'transparent',
                  color: isActive('/upload')
                    ? 'var(--accent-foreground)'
                    : 'var(--muted-foreground)',
                }}
              >
                <Upload className="w-5 h-5" />
                <span>Upload Card</span>
              </Link>

              <Link
                href="/vault"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive('/vault')
                    ? 'var(--accent)'
                    : 'transparent',
                  color: isActive('/vault')
                    ? 'var(--accent-foreground)'
                    : 'var(--muted-foreground)',
                }}
              >
                <Vault className="w-5 h-5" />
                <span>My Vault</span>
              </Link>
            </>
          )}
        </nav>

        {/* User Section */}
        <div
          className="p-4"
          style={{
            borderTop: '1px solid var(--border)',
          }}
        >
          {isCheckingAuth ? (
            <div className="flex items-center gap-3 px-3 py-2">
              <div
                className="w-5 h-5 animate-spin rounded-full border-2"
                style={{
                  borderColor: 'var(--muted)',
                  borderTopColor: 'var(--foreground)',
                }}
              />
              <span
                className="text-sm"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Loading...
              </span>
            </div>
          ) : session ? (
            <>
              {/* User Info */}
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(to bottom right, var(--color-vault-blue), var(--color-holo-cyan))',
                  }}
                >
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {session.email}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Authenticated
                  </p>
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                <LogOut className="w-5 h-5" />
                <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
              style={{
                backgroundColor: 'var(--color-vault-blue)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 safe-area-top"
        style={{
          backgroundColor: 'var(--card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(to bottom right, var(--color-vault-blue), var(--color-holo-cyan))',
              }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-xl font-semibold"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--foreground)',
              }}
            >
              Collect
              <span
                style={{
                  background:
                    'linear-gradient(to right, var(--color-amber-pulse), #FFD700)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                IQ
              </span>
            </span>
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="touch-target p-2 rounded-lg transition-colors"
            style={{
              color: 'var(--foreground)',
            }}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div
            id="mobile-menu"
            className="border-t"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
            role="navigation"
            aria-label="Mobile navigation"
          >
            <nav className="p-4 space-y-1">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors touch-target"
                style={{
                  backgroundColor: isActive('/')
                    ? 'var(--accent)'
                    : 'transparent',
                  color: isActive('/')
                    ? 'var(--accent-foreground)'
                    : 'var(--muted-foreground)',
                }}
              >
                <Home className="w-5 h-5" />
                <span>Home</span>
              </Link>

              {session && (
                <>
                  <Link
                    href="/upload"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors touch-target"
                    style={{
                      backgroundColor: isActive('/upload')
                        ? 'var(--accent)'
                        : 'transparent',
                      color: isActive('/upload')
                        ? 'var(--accent-foreground)'
                        : 'var(--muted-foreground)',
                    }}
                  >
                    <Upload className="w-5 h-5" />
                    <span>Upload Card</span>
                  </Link>

                  <Link
                    href="/vault"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors touch-target"
                    style={{
                      backgroundColor: isActive('/vault')
                        ? 'var(--accent)'
                        : 'transparent',
                      color: isActive('/vault')
                        ? 'var(--accent-foreground)'
                        : 'var(--muted-foreground)',
                    }}
                  >
                    <Vault className="w-5 h-5" />
                    <span>My Vault</span>
                  </Link>
                </>
              )}
            </nav>

            <div
              className="p-4 border-t"
              style={{
                borderColor: 'var(--border)',
              }}
            >
              {isCheckingAuth ? (
                <div className="flex items-center gap-3 px-3 py-3">
                  <div
                    className="w-5 h-5 animate-spin rounded-full border-2"
                    style={{
                      borderColor: 'var(--muted)',
                      borderTopColor: 'var(--foreground)',
                    }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Loading...
                  </span>
                </div>
              ) : session ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(to bottom right, var(--color-vault-blue), var(--color-holo-cyan))',
                      }}
                    >
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {session.email}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        Authenticated
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                    disabled={isSigningOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 touch-target"
                    style={{
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    handleSignIn();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-white transition-opacity touch-target"
                  style={{
                    backgroundColor: 'var(--color-vault-blue)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Navigation (Alternative) */}
      {session && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
          style={{
            backgroundColor: 'var(--card)',
            borderTop: '1px solid var(--border)',
          }}
          role="navigation"
          aria-label="Bottom navigation"
        >
          <div className="flex items-center justify-around p-2">
            <Link
              href="/"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-target"
              style={{
                color: isActive('/')
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)',
              }}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs">Home</span>
            </Link>

            <Link
              href="/upload"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-target"
              style={{
                color: isActive('/upload')
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)',
              }}
            >
              <Upload className="w-6 h-6" />
              <span className="text-xs">Upload</span>
            </Link>

            <Link
              href="/vault"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-target"
              style={{
                color: isActive('/vault')
                  ? 'var(--primary)'
                  : 'var(--muted-foreground)',
              }}
            >
              <Vault className="w-6 h-6" />
              <span className="text-xs">Vault</span>
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}
