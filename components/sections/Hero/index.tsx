/**
 * Public hero section — shared, reusable. All copy/links come from props so it
 * holds no customer-specific content.
 */
export function Hero({
  eyebrow,
  heading,
  body,
  cta,
  accentClassName = "text-indigo-600",
}: {
  eyebrow: string;
  heading: string;
  body: string;
  cta: { label: string; href: string };
  accentClassName?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
        <p
          className={`mb-4 text-sm font-medium uppercase tracking-[0.2em] ${accentClassName}`}
        >
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {heading}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600">{body}</p>
        <div className="mt-10">
          <a
            href={cta.href}
            className="inline-block rounded-full bg-zinc-900 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-700"
          >
            {cta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
