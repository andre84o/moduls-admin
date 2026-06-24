import { Suspense } from "react";
import { BookingBanner } from "./_components/booking-banner";

const features = [
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
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      <Suspense fallback={null}>
        <BookingBanner />
      </Suspense>
      {/* Header */}
      <header className="border-b border-zinc-100">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="text-xl font-semibold tracking-tight text-zinc-900">
            Moduls<span className="text-indigo-600">Admin</span>
          </span>
          <a
            href="/login"
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Login
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 to-white">
        <div className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-indigo-600">
            Admin platform
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            The admin platform for your business
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600">
            A secure, multi-tenant foundation for running and managing your
            business modules from a single place.
          </p>
          <div className="mt-10">
            <a
              href="/login"
              className="inline-block rounded-full bg-zinc-900 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-700"
            >
              Login
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-8 sm:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h3 className="text-lg font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-2 text-zinc-600">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-500 sm:flex-row">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            Moduls<span className="text-indigo-600">Admin</span>
          </span>
          <div className="text-center">
            <p>© 2026 Moduls</p>
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
    </div>
  );
}
