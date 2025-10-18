'use client';

import { useEffect, useRef } from 'react';
import { configureAmplify } from '@/lib/amplify-config';

/**
 * AmplifyProvider initializes AWS Amplify configuration on the client side.
 * This must be a client component because Amplify needs to run in the browser.
 */
export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = useRef(false);

  useEffect(() => {
    // Only configure once
    if (!isConfigured.current) {
      configureAmplify();
      isConfigured.current = true;
    }
  }, []);

  return <>{children}</>;
}
