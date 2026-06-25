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
   */
  brand: {
    primary: string;
    accent: string;
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

export const customerContent: CustomerContent = {
  brand: {
    primary: "Moduls",
    accent: "Admin",
  },
  home: {
    hero: {
      eyebrow: "Admin platform",
      heading: "The admin platform for your business",
      body: "A secure, multi-tenant foundation for running and managing your business modules from a single place.",
      cta: {
        label: "Login",
        href: "/login",
      },
    },
    features: {
      items: [
        {
          title: "Multi-tenant",
          text: "Manage many businesses from one platform. Every record is scoped and isolated by business.",
        },
        {
          title: "Secure by default",
          text: "Server-side access control and role-based permissions protect your data at every layer.",
        },
        {
          title: "Modular",
          text: "Enable only the modules each business needs and grow the platform without rework.",
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
    email: "",
    phone: "",
    address: "",
  },
  footer: {
    copyright: "© 2026 Moduls",
  },
};
