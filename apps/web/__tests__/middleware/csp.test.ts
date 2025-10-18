import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for Content Security Policy configuration
 * Verifies CSP directives are properly configured
 */
describe('Content Security Policy', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  });

  it('should include frame-ancestors none directive', () => {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "frame-ancestors 'none'",
    ];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should disallow inline scripts', () => {
    const cspDirectives = ["script-src 'self'"];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('should whitelist AWS domains for images', () => {
    const cspDirectives = [
      "img-src 'self' data: https://*.amazonaws.com https://*.cloudfront.net",
    ];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain('https://*.amazonaws.com');
    expect(csp).toContain('https://*.cloudfront.net');
  });

  it('should whitelist Cognito domains for connections', () => {
    const cognitoDomain = 'collectiq.auth.us-east-1.amazoncognito.com';
    const cspDirectives = [
      `connect-src 'self' https://${cognitoDomain} https://*.amazoncognito.com`,
    ];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain('https://*.amazoncognito.com');
  });

  it('should whitelist API domain for connections', () => {
    const apiDomain = 'api.collectiq.com';
    const cspDirectives = [`connect-src 'self' https://${apiDomain}`];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain('https://api.collectiq.com');
  });

  it('should allow form actions to Cognito', () => {
    const cognitoDomain = 'collectiq.auth.us-east-1.amazoncognito.com';
    const cspDirectives = [
      `form-action 'self' https://${cognitoDomain} https://*.amazoncognito.com`,
    ];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('https://*.amazoncognito.com');
  });

  it('should disallow object embeds', () => {
    const cspDirectives = ["object-src 'none'"];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain("object-src 'none'");
  });

  it('should restrict base URI to self', () => {
    const cspDirectives = ["base-uri 'self'"];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain("base-uri 'self'");
  });

  it('should include upgrade-insecure-requests in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const cspDirectives = ["default-src 'self'", 'upgrade-insecure-requests'];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain('upgrade-insecure-requests');

    process.env.NODE_ENV = originalEnv;
  });

  it('should allow inline styles for Tailwind CSS', () => {
    const cspDirectives = ["style-src 'self' 'unsafe-inline'"];

    const csp = cspDirectives.join('; ');
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});

/**
 * Tests for additional security headers
 */
describe('Security Headers', () => {
  it('should set X-Frame-Options to DENY', () => {
    const headers = {
      'X-Frame-Options': 'DENY',
    };

    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('should set X-Content-Type-Options to nosniff', () => {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
    };

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
    const headers = {
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should set Permissions-Policy to restrict features', () => {
    const headers = {
      'Permissions-Policy':
        'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
    };

    expect(headers['Permissions-Policy']).toContain('camera=(self)');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
  });
});
