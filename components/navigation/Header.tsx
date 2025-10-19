'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useEffect, useState } from 'react';

interface HeaderProps {
  /**
   * Content to display on the right side of the header
   * (e.g., sign in button, user menu, etc.)
   */
  rightContent?: React.ReactNode;
  /**
   * Optional className for additional styling
   */
  className?: string;
}

/**
 * Floating header with Apple's liquid glass aesthetic
 * Used across both public and protected routes
 */
export function Header({ rightContent, className = '' }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center ${className}`}
      style={{ padding: '16px' }}
    >
      <nav
        className="w-full rounded-2xl"
        style={{
          maxWidth: '1280px',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
          background: isDark
            ? 'rgba(0, 0, 0, 0.75)'
            : 'rgba(255, 255, 255, 0.9)',
          border: isDark
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: isDark
            ? '0 4px 24px rgba(0, 0, 0, 0.6), 0 1px 3px rgba(0, 0, 0, 0.4)'
            : '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.3s ease',
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ padding: '0 24px', height: '64px' }}
        >
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center text-xl font-semibold tracking-tight transition-all duration-200 hover:scale-[1.02]"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              color: isDark ? '#f5f7fa' : '#1e1e1e',
            }}
          >
            <span>Collect</span>
            <span
              className="relative ml-0.5"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              IQ
            </span>
          </Link>

          {/* Right Content */}
          <div className="flex items-center" style={{ gap: '12px' }}>
            {rightContent}
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
