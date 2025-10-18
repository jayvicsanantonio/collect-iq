# Implement Comprehensive Security Headers

## Overview

This PR implements task 15.3 from the collectiq-frontend spec, adding comprehensive security headers to protect the application from common web vulnerabilities.

## Changes

### Security Headers Added

All security headers are now configured in `apps/web/next.config.mjs` and applied to all routes:

1. **Permissions-Policy** ✨ NEW
   - `camera=(self)` - Camera access restricted to same origin (required for card scanning)
   - `microphone=()` - Microphone disabled (not needed)
   - `geolocation=()` - Geolocation disabled (not needed)
   - `interest-cohort=()` - FLoC tracking disabled (privacy protection)

2. **Referrer-Policy** ✅ Already implemented
   - `strict-origin-when-cross-origin` - Controls referrer information

3. **X-Frame-Options** ✅ Already implemented
   - `DENY` - Prevents clickjacking attacks

4. **X-Content-Type-Options** ✅ Already implemented
   - `nosniff` - Prevents MIME-sniffing attacks

### Documentation

- Created `apps/web/SECURITY_HEADERS.md` with comprehensive documentation
- Documented all security headers with implementation status
- Added testing guidelines and troubleshooting tips
- Included compliance mapping to requirements

## Security Benefits

- **Privacy Protection**: Disables FLoC tracking and restricts unnecessary browser features
- **Attack Surface Reduction**: Only camera access is allowed (required for card scanning)
- **Compliance**: Meets requirement 12.3 from the collectiq-frontend spec
- **Defense in Depth**: Works alongside existing CSP implementation in middleware

## Testing

The configuration has been validated:

- ✅ Next.js config loads successfully
- ✅ All headers are properly formatted
- ✅ No syntax errors or linting issues

To verify headers in production:

1. Deploy the application
2. Open browser DevTools → Network tab
3. Check response headers for any request
4. Verify all security headers are present

## Requirements

Implements **Requirement 12.3** from `.kiro/specs/collectiq-frontend/requirements.md`:

- Security headers (Referrer-Policy, X-Frame-Options, X-Content-Type-Options, Permissions-Policy)

## Related Tasks

- Part of Epic 15: Security Hardening
- Task 15.3: Implement security headers ✅ Complete

## Checklist

- [x] Security headers added to `next.config.mjs`
- [x] Permissions-Policy configured with appropriate restrictions
- [x] Documentation created in `SECURITY_HEADERS.md`
- [x] Configuration validated and tested
- [x] Task marked as complete in tasks.md

## Notes

- Camera access is explicitly allowed (`camera=(self)`) as it's required for the `CameraCapture` component used in card scanning
- All other potentially sensitive features (microphone, geolocation) are disabled
- FLoC tracking is disabled for user privacy protection
- These headers complement the existing CSP implementation in `middleware.ts`
