---
title: CollectIQ — UI Copy Reference
version: 1.0
status: Active
last_updated: 2025-10-17
---

# UI Copy Reference

This document defines all user-facing text in the CollectIQ application. Copy follows these principles:

- **Clear**: Plain language, no jargon
- **Concise**: One sentence per message when possible
- **Non-blaming**: Never "You..." or "Your..."
- **Actionable**: Always suggest next step
- **Warm**: Friendly but professional tone

---

## Upload Flow

### Dropzone

#### Default State

```
Primary: Drag & drop or click to upload
Secondary: JPG, PNG, or HEIC • Up to 12 MB
Hint: Best results: 2000–4000 px
```

#### Drag-Over (Valid)

```
Drop to upload
```

#### Drag-Over (Invalid - Size)

```
File is too large ([size] MB)
```

#### Drag-Over (Invalid - Format)

```
Format not supported
```

#### Empty State (After Error)

```
Primary: Try another file
Secondary: JPG, PNG, or HEIC • Up to 12 MB
```

---

### Validation Errors

#### File Too Large

```
Error: File is too large. Max is 12 MB.
Action: Try another file
```

#### Unsupported Format

```
Error: That format isn't supported. Use JPG, PNG, or HEIC.
Action: Try another file
```

#### File Type Unknown

```
Error: File type could not be determined. Use JPG, PNG, or HEIC.
Action: Try another file
```

#### Low Resolution (Warning Toast)

```
Title: Low-resolution image
Description: Results may be less accurate.
```

---

### Mobile Compression

#### Dialog Title

```
Compress Image?
```

#### Dialog Body

```
This file is [size] MB. Compress to upload faster?

Original: [original size] MB → ~[target size] MB
```

#### Dialog Actions

```
Cancel
Compress & Upload (primary)
```

#### Compressing Progress

```
Compressing image...
```

---

### Upload Progress

#### Uploading

```
Uploading [filename]... [progress]%
```

#### Upload Complete

```
Upload complete. Analyzing card...
```

#### Upload Failed

```
Upload failed. Check your connection and try again.
Action: Retry
```

---

### Server Errors

#### 413 Payload Too Large

```
Error: File is too large. Max is 12 MB.
Action: Try again
```

#### 415 Unsupported Media Type

```
Error: Unsupported format. Use JPG, PNG, or HEIC.
Action: Try again
```

#### Presign Policy Rejection

```
Error: Upload was denied by the server policy. Try a smaller file or supported format.
Action: Try again
```

#### Network Error

```
Error: Upload failed. Check your connection and try again.
Action: Retry
```

#### Generic Server Error

```
Error: Something went wrong. Please try again.
Action: Retry
```

---

## Camera Capture

### Permission Request

```
Title: Camera Access Required
Body: CollectIQ needs camera access to capture card images.
Actions: Allow | Not Now
```

### Permission Denied

```
Error: Camera access denied. Enable camera permissions in your device settings to use this feature.
Action: Open Settings | Use File Picker
```

### Camera Not Available

```
Error: Camera not available on this device.
Action: Use File Picker
```

### Capture Button

```
Capture Photo
```

### Switch Camera

```
Switch Camera
```

---

## Card Identification

### Loading State

```
Analyzing card...
```

### No Matches Found

```
Title: No matches found
Body: We couldn't identify this card. Try a clearer photo with better lighting.
Action: Try Again
```

### Multiple Candidates

```
Title: Which card is this?
Body: Select the card that matches your image.
```

### Candidate Card

```
[Card Name]
[Set Name] • [Card Number]
```

---

## Authenticity

### Authenticity Badge

#### High Confidence (≥ 0.8)

```
Likely Authentic
```

#### Medium Confidence (0.5–0.79)

```
Authenticity Uncertain
```

#### Low Confidence (< 0.5)

```
Possible Counterfeit
```

### Authenticity Tooltip

```
Authenticity Score: [score]/1.0

This score is based on:
• Holographic pattern analysis
• Print quality assessment
• Edge wear consistency
• Font and color accuracy

[Learn More]
```

### Authenticity Warning

```
⚠️ This card may be counterfeit. Review the authenticity details before purchasing or trading.
```

---

## Valuation

### Valuation Panel

#### Title

```
Current Market Value
```

#### Price Range

```
Low: $[low]
Median: $[median]
High: $[high]
```

#### Metadata

```
Based on [compsCount] sales in the last [windowDays] days
Confidence: [confidence]%
```

#### No Data

```
Title: Valuation Unavailable
Body: Not enough recent sales data to estimate value.
Action: Check Back Later
```

#### Low Confidence Warning

```
⚠️ Limited data available. Value estimate may be less accurate.
```

---

### Valuation History

#### Chart Title

```
Price History
```

#### Chart Empty State

```
No historical data available yet. Check back after your first valuation refresh.
```

#### Last Updated

```
Updated [relative time]
```

#### Refresh Button

```
Refresh Valuation
```

#### Refreshing

```
Updating valuation...
```

---

## Vault

### Empty State

```
Title: Your vault is empty
Body: Upload your first card to start building your collection.
Action: Upload Card
```

