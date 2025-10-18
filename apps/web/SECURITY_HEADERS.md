# Security Headers Configuration

This document describes the security headers implemented in the CollectIQ frontend application.

## Content Security Policy (CSP)

The application implements a strict Content Security Policy to prevent XSS attacks and unauthorized resource loading.

### Implementation

CSP headers are applied in two places:

1. **Middleware** (`middleware.ts`): Dynamic CSP headers applied to all responses
2. **Next.js Config** (`next.config.mjs`): Static security headers for all routes

### CSP Directives

| Directive                   | Value                                                                      | Purpose                                                         |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `default-src`               | `'self'`                                                                   | Only allow resources from same origin by default                |
| `script-src`                | `'self'`                                                                   | **No inline scripts** - only scripts from same origin           |
| `style-src`                 | `'self' 'unsafe-inline'`                                                   | Allow same origin and inline styles (required for Tailwind CSS) |
| `img-src`                   | `'self' data: https://*.amazonaws.com https://*.cloudfront.net`            | Allow images from same origin, data URIs, and AWS domains       |
| `font-src`                  | `'self'`                                                                   | Only fonts from same origin                                     |
| `connect-src`               | `'self' https://{API} https://*.amazoncognito.com https://*.amazonaws.com` | Allow API calls to backend, Cognito, and AWS services           |
| `media-src`                 | `'self'`                                                                   | Only media from same origin                                     |
| `object-src`                | `'none'`                                                                   | Disallow all plugins (Flash, Java, etc.)                        |
| `frame-ancestors`           | `'none'`                                                                   | **Prevent clickjacking** - disallow embedding in iframes        |
| `form-action`               | `'self' https://*.amazoncognito.com`                                       | Allow form submissions to same origin and Cognito (OAuth)       |
| `base-uri`                  | `'self'`                                                                   | Restrict base tag to same origin                                |
| `upgrade-insecure-requests` | (production only)                                                          | Automatically upgrade HTTP to HTTPS                             |

### Whitelisted Domains

The CSP automatically whitelists the following trusted domains based on environment variables:

- **API Domain**: Extracted from `NEXT_PUBLIC_API_BASE`
- **Cognito Domain**: From `NEXT_PUBLIC_COGNITO_DOMAIN`
- **AWS Services**: `*.amazonaws.com` (for S3, CloudFront)
- **CloudFront**: `*.cloudfront.net` (for CDN assets)

### No Inline Scripts

The CSP explicitly disallows inline scripts (`script-src 'self'` without `'unsafe-inline'`). This means:

- ❌ No `<script>` tags with inline code
- ❌ No `onclick` or other inline event handlers
- ❌ No `javascript:` URLs
- ✅ All JavaScript must be in external `.js` files

This is a critical security measure that prevents XSS attacks.

## Additional Security Headers

All security headers are configured in `next.config.mjs` and applied to all routes via the `headers()` function.

### X-Frame-Options

```
X-Frame-Options: DENY
```

**Status**: ✅ Implemented in `next.config.mjs`

Prevents the application from being embedded in iframes, protecting against clickjacking attacks.

### X-Content-Type-Options

```
X-Content-Type-Options: nosniff
```

**Status**: ✅ Implemented in `next.config.mjs`

Prevents browsers from MIME-sniffing responses, reducing the risk of drive-by downloads.

### Referrer-Policy

```
Referrer-Policy: strict-origin-when-cross-origin
```

**Status**: ✅ Implemented in `next.config.mjs`

Controls how much referrer information is sent with requests:

- Same origin: full URL
- Cross-origin HTTPS: only origin
- Cross-origin HTTP: no referrer

### Permissions-Policy

```
Permissions-Policy: camera=(self), microphone=(), geolocation=(), interest-cohort=()
```

**Status**: ✅ Implemented in `next.config.mjs`

Restricts access to browser features:

- **Camera**: Only allowed on same origin (required for card scanning via `CameraCapture` component)
- **Microphone**: Disabled (not needed for the application)
- **Geolocation**: Disabled (not needed for the application)
- **FLoC (interest-cohort)**: Disabled (privacy protection against Google's tracking)

### Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Forces HTTPS connections for 2 years, including all subdomains. The `preload` directive allows inclusion in browser HSTS preload lists.

## Testing CSP

### Browser DevTools

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for CSP violation warnings (red text)
4. Check Network tab → Headers to verify CSP header is present

### CSP Evaluator

Use Google's CSP Evaluator to check for common issues:
https://csp-evaluator.withgoogle.com/

### Common CSP Violations

If you see CSP violations in the console:

1. **Inline script blocked**: Move script to external file
2. **Inline style blocked**: Use CSS modules or Tailwind classes
3. **External resource blocked**: Add domain to appropriate CSP directive
4. **eval() blocked**: Refactor code to avoid eval/Function constructor

## Environment-Specific Configuration

### Development

- CSP is enforced but `upgrade-insecure-requests` is disabled
- Allows `http://localhost:3000` for local development

### Production

- Full CSP enforcement with `upgrade-insecure-requests`
- All connections must use HTTPS
- HSTS header forces HTTPS for 2 years

## Compliance

This CSP configuration helps meet the following security requirements:

- **Requirement 12.2**: Strict CSP with no inline scripts
- **Requirement 12.3**: Security headers (X-Frame-Options, Referrer-Policy, etc.)
- **Requirement 12.4**: Prevent clickjacking with frame-ancestors
- **OWASP Top 10**: Protection against XSS, clickjacking, and injection attacks

## Troubleshooting

### Issue: Third-party script blocked

**Solution**: Add the domain to `script-src` directive in middleware.ts

### Issue: API calls failing

**Solution**: Verify `NEXT_PUBLIC_API_BASE` is set correctly and domain is in `connect-src`

### Issue: OAuth redirect blocked

**Solution**: Ensure Cognito domain is in `form-action` and `connect-src`

### Issue: Images not loading

**Solution**: Add image domain to `img-src` directive

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [RFC 7807: Problem Details](https://tools.ietf.org/html/rfc7807)
