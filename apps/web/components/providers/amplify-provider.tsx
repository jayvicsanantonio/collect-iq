'use client';

import { configureAmplify } from '@/lib/amplify-config';

// Configure Amplify immediately when this module loads (client-side only)
if (typeof window !== 'undefined') {
  configureAmplify();
}

/**
 * AmplifyProvider initializes AWS Amplify configuration on the client side.
 * This must be a client component because Amplify needs to run in the browser.
 */
export function AmplifyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
