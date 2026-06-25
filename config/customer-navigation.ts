/**
 * Customer-specific navigation & social links (temporary mini-CMS).
 *
 * TEMPORARY layer — see config/customer-content.ts for the full rationale.
 *
 * Defines public navigation links, footer links, and social links so they are
 * not hardcoded inside shared header/footer section components. Replace with
 * the real Website Content System when it exists.
 */

export type NavLink = {
  label: string;
  href: string;
  /** Open in a new tab (external links). Defaults to same-tab. */
  external?: boolean;
};

export type SocialLink = {
  /** Platform name, e.g. "Instagram". Used for the accessible label. */
  label: string;
  href: string;
};

export type CustomerNavigation = {
  /** Primary links shown in the public site header. */
  header: NavLink[];
  /** Links shown in the public site footer. */
  footer: NavLink[];
  /** Social links. Empty until the customer needs them. */
  social: SocialLink[];
};

export const customerNavigation: CustomerNavigation = {
  header: [{ label: "Login", href: "/login" }],
  footer: [],
  social: [],
};
