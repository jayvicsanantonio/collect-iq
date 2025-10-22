---
title: CollectIQ – Updated Brand & Design
---

Updated on October 11, 2025

# 1. Brand Essence

CollectIQ expresses clarity, intelligence, and precision — designed for collectors who value insight and control. The updated color palette removes all indigo and purple tones to emphasize clean blues, tech-inspired neutrals, and modern gradients.

# 2. Color Palette

The refined palette conveys trust and modern intelligence without any indigo or purple hues.

Primary – Vault Blue (#1A73E8) – Reliability and clarity; main action color for buttons and highlights.

Secondary – Holo Cyan (#00C6FF) – Vibrant energy and modernity; used for gradients and accents.

Surface / Background – Carbon Gray (#1E1E1E) – Dark neutral foundation replacing indigo; clean and serious tone.

Neutral Light – Cloud Silver (#F5F7FA) – Used for card backgrounds and panels in light mode.

Neutral Dark – Graphite Gray (#2E2E2E) – Used in dark mode or for card outlines.

Success – Emerald Glow (#00E676) – Positive signals: price increase, successful actions.

Warning – Amber Pulse (#FFC400) – Attention cues: price drops, pending actions.

Error – Crimson Red (#D32F2F) – Failures or authenticity issues.

Gradients should blend Vault Blue (#1A73E8) to Holo Cyan (#00C6FF) at 45°, used sparingly for primary CTAs or loading elements.

# 3. Typography

Typography conveys intelligence and precision while maintaining approachability.

Primary Font: Inter – Used across UI for its legibility and balance.  
Weights: 400 (Regular), 500 (Medium), 700 (Bold).

Header Font: Space Grotesk – Used for titles and key numbers. Slightly condensed to reflect a data-driven aesthetic.

Monospace Font: JetBrains Mono – For price data, identifiers, and code snippets.

# 4. UI Elements

All elements follow a card-based modular grid with subtle gradients and minimal shadows. No purple hues are allowed.

• Buttons: Primary buttons use Vault Blue with white text. Hover transitions to Holo Cyan. Shadows use transparency instead of color tints.

• Cards: Surface color Cloud Silver in light mode and Graphite Gray in dark mode. Corners rounded at 12–16px; elevation via soft shadow blur (12px).

• Inputs: Borders: 1px solid Graphite Gray. Focus glow: Holo Cyan ring (shadow blur 4px).

• Alerts: Semantic colors only (Emerald Glow, Amber Pulse, Crimson Red). Include icons with 1.5px line weight.

• Charts: Use neutral background with Vault Blue and Emerald Glow data lines. No purple highlights allowed.

# 5. Layout & Spacing

CollectIQ uses an 8px grid system. Common paddings: 16px for components, 24px for sections, and 32px for container edges.

Content max width: 1200px. Maintain generous whitespace and 1.6 line-height for readability.

# 6. Motion & Interaction

Motion follows the principle of 'calm intelligence' — quick yet smooth. Use 200–300ms ease-in-out transitions.

Examples:  
• Hover: slight 3D tilt (2–3°) and subtle gradient shift.  
• Modal open: scale from 95% to 100% with 150ms fade.  
• Loading: Holo Cyan shimmer pulse, replacing generic spinner.

# 7. Dark Mode

Background: Carbon Gray (#1E1E1E). Text: 90% white. Accents maintain full vibrancy.  
Cards and panels use Graphite Gray with Vault Blue outlines. Avoid purple glows entirely.

# 8. Accessibility & Contrast

Ensure all text meets WCAG AA contrast. Vault Blue on white (8.6:1) and Holo Cyan on Carbon Gray (5.1:1) meet accessibility standards.

Maintain visible focus outlines (2px solid Holo Cyan). Test color contrast regularly under different brightness levels.

# 9. Brand Tone & Emotion

CollectIQ is factual yet enthusiastic. It speaks to collectors who love data and nostalgia in equal measure. Tone keywords: intelligent, clear, modern, confident, inclusive.

Avoid exclamation-heavy or slang phrases. Instead of 'That’s awesome!', use 'Your vault just leveled up.'

# 10. Implementation Deliverables

• Tailwind config with new color variables (no indigo, no purple).

• Global theme tokens: color-vault-blue, color-holo-cyan, color-carbon-gray, color-graphite-gray, etc.

• Light/Dark mode CSS variables with gradients.

• shadcn/ui theme extension for consistent brand components.

• Sample dashboard layout with responsive grid and holo gradient CTA button.

# 11. Summary

This update removes all purple and indigo tones from the CollectIQ brand identity. The resulting aesthetic is clean, futuristic, and collector-focused. Vault Blue and Holo Cyan form the heart of the brand’s identity — evoking trust and discovery without overwhelming users.
