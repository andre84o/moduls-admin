import { Brand } from "@/components/sections/Brand";

/**
 * Public site header — shared, reusable. All text/links come from props so it
 * holds no customer-specific content.
 */
export type SiteHeaderNavLink = {
  label: string;
  href: string;
  external?: boolean;
};

export function SiteHeader({
  brand,
  nav,
  accentClassName,
}: {
  brand: { primary: string; accent: string };
  nav: SiteHeaderNavLink[];
  accentClassName?: string;
}) {
  return (
    <header className="border-b border-zinc-100">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Brand
          primary={brand.primary}
          accent={brand.accent}
          accentClassName={accentClassName}
        />
        <div className="flex items-center gap-3">
          {nav.map((link) => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
