/**
 * Customer-specific content (temporary mini-CMS).
 *
 * This is a TEMPORARY content layer. It exists so customer-specific public
 * texts, labels, and links live in one place instead of being hardcoded
 * inside shared/template/core page components.
 *
 * Replace this with the real Website Content System (database-backed) when it
 * is built. Until then:
 *   - Put customer-specific public text/links here.
 *   - Keep shared section components reusable (they receive content via props).
 *   - Do NOT add database CMS tables or draft/publish here.
 *
 * UI text is English by default. A customer may intentionally override copy in
 * another language by editing the strings below.
 */

export type CtaContent = {
  label: string;
  href: string;
};

export type FeatureItem = {
  title: string;
  text: string;
};

export type CustomerContent = {
  /**
   * Brand wordmark shown in header/footer. `accent` is rendered in the theme
   * accent color; `primary` + `accent` together form the full brand name.
   *
   * `logoUrl` is an optional image reference (e.g. "/images/logo.svg" or a
   * remote URL). It is a placeholder for when the customer provides a real
   * logo; the wordmark is used until then.
   */
  brand: {
    primary: string;
    accent: string;
    logoUrl?: string;
  };
  home: {
    hero: {
      eyebrow: string;
      heading: string;
      body: string;
      cta: CtaContent;
    };
    features: {
      items: FeatureItem[];
    };
  };
  /**
   * Static labels shown on the public property page. Property data itself
   * (title, price, description) comes from the database, not from config.
   */
  property: {
    perNightLabel: string;
  };
  /** Public booking status banner messages. */
  bookingBanner: {
    success: string;
    cancelled: string;
  };
  /** Contact details that may be surfaced on public pages. */
  contact: {
    email: string;
    phone: string;
    address: string;
  };
  footer: {
    copyright: string;
  };
};

// NOTE: The values below are clean, generic English PLACEHOLDERS. No real
// customer copy was available at setup time. Replace each value with the
// customer's real content here in config — do not hardcode it into the shared
// section components. Keep claims honest; do not invent specifics.
export const customerContent: CustomerContent = {
  brand: {
    primary: "Your",
    accent: "Brand",
    logoUrl: "",
  },
  home: {
    hero: {
      eyebrow: "Welcome",
      heading: "Welcome to your website",
      body: "This is placeholder text. Replace it with your own welcome message in config/customer-content.ts when your final copy is ready.",
      cta: {
        label: "Login",
        href: "/login",
      },
    },
    features: {
      items: [
        {
          title: "What we offer",
          text: "Describe your main product or service here.",
        },
        {
          title: "Why choose us",
          text: "Add a short, honest description of what makes your business a good choice.",
        },
        {
          title: "Get in touch",
          text: "Tell visitors how to reach you, and update your contact details in config.",
        },
      ],
    },
  },
  property: {
    perNightLabel: "/ night",
  },
  bookingBanner: {
    success:
      "Payment received — your booking is being confirmed. Check your email shortly.",
    cancelled: "Checkout cancelled — you have not been charged.",
  },
  contact: {
    // Placeholders — fill in the customer's real contact details when known.
    email: "",
    phone: "",
    address: "",
  },
  footer: {
    copyright: "© 2026 Your Business",
  },
};
