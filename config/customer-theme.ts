/**
 * Customer-specific theme values (temporary mini-CMS).
 *
 * TEMPORARY layer — see config/customer-content.ts for the full rationale.
 *
 * Holds presentational values that vary per customer (e.g. accent color) so
 * they are not hardcoded across shared section components. Values are Tailwind
 * utility class names so existing styling stays intact. When the real Website
 * Content System / theming exists, this can be replaced.
 *
 * Keep this small: only values that are genuinely customer-specific belong
 * here. Layout, spacing, and structural styling stay in the shared components.
 */

export type CustomerTheme = {
  accent: {
    /** Text color for the brand accent + small eyebrow/label text. */
    text: string;
    /** Hover text color for accent links. */
    hoverText: string;
  };
};

export const customerTheme: CustomerTheme = {
  accent: {
    text: "text-indigo-600",
    hoverText: "hover:text-indigo-700",
  },
};