### Portfolio Summary

```
Total Value: $[total]
[count] Cards
```

### Filters

#### Set Filter

```
All Sets
[Set Name] ([count])
```

#### Rarity Filter

```
All Rarities
Common ([count])
Uncommon ([count])
Rare ([count])
Holo Rare ([count])
Ultra Rare ([count])
```

#### Sort Options

```
Sort by: Newest First
Sort by: Oldest First
Sort by: Highest Value
Sort by: Lowest Value
Sort by: Name (A-Z)
Sort by: Name (Z-A)
```

### Card Actions

#### View Details

```
View Details
```

#### Delete Card

```
Delete
```

#### Refresh Valuation

```
Refresh Value
```

---

### Delete Confirmation

```
Title: Delete Card?
Body: This will permanently remove [card name] from your vault. This action cannot be undone.
Actions: Cancel | Delete
```

---

## Card Detail

### Tabs

```
Overview
Valuation
Authenticity
History
```

### Overview Tab

```
Card Name: [name]
Set: [set name]
Card Number: [number]
Rarity: [rarity]
Added: [date]
```

### Actions

```
Refresh Valuation
Delete Card
Share (future)
```

---

## Authentication

### Sign In

```
Title: Welcome to CollectIQ
Body: Sign in to access your card vault and AI-powered valuations.
Action: Sign In with Amazon Cognito
```

### Sign Out

```
Action: Sign Out
```

### Session Expired

```
Title: Session Expired
Body: Your session has expired. Sign in again to continue.
Action: Sign In
```

### Account Menu

```
[User Email]
My Vault
Settings (future)
Sign Out
```

---

## Navigation

### Main Nav

```
Upload
Vault
```

### Mobile Nav

```
Upload
Vault
Account
```

---

## Error States

### Generic Error

```
Title: Something went wrong
Body: An unexpected error occurred. Please try again.
Action: Retry
```

### Network Error

```
Title: Connection Lost
Body: Check your internet connection and try again.
Action: Retry
```

### Not Found (404)

```
Title: Page Not Found
Body: The page you're looking for doesn't exist.
Action: Go to Vault
```

### Unauthorized (401)

```
Title: Sign In Required
Body: You need to sign in to access this page.
Action: Sign In
```

### Forbidden (403)

```
Title: Access Denied
Body: You don't have permission to view this card.
Action: Go to Vault
```

### Rate Limited (429)

```
Title: Too Many Requests
Body: You're uploading too quickly. Please wait a moment and try again.
Action: Try Again
```

### Server Error (500)

```
Title: Server Error
Body: Our servers are having trouble. Please try again in a few moments.
Action: Retry
```

---

## Loading States

### Page Loading

```
Loading...
```

### Card Loading (Skeleton)

```
[Skeleton card with shimmer animation]
```

### Button Loading

```
[Spinner icon] [Action text]...
```

---

## Toast Notifications

### Success

```
Card saved to vault
Valuation refreshed
Card deleted
```

### Warning

```
Low-resolution image; results may be less accurate.
Limited data available. Value estimate may be less accurate.
```

### Error

```
Upload failed. Try again.
Failed to refresh valuation. Try again.
Failed to delete card. Try again.
```

### Info

```
Analyzing card...
Updating valuation...
```

---

## Accessibility

### Skip Links

```
Skip to main content
Skip to navigation
```

### Screen Reader Only Text

#### Upload Dropzone

```
Upload card image. Accepts JPG, PNG, or HEIC up to 12 megabytes. Best results with images between 2000 and 4000 pixels.
```

#### Authenticity Badge

```
Authenticity score: [score] out of 1.0. [confidence level]
```

#### Valuation Chart

```
Price history chart showing [description of trend]
```

#### Card Grid

```
Your vault contains [count] cards. Use arrow keys to navigate.
```

---

## Empty States

### No Search Results

```
Title: No cards found
Body: Try adjusting your filters or search terms.
Action: Clear Filters
```

### No Cards in Set

```
Title: No cards from this set
Body: You haven't added any cards from [set name] yet.
Action: Upload Card
```

---

## Feature Flags (Future)

### Feature Disabled

```
Title: Feature Coming Soon
Body: This feature is not available yet. Check back soon!
Action: Go Back
```

---

## Copy Tone Examples

### ✅ Good Examples

- "File is too large. Max is 12 MB."
- "That format isn't supported. Use JPG, PNG, or HEIC."
- "Low-resolution image; results may be less accurate."
- "Upload failed. Check your connection and try again."
- "Your vault is empty. Upload your first card to start building your collection."

### ❌ Avoid

- "You uploaded a file that's too large."
- "Your file format is not supported by our system."
- "ERROR: File size exceeds maximum allowed limit of 12 MB."
- "The upload process has failed due to a network connectivity issue."
- "You don't have any cards in your vault yet."

---

## Localization Notes (Future)

When adding localization support:

- Extract all copy to `locales/en-US.json`
- Use ICU MessageFormat for plurals and variables
- Preserve tone and brevity in translations
- Test RTL layouts for Arabic, Hebrew
- Verify number/currency formatting per locale

---

**End of UI Copy Reference**
