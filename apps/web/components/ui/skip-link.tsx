/**
 * SkipLink component provides keyboard users a way to skip navigation
 * and jump directly to main content.
 *
 * This is a WCAG 2.2 AA requirement for keyboard accessibility.
 */
export function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
