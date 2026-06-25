/**
 * Public feature grid — shared, reusable. Items come from props so it holds no
 * customer-specific content.
 */
export type FeatureGridItem = {
  title: string;
  text: string;
};

export function FeatureGrid({ items }: { items: FeatureGridItem[] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="grid gap-8 sm:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h3 className="text-lg font-semibold tracking-tight">
              {item.title}
            </h3>
            <p className="mt-2 text-zinc-600">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
