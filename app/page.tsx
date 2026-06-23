import Image from "next/image";

const properties = [
  {
    title: "Strandnära lägenhet i Benidorm",
    location: "Costa Blanca, Spanien",
    image: "/images/semster.jpg",
    price: "1 290",
    rating: "4,9",
    tags: ["Havsutsikt", "2 sovrum", "Pool"],
  },
  {
    title: "Charmig radhusvilla nära havet",
    location: "Torrevieja, Spanien",
    image: "/images/bostad.jpg",
    price: "1 750",
    rating: "4,8",
    tags: ["3 sovrum", "Terrass", "Parkering"],
  },
  {
    title: "Vit by med panoramautsikt",
    location: "Frigiliana, Costa del Sol",
    image: "/images/utsikt.jpg",
    price: "980",
    rating: "5,0",
    tags: ["Bergsutsikt", "Lugnt läge", "Balkong"],
  },
];

const features = [
  {
    icon: "🏖️",
    title: "Vid havet",
    text: "Alla boenden ligger gångavstånd från stranden och soliga promenadstråk.",
  },
  {
    icon: "🔑",
    title: "Enkel incheckning",
    text: "Kontaktlös nyckelhämtning och support på svenska under hela vistelsen.",
  },
  {
    icon: "✅",
    title: "Handplockat",
    text: "Vi besöker varje boende personligen så att du vet exakt vad du bokar.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-zinc-900">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="text-xl font-semibold tracking-tight text-white drop-shadow-sm">
            Costa<span className="text-amber-400">Stay</span>
          </span>
          <div className="hidden items-center gap-8 text-sm font-medium text-white/90 sm:flex">
            <a href="#boenden" className="transition hover:text-white">
              Boenden
            </a>
            <a href="#sa-funkar" className="transition hover:text-white">
              Så funkar det
            </a>
            <a
              href="/login"
              className="rounded-full bg-white px-5 py-2 text-zinc-900 transition hover:bg-amber-400"
            >
              Login
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden">
        <Image
          src="/images/semster.jpg"
          alt="Strandpromenad vid spanska kusten"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center text-white">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
            Sol · Hav · Avkoppling
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Din drömsemester vid spanska kusten
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/90">
            Handplockade semesterboenden med havsutsikt, pool och solen runt
            hörnet. Boka enkelt — vi tar hand om resten.
          </p>
        </div>
      </section>

      {/* Properties */}
      <section id="boenden" className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Populära boenden
            </h2>
            <p className="mt-3 max-w-md text-zinc-600">
              Utvalda favoriter längs Costa Blanca och Costa del Sol.
            </p>
          </div>
          <span className="text-sm font-medium text-zinc-500">
            Priser per natt, från
          </span>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <article
              key={p.title}
              className="group overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition hover:shadow-xl"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={p.image}
                  alt={p.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-sm font-semibold shadow">
                  ★ {p.rating}
                </span>
              </div>
              <div className="p-5">
                <p className="text-sm text-zinc-500">{p.location}</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">
                  {p.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-zinc-900">
                    <span className="text-xl font-semibold">{p.price} kr</span>
                    <span className="text-sm text-zinc-500"> / natt</span>
                  </p>
                  <a
                    href="/login"
                    className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
                  >
                    Login
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="sa-funkar" className="bg-zinc-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[4/3] lg:aspect-[3/4]">
              <Image
                src="/images/palm.jpg"
                alt="Palmer mot en klarblå himmel"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Allt du behöver för en sorglös semester
              </h2>
              <p className="mt-4 text-zinc-600">
                Från första klicket till sista solnedgången — vi gör det enkelt
                att hitta och boka rätt boende.
              </p>
              <ul className="mt-10 space-y-8">
                {features.map((f) => (
                  <li key={f.title} className="flex gap-4">
                    <span className="text-2xl">{f.icon}</span>
                    <div>
                      <h3 className="text-lg font-semibold">{f.title}</h3>
                      <p className="mt-1 text-zinc-600">{f.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/spanien.jpg"
          alt="Kustby vid Medelhavet"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-zinc-900/60" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-28 text-center text-white">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Redo att packa väskan?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/90">
            Hitta ditt perfekta boende vid Medelhavet idag och säkra de bästa
            datumen innan sommaren är fullbokad.
          </p>
          <a
            href="#boenden"
            className="mt-8 inline-block rounded-full bg-amber-400 px-8 py-3.5 text-base font-semibold text-zinc-900 shadow-lg transition hover:bg-amber-300"
          >
            Hitta ditt boende
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-zinc-500 sm:flex-row">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            Costa<span className="text-amber-500">Stay</span>
          </span>
          <p>© {2026} CostaStay. Semesterboenden i Spanien.</p>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-zinc-900">
              Villkor
            </a>
            <a href="#" className="transition hover:text-zinc-900">
              Kontakt
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
