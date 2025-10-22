---
title: CollectIQ — Complete Wireframes & UX Flows
---

This document describes the complete UX flow and screen architecture for the CollectIQ web application. It follows an authentication-first design with real-time pricing, authenticity verification, and vault management.

# 1. Overview

CollectIQ provides collectors with a seamless way to scan, identify, valuate, and store their trading cards securely. The UX is designed to feel immediate and intelligent — fast uploads, clear visuals, and meaningful feedback.

# 2. Design Language & Foundation

• Design System: Vault Blue (#1A73E8), Holo Cyan (#00C6FF), Carbon Gray (#1E1E1E)  
• Typography: Inter (UI), Space Grotesk (Headings)  
• Layout Grid: 8px system, max content width 1200px  
• Rounded corners: 12–16px  
• Motion: 200–250ms ease-in-out  
• Accessibility: WCAG 2.2 AA, visible focus, keyboard-first  
• Visual theme: Minimalistic tech aesthetic with gradient energy

# 3. High-Level UX Flow

1\. Launch app → Auth Gateway (Cognito)  
2. Sign in / Sign up / Verify Email  
3. First-run screen: 'Let’s scan your first card'  
4. Upload or use camera → Preview → Analyze (Identify + Authenticity + Valuation)  
5. Confirmation screen → Save to Vault  
6. Vault view → Filter, sort, and view card details  
7. Card detail screen → Historical valuation chart, authenticity breakdown  
8. Session management: sign out or session-expired re-auth

# 4. Authentication Screens

\*\*4.1 Sign In / Sign Up\*\*

Two-column layout (desktop): left promo pane, right auth form.  
• Fields: Email, Password  
• Actions: Sign In, Create Account, Forgot Password  
• Link: Terms and Privacy  
• Mobile: Single column, sticky CTA button at bottom

\*\*4.2 Email Verification\*\*

Card-centered modal: 'Check your inbox to verify your email address.'  
• Resend email button  
• Return to Sign In link  
• Illustration: envelope or confirmation mark

\*\*4.3 Password Reset\*\*

Minimalist card form.  
• Input: Email  
• Actions: Send Reset Link, Back to Login

\*\*4.4 Session Expired Modal\*\*

Overlay modal with text: 'Your session expired. Please re-authenticate to continue.'  
• Primary button: Re-authenticate  
• Secondary: Sign Out

# 5. Upload Flow Screens

\*\*5.1 First Run (Empty Vault)\*\*

Hero layout with CTA buttons.  
• Headline: 'Let’s scan your first card'  
• CTAs: Use Camera, Upload from Files  
• Illustration: camera lens + trading card outline

\*\*5.2 UploadDropzone\*\*

Drag & drop area with dashed border.  
• State: Idle (hint text), Hover (highlighted), Uploading (progress bar)  
• Accepts JPG, PNG, HEIC up to 12MB  
• Mobile: tap to open camera or file picker  
• Feedback: Invalid file type/size errors inline

\*\*5.3 Upload Progress\*\*

Progress bar and thumbnail preview.  
• Text: 'Uploading... 45%'  
• Cancel button  
• Auto-redirect to Identify screen upon success

# 6. Identification & Valuation

\*\*6.1 Identify Results\*\*

Card list with confidence scores.  
• Top 3 candidates: name, set, rarity, confidence bar  
• User taps the correct one to proceed

\*\*6.2 Authenticity Analysis\*\*

Split view layout (image + metrics).  
• AuthenticityBadge: rounded pill (score 0–1)  
• Visual fingerprint, text validation, holographic signal graphs  
• Tooltip with breakdown (e.g. 'text match 0.92, border ratio 0.88')

\*\*6.3 Valuation Summary\*\*

Panel showing live market valuation.  
• Range: Low, Median, High  
• Trend: Arrow Up/Down, % Change  
• Sources: eBay, TCGPlayer, PriceCharting logos  
• Confidence bar, comps count, 14-day window  
• CTA: Save to Vault

# 7. Vault & Portfolio

\*\*7.1 Vault Grid\*\*

Grid of card thumbnails with values.  
• Sort: value, date added, rarity  
• Filter: set, type, authenticity  
• Quick actions: refresh valuation, delete

\*\*7.2 Portfolio Summary\*\*

Top summary card showing portfolio total and change.  
• Line chart or sparkline of 14-day performance  
• Stats: total cards, total value, average confidence

\*\*7.3 Empty Vault State\*\*

Center card with text: 'No cards yet. Start by uploading your first one.'  
• CTA: Upload Card

# 8. Card Detail View

Dedicated page for a specific card.  
• Large card image (zoomable)  
• Authenticity score  
• Valuation chart (Recharts)  
• Market data sources table  
• Actions: Re-evaluate, Delete, Share

# 9. Error & Edge Cases

• 401 Unauthorized → Redirect to /auth  
• 403 Forbidden → 'You don’t have access to this card'  
• 404 Not Found → 'This card was removed or doesn’t exist'  
• 413 Image Too Large → Inline error toast  
• 429 Rate Limit → Cooldown dialog with countdown  
• 500 Server Error → Retry + Contact Support link

# 10. Mobile Variants

The mobile layout emphasizes vertical stacking, persistent CTAs, and adaptive motion. Use bottom sheets for filters, modals for details, and native camera integration for scanning. Ensure responsive typography and safe-area padding for iOS and Android devices.

# 11. UX Flow Diagram (Text Description)

Auth → Upload → Identify → Authenticity → Valuation → Vault → Card Detail  
Branches:  
• If auth fails → redirect /auth  
• If upload fails → retry  
• If identify low confidence → manual confirm  
• If valuation unavailable → show last cached  
• Save → vault refresh → confirmation toast

# 12. UX Principles

• Keep actions clear and progressive: one step leads naturally to the next.  
• Provide continuous feedback: toasts, progress, microcopy.  
• Focus attention through motion and hierarchy, not clutter.  
• Minimize friction for repeat uploads (drag-drop anywhere).  
• Maintain delight through subtle gradient motion and holographic visuals.

# 13. Definition of Done (UX)

• All screens functional in desktop and mobile.  
• Accessibility and focus order validated.  
• Transitions smooth (≤ 250ms).  
• Error states clear with remediation.  
• Vault empty/filled states handled.  
• Auth session and redirects consistent.
