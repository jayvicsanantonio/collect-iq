# Security Headers Guide

This document explains how to use security headers in Lambda handlers to comply with security best practices and requirements.

## Overview

All API responses should include security headers to protect against common web vulnerabilities:

- **Strict-Transport-Security (HSTS)**: Forces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-XSS-Protection**: Enables browser XSS protection
- **Content-Security-Policy**: Controls resource loading

## Usage

### Standard JSON Response

```typescript
import { getJsonHeaders } from '../utils/response-headers.js';

export const handler = async (event) => {
  const data = { message: 'Success' };

  return {
    statusCode: 200,
    headers: getJsonHeaders(),
    body: JSON.stringify(data),
  };
};
```

### Error Response (RFC 7807)

```typescript
import { getProblemJsonHeaders } from '../utils/response-headers.js';

export const handler = async (event) => {
  const problem = {
    type: '/errors/not-found',
    title: 'Not Found',
    status: 404,
    detail: 'The requested resource was not found',
  };

  return {
    statusCode: 404,
    headers: getProblemJsonHeaders(),
    body: JSON.stringify(problem),
  };
};
```

### No-Cache Response

For sensitive data or health checks that should not be cached:

```typescript
import { getNoCacheHeaders } from '../utils/response-headers.js';

export const handler = async (event) => {
  const data = { status: 'healthy' };

  return {
    statusCode: 200,
    headers: getNoCacheHeaders(),
    body: JSON.stringify(data),
  };
};
```

### Custom Headers

Add custom headers while preserving security headers:

```typescript
import { getJsonHeaders } from '../utils/response-headers.js';

export const handler = async (event) => {
  const data = { message: 'Success' };

  return {
    statusCode: 200,
    headers: getJsonHeaders({
      'X-Request-Id': event.requestContext.requestId,
      'X-Custom-Header': 'custom-value',
    }),
    body: JSON.stringify(data),
  };
};
```

### Custom Content Type

For non-JSON responses:

```typescript
import { getSecurityHeaders } from '../utils/response-headers.js';

export const handler = async (event) => {
  const html = '<html><body>Hello</body></html>';

  return {
    statusCode: 200,
    headers: getSecurityHeaders('text/html'),
    body: html,
  };
};
```

## Security Headers Explained

### Strict-Transport-Security

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- Forces browsers to use HTTPS for 1 year (31536000 seconds)
- Applies to all subdomains
- Prevents protocol downgrade attacks

### X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

- Prevents browsers from MIME-sniffing responses
- Forces browsers to respect the declared Content-Type
- Mitigates certain XSS attacks

### X-Frame-Options

```
X-Frame-Options: DENY
```

- Prevents the page from being embedded in iframes
- Protects against clickjacking attacks
- Use `SAMEORIGIN` if you need to embed your own pages

### X-XSS-Protection

```
X-XSS-Protection: 1; mode=block
```

- Enables browser's built-in XSS filter
- Blocks page rendering if XSS is detected
- Legacy header but still useful for older browsers

### Content-Security-Policy

```
Content-Security-Policy: default-src 'self'
```

- Restricts resource loading to same origin
- Prevents inline scripts and styles
- Customize based on your application needs

## Best Practices

1. **Always use security headers**: Every response should include security headers
2. **Use helper functions**: Don't manually construct headers; use the provided utilities
3. **Test in development**: Verify headers are present using browser DevTools
4. **Monitor in production**: Use CloudWatch to track responses without security headers
5. **Update as needed**: Security best practices evolve; keep headers up to date

## Testing

Verify security headers are present:

```bash
# Test health check endpoint
curl -I https://api.collectiq.app/healthz

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: default-src 'self'
```

## Compliance

These headers help meet security requirements:

- **Requirement 12.3**: Configure CORS and security headers
- **OWASP Top 10**: Mitigates A05:2021 – Security Misconfiguration
- **PCI DSS**: Supports secure transmission requirements
- **SOC 2**: Demonstrates security controls

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [RFC 6797 - HSTS](https://tools.ietf.org/html/rfc6797)
