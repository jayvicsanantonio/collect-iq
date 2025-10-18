'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { SignInButton } from '@/components/auth/SignInButton';
import { Camera, Upload, Sparkles, Shield, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { getSession } from '@/lib/auth';
// import type { UserSession } from '@/lib/auth';

export default function HomePage() {
  const { toast } = useToast();
  // const [session, setSession] = useState<UserSession | null>(null);
  const [isCheckingAuth] = useState(true);

  // useEffect(() => {
  //   checkAuth();
  // }, []);

  // async function checkAuth() {
  //   try {
  //     const currentSession = await getSession();
  //     setSession(currentSession);
  //   } catch (error) {
  //     console.error('Auth check failed:', error);
  //   } finally {
  //     setIsCheckingAuth(false);
  //   }
  // }

  const handleUpload = () => {
    toast({
      title: '📸 Upload Feature',
      description:
        'Upload functionality coming soon! This will let you scan your Pokémon cards.',
    });
  };

  const handleCamera = () => {
    toast({
      title: '📷 Camera Feature',
      description:
        'Camera capture coming soon! Take photos of your cards directly.',
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
      }}
    >
      {/* Gradient Background - Light Mode: SUPER VIBRANT Rainbow, Dark Mode: Dark Subtle */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light Mode - SUPER VIBRANT Bright Rainbow */}
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background:
              'linear-gradient(135deg, rgb(56, 189, 248) 0%, rgb(52, 211, 153) 25%, rgb(250, 204, 21) 50%, rgb(251, 146, 60) 75%, rgb(167, 139, 250) 100%)',
          }}
        />
        {/* Dark Mode - Very Dark Subtle */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              'linear-gradient(135deg, rgba(147, 197, 253, 0.08) 0%, rgba(167, 243, 208, 0.06) 25%, rgba(253, 224, 71, 0.05) 50%, rgba(251, 146, 60, 0.06) 75%, rgba(196, 181, 253, 0.08) 100%)',
          }}
        />
      </div>
      {/* Additional Radial Gradients for Depth */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Light Mode - VIBRANT Bright Radials */}
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background:
              'radial-gradient(circle at 30% 40%, rgba(14, 165, 233, 0.6) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(16, 185, 129, 0.55) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(249, 115, 22, 0.5) 0%, transparent 45%)',
          }}
        />
        {/* Dark Mode - Very Subtle Radials */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              'radial-gradient(circle at 30% 40%, rgba(59, 130, 246, 0.05) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(34, 197, 94, 0.04) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(251, 146, 60, 0.03) 0%, transparent 35%)',
          }}
        />
      </div>
      {/* Header */}
      <header
        className="w-full relative z-10 safe-area-top"
        style={{
          paddingTop: '24px',
          paddingBottom: '24px',
          paddingLeft: '16px',
          paddingRight: '16px',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div
            className="text-2xl font-medium tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
              marginTop: '8px',
              marginLeft: '4px',
            }}
          >
            Collect
            <span
              style={{
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              IQ
            </span>
          </div>
          <div
            className="flex items-center gap-4"
            style={{ marginTop: '8px', marginRight: '4px' }}
          >
            {!isCheckingAuth && (
              <SignInButton variant="link" size="sm" destination="/vault" />
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content - Centered */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 sm:py-24 relative z-10">
        <div className="max-w-4xl w-full text-center">
          {/* Title */}
          <div className="mb-8 sm:mb-12">
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight"
              style={{
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
              }}
            >
              SCAN YOUR COLLECTION
            </h1>
          </div>

          {/* Card Buttons - Pokémon Card Style */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 justify-center items-center mb-8 sm:mb-12">
            {/* Upload Card */}
            <button
              onClick={handleUpload}
              className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 w-full sm:w-64 touch-target"
              style={{
                maxWidth: '280px',
                height: '320px',
                background:
                  'linear-gradient(135deg, var(--color-vault-blue) 0%, var(--color-holo-cyan) 100%)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                padding: '2px',
              }}
            >
              {/* Card Border */}
              <div
                className="w-full h-full rounded-xl flex flex-col items-center justify-center p-6"
                style={{
                  backgroundColor: 'var(--card)',
                }}
              >
                {/* Icon */}
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--color-vault-blue), var(--color-holo-cyan))',
                  }}
                >
                  <Upload className="w-12 h-12 text-white" strokeWidth={2} />
                </div>

                {/* Title */}
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Upload Card
                </h3>

                {/* Description */}
                <p
                  className="text-sm text-center"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  Choose from your files
                </p>

                {/* Decorative Element */}
                <div className="mt-6 flex gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-vault-blue)' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-holo-cyan)' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-vault-blue)' }}
                  />
                </div>
              </div>

              {/* Holographic Effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
                }}
              />
            </button>

            {/* Use Camera Card */}
            <button
              onClick={handleCamera}
              className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 w-full sm:w-64 touch-target"
              style={{
                maxWidth: '280px',
                height: '320px',
                background:
                  'linear-gradient(135deg, var(--color-holo-cyan) 0%, var(--color-vault-blue) 100%)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                padding: '2px',
              }}
            >
              {/* Card Border */}
              <div
                className="w-full h-full rounded-xl flex flex-col items-center justify-center p-6"
                style={{
                  backgroundColor: 'var(--card)',
                }}
              >
                {/* Icon */}
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--color-holo-cyan), var(--color-vault-blue))',
                  }}
                >
                  <Camera className="w-12 h-12 text-white" strokeWidth={2} />
                </div>

                {/* Title */}
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Use Camera
                </h3>

                {/* Description */}
                <p
                  className="text-sm text-center"
                  style={{
                    color: 'var(--muted-foreground)',
                  }}
                >
                  Take a photo now
                </p>

                {/* Decorative Element */}
                <div className="mt-6 flex gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-holo-cyan)' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-vault-blue)' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-holo-cyan)' }}
                  />
                </div>
              </div>

              {/* Holographic Effect */}
              <div
                className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
                }}
              />
            </button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 pt-8 sm:pt-12">
            {/* AI Identification */}
            <div className="flex flex-col items-center space-y-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--accent)',
                }}
              >
                <Sparkles
                  className="w-6 h-6"
                  style={{ color: 'var(--color-holo-cyan)' }}
                  strokeWidth={1.5}
                />
              </div>
              <p
                className="text-sm font-medium"
                style={{
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '-0.01em',
                }}
              >
                AI Identification
              </p>
            </div>

            {/* Authenticity Check */}
            <div className="flex flex-col items-center space-y-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--accent)',
                }}
              >
                <Shield
                  className="w-6 h-6"
                  style={{ color: 'var(--color-emerald-glow)' }}
                  strokeWidth={1.5}
                />
              </div>
              <p
                className="text-sm font-medium"
                style={{
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '-0.01em',
                }}
              >
                Authenticity Check
              </p>
            </div>

            {/* Real-Time Valuation */}
            <div className="flex flex-col items-center space-y-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--accent)',
                }}
              >
                <TrendingUp
                  className="w-6 h-6"
                  style={{ color: 'var(--color-vault-blue)' }}
                  strokeWidth={1.5}
                />
              </div>
              <p
                className="text-sm font-medium"
                style={{
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '-0.01em',
                }}
              >
                Real-Time Valuation
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 sm:py-12 relative z-10 safe-area-bottom">
        <div className="w-full flex justify-center">
          <p
            className="text-xs tracking-wide text-center"
            style={{
              color: 'var(--muted-foreground)',
              letterSpacing: '0.05em',
            }}
          >
            POWERED BY AWS AI • COLLECTIQ 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
