import { Brand } from "@/components/sections/Brand";

/**
 * Public site footer — shared, reusable. Brand + copyright come from props.
 *
 * NOTE: The "Design & development by Intenzze" credit is intentionally
 * hardcoded here and must not be removed or made configurable away.
 */
export function SiteFooter({
  brand,
  copyright,
  accentClassName,
}: {
  brand: { primary: string; accent: string };
  copyright: string;
  accentClassName?: string;
}) {
  return (
    <footer className="border-t border-zinc-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-500 sm:flex-row">
        <Brand
          primary={brand.primary}
          accent={brand.accent}
          accentClassName={accentClassName}
          className="text-lg font-semibold tracking-tight text-zinc-900"
        />
        <div className="text-center">
          <p>{copyright}</p>
          <p className="mt-1">
            Design &amp; development by{" "}
            <a
              href="https://intenzze.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-700 transition hover:text-zinc-900"
            >
              Intenzze
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
